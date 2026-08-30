import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  BrainCircuit, FlaskConical, CheckCircle2, XCircle, TrendingUp,
  Zap, BarChart3, Target, RefreshCw, Activity
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FeatureImportance { feature: string; importance: number; }
interface RiskDist { risk: string; count: number; }
interface SamplePred {
  actual_delay: number; predicted_delay: number;
  actual_risk: string; predicted_risk: string; correct: boolean; error: number;
}
interface EvalData {
  model_type: string; n_estimators: number; max_depth: number;
  training_samples: number; test_samples: number; total_samples: number;
  train_r2: number; test_r2: number; mae: number; rmse: number;
  risk_classification_accuracy: number;
  feature_importances: FeatureImportance[];
  risk_distribution: RiskDist[];
  sample_predictions: SamplePred[];
  features: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#ea580c', CRITICAL: '#dc2626'
};
const RISK_BG: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  CRITICAL: 'bg-rose-100 text-rose-800 border-rose-300',
};
const TRACK_COLORS: Record<string, string> = {
  indigo: '#6366f1', violet: '#8b5cf6', rose: '#f43f5e',
  emerald: '#22c55e', amber: '#f59e0b', orange: '#f97316'
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${RISK_BG[risk] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
      {risk}
    </span>
  );
}

function SliderInput({ label, min, max, step, value, onChange, format, color = 'indigo' }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; format: (v: number) => string; color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-xs font-semibold text-slate-600">{label}</label>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
          style={{ color: TRACK_COLORS[color], background: TRACK_COLORS[color] + '18', borderColor: TRACK_COLORS[color] + '55' }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${TRACK_COLORS[color]} ${pct}%, #e2e8f0 ${pct}%)` }}
      />
    </div>
  );
}

// ─── Demo Default Inputs ───────────────────────────────────────────────────────
const DEFAULT_INPUTS = {
  surgery_type: 'General', scheduled_hour: 10, expected_duration: 60,
  ot_utilization: 65, anaesthesia_ready: true, patient_ready_score: 0.85,
  cssd_ready: true, transfer_delay: 0, previous_workflow_delays: 5, surgeon_available: true,
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MLModel() {
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>(DEFAULT_INPUTS);
  const [prediction, setPrediction] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);
  const [predShown, setPredShown] = useState(false);

  const fetchEval = useCallback(async () => {
    setLoading(true);
    try { setEvalData(await api.getMlEvaluation()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEval(); }, [fetchEval]);

  const handleRetrain = async () => {
    setRetraining(true);
    try { await fetchEval(); } finally { setRetraining(false); }
  };

  const handlePredict = async () => {
    setPredicting(true); setPredShown(false);
    try {
      const res = await api.predictDemo(inputs);
      setPrediction(res);
      setTimeout(() => setPredShown(true), 80);
    } finally { setPredicting(false); }
  };

  const setInput = (key: string, val: any) => setInputs(prev => ({ ...prev, [key]: val }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw size={28} className="text-indigo-500 animate-spin" />
        <p className="text-slate-600 text-sm font-medium">Loading model evaluation…</p>
      </div>
    </div>
  );

  const d = evalData!;
  const maxImp = Math.max(...d.feature_importances.map(f => f.importance));

  // determine active delay drivers
  const delayDrivers = [
    { label: 'Anaesthesia Not Ready', active: !inputs.anaesthesia_ready, value: '+~25 min', col: '#dc2626' },
    { label: 'CSSD Pack Not Ready', active: !inputs.cssd_ready, value: '+~32 min', col: '#ea580c' },
    { label: 'Surgeon Unavailable', active: !inputs.surgeon_available, value: '+~45 min', col: '#dc2626' },
    { label: 'High OT Utilization (>80%)', active: inputs.ot_utilization > 80, value: '+~14 min', col: '#d97706' },
    { label: 'Patient Readiness < 50%', active: inputs.patient_ready_score < 0.5, value: '+~15 min', col: '#d97706' },
    { label: `Transfer Delay: ${inputs.transfer_delay}min`, active: inputs.transfer_delay > 0, value: `+${Math.round(inputs.transfer_delay * 1.2)} min`, col: '#d97706' },
  ].filter(x => x.active);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-7 shadow-lg text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="bg-white/15 backdrop-blur-sm p-3.5 rounded-xl border border-white/20">
              <BrainCircuit size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">Random Forest Delay Prediction Model</h2>
              <p className="text-indigo-200 text-sm mt-0.5">
                Trained on 1,500 synthetic hospital workflow records · 10 clinical features · Real-time inference
              </p>
            </div>
          </div>
          <button onClick={handleRetrain} disabled={retraining}
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all">
            <RefreshCw size={15} className={retraining ? 'animate-spin' : ''} />
            {retraining ? 'Retraining…' : 'Retrain Model'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          {[
            `🌲 ${d.n_estimators} Decision Trees`,
            `📏 Max Depth: ${d.max_depth}`,
            `📊 ${d.total_samples.toLocaleString()} Training Records`,
            `🎯 80/20 Train-Test Split`,
            `⚙️ sklearn RandomForestRegressor`,
            `🔧 StandardScaler Normalisation`,
          ].map(label => (
            <span key={label} className="text-xs font-semibold px-3 py-1 rounded-full border border-white/20 bg-white/10">
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Test R² Score', value: `${(d.test_r2 * 100).toFixed(1)}%`, sub: `Train R²: ${(d.train_r2 * 100).toFixed(1)}%`, color: '#6366f1', icon: TrendingUp },
          { label: 'Mean Absolute Error', value: `${d.mae} min`, sub: 'Average prediction error', color: '#16a34a', icon: Target },
          { label: 'RMSE', value: `${d.rmse} min`, sub: 'Root Mean Squared Error', color: '#d97706', icon: Activity },
          { label: 'Risk Classification', value: `${d.risk_classification_accuracy}%`, sub: `${d.test_samples} test samples`, color: '#8b5cf6', icon: Zap },
        ].map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-3xl font-black tracking-tight" style={{ color }}>{value}</p>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
            <div className="p-3.5 rounded-xl border" style={{ background: color + '18', borderColor: color + '55' }}>
              <Icon size={22} style={{ color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Feature Importance */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-500" />Feature Importance Analysis
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Which clinical parameters most influence delay prediction (Gini impurity reduction)</p>
          </div>
          <div className="space-y-3.5">
            {d.feature_importances.map((f, i) => (
              <div key={f.feature} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-5 text-right font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-700 truncate">{f.feature}</span>
                    <span className="text-xs font-bold ml-2" style={{ color: '#6366f1' }}>{f.importance}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(f.importance / maxImp) * 100}%`,
                        background: `linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)`,
                        opacity: Math.max(0.35, 1 - i * 0.07)
                      }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution Pie */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FlaskConical size={16} className="text-violet-500" />Predicted Risk Distribution
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Test set predictions by risk category</p>
          </div>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.risk_distribution} dataKey="count" nameKey="risk"
                  cx="50%" cy="50%" outerRadius={78} innerRadius={38} paddingAngle={3}>
                  {d.risk_distribution.map(entry => (
                    <Cell key={entry.risk} fill={RISK_COLORS[entry.risk] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(val, name) => [`${val} samples`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {d.risk_distribution.map(r => (
              <div key={r.risk} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RISK_COLORS[r.risk] }} />
                <span className="text-xs text-slate-600 font-medium">{r.risk}</span>
                <span className="text-xs text-slate-400 ml-auto">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sample Predictions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Target size={16} className="text-emerald-500" />Predicted vs. Actual — Test Set Samples
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Randomly sampled from held-out 20% test set (never seen during training)</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Correct risk class</span>
            <span className="flex items-center gap-1"><XCircle size={12} className="text-rose-500" /> Misclassified</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {['#', 'Actual Delay', 'Predicted Delay', 'Error', 'Actual Risk', 'Predicted Risk', 'Result'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {d.sample_predictions.map((s, i) => (
                <tr key={i} className={`hover:bg-slate-50 transition-colors ${!s.correct ? 'bg-rose-50/30' : ''}`}>
                  <td className="px-3 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                  <td className="px-3 py-3 font-semibold text-slate-800">{s.actual_delay} min</td>
                  <td className="px-3 py-3 font-semibold text-indigo-700">{s.predicted_delay} min</td>
                  <td className="px-3 py-3">
                    <span className={`font-mono text-xs font-bold ${s.error < 5 ? 'text-emerald-600' : s.error < 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                      ±{s.error} min
                    </span>
                  </td>
                  <td className="px-3 py-3"><RiskBadge risk={s.actual_risk} /></td>
                  <td className="px-3 py-3"><RiskBadge risk={s.predicted_risk} /></td>
                  <td className="px-3 py-3">
                    {s.correct
                      ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle2 size={13} /> Correct</span>
                      : <span className="flex items-center gap-1 text-rose-600 text-xs font-semibold"><XCircle size={13} /> Misclassified</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Prediction Demo */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-7 py-5">
          <h3 className="text-white font-bold text-lg flex items-center gap-2.5">
            <Zap size={18} className="text-yellow-400" />Live Prediction Demo
          </h3>
          <p className="text-slate-400 text-sm mt-0.5">Adjust clinical parameters and run the Random Forest model in real-time</p>
        </div>
        <div className="p-7">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Input Panel */}
            <div className="space-y-5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Input Features (10 Clinical Parameters)</h4>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Surgery Type</label>
                <select value={inputs.surgery_type} onChange={e => setInput('surgery_type', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {['General', 'Cardiac', 'Orthopedic', 'Neuro', 'Ophthalmic'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <SliderInput label="Scheduled Hour" min={6} max={22} step={1}
                value={inputs.scheduled_hour} onChange={v => setInput('scheduled_hour', v)}
                format={v => `${v}:00`} color="indigo" />
              <SliderInput label="Expected Duration" min={15} max={300} step={15}
                value={inputs.expected_duration} onChange={v => setInput('expected_duration', v)}
                format={v => `${v} min`} color="violet" />
              <SliderInput label="OT Utilization" min={20} max={100} step={5}
                value={inputs.ot_utilization} onChange={v => setInput('ot_utilization', v)}
                format={v => `${v}%`} color={inputs.ot_utilization > 80 ? 'rose' : 'indigo'} />
              <SliderInput label="Patient Readiness Score" min={0} max={1} step={0.05}
                value={inputs.patient_ready_score} onChange={v => setInput('patient_ready_score', v)}
                format={v => `${Math.round(v * 100)}%`} color={inputs.patient_ready_score < 0.5 ? 'rose' : 'emerald'} />
              <SliderInput label="Transfer Delay" min={0} max={30} step={1}
                value={inputs.transfer_delay} onChange={v => setInput('transfer_delay', v)}
                format={v => `${v} min`} color="amber" />
              <SliderInput label="Previous Workflow Delays" min={0} max={60} step={5}
                value={inputs.previous_workflow_delays} onChange={v => setInput('previous_workflow_delays', v)}
                format={v => `${v} min`} color="orange" />

              {/* Boolean toggles */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'anaesthesia_ready', label: 'Anaesthesia Ready' },
                  { key: 'cssd_ready', label: 'CSSD Pack Ready' },
                  { key: 'surgeon_available', label: 'Surgeon Available' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setInput(key, !inputs[key])}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                      inputs[key] ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-rose-50 border-rose-300 text-rose-700'
                    }`}>
                    <span className="text-lg">{inputs[key] ? '✅' : '❌'}</span>
                    <span className="text-[10px] font-bold leading-tight">{label}</span>
                  </button>
                ))}
              </div>

              <button onClick={handlePredict} disabled={predicting}
                className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-xl shadow-md transition-all text-sm disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {predicting ? <><RefreshCw size={16} className="animate-spin" /> Running Random Forest…</>
                  : <><Zap size={16} /> Run Prediction</>}
              </button>
            </div>

            {/* Output Panel */}
            <div className="flex flex-col gap-5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Model Output</h4>

              {!prediction && !predicting && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 bg-slate-50/60 rounded-2xl border border-dashed border-slate-300 text-center">
                  <BrainCircuit size={40} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm font-medium">Adjust parameters and click</p>
                  <p className="text-sm font-bold" style={{ color: '#6366f1' }}>Run Prediction</p>
                </div>
              )}

              {predicting && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 bg-indigo-50 rounded-2xl border border-indigo-200">
                  <RefreshCw size={32} className="text-indigo-500 animate-spin mb-3" />
                  <p className="text-indigo-700 text-sm font-semibold">Querying {d.n_estimators} decision trees…</p>
                </div>
              )}

              {prediction && !predicting && (
                <div className={`space-y-4 transition-all duration-500 ${predShown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

                  {/* Main result */}
                  <div className="rounded-2xl p-6 border-2"
                    style={{
                      background: RISK_COLORS[prediction.risk_level] + '0D',
                      borderColor: RISK_COLORS[prediction.risk_level] + '99'
                    }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Predicted Delay</p>
                        <p className="text-5xl font-black text-slate-900 tracking-tight">
                          {prediction.predicted_delay_minutes}
                          <span className="text-2xl font-bold text-slate-500 ml-1">min</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <RiskBadge risk={prediction.risk_level} />
                        <p className="text-xs text-slate-500 mt-2">Risk Level</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-slate-600">Model Confidence (ensemble variance)</span>
                        <span className="text-xs font-bold" style={{ color: '#6366f1' }}>{prediction.confidence}%</span>
                      </div>
                      <div className="h-2.5 bg-white/60 rounded-full overflow-hidden border border-slate-200/60">
                        <div className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${prediction.confidence}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
                      </div>
                    </div>
                  </div>

                  {/* Delay drivers */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Active Delay Drivers</p>
                    {delayDrivers.length === 0 ? (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={12} /> All key readiness factors positive — low delay expected.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {delayDrivers.map(item => (
                          <div key={item.label} className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5 border"
                            style={{ background: item.col + '12', borderColor: item.col + '44' }}>
                            <span className="font-semibold" style={{ color: item.col }}>⚠ {item.label}</span>
                            <span className="font-bold" style={{ color: item.col }}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Feature vector */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Feature Vector Passed to Model</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        ['Surgery Type', prediction.inputs?.surgery_type],
                        ['Scheduled Hour', `${prediction.inputs?.scheduled_hour}:00`],
                        ['Expected Duration', `${prediction.inputs?.expected_duration} min`],
                        ['OT Utilization', `${prediction.inputs?.ot_utilization}%`],
                        ['Anaesthesia Ready', prediction.inputs?.anaesthesia_ready ? '✅ Yes' : '❌ No'],
                        ['Patient Readiness', `${Math.round((prediction.inputs?.patient_ready_score || 0) * 100)}%`],
                        ['CSSD Pack Ready', prediction.inputs?.cssd_ready ? '✅ Yes' : '❌ No'],
                        ['Transfer Delay', `${prediction.inputs?.transfer_delay} min`],
                        ['Prev. Delays', `${prediction.inputs?.previous_workflow_delays} min`],
                        ['Surgeon Available', prediction.inputs?.surgeon_available ? '✅ Yes' : '❌ No'],
                      ].map(([k, v]) => (
                        <div key={k as string} className="flex justify-between text-[10px] bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                          <span className="text-slate-500 font-medium truncate mr-1">{k}</span>
                          <span className="text-slate-800 font-bold shrink-0">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
