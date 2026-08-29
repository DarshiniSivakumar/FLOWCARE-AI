import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { api } from '../services/api';
import { 
  Home, RefreshCw, MoveRight, Activity, 
  CheckCircle, Package2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Patient, Surgery } from '../types';
import WorkflowDependencyGraph from '../components/WorkflowDependencyGraph';

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

  const wardPatients = patients.filter(p => p.current_location === 'Ward');
  const transferPatients = patients.filter(p => p.current_location === 'Transfer');
  const ots = liveState?.ots || [];
  const recoveryPatients = patients.filter(p => p.current_location === 'Recovery');

  const getPatientUrgencyBorder = (urgency: string) => {
    if (urgency === 'CRITICAL') return 'border-l-4 border-l-rose-500';
    if (urgency === 'HIGH') return 'border-l-4 border-l-amber-500';
    return 'border-l-4 border-l-blue-500';
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">Hospital Operational Digital Twin</h2>
          <p className="text-sm text-slate-500">Interactive live operational model of patient journeys</p>
        </div>
        <button 
          onClick={triggerReload}
          className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-all flex items-center gap-2 text-xs font-semibold shadow-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Sync Model
        </button>
      </div>

      {/* Workflow Dependency Graph Engine View */}
      <WorkflowDependencyGraph />

      {/* Main Twin Layout Map */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Step 1: Admission & Ward */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Home className="text-blue-600" size={18} />
              1. Ward / Prep
            </h3>
            <span className="text-[10px] bg-blue-100 text-blue-700 font-mono px-2 py-0.5 rounded-full font-bold">
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
                  className={`block bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3.5 transition-all ${getPatientUrgencyBorder(p.urgency_level)}`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-sm text-slate-900">{p.name}</p>
                    <span className="text-[9px] text-slate-500 font-mono font-bold uppercase">{p.patient_code}</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Readiness</span>
                    <span className={`text-[10px] font-mono font-bold ${p.readiness_score >= 80 ? 'text-emerald-600' : p.readiness_score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {p.readiness_score}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <MoveRight className="text-amber-600" size={18} />
              2. Transfer Corridor
            </h3>
            <span className="text-[10px] bg-amber-100 text-amber-800 font-mono px-2 py-0.5 rounded-full font-bold">
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
                  className="block bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3.5 transition-all border-l-4 border-l-amber-500"
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-sm text-slate-900">{p.name}</p>
                    <span className="text-[9px] text-amber-700 font-mono font-bold">IN TRANSIT</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">Destination: OT Block</p>
                  <span className="text-[9px] text-slate-500 uppercase font-mono block mt-2">{p.patient_code}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Step 3: Operating Theatre Blocks */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Activity className="text-rose-600" size={18} />
              3. Operating Block
            </h3>
            <span className="text-[10px] bg-rose-100 text-rose-700 font-mono px-2 py-0.5 rounded-full font-bold">
              {ots.length} Theatres
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {ots.map((ot: any) => {
              const activeSurg = surgeries.find(s => s.assigned_ot === ot.name && s.status !== 'COMPLETED');
              
              const borderColors: Record<string, string> = {
                'AVAILABLE': 'border-slate-200',
                'SURGERY': 'border-pink-300 border-l-4 border-l-pink-500',
                'DELAYED': 'border-rose-300 border-l-4 border-l-rose-500',
                'CLEANING': 'border-teal-300 border-l-4 border-l-teal-500'
              };

              return (
                <div key={ot.name} className={`bg-slate-50 border rounded-xl p-3.5 transition-all ${borderColors[ot.status] || 'border-slate-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      {activeSurg ? (
                        <Link to={`/ot/${ot.id}`} className="font-bold text-sm text-slate-900 hover:underline block">
                          {ot.name}
                        </Link>
                      ) : (
                        <p className="font-bold text-sm text-slate-900">{ot.name}</p>
                      )}
                      <span className="text-[9px] text-slate-500 uppercase font-mono font-semibold">Status</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase text-slate-600">{ot.status}</span>
                  </div>

                  {activeSurg && (
                    <div className="mt-3 bg-white border border-slate-200 rounded-lg p-2">
                      <p className="text-[10px] font-semibold text-slate-500">Procedure</p>
                      <p className="text-xs text-slate-900 truncate font-medium">{activeSurg.surgery_type}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 4: Recovery Wards */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle className="text-emerald-600" size={18} />
              4. Recovery Bed Space
            </h3>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded-full font-bold">
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
                  className="block bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-3.5 transition-all border-l-4 border-l-emerald-500"
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-sm text-slate-900">{p.name}</p>
                    <span className="text-[9px] text-emerald-700 font-mono font-bold">STABLE</span>
                  </div>
                  <span className="text-[9px] text-slate-500 uppercase font-mono block mt-2">{p.patient_code}</span>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Auxiliary CSSD Overview Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
          <Package2 className="text-hospital-600" size={20} />
          CSSD Central Sterile Supplies Support System
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-500 uppercase font-semibold">Total sterile packs</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">16 Packs</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-500 uppercase font-semibold">Sterilization Cycles</span>
            <p className="text-2xl font-bold text-hospital-600 mt-1">3 Active</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-500 uppercase font-semibold">Instruments Sterile</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">92.4%</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-500 uppercase font-semibold">Sterilizer Demand Status</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">Optimized</p>
          </div>
        </div>
      </div>
    </div>
  );
}
