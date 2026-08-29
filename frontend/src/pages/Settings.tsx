import React, { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../App';
import { Database, Play, AlertCircle, RefreshCw, Layers } from 'lucide-react';

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
    },
    {
      id: 'B',
      title: 'Scenario B — Anaesthesia Delay',
      desc: 'Jane Smith scheduled in OT-02. Patient ready, CSSD pack Orthopedic Set ready, OT ready, but Anaesthesia remains incomplete. Rules engine generates an OT re-assignment recommendation.',
    },
    {
      id: 'C',
      title: 'Scenario C — CSSD Shortage',
      desc: 'Michael Johnson scheduled in OT-03. Required Laparoscopic Set pack is unavailable (all set to sterilizing/cleaning status). Predicts delays and recommends starting autoclave cycles.',
    },
    {
      id: 'D',
      title: 'Scenario D — Multiple Simultaneous Delays (Centerpiece)',
      desc: 'Simultaneously delays 4 surgeries of different urgency levels and bottlenecks (Emergency CORONARY BYPASS with Anaesthesia delay, Cancer surgery with OT room conflict, Knee replacement with transfer delay, Routine hernia repair with CSSD shortage). The Priority Engine ranks them (Emergency/Critical first) and targets alerts to Nurses, CSSD Staff, and OT Managers.',
    }
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white leading-tight">Developer Control Panel & Simulator</h2>
        <p className="text-sm text-slate-400">Trigger simulated clinical scenarios and verify digital twin updates in real-time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Database Management Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6 lg:col-span-1">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Database className="text-hospital-400" size={18} />
            System Database Reset
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            Resets the SQLite database, creates clean schemas, seeds 30+ completed historical surgeries for analytics, and initialises active mock surgeries.
          </p>

          <button
            onClick={handleResetDb}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all active:scale-[0.98]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Re-Initialize Database
          </button>
        </div>

        {/* Scenarios Simulator Grid */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6 lg:col-span-2">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Layers className="text-amber-400" size={18} />
            Pre-Configured Hackathon Scenarios
          </h3>

          <div className="space-y-4">
            {scenarios.map(sc => (
              <div 
                key={sc.id}
                className={`bg-slate-950 border rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                  activeScenario === sc.id ? 'border-hospital-500 bg-hospital-950/10' : 'border-slate-850'
                }`}
              >
                <div className="space-y-1.5 max-w-xl">
                  <h4 className="font-bold text-sm text-white">{sc.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{sc.desc}</p>
                </div>

                <button
                  onClick={() => handleTriggerScenario(sc.id as any)}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-hospital-400 hover:text-hospital-300 disabled:opacity-50 font-semibold text-xs rounded-lg transition-all flex items-center gap-2 shrink-0 self-end md:self-auto"
                >
                  <Play size={12} className="fill-hospital-400" />
                  Trigger
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
