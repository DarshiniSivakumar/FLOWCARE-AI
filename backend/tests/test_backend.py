import datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Patient, Surgery, OperatingTheatre, WorkflowEvent, InstrumentPack, Prediction, Recommendation, Notification
from app.engine import calculate_readiness_score, run_intelligence_pipeline, process_workflow_event
from app.ml import predict_delay
from app.copilot import query_copilot

# In-memory SQLite engine for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_readiness_score_calculation(db_session):
    # Setup patient and surgery
    p = Patient(patient_code="T100", name="Test Patient", age=40, gender="Male")
    db_session.add(p)
    db_session.commit()
    
    s = Surgery(patient_id=p.id, surgeon="Dr. Test", surgery_type="General", scheduled_start=datetime.datetime.utcnow(), expected_duration=60)
    db_session.add(s)
    db_session.commit()
    
    # 0 events -> readiness should be low/baseline
    score_0 = calculate_readiness_score(db_session, p.id, s.id)
    assert score_0 < 30.0

    # Add Patient Ready event -> adds 20%
    db_session.add(WorkflowEvent(patient_id=p.id, surgery_id=s.id, event_type="PATIENT_READY"))
    db_session.commit()
    score_1 = calculate_readiness_score(db_session, p.id, s.id)
    assert score_1 > score_0

    # Add Consent Completed event -> adds 15%
    db_session.add(WorkflowEvent(patient_id=p.id, surgery_id=s.id, event_type="CONSENT_COMPLETED"))
    db_session.commit()
    score_2 = calculate_readiness_score(db_session, p.id, s.id)
    assert score_2 == score_1 + 15.0

def test_delay_prediction_ml():
    pred = predict_delay(
        surgery_type="Cardiac",
        scheduled_hour=10,
        expected_duration=120,
        ot_utilization=75.0,
        anaesthesia_ready=False,
        patient_ready_score=0.4,
        cssd_ready=False,
        transfer_delay=12.0,
        previous_workflow_delays=15.0,
        surgeon_available=False
    )
    assert "predicted_delay_minutes" in pred
    assert "risk_level" in pred
    assert "confidence" in pred
    # Since multiple dependencies are not ready, risk should be HIGH or CRITICAL
    assert pred["risk_level"] in ["HIGH", "CRITICAL"]

def test_intelligence_pipeline_bottleneck_detection(db_session):
    # Test Scenario B: Anaesthesia Delay
    p = Patient(patient_code="T101", name="Test Jane", age=50, gender="Female", current_location="Ward", readiness_score=60.0)
    db_session.add(p)
    
    # Scheduled 10 mins in the future
    s = Surgery(
        patient_id=1, surgeon="Dr. Alice", surgery_type="General", assigned_ot="OT-02",
        scheduled_start=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
        expected_duration=60, status="SCHEDULED", urgency_level="CRITICAL"
    )
    db_session.add(s)
    
    ot = OperatingTheatre(name="OT-02", status="AVAILABLE", utilization=50.0)
    db_session.add(ot)
    db_session.commit()

    # Log ready events except Anaesthesia
    db_session.add_all([
        WorkflowEvent(patient_id=p.id, surgery_id=s.id, event_type="PATIENT_ADMITTED"),
        WorkflowEvent(patient_id=p.id, surgery_id=s.id, event_type="PATIENT_READY"),
        WorkflowEvent(patient_id=p.id, surgery_id=s.id, event_type="CONSENT_COMPLETED"),
        WorkflowEvent(patient_id=p.id, surgery_id=s.id, event_type="CSSD_PACK_READY"),
        WorkflowEvent(patient_id=p.id, surgery_id=s.id, event_type="OT_READY")
    ])
    db_session.commit()
    p.readiness_score = calculate_readiness_score(db_session, p.id, s.id)
    db_session.commit()

    # Run pipeline
    import asyncio
    asyncio.run(run_intelligence_pipeline(db_session, s, p))

    # Check that recommendation was created for Anaesthesia
    rec = db_session.query(Recommendation).filter(Recommendation.surgery_id == s.id).first()
    assert rec is not None
    assert rec.recommendation_type == "REASSIGN_OT" or "anaesthesia" in rec.message.lower()

    # Check alert routing
    notif = db_session.query(Notification).filter(Notification.surgery_id == s.id).first()
    assert notif is not None
    assert notif.recipient_role in ["OT_MANAGER", "ADMIN"]

def test_copilot_parser(db_session):
    # Setup minimal database
    ot = OperatingTheatre(name="OT-02", status="DELAYED", current_surgery="General Surgery")
    db_session.add(ot)
    db_session.commit()

    result = query_copilot("Why is OT-02 delayed?", db_session)
    assert "OT-02" in result["answer"]
    assert "retrieved_data" in result
