import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # ADMIN, OT_MANAGER, NURSE, CSSD_STAFF, DOCTOR
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    current_location = Column(String, default="Ward")  # Ward, OT, Recovery, etc.
    readiness_score = Column(Float, default=0.0)       # 0 - 100
    urgency_level = Column(String, default="MEDIUM")   # CRITICAL, HIGH, MEDIUM, LOW
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    admissions = relationship("Admission", back_populates="patient", cascade="all, delete-orphan")
    surgeries = relationship("Surgery", back_populates="patient", cascade="all, delete-orphan")
    transfers = relationship("PatientTransfer", back_populates="patient", cascade="all, delete-orphan")

class Admission(Base):
    __tablename__ = "admissions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    admission_time = Column(DateTime, default=datetime.datetime.utcnow)
    scheduled_surgery = Column(String, nullable=True)
    status = Column(String, default="ADMITTED")  # ADMITTED, DISCHARGED

    patient = relationship("Patient", back_populates="admissions")

class Surgery(Base):
    __tablename__ = "surgeries"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    surgeon = Column(String, nullable=False)
    surgery_type = Column(String, nullable=False)
    assigned_ot = Column(String, nullable=True)  # Name or ID of Operating Theatre
    scheduled_start = Column(DateTime, nullable=False)
    expected_duration = Column(Integer, nullable=False)  # in minutes
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    status = Column(String, default="SCHEDULED")  # SCHEDULED, PREP, READY, TRANSFER, IN_OT, SURGERY, CLEANING, RECOVERY, COMPLETED, DELAYED
    urgency_level = Column(String, default="MEDIUM") # CRITICAL, HIGH, MEDIUM, LOW

    patient = relationship("Patient", back_populates="surgeries")
    predictions = relationship("Prediction", back_populates="surgery", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="surgery", cascade="all, delete-orphan")

class OperatingTheatre(Base):
    __tablename__ = "operating_theatres"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="AVAILABLE")  # AVAILABLE, PREPARING, PATIENT_WAITING, PATIENT_IN_OT, ANAESTHESIA, SURGERY, CLEANING, DELAYED
    current_surgery = Column(String, nullable=True)
    utilization = Column(Float, default=0.0)       # 0.0 - 100.0
    available_from = Column(DateTime, nullable=True)

class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=True)
    surgery_id = Column(Integer, ForeignKey("surgeries.id", ondelete="CASCADE"), nullable=True)
    event_type = Column(String, nullable=False)  # PATIENT_ADMITTED, PATIENT_READY, etc.
    source = Column(String, default="SYSTEM")    # USER001, SYSTEM, NURSE_APP
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    event_metadata = Column(Text, nullable=True)       # JSON string containing extra info

class InstrumentPack(Base):
    __tablename__ = "instrument_packs"

    id = Column(Integer, primary_key=True, index=True)
    pack_type = Column(String, nullable=False)  # General, Laparoscopic, Orthopedic, etc.
    sterilization_status = Column(String, default="STERILE")  # REQUESTED, CLEANING, STERILIZING, STERILE, ISSUED, USED, REPROCESSING, EXPIRED, UNAVAILABLE
    sterilized_at = Column(DateTime, nullable=True)
    expiry_at = Column(DateTime, nullable=True)
    availability = Column(Boolean, default=True)
    assigned_surgery_id = Column(Integer, ForeignKey("surgeries.id", ondelete="SET NULL"), nullable=True)

class PatientTransfer(Base):
    __tablename__ = "patient_transfers"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    from_location = Column(String, nullable=False)
    to_location = Column(String, nullable=False)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    expected_duration = Column(Integer, default=10) # in minutes
    actual_duration = Column(Integer, nullable=True)
    delay_minutes = Column(Integer, default=0)

    patient = relationship("Patient", back_populates="transfers")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    surgery_id = Column(Integer, ForeignKey("surgeries.id", ondelete="CASCADE"), nullable=False)
    predicted_delay_minutes = Column(Float, default=0.0)
    risk_level = Column(String, default="LOW")     # LOW, MEDIUM, HIGH, CRITICAL
    confidence = Column(Float, default=100.0)       # percentage (0-100)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    surgery = relationship("Surgery", back_populates="predictions")

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    surgery_id = Column(Integer, ForeignKey("surgeries.id", ondelete="CASCADE"), nullable=False)
    recommendation_type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String, default="MEDIUM")      # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String, default="PENDING")      # PENDING, ACCEPTED, DISMISSED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    surgery = relationship("Surgery", back_populates="recommendations")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_role = Column(String, nullable=False)  # ADMIN, OT_MANAGER, NURSE, etc.
    recipient_user_id = Column(Integer, nullable=True)
    surgery_id = Column(Integer, nullable=True)
    patient_id = Column(Integer, nullable=True)
    severity = Column(String, default="INFO")       # INFO, WARNING, CRITICAL, RESOLVED
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    read_status = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class DependencyLink(Base):
    __tablename__ = "dependency_links"

    id = Column(Integer, primary_key=True, index=True)
    from_resource_type = Column(String, nullable=False)  # surgery, patient, operating_theatre, instrument_pack, user
    from_resource_id = Column(Integer, nullable=False)
    to_resource_type = Column(String, nullable=False)
    to_resource_id = Column(Integer, nullable=False)
    dependency_type = Column(String, nullable=False)  # must_complete_before, requires, blocks_if, shares_resource
    link_metadata = Column(Text, nullable=True)  # JSON string with additional context
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
