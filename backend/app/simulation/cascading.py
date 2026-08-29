"""
FlowCare Cascading Impact Engine

Evaluates multi-level operational impacts across hospital entities
using the Workflow Dependency Graph.
"""

from typing import Set, Dict, List, Tuple, Any, Union
from .graph import DependencyGraph, Resource, ResourceType, DependencyType


class CascadingImpactEngine:
    """
    Analyzes cascading ripple effects of resource bottlenecks and delays.
    """

    def __init__(self, graph: DependencyGraph):
        self.graph = graph

    def evaluate_delay_impact(
        self,
        resource_type: ResourceType,
        resource_id: Union[int, str],
        delay_minutes: float
    ) -> Dict[str, Any]:
        """
        Evaluate downstream and upstream consequences of a resource delay.

        Args:
            resource_type: Type of resource
            resource_id: Resource identifier
            delay_minutes: Delay duration in minutes

        Returns:
            Dict containing impacted resources, cascading nodes, and affected surgeries.
        """
        target_res = Resource(resource_type, resource_id)
        affected_resources = self.graph.find_affected_resources(target_res)
        affected_surgeries = self.graph.find_affected_surgeries(target_res)

        return {
            "target_resource": target_res.to_dict(),
            "delay_minutes": delay_minutes,
            "direct_affected": [r.to_dict() for r in affected_resources["direct"]],
            "cascading_affected": [r.to_dict() for r in affected_resources["cascading"]],
            "reverse_affected": [r.to_dict() for r in affected_resources["reverse_affected"]],
            "affected_surgeries": [r.to_dict() for r in affected_surgeries]
        }
