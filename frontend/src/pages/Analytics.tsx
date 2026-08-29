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

  const COLORS = ['#38a9f8', '#22c55e', '#a855f7', '#f59e0b', '#f43f5e'];

  const stats = [
    { name: 'Average delay minutes', value: '22.4 min', icon: Timer, color: 'text-amber-400' },
    { name: 'Target Turnaround Time', value: '15 min', icon: Percent, color: 'text-emerald-400' },
    { name: 'Total System Bottlenecks', value: '5 Detected', icon: AlertTriangle, color: 'text-rose-400' },
    { name: 'Sterile Pack Compliance', value: '98.5%', icon: Layers, color: 'text-blue-400' }
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white leading-tight">Operational Performance Analytics</h2>
        <p className="text-sm text-slate-400">Review historical delay causes, predicted vs actual variances, and resource utilizations</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{stat.name}</span>
                <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl bg-slate-950 ${stat.color}`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: Delay Contributions Heatmap (represented as a Bar Chart) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <h3 className="font-bold text-base text-white">Operational Delay Contribution By Department</h3>
          <p className="text-xs text-slate-400">Highlights recurring bottlenecks compounding surgery schedules.</p>
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={delayAnalytics?.delay_contributions || []}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} unit="%" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#38a9f8' }}
                />
                <Bar dataKey="percentage" fill="#0e8de3" radius={[0, 4, 4, 0]}>
                  {delayAnalytics?.delay_contributions?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: OT Utilization Trends over the Week */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <h3 className="font-bold text-base text-white">Operating Theatre Utilization Trend</h3>
          <p className="text-xs text-slate-400">Weekly utilization metrics tracked per Operating Room.</p>
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={otAnalytics?.trends || []}
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="OT-01" stroke="#38a9f8" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="OT-02" stroke="#22c55e" strokeWidth={2.5} />
                <Line type="monotone" dataKey="OT-03" stroke="#a855f7" strokeWidth={2.5} />
                <Line type="monotone" dataKey="OT-04" stroke="#f59e0b" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Predicted vs Actual Delay minutes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4 lg:col-span-2">
          <h3 className="font-bold text-base text-white">AI Predicted vs. Actual Delay Variance</h3>
          <p className="text-xs text-slate-400">Compares ML prediction outcomes against actual registered delay times.</p>
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={delayAnalytics?.predicted_vs_actual || []}
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="case" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} unit=" min" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="predicted" name="Predicted delay" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual delay" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
