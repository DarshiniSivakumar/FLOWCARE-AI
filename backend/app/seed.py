import datetime
import json
from sqlalchemy.orm import Session
from .database import Base, engine, SessionLocal
from .models import (
    User, Patient, Admission, Surgery, OperatingTheatre,
    WorkflowEvent, InstrumentPack, PatientTransfer, Prediction, Recommendation, Notification
)
from .auth import get_password_hash
from .engine import calculate_readiness_score, run_intelligence_pipeline

def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def seed_users(db: Session):
    users = [
        User(name="System Administrator", email="admin@flowcare.demo", password_hash=get_password_hash("password123"), role="ADMIN"),
        User(name="OT Manager", email="otmanager@flowcare.demo", password_hash=get_password_hash("password123"), role="OT_MANAGER"),
        User(name="Ward Nurse John", email="nurse@flowcare.demo", password_hash=get_password_hash("password123"), role="NURSE"),
        User(name="CSSD Tech Sarah", email="cssd@flowcare.demo", password_hash=get_password_hash("password123"), role="CSSD_STAFF"),
        User(name="Dr. Robert Chen", email="doctor@flowcare.demo", password_hash=get_password_hash("password123"), role="DOCTOR")
    ]
    db.add_all(users)
    db.commit()

def seed_operating_theatres(db: Session):
    ots = [
        OperatingTheatre(name="OT-01", status="AVAILABLE", utilization=78.5, available_from=datetime.datetime.utcnow()),
        OperatingTheatre(name="OT-02", status="AVAILABLE", utilization=84.2, available_from=datetime.datetime.utcnow()),
        OperatingTheatre(name="OT-03", status="AVAILABLE", utilization=62.0, available_from=datetime.datetime.utcnow()),
        OperatingTheatre(name="OT-04", status="AVAILABLE", utilization=45.1, available_from=datetime.datetime.utcnow())
    ]
    db.add_all(ots)
    db.commit()

def seed_instrument_packs(db: Session):
    packs = []
    
    # Expiry setup
    sterile_time = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    expiry_time = datetime.datetime.utcnow() + datetime.timedelta(days=28)
    expired_time = datetime.datetime.utcnow() - datetime.timedelta(days=2)

    # General Surgical Sets (Need 10)
    for i in range(1, 11):
        packs.append(InstrumentPack(
            pack_type="General Surgery Set",
            sterilization_status="STERILE",
            sterilized_at=sterile_time,
            expiry_at=expiry_time,
            availability=True
        ))

    # Laparoscopic Sets (Need 6)
    for i in range(1, 7):
        packs.append(InstrumentPack(
            pack_type="Laparoscopic Set",
            sterilization_status="STERILE",
            sterilized_at=sterile_time,
            expiry_at=expiry_time,
            availability=True
        ))

    # Cardiac Sets (Need 4)
    for i in range(1, 5):
        packs.append(InstrumentPack(
            pack_type="Cardiac Set",
            sterilization_status="STERILE",
            sterilized_at=sterile_time,
            expiry_at=expiry_time,
            availability=True
        ))

    # Orthopedic Sets (Need 4)
    for i in range(1, 5):
        packs.append(InstrumentPack(
            pack_type="Orthopedic Set",
            sterilization_status="STERILE",
            sterilized_at=sterile_time,
            expiry_at=expiry_time,
            availability=True
        ))

    # Add 2 Expired packs for warning demo
    packs.append(InstrumentPack(
        pack_type="General Surgery Set",
        sterilization_status="EXPIRED",
        sterilized_at=expired_time - datetime.timedelta(days=30),
        expiry_at=expired_time,
        availability=False
    ))
    
    packs.append(InstrumentPack(
        pack_type="Laparoscopic Set",
        sterilization_status="EXPIRED",
        sterilized_at=expired_time - datetime.timedelta(days=30),
        expiry_at=expired_time,
        availability=False
    ))

    db.add_all(packs)
    db.commit()

def seed_historical_patients_and_surgeries(db: Session):
    # Generates 30 patients and completed surgeries for historical analytics
    for i in range(1, 31):
        patient_code = f"P{1000 + i}"
        name = f"Patient {i}"
        age = 30 + (i * 2) % 50
        gender = "Male" if i % 2 == 0 else "Female"
        
        patient = Patient(
            patient_code=patient_code,
            name=name,
            age=age,
            gender=gender,
            current_location="Discharged",
            readiness_score=100.0,
            urgency_level="MEDIUM"
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

        # Create admission
        adm = Admission(
            patient_id=patient.id,
            admission_time=datetime.datetime.utcnow() - datetime.timedelta(days=i),
            scheduled_surgery=f"Routine Surgery {i}",
            status="DISCHARGED"
        )
        db.add(adm)

        # Create Completed Surgery
        start_time = datetime.datetime.utcnow() - datetime.timedelta(days=i, hours=2)
        end_time = start_time + datetime.timedelta(minutes=75)
        surgery = Surgery(
            patient_id=patient.id,
            surgeon="Dr. Robert Chen" if i % 2 == 0 else "Dr. Alice Green",
            surgery_type="General" if i % 3 == 0 else "Orthopedic",
            assigned_ot=f"OT-0{1 + (i % 4)}",
            scheduled_start=start_time,
            expected_duration=60,
            actual_start=start_time + datetime.timedelta(minutes=5), # 5 min delay
            actual_end=end_time,
            status="COMPLETED",
            urgency_level="MEDIUM"
        )
        db.add(surgery)
        db.commit()

        # Seed events for each completed surgery
        events = [
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_ADMITTED", timestamp=start_time - datetime.timedelta(hours=2)),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_READY", timestamp=start_time - datetime.timedelta(hours=1)),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="CONSENT_COMPLETED", timestamp=start_time - datetime.timedelta(minutes=45)),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="CSSD_PACK_READY", timestamp=start_time - datetime.timedelta(minutes=30)),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="TRANSFER_STARTED", timestamp=start_time - datetime.timedelta(minutes=15)),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_ARRIVED_OT", timestamp=start_time - datetime.timedelta(minutes=5)),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="ANAESTHESIA_READY", timestamp=start_time),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="SURGERY_STARTED", timestamp=start_time + datetime.timedelta(minutes=5)),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="SURGERY_COMPLETED", timestamp=end_time),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_ENTERED_RECOVERY", timestamp=end_time + datetime.timedelta(minutes=5)),
            WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="OT_READY_FOR_NEXT_CASE", timestamp=end_time + datetime.timedelta(minutes=20))
        ]
        db.add_all(events)
        db.commit()

# Scenarios configurations

def trigger_scenario_a(db: Session):
    """
    Scenario A - Normal Path (No delays, everything runs smoothly)
    """
    # Create patient
    patient = Patient(
        patient_code="P101",
        name="John Doe",
        age=45,
        gender="Male",
        current_location="Ward",
        urgency_level="MEDIUM"
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Admission
    adm = Admission(patient_id=patient.id, scheduled_surgery="Laparoscopic Cholecystectomy", status="ADMITTED")
    db.add(adm)

    # Surgery (Scheduled 45 mins in the future)
    scheduled_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=45)
    surgery = Surgery(
        patient_id=patient.id,
        surgeon="Dr. Robert Chen",
        surgery_type="General",
        assigned_ot="OT-01",
        scheduled_start=scheduled_time,
        expected_duration=60,
        status="SCHEDULED",
        urgency_level="MEDIUM"
    )
    db.add(surgery)
    db.commit()
    db.refresh(surgery)

    # Assign pack
    pack = db.query(InstrumentPack).filter(
        InstrumentPack.pack_type == "General Surgery Set",
        InstrumentPack.assigned_surgery_id == None
    ).first()
    if pack:
        pack.assigned_surgery_id = surgery.id
        db.commit()

    # Log ready events
    events = [
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_ADMITTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_PREP_STARTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="CONSENT_COMPLETED", source="DOCTOR"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_READY", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="CSSD_PACK_READY", source="CSSD_STAFF"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="OT_READY", source="OT_MANAGER")
    ]
    db.add_all(events)
    db.commit()

    # Recalculate readiness
    patient.readiness_score = calculate_readiness_score(db, patient.id, surgery.id)
    db.commit()

def trigger_scenario_b(db: Session):
    """
    Scenario B - Anaesthesia Delay
    Patient, CSSD, OT are ready, but Anaesthesia remains incomplete.
    """
    patient = Patient(
        patient_code="P110",
        name="Jane Smith",
        age=52,
        gender="Female",
        current_location="Ward",
        urgency_level="HIGH"
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    adm = Admission(patient_id=patient.id, scheduled_surgery="Total Knee Replacement", status="ADMITTED")
    db.add(adm)

    # Scheduled 15 mins in future (so rules trigger since scheduled < 30 mins)
    scheduled_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    surgery = Surgery(
        patient_id=patient.id,
        surgeon="Dr. Alice Green",
        surgery_type="Orthopedic",
        assigned_ot="OT-02",
        scheduled_start=scheduled_time,
        expected_duration=90,
        status="SCHEDULED",
        urgency_level="HIGH"
    )
    db.add(surgery)
    db.commit()
    db.refresh(surgery)

    # Assign pack
    pack = db.query(InstrumentPack).filter(
        InstrumentPack.pack_type == "Orthopedic Set",
        InstrumentPack.assigned_surgery_id == None
    ).first()
    if pack:
        pack.assigned_surgery_id = surgery.id
        db.commit()

    events = [
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_ADMITTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_PREP_STARTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="CONSENT_COMPLETED", source="DOCTOR"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_READY", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="CSSD_PACK_READY", source="CSSD_STAFF"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="OT_READY", source="OT_MANAGER")
    ]
    db.add_all(events)
    db.commit()

    # Recalculate readiness
    patient.readiness_score = calculate_readiness_score(db, patient.id, surgery.id)
    db.commit()

def trigger_scenario_c(db: Session):
    """
    Scenario C - CSSD Instrument Shortage
    """
    patient = Patient(
        patient_code="P120",
        name="Michael Johnson",
        age=61,
        gender="Male",
        current_location="Ward",
        urgency_level="MEDIUM"
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    adm = Admission(patient_id=patient.id, scheduled_surgery="Laparoscopic Hernia Repair", status="ADMITTED")
    db.add(adm)

    scheduled_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=20)
    surgery = Surgery(
        patient_id=patient.id,
        surgeon="Dr. Robert Chen",
        surgery_type="General",
        assigned_ot="OT-03",
        scheduled_start=scheduled_time,
        expected_duration=50,
        status="SCHEDULED",
        urgency_level="MEDIUM"
    )
    db.add(surgery)
    db.commit()
    db.refresh(surgery)

    # Do not assign pack or trigger CSSD_PACK_READY event.
    # Set all Laparoscopic packs to UNAVAILABLE/STERILIZING to simulate shortage!
    laps = db.query(InstrumentPack).filter(InstrumentPack.pack_type == "Laparoscopic Set").all()
    for l in laps:
        l.sterilization_status = "CLEANING" # In progress/unavailable
        l.availability = False
    db.commit()

    events = [
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_ADMITTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_PREP_STARTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="CONSENT_COMPLETED", source="DOCTOR"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="PATIENT_READY", source="NURSE_APP"),
        WorkflowEvent(patient_id=patient.id, surgery_id=surgery.id, event_type="OT_READY", source="OT_MANAGER")
    ]
    db.add_all(events)
    db.commit()

    # Recalculate readiness
    patient.readiness_score = calculate_readiness_score(db, patient.id, surgery.id)
    db.commit()

def trigger_scenario_d(db: Session):
    """
    Scenario D - Multiple Simultaneous Delays (The center demonstration case)
    Creates 4 delayed surgeries with different urgency levels and root causes:
    1. Patient P102 - Urgency CRITICAL (Emergency) - Anaesthesia incomplete delay
    2. Patient P115 - Urgency HIGH (Cancer surgery) - OT Conflict delay (OT is occupied)
    3. Patient P121 - Urgency MEDIUM (Knee replacement) - Transfer delayed (>10 min in transfer)
    4. Patient P130 - Urgency LOW (Routine surgery) - CSSD pack shortage
    """
    
    # CASE 1: P102 - EMERGENCY - Anaesthesia Delay (Urgency: CRITICAL)
    p102 = Patient(patient_code="P102", name="Robert Davis", age=39, gender="Male", current_location="Ward", urgency_level="CRITICAL")
    db.add(p102)
    db.commit()
    db.refresh(p102)
    db.add(Admission(patient_id=p102.id, scheduled_surgery="Emergency Coronary Bypass", status="ADMITTED"))
    
    s102 = Surgery(
        patient_id=p102.id, surgeon="Dr. Robert Chen", surgery_type="Cardiac", assigned_ot="OT-02",
        scheduled_start=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
        expected_duration=180, status="SCHEDULED", urgency_level="CRITICAL"
    )
    db.add(s102)
    db.commit()
    db.refresh(s102)
    
    # Generalize events (Anaesthesia is incomplete)
    db.add_all([
        WorkflowEvent(patient_id=p102.id, surgery_id=s102.id, event_type="PATIENT_ADMITTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=p102.id, surgery_id=s102.id, event_type="CONSENT_COMPLETED", source="DOCTOR"),
        WorkflowEvent(patient_id=p102.id, surgery_id=s102.id, event_type="PATIENT_READY", source="NURSE_APP"),
        WorkflowEvent(patient_id=p102.id, surgery_id=s102.id, event_type="CSSD_PACK_READY", source="CSSD_STAFF"),
        WorkflowEvent(patient_id=p102.id, surgery_id=s102.id, event_type="OT_READY", source="OT_MANAGER")
    ])
    db.commit()
    p102.readiness_score = calculate_readiness_score(db, p102.id, s102.id)
    db.commit()

    # CASE 2: P115 - CANCER SURGERY - OT Resource Conflict (Urgency: HIGH)
    # Put the assigned OT-03 in occupied status by another hypothetical patient S999
    p115 = Patient(patient_code="P115", name="Margaret Wilson", age=68, gender="Female", current_location="Ward", urgency_level="HIGH")
    db.add(p115)
    db.commit()
    db.refresh(p115)
    db.add(Admission(patient_id=p115.id, scheduled_surgery="Mastectomy & Lymph Node Dissection", status="ADMITTED"))
    
    s115 = Surgery(
        patient_id=p115.id, surgeon="Dr. Alice Green", surgery_type="General", assigned_ot="OT-03",
        scheduled_start=datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
        expected_duration=120, status="SCHEDULED", urgency_level="HIGH"
    )
    db.add(s115)
    db.commit()
    db.refresh(s115)
    
    # Mark OT-03 as currently busy (status: SURGERY)
    ot3 = db.query(OperatingTheatre).filter(OperatingTheatre.name == "OT-03").first()
    if ot3:
        ot3.status = "SURGERY"
        ot3.current_surgery = "Active Preceding Case"
        db.commit()
        
    db.add_all([
        WorkflowEvent(patient_id=p115.id, surgery_id=s115.id, event_type="PATIENT_ADMITTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=p115.id, surgery_id=s115.id, event_type="CONSENT_COMPLETED", source="DOCTOR"),
        WorkflowEvent(patient_id=p115.id, surgery_id=s115.id, event_type="PATIENT_READY", source="NURSE_APP"),
        WorkflowEvent(patient_id=p115.id, surgery_id=s115.id, event_type="CSSD_PACK_READY", source="CSSD_STAFF"),
        # OT Ready is NOT completed because it is busy
    ])
    db.commit()
    p115.readiness_score = calculate_readiness_score(db, p115.id, s115.id)
    db.commit()

    # CASE 3: P121 - KNEE REPLACEMENT - Patient Transfer delay (Urgency: MEDIUM)
    p121 = Patient(patient_code="P121", name="David Brown", age=58, gender="Male", current_location="Transfer", urgency_level="MEDIUM")
    db.add(p121)
    db.commit()
    db.refresh(p121)
    db.add(Admission(patient_id=p121.id, scheduled_surgery="Total Knee Replacement", status="ADMITTED"))
    
    s121 = Surgery(
        patient_id=p121.id, surgeon="Dr. Robert Chen", surgery_type="Orthopedic", assigned_ot="OT-01",
        scheduled_start=datetime.datetime.utcnow() + datetime.timedelta(minutes=20),
        expected_duration=90, status="SCHEDULED", urgency_level="MEDIUM"
    )
    db.add(s121)
    db.commit()
    db.refresh(s121)
    
    # Put patient in active transfer that started 18 minutes ago
    transfer = PatientTransfer(
        patient_id=p121.id, from_location="Ward A", to_location="OT Block",
        start_time=datetime.datetime.utcnow() - datetime.timedelta(minutes=18),
        expected_duration=10
    )
    db.add(transfer)
    db.commit()
    
    db.add_all([
        WorkflowEvent(patient_id=p121.id, surgery_id=s121.id, event_type="PATIENT_ADMITTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=p121.id, surgery_id=s121.id, event_type="CONSENT_COMPLETED", source="DOCTOR"),
        WorkflowEvent(patient_id=p121.id, surgery_id=s121.id, event_type="PATIENT_READY", source="NURSE_APP"),
        WorkflowEvent(patient_id=p121.id, surgery_id=s121.id, event_type="TRANSFER_STARTED", timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=18), source="NURSE_APP"),
        WorkflowEvent(patient_id=p121.id, surgery_id=s121.id, event_type="CSSD_PACK_READY", source="CSSD_STAFF"),
        WorkflowEvent(patient_id=p121.id, surgery_id=s121.id, event_type="OT_READY", source="OT_MANAGER")
    ])
    db.commit()
    p121.readiness_score = calculate_readiness_score(db, p121.id, s121.id)
    db.commit()

    # CASE 4: P130 - ROUTINE SURGERY - CSSD pack shortage (Urgency: LOW)
    p130 = Patient(patient_code="P130", name="James Taylor", age=29, gender="Male", current_location="Ward", urgency_level="LOW")
    db.add(p130)
    db.commit()
    db.refresh(p130)
    db.add(Admission(patient_id=p130.id, scheduled_surgery="Laparoscopic Hernia Repair", status="ADMITTED"))
    
    s130 = Surgery(
        patient_id=p130.id, surgeon="Dr. Alice Green", surgery_type="General", assigned_ot="OT-04",
        scheduled_start=datetime.datetime.utcnow() + datetime.timedelta(minutes=25),
        expected_duration=45, status="SCHEDULED", urgency_level="LOW"
    )
    db.add(s130)
    db.commit()
    db.refresh(s130)
    
    # Shortage setup: mark laparoscopic packs unavailable
    laps = db.query(InstrumentPack).filter(InstrumentPack.pack_type == "Laparoscopic Set").all()
    for l in laps:
        l.sterilization_status = "STERILIZING"
        l.availability = False
    db.commit()
    
    db.add_all([
        WorkflowEvent(patient_id=p130.id, surgery_id=s130.id, event_type="PATIENT_ADMITTED", source="NURSE_APP"),
        WorkflowEvent(patient_id=p130.id, surgery_id=s130.id, event_type="CONSENT_COMPLETED", source="DOCTOR"),
        WorkflowEvent(patient_id=p130.id, surgery_id=s130.id, event_type="PATIENT_READY", source="NURSE_APP"),
        WorkflowEvent(patient_id=p130.id, surgery_id=s130.id, event_type="OT_READY", source="OT_MANAGER")
        # CSSD_PACK_READY is missing
    ])
    db.commit()
    p130.readiness_score = calculate_readiness_score(db, p130.id, s130.id)
    db.commit()

async def run_pipeline_for_all_active_surgeries(db: Session):
    surgeries = db.query(Surgery).filter(Surgery.status != "COMPLETED").all()
    for s in surgeries:
        patient = db.query(Patient).filter(Patient.id == s.patient_id).first()
        if patient:
            await run_intelligence_pipeline(db, s, patient)

async def seed_all(db: Session):
    clean_database()
    seed_users(db)
    seed_operating_theatres(db)
    seed_instrument_packs(db)
    seed_historical_patients_and_surgeries(db)
    
    # Set up Scenarios
    trigger_scenario_a(db)
    trigger_scenario_b(db)
    trigger_scenario_c(db)
    trigger_scenario_d(db)
    
    # Run intelligence predictions/recommendations/notifications
    await run_pipeline_for_all_active_surgeries(db)
    
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    import asyncio
    db = SessionLocal()
    try:
        asyncio.run(seed_all(db))
    finally:
        db.close()
