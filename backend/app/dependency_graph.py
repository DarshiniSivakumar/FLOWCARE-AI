"""
FlowCare Workflow Dependency Graph Service Adapter

Re-exports from backend/app/simulation/graph.py for backwards compatibility
and smooth module integration.
"""

from .simulation.graph import (
    ResourceType,
    DependencyType,
    Resource,
    Dependency,
    DependencyGraph,
    DependencyGraphBuilder,
)

__all__ = [
    "ResourceType",
    "DependencyType",
    "Resource",
    "Dependency",
    "DependencyGraph",
    "DependencyGraphBuilder",
]
