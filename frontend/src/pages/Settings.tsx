import React, { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../App';
import { Database, Play, RefreshCw, Layers, FlaskConical } from 'lucide-react';

export default function Settings() {
  const { triggerReload } = useApp();
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  const handleResetDb = async () => {
    setLoading(true);
    try {
      await api.resetDb();
      setActiveScenario(null);
      triggerReload();
      alert('Database successfully reset and seeded to initial states.');
    } catch (e) {
      console.error(e);
      alert('Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerScenario = async (scenario: 'A' | 'B' | 'C' | 'D') => {
    setLoading(true);
    try {
      await api.triggerScenario(scenario);
      setActiveScenario(scenario);
      triggerReload();
      alert(`Scenario ${scenario} successfully triggered! Check the Command Center or Digital Twin.`);
    } catch (e) {
      console.error(e);
      alert(`Triggering Scenario ${scenario} failed.`);
    } finally {
      setLoading(false);
    }
  };

  const scenarios = [
    {
      id: 'A',
      title: 'Scenario A — Normal Workflow',
      desc: 'John Doe admitted, pre-op checklist completes successfully. CSSD pack General Surgery Set is ready, room OT-01 is assigned. Everything proceeds with no warnings or delay risks.',
      color: 'emerald',
    },
    {
      id: 'B',
      title: 'Scenario B — Anaesthesia Delay',
      desc: 'Jane Smith scheduled in OT-02. Patient ready, CSSD pack Orthopedic Set ready, OT ready, but Anaesthesia remains incomplete. Rules engine generates an OT re-assignment recommendation.',
      color: 'amber',
    },
    {
      id: 'C',
      title: 'Scenario C — CSSD Shortage',
      desc: 'Michael Johnson scheduled in OT-03. Required Laparoscopic Set pack is unavailable (all set to sterilizing/cleaning status). Predicts delays and recommends starting autoclave cycles.',
      color: 'orange',
    },
    {
      id: 'D',
      title: 'Scenario D — Multiple Simultaneous Delays (Centerpiece)',
      desc: 'Simultaneously delays 4 surgeries of different urgency levels and bottlenecks (Emergency CORONARY BYPASS with Anaesthesia delay, Cancer surgery with OT room conflict, Knee replacement with transfer delay, Routine hernia repair with CSSD shortage). The Priority Engine ranks them (Emergency/Critical first) and targets alerts to Nurses, CSSD Staff, and OT Managers.',
      color: 'rose',
    }
  ];

  const colorMap: Record<string, { badge: string; active: string }> = {
    emerald: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', active: 'border-emerald-400 bg-emerald-50' },
    amber: { badge: 'bg-amber-100 text-amber-700 border-amber-200', active: 'border-amber-400 bg-amber-50' },
    orange: { badge: 'bg-orange-100 text-orange-700 border-orange-200', active: 'border-orange-400 bg-orange-50' },
    rose: { badge: 'bg-rose-100 text-rose-700 border-rose-200', active: 'border-rose-400 bg-rose-50' },
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-hospital-100 text-hospital-600 p-2.5 rounded-xl border border-hospital-200">
            <FlaskConical size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">Developer Control Panel & Simulator</h2>
            <p className="text-sm text-slate-500">Trigger simulated clinical scenarios and verify digital twin updates in real-time</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Database Management Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 lg:col-span-1">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Database className="text-hospital-600" size={18} />
            System Database Reset
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed">
            Resets the SQLite database, creates clean schemas, seeds 30+ completed historical surgeries for analytics, and initialises active mock surgeries.
          </p>

          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">⚠️ Destructive Action</p>
            <p className="text-xs text-rose-600 mt-0.5">All current live data will be wiped and replaced with seed data.</p>
          </div>

          <button
            onClick={handleResetDb}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all active:scale-[0.98] shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Re-Initialize Database
          </button>
        </div>

        {/* Scenarios Simulator Grid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 lg:col-span-2">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Layers className="text-amber-500" size={18} />
            Pre-Configured Hackathon Scenarios
          </h3>

          <div className="space-y-4">
            {scenarios.map(sc => {
              const colors = colorMap[sc.color];
              const isActive = activeScenario === sc.id;
              return (
                <div
                  key={sc.id}
                  className={`border rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                    isActive ? colors.active : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-2 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${colors.badge}`}>
                        Scenario {sc.id}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-hospital-100 text-hospital-700 border border-hospital-200 uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">{sc.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{sc.desc}</p>
                  </div>

                  <button
                    onClick={() => handleTriggerScenario(sc.id as any)}
                    disabled={loading}
                    className="px-4 py-2.5 bg-hospital-600 hover:bg-hospital-700 border border-hospital-700 text-white disabled:opacity-50 font-semibold text-xs rounded-lg transition-all flex items-center gap-2 shrink-0 self-end md:self-auto shadow-sm active:scale-[0.98]"
                  >
                    <Play size={12} className="fill-white" />
                    Trigger
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
