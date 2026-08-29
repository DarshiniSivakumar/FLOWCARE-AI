import datetime
import json
import logging
from sqlalchemy.orm import Session
from .models import (
    Patient, Surgery, OperatingTheatre, WorkflowEvent,
    InstrumentPack, PatientTransfer, Prediction, Recommendation, Notification
)
from .ml import predict_delay
from .websocket import manager

logger = logging.getLogger(__name__)

# Core Workflow Stages for Readiness calculation
# Patient Ready (20%), Consent (15%), Investigation (10%), Blood/Resource (10%),
# CSSD Pack (15%), OT Ready (10%), Anaesthesia (10%), Transfer (10%)

async def trigger_realtime_update(db: Session, update_type: str, data: dict):
    """
    Utility to broadcast changes to all active websocket clients
    """
    payload = {
        "type": update_type,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "data": data
    }
    await manager.broadcast(payload)

def get_events_for_surgery(db: Session, surgery_id: int):
    return db.query(WorkflowEvent).filter(WorkflowEvent.surgery_id == surgery_id).all()

def get_events_for_patient(db: Session, patient_id: int):
    return db.query(WorkflowEvent).filter(WorkflowEvent.patient_id == patient_id).all()

async def process_workflow_event(db: Session, event_type: str, patient_id: int, surgery_id: int, actor_id: str, metadata_dict: dict = None):
    """
    Processes workflow events and updates state, readiness, predictions, root cause, recommendations, and notifications.
    """
    # 1. Create and save the event
    metadata_str = json.dumps(metadata_dict) if metadata_dict else "{}"
    event = WorkflowEvent(
        patient_id=patient_id,
        surgery_id=surgery_id,
        event_type=event_type,
        source=actor_id,
        timestamp=datetime.datetime.utcnow(),
        event_metadata=metadata_str
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # 2. Find surgery and patient
    surgery = db.query(Surgery).filter(Surgery.id == surgery_id).first()
    patient = db.query(Patient).filter(Patient.id == patient_id).first()

    if not surgery or not patient:
        logger.warning(f"Workflow event processed without valid surgery or patient. Surgery: {surgery_id}, Patient: {patient_id}")
        return

    # 3. Update state machine based on event types
    # PATIENT_ADMITTED, PATIENT_PREP_STARTED, PATIENT_READY, CONSENT_PENDING, CONSENT_COMPLETED
    # CSSD_PACK_REQUESTED, CSSD_PACK_READY, CSSD_PACK_UNAVAILABLE
    # OT_ASSIGNED, OT_READY, ANAESTHESIA_PENDING, ANAESTHESIA_READY
    # TRANSFER_STARTED, TRANSFER_DELAYED, PATIENT_ARRIVED_OT
    # SURGERY_STARTED, SURGERY_COMPLETED, OT_CLEANING_STARTED, OT_READY_FOR_NEXT_CASE, PATIENT_ENTERED_RECOVERY
    
    # Update Patient location
    if event_type == "PATIENT_ADMITTED":
        patient.current_location = "Ward"
        surgery.status = "PREP"
    elif event_type == "TRANSFER_STARTED":
        patient.current_location = "Transfer"
        surgery.status = "TRANSFER"
        # Start patient transfer tracker
        transfer = PatientTransfer(
            patient_id=patient.id,
            from_location="Ward",
            to_location="OT Block",
            start_time=datetime.datetime.utcnow(),
            expected_duration=10
        )
        db.add(transfer)
    elif event_type == "PATIENT_ARRIVED_OT":
        patient.current_location = f"OT ({surgery.assigned_ot or 'Block'})"
        surgery.status = "IN_OT"
        # Close patient transfer tracker
        transfer = db.query(PatientTransfer).filter(
            PatientTransfer.patient_id == patient.id,
            PatientTransfer.end_time == None
        ).order_by(PatientTransfer.start_time.desc()).first()
        if transfer:
            transfer.end_time = datetime.datetime.utcnow()
            transfer.actual_duration = int((transfer.end_time - transfer.start_time).total_seconds() / 60.0)
            if transfer.actual_duration > transfer.expected_duration:
                transfer.delay_minutes = transfer.actual_duration - transfer.expected_duration
    elif event_type == "SURGERY_STARTED":
        patient.current_location = f"OT ({surgery.assigned_ot or 'Block'})"
        surgery.status = "SURGERY"
        surgery.actual_start = datetime.datetime.utcnow()
    elif event_type == "SURGERY_COMPLETED":
        patient.current_location = "OT Block (Turnaround)"
        surgery.status = "CLEANING"
        surgery.actual_end = datetime.datetime.utcnow()
    elif event_type == "PATIENT_ENTERED_RECOVERY":
        patient.current_location = "Recovery"
        surgery.status = "RECOVERY"
    elif event_type == "OT_READY_FOR_NEXT_CASE":
        surgery.status = "COMPLETED"

    # Update Operating Theatre Status
    if surgery.assigned_ot:
        ot = db.query(OperatingTheatre).filter(OperatingTheatre.name == surgery.assigned_ot).first()
        if ot:
            if event_type in ["OT_ASSIGNED", "OT_READY_FOR_NEXT_CASE"]:
                ot.status = "AVAILABLE"
                ot.current_surgery = None
            elif event_type == "PATIENT_ARRIVED_OT":
                ot.status = "PATIENT_WAITING"
                ot.current_surgery = surgery.surgery_type
            elif event_type == "ANAESTHESIA_READY":
                ot.status = "ANAESTHESIA"
            elif event_type == "SURGERY_STARTED":
                ot.status = "SURGERY"
                ot.current_surgery = surgery.surgery_type
            elif event_type == "SURGERY_COMPLETED":
                ot.status = "CLEANING"
            elif event_type == "OT_CLEANING_STARTED":
                ot.status = "CLEANING"

    db.commit()

    # 4. Calculate Surgical Readiness Score (0-100)
    score = calculate_readiness_score(db, patient.id, surgery.id)
    patient.readiness_score = score
    db.commit()

    # 5. Run Delay Detection & Prediction
    await run_intelligence_pipeline(db, surgery, patient)

    # 6. Trigger live web socket broadcast
    await trigger_realtime_update(db, "WORKFLOW_EVENT", {
        "event_id": event.id,
        "event_type": event.event_type,
        "patient_id": patient.id,
        "patient_code": patient.patient_code,
        "surgery_id": surgery.id,
        "readiness_score": score,
        "surgery_status": surgery.status
    })

def calculate_readiness_score(db: Session, patient_id: int, surgery_id: int) -> float:
    """
    Computes a score from 0-100 based on standard checklist criteria.
    - Patient Ready Checklist: 20%
    - Consent Completed: 15%
    - Pre-op Investigations (Vitals/Labs): 10%
    - Blood / Resource availability: 10%
    - CSSD pack sterile and assigned: 15%
    - OT ready: 10%
    - Anaesthesia ready: 10%
    - Transfer completed or ready: 10%
    """
    score = 0.0
    events = db.query(WorkflowEvent).filter(
        (WorkflowEvent.patient_id == patient_id) | (WorkflowEvent.surgery_id == surgery_id)
    ).all()
    event_types = {e.event_type for e in events}

    if "PATIENT_READY" in event_types:
        score += 20.0
    if "CONSENT_COMPLETED" in event_types:
        score += 15.0
    if "PATIENT_PREP_STARTED" in event_types: # Stands in for investigation/prep
        score += 10.0
    
    # Blood / resource check (Metadata-based or default to 10 if prep started)
    # Let's say if we have a custom blood ready flag or default check
    blood_ready = False
    for e in events:
      if e.event_type == "PATIENT_PREP_STARTED" and e.event_metadata:
        try:
          m = json.loads(e.event_metadata)
          if m.get("blood_reserved") or m.get("blood_ready"):
            blood_ready = True
        except:
          pass
    if blood_ready or "PATIENT_READY" in event_types:
        score += 10.0
    else:
        score += 5.0 # baseline credit for basic checks

    # CSSD pack ready
    # Check if we have CSSD_PACK_READY or an available pack
    surgery = db.query(Surgery).filter(Surgery.id == surgery_id).first()
    if "CSSD_PACK_READY" in event_types:
        score += 15.0
    else:
        # Check if there exists an instrument pack assigned to this surgery and sterile
        pack = db.query(InstrumentPack).filter(
            InstrumentPack.assigned_surgery_id == surgery_id,
            InstrumentPack.sterilization_status == "STERILE"
        ).first()
        if pack:
            score += 15.0

    # OT ready
    if "OT_READY" in event_types or "PATIENT_ARRIVED_OT" in event_types:
        score += 10.0
    elif surgery and surgery.assigned_ot:
        ot = db.query(OperatingTheatre).filter(OperatingTheatre.name == surgery.assigned_ot).first()
        if ot and ot.status == "AVAILABLE":
            score += 10.0

    # Anaesthesia ready
    if "ANAESTHESIA_READY" in event_types or "SURGERY_STARTED" in event_types:
        score += 10.0

    # Transfer completed/ready
    if "PATIENT_ARRIVED_OT" in event_types or "SURGERY_STARTED" in event_types:
        score += 10.0
    elif "TRANSFER_STARTED" in event_types:
        score += 5.0

    return min(100.0, score)

async def run_intelligence_pipeline(db: Session, surgery: Surgery, patient: Patient):
    """
    Core AI/ML prediction, bottleneck analysis, priority calculation, and alerts routing.
    """
    # Don't run intelligence for completed cases
    if surgery.status in ["COMPLETED", "RECOVERY", "DISCHARGED"]:
        return

    events = db.query(WorkflowEvent).filter(
        (WorkflowEvent.patient_id == patient.id) | (WorkflowEvent.surgery_id == surgery.id)
    ).all()
    event_types = {e.event_type for e in events}

    # Gather inputs for ML Model
    scheduled_hour = surgery.scheduled_start.hour
    expected_duration = surgery.expected_duration
    
    # OT Utilization calculation
    ot_utilization = 50.0
    if surgery.assigned_ot:
        ot = db.query(OperatingTheatre).filter(OperatingTheatre.name == surgery.assigned_ot).first()
        if ot:
            ot_utilization = ot.utilization

    anaesthesia_ready = ("ANAESTHESIA_READY" in event_types) or ("SURGERY_STARTED" in event_types)
    patient_ready_score = patient.readiness_score / 100.0
    
    # CSSD instrument pack ready
    cssd_ready = "CSSD_PACK_READY" in event_types
    if not cssd_ready:
        pack = db.query(InstrumentPack).filter(
            InstrumentPack.assigned_surgery_id == surgery.id,
            InstrumentPack.sterilization_status == "STERILE"
        ).first()
        if pack:
            cssd_ready = True

    # Transfer delays
    transfer_delay = 0.0
    transfer = db.query(PatientTransfer).filter(PatientTransfer.patient_id == patient.id).order_by(PatientTransfer.start_time.desc()).first()
    if transfer:
        if transfer.end_time:
            transfer_delay = float(transfer.delay_minutes)
        else:
            elapsed = (datetime.datetime.utcnow() - transfer.start_time).total_seconds() / 60.0
            if elapsed > transfer.expected_duration:
                transfer_delay = elapsed - transfer.expected_duration

    # Previous delays
    previous_workflow_delays = 0.0
    if "TRANSFER_DELAYED" in event_types:
        previous_workflow_delays += 15.0

    # Surgeon availability (assume true unless flagged in event metadata)
    surgeon_available = True
    for e in events:
        if e.event_metadata:
            try:
                m = json.loads(e.event_metadata)
                if m.get("surgeon_delayed") or m.get("surgeon_unavailable"):
                    surgeon_available = False
            except:
                pass

    # Call ML Prediction Model
    try:
        prediction_result = predict_delay(
            surgery_type=surgery.surgery_type,
            scheduled_hour=scheduled_hour,
            expected_duration=expected_duration,
            ot_utilization=ot_utilization,
            anaesthesia_ready=anaesthesia_ready,
            patient_ready_score=patient_ready_score,
            cssd_ready=cssd_ready,
            transfer_delay=transfer_delay,
            previous_workflow_delays=previous_workflow_delays,
            surgeon_available=surgeon_available
        )
    except Exception as e:
        logger.error(f"Error in ML model delay prediction: {e}")
        prediction_result = {
            "predicted_delay_minutes": 10.0,
            "risk_level": "LOW",
            "confidence": 90.0
        }

    # Save Prediction to DB
    pred = Prediction(
        surgery_id=surgery.id,
        predicted_delay_minutes=prediction_result["predicted_delay_minutes"],
        risk_level=prediction_result["risk_level"],
        confidence=prediction_result["confidence"]
    )
    db.add(pred)
    db.commit()

    # Rule-Based Bottleneck detection & Root Cause Engine
    primary_bottleneck = "None"
    root_cause = "No delay detected."
    is_delayed = False
    
    # We define surgery as delayed if scheduled start is in the past and actual start is null,
    # or if we have critical incomplete dependencies and scheduled start is within 30 minutes.
    time_to_surgery = (surgery.scheduled_start - datetime.datetime.utcnow()).total_seconds() / 60.0

    if time_to_surgery <= 30 and not surgery.actual_start:
        is_delayed = True
        if not patient_ready_score or patient.readiness_score < 50:
            primary_bottleneck = "Patient Readiness"
            root_cause = "Patient is not clinically prepared (Pre-op check incomplete)."
        elif "CONSENT_COMPLETED" not in event_types:
            primary_bottleneck = "Patient Consent"
            root_cause = "Surgical consent forms have not been signed."
        elif not cssd_ready:
            primary_bottleneck = "CSSD Sterile Instruments"
            root_cause = "Required surgical instrument pack is sterilizing or unavailable."
        elif not surgeon_available:
            primary_bottleneck = "Surgeon Availability"
            root_cause = "Assigned primary surgeon is delayed in another procedure."
        elif transfer_delay > 0:
            primary_bottleneck = "Patient Transfer"
            root_cause = f"Patient transfer from Ward is delayed by {int(transfer_delay)} minutes."
        elif not anaesthesia_ready:
            primary_bottleneck = "Anaesthesia Readiness"
            root_cause = "Anaesthesia administration is pending or delayed."
        elif surgery.assigned_ot:
            ot = db.query(OperatingTheatre).filter(OperatingTheatre.name == surgery.assigned_ot).first()
            if ot and ot.status == "CLEANING":
                primary_bottleneck = "OT Turnaround"
                root_cause = f"Theatre {ot.name} is currently undergoing cleaning/sanitation."
            elif ot and ot.status in ["SURGERY", "PATIENT_IN_OT"]:
                primary_bottleneck = "OT Resource Conflict"
                root_cause = f"Theatre {ot.name} is still occupied by the previous procedure."

    # Priority Calculation (Priority Engine)
    # clinical urgency level, delay duration, predicted additional delay
    # Generate CRITICAL, HIGH, MEDIUM, LOW
    priority_level = "LOW"
    clinical_urgency = surgery.urgency_level or "MEDIUM"
    predicted_delay = prediction_result["predicted_delay_minutes"]

    if clinical_urgency == "CRITICAL" and (predicted_delay > 15 or is_delayed):
        priority_level = "CRITICAL"
    elif (clinical_urgency in ["CRITICAL", "HIGH"]) and (predicted_delay > 25 or is_delayed):
        priority_level = "HIGH"
    elif clinical_urgency == "MEDIUM" and predicted_delay > 35:
        priority_level = "MEDIUM"
    elif predicted_delay > 45:
        priority_level = "MEDIUM"
    else:
        priority_level = "LOW"

    # Save Recommendation & Alerts (Recommendation Engine)
    recommendation_msg = None
    rec_type = None
    alert_title = None
    alert_msg = None
    recipient_role = "OT_MANAGER"

    if primary_bottleneck == "Anaesthesia Readiness":
        rec_type = "REASSIGN_OT"
        # Find available OTs to reassign
        available_ots = db.query(OperatingTheatre).filter(OperatingTheatre.status == "AVAILABLE").all()
        ot_names = [o.name for o in available_ots]
        if ot_names:
            recommendation_msg = f"Anaesthesia delay detected. Consider reassigning patient {patient.patient_code} to available {ot_names[0]} to prevent schedule disruption."
        else:
            recommendation_msg = "Anaesthesia delay detected. Suggest escalating to senior anaesthesiologist on call."
        alert_title = "Anaesthesia Delay Warning"
        alert_msg = f"Patient {patient.patient_code} scheduled for surgery in {int(time_to_surgery)} min but anaesthesia is pending."
        recipient_role = "OT_MANAGER"

    elif primary_bottleneck == "CSSD Sterile Instruments":
        rec_type = "STERILIZE_PACK"
        recommendation_msg = "CSSD shortage detected. Initiate immediate autoclave cycle for the required instrument pack and adjust expected surgery start time by 30 mins."
        alert_title = "CSSD Instrument Shortage"
        alert_msg = f"Instrument pack for surgery S{surgery.id} ({surgery.surgery_type}) is unavailable."
        recipient_role = "CSSD_STAFF"

    elif primary_bottleneck == "Patient Transfer":
        rec_type = "ASSIGN_TRANSPORT"
        recommendation_msg = "Transfer delay detected. Re-route the next available orderly team to Ward A to expedite patient transport."
        alert_title = "Patient Transfer Bottleneck"
        alert_msg = f"Patient {patient.patient_code} transfer duration exceeds normal limits (elapsed > 10 min)."
        recipient_role = "NURSE"

    elif primary_bottleneck == "OT Resource Conflict":
        rec_type = "REASSIGN_OT"
        available_ots = db.query(OperatingTheatre).filter(OperatingTheatre.status == "AVAILABLE").all()
        ot_names = [o.name for o in available_ots]
        if ot_names:
            recommendation_msg = f"{surgery.assigned_ot} is currently occupied by a previous case. Consider reassigning to available {ot_names[0]}."
        else:
            recommendation_msg = f"{surgery.assigned_ot} conflict detected. Re-prioritize cases or delay scheduled start of routine cases."
        alert_title = "Operating Theatre Resource Conflict"
        alert_msg = f"Theatre {surgery.assigned_ot} is occupied. Scheduled surgery for {patient.patient_code} will be delayed."
        recipient_role = "OT_MANAGER"

    elif is_delayed and primary_bottleneck == "Patient Readiness":
        rec_type = "PATIENT_PREP"
        recommendation_msg = "Patient readiness checklist incomplete. Send pre-op nursing coordinator to verify labs and consent forms immediately."
        alert_title = "Patient Preparation Pending"
        alert_msg = f"Patient {patient.patient_code} has readiness score of only {int(patient.readiness_score)}% near scheduled surgery time."
        recipient_role = "NURSE"

    # Write Recommendation to DB
    if recommendation_msg:
        # Check if recommendation already exists to avoid duplication
        exists = db.query(Recommendation).filter(
            Recommendation.surgery_id == surgery.id,
            Recommendation.message == recommendation_msg,
            Recommendation.status == "PENDING"
        ).first()
        if not exists:
            rec = Recommendation(
                surgery_id=surgery.id,
                recommendation_type=rec_type,
                message=recommendation_msg,
                priority=priority_level,
                status="PENDING"
            )
            db.add(rec)
            db.commit()

    # Write Notification to DB
    if alert_title:
        # Check if notification exists
        exists_alert = db.query(Notification).filter(
            Notification.surgery_id == surgery.id,
            Notification.title == alert_title,
            Notification.read_status == False
        ).first()
        if not exists_alert:
            notif = Notification(
                recipient_role=recipient_role,
                surgery_id=surgery.id,
                patient_id=patient.id,
                severity="CRITICAL" if priority_level == "CRITICAL" else "WARNING",
                title=alert_title,
                message=alert_msg,
                read_status=False
            )
            db.add(notif)
            db.commit()

            # Escalation Logic: If critical and unread, generate a high-level admin/manager alert
            if priority_level == "CRITICAL":
                admin_notif = Notification(
                    recipient_role="ADMIN",
                    surgery_id=surgery.id,
                    patient_id=patient.id,
                    severity="CRITICAL",
                    title="ESCALATED: Critical Surgery Delay",
                    message=f"Escalated: {alert_title} for {patient.name} ({patient.patient_code}). Immediate attention required. Bottleneck: {primary_bottleneck}",
                    read_status=False
                )
                db.add(admin_notif)
                db.commit()

    # Trigger Live Updates
    await trigger_realtime_update(db, "INTELLIGENCE_UPDATE", {
        "surgery_id": surgery.id,
        "predicted_delay": prediction_result["predicted_delay_minutes"],
        "risk_level": prediction_result["risk_level"],
        "confidence": prediction_result["confidence"],
        "primary_bottleneck": primary_bottleneck,
        "root_cause": root_cause,
        "priority_level": priority_level
    })
