import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../App';
import { 
  ArrowLeft, Activity, Play, CheckCircle, Clock, 
  MapPin, HelpCircle, User, AlertTriangle, RefreshCw
} from 'lucide-react';
import { OperatingTheatre, Surgery, Patient } from '../types';

export default function OTDetail() {
  const { id } = useParams<{ id: string }>();
  const { triggerReload } = useApp();
  const [ot, setOt] = useState<OperatingTheatre | null>(null);
  const [surgery, setSurgery] = useState<Surgery | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOtData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const o = await api.getOt(id);
      setOt(o);
      
      const surgs = await api.getSurgeries();
      const activeSurg = surgs.find((s: Surgery) => s.assigned_ot === o.name && s.status !== 'COMPLETED');
      setSurgery(activeSurg || null);

      if (activeSurg) {
        const pts = await api.getPatients();
        const activePt = pts.find((p: Patient) => p.id === activeSurg.patient_id);
        setPatient(activePt || null);
      } else {
        setPatient(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOtData();
  }, [id]);

  const handleTriggerEvent = async (eventType: string) => {
    if (!surgery || !patient) return;
    setActionLoading(true);
    try {
      await api.triggerWorkflowEvent({
        patient_id: patient.id,
        surgery_id: surgery.id,
        event_type: eventType,
        metadata: JSON.stringify({ actor_role: 'NURSE', timestamp: new Date().toISOString() })
      });
      triggerReload();
      await fetchOtData();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Event trigger failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <p className="text-slate-400 text-sm text-center py-12">Fetching theatre records...</p>;
  }

  if (!ot) {
    return (
      <div className="space-y-4">
        <p className="text-slate-400 text-sm">Theatre record not found.</p>
        <Link to="/ot" className="text-hospital-400 flex items-center gap-2"><ArrowLeft size={16} /> Back to room block</Link>
      </div>
    );
  }

  // Active steps buttons config
  const simulatedSteps = [
    { label: 'Mark Patient Ready', event: 'PATIENT_READY', activeStage: 'PREP' },
    { label: 'Start Patient Transfer', event: 'TRANSFER_STARTED', activeStage: 'READY' },
    { label: 'Patient Arrived at OT', event: 'PATIENT_ARRIVED_OT', activeStage: 'TRANSFER' },
    { label: 'Confirm Anaesthesia Ready', event: 'ANAESTHESIA_READY', activeStage: 'IN_OT' },
    { label: 'Start Surgical Incision', event: 'SURGERY_STARTED', activeStage: 'ANAESTHESIA' },
    { label: 'Incision Closed & Completed', event: 'SURGERY_COMPLETED', activeStage: 'SURGERY' },
    { label: 'Patient Entered Recovery', event: 'PATIENT_ENTERED_RECOVERY', activeStage: 'CLEANING' },
    { label: 'OT Cleaning Complete', event: 'OT_READY_FOR_NEXT_CASE', activeStage: 'RECOVERY' }
  ];

  return (
    <div className="space-y-8">
      {/* Back button */}
      <Link to="/ot" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-all text-xs font-semibold uppercase">
        <ArrowLeft size={16} />
        Back to Room Block
      </Link>

      {/* OT Card header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg">
        <div className="flex gap-4 items-center">
          <div className="bg-slate-850 p-4 rounded-full text-slate-300 border border-slate-750">
            <Activity size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white leading-tight">{ot.name}</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-800 text-slate-300 border border-slate-700`}>
                Room Status: {ot.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Live Theatre Monitoring Panel
            </p>
          </div>
        </div>

        <div className="flex gap-6 shrink-0 md:border-l md:border-slate-800 md:pl-8">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Case</span>
            <p className="text-sm font-semibold text-white mt-1">{surgery?.surgery_type ?? 'None assigned'}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Patient Code</span>
            <p className="text-sm font-semibold text-white mt-1 font-mono">{patient?.patient_code ?? 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Case Details Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
            <h3 className="font-bold text-base text-white">Active Case Information</h3>

            {surgery && patient ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Patient Name</span>
                  <p className="text-sm font-bold text-white">{patient.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Age/Gender</span>
                    <p className="text-xs text-white">{patient.age} / {patient.gender}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Urgency</span>
                    <p className="text-xs text-white">{patient.urgency_level}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Assigned Surgeon</span>
                  <p className="text-xs text-white">{surgery.surgeon}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Scheduled Start</span>
                  <p className="text-xs text-white">{new Date(surgery.scheduled_start).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Case Status</span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-hospital-900/50 border border-hospital-700 text-hospital-300 rounded-md font-mono uppercase">
                    {surgery.status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-6 text-center">No active procedure assigned to {ot.name}.</p>
            )}
          </div>
        </div>

        {/* Workflow Event trigger buttons */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-white">Event Simulation Dashboard</h3>
              <button 
                onClick={fetchOtData}
                className="p-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white"
              >
                <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            
            <p className="text-xs text-slate-400 leading-normal">
              Click buttons to trigger clinical / logistical events from the nurse/doctor station. 
              The digital twin workflow maps will update in real-time across all connected clients.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulatedSteps.map(step => {
                // Determine if this is the logical next step to guide the user
                const isRecommended = surgery && surgery.status === step.activeStage;
                
                return (
                  <button
                    key={step.event}
                    onClick={() => handleTriggerEvent(step.event)}
                    disabled={actionLoading || !surgery}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all active:scale-[0.98] ${
                      isRecommended 
                        ? 'bg-hospital-950/20 border-hospital-600 hover:bg-hospital-950/30' 
                        : 'bg-slate-950 border-slate-850 hover:bg-slate-800 opacity-60'
                    }`}
                  >
                    <span className="text-xs font-semibold text-white leading-snug">{step.label}</span>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">{step.event}</span>
                      {isRecommended && (
                        <span className="text-[8px] font-bold bg-hospital-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
