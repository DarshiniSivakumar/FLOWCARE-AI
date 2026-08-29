import datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Patient, Surgery, OperatingTheatre, WorkflowEvent, InstrumentPack, Prediction, Recommendation, Notification, User, DependencyLink
from app.engine import calculate_readiness_score, run_intelligence_pipeline, process_workflow_event
from app.ml import predict_delay
from app.copilot import query_copilot
from app.dependency_graph import (
    DependencyGraph, Resource, ResourceType, DependencyType, Dependency,
    DependencyGraphBuilder
)

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


# ============================================================================
# DEPENDENCY GRAPH TESTS
# ============================================================================

class TestDependencyGraphBasics:
    """Test basic dependency graph operations."""

    def test_resource_creation_and_hashing(self):
        """Test Resource object creation and hashing."""
        res1 = Resource(ResourceType.SURGERY, 42)
        res2 = Resource(ResourceType.SURGERY, 42)
        res3 = Resource(ResourceType.SURGERY, 43)

        # Same resources should be equal
        assert res1 == res2
        assert hash(res1) == hash(res2)

        # Different resources should not be equal
        assert res1 != res3
        assert hash(res1) != hash(res3)

    def test_resource_from_tuple(self):
        """Test Resource creation from tuple."""
        res = Resource.from_tuple(("surgery", 10))
        assert res.resource_type == ResourceType.SURGERY
        assert res.resource_id == 10

    def test_resource_serialization(self):
        """Test Resource to_dict conversion."""
        res = Resource(ResourceType.OPERATING_THEATRE, 5)
        d = res.to_dict()
        assert d["resource_type"] == "operating_theatre"
        assert d["resource_id"] == 5

    def test_dependency_creation(self):
        """Test Dependency object creation."""
        from_res = Resource(ResourceType.SURGERY, 1)
        to_res = Resource(ResourceType.PATIENT, 10)
        dep = Dependency(
            from_res,
            to_res,
            DependencyType.REQUIRES,
            {"reason": "test"}
        )

        assert dep.from_resource == from_res
        assert dep.to_resource == to_res
        assert dep.dependency_type == DependencyType.REQUIRES

    def test_empty_graph_initialization(self):
        """Test that empty graph initializes correctly."""
        graph = DependencyGraph()
        nodes, edges = graph.size()
        assert nodes == 0
        assert edges == 0

        is_valid, errors = graph.validate_graph()
        assert is_valid
        assert len(errors) == 0


class TestDependencyGraphAddRemove:
    """Test adding and removing dependencies."""

    def test_add_single_dependency(self):
        """Test adding a single dependency."""
        graph = DependencyGraph()
        from_res = Resource(ResourceType.SURGERY, 1)
        to_res = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(
            from_res,
            to_res,
            DependencyType.REQUIRES
        )

        deps = graph.get_dependencies(from_res)
        assert len(deps) == 1
        assert deps[0].to_resource == to_res

    def test_add_multiple_dependencies_same_source(self):
        """Test adding multiple dependencies from same source."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        patient = Resource(ResourceType.PATIENT, 10)
        ot = Resource(ResourceType.OPERATING_THEATRE, 5)
        pack = Resource(ResourceType.INSTRUMENT_PACK, 20)

        graph.add_dependency(surgery, patient, DependencyType.REQUIRES)
        graph.add_dependency(surgery, ot, DependencyType.REQUIRES)
        graph.add_dependency(surgery, pack, DependencyType.REQUIRES)

        deps = graph.get_dependencies(surgery)
        assert len(deps) == 3

    def test_remove_dependency(self):
        """Test removing a dependency."""
        graph = DependencyGraph()
        from_res = Resource(ResourceType.SURGERY, 1)
        to_res = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(
            from_res,
            to_res,
            DependencyType.REQUIRES
        )

        assert len(graph.get_dependencies(from_res)) == 1

        removed = graph.remove_dependency(from_res, to_res)
        assert removed is True
        assert len(graph.get_dependencies(from_res)) == 0

    def test_remove_nonexistent_dependency(self):
        """Test removing a dependency that doesn't exist."""
        graph = DependencyGraph()
        from_res = Resource(ResourceType.SURGERY, 1)
        to_res = Resource(ResourceType.PATIENT, 10)

        removed = graph.remove_dependency(from_res, to_res)
        assert removed is False

    def test_self_loop_rejected(self):
        """Test that self-loops are rejected."""
        graph = DependencyGraph()
        res = Resource(ResourceType.SURGERY, 1)

        with pytest.raises(ValueError, match="Cannot create self-dependency"):
            graph.add_dependency(res, res, DependencyType.REQUIRES)

    def test_add_dependency_with_metadata(self):
        """Test adding dependency with metadata."""
        graph = DependencyGraph()
        from_res = Resource(ResourceType.SURGERY, 1)
        to_res = Resource(ResourceType.OPERATING_THEATRE, 5)
        metadata = {"ot_name": "OT-02", "reason": "assigned"}

        graph.add_dependency(
            from_res,
            to_res,
            DependencyType.REQUIRES,
            metadata=metadata
        )

        deps = graph.get_dependencies(from_res)
        assert len(deps) == 1
        assert deps[0].metadata == metadata


class TestDependencyGraphTraversal:
    """Test graph traversal operations."""

    def test_get_reverse_dependencies_single(self):
        """Test reverse dependency lookup for single edge."""
        graph = DependencyGraph()
        from_res = Resource(ResourceType.SURGERY, 1)
        to_res = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(from_res, to_res, DependencyType.REQUIRES)

        reverse_deps = graph.get_reverse_dependencies(to_res)
        assert len(reverse_deps) == 1
        assert reverse_deps[0].from_resource == from_res

    def test_get_reverse_dependencies_multiple(self):
        """Test reverse dependency lookup with multiple incoming edges."""
        graph = DependencyGraph()
        surgery1 = Resource(ResourceType.SURGERY, 1)
        surgery2 = Resource(ResourceType.SURGERY, 2)
        patient = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(surgery1, patient, DependencyType.REQUIRES)
        graph.add_dependency(surgery2, patient, DependencyType.REQUIRES)

        reverse_deps = graph.get_reverse_dependencies(patient)
        assert len(reverse_deps) == 2

    def test_traverse_downstream_single_level(self):
        """Test downstream traversal (forward graph)."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        patient = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(surgery, patient, DependencyType.REQUIRES)

        downstream = graph.traverse_downstream(surgery)
        assert surgery in downstream
        assert patient in downstream
        assert len(downstream) == 2

    def test_traverse_downstream_multi_level(self):
        """Test multi-level downstream traversal (cascading)."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        ot = Resource(ResourceType.OPERATING_THEATRE, 5)
        patient = Resource(ResourceType.PATIENT, 10)

        # surgery -> ot -> patient
        graph.add_dependency(surgery, ot, DependencyType.REQUIRES)
        graph.add_dependency(ot, patient, DependencyType.REQUIRES)

        downstream = graph.traverse_downstream(surgery)
        assert len(downstream) == 3
        assert surgery in downstream
        assert ot in downstream
        assert patient in downstream

    def test_traverse_upstream_single_level(self):
        """Test upstream traversal (reverse graph)."""
        graph = DependencyGraph()
        from_res = Resource(ResourceType.SURGERY, 1)
        to_res = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(from_res, to_res, DependencyType.REQUIRES)

        upstream = graph.traverse_upstream(to_res)
        assert to_res in upstream
        assert from_res in upstream
        assert len(upstream) == 2

    def test_traverse_upstream_multi_level(self):
        """Test multi-level upstream traversal."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        ot = Resource(ResourceType.OPERATING_THEATRE, 5)
        patient = Resource(ResourceType.PATIENT, 10)

        # surgery -> ot -> patient
        graph.add_dependency(surgery, ot, DependencyType.REQUIRES)
        graph.add_dependency(ot, patient, DependencyType.REQUIRES)

        upstream = graph.traverse_upstream(surgery)
        # From surgery's perspective going upstream, nothing blocks it
        assert surgery in upstream
        assert len(upstream) == 1

        # From patient's perspective
        upstream_from_patient = graph.traverse_upstream(patient)
        assert len(upstream_from_patient) == 3
        assert surgery in upstream_from_patient
        assert ot in upstream_from_patient
        assert patient in upstream_from_patient


class TestDependencyGraphCircularDetection:
    """Test circular dependency detection and prevention."""

    def test_circular_dependency_rejected(self):
        """Test that direct circular dependency is rejected."""
        graph = DependencyGraph()
        res_a = Resource(ResourceType.SURGERY, 1)
        res_b = Resource(ResourceType.SURGERY, 2)

        # a -> b
        graph.add_dependency(res_a, res_b, DependencyType.REQUIRES)

        # b -> a should be rejected
        with pytest.raises(ValueError, match="circular dependency"):
            graph.add_dependency(res_b, res_a, DependencyType.REQUIRES)

    def test_multi_level_circular_dependency_rejected(self):
        """Test that multi-level circular dependency is rejected."""
        graph = DependencyGraph()
        res_a = Resource(ResourceType.SURGERY, 1)
        res_b = Resource(ResourceType.SURGERY, 2)
        res_c = Resource(ResourceType.SURGERY, 3)

        # a -> b -> c
        graph.add_dependency(res_a, res_b, DependencyType.REQUIRES)
        graph.add_dependency(res_b, res_c, DependencyType.REQUIRES)

        # c -> a should be rejected (closes the cycle)
        with pytest.raises(ValueError, match="circular dependency"):
            graph.add_dependency(res_c, res_a, DependencyType.REQUIRES)

    def test_disable_circular_check(self):
        """Test that circular check can be disabled."""
        graph = DependencyGraph()
        res_a = Resource(ResourceType.SURGERY, 1)
        res_b = Resource(ResourceType.SURGERY, 2)

        graph.add_dependency(res_a, res_b, DependencyType.REQUIRES)

        # Should succeed because check_circular=False
        graph.add_dependency(
            res_b,
            res_a,
            DependencyType.REQUIRES,
            check_circular=False
        )

        # But validation should detect it
        is_valid, errors = graph.validate_graph()
        assert not is_valid
        assert any("Cycle detected" in error for error in errors)


class TestDependencyGraphImpactAnalysis:
    """Test impact analysis methods."""

    def test_find_affected_resources_direct(self):
        """Test finding directly affected resources."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        patient = Resource(ResourceType.PATIENT, 10)
        ot = Resource(ResourceType.OPERATING_THEATRE, 5)

        graph.add_dependency(surgery, patient, DependencyType.REQUIRES)
        graph.add_dependency(surgery, ot, DependencyType.REQUIRES)

        affected = graph.find_affected_resources(surgery)
        assert len(affected["direct"]) == 2
        assert patient in affected["direct"]
        assert ot in affected["direct"]
        assert len(affected["cascading"]) == 0

    def test_find_affected_resources_cascading(self):
        """Test finding cascading affected resources."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        ot = Resource(ResourceType.OPERATING_THEATRE, 5)
        patient = Resource(ResourceType.PATIENT, 10)

        # surgery -> ot -> patient
        graph.add_dependency(surgery, ot, DependencyType.REQUIRES)
        graph.add_dependency(ot, patient, DependencyType.REQUIRES)

        affected = graph.find_affected_resources(surgery)
        assert ot in affected["direct"]
        assert patient in affected["cascading"]
        assert len(affected["total"]) == 2

    def test_find_affected_surgeries_empty(self):
        """Test finding affected surgeries when none exist."""
        graph = DependencyGraph()
        patient = Resource(ResourceType.PATIENT, 10)

        surgeries = graph.find_affected_surgeries(patient)
        assert len(surgeries) == 0

    def test_find_affected_surgeries_direct(self):
        """Test finding surgeries affected by resource change."""
        graph = DependencyGraph()
        surgery1 = Resource(ResourceType.SURGERY, 1)
        surgery2 = Resource(ResourceType.SURGERY, 2)
        ot = Resource(ResourceType.OPERATING_THEATRE, 5)

        graph.add_dependency(surgery1, ot, DependencyType.REQUIRES)
        graph.add_dependency(surgery2, ot, DependencyType.REQUIRES)

        surgeries = graph.find_affected_surgeries(ot)
        assert len(surgeries) == 2
        assert surgery1 in surgeries
        assert surgery2 in surgeries

    def test_find_affected_surgeries_cascading(self):
        """Test finding surgeries in cascading dependency chain."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        ot = Resource(ResourceType.OPERATING_THEATRE, 5)
        patient = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(surgery, ot, DependencyType.REQUIRES)
        graph.add_dependency(ot, patient, DependencyType.REQUIRES)

        # Change to patient affects downstream surgery
        surgeries = graph.find_affected_surgeries(patient)
        assert len(surgeries) == 1
        assert surgery in surgeries


class TestDependencyGraphValidation:
    """Test graph validation."""

    def test_validate_empty_graph(self):
        """Test validation of empty graph."""
        graph = DependencyGraph()
        is_valid, errors = graph.validate_graph()
        assert is_valid
        assert len(errors) == 0

    def test_validate_valid_graph(self):
        """Test validation of valid graph."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        patient = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(surgery, patient, DependencyType.REQUIRES)

        is_valid, errors = graph.validate_graph()
        assert is_valid
        assert len(errors) == 0

    def test_validate_detects_inconsistency(self):
        """Test that validation detects inconsistent state."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        patient = Resource(ResourceType.PATIENT, 10)

        # Add dependency normally
        graph.add_dependency(surgery, patient, DependencyType.REQUIRES)

        # Manually corrupt the graph (remove from reverse but not forward)
        graph._reverse_graph[patient].pop()

        is_valid, errors = graph.validate_graph()
        assert not is_valid
        assert len(errors) > 0


class TestDependencyGraphSerialization:
    """Test graph serialization."""

    def test_to_dict_empty_graph(self):
        """Test serialization of empty graph."""
        graph = DependencyGraph()
        d = graph.to_dict()
        assert "edges" in d
        assert len(d["edges"]) == 0

    def test_to_dict_with_dependencies(self):
        """Test serialization with dependencies."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        patient = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(
            surgery,
            patient,
            DependencyType.REQUIRES,
            {"reason": "test"}
        )

        d = graph.to_dict()
        assert len(d["edges"]) == 1
        edge = d["edges"][0]
        assert edge["from_resource"]["resource_type"] == "surgery"
        assert edge["to_resource"]["resource_type"] == "patient"
        assert edge["dependency_type"] == "requires"
        assert edge["metadata"]["reason"] == "test"

    def test_graph_clear(self):
        """Test clearing graph."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, 1)
        patient = Resource(ResourceType.PATIENT, 10)

        graph.add_dependency(surgery, patient, DependencyType.REQUIRES)
        assert graph.size()[1] > 0

        graph.clear()
        assert graph.size() == (0, 0)


class TestDependencyGraphBuilderIntegration:
    """Test building graphs from database state."""

    def test_build_from_database_empty(self, db_session):
        """Test building graph from empty database."""
        graph = DependencyGraphBuilder.build_from_database(db_session)
        nodes, edges = graph.size()
        assert nodes == 0
        assert edges == 0

    def test_build_from_database_with_surgery(self, db_session):
        """Test building graph with surgery and dependencies."""
        # Create test data
        patient = Patient(
            patient_code="P001",
            name="Test Patient",
            age=45,
            gender="Male"
        )
        db_session.add(patient)
        db_session.flush()

        surgery = Surgery(
            patient_id=patient.id,
            surgeon="Dr. Smith",
            surgery_type="General",
            scheduled_start=datetime.datetime.utcnow(),
            expected_duration=60
        )
        db_session.add(surgery)
        db_session.flush()

        surgeon_user = User(
            name="Dr. Smith",
            email="dr.smith@hospital.com",
            password_hash="hash",
            role="DOCTOR"
        )
        db_session.add(surgeon_user)
        db_session.flush()

        ot = OperatingTheatre(
            name="OT-01",
            status="AVAILABLE"
        )
        db_session.add(ot)
        db_session.flush()

        # Assign OT and commit
        surgery.assigned_ot = "OT-01"
        db_session.commit()

        # Build graph
        graph = DependencyGraphBuilder.build_from_database(db_session)

        # Verify surgery -> patient dependency exists
        surgery_res = Resource(ResourceType.SURGERY, surgery.id)
        deps = graph.get_dependencies(surgery_res)
        dep_targets = {dep.to_resource.resource_type for dep in deps}
        assert ResourceType.PATIENT in dep_targets

    def test_build_from_database_with_instrument_pack(self, db_session):
        """Test building graph with instrument pack."""
        # Create test data
        patient = Patient(
            patient_code="P002",
            name="Test Patient 2",
            age=50,
            gender="Female"
        )
        db_session.add(patient)
        db_session.flush()

        surgery = Surgery(
            patient_id=patient.id,
            surgeon="Dr. Jones",
            surgery_type="Cardiac",
            scheduled_start=datetime.datetime.utcnow(),
            expected_duration=120
        )
        db_session.add(surgery)
        db_session.flush()

        pack = InstrumentPack(
            pack_type="Cardiac",
            sterilization_status="STERILE",
            assigned_surgery_id=surgery.id
        )
        db_session.add(pack)
        db_session.commit()

        # Build graph
        graph = DependencyGraphBuilder.build_from_database(db_session)

        # Verify surgery -> pack dependency exists
        surgery_res = Resource(ResourceType.SURGERY, surgery.id)
        deps = graph.get_dependencies(surgery_res)
        dep_targets = {dep.to_resource.resource_type for dep in deps}
        assert ResourceType.INSTRUMENT_PACK in dep_targets

    def test_graph_determinism(self, db_session):
        """Test that graph building is deterministic."""
        # Create test data
        patient = Patient(
            patient_code="P003",
            name="Test Patient 3",
            age=55,
            gender="Male"
        )
        db_session.add(patient)
        db_session.flush()

        surgery = Surgery(
            patient_id=patient.id,
            surgeon="Dr. Brown",
            surgery_type="Orthopedic",
            scheduled_start=datetime.datetime.utcnow(),
            expected_duration=90
        )
        db_session.add(surgery)
        db_session.commit()

        # Build graph twice
        graph1 = DependencyGraphBuilder.build_from_database(db_session)
        graph2 = DependencyGraphBuilder.build_from_database(db_session)

        # Should have same size
        assert graph1.size() == graph2.size()

        # Serialize both
        d1 = graph1.to_dict()
        d2 = graph2.to_dict()

        # Same number of edges
        assert len(d1["edges"]) == len(d2["edges"])

