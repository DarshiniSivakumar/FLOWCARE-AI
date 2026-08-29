import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Search, Filter, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Patient, Surgery } from '../types';

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('ALL');
  const [filterUrgency, setFilterUrgency] = useState('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
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
    loadData();
  }, []);

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.patient_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLocation = filterLocation === 'ALL' || p.current_location === filterLocation;
    const matchesUrgency = filterUrgency === 'ALL' || p.urgency_level === filterUrgency;

    return matchesSearch && matchesLocation && matchesUrgency;
  });

  const getUrgencyBadge = (urgency: string) => {
    if (urgency === 'CRITICAL') return 'bg-rose-100 text-rose-700 border border-rose-300';
    if (urgency === 'HIGH') return 'bg-amber-100 text-amber-800 border border-amber-300';
    return 'bg-blue-100 text-blue-700 border border-blue-300';
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">Patient Directory</h2>
          <p className="text-sm text-slate-500">View and manage clinical workflows, locations, and readiness states</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-3 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-hospital-500 transition-all shadow-xs"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <select
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-700 outline-none shadow-xs"
            >
              <option value="ALL">All Locations</option>
              <option value="Ward">Ward</option>
              <option value="Transfer">Transfer</option>
              <option value="OT Block">OT Block</option>
              <option value="Recovery">Recovery</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>

          <select
            value={filterUrgency}
            onChange={e => setFilterUrgency(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-700 outline-none shadow-xs"
          >
            <option value="ALL">All Urgency Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Grid of Patients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-slate-500 text-sm text-center col-span-full py-12">Fetching patient list...</p>
        ) : filteredPatients.length === 0 ? (
          <p className="text-slate-500 text-sm text-center col-span-full py-12 italic">No patients matched search criteria.</p>
        ) : (
          filteredPatients.map(p => {
            const activeSurg = surgeries.find(s => s.patient_id === p.id && s.status !== 'COMPLETED');
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-6 shadow-sm">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-tight">{p.name}</h3>
                      <span className="text-[10px] text-slate-500 font-mono">Code: {p.patient_code} | Age: {p.age}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${getUrgencyBadge(p.urgency_level)}`}>
                      {p.urgency_level}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Location</span>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">{p.current_location}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Scheduled Case</span>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">{activeSurg?.surgery_type ?? 'No active case'}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600">Workflow Readiness</span>
                      <span className={`font-mono font-bold ${p.readiness_score >= 80 ? 'text-emerald-600' : p.readiness_score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {p.readiness_score}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${p.readiness_score >= 80 ? 'bg-emerald-500' : p.readiness_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${p.readiness_score}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <Link
                    to={`/patients/${p.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-hospital-600 hover:text-hospital-700 transition-all border border-slate-200 shadow-xs"
                  >
                    View Workflow Timeline
                    <ArrowRight size={14} />
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
