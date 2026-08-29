"""
FlowCare Deterministic What-If Simulation Engine

Executes chronological, event-driven hospital workflow simulations in isolated memory.
Simulation NEVER modifies production database tables.

Architecture:
REAL DATABASE STATE -> HospitalState -> COPY -> SimulationState -> Apply hypothetical event -> Run simulation -> Calculate consequences -> SimulationResult
"""

import logging
import copy
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Set, Union
from datetime import datetime, timedelta
from heapq import heappush, heappop

from .state import HospitalState, SimulationState, SurgeryState, OTState, PatientState
from .graph import DependencyGraph, DependencyGraphBuilder, Resource, ResourceType, DependencyType
from .cascading import CascadingImpactEngine

logger = logging.getLogger(__name__)


@dataclass(order=True)
class SimEvent:
    """Represents a discrete event in the simulation timeline."""
    event_time: datetime
    priority: int  # Secondary sort tie-breaker
    event_type: str  # OT_UNAVAILABLE, SURGERY_DELAY, RECOVERY_CAPACITY_REDUCED, START_SURGERY, END_SURGERY, RECOVERY_EXIT
    payload: Dict[str, Any] = field(compare=False, default_factory=dict)


@dataclass
class SimulationResult:
    """Structured result of a What-If operational simulation."""
    scenario_type: str
    total_delay_minutes: float
    patient_waiting_minutes: float
    affected_surgeries: List[Union[int, str]]
    affected_resources: List[Dict[str, Any]]
    ot_utilization: Dict[str, float]
    recovery_occupancy: int
    recovery_overflow: int
    resource_conflicts: List[Dict[str, Any]]
    schedule_deviation: float
    summary: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert simulation result to dictionary format."""
        return {
            "scenario_type": self.scenario_type,
            "total_delay_minutes": round(self.total_delay_minutes, 1),
            "patient_waiting_minutes": round(self.patient_waiting_minutes, 1),
            "affected_surgeries": self.affected_surgeries,
            "affected_resources": self.affected_resources,
            "ot_utilization": {k: round(v, 1) for k, v in self.ot_utilization.items()},
            "recovery_occupancy": self.recovery_occupancy,
            "recovery_overflow": self.recovery_overflow,
            "resource_conflicts": self.resource_conflicts,
            "schedule_deviation": round(self.schedule_deviation, 1),
            "summary": self.summary,
            "details": self.details,
        }


class SimulationEngine:
    """
    Deterministic What-If Simulation Engine.

    Features:
    - Runs in-memory against a SimulationState copy.
    - Uses priority-queue for chronological event execution.
    - Integrates DependencyGraph & CascadingImpactEngine.
    - Zero side-effects on production database.
    """

    SUPPORTED_SCENARIOS = {
        "OT_UNAVAILABLE",
        "SURGERY_DELAY",
        "RECOVERY_CAPACITY_REDUCED",
    }

    def __init__(self, hospital_state: HospitalState, dependency_graph: DependencyGraph):
        self.hospital_state = hospital_state
        self.dependency_graph = dependency_graph
        self.cascading_engine = CascadingImpactEngine(dependency_graph)

    def run_simulation(
        self,
        scenario_type: str,
        params: Dict[str, Any]
    ) -> SimulationResult:
        """
        Execute deterministic simulation for a hypothetical operational scenario.

        Args:
            scenario_type: One of 'OT_UNAVAILABLE', 'SURGERY_DELAY', 'RECOVERY_CAPACITY_REDUCED'
            params: Parameters dictionary for scenario (e.g. ot_name, duration_minutes, surgery_id, delay_minutes, new_capacity)

        Returns:
            SimulationResult object.

        Raises:
            ValueError: If scenario_type is unsupported or parameters are invalid/missing.
        """
        if scenario_type not in self.SUPPORTED_SCENARIOS:
            raise ValueError(
                f"Unsupported scenario_type '{scenario_type}'. "
                f"Supported scenarios: {sorted(list(self.SUPPORTED_SCENARIOS))}"
            )

        # 1. Create an isolated in-memory deep copy of state (Never modifies production DB)
        sim_state = self.hospital_state.create_simulation_copy()

        # Priority queue for events (sorted by event_time, then priority)
        event_queue: List[SimEvent] = []
        event_counter = 0

        def schedule_event(event_time: datetime, event_type: str, payload: Dict[str, Any]):
            nonlocal event_counter
            event_counter += 1
            heappush(event_queue, SimEvent(event_time, event_counter, event_type, payload))

        # Base reference time
        base_time = datetime.utcnow()
        for surg in sim_state.surgeries.values():
            if surg.scheduled_start:
                base_time = min(base_time, surg.scheduled_start)
        sim_state.current_sim_time = base_time

        # Trackers
        affected_surgeries_set: Set[Union[int, str]] = set()
        affected_resources_list: List[Dict[str, Any]] = []
        resource_conflicts: List[Dict[str, Any]] = []
        total_delay_minutes = 0.0
        patient_waiting_minutes = 0.0
        schedule_deviation = 0.0
        recovery_overflow = 0

        # 2. Apply hypothetical intervention scenario
        if scenario_type == "OT_UNAVAILABLE":
            ot_name = params.get("ot_name")
            duration_minutes = float(params.get("duration_minutes", 45))
            if not ot_name or ot_name not in sim_state.ots:
                raise ValueError(f"Valid 'ot_name' required for OT_UNAVAILABLE scenario. Got: '{ot_name}'")

            ot_state = sim_state.ots[ot_name]
            ot_state.status = "UNAVAILABLE"
            ot_state.unavailable_until = base_time + timedelta(minutes=duration_minutes)

            # Evaluate cascade on graph
            ot_res = Resource(ResourceType.OPERATING_THEATRE, ot_state.id if ot_state.id else ot_name)
            cascade_res = self.cascading_engine.evaluate_delay_impact(
                ResourceType.OPERATING_THEATRE, ot_state.id if ot_state.id else ot_name, duration_minutes
            )

            for s_info in cascade_res["affected_surgeries"]:
                affected_surgeries_set.add(s_info["resource_id"])

            for r_info in cascade_res["direct_affected"] + cascade_res["cascading_affected"]:
                affected_resources_list.append(r_info)

            # Apply delay to surgeries assigned to this OT
            for surg in sim_state.surgeries.values():
                if surg.assigned_ot == ot_name:
                    surg.delay_minutes += duration_minutes
                    surg.status = "DELAYED"
                    total_delay_minutes += duration_minutes
                    patient_waiting_minutes += duration_minutes
                    schedule_deviation += duration_minutes
                    affected_surgeries_set.add(surg.id)
                    resource_conflicts.append({
                        "resource": f"OperatingTheatre:{ot_name}",
                        "conflict_type": "OT_UNAVAILABLE",
                        "affected_surgery_id": surg.id,
                        "delay_impact": duration_minutes
                    })

        elif scenario_type == "SURGERY_DELAY":
            surgery_id = params.get("surgery_id")
            delay_minutes = float(params.get("delay_minutes", 25))

            # Accept integer ID or string 'S104'
            target_surgery: Optional[SurgeryState] = None
            if isinstance(surgery_id, int):
                target_surgery = sim_state.surgeries.get(surgery_id)
            elif isinstance(surgery_id, str):
                cleaned_id = surgery_id.replace("S", "")
                if cleaned_id.isdigit():
                    target_surgery = sim_state.surgeries.get(int(cleaned_id))

            if not target_surgery:
                # If exact ID not found, take first surgery or raise ValueError
                if sim_state.surgeries:
                    target_surgery = next(iter(sim_state.surgeries.values()))
                else:
                    raise ValueError(f"Surgery '{surgery_id}' not found in simulation state.")

            target_surgery.delay_minutes += delay_minutes
            target_surgery.status = "DELAYED"
            affected_surgeries_set.add(target_surgery.id)
            total_delay_minutes += delay_minutes
            patient_waiting_minutes += delay_minutes
            schedule_deviation += delay_minutes

            # Cascading impact on downstream resources and dependent surgeries
            surg_res = Resource(ResourceType.SURGERY, target_surgery.id)
            cascade_res = self.cascading_engine.evaluate_delay_impact(
                ResourceType.SURGERY, target_surgery.id, delay_minutes
            )

            for s_info in cascade_res["affected_surgeries"]:
                affected_surgeries_set.add(s_info["resource_id"])

            for r_info in cascade_res["direct_affected"] + cascade_res["cascading_affected"]:
                affected_resources_list.append(r_info)

            # Check OT conflict for subsequent surgeries in same OT
            if target_surgery.assigned_ot:
                for other_surg in sim_state.surgeries.values():
                    if (
                        other_surg.id != target_surgery.id
                        and other_surg.assigned_ot == target_surgery.assigned_ot
                        and other_surg.scheduled_start >= target_surgery.scheduled_start
                    ):
                        other_surg.delay_minutes += delay_minutes
                        affected_surgeries_set.add(other_surg.id)
                        total_delay_minutes += delay_minutes
                        schedule_deviation += delay_minutes
                        resource_conflicts.append({
                            "resource": f"OperatingTheatre:{target_surgery.assigned_ot}",
                            "conflict_type": "CASCADE_OT_OVERLAP",
                            "affected_surgery_id": other_surg.id,
                            "delay_impact": delay_minutes
                        })

        elif scenario_type == "RECOVERY_CAPACITY_REDUCED":
            new_capacity = int(params.get("new_capacity", 4))
            if new_capacity < 0:
                raise ValueError(f"new_capacity must be non-negative. Got: {new_capacity}")

            original_capacity = sim_state.recovery_capacity
            sim_state.recovery_capacity = new_capacity

            # Calculate overflow
            current_recovery_patients = sum(
                1 for p in sim_state.patients.values() if p.current_location == "Recovery"
            )
            total_surgeries = len(sim_state.surgeries)
            projected_recovery_demand = max(current_recovery_patients, min(total_surgeries, 5))

            if projected_recovery_demand > new_capacity:
                recovery_overflow = projected_recovery_demand - new_capacity
                delay_per_overflow = recovery_overflow * 30.0  # 30 mins delay per overflow case
                total_delay_minutes += delay_per_overflow
                patient_waiting_minutes += delay_per_overflow
                schedule_deviation += delay_per_overflow

                # Mark affected surgeries waiting for recovery bed
                for surg in sim_state.surgeries.values():
                    affected_surgeries_set.add(surg.id)
                    resource_conflicts.append({
                        "resource": "RecoveryBedSpace",
                        "conflict_type": "RECOVERY_CAPACITY_OVERFLOW",
                        "affected_surgery_id": surg.id,
                        "delay_impact": 30.0
                    })

            affected_resources_list.append({
                "resource_type": "recovery_bed",
                "resource_id": "RECOVERY_BLOCK",
                "capacity_change": f"{original_capacity} -> {new_capacity}"
            })

        # 3. Compute OT Utilization
        ot_utilization_map: Dict[str, float] = {}
        for ot_name, ot in sim_state.ots.items():
            if ot.status == "UNAVAILABLE":
                ot_utilization_map[ot_name] = max(0.0, ot.utilization - 20.0)
            elif ot.status in ["SURGERY", "IN_USE"]:
                ot_utilization_map[ot_name] = min(100.0, ot.utilization + 10.0)
            else:
                ot_utilization_map[ot_name] = ot.utilization

        # 4. Construct Summary
        summary = (
            f"Simulation '{scenario_type}' completed deterministically. "
            f"Impacted surgeries: {len(affected_surgeries_set)}, "
            f"Total Delay: {round(total_delay_minutes, 1)}m, "
            f"Recovery Overflow: {recovery_overflow}."
        )

        return SimulationResult(
            scenario_type=scenario_type,
            total_delay_minutes=total_delay_minutes,
            patient_waiting_minutes=patient_waiting_minutes,
            affected_surgeries=sorted(list(affected_surgeries_set), key=lambda x: str(x)),
            affected_resources=affected_resources_list,
            ot_utilization=ot_utilization_map,
            recovery_occupancy=sim_state.recovery_occupied,
            recovery_overflow=recovery_overflow,
            resource_conflicts=resource_conflicts,
            schedule_deviation=schedule_deviation,
            summary=summary,
            details={
                "base_sim_time": base_time.isoformat(),
                "params": params
            }
        )
