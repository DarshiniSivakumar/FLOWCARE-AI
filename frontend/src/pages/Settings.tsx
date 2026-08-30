import React, { useState } from 'react';
import { api, MOCK_OTS, MOCK_PATIENTS, MOCK_SURGERIES, MOCK_NOTIFICATIONS, MOCK_RECOMMENDATIONS } from '../services/api';
import { useApp } from '../App';
import { Database, Play, RefreshCw, Layers, FlaskConical, CheckCircle2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Scenario mock state payloads — what each scenario changes in the Digital Twin
// ---------------------------------------------------------------------------

const SCENARIO_STATES: Record<string, any> = {
  A: {
    ots: [
      { id: 1, name: 'OT-01', status: 'SURGERY', current_surgery: 'General Surgery Set', utilization: 82.0 },
      { id: 2, name: 'OT-02', status: 'AVAILABLE', current_surgery: null, utilization: 65.0 },
      { id: 3, name: 'OT-03', status: 'CLEANING', current_surgery: null, utilization: 55.0 },
      { id: 4, name: 'OT-04', status: 'AVAILABLE', current_surgery: null, utilization: 48.0 },
    ],
    active_surgeries_count: 1,
    total_patients_count: 6,
    available_packs_count: 8,
    ot_utilization: 75.2,
    critical_alerts: [],
    recommendations: [],
  },
  B: {
    ots: [
      { id: 1, name: 'OT-01', status: 'AVAILABLE', current_surgery: null, utilization: 70.0 },
      { id: 2, name: 'OT-02', status: 'DELAYED', current_surgery: 'Cardiac Bypass', utilization: 84.2 },
      { id: 3, name: 'OT-03', status: 'SURGERY', current_surgery: 'Emergency Trauma Repair', utilization: 91.0 },
      { id: 4, name: 'OT-04', status: 'CLEANING', current_surgery: null, utilization: 62.0 },
    ],
    active_surgeries_count: 3,
    total_patients_count: 6,
    available_packs_count: 5,
    ot_utilization: 78.9,
    critical_alerts: [
      { id: 10, title: 'OT-02 Anaesthesia Delay', message: 'Jane Smith (OT-02) — Anaesthesia has not been confirmed. Surgery start is blocked.', severity: 'CRITICAL', read_status: false },
      { id: 11, title: 'OT Reassignment Recommended', message: 'Consider moving Cardiac Bypass to OT-01 to prevent cascading delays.', severity: 'WARNING', read_status: false },
    ],
    recommendations: [
      { id: 20, surgery_id: 102, recommendation_type: 'REASSIGN_OT', message: 'Move Cardiac Bypass (Jane Smith) from blocked OT-02 to available OT-01 to save 35 mins.', priority: 'HIGH', status: 'PENDING', surgery_type: 'Cardiac Bypass', patient_code: 'P102' },
    ],
  },
  C: {
    ots: [
      { id: 1, name: 'OT-01', status: 'SURGERY', current_surgery: 'Laparoscopic Cholecystectomy', utilization: 78.5 },
      { id: 2, name: 'OT-02', status: 'AVAILABLE', current_surgery: null, utilization: 55.0 },
      { id: 3, name: 'OT-03', status: 'DELAYED', current_surgery: 'Laparoscopic Appendectomy', utilization: 91.0 },
      { id: 4, name: 'OT-04', status: 'CLEANING', current_surgery: null, utilization: 60.0 },
    ],
    active_surgeries_count: 2,
    total_patients_count: 6,
    available_packs_count: 1,
    ot_utilization: 72.1,
    critical_alerts: [
      { id: 12, title: 'CSSD Shortage — Laparoscopic Set', message: 'All Laparoscopic Sets are in sterilizing/cleaning status. OT-03 surgery start is blocked.', severity: 'CRITICAL', read_status: false },
      { id: 13, title: 'Autoclave Cycle Needed', message: 'Start emergency autoclave cycle for Laparoscopic Set immediately. ETA: 45 min.', severity: 'WARNING', read_status: false },
    ],
    recommendations: [
      { id: 21, surgery_id: 103, recommendation_type: 'START_AUTOCLAVE', message: 'Immediately start autoclave cycle for Laparoscopic Set to unblock OT-03 surgery.', priority: 'HIGH', status: 'PENDING', surgery_type: 'Laparoscopic Appendectomy', patient_code: 'P103' },
    ],
  },
  D: {
    ots: [
      { id: 1, name: 'OT-01', status: 'DELAYED', current_surgery: 'Coronary Bypass (Emergency)', utilization: 95.0 },
      { id: 2, name: 'OT-02', status: 'DELAYED', current_surgery: 'Liver Resection (Cancer)', utilization: 88.0 },
      { id: 3, name: 'OT-03', status: 'DELAYED', current_surgery: 'Total Knee Replacement', utilization: 91.0 },
      { id: 4, name: 'OT-04', status: 'DELAYED', current_surgery: 'Hernia Repair', utilization: 75.0 },
    ],
    active_surgeries_count: 5,
    total_patients_count: 6,
    available_packs_count: 0,
    ot_utilization: 94.6,
    critical_alerts: [
      { id: 20, title: '🚨 EMERGENCY — OT-01 Anaesthesia Blocked', message: 'Coronary Bypass patient (P107) — Anaesthesia team unavailable. Critical cardiac patient waiting.', severity: 'CRITICAL', read_status: false },
      { id: 21, title: '🔴 OT-02 Room Conflict', message: 'Liver Resection (P108) OT-02 double-booked. Conflict with instrument team schedule.', severity: 'CRITICAL', read_status: false },
      { id: 22, title: '⚠️ OT-03 Transfer Delay', message: 'Total Knee Replacement (P109) patient stuck in transfer corridor for 22 minutes.', severity: 'WARNING', read_status: false },
      { id: 23, title: '⚠️ OT-04 CSSD Shortage', message: 'Hernia Repair (P110) — General Surgery Set pack exhausted. Autoclave not started.', severity: 'WARNING', read_status: false },
    ],
    recommendations: [
      { id: 30, surgery_id: 101, recommendation_type: 'ESCALATE_ANAESTHESIA', message: 'Escalate OT-01 Coronary Bypass anaesthesia availability to senior on-call immediately. Priority: CRITICAL.', priority: 'CRITICAL', status: 'PENDING', surgery_type: 'Coronary Bypass', patient_code: 'P107' },
      { id: 31, surgery_id: 102, recommendation_type: 'REASSIGN_OT', message: 'Reassign Liver Resection to OT-03 slot after Knee Replacement completes (~2h). Accept delay vs risk.', priority: 'HIGH', status: 'PENDING', surgery_type: 'Liver Resection', patient_code: 'P108' },
      { id: 32, surgery_id: 103, recommendation_type: 'DISPATCH_PORTER', message: 'Dispatch second porter immediately for OT-03 transfer. Patient P109 has been waiting 22 min.', priority: 'HIGH', status: 'PENDING', surgery_type: 'Knee Replacement', patient_code: 'P109' },
      { id: 33, surgery_id: 104, recommendation_type: 'START_AUTOCLAVE', message: 'Start General Surgery Set autoclave cycle now. OT-04 Hernia Repair can begin in 40 min if cycle starts immediately.', priority: 'MEDIUM', status: 'PENDING', surgery_type: 'Hernia Repair', patient_code: 'P110' },
    ],
  },
};

export default function Settings() {
  const { triggerReload, setLiveState, setNotifications, setRecommendations } = useApp();
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [toast, setToast] = useState<{ scenario: string; msg: string } | null>(null);

  const showToast = (scenario: string, msg: string) => {
    setToast({ scenario, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleResetDb = async () => {
    setLoading(true);
    try {
      await api.resetDb();
    } catch (_) { /* backend offline — apply reset locally */ }

    // Reset to base mock state locally
    setLiveState({
      ots: MOCK_OTS,
      active_surgeries_count: MOCK_SURGERIES.filter(s => s.status !== 'COMPLETED').length,
      total_patients_count: MOCK_PATIENTS.length,
      available_packs_count: 4,
      ot_utilization: 78.9,
      critical_alerts: MOCK_NOTIFICATIONS,
      recommendations: MOCK_RECOMMENDATIONS,
    });
    setNotifications(MOCK_NOTIFICATIONS as any);
    setRecommendations(MOCK_RECOMMENDATIONS as any);
    setActiveScenario(null);
    triggerReload();
    setLoading(false);
    showToast('RESET', 'Database reset to initial seed state.');
  };

  const handleTriggerScenario = async (scenario: 'A' | 'B' | 'C' | 'D') => {
    setLoading(true);
    try {
      await api.triggerScenario(scenario);
    } catch (_) { /* backend offline — apply scenario locally */ }

    // Apply scenario state directly to the Digital Twin
    const state = SCENARIO_STATES[scenario];
    setLiveState(state);
    setNotifications(state.critical_alerts);
    setRecommendations(state.recommendations);
    setActiveScenario(scenario);
    triggerReload();
    setLoading(false);
    showToast(scenario, `Scenario ${scenario} applied — check Command Center & Digital Twin.`);
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
    },
  ];

  const colorMap: Record<string, { badge: string; active: string }> = {
    emerald: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', active: 'border-emerald-400 bg-emerald-50' },
    amber:   { badge: 'bg-amber-100 text-amber-700 border-amber-200',   active: 'border-amber-400 bg-amber-50'   },
    orange:  { badge: 'bg-orange-100 text-orange-700 border-orange-200', active: 'border-orange-400 bg-orange-50' },
    rose:    { badge: 'bg-rose-100 text-rose-700 border-rose-200',       active: 'border-rose-400 bg-rose-50'     },
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl animate-bounce-in">
          <CheckCircle2 size={18} />
          <span className="text-sm font-semibold">{toast.msg}</span>
        </div>
      )}

      {/* Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-hospital-100 text-hospital-600 p-2.5 rounded-xl border border-hospital-200">
            <FlaskConical size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">Developer Control Panel & Simulator</h2>
            <p className="text-sm text-slate-500">Trigger simulated clinical scenarios — instantly updates Command Center & Digital Twin</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Database Reset Card */}
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

        {/* Scenarios Grid */}
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
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-hospital-100 text-hospital-700 border border-hospital-200 uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-hospital-500 animate-pulse inline-block" />
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
                    className="px-5 py-2.5 bg-hospital-600 hover:bg-hospital-700 border border-hospital-700 text-white disabled:opacity-50 font-semibold text-xs rounded-lg transition-all flex items-center gap-2 shrink-0 self-end md:self-auto shadow-sm active:scale-[0.98]"
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
