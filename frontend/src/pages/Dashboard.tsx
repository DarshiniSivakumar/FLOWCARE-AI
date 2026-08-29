import React, { useState } from 'react';
import { useApp } from '../App';
import { api } from '../services/api';
import { 
  Users, Activity, ClipboardCheck, Timer, 
  CheckCircle2, ArrowRight, ShieldAlert, Zap,
  Stethoscope, PackageCheck, HeartPulse
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserRole } from '../types';

export default function Dashboard() {
  const { liveState, recommendations, setRecommendations, triggerReload, user, setUser } = useApp();
  const [loading, setLoading] = useState(false);
  const [activeRoleFilter, setActiveRoleFilter] = useState<UserRole>(user?.role || 'ADMIN');

  const currentRole = activeRoleFilter;

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

  const handleRoleSwitch = (role: UserRole) => {
    setActiveRoleFilter(role);
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      localStorage.setItem('flowcare_user', JSON.stringify(updatedUser));
    }
  };

  const rolesList: { role: UserRole; label: string; icon: any }[] = [
    { role: 'ADMIN', label: 'System Admin', icon: ShieldAlert },
    { role: 'OT_MANAGER', label: 'OT Manager', icon: Activity },
    { role: 'NURSE', label: 'Ward Nurse', icon: HeartPulse },
    { role: 'CSSD_STAFF', label: 'CSSD Tech', icon: PackageCheck },
    { role: 'DOCTOR', label: 'Surgeon', icon: Stethoscope },
  ];

  return (
    <div className="space-y-8">
      {/* Top Header & Role Selector Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="bg-hospital-100 text-hospital-600 p-2.5 rounded-xl border border-hospital-200">
              {currentRole === 'ADMIN' && <ShieldAlert size={22} />}
              {currentRole === 'OT_MANAGER' && <Activity size={22} />}
              {currentRole === 'NURSE' && <HeartPulse size={22} />}
              {currentRole === 'CSSD_STAFF' && <PackageCheck size={22} />}
              {currentRole === 'DOCTOR' && <Stethoscope size={22} />}
            </span>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {currentRole === 'ADMIN' && 'System Administrator Command Center'}
                {currentRole === 'OT_MANAGER' && 'OT Operations Manager Dashboard'}
                {currentRole === 'NURSE' && 'Surgical Ward & Prep Nurse Dashboard'}
                {currentRole === 'CSSD_STAFF' && 'CSSD Central Sterile Supplies Dashboard'}
                {currentRole === 'DOCTOR' && 'Surgeon Clinical Schedule Dashboard'}
              </h2>
              <p className="text-sm text-slate-500">
                Tailored operational view for role: <span className="font-mono text-hospital-600 font-semibold uppercase">{currentRole}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Role Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {rolesList.map(r => {
            const Icon = r.icon;
            const isActive = currentRole === r.role;
            return (
              <button
                key={r.role}
                onClick={() => handleRoleSwitch(r.role)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive 
                    ? 'bg-hospital-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <Icon size={14} />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDER ROLE-SPECIFIC DASHBOARD VIEW */}

      {/* 1. ADMIN DASHBOARD */}
      {currentRole === 'ADMIN' && (
        <div className="space-y-8">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-500">Total Patients</span>
                <p className="text-3xl font-bold text-slate-900 mt-1">{liveState?.total_patients_count ?? 0}</p>
              </div>
              <div className="p-4 rounded-xl text-blue-600 bg-blue-50 border border-blue-100"><Users size={24} /></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-500">Active Procedures</span>
                <p className="text-3xl font-bold text-slate-900 mt-1">{liveState?.active_surgeries_count ?? 0}</p>
              </div>
              <div className="p-4 rounded-xl text-emerald-600 bg-emerald-50 border border-emerald-100"><Activity size={24} /></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-500">OT Utilization</span>
                <p className="text-3xl font-bold text-slate-900 mt-1">{liveState?.ot_utilization ?? 0}%</p>
              </div>
              <div className="p-4 rounded-xl text-purple-600 bg-purple-50 border border-purple-100"><ClipboardCheck size={24} /></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-500">Sterile Packs</span>
                <p className="text-3xl font-bold text-slate-900 mt-1">{liveState?.available_packs_count ?? 0}</p>
              </div>
              <div className="p-4 rounded-xl text-amber-600 bg-amber-50 border border-amber-100"><Timer size={24} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* OT Live Overview */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    <Activity className="text-hospital-600" size={20} />
                    Operating Theatre Suite Status
                  </h3>
                  <Link to="/ot" className="text-xs font-bold text-hospital-600 hover:underline">Manage All OTs</Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveState?.ots?.map((ot: any) => (
                    <div key={ot.name} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{ot.name}</h4>
                        <p className="text-xs text-slate-500 font-mono">Utilization: {ot.utilization}%</p>
                        {ot.current_surgery && (
                          <span className="text-xs text-hospital-600 font-semibold block mt-1">Proc: {ot.current_surgery}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-200 text-slate-700">
                        {ot.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Recommendations */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Zap className="text-amber-500 fill-amber-500/20" size={20} />
                  AI Operational System Recommendations
                </h3>
                {recommendations.map(rec => (
                  <div key={rec.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center gap-4">
                    <div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-800 border border-amber-200">
                        {rec.priority} Priority
                      </span>
                      <p className="text-xs text-slate-800 mt-1 font-medium">{rec.message}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleRecommendation(rec.id, 'ACCEPT')} className="px-3 py-1.5 bg-hospital-600 hover:bg-hospital-700 text-white font-semibold text-xs rounded-lg shadow-sm">
                        Accept
                      </button>
                      <button onClick={() => handleRecommendation(rec.id, 'DISMISS')} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg">
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Alerts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <ShieldAlert className="text-rose-600" size={20} />
                Critical System Alerts
              </h3>
              <div className="space-y-3">
                {liveState?.critical_alerts?.map((alert: any) => (
                  <div key={alert.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 border-l-4 border-l-rose-500">
                    <p className="text-xs font-bold text-slate-900">{alert.title}</p>
                    <p className="text-[11px] text-slate-600 mt-1">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. OT MANAGER DASHBOARD */}
      {currentRole === 'OT_MANAGER' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Active OT Utilization</span>
              <p className="text-3xl font-bold text-slate-900 mt-1">{liveState?.ot_utilization ?? 0}%</p>
              <p className="text-xs text-emerald-600 font-semibold mt-2">Target range: 75% - 85%</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Scheduled Procedures Today</span>
              <p className="text-3xl font-bold text-slate-900 mt-1">{liveState?.active_surgeries_count ?? 0} Cases</p>
              <p className="text-xs text-blue-600 font-semibold mt-2">OT Block Schedule Synchronized</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Pending OT Reassignments</span>
              <p className="text-3xl font-bold text-amber-600 mt-1">{recommendations.length} Suggestions</p>
              <p className="text-xs text-amber-600 font-semibold mt-2">Action needed to prevent delays</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Activity className="text-hospital-600" size={20} />
                Operating Theatre Turnaround & Schedule Controller
              </h3>
              <Link to="/ot" className="px-3 py-1.5 bg-hospital-600 hover:bg-hospital-700 text-white rounded-lg text-xs font-semibold shadow-sm">
                Open OT Block Manager
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {liveState?.ots?.map((ot: any) => (
                <div key={ot.name} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-base">{ot.name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      ot.status === 'SURGERY' ? 'bg-pink-100 text-pink-700 border border-pink-200' :
                      ot.status === 'CLEANING' ? 'bg-teal-100 text-teal-700 border border-teal-200' :
                      ot.status === 'DELAYED' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                      'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      {ot.status}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase block font-mono">Current Surgery</span>
                    <p className="text-xs font-bold text-slate-800 truncate">{ot.current_surgery || 'Vacant / Ready'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. WARD NURSE DASHBOARD */}
      {currentRole === 'NURSE' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Patients in Ward Prep</span>
              <p className="text-3xl font-bold text-slate-900 mt-1">{liveState?.total_patients_count ?? 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Readiness Score Avg</span>
              <p className="text-3xl font-bold text-emerald-600 mt-1">84.2%</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Transfers Pending</span>
              <p className="text-3xl font-bold text-amber-600 mt-1">2 Moving</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <HeartPulse className="text-pink-600" size={20} />
                Patient Pre-Op Prep Checklist & Readiness Roster
              </h3>
              <Link to="/patients" className="px-3 py-1.5 bg-hospital-600 text-white rounded-lg text-xs font-semibold shadow-sm">
                View Full Patient Roster
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900">Patient Consent</span>
                  <CheckCircle2 size={16} className="text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-600">Electronic consent forms verified for 92% of scheduled cases.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900">Lab & Vitals Clearance</span>
                  <CheckCircle2 size={16} className="text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-600">Pre-op blood work and ECG cleared by attending nurse.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900">Corridor Porter Transfer</span>
                  <ArrowRight size={16} className="text-amber-600" />
                </div>
                <p className="text-[11px] text-slate-600">Porter assigned to move P102 to OT Block 2.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CSSD STAFF DASHBOARD */}
      {currentRole === 'CSSD_STAFF' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Available Sterile Packs</span>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{liveState?.available_packs_count ?? 12}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Active Autoclaves</span>
              <p className="text-3xl font-bold text-hospital-600 mt-1">3 Running</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Decontamination Queue</span>
              <p className="text-3xl font-bold text-amber-600 mt-1">4 Trays</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">CSSD Shortage Risk</span>
              <p className="text-3xl font-bold text-emerald-600 mt-1">Low (0%)</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <PackageCheck className="text-amber-600" size={20} />
                Sterile Supply Chain & Autoclaves Monitor
              </h3>
              <Link to="/cssd" className="px-3 py-1.5 bg-hospital-600 text-white rounded-lg text-xs font-semibold shadow-sm">
                Open CSSD Inventory
              </Link>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <p className="text-xs text-slate-700 font-semibold">High-Demand Surgical Packs Required Next 2 Hours:</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-white border border-slate-300 px-3 py-1 rounded-lg text-slate-800 shadow-xs">Laparoscopic Pack (4)</span>
                <span className="text-xs bg-white border border-slate-300 px-3 py-1 rounded-lg text-slate-800 shadow-xs">General Surgery Pack (6)</span>
                <span className="text-xs bg-white border border-slate-300 px-3 py-1 rounded-lg text-slate-800 shadow-xs">Orthopedic Instrument Set (2)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SURGEON DASHBOARD */}
      {currentRole === 'DOCTOR' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Assigned Surgeries Today</span>
              <p className="text-3xl font-bold text-slate-900 mt-1">3 Cases</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Next Surgery Start</span>
              <p className="text-3xl font-bold text-emerald-600 mt-1">10:30 AM</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Assigned OT Block</span>
              <p className="text-3xl font-bold text-hospital-600 mt-1">OT-02</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Stethoscope className="text-emerald-600" size={20} />
              Surgeon Surgical Roster & Case Readiness
            </h3>
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Case #S104 - Laparoscopic Cholecystectomy</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Patient: Alice Smith (P101) • Assigned: OT-02</p>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 px-3 py-1 rounded-lg font-bold">
                  Patient 85% Ready
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
