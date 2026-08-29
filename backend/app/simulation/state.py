"""
FlowCare Hospital State & Simulation State Abstraction

Captures a complete snapshot of hospital operational state from database
and provides deep-copy cloning for isolated, in-memory What-If simulations.
Never mutates production tables.
"""

import copy
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models import Surgery, Patient, OperatingTheatre, InstrumentPack, User


@dataclass
class SurgeryState:
    id: int
    patient_id: int
    surgeon: str
    surgery_type: str
    assigned_ot: Optional[str]
    scheduled_start: datetime
    expected_duration: int  # minutes
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    status: str = "SCHEDULED"  # SCHEDULED, PREP, IN_OT, SURGERY, RECOVERY, COMPLETED, DELAYED
    urgency_level: str = "MEDIUM"
    delay_minutes: float = 0.0


@dataclass
class OTState:
    id: int
    name: str
    status: str = "AVAILABLE"  # AVAILABLE, PREPARING, SURGERY, CLEANING, DELAYED, UNAVAILABLE
    current_surgery: Optional[str] = None
    utilization: float = 0.0
    unavailable_until: Optional[datetime] = None


@dataclass
class PatientState:
    id: int
    patient_code: str
    name: str
    current_location: str = "Ward"  # Ward, Transfer, OT, Recovery, Discharged
    readiness_score: float = 0.0
    urgency_level: str = "MEDIUM"
    waiting_minutes: float = 0.0


@dataclass
class ResourceState:
    id: Union[int, str]
    name: str
    resource_type: str
    status: str = "AVAILABLE"
    assigned_surgery_id: Optional[int] = None


class HospitalState:
    """Snapshot of real production database state."""

    def __init__(self):
        self.surgeries: Dict[int, SurgeryState] = {}
        self.ots: Dict[str, OTState] = {}
        self.patients: Dict[int, PatientState] = {}
        self.resources: Dict[str, ResourceState] = {}
        self.recovery_capacity: int = 6
        self.recovery_occupied: int = 0

    @classmethod
    def capture_from_db(cls, db: Session) -> "HospitalState":
        """Extract current operational state from production database session."""
        state = cls()

        # Patients
        patients = db.query(Patient).all()
        for p in patients:
            state.patients[p.id] = PatientState(
                id=p.id,
                patient_code=p.patient_code,
                name=p.name,
                current_location=p.current_location,
                readiness_score=p.readiness_score,
                urgency_level=p.urgency_level,
            )

        # OTs
        ots = db.query(OperatingTheatre).all()
        for ot in ots:
            state.ots[ot.name] = OTState(
                id=ot.id,
                name=ot.name,
                status=ot.status,
                current_surgery=ot.current_surgery,
                utilization=ot.utilization,
            )

        # Surgeries
        surgeries = db.query(Surgery).all()
        for s in surgeries:
            state.surgeries[s.id] = SurgeryState(
                id=s.id,
                patient_id=s.patient_id,
                surgeon=s.surgeon,
                surgery_type=s.surgery_type,
                assigned_ot=s.assigned_ot,
                scheduled_start=s.scheduled_start,
                expected_duration=s.expected_duration,
                actual_start=s.actual_start,
                actual_end=s.actual_end,
                status=s.status,
                urgency_level=s.urgency_level,
            )

        # Instrument Packs as resources
        packs = db.query(InstrumentPack).all()
        for pack in packs:
            state.resources[f"PACK-{pack.id}"] = ResourceState(
                id=pack.id,
                name=pack.pack_type,
                resource_type="instrument_set",
                status=pack.sterilization_status,
                assigned_surgery_id=pack.assigned_surgery_id,
            )

        # Recovery count
        state.recovery_occupied = sum(
            1 for p in state.patients.values() if p.current_location == "Recovery"
        )
        return state

    def create_simulation_copy(self) -> "SimulationState":
        """Produce an isolated in-memory deep copy of state."""
        return SimulationState(
            surgeries=copy.deepcopy(self.surgeries),
            ots=copy.deepcopy(self.ots),
            patients=copy.deepcopy(self.patients),
            resources=copy.deepcopy(self.resources),
            recovery_capacity=self.recovery_capacity,
            recovery_occupied=self.recovery_occupied,
        )


class SimulationState:
    """Isolated in-memory simulation state. Never mutates production DB."""

    def __init__(
        self,
        surgeries: Dict[int, SurgeryState],
        ots: Dict[str, OTState],
        patients: Dict[int, PatientState],
        resources: Dict[str, ResourceState],
        recovery_capacity: int = 6,
        recovery_occupied: int = 0,
    ):
        self.surgeries = surgeries
        self.ots = ots
        self.patients = patients
        self.resources = resources
        self.recovery_capacity = recovery_capacity
        self.recovery_occupied = recovery_occupied
        self.current_sim_time: Optional[datetime] = None
