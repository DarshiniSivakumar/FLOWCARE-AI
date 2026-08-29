"""
Unit Tests for FlowCare Simulation Engine Workflow Dependency Graph Service.

Tests cover:
1. Direct dependency
2. Multiple dependencies (Surgery -> OT, Surgeon, Anaesthesia, Instrument Set, Recovery Bed)
3. Reverse lookup
4. Multi-level cascade
5. Missing resource
6. Circular dependency protection
"""

import pytest
from app.simulation.graph import (
    DependencyGraph,
    Resource,
    ResourceType,
    DependencyType,
    DependencyGraphBuilder,
)


class TestWorkflowDependencyGraph:
    """Comprehensive unit test suite for simulation workflow dependency graph."""

    def test_direct_dependency(self):
        """Test adding and querying direct dependency (A -> B)."""
        graph = DependencyGraph()
        surgery = Resource(ResourceType.SURGERY, "S104")
        patient = Resource(ResourceType.PATIENT, "P-101")

        graph.add_dependency(surgery, patient, DependencyType.REQUIRES)

        deps = graph.get_dependencies(surgery)
        assert len(deps) == 1
        assert deps[0].from_resource == surgery
        assert deps[0].to_resource == patient
        assert deps[0].dependency_type == DependencyType.REQUIRES

    def test_multiple_dependencies(self):
        """
        Test multiple operational dependencies for a single surgery.
        Example:
        Surgery S104
        ├── requires OT-2
        ├── requires Surgeon-03
        ├── requires Anaesthesia-01
        ├── requires LAP-SET-02
        └── requires Recovery-04
        """
        graph = DependencyGraph()
        surg = Resource(ResourceType.SURGERY, "S104")
        ot = Resource(ResourceType.OPERATING_THEATRE, "OT-2")
        surgeon = Resource(ResourceType.SURGEON, "Surgeon-03")
        anaesthesia = Resource(ResourceType.ANAESTHESIA_TEAM, "Anaesthesia-01")
        instrument_set = Resource(ResourceType.INSTRUMENT_SET, "LAP-SET-02")
        recovery_bed = Resource(ResourceType.RECOVERY_BED, "Recovery-04")

        graph.add_dependency(surg, ot, DependencyType.REQUIRES, {"name": "Operating Theatre 2"})
        graph.add_dependency(surg, surgeon, DependencyType.REQUIRES, {"name": "Dr. Smith"})
        graph.add_dependency(surg, anaesthesia, DependencyType.REQUIRES, {"team": "Team Alpha"})
        graph.add_dependency(surg, instrument_set, DependencyType.REQUIRES, {"pack": "Laparoscopic Set"})
        graph.add_dependency(surg, recovery_bed, DependencyType.REQUIRES, {"bed": "Bed 4"})

        deps = graph.get_dependencies(surg)
        assert len(deps) == 5

        target_types = {dep.to_resource.resource_type for dep in deps}
        assert target_types == {
            ResourceType.OPERATING_THEATRE,
            ResourceType.SURGEON,
            ResourceType.ANAESTHESIA_TEAM,
            ResourceType.INSTRUMENT_SET,
            ResourceType.RECOVERY_BED,
        }

        # Verify tree representation output
        tree = graph.get_surgery_tree(surg)
        assert tree["id"] == "S104"
        assert tree["type"] == "surgery"
        assert len(tree["dependencies"]) == 5

    def test_reverse_lookup(self):
        """Test reverse dependency lookup (querying what depends on a given resource)."""
        graph = DependencyGraph()
        s1 = Resource(ResourceType.SURGERY, "S104")
        s2 = Resource(ResourceType.SURGERY, "S105")
        recovery = Resource(ResourceType.RECOVERY_BED, "Recovery-04")

        graph.add_dependency(s1, recovery, DependencyType.REQUIRES)
        graph.add_dependency(s2, recovery, DependencyType.REQUIRES)

        # Reverse lookup on Recovery-04
        reverse_deps = graph.get_reverse_dependencies(recovery)
        assert len(reverse_deps) == 2

        depending_surgeries = {dep.from_resource for dep in reverse_deps}
        assert s1 in depending_surgeries
        assert s2 in depending_surgeries

    def test_multi_level_cascade(self):
        """Test multi-level downstream cascade and impact analysis."""
        graph = DependencyGraph()
        surg = Resource(ResourceType.SURGERY, "S104")
        ot = Resource(ResourceType.OPERATING_THEATRE, "OT-2")
        power = Resource(ResourceType.USER, "PowerSupply-01")
        grid = Resource(ResourceType.USER, "MainGrid")

        # Chain: surg -> ot -> power -> grid
        graph.add_dependency(surg, ot, DependencyType.REQUIRES)
        graph.add_dependency(ot, power, DependencyType.REQUIRES)
        graph.add_dependency(power, grid, DependencyType.REQUIRES)

        # Traversal downstream
        downstream = graph.traverse_downstream(surg)
        assert len(downstream) == 4
        assert surg in downstream
        assert ot in downstream
        assert power in downstream
        assert grid in downstream

        # Impact analysis
        impact = graph.find_affected_resources(surg)
        assert ot in impact["direct"]
        assert power in impact["cascading"]
        assert grid in impact["cascading"]

    def test_missing_resource(self):
        """Test querying non-existent resource in graph."""
        graph = DependencyGraph()
        missing = Resource(ResourceType.SURGERY, "S999")

        assert graph.get_dependencies(missing) == []
        assert graph.get_reverse_dependencies(missing) == []
        assert graph.traverse_downstream(missing) == {missing}
        assert graph.traverse_upstream(missing) == {missing}
        assert len(graph.find_affected_surgeries(missing)) == 0

        affected = graph.find_affected_resources(missing)
        assert affected["direct"] == set()
        assert affected["cascading"] == set()
        assert affected["total"] == set()

    def test_circular_dependency_protection(self):
        """Test that circular dependencies and self-loops are blocked."""
        graph = DependencyGraph()
        r1 = Resource(ResourceType.SURGERY, "S104")
        r2 = Resource(ResourceType.OPERATING_THEATRE, "OT-2")
        r3 = Resource(ResourceType.RECOVERY_BED, "Recovery-04")

        # Self loop protection
        with pytest.raises(ValueError, match="Cannot create self-dependency"):
            graph.add_dependency(r1, r1, DependencyType.REQUIRES)

        # Direct cycle protection: r1 -> r2, then r2 -> r1
        graph.add_dependency(r1, r2, DependencyType.REQUIRES)
        with pytest.raises(ValueError, match="circular dependency"):
            graph.add_dependency(r2, r1, DependencyType.REQUIRES)

        # Multi-level cycle protection: r2 -> r3, then r3 -> r1
        graph.add_dependency(r2, r3, DependencyType.REQUIRES)
        with pytest.raises(ValueError, match="circular dependency"):
            graph.add_dependency(r3, r1, DependencyType.REQUIRES)
