import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { Timer, AlertTriangle, Layers, Percent } from 'lucide-react';

export default function Analytics() {
  const [otAnalytics, setOtAnalytics] = useState<any>(null);
  const [delayAnalytics, setDelayAnalytics] = useState<any>(null);
  const [cssdAnalytics, setCssdAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const ot = await api.getOtUtilizationAnalytics();
        setOtAnalytics(ot);
        const delays = await api.getDelayAnalytics();
        setDelayAnalytics(delays);
        const cssd = await api.getCssdAnalytics();
        setCssdAnalytics(cssd);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const COLORS = ['#2563eb', '#16a34a', '#9333ea', '#d97706', '#e11d48'];

  const stats = [
    { name: 'Average Delay Minutes', value: '22.4 min', icon: Timer, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    { name: 'Target Turnaround Time', value: '15 min', icon: Percent, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
    { name: 'Total System Bottlenecks', value: '5 Detected', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
    { name: 'Sterile Pack Compliance', value: '98.5%', icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' }
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 leading-tight">Operational Performance Analytics</h2>
        <p className="text-sm text-slate-500 mt-1">Review historical delay causes, predicted vs actual variances, and resource utilizations</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">{stat.name}</span>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl border ${stat.bg} ${stat.color}`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: Delay Contributions (horizontal bar) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Operational Delay Contribution By Department</h3>
            <p className="text-xs text-slate-500 mt-0.5">Highlights recurring bottlenecks compounding surgery schedules.</p>
          </div>
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={delayAnalytics?.delay_contributions || []}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} unit="%" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 8 }}
                  labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                  itemStyle={{ color: '#2563eb' }}
                />
                <Bar dataKey="percentage" fill="#2563eb" radius={[0, 4, 4, 0]}>
                  {delayAnalytics?.delay_contributions?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: OT Utilization Trends */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Operating Theatre Utilization Trend</h3>
            <p className="text-xs text-slate-500 mt-0.5">Weekly utilization metrics tracked per Operating Room.</p>
          </div>
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={otAnalytics?.trends || []}
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 8 }}
                  labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="OT-01" stroke="#2563eb" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="OT-02" stroke="#16a34a" strokeWidth={2.5} />
                <Line type="monotone" dataKey="OT-03" stroke="#9333ea" strokeWidth={2.5} />
                <Line type="monotone" dataKey="OT-04" stroke="#d97706" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Predicted vs Actual Delay */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-2">
          <div>
            <h3 className="font-bold text-base text-slate-900">AI Predicted vs. Actual Delay Variance</h3>
            <p className="text-xs text-slate-500 mt-0.5">Compares ML prediction outcomes against actual registered delay times.</p>
          </div>
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={delayAnalytics?.predicted_vs_actual || []}
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="case" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} unit=" min" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 8 }}
                  labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="predicted" name="Predicted delay" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual delay" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
