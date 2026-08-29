"""
FlowCare Workflow Dependency Graph Service

Provides a reusable, deterministic dependency graph abstraction for hospital
operational resources (surgeries, patients, OTs, surgeons, anaesthesia teams,
instrument sets, recovery beds, users).

Supports:
- Operational entity types: Surgery, Patient, Operating Theatre, Surgeon,
  Anaesthesia Team, Instrument Set, Recovery Bed, User.
- Direct and reverse dependency queries
- Upstream and downstream traversal (cascading effects)
- Multi-level dependency traversal
- Circular dependency detection and protection
- Affected resources and surgeries impact analysis
- Database state extraction reusing existing SQLAlchemy models
"""

import logging
from typing import Set, Dict, List, Tuple, Optional, Union, Any
from dataclasses import dataclass, field
from enum import Enum
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ResourceType(Enum):
    """Types of operational resources in hospital workflows."""
    SURGERY = "surgery"
    PATIENT = "patient"
    OPERATING_THEATRE = "operating_theatre"
    SURGEON = "surgeon"
    ANAESTHESIA_TEAM = "anaesthesia_team"
    INSTRUMENT_SET = "instrument_set"
    INSTRUMENT_PACK = "instrument_pack"  # Backwards compatibility alias
    RECOVERY_BED = "recovery_bed"
    USER = "user"


class DependencyType(Enum):
    """Types of operational dependencies."""
    MUST_COMPLETE_BEFORE = "must_complete_before"  # A must finish before B starts
    REQUIRES = "requires"                          # B requires A to be available/ready
    BLOCKS_IF = "blocks_if"                        # A blocks B if A is unavailable
    SHARES_RESOURCE = "shares_resource"            # A and B compete for same resource


@dataclass
class Resource:
    """
    Represents a hospital operational resource in the dependency graph.
    `resource_id` can be an integer primary key (e.g., 104) or a string code (e.g., 'S104', 'OT-2', 'Surgeon-03').
    """
    resource_type: ResourceType
    resource_id: Union[int, str]

    def __hash__(self) -> int:
        return hash((self.resource_type.value, str(self.resource_id)))

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, Resource):
            return False
        return (
            self.resource_type == other.resource_type
            and str(self.resource_id) == str(other.resource_id)
        )

    def __repr__(self) -> str:
        return f"{self.resource_type.value}:{self.resource_id}"

    @classmethod
    def from_tuple(cls, resource_tuple: Tuple[str, Union[int, str]]) -> "Resource":
        """Create from (type_string, id) tuple."""
        type_str, resource_id = resource_tuple
        resource_type = ResourceType(type_str)
        return cls(resource_type, resource_id)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "resource_type": self.resource_type.value,
            "resource_id": self.resource_id
        }


@dataclass
class Dependency:
    """Represents a single dependency relationship edge (from_resource -> to_resource)."""
    from_resource: Resource
    to_resource: Resource
    dependency_type: DependencyType
    metadata: Dict = field(default_factory=dict)

    def __repr__(self) -> str:
        return (
            f"{self.from_resource} "
            f"--[{self.dependency_type.value}]--> {self.to_resource}"
        )

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "from_resource": self.from_resource.to_dict(),
            "to_resource": self.to_resource.to_dict(),
            "dependency_type": self.dependency_type.value,
            "metadata": self.metadata
        }


class DependencyGraph:
    """
    Deterministic, in-memory dependency graph service.

    Features:
    - Adding/removing dependency edges with circular dependency protection.
    - Direct dependency lookup (what A depends on).
    - Reverse dependency lookup (what depends on A).
    - Multi-level downstream traversal (cascading impact).
    - Multi-level upstream traversal (prerequisites).
    - Affected surgeries and resources analysis.
    - Usable by simulation engine & digital twin modules.
    """

    def __init__(self):
        """Initialize empty dependency graph."""
        # adjacency list: Resource -> { (to_resource, dependency_type) }
        self._graph: Dict[Resource, Set[Tuple[Resource, DependencyType]]] = {}
        self._reverse_graph: Dict[Resource, Set[Tuple[Resource, DependencyType]]] = {}
        self._metadata: Dict[Tuple[Resource, Resource, DependencyType], Dict] = {}

    def add_dependency(
        self,
        from_resource: Resource,
        to_resource: Resource,
        dependency_type: DependencyType = DependencyType.REQUIRES,
        metadata: Optional[Dict] = None,
        check_circular: bool = True
    ) -> None:
        """
        Add a dependency edge: from_resource -> to_resource.

        Args:
            from_resource: Source resource (e.g. Surgery S104)
            to_resource: Target resource (e.g. OT-2)
            dependency_type: Type of dependency
            metadata: Context metadata
            check_circular: If True, protect against circular dependencies

        Raises:
            ValueError: If self-loop or circular dependency is detected
        """
        if from_resource == to_resource:
            raise ValueError(
                f"Cannot create self-dependency for {from_resource}"
            )

        if check_circular and self._would_create_cycle(from_resource, to_resource):
            raise ValueError(
                f"Adding dependency {from_resource} -> {to_resource} "
                "would create a circular dependency"
            )

        if from_resource not in self._graph:
            self._graph[from_resource] = set()
        if to_resource not in self._reverse_graph:
            self._reverse_graph[to_resource] = set()

        edge = (to_resource, dependency_type)
        reverse_edge = (from_resource, dependency_type)

        self._graph[from_resource].add(edge)
        self._reverse_graph[to_resource].add(reverse_edge)

        key = (from_resource, to_resource, dependency_type)
        self._metadata[key] = metadata or {}

        logger.debug(
            f"Dependency added: {from_resource} --[{dependency_type.value}]--> {to_resource}"
        )

    def remove_dependency(
        self,
        from_resource: Resource,
        to_resource: Resource,
        dependency_type: Optional[DependencyType] = None
    ) -> bool:
        """
        Remove a dependency edge.

        Returns:
            True if edge was removed, False if not found.
        """
        if from_resource not in self._graph:
            return False

        removed = False
        edges_to_remove = [
            edge for edge in self._graph[from_resource]
            if edge[0] == to_resource
            and (dependency_type is None or edge[1] == dependency_type)
        ]

        for edge in edges_to_remove:
            self._graph[from_resource].remove(edge)
            removed = True

            if to_resource in self._reverse_graph:
                reverse_edge = (from_resource, edge[1])
                self._reverse_graph[to_resource].discard(reverse_edge)

            key = (from_resource, to_resource, edge[1])
            self._metadata.pop(key, None)

        if not self._graph[from_resource]:
            del self._graph[from_resource]
        if to_resource in self._reverse_graph and not self._reverse_graph[to_resource]:
            del self._reverse_graph[to_resource]

        return removed

    def get_dependencies(self, resource: Resource) -> List[Dependency]:
        """
        Get direct dependencies of a resource (what it depends on).
        """
        if resource not in self._graph:
            return []

        dependencies = []
        for to_resource, dep_type in self._graph[resource]:
            key = (resource, to_resource, dep_type)
            metadata = self._metadata.get(key, {})
            dependencies.append(
                Dependency(resource, to_resource, dep_type, metadata)
            )
        return dependencies

    def get_reverse_dependencies(self, resource: Resource) -> List[Dependency]:
        """
        Get reverse dependencies of a resource (what depends on this resource).
        """
        if resource not in self._reverse_graph:
            return []

        dependencies = []
        for from_resource, dep_type in self._reverse_graph[resource]:
            key = (from_resource, resource, dep_type)
            metadata = self._metadata.get(key, {})
            dependencies.append(
                Dependency(from_resource, resource, dep_type, metadata)
            )
        return dependencies

    def traverse_downstream(
        self,
        resource: Resource,
        visited: Optional[Set[Resource]] = None
    ) -> Set[Resource]:
        """
        Traverse all downstream dependencies (forward traversal).
        Finds all resources directly or indirectly affected by changes to `resource`.
        """
        if visited is None:
            visited = set()

        if resource in visited:
            return visited

        visited.add(resource)

        if resource in self._graph:
            for to_resource, _ in self._graph[resource]:
                if to_resource not in visited:
                    self.traverse_downstream(to_resource, visited)

        return visited

    def traverse_upstream(
        self,
        resource: Resource,
        visited: Optional[Set[Resource]] = None
    ) -> Set[Resource]:
        """
        Traverse all upstream dependencies (reverse traversal).
        Finds all resources that must be ready/completed before `resource`.
        """
        if visited is None:
            visited = set()

        if resource in visited:
            return visited

        visited.add(resource)

        if resource in self._reverse_graph:
            for from_resource, _ in self._reverse_graph[resource]:
                if from_resource not in visited:
                    self.traverse_upstream(from_resource, visited)

        return visited

    def find_affected_resources(self, resource: Resource) -> Dict[str, Set[Resource]]:
        """
        Find all resources affected by changes to `resource` (forward and reverse cascading).

        Returns:
            Dict containing:
            - 'direct': directly connected target resources
            - 'cascading': indirect downstream resources
            - 'reverse_affected': resources depending on this resource
            - 'total': set of all affected resources excluding self
        """
        direct = set(to_res for to_res, _ in self._graph.get(resource, set()))
        downstream_all = self.traverse_downstream(resource) - {resource}
        cascading = downstream_all - direct

        reverse_deps = set(from_res for from_res, _ in self._reverse_graph.get(resource, set()))
        upstream_all = self.traverse_upstream(resource) - {resource}

        total = direct | cascading | reverse_deps | upstream_all

        return {
            "direct": direct,
            "cascading": cascading,
            "reverse_affected": reverse_deps,
            "total": total
        }

    def find_affected_surgeries(
        self,
        resource: Resource,
        db: Optional[Session] = None
    ) -> Set[Resource]:
        """
        Find all surgeries affected by changes or delays in `resource`.

        Args:
            resource: The resource experiencing a delay or state change.
            db: Optional DB session (unused for pure in-memory calculation)

        Returns:
            Set of Surgery resources affected.
        """
        if resource not in self._graph and resource not in self._reverse_graph:
            return set()

        if resource.resource_type == ResourceType.SURGERY:
            affected = self.find_affected_resources(resource)["total"] | {resource}
        else:
            upstream = self.traverse_upstream(resource)
            downstream = self.traverse_downstream(resource)
            affected = upstream | downstream

        surgeries = {
            res for res in affected
            if res.resource_type == ResourceType.SURGERY
        }
        return surgeries


    def _would_create_cycle(
        self,
        from_resource: Resource,
        to_resource: Resource
    ) -> bool:
        """
        Check if adding from_resource -> to_resource would create a cycle using BFS.
        Cycle occurs if to_resource can already reach from_resource.
        """
        visited = set()
        queue = [to_resource]

        while queue:
            current = queue.pop(0)
            if current in visited:
                continue

            visited.add(current)

            if current == from_resource:
                return True  # Cycle detected

            if current in self._graph:
                for next_res, _ in self._graph[current]:
                    if next_res not in visited:
                        queue.append(next_res)

        return False

    def validate_graph(self) -> Tuple[bool, List[str]]:
        """
        Validate graph integrity:
        - Check for self-loops
        - Check forward/reverse graph symmetry
        - Check for cycles
        """
        errors = []

        for resource, edges in self._graph.items():
            for to_resource, _ in edges:
                if resource == to_resource:
                    errors.append(f"Self-loop detected: {resource}")

        for from_res, edges in self._graph.items():
            for to_res, dep_type in edges:
                if to_res not in self._reverse_graph:
                    errors.append(
                        f"Forward edge {from_res} -> {to_res} missing in reverse graph"
                    )
                else:
                    reverse_edge = (from_res, dep_type)
                    if reverse_edge not in self._reverse_graph[to_res]:
                        errors.append(
                            f"Forward edge {from_res} -> {to_res} missing reverse mapping"
                        )

        for resource in self._graph.keys():
            visited = set()
            if self._can_reach(resource, resource, visited):
                errors.append(f"Cycle detected involving {resource}")

        return (len(errors) == 0, errors)

    def _can_reach(
        self,
        start: Resource,
        target: Resource,
        visited: Set[Resource]
    ) -> bool:
        """DFS check if start can reach target."""
        if start in visited or start not in self._graph:
            return False

        visited.add(start)

        for next_res, _ in self._graph[start]:
            if next_res == target or self._can_reach(next_res, target, visited):
                return True

        return False

    def size(self) -> Tuple[int, int]:
        """Return (number_of_distinct_nodes, number_of_edges)."""
        nodes = set(self._graph.keys()) | set(self._reverse_graph.keys())
        edges = sum(len(e) for e in self._graph.values())
        return (len(nodes), edges)

    def clear(self) -> None:
        """Clear all graph state."""
        self._graph.clear()
        self._reverse_graph.clear()
        self._metadata.clear()

    def to_dict(self) -> dict:
        """Serialize complete graph structure."""
        edges = []
        for from_res, edge_set in self._graph.items():
            for to_res, dep_type in edge_set:
                key = (from_res, to_res, dep_type)
                metadata = self._metadata.get(key, {})
                edges.append({
                    "from_resource": from_res.to_dict(),
                    "to_resource": to_res.to_dict(),
                    "dependency_type": dep_type.value,
                    "metadata": metadata
                })
        return {"edges": edges}

    def get_surgery_tree(self, surgery_resource: Resource) -> dict:
        """
        Build a tree representation for a given Surgery resource (e.g. S104).

        Structure:
        {
            "id": "S104",
            "type": "surgery",
            "dependencies": [
                { "type": "operating_theatre", "id": "OT-2", "dependency_type": "requires" },
                { "type": "surgeon", "id": "Surgeon-03", "dependency_type": "requires" },
                { "type": "anaesthesia_team", "id": "Anaesthesia-01", "dependency_type": "requires" },
                { "type": "instrument_set", "id": "LAP-SET-02", "dependency_type": "requires" },
                { "type": "recovery_bed", "id": "Recovery-04", "dependency_type": "requires" }
            ]
        }
        """
        deps = self.get_dependencies(surgery_resource)
        dep_list = []
        for dep in deps:
            dep_list.append({
                "type": dep.to_resource.resource_type.value,
                "id": str(dep.to_resource.resource_id),
                "dependency_type": dep.dependency_type.value,
                "metadata": dep.metadata
            })
        return {
            "id": str(surgery_resource.resource_id),
            "type": surgery_resource.resource_type.value,
            "dependencies": dep_list
        }


class DependencyGraphBuilder:
    """
    Builds DependencyGraph instances from existing SQLAlchemy database models.
    Reuses models: Surgery, Patient, OperatingTheatre, InstrumentPack, User, DependencyLink.
    """

    @staticmethod
    def build_from_database(db: Session) -> DependencyGraph:
        """
        Construct dependency graph from database state.
        """
        from ..models import (
            Surgery, Patient, OperatingTheatre, InstrumentPack, User, DependencyLink
        )

        graph = DependencyGraph()

        # Query all surgeries
        surgeries = db.query(Surgery).all()

        for surgery in surgeries:
            surg_id = surgery.id
            surg_code = f"S{surg_id}"
            surgery_res = Resource(ResourceType.SURGERY, surg_id)

            # Surgery -> Patient
            if surgery.patient_id:
                patient_res = Resource(ResourceType.PATIENT, surgery.patient_id)
                graph.add_dependency(
                    surgery_res,
                    patient_res,
                    DependencyType.REQUIRES,
                    {"reason": "surgery_needs_patient", "urgency": surgery.urgency_level}
                )

            # Surgery -> Operating Theatre
            if surgery.assigned_ot:
                ot_db = db.query(OperatingTheatre).filter(
                    OperatingTheatre.name == surgery.assigned_ot
                ).first()
                ot_id = ot_db.id if ot_db else surgery.assigned_ot
                ot_res = Resource(ResourceType.OPERATING_THEATRE, ot_id)
                graph.add_dependency(
                    surgery_res,
                    ot_res,
                    DependencyType.REQUIRES,
                    {"reason": "surgery_needs_ot", "ot_name": surgery.assigned_ot}
                )

            # Surgery -> Surgeon
            if surgery.surgeon:
                surgeon_db = db.query(User).filter(User.name == surgery.surgeon).first()
                surgeon_id = surgeon_db.id if surgeon_db else surgery.surgeon
                surgeon_res = Resource(ResourceType.SURGEON, surgeon_id)
                graph.add_dependency(
                    surgery_res,
                    surgeon_res,
                    DependencyType.REQUIRES,
                    {"reason": "surgery_needs_surgeon", "name": surgery.surgeon}
                )

            # Surgery -> Instrument Pack / Instrument Set
            packs = db.query(InstrumentPack).filter(
                InstrumentPack.assigned_surgery_id == surgery.id
            ).all()
            for pack in packs:
                pack_res = Resource(ResourceType.INSTRUMENT_SET, pack.id)
                pack_legacy_res = Resource(ResourceType.INSTRUMENT_PACK, pack.id)
                graph.add_dependency(
                    surgery_res,
                    pack_res,
                    DependencyType.REQUIRES,
                    {
                        "reason": "surgery_needs_pack",
                        "pack_type": pack.pack_type,
                        "status": pack.sterilization_status
                    }
                )
                graph.add_dependency(
                    surgery_res,
                    pack_legacy_res,
                    DependencyType.REQUIRES,
                    {
                        "reason": "surgery_needs_pack",
                        "pack_type": pack.pack_type,
                        "status": pack.sterilization_status
                    }
                )


            # Surgery -> Anaesthesia Team & Recovery Bed (Default or from DependencyLink)
            # Add default Anaesthesia Team and Recovery Bed links if present in database or conventions
            anaesthesia_res = Resource(ResourceType.ANAESTHESIA_TEAM, f"Anaesthesia-01")
            graph.add_dependency(
                surgery_res,
                anaesthesia_res,
                DependencyType.REQUIRES,
                {"reason": "surgery_needs_anaesthesia"}
            )

            recovery_res = Resource(ResourceType.RECOVERY_BED, f"Recovery-{surgery.id:02d}")
            graph.add_dependency(
                surgery_res,
                recovery_res,
                DependencyType.REQUIRES,
                {"reason": "surgery_needs_recovery_bed"}
            )

        # Custom DependencyLinks from database table
        links = db.query(DependencyLink).all()
        for link in links:
            try:
                from_res = Resource.from_tuple((link.from_resource_type, link.from_resource_id))
                to_res = Resource.from_tuple((link.to_resource_type, link.to_resource_id))
                dep_type = DependencyType(link.dependency_type)
                graph.add_dependency(
                    from_res,
                    to_res,
                    dep_type,
                    check_circular=True
                )
            except Exception as e:
                logger.warning(f"Skipping invalid DependencyLink {link.id}: {e}")

        return graph
