import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../App';
import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OperatingTheatre, Surgery } from '../types';

export default function OTs() {
  const { liveState } = useApp();
  const [ots, setOts] = useState<OperatingTheatre[]>([]);
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const list = await api.getOts();
        setOts(list);
        const surgs = await api.getSurgeries();
        setSurgeries(surgs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [liveState]);

  const statusColors: Record<string, string> = {
    'AVAILABLE': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'PREPARING': 'bg-blue-100 text-blue-700 border-blue-300',
    'PATIENT_WAITING': 'bg-amber-100 text-amber-800 border-amber-300',
    'ANAESTHESIA': 'bg-indigo-100 text-indigo-700 border-indigo-300',
    'SURGERY': 'bg-pink-100 text-pink-700 border-pink-300',
    'CLEANING': 'bg-teal-100 text-teal-700 border-teal-300',
    'DELAYED': 'bg-rose-100 text-rose-700 border-rose-300'
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 leading-tight">Operating Theatre Block</h2>
        <p className="text-sm text-slate-500">Monitor live room statuses, current patient flows, and schedule turnarounds</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <p className="text-slate-500 text-sm text-center col-span-full py-12">Synchronizing OTs...</p>
        ) : ots.length === 0 ? (
          <p className="text-slate-500 text-sm italic text-center col-span-full py-12">No theatres found.</p>
        ) : (
          ots.map(ot => {
            const activeSurg = surgeries.find(s => s.assigned_ot === ot.name && s.status !== 'COMPLETED');
            return (
              <div key={ot.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{ot.name}</h3>
                      <span className="text-xs text-slate-500 font-mono">Utilization: {ot.utilization}%</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${statusColors[ot.status] || 'bg-slate-100 text-slate-700'}`}>
                      ● {ot.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Surgery Details Panel */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Active Case</span>
                    {activeSurg ? (
                      <div>
                        <p className="text-sm font-bold text-slate-900 truncate">{activeSurg.surgery_type}</p>
                        <p className="text-xs text-slate-600 mt-1">Surgeon: {activeSurg.surgeon}</p>
                        <div className="mt-2.5 flex justify-between text-xs text-slate-500 font-mono">
                          <span>Scheduled: {new Date(activeSurg.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>Est: {activeSurg.expected_duration} min</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-2">No active procedure assigned.</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-200 pt-4">
                  <Link
                    to={`/ot/${ot.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-hospital-600 hover:bg-hospital-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-[0.98]"
                  >
                    <Play size={14} />
                    Open Simulator Control
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
