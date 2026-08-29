"""
Unit Tests for FlowCare Deterministic What-If Simulation Engine.

Proves:
1. Normal simulation execution
2. OT failure (OT_UNAVAILABLE)
3. Surgery delay (SURGERY_DELAY)
4. Recovery constraint (RECOVERY_CAPACITY_REDUCED)
5. Resource conflict detection
6. Production database remains completely unchanged (zero side-effects)
7. Repeated identical simulations return identical results (determinism)
8. Clear error handling for invalid scenarios or missing parameters
"""

import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Patient, Surgery, OperatingTheatre, InstrumentPack, User
from app.simulation import (
    HospitalState,
    SimulationState,
    DependencyGraphBuilder,
    SimulationEngine,
    SimulationResult,
)

# In-memory SQLite engine for unit tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Populate test database
    p1 = Patient(patient_code="P101", name="Alice Smith", age=45, gender="Female", current_location="Ward", readiness_score=85.0)
    p2 = Patient(patient_code="P102", name="Bob Jones", age=55, gender="Male", current_location="Ward", readiness_score=90.0)
    db.add_all([p1, p2])
    db.flush()

    ot1 = OperatingTheatre(name="OT-01", status="AVAILABLE", utilization=65.0)
    ot2 = OperatingTheatre(name="OT-02", status="AVAILABLE", utilization=70.0)
    db.add_all([ot1, ot2])
    db.flush()

    s1 = Surgery(
        patient_id=p1.id,
        surgeon="Dr. Taylor",
        surgery_type="Laparoscopic Cholecystectomy",
        assigned_ot="OT-01",
        scheduled_start=datetime.datetime.utcnow(),
        expected_duration=60,
        status="SCHEDULED",
        urgency_level="MEDIUM"
    )
    s2 = Surgery(
        patient_id=p2.id,
        surgeon="Dr. Davis",
        surgery_type="Cardiac Bypass",
        assigned_ot="OT-02",
        scheduled_start=datetime.datetime.utcnow(),
        expected_duration=120,
        status="SCHEDULED",
        urgency_level="HIGH"
    )
    db.add_all([s1, s2])
    db.commit()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


class TestSimulationEngine:
    """Comprehensive test suite for Deterministic What-If Simulation Engine."""

    def test_normal_simulation(self, db_session):
        """Test normal simulation scenario execution."""
        hospital_state = HospitalState.capture_from_db(db_session)
        graph = DependencyGraphBuilder.build_from_database(db_session)
        engine = SimulationEngine(hospital_state, graph)

        result = engine.run_simulation("SURGERY_DELAY", {"surgery_id": 1, "delay_minutes": 15})
        assert isinstance(result, SimulationResult)
        assert result.scenario_type == "SURGERY_DELAY"
        assert result.total_delay_minutes >= 15.0
        assert 1 in result.affected_surgeries

    def test_ot_failure_scenario(self, db_session):
        """Test OT_UNAVAILABLE scenario (e.g. OT-02 unavailable for 45 minutes)."""
        hospital_state = HospitalState.capture_from_db(db_session)
        graph = DependencyGraphBuilder.build_from_database(db_session)
        engine = SimulationEngine(hospital_state, graph)

        result = engine.run_simulation("OT_UNAVAILABLE", {"ot_name": "OT-02", "duration_minutes": 45})
        assert result.scenario_type == "OT_UNAVAILABLE"
        assert result.total_delay_minutes >= 45.0
        assert 2 in result.affected_surgeries
        assert result.ot_utilization["OT-02"] < 70.0

    def test_surgery_delay_scenario(self, db_session):
        """Test SURGERY_DELAY scenario (e.g. Surgery S104 delayed by 25 minutes)."""
        hospital_state = HospitalState.capture_from_db(db_session)
        graph = DependencyGraphBuilder.build_from_database(db_session)
        engine = SimulationEngine(hospital_state, graph)

        result = engine.run_simulation("SURGERY_DELAY", {"surgery_id": 1, "delay_minutes": 25})
        assert result.scenario_type == "SURGERY_DELAY"
        assert result.total_delay_minutes == 25.0
        assert 1 in result.affected_surgeries

    def test_recovery_constraint_scenario(self, db_session):
        """Test RECOVERY_CAPACITY_REDUCED scenario (e.g. capacity reduced from 6 to 1)."""
        hospital_state = HospitalState.capture_from_db(db_session)
        graph = DependencyGraphBuilder.build_from_database(db_session)
        engine = SimulationEngine(hospital_state, graph)

        result = engine.run_simulation("RECOVERY_CAPACITY_REDUCED", {"new_capacity": 1})
        assert result.scenario_type == "RECOVERY_CAPACITY_REDUCED"
        assert result.recovery_overflow >= 1
        assert len(result.resource_conflicts) > 0

    def test_resource_conflict_detection(self, db_session):
        """Test that overlapping or unavailable resources produce resource conflict logs."""
        hospital_state = HospitalState.capture_from_db(db_session)
        graph = DependencyGraphBuilder.build_from_database(db_session)
        engine = SimulationEngine(hospital_state, graph)

        result = engine.run_simulation("OT_UNAVAILABLE", {"ot_name": "OT-01", "duration_minutes": 30})
        assert len(result.resource_conflicts) > 0
        conflict = result.resource_conflicts[0]
        assert "resource" in conflict
        assert conflict["conflict_type"] == "OT_UNAVAILABLE"

    def test_production_database_remains_unchanged(self, db_session):
        """
        CRITICAL TEST: Verify that running a simulation NEVER mutates real production database tables.
        """
        # Record pre-simulation database state
        pre_surgeries = db_session.query(Surgery).all()
        pre_statuses = {s.id: s.status for s in pre_surgeries}
        pre_ots = db_session.query(OperatingTheatre).all()
        pre_ot_statuses = {o.id: o.status for o in pre_ots}

        hospital_state = HospitalState.capture_from_db(db_session)
        graph = DependencyGraphBuilder.build_from_database(db_session)
        engine = SimulationEngine(hospital_state, graph)

        # Run extreme simulation with heavy delays and OT failure
        result = engine.run_simulation("OT_UNAVAILABLE", {"ot_name": "OT-01", "duration_minutes": 120})
        assert result.total_delay_minutes > 0

        # Query database again and verify zero changes
        db_session.expire_all()
        post_surgeries = db_session.query(Surgery).all()
        post_statuses = {s.id: s.status for s in post_surgeries}
        post_ots = db_session.query(OperatingTheatre).all()
        post_ot_statuses = {o.id: o.status for o in post_ots}

        assert pre_statuses == post_statuses
        assert pre_ot_statuses == post_ot_statuses

    def test_determinism_identical_runs(self, db_session):
        """
        CRITICAL TEST: Verify that repeated identical simulations return identical results.
        """
        hospital_state = HospitalState.capture_from_db(db_session)
        graph = DependencyGraphBuilder.build_from_database(db_session)
        engine = SimulationEngine(hospital_state, graph)

        params = {"surgery_id": 1, "delay_minutes": 30}

        # Run simulation 3 times
        res1 = engine.run_simulation("SURGERY_DELAY", params)
        res2 = engine.run_simulation("SURGERY_DELAY", params)
        res3 = engine.run_simulation("SURGERY_DELAY", params)

        # Compare outputs
        assert res1.total_delay_minutes == res2.total_delay_minutes == res3.total_delay_minutes
        assert res1.affected_surgeries == res2.affected_surgeries == res3.affected_surgeries
        assert res1.ot_utilization == res2.ot_utilization == res3.ot_utilization
        assert res1.summary == res2.summary == res3.summary

    def test_invalid_scenario_error_handling(self, db_session):
        """Test clear error handling for unsupported scenarios or invalid parameters."""
        hospital_state = HospitalState.capture_from_db(db_session)
        graph = DependencyGraphBuilder.build_from_database(db_session)
        engine = SimulationEngine(hospital_state, graph)

        # Unsupported scenario name
        with pytest.raises(ValueError, match="Unsupported scenario_type"):
            engine.run_simulation("INVALID_SCENARIO", {})

        # Missing ot_name for OT_UNAVAILABLE
        with pytest.raises(ValueError, match="Valid 'ot_name' required"):
            engine.run_simulation("OT_UNAVAILABLE", {})

        # Negative capacity
        with pytest.raises(ValueError, match="new_capacity must be non-negative"):
            engine.run_simulation("RECOVERY_CAPACITY_REDUCED", {"new_capacity": -5})
