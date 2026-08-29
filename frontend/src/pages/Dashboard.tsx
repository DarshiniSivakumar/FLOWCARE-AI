import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { api } from '../services/api';
import { 
  Users, Activity, ClipboardCheck, Timer, AlertCircle, 
  CheckCircle2, ArrowRight, ShieldAlert, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { liveState, recommendations, setRecommendations, triggerReload, user } = useApp();
  const [loading, setLoading] = useState(false);

  const stats = [
    { name: 'Total Patients', value: liveState?.total_patients_count ?? 0, icon: Users, color: 'text-blue-400 bg-blue-500/10' },
    { name: 'Active Procedures', value: liveState?.active_surgeries_count ?? 0, icon: Activity, color: 'text-emerald-400 bg-emerald-500/10' },
    { name: 'Live OT Utilization', value: `${liveState?.ot_utilization ?? 0}%`, icon: ClipboardCheck, color: 'text-purple-400 bg-purple-500/10' },
    { name: 'CSSD Available Packs', value: liveState?.available_packs_count ?? 0, icon: Timer, color: 'text-amber-400 bg-amber-500/10' }
  ];

  const handleRecommendation = async (id: number, action: 'ACCEPT' | 'DISMISS') => {
    setLoading(true);
    try {
      if (action === 'ACCEPT') {
        await api.acceptRecommendation(id);
      } else {
        await api.dismissRecommendation(id);
      }
      setRecommendations(prev => prev.filter(r => r.id !== id));
      triggerReload();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white leading-tight">Operational Command Center</h2>
          <p className="text-sm text-slate-400">FlowCare Digital Twin & Predictive Live Monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-hospital-900/50 border border-hospital-700 text-hospital-300 text-xs px-3 py-1.5 rounded-xl font-semibold uppercase font-mono">
            Location: Central
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">{stat.name}</span>
                <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-xl ${stat.color}`}>
                <Icon size={24} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Operating Theatres List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Activity className="text-hospital-400" size={20} />
                Operating Theatre Live Status
              </h3>
              <Link to="/ot" className="text-xs font-bold text-hospital-400 hover:text-hospital-300 flex items-center gap-1">
                Manage OTs <ArrowRight size={14} />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveState?.ots?.map((ot: any) => {
                const statusColors: Record<string, string> = {
                  'AVAILABLE': 'bg-emerald-500/10 text-emerald-400 border-emerald-800',
                  'PREPARING': 'bg-blue-500/10 text-blue-400 border-blue-800',
                  'PATIENT_WAITING': 'bg-amber-500/10 text-amber-400 border-amber-800',
                  'ANAESTHESIA': 'bg-indigo-500/10 text-indigo-400 border-indigo-800',
                  'SURGERY': 'bg-pink-500/10 text-pink-400 border-pink-800',
                  'CLEANING': 'bg-teal-500/10 text-teal-400 border-teal-800',
                  'DELAYED': 'bg-rose-500/10 text-rose-400 border-rose-800'
                };

                return (
                  <div key={ot.name} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-base">{ot.name}</h4>
                        <span className="text-xs text-slate-400 font-mono">Utilization: {ot.utilization}%</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border ${statusColors[ot.status] || 'bg-slate-850 text-slate-300'}`}>
                        ● {ot.status.replace('_', ' ')}
                      </span>
                    </div>

                    {ot.current_surgery ? (
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                        <p className="text-xs font-semibold text-slate-400">Current Procedure</p>
                        <p className="text-sm font-semibold text-white truncate">{ot.current_surgery}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No procedure active</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actionable Recommendations Module */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Zap className="text-amber-400 fill-amber-400/20" size={20} />
              AI Operational Recommendations
            </h3>

            <div className="space-y-4">
              {recommendations.length === 0 ? (
                <div className="text-center p-8 bg-slate-950 border border-slate-850 rounded-xl text-slate-500 text-sm">
                  No pending recommendations. System flow is optimized.
                </div>
              ) : (
                recommendations.map(rec => (
                  <div key={rec.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          rec.priority === 'CRITICAL' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 
                          rec.priority === 'HIGH' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}>
                          {rec.priority} Priority
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold">Recommendation</span>
                      </div>
                      <p className="text-sm font-medium text-white leading-relaxed">{rec.message}</p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleRecommendation(rec.id, 'ACCEPT')}
                        disabled={loading || (user?.role !== 'ADMIN' && user?.role !== 'OT_MANAGER')}
                        className="px-4 py-2 bg-hospital-600 hover:bg-hospital-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all active:scale-[0.98]"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRecommendation(rec.id, 'DISMISS')}
                        disabled={loading || (user?.role !== 'ADMIN' && user?.role !== 'OT_MANAGER')}
                        className="px-4 py-2 bg-slate-850 hover:bg-slate-800 disabled:opacity-50 text-slate-400 hover:text-white font-semibold text-xs rounded-lg transition-all border border-slate-750"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Live Alerts & Notifications Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col h-full min-h-[400px]">
            <h3 className="font-bold text-lg text-white flex items-center gap-2 mb-6">
              <ShieldAlert className="text-rose-400" size={20} />
              Active System Alerts
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {liveState?.critical_alerts?.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                  No active operational alerts.
                </div>
              ) : (
                liveState?.critical_alerts?.map((alert: any) => (
                  <div key={alert.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2 border-l-4 border-l-rose-500">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded uppercase">
                        {alert.severity}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-white leading-snug">{alert.title}</h4>
                    <p className="text-xs text-slate-400 leading-normal">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
