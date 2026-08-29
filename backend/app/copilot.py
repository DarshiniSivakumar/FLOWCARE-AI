import json
import logging
import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from .models import (
    OperatingTheatre, Surgery, Patient, WorkflowEvent,
    InstrumentPack, Prediction, Recommendation, Notification
)

logger = logging.getLogger(__name__)

# Structured Database Retrievers (Tools)

def get_ot_status(db: Session) -> List[Dict[str, Any]]:
    ots = db.query(OperatingTheatre).all()
    result = []
    for ot in ots:
        result.append({
            "id": ot.id,
            "name": ot.name,
            "status": ot.status,
            "current_surgery": ot.current_surgery,
            "utilization": ot.utilization,
            "available_from": ot.available_from.isoformat() if ot.available_from else None
        })
    return result

def get_delayed_surgeries(db: Session) -> List[Dict[str, Any]]:
    # A surgery is delayed if its status is 'DELAYED', OR if its latest prediction has high/critical risk.
    surgeries = db.query(Surgery).filter(Surgery.status != "COMPLETED").all()
    result = []
    for s in surgeries:
        # Get latest prediction
        latest_pred = db.query(Prediction).filter(Prediction.surgery_id == s.id).order_by(Prediction.created_at.desc()).first()
        pred_delay = latest_pred.predicted_delay_minutes if latest_pred else 0.0
        risk = latest_pred.risk_level if latest_pred else "LOW"
        
        is_delayed = s.status == "DELAYED" or risk in ["HIGH", "CRITICAL"]
        if is_delayed:
            patient = db.query(Patient).filter(Patient.id == s.patient_id).first()
            result.append({
                "surgery_id": s.id,
                "patient_name": patient.name if patient else "Unknown",
                "patient_code": patient.patient_code if patient else "Unknown",
                "surgery_type": s.surgery_type,
                "assigned_ot": s.assigned_ot,
                "status": s.status,
                "urgency_level": s.urgency_level,
                "predicted_delay_minutes": pred_delay,
                "risk_level": risk
            })
    return result

def get_patient_timeline(db: Session, patient_code: str) -> Dict[str, Any]:
    patient = db.query(Patient).filter(Patient.patient_code.ilike(patient_code.strip())).first()
    if not patient:
        return {"error": f"Patient with code {patient_code} not found."}
    
    events = db.query(WorkflowEvent).filter(WorkflowEvent.patient_id == patient.id).order_by(WorkflowEvent.timestamp.asc()).all()
    timeline = []
    for e in events:
        timeline.append({
            "event_type": e.event_type,
            "timestamp": e.timestamp.isoformat(),
            "source": e.source
        })
    
    # Get active surgery
    surgery = db.query(Surgery).filter(Surgery.patient_id == patient.id).first()
    
    return {
        "patient_id": patient.id,
        "patient_code": patient.patient_code,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "location": patient.current_location,
        "readiness_score": patient.readiness_score,
        "urgency_level": patient.urgency_level,
        "surgery_type": surgery.surgery_type if surgery else None,
        "timeline": timeline
    }

def get_cssd_status(db: Session) -> Dict[str, Any]:
    packs = db.query(InstrumentPack).all()
    
    status_counts = {}
    type_counts = {}
    shortages = []
    warnings = []
    
    for p in packs:
        status_counts[p.sterilization_status] = status_counts.get(p.sterilization_status, 0) + 1
        type_counts[p.pack_type] = type_counts.get(p.pack_type, 0) + 1
        
        # Check warnings (e.g. expiring soon, say within 2 days, or expired)
        if p.expiry_at and p.expiry_at < datetime.datetime.utcnow():
            warnings.append(f"Pack {p.id} ({p.pack_type}) has expired!")
            
    # Hardcoded or dynamic checks for shortages based on scheduled surgeries
    # Let's count upcoming surgeries and required packs
    surgeries = db.query(Surgery).filter(Surgery.status.in_(["SCHEDULED", "PREP"])).all()
    demand = {}
    for s in surgeries:
        pack_type = "Laparoscopic Set" if "laparoscopic" in s.surgery_type.lower() else "General Surgery Set"
        if "cardiac" in s.surgery_type.lower() or "bypass" in s.surgery_type.lower():
            pack_type = "Cardiac Set"
        elif "ortho" in s.surgery_type.lower() or "knee" in s.surgery_type.lower() or "hip" in s.surgery_type.lower():
            pack_type = "Orthopedic Set"
        demand[pack_type] = demand.get(pack_type, 0) + 1

    for pack_type, req_qty in demand.items():
        avail_qty = db.query(InstrumentPack).filter(
            InstrumentPack.pack_type.ilike(pack_type),
            InstrumentPack.sterilization_status == "STERILE",
            InstrumentPack.assigned_surgery_id == None
        ).count()
        if avail_qty < req_qty:
            shortages.append({
                "pack_type": pack_type,
                "required": req_qty,
                "available": avail_qty,
                "shortage": req_qty - avail_qty
            })
            
    return {
        "status_counts": status_counts,
        "type_counts": type_counts,
        "shortages": shortages,
        "warnings": warnings,
        "total_packs": len(packs)
    }

def get_bottlenecks(db: Session) -> List[Dict[str, Any]]:
    # Look for active alerts that denote bottlenecks
    alerts = db.query(Notification).filter(Notification.read_status == False).all()
    bottlenecks = []
    
    # Analyze active recommendations too
    recs = db.query(Recommendation).filter(Recommendation.status == "PENDING").all()
    
    for r in recs:
        bottlenecks.append({
            "surgery_id": r.surgery_id,
            "type": r.recommendation_type,
            "description": r.message,
            "priority": r.priority
        })
        
    return bottlenecks

def get_predictions(db: Session) -> List[Dict[str, Any]]:
    preds = db.query(Prediction).order_by(Prediction.created_at.desc()).limit(10).all()
    result = []
    for p in preds:
        surgery = db.query(Surgery).filter(Surgery.id == p.surgery_id).first()
        patient = db.query(Patient).filter(Patient.id == surgery.patient_id).first() if surgery else None
        result.append({
            "surgery_id": p.surgery_id,
            "surgery_type": surgery.surgery_type if surgery else "Unknown",
            "patient_code": patient.patient_code if patient else "Unknown",
            "predicted_delay_minutes": p.predicted_delay_minutes,
            "risk_level": p.risk_level,
            "confidence": p.confidence,
            "timestamp": p.created_at.isoformat()
        })
    return result

def get_recommendations(db: Session) -> List[Dict[str, Any]]:
    recs = db.query(Recommendation).filter(Recommendation.status == "PENDING").all()
    result = []
    for r in recs:
        surgery = db.query(Surgery).filter(Surgery.id == r.surgery_id).first()
        patient = db.query(Patient).filter(Patient.id == surgery.patient_id).first() if surgery else None
        result.append({
            "id": r.id,
            "surgery_id": r.surgery_id,
            "surgery_type": surgery.surgery_type if surgery else "Unknown",
            "patient_code": patient.patient_code if patient else "Unknown",
            "recommendation_type": r.recommendation_type,
            "message": r.message,
            "priority": r.priority,
            "created_at": r.created_at.isoformat()
        })
    return result

import datetime

# Copilot Intent Router and Natural Language Generator

def query_copilot(question: str, db: Session) -> Dict[str, Any]:
    """
    Parses the question intent, executes appropriate structured database tools,
    and returns a clean markdown-formatted answer.
    """
    q = question.lower()
    retrieved_data = {}
    answer = ""
    
    # 1. Match: "Which OT is currently delayed?" or "ot status"
    if "ot" in q and ("delay" in q or "status" in q or "occupied" in q or "available" in q):
        ots = get_ot_status(db)
        retrieved_data["ot_status"] = ots
        
        delayed_ots = [o for o in ots if o["status"] in ["DELAYED"] or (o["status"] == "CLEANING" and o["current_surgery"])]
        
        if not delayed_ots:
            answer = "All Operating Theatres are currently operating within normal schedules. Here is the active list:\n\n"
            for o in ots:
                answer += f"- **{o['name']}**: {o['status']} (Utilization: {o['utilization']}%)\n"
        else:
            answer = "Here is the status of the Operating Theatres experiencing delays or turnaround conflicts:\n\n"
            for o in delayed_ots:
                answer += f"- 🔴 **{o['name']}** is currently **{o['status']}** with a procedure of type `{o['current_surgery']}`. Utilization is at **{o['utilization']}%**.\n"
            
            answer += "\nOther Operating Theatres:\n"
            for o in ots:
                if o not in delayed_ots:
                    answer += f"- **{o['name']}**: {o['status']} (Utilization: {o['utilization']}%)\n"

    # 2. Match: "Why is OT-X delayed?" or "why is ot X delayed"
    elif "why" in q and "ot-" in q:
        match = re.search(r"ot-\d+", q)
        if match:
            ot_name = match.group(0).upper()
            ots = get_ot_status(db)
            ot = next((o for o in ots if o["name"].upper() == ot_name), None)
            
            if not ot:
                answer = f"Operating Theatre **{ot_name}** was not found in the system."
            else:
                retrieved_data["ot_name"] = ot_name
                # Find active surgery in this OT
                surgery = db.query(Surgery).filter(
                    Surgery.assigned_ot == ot_name,
                    Surgery.status != "COMPLETED"
                ).first()
                
                if not surgery:
                    answer = f"Operating Theatre **{ot_name}** does not have an active surgery assigned. Its current status is **{ot['status']}**."
                else:
                    patient = db.query(Patient).filter(Patient.id == surgery.patient_id).first()
                    latest_pred = db.query(Prediction).filter(Prediction.surgery_id == surgery.id).order_by(Prediction.created_at.desc()).first()
                    recs = db.query(Recommendation).filter(Recommendation.surgery_id == surgery.id, Recommendation.status == "PENDING").all()
                    
                    retrieved_data["surgery"] = {
                        "id": surgery.id,
                        "type": surgery.surgery_type,
                        "status": surgery.status,
                        "urgency": surgery.urgency_level
                    }
                    if patient:
                        retrieved_data["patient"] = {"code": patient.patient_code, "name": patient.name, "readiness": patient.readiness_score}
                    if latest_pred:
                        retrieved_data["prediction"] = {"delay": latest_pred.predicted_delay_minutes, "risk": latest_pred.risk_level}
                    
                    answer = f"### Operational Delay Analysis for **{ot_name}**\n\n"
                    answer += f"**Active Case**: S{surgery.id} ({surgery.surgery_type}) for patient **{patient.name if patient else 'N/A'}** ({patient.patient_code if patient else 'N/A'}).\n"
                    answer += f"- **Clinical Urgency**: `{surgery.urgency_level}`\n"
                    answer += f"- **Workflow Stage**: `{surgery.status}`\n"
                    
                    if latest_pred:
                        answer += f"- **ML Delay Prediction**: **{latest_pred.predicted_delay_minutes} minutes** additional delay (Risk Level: **{latest_pred.risk_level}**, Confidence: {latest_pred.confidence}%)\n"
                    
                    # Explaining bottleneck based on events
                    events = db.query(WorkflowEvent).filter(WorkflowEvent.surgery_id == surgery.id).all()
                    event_types = [e.event_type for e in events]
                    
                    answer += "\n**Root-Cause Insights**:\n"
                    if "ANAESTHESIA_READY" not in event_types:
                        answer += "- ⚠️ **Anaesthesia Incomplete**: The surgery is scheduled but anaesthesia ready checklist has not been completed.\n"
                    if "CSSD_PACK_READY" not in event_types:
                        answer += "- ⚠️ **CSSD sterile pack shortage**: Pack has not been dispatched/ready for this surgery type.\n"
                    
                    transfers = db.query(WorkflowEvent).filter(WorkflowEvent.surgery_id == surgery.id, WorkflowEvent.event_type == "TRANSFER_STARTED").first()
                    arrived = db.query(WorkflowEvent).filter(WorkflowEvent.surgery_id == surgery.id, WorkflowEvent.event_type == "PATIENT_ARRIVED_OT").first()
                    if transfers and not arrived:
                        elapsed = int((datetime.datetime.utcnow() - transfers.timestamp).total_seconds() / 60.0)
                        if elapsed > 10:
                            answer += f"- ⚠️ **Patient Transfer bottleneck**: Patient has been in transfer state for **{elapsed} minutes** (expected < 10 mins).\n"
                            
                    if recs:
                        answer += "\n**Actionable Recommendations**:\n"
                        for r in recs:
                            answer += f"- **[{r.priority}]**: {r.message}\n"
        else:
            answer = "Please specify which Operating Theatre you're asking about (e.g., 'Why is OT-02 delayed?')."

    # 3. Match: "Which surgeries are at risk?" or "risk" or "delayed surgeries"
    elif "risk" in q or "delay" in q or "at risk" in q:
        delayed = get_delayed_surgeries(db)
        retrieved_data["delayed_surgeries"] = delayed
        
        if not delayed:
            answer = "There are no surgeries currently flagged with a **HIGH** or **CRITICAL** risk of delay."
        else:
            answer = "The following surgeries have been flagged as **at risk of operational delay**:\n\n"
            # Sort by predicted delay descending to present highest risk first
            sorted_delayed = sorted(delayed, key=lambda x: x["predicted_delay_minutes"], reverse=True)
            for s in sorted_delayed:
                answer += f"- **Patient {s['patient_code']}** ({s['surgery_type']}): Status `{s['status']}` | Predicted Delay: **{s['predicted_delay_minutes']} min** (Risk: `{s['risk_level']}`)\n"

    # 4. Match: "What is causing the current bottleneck?" or "bottleneck" or "root cause"
    elif "bottleneck" in q or "root cause" in q:
        bottlenecks = get_bottlenecks(db)
        retrieved_data["bottlenecks"] = bottlenecks
        
        if not bottlenecks:
            answer = "No systemic bottlenecks are currently reported. Operational flows are running smoothly."
        else:
            answer = "### Active Hospital Bottlenecks & Recommendations\n\n"
            for b in bottlenecks:
                surgery = db.query(Surgery).filter(Surgery.id == b["surgery_id"]).first()
                patient = db.query(Patient).filter(Patient.id == surgery.patient_id).first() if surgery else None
                code = patient.patient_code if patient else f"Surgery {b['surgery_id']}"
                
                answer += f"#### ⚠️ Bottleneck: {b['type']} ({code})\n"
                answer += f"- **Description**: {b['description']}\n"
                answer += f"- **Priority Level**: **{b['priority']}**\n\n"

    # 5. Match: "What is the current CSSD status?" or "cssd" or "instrument packs"
    elif "cssd" in q or "instrument" in q or "pack" in q:
        cssd = get_cssd_status(db)
        retrieved_data["cssd_status"] = cssd
        
        answer = "### CSSD Instrument Pack Status\n\n"
        answer += f"- **Total Sterile/Tracked Packs**: {cssd['total_packs']}\n"
        answer += "- **Pack Status Breakdown**:\n"
        for status, count in cssd["status_counts"].items():
            answer += f"  - `{status}`: {count}\n"
            
        if cssd["shortages"]:
            answer += "\n⚠️ **Detected Shortages (Upcoming Surgeries)**:\n"
            for s in cssd["shortages"]:
                answer += f"- **{s['pack_type']}**: Required {s['required']} sets, but only {s['available']} available (Shortage of **{s['shortage']}** sets).\n"
        else:
            answer += "\n✅ No upcoming instrument shortages detected based on scheduled cases."
            
        if cssd["warnings"]:
            answer += "\n⚠️ **Expiry/Reprocessing Warnings**:\n"
            for w in cssd["warnings"]:
                answer += f"- {w}\n"

    # 6. Match: "Which patient requires immediate operational attention?" or "immediate attention" or "critical"
    elif "immediate" in q or "attention" in q or "critical" in q or "priority" in q:
        # Find critical alerts and surgeries
        delayed = get_delayed_surgeries(db)
        retrieved_data["delayed_surgeries"] = delayed
        
        critical_cases = [s for s in delayed if s["risk_level"] == "CRITICAL" or s["urgency_level"] == "CRITICAL"]
        
        if critical_cases:
            answer = "### 🚨 Critical Operational Priority Cases\n\n"
            answer += "The following patients require immediate clinical or scheduling interventions:\n\n"
            for s in critical_cases:
                answer += f"1. **Patient {s['patient_code']}** ({s['patient_name']})\n"
                answer += f"   - **Surgery**: {s['surgery_type']} in {s['assigned_ot'] or 'Unassigned OT'}\n"
                answer += f"   - **Predicted delay**: **{s['predicted_delay_minutes']} mins** (Confidence: {s['risk_level']})\n"
                answer += f"   - **Clinical Urgency**: `CRITICAL`\n\n"
        elif delayed:
            # Fallback to high risk cases
            high_cases = [s for s in delayed if s["risk_level"] == "HIGH"]
            if high_cases:
                answer = "### ⚠️ High Operational Priority Cases\n\n"
                for s in high_cases:
                    answer += f"- **Patient {s['patient_code']}** ({s['surgery_type']}): Predicted delay **{s['predicted_delay_minutes']} min** (Risk: `HIGH`)\n"
            else:
                answer = "No critical or high-risk delays are active. Operational flows are currently within acceptable limits."
        else:
            answer = "No patients currently require immediate operational escalation."

    # 7. Fallback response
    else:
        answer = "I am the FlowCare AI Operations Copilot. You can ask me questions about:\n\n"
        answer += "- **Operating Theatre status**: e.g., *'Which OT is currently delayed?'* or *'Why is OT-02 delayed?'*\n"
        answer += "- **Operational bottlenecks**: e.g., *'What is causing the current bottleneck?'*\n"
        answer += "- **CSSD packs & instrument demand**: e.g., *'What is the current CSSD status?'*\n"
        answer += "- **Risk prediction**: e.g., *'Which surgeries are at risk?'*\n"
        answer += "- **Escalations**: e.g., *'Which patient requires immediate operational attention?'*"
        
    return {
        "answer": answer,
        "retrieved_data": retrieved_data
    }
