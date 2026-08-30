import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../App';
import { 
  ArrowLeft, Activity, RefreshCw, FlaskConical
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
    return <p className="text-slate-500 text-sm text-center py-12">Fetching theatre records...</p>;
  }

  if (!ot) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 text-sm">Theatre record not found.</p>
        <Link to="/ot" className="text-hospital-600 flex items-center gap-2"><ArrowLeft size={16} /> Back to room block</Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    'AVAILABLE': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'PREPARING': 'bg-blue-100 text-blue-700 border-blue-300',
    'PATIENT_WAITING': 'bg-amber-100 text-amber-800 border-amber-300',
    'ANAESTHESIA': 'bg-indigo-100 text-indigo-700 border-indigo-300',
    'SURGERY': 'bg-pink-100 text-pink-700 border-pink-300',
    'CLEANING': 'bg-teal-100 text-teal-700 border-teal-300',
    'DELAYED': 'bg-rose-100 text-rose-700 border-rose-300',
  };

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
      <Link to="/ot" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-all text-xs font-semibold uppercase">
        <ArrowLeft size={16} />
        Back to Room Block
      </Link>

      {/* OT Card header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="flex gap-4 items-center">
          <div className="bg-hospital-100 p-4 rounded-full text-hospital-600 border border-hospital-200">
            <Activity size={28} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">{ot.name}</h2>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${statusColors[ot.status] || 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                ● {ot.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">Live Theatre Monitoring Panel · Utilization: {ot.utilization}%</p>
          </div>
        </div>

        <div className="flex gap-6 shrink-0 md:border-l md:border-slate-200 md:pl-8">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Active Case</span>
            <p className="text-sm font-semibold text-slate-900 mt-1">{surgery?.surgery_type ?? 'None assigned'}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Patient Code</span>
            <p className="text-sm font-semibold text-slate-900 mt-1 font-mono">{patient?.patient_code ?? 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Case Details Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-base text-slate-900">Active Case Information</h3>

            {surgery && patient ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Patient Name</span>
                  <p className="text-sm font-bold text-slate-900">{patient.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Age / Gender</span>
                    <p className="text-xs text-slate-700">{patient.age} / {patient.gender}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Urgency</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase inline-block ${
                      patient.urgency_level === 'CRITICAL' ? 'bg-rose-100 text-rose-700 border border-rose-300' :
                      patient.urgency_level === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      'bg-blue-100 text-blue-700 border border-blue-300'
                    }`}>{patient.urgency_level}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Assigned Surgeon</span>
                  <p className="text-xs text-slate-700">{surgery.surgeon}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Scheduled Start</span>
                  <p className="text-xs text-slate-700">{new Date(surgery.scheduled_start).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Case Status</span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-hospital-50 border border-hospital-200 text-hospital-700 rounded-md font-mono uppercase inline-block">
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FlaskConical className="text-hospital-600" size={18} />
                <h3 className="font-bold text-base text-slate-900">Event Simulation Dashboard</h3>
              </div>
              <button
                onClick={fetchOtData}
                className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all"
              >
                <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-normal">
              Click buttons to trigger clinical / logistical events from the nurse/doctor station. 
              The digital twin workflow maps will update in real-time across all connected clients.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulatedSteps.map(step => {
                const isRecommended = surgery && surgery.status === step.activeStage;
                
                return (
                  <button
                    key={step.event}
                    onClick={() => handleTriggerEvent(step.event)}
                    disabled={actionLoading || !surgery}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all active:scale-[0.98] ${
                      isRecommended 
                        ? 'bg-hospital-50 border-hospital-400 hover:bg-hospital-100 shadow-sm' 
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className={`text-xs font-semibold leading-snug ${isRecommended ? 'text-hospital-900' : 'text-slate-700'}`}>
                      {step.label}
                    </span>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[9px] font-mono text-slate-400 uppercase">{step.event}</span>
                      {isRecommended && (
                        <span className="text-[8px] font-bold bg-hospital-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                          NEXT STEP
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
