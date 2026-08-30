import json
import logging
import os
import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .models import (
    OperatingTheatre, Surgery, Patient, WorkflowEvent,
    InstrumentPack, Prediction, Recommendation, Notification
)

load_dotenv()
logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ---------------------------------------------------------------------------
# Live Database Collectors — gather real-time hospital state as context
# ---------------------------------------------------------------------------

def _get_ot_status(db: Session) -> List[Dict[str, Any]]:
    ots = db.query(OperatingTheatre).all()
    return [
        {
            "name": ot.name,
            "status": ot.status,
            "current_surgery": ot.current_surgery,
            "utilization_pct": ot.utilization,
        }
        for ot in ots
    ]


def _get_active_surgeries(db: Session) -> List[Dict[str, Any]]:
    surgeries = db.query(Surgery).filter(Surgery.status != "COMPLETED").all()
    result = []
    for s in surgeries:
        patient = db.query(Patient).filter(Patient.id == s.patient_id).first()
        latest_pred = (
            db.query(Prediction)
            .filter(Prediction.surgery_id == s.id)
            .order_by(Prediction.created_at.desc())
            .first()
        )
        result.append({
            "surgery_id": s.id,
            "surgery_type": s.surgery_type,
            "assigned_ot": s.assigned_ot,
            "status": s.status,
            "urgency": s.urgency_level,
            "surgeon": s.surgeon,
            "patient_name": patient.name if patient else "Unknown",
            "patient_code": patient.patient_code if patient else "Unknown",
            "patient_location": patient.current_location if patient else "Unknown",
            "readiness_score": patient.readiness_score if patient else None,
            "predicted_delay_minutes": latest_pred.predicted_delay_minutes if latest_pred else 0,
            "risk_level": latest_pred.risk_level if latest_pred else "LOW",
        })
    return result


def _get_cssd_status(db: Session) -> Dict[str, Any]:
    packs = db.query(InstrumentPack).all()
    status_counts: Dict[str, int] = {}
    expired_packs = []
    for p in packs:
        status_counts[p.sterilization_status] = status_counts.get(p.sterilization_status, 0) + 1
        if p.expiry_at and p.expiry_at < datetime.datetime.utcnow():
            expired_packs.append(f"{p.pack_type} (ID:{p.id})")
    return {
        "total_packs": len(packs),
        "status_breakdown": status_counts,
        "expired_packs": expired_packs,
    }


def _get_recommendations(db: Session) -> List[Dict[str, Any]]:
    recs = db.query(Recommendation).filter(Recommendation.status == "PENDING").all()
    result = []
    for r in recs:
        surgery = db.query(Surgery).filter(Surgery.id == r.surgery_id).first()
        patient = db.query(Patient).filter(Patient.id == surgery.patient_id).first() if surgery else None
        result.append({
            "type": r.recommendation_type,
            "message": r.message,
            "priority": r.priority,
            "surgery_type": surgery.surgery_type if surgery else "Unknown",
            "patient_code": patient.patient_code if patient else "Unknown",
        })
    return result


def _get_active_alerts(db: Session) -> List[Dict[str, Any]]:
    alerts = db.query(Notification).filter(Notification.read_status == False).all()
    return [
        {
            "title": a.title,
            "message": a.message,
            "severity": a.severity,
        }
        for a in alerts
    ]


def _get_recent_events(db: Session) -> List[Dict[str, Any]]:
    events = (
        db.query(WorkflowEvent)
        .order_by(WorkflowEvent.timestamp.desc())
        .limit(15)
        .all()
    )
    result = []
    for e in events:
        patient = db.query(Patient).filter(Patient.id == e.patient_id).first()
        result.append({
            "event_type": e.event_type,
            "patient_code": patient.patient_code if patient else "Unknown",
            "source": e.source,
            "timestamp": e.timestamp.isoformat(),
        })
    return result


def _build_hospital_context(db: Session) -> str:
    """Collect live hospital state from DB and format as a structured context block for the LLM."""
    ots = _get_ot_status(db)
    surgeries = _get_active_surgeries(db)
    cssd = _get_cssd_status(db)
    recs = _get_recommendations(db)
    alerts = _get_active_alerts(db)
    events = _get_recent_events(db)

    context = "=== LIVE FLOWCARE HOSPITAL DIGITAL TWIN STATE ===\n\n"

    context += "## Operating Theatres\n"
    for ot in ots:
        context += (
            f"- {ot['name']}: status={ot['status']}, "
            f"utilization={ot['utilization_pct']}%, "
            f"current_procedure={ot['current_surgery'] or 'None'}\n"
        )

    context += "\n## Active Surgeries\n"
    if not surgeries:
        context += "No active surgeries.\n"
    for s in surgeries:
        context += (
            f"- Surgery #{s['surgery_id']} | {s['surgery_type']} | "
            f"Patient: {s['patient_name']} ({s['patient_code']}) | "
            f"OT: {s['assigned_ot'] or 'Unassigned'} | Status: {s['status']} | "
            f"Urgency: {s['urgency']} | Location: {s['patient_location']} | "
            f"Readiness: {s['readiness_score']}% | "
            f"Risk: {s['risk_level']} | Predicted delay: {s['predicted_delay_minutes']} min\n"
        )

    context += "\n## CSSD Instrument Pack Status\n"
    context += f"Total packs tracked: {cssd['total_packs']}\n"
    for status, count in cssd['status_breakdown'].items():
        context += f"  - {status}: {count}\n"
    if cssd['expired_packs']:
        context += f"Expired packs: {', '.join(cssd['expired_packs'])}\n"

    context += "\n## AI Recommendations (Pending)\n"
    if not recs:
        context += "No pending recommendations.\n"
    for r in recs:
        context += f"- [{r['priority']}] {r['type']}: {r['message']} (Patient: {r['patient_code']})\n"

    context += "\n## Active Unread Alerts\n"
    if not alerts:
        context += "No active alerts.\n"
    for a in alerts:
        context += f"- [{a['severity']}] {a['title']}: {a['message']}\n"

    context += "\n## Recent Workflow Events (last 15)\n"
    for e in events:
        context += f"- {e['timestamp'][:19]} | {e['event_type']} | Patient {e['patient_code']} | via {e['source']}\n"

    return context


# ---------------------------------------------------------------------------
# Main Copilot Query Function — uses Groq if available, falls back otherwise
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are FlowCare AI Copilot, an expert hospital operations assistant embedded in a surgical workflow management system.

You are given LIVE hospital state data from the FlowCare Digital Twin database, including:
- Operating theatre statuses and utilization
- Active and scheduled surgeries with patient readiness scores
- CSSD instrument pack inventory and sterilization status
- AI-generated risk predictions and delay forecasts
- Pending operational recommendations
- Recent clinical workflow events

Your role is to analyze this real-time data and answer the user's operational question clearly and concisely.

Rules:
- Always base your answer on the provided live data, not assumptions
- Use clinical/operational terminology appropriate for hospital staff
- Format responses using markdown (headers, bullet points, bold for key values)
- Be concise but complete — prioritize actionable insights
- If something is not in the data, say so clearly
- Never fabricate patient names, surgery details, or metrics
"""


def query_copilot(question: str, db: Session) -> Dict[str, Any]:
    """
    Gathers live hospital state from DB, then sends question + context to Groq
    for an intelligent, data-grounded natural language response.
    Falls back to structured keyword response if Groq is unavailable.
    """
    hospital_context = _build_hospital_context(db)

    # Try Groq first
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)

            user_message = (
                f"{hospital_context}\n\n"
                f"=== OPERATOR QUESTION ===\n{question}"
            )

            completion = client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.3,
                max_tokens=1024,
            )

            answer = completion.choices[0].message.content.strip()
            logger.info(f"Groq copilot responded to: '{question[:60]}...'")

            return {
                "answer": answer,
                "retrieved_data": {"source": "groq_llm", "model": "qwen/qwen3.8-27b"},
            }

        except Exception as e:
            logger.error(f"Groq API error: {e}. Falling back to rule-based copilot.")

    # Fallback: rule-based structured response using the same live data
    return _rule_based_fallback(question, hospital_context, db)


# ---------------------------------------------------------------------------
# Rule-based fallback (keeps working if Groq is down)
# ---------------------------------------------------------------------------

def _rule_based_fallback(question: str, hospital_context: str, db: Session) -> Dict[str, Any]:
    q = question.lower()
    answer = ""

    if "ot" in q and any(k in q for k in ["delay", "status", "available", "occupied"]):
        ots = _get_ot_status(db)
        delayed = [o for o in ots if o["status"] in ("DELAYED", "CLEANING")]
        if delayed:
            answer = "**Delayed / Busy Operating Theatres:**\n"
            for o in delayed:
                answer += f"- **{o['name']}**: {o['status']} — {o['current_surgery'] or 'No procedure'} ({o['utilization_pct']}% utilization)\n"
        else:
            answer = "All Operating Theatres are operating normally.\n"
            for o in ots:
                answer += f"- **{o['name']}**: {o['status']} ({o['utilization_pct']}% utilization)\n"

    elif any(k in q for k in ["risk", "delay", "at risk"]):
        surgeries = _get_active_surgeries(db)
        at_risk = [s for s in surgeries if s["risk_level"] in ("HIGH", "CRITICAL")]
        if at_risk:
            answer = "**Surgeries at Risk of Delay:**\n"
            for s in at_risk:
                answer += (
                    f"- **{s['patient_code']}** ({s['surgery_type']}) — "
                    f"Risk: `{s['risk_level']}`, Predicted delay: **{s['predicted_delay_minutes']} min**\n"
                )
        else:
            answer = "No surgeries are currently flagged as high or critical risk."

    elif any(k in q for k in ["cssd", "instrument", "pack", "sterile"]):
        cssd = _get_cssd_status(db)
        answer = f"**CSSD Status:** {cssd['total_packs']} total packs\n"
        for status, count in cssd['status_breakdown'].items():
            answer += f"- `{status}`: {count}\n"
        if cssd['expired_packs']:
            answer += f"\n⚠️ Expired: {', '.join(cssd['expired_packs'])}"

    elif any(k in q for k in ["bottleneck", "root cause", "recommendation"]):
        recs = _get_recommendations(db)
        if recs:
            answer = "**Active Operational Bottlenecks:**\n"
            for r in recs:
                answer += f"- **[{r['priority']}] {r['type']}**: {r['message']}\n"
        else:
            answer = "No active bottlenecks detected."

    else:
        answer = (
            "I am FlowCare AI Copilot. Ask me about:\n"
            "- **OT status** — *'Which OT is delayed?'*\n"
            "- **Surgery risk** — *'Which surgeries are at risk?'*\n"
            "- **CSSD packs** — *'What is the current CSSD status?'*\n"
            "- **Bottlenecks** — *'What is causing the bottleneck?'*\n"
        )

    return {"answer": answer, "retrieved_data": {"source": "rule_based_fallback"}}
