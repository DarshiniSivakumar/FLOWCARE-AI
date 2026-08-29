"""
FlowCare Simulation Engine Package.

Includes:
- Workflow Dependency Graph service
- HospitalState & SimulationState in-memory snapshots
- CascadingImpactEngine for multi-level consequence tracking
- Deterministic What-If SimulationEngine & SimulationResult
"""

from .graph import (
    ResourceType,
    DependencyType,
    Resource,
    Dependency,
    DependencyGraph,
    DependencyGraphBuilder,
)
from .state import HospitalState, SimulationState, SurgeryState, OTState, PatientState, ResourceState
from .cascading import CascadingImpactEngine
from .engine import SimulationEngine, SimulationResult, SimEvent

__all__ = [
    "ResourceType",
    "DependencyType",
    "Resource",
    "Dependency",
    "DependencyGraph",
    "DependencyGraphBuilder",
    "HospitalState",
    "SimulationState",
    "SurgeryState",
    "OTState",
    "PatientState",
    "ResourceState",
    "CascadingImpactEngine",
    "SimulationEngine",
    "SimulationResult",
    "SimEvent",
]
