from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    email: str

class PatientBase(BaseModel):
    patient_code: str
    name: str
    age: int
    gender: str
    current_location: Optional[str] = "Ward"
    readiness_score: Optional[float] = 0.0
    urgency_level: Optional[str] = "MEDIUM"

class PatientCreate(PatientBase):
    pass

class PatientResponse(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class SurgeryBase(BaseModel):
    patient_id: int
    surgeon: str
    surgery_type: str
    assigned_ot: Optional[str] = None
    scheduled_start: datetime
    expected_duration: int
    urgency_level: Optional[str] = "MEDIUM"

class SurgeryCreate(SurgeryBase):
    pass

class SurgeryResponse(SurgeryBase):
    id: int
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    status: str
    patient: Optional[PatientResponse] = None

    class Config:
        from_attributes = True

class OperatingTheatreResponse(BaseModel):
    id: int
    name: str
    status: str
    current_surgery: Optional[str] = None
    utilization: float
    available_from: Optional[datetime] = None

    class Config:
        from_attributes = True

class WorkflowEventBase(BaseModel):
    patient_id: Optional[int] = None
    surgery_id: Optional[int] = None
    event_type: str
    source: Optional[str] = "SYSTEM"
    timestamp: Optional[datetime] = None
    event_metadata: Optional[str] = None

class WorkflowEventCreate(WorkflowEventBase):
    pass

class WorkflowEventResponse(WorkflowEventBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class InstrumentPackBase(BaseModel):
    pack_type: str
    sterilization_status: str
    sterilized_at: Optional[datetime] = None
    expiry_at: Optional[datetime] = None
    availability: Optional[bool] = True
    assigned_surgery_id: Optional[int] = None

class InstrumentPackCreate(InstrumentPackBase):
    pass

class InstrumentPackResponse(InstrumentPackBase):
    id: int

    class Config:
        from_attributes = True

class PatientTransferResponse(BaseModel):
    id: int
    patient_id: int
    from_location: str
    to_location: str
    start_time: datetime
    end_time: Optional[datetime] = None
    expected_duration: int
    actual_duration: Optional[int] = None
    delay_minutes: int

    class Config:
        from_attributes = True

class PredictionResponse(BaseModel):
    id: int
    surgery_id: int
    predicted_delay_minutes: float
    risk_level: str
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True

class RecommendationResponse(BaseModel):
    id: int
    surgery_id: int
    recommendation_type: str
    message: str
    priority: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class RecommendationUpdate(BaseModel):
    status: str # ACCEPTED, DISMISSED

class NotificationResponse(BaseModel):
    id: int
    recipient_role: str
    recipient_user_id: Optional[int] = None
    surgery_id: Optional[int] = None
    patient_id: Optional[int] = None
    severity: str
    title: str
    message: str
    read_status: bool
    created_at: datetime

    class Config:
        from_attributes = True

class CopilotRequest(BaseModel):
    question: str

class CopilotResponse(BaseModel):
    answer: str
    retrieved_data: Dict[str, Any]
