import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../App';
import { Stethoscope, Lock, Mail, ChevronRight } from 'lucide-react';

export default function Login() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    { label: 'System Admin', email: 'admin@flowcare.demo', role: 'ADMIN' },
    { label: 'OT Manager', email: 'otmanager@flowcare.demo', role: 'OT_MANAGER' },
    { label: 'Ward Nurse', email: 'nurse@flowcare.demo', role: 'NURSE' },
    { label: 'CSSD Tech', email: 'cssd@flowcare.demo', role: 'CSSD_STAFF' },
    { label: 'Surgeon', email: 'doctor@flowcare.demo', role: 'DOCTOR' },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setUser({
        id: 0,
        name: res.name,
        email: res.email,
        role: res.role,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(demoEmail, 'password123');
      setUser({
        id: 0,
        name: res.name,
        email: res.email,
        role: res.role,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-hospital-500/10 p-3 rounded-2xl text-hospital-400">
            <Stethoscope size={36} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Sign in to FlowCare AI</h2>
          <p className="text-sm text-slate-400">Hospital Operational Digital Twin Command</p>
        </div>

        {error && (
          <div className="bg-rose-950/30 border border-rose-800 text-rose-300 text-xs p-3 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-slate-500" size={16} />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="doctor@flowcare.demo"
                className="w-full bg-slate-950 border border-slate-800 focus:border-hospital-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-650 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-500" size={16} />
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-hospital-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-650 outline-none transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-hospital-600 hover:bg-hospital-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-hospital-900/20 active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
            <ChevronRight size={16} />
          </button>
        </form>

        {/* Quick Demo Accounts */}
        <div className="border-t border-slate-800 pt-6 space-y-3">
          <p className="text-xs text-center text-slate-400 font-semibold uppercase tracking-wider">Hackathon Quick Login</p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map(acc => (
              <button
                key={acc.role}
                onClick={() => handleQuickLogin(acc.email)}
                className="text-left px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded-xl transition-all"
              >
                <p className="text-[11px] font-semibold text-white leading-tight">{acc.label}</p>
                <span className="text-[9px] text-hospital-400 font-mono">{acc.role}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
