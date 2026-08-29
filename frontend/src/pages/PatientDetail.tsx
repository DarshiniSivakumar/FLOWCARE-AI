import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { 
  ArrowLeft, CheckCircle2, XCircle, Clock, 
  MapPin, User
} from 'lucide-react';
import { Patient, Surgery, WorkflowEvent } from '../types';

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [surgery, setSurgery] = useState<Surgery | null>(null);
  const [timeline, setTimeline] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchPatientData = async () => {
      setLoading(true);
      try {
        const p = await api.getPatient(id);
        setPatient(p);

        const surgs = await api.getSurgeries();
        const activeSurg = surgs.find((s: Surgery) => s.patient_id === p.id);
        setSurgery(activeSurg || null);

        const events = await api.getPatientTimeline(p.id);
        setTimeline(events);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatientData();
  }, [id]);

  if (loading) {
    return <p className="text-slate-500 text-sm text-center py-12">Loading patient record...</p>;
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 text-sm">Patient record not found.</p>
        <Link to="/patients" className="text-hospital-600 flex items-center gap-2"><ArrowLeft size={16} /> Back to directory</Link>
      </div>
    );
  }

  const eventTypes = new Set(timeline.map(e => e.event_type));

  const checklist = [
    { name: 'Patient Prep Initiated', verified: eventTypes.has('PATIENT_PREP_STARTED'), score: '10%' },
    { name: 'Clinical Pre-op Ready', verified: eventTypes.has('PATIENT_READY'), score: '20%' },
    { name: 'Surgical Consent Signed', verified: eventTypes.has('CONSENT_COMPLETED'), score: '15%' },
    { name: 'CSSD Instrument Ready', verified: eventTypes.has('CSSD_PACK_READY'), score: '15%' },
    { name: 'OT Theatre Assigned', verified: !!surgery?.assigned_ot, score: '10%' },
    { name: 'Operating Room Clean/Ready', verified: eventTypes.has('OT_READY') || eventTypes.has('PATIENT_ARRIVED_OT'), score: '10%' },
    { name: 'Anaesthesia Prepared', verified: eventTypes.has('ANAESTHESIA_READY') || eventTypes.has('SURGERY_STARTED'), score: '10%' },
    { name: 'OT Block Transfer', verified: eventTypes.has('PATIENT_ARRIVED_OT') || eventTypes.has('SURGERY_STARTED'), score: '10%' }
  ];

  const flowStages = [
    { key: 'PATIENT_ADMITTED', label: 'Admitted' },
    { key: 'PATIENT_READY', label: 'Pre-op Ready' },
    { key: 'CONSENT_COMPLETED', label: 'Consent Done' },
    { key: 'CSSD_PACK_READY', label: 'CSSD Sterile' },
    { key: 'OT_READY', label: 'OT Room Ready' },
    { key: 'PATIENT_ARRIVED_OT', label: 'Arrived OT' },
    { key: 'ANAESTHESIA_READY', label: 'Anaesthesia' },
    { key: 'SURGERY_STARTED', label: 'Surgery' },
    { key: 'RECOVERY', label: 'Recovery' }
  ];

  return (
    <div className="space-y-8">
      {/* Back button */}
      <Link to="/patients" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-all text-xs font-semibold uppercase">
        <ArrowLeft size={16} />
        Back to Patients
      </Link>

      {/* Patient Card header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="flex gap-4 items-center">
          <div className="bg-slate-100 p-4 rounded-full text-slate-700 border border-slate-200">
            <User size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">{patient.name}</h2>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                patient.urgency_level === 'CRITICAL' ? 'bg-rose-100 text-rose-700 border border-rose-300' :
                patient.urgency_level === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-700 border border-blue-300'
              }`}>
                {patient.urgency_level}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Patient ID: {patient.patient_code} | Age: {patient.age} | Gender: {patient.gender}
            </p>
          </div>
        </div>

        <div className="flex gap-6 shrink-0 md:border-l md:border-slate-200 md:pl-8">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Current Location</span>
            <div className="flex items-center gap-1.5 mt-1 text-slate-900">
              <MapPin size={14} className="text-hospital-600" />
              <p className="text-sm font-semibold">{patient.current_location}</p>
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Scheduled Case</span>
            <p className="text-sm font-semibold text-slate-900 mt-1">{surgery?.surgery_type ?? 'None assigned'}</p>
          </div>
        </div>
      </div>

      {/* Timeline flow progress */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-slate-900">Active Case Flow Progress</h3>
        
        <div className="relative flex items-center justify-between w-full mt-4">
          <div className="absolute left-0 right-0 h-1 bg-slate-200 -z-10" />
          {flowStages.map((stage, idx) => {
            const isCompleted = eventTypes.has(stage.key) || 
                                (stage.key === 'RECOVERY' && patient.current_location === 'Recovery') || 
                                (stage.key === 'OT_READY' && !!surgery?.assigned_ot);
            
            return (
              <div key={stage.key} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs ${
                  isCompleted 
                    ? 'bg-hospital-600 border-hospital-500 text-white shadow-xs' 
                    : 'bg-slate-100 border-slate-300 text-slate-400'
                }`}>
                  {idx + 1}
                </div>
                <span className={`text-[10px] font-semibold mt-2 ${isCompleted ? 'text-slate-900' : 'text-slate-500'}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main split details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Readiness score and Checklist */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-base text-slate-900">Surgical Readiness score</h3>
            
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className={`text-4xl font-bold font-mono ${
                patient.readiness_score >= 80 ? 'text-emerald-600' : patient.readiness_score >= 50 ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {patient.readiness_score}%
              </span>
              <p className="text-xs text-slate-500 text-center leading-normal">
                Score calculates workflow milestone completeness across clinical and logistical checklists.
              </p>
            </div>

            <div className="space-y-3">
              {checklist.map(item => (
                <div key={item.name} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    {item.verified ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-slate-400 shrink-0" />
                    )}
                    <span className={item.verified ? 'text-slate-900 font-semibold' : 'text-slate-500'}>{item.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">{item.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Workflow Replay (History of events) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 mb-6">
              <Clock className="text-hospital-600" size={18} />
              Workflow Audit Trail & Event Replay
            </h3>

            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6 flex-1">
              {timeline.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No events logged yet for this patient.</p>
              ) : (
                timeline.map(event => {
                  const isDelay = event.event_type.includes('DELAY') || event.event_type.includes('UNAVAILABLE');

                  return (
                    <div key={event.id} className="relative">
                      <span className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 ${
                        isDelay ? 'bg-rose-500 border-rose-500' : 'bg-white border-hospital-600'
                      }`} />
                      
                      <div className="space-y-1">
                        <div className="flex justify-between items-center gap-2">
                          <h4 className={`text-sm font-bold ${isDelay ? 'text-rose-600' : 'text-slate-900'}`}>
                            {event.event_type.replace('_', ' ')}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Source: <span className="font-semibold text-slate-700">{event.source}</span>
                        </p>
                        {event.metadata && event.metadata !== '{}' && (
                          <pre className="bg-slate-50 p-2.5 rounded-lg text-[10px] font-mono text-slate-800 border border-slate-200 mt-1 max-w-full overflow-x-auto whitespace-pre-wrap">
                            {event.metadata}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
