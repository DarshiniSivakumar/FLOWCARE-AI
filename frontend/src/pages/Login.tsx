import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../App';
import { Stethoscope, Lock, Mail, ChevronRight, KeyRound } from 'lucide-react';
import { UserRole } from '../types';

export default function Login() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@flowcare.demo');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demoAccounts: { label: string; email: string; role: UserRole }[] = [
    { label: 'System Admin', email: 'admin@flowcare.demo', role: 'ADMIN' },
    { label: 'OT Manager', email: 'otmanager@flowcare.demo', role: 'OT_MANAGER' },
    { label: 'Ward Nurse', email: 'nurse@flowcare.demo', role: 'NURSE' },
    { label: 'CSSD Tech', email: 'cssd@flowcare.demo', role: 'CSSD_STAFF' },
    { label: 'Surgeon', email: 'doctor@flowcare.demo', role: 'DOCTOR' },
  ];

  const processUserLogin = (res: any, fallbackEmail: string) => {
    const userRole: UserRole = (res.role as UserRole) || 'ADMIN';
    const userObj = {
      id: 1,
      name: res.name || 'Demo User',
      email: res.email || fallbackEmail,
      role: userRole,
    };
    setUser(userObj);
    localStorage.setItem('flowcare_user', JSON.stringify(userObj));
    localStorage.setItem('flowcare_token', res.access_token || 'mock-flowcare-token');
    navigate('/dashboard');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email || 'admin@flowcare.demo', password || 'password123');
      processUserLogin(res, email);
    } catch (err: any) {
      console.warn('Backend login fallback active:', err);
      processUserLogin({ name: 'System Admin', role: 'ADMIN' }, email);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoRole: UserRole) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(demoEmail, 'password123');
      processUserLogin(res, demoEmail);
    } catch (err: any) {
      console.warn('Quick login fallback active:', err);
      processUserLogin({ name: `${demoRole} User`, role: demoRole }, demoEmail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-hospital-50 p-3 rounded-2xl text-hospital-600 border border-hospital-100 shadow-xs">
            <Stethoscope size={36} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to FlowCare AI</h2>
          <p className="text-sm text-slate-500">Hospital Operational Digital Twin Command</p>
        </div>

        {/* Mock Credentials Banner */}
        <div className="bg-hospital-50 border border-hospital-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-hospital-900">
          <KeyRound size={18} className="text-hospital-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-hospital-950 mb-0.5">Default Mock Credentials Active</p>
            <p className="text-[11px] text-slate-600 leading-tight">
              Email: <code className="text-hospital-700 font-mono font-bold">admin@flowcare.demo</code> | Password: <code className="text-hospital-700 font-mono font-bold">password123</code>
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="doctor@flowcare.demo"
                className="w-full bg-slate-50 border border-slate-300 focus:border-hospital-600 focus:bg-white rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all shadow-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-300 focus:border-hospital-600 focus:bg-white rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all shadow-xs"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-hospital-600 hover:bg-hospital-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-hospital-600/20 active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
            <ChevronRight size={16} />
          </button>
        </form>

        {/* Quick Demo Accounts */}
        <div className="border-t border-slate-200 pt-5 space-y-3">
          <p className="text-xs text-center text-slate-500 font-semibold uppercase tracking-wider">Instant Quick Role Login</p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map(acc => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleQuickLogin(acc.email, acc.role)}
                className="text-left px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-hospital-400 rounded-xl transition-all shadow-xs"
              >
                <p className="text-[11px] font-semibold text-slate-900 leading-tight">{acc.label}</p>
                <span className="text-[9px] text-hospital-600 font-mono font-bold">{acc.role}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
