import React, { useEffect, useState } from 'react';
import { useApp } from '../App';
import { api } from '../services/api';
import { 
  Home, RefreshCw, MoveRight, ArrowDown, Activity, 
  Layers, CheckCircle, Package2, ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Patient, Surgery, OperatingTheatre } from '../types';

export default function DigitalTwin() {
  const { liveState, triggerReload } = useApp();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const pts = await api.getPatients();
        setPatients(pts);
        const surgs = await api.getSurgeries();
        setSurgeries(surgs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [liveState]);

  // Group patients by their current location
  const wardPatients = patients.filter(p => p.current_location === 'Ward');
  const transferPatients = patients.filter(p => p.current_location === 'Transfer');
  
  // OTs
  const ots = liveState?.ots || [];
  
  // Recovery Patients
  const recoveryPatients = patients.filter(p => p.current_location === 'Recovery');

  const getPatientUrgencyBorder = (urgency: string) => {
    if (urgency === 'CRITICAL') return 'border-l-4 border-l-rose-500';
    if (urgency === 'HIGH') return 'border-l-4 border-l-amber-500';
    return 'border-l-4 border-l-blue-500';
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white leading-tight">Hospital Operational Digital Twin</h2>
          <p className="text-sm text-slate-400">Interactive live operational model of patient journeys</p>
        </div>
        <button 
          onClick={triggerReload}
          className="p-2 bg-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-all flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Sync Model
        </button>
      </div>

      {/* Main Twin Layout Map */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Step 1: Admission & Ward */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Home className="text-blue-400" size={18} />
              1. Ward / Prep
            </h3>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 font-mono px-2 py-0.5 rounded-full font-bold">
              {wardPatients.length} Patients
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {wardPatients.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6">Ward is empty</p>
            ) : (
              wardPatients.map(p => (
                <Link 
                  key={p.id} 
                  to={`/patients/${p.id}`}
                  className={`block bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl p-3.5 transition-all ${getPatientUrgencyBorder(p.urgency_level)}`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-sm text-white">{p.name}</p>
                    <span className="text-[9px] text-slate-500 font-mono font-bold uppercase">{p.patient_code}</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Readiness</span>
                    <span className={`text-[10px] font-mono font-bold ${p.readiness_score >= 80 ? 'text-emerald-400' : p.readiness_score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {p.readiness_score}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1 mt-1">
                    <div 
                      className={`h-1 rounded-full ${p.readiness_score >= 80 ? 'bg-emerald-500' : p.readiness_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                      style={{ width: `${p.readiness_score}%` }}
                    />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Step 2: Transfer Pipelines */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <MoveRight className="text-amber-400" size={18} />
              2. Transfer Corridor
            </h3>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 font-mono px-2 py-0.5 rounded-full font-bold">
              {transferPatients.length} Moving
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {transferPatients.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6">No patients in transfer</p>
            ) : (
              transferPatients.map(p => (
                <Link 
                  key={p.id} 
                  to={`/patients/${p.id}`}
                  className={`block bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl p-3.5 transition-all border-l-4 border-l-amber-500`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-sm text-white">{p.name}</p>
                    <span className="text-[9px] text-amber-400 font-mono font-bold">IN TRANSIT</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Destination: OT Block</p>
                  <span className="text-[9px] text-slate-500 uppercase font-mono block mt-2">{p.patient_code}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Step 3: Operating Theatre Blocks */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Activity className="text-rose-400" size={18} />
              3. Operating Block
            </h3>
            <span className="text-[10px] bg-rose-500/10 text-rose-400 font-mono px-2 py-0.5 rounded-full font-bold">
              {ots.length} Theatres
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {ots.map((ot: any) => {
              const activeSurg = surgeries.find(s => s.assigned_ot === ot.name && s.status !== 'COMPLETED');
              
              const borderColors: Record<string, string> = {
                'AVAILABLE': 'border-slate-800',
                'SURGERY': 'border-pink-850 border-l-4 border-l-pink-500',
                'DELAYED': 'border-rose-850 border-l-4 border-l-rose-500',
                'CLEANING': 'border-teal-850 border-l-4 border-l-teal-500'
              };

              return (
                <div key={ot.name} className={`bg-slate-950 border rounded-xl p-3.5 transition-all ${borderColors[ot.status] || 'border-slate-800'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      {activeSurg ? (
                        <Link to={`/ot/${ot.id}`} className="font-bold text-sm text-white hover:underline block">
                          {ot.name}
                        </Link>
                      ) : (
                        <p className="font-bold text-sm text-white">{ot.name}</p>
                      )}
                      <span className="text-[9px] text-slate-500 uppercase font-mono font-semibold">Status</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase text-slate-400">{ot.status}</span>
                  </div>

                  {activeSurg && (
                    <div className="mt-3 bg-slate-900 border border-slate-850 rounded-lg p-2">
                      <p className="text-[10px] font-semibold text-slate-400">Procedure</p>
                      <p className="text-xs text-white truncate font-medium">{activeSurg.surgery_type}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 4: Recovery Wards */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <CheckCircle className="text-emerald-400" size={18} />
              4. Recovery Bed Space
            </h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded-full font-bold">
              {recoveryPatients.length} / 6 Beds
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {recoveryPatients.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6 font-medium">Recovery is vacant</p>
            ) : (
              recoveryPatients.map(p => (
                <Link 
                  key={p.id} 
                  to={`/patients/${p.id}`}
                  className="block bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl p-3.5 transition-all border-l-4 border-l-emerald-500"
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-sm text-white">{p.name}</p>
                    <span className="text-[9px] text-emerald-400 font-mono font-bold">STABLE</span>
                  </div>
                  <span className="text-[9px] text-slate-500 uppercase font-mono block mt-2">{p.patient_code}</span>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Auxiliary CSSD Overview Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <h3 className="font-bold text-lg text-white flex items-center gap-2">
          <Package2 className="text-hospital-400" size={20} />
          CSSD Central Sterile Supplies Support System
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total sterile packs</span>
            <p className="text-2xl font-bold text-white mt-1">16 Packs</p>
          </div>
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Sterilization Cycles</span>
            <p className="text-2xl font-bold text-hospital-400 mt-1">3 Active</p>
          </div>
          <div className="bg-slate-950 border border-slate-8-0/80 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Instruments Sterile</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">92.4%</p>
          </div>
          <div className="bg-slate-950 border border-slate-80/80 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Sterilizer Demand Status</span>
            <p className="text-2xl font-bold text-amber-400 mt-1">Optimized</p>
          </div>
        </div>
      </div>
    </div>
  );
}
