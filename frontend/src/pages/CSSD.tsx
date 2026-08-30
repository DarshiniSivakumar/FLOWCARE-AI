import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../App';
import { Package, ShieldAlert, PackageCheck, AlertCircle, PlusCircle } from 'lucide-react';
import { InstrumentPack } from '../types';

export default function CSSD() {
  const { liveState, triggerReload } = useApp();
  const [packs, setPacks] = useState<InstrumentPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPackType, setNewPackType] = useState('General Surgery Set');

  useEffect(() => {
    const fetchPacks = async () => {
      setLoading(true);
      try {
        const list = await api.getCssd();
        setPacks(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPacks();
  }, [liveState]);

  const handleCreatePack = async () => {
    try {
      await api.createCssdPack({
        pack_type: newPackType,
        sterilization_status: 'STERILE',
        sterilized_at: new Date().toISOString(),
        expiry_at: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
        availability: true,
      });
      triggerReload();
    } catch (e) {
      console.error(e);
    }
  };

  // Group status
  const sterilePacks = packs.filter(p => p.sterilization_status === 'STERILE');
  const sterilizingPacks = packs.filter(p => p.sterilization_status === 'STERILIZING');
  const cleaningPacks = packs.filter(p => p.sterilization_status === 'CLEANING');
  const expiredPacks = packs.filter(p => p.sterilization_status === 'EXPIRED');

  // Upcoming Demand Dashboard
  const demands = [
    { type: 'Laparoscopic Set', required: 6, available: 4, status: 'Shortage (2)' },
    { type: 'General Surgery Set', required: 8, available: 12, status: 'Sufficient' },
    { type: 'Orthopedic Set', required: 3, available: 4, status: 'Sufficient' },
    { type: 'Cardiac Set', required: 2, available: 3, status: 'Sufficient' },
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 leading-tight">CSSD Instrument Supply Chain</h2>
        <p className="text-sm text-slate-500 mt-1">Sterilization logs, pack tracking, and upcoming surgery demand warnings</p>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Sterile Ready</span>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{sterilePacks.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Sterilizing</span>
          <p className="text-3xl font-bold text-blue-600 mt-1">{sterilizingPacks.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Cleaning</span>
          <p className="text-3xl font-bold text-amber-600 mt-1">{cleaningPacks.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Expired</span>
          <p className="text-3xl font-bold text-rose-600 mt-1">{expiredPacks.length}</p>
        </div>
      </div>

      {/* Demand & Shortage Warnings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <ShieldAlert className="text-amber-500" size={18} />
          Logistical Instrument Demand & Status (Next 24h)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {demands.map(d => {
            const hasShortage = d.available < d.required;
            return (
              <div
                key={d.type}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-3 ${
                  hasShortage
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{d.type}</h4>
                  <span className={`text-[9px] font-bold uppercase mt-1 inline-block ${hasShortage ? 'text-amber-600' : 'text-emerald-600'}`}>
                    ● {d.status}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
                  <span>Required: {d.required}</span>
                  <span className={`font-bold ${hasShortage ? 'text-amber-700' : 'text-emerald-700'}`}>
                    Available: {d.available}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {demands.some(d => d.available < d.required) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-900">⚠️ Sterilizer Demand Warning</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Tomorrow's surgeries require additional Laparoscopic Sets. Sterilization cycles must be completed before 07:30 to avoid scheduled delay risks.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions: Add Instrument Pack */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-slate-900">Register Sterile Pack</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <select
            value={newPackType}
            onChange={e => setNewPackType(e.target.value)}
            className="w-full sm:max-w-xs bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs text-slate-700 outline-none focus:border-hospital-500 transition-all"
          >
            <option value="General Surgery Set">General Surgery Set</option>
            <option value="Laparoscopic Set">Laparoscopic Set</option>
            <option value="Cardiac Set">Cardiac Set</option>
            <option value="Orthopedic Set">Orthopedic Set</option>
          </select>
          <button
            onClick={handleCreatePack}
            className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-5 bg-hospital-600 hover:bg-hospital-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-sm"
          >
            <PlusCircle size={16} />
            Register Pack
          </button>
        </div>
      </div>

      {/* Grid List of tracked packs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-slate-200 pb-4">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Package className="text-hospital-600" size={18} />
            Sterile Supplies Inventory
          </h3>
          <span className="text-xs text-slate-500 font-mono">Total tracked: {packs.length} packs</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <p className="text-slate-500 text-sm text-center col-span-full py-12">Synchronizing supplies...</p>
          ) : packs.length === 0 ? (
            <p className="text-slate-500 text-sm text-center col-span-full py-12 italic">No packs recorded.</p>
          ) : (
            packs.map(p => (
              <div
                key={p.id}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-3 ${
                  p.sterilization_status === 'EXPIRED'
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{p.pack_type}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">ID: CS{p.id}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${
                    p.sterilization_status === 'STERILE'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : p.sterilization_status === 'EXPIRED'
                      ? 'bg-rose-100 text-rose-700 border-rose-300'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}>
                    {p.sterilization_status}
                  </span>
                </div>

                <div className="space-y-1 mt-2">
                  {p.sterilized_at && (
                    <p className="text-[10px] text-slate-500">
                      Sterilized: {new Date(p.sterilized_at).toLocaleDateString()}
                    </p>
                  )}
                  {p.expiry_at && (
                    <p className="text-[10px] text-slate-500">
                      Expires: {new Date(p.expiry_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
