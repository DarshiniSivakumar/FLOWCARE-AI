import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Activity, Users, ClipboardList, Package, 
  AlertTriangle, BarChart3, MessageSquare, Settings, LogOut, Bell, User as UserIcon
} from 'lucide-react';
import { api } from './services/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DigitalTwin from './pages/DigitalTwin';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import OTs from './pages/OTs';
import OTDetail from './pages/OTDetail';
import CSSD from './pages/CSSD';
import Analytics from './pages/Analytics';
import Copilot from './pages/Copilot';
import SettingsPage from './pages/Settings';
import { User, Notification, Recommendation } from './types';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  recommendations: Recommendation[];
  setRecommendations: React.Dispatch<React.SetStateAction<Recommendation[]>>;
  liveState: any;
  setLiveState: React.Dispatch<React.SetStateAction<any>>;
  wsStatus: 'connecting' | 'open' | 'closed';
  triggerReload: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

export default function App() {
  const [user, setUser] = useState<User | null>(api.getCurrentUser());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [liveState, setLiveState] = useState<any>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [reloadCounter, setReloadCounter] = useState(0);

  const triggerReload = () => setReloadCounter(prev => prev + 1);

  // Sync initial and periodic HTTP state
  useEffect(() => {
    if (!user) return;
    
    // Load data from REST API
    const loadState = async () => {
      try {
        const live = await api.getLiveState();
        setLiveState(live);
        
        const notifs = await api.getNotifications();
        setNotifications(notifs);
        
        const recs = await api.getRecommendations();
        setRecommendations(recs);
      } catch (err) {
        console.error("Failed to fetch operational state:", err);
      }
    };
    
    loadState();
  }, [user, reloadCounter]);

  // Connect to WebSockets
  useEffect(() => {
    if (!user) return;

    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
      .replace('http://', 'ws://')
      .replace('https://', 'wss://') + '/ws';
      
    let socket: WebSocket;
    
    const connectWs = () => {
      setWsStatus('connecting');
      socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        setWsStatus('open');
        console.log("WebSocket connected to FlowCare Event Stream.");
      };
      
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          console.log("WebSocket event received:", payload);
          
          if (payload.type === 'INITIAL_SYNC') {
            setLiveState(payload.data);
            if (payload.data.critical_alerts) {
              setNotifications(payload.data.critical_alerts);
            }
          } else {
            // Something updated on backend, trigger a reload to ensure database consistency
            triggerReload();
          }
        } catch (e) {
          console.error("Failed to parse WebSocket JSON payload:", e);
        }
      };
      
      socket.onclose = () => {
        setWsStatus('closed');
        console.warn("WebSocket closed. Attempting reconnect in 5s...");
        setTimeout(connectWs, 5000);
      };
      
      socket.onerror = (err) => {
        console.error("WebSocket encountered error:", err);
        socket.close();
      };
    };

    connectWs();
    
    return () => {
      if (socket) socket.close();
    };
  }, [user]);

  return (
    <AppContext.Provider value={{
      user, setUser, notifications, setNotifications,
      recommendations, setRecommendations, liveState, setLiveState,
      wsStatus, triggerReload
    }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AppContext.Provider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function DashboardLayout() {
  const { user, notifications, setNotifications, wsStatus } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const activeNotifs = notifications.filter(n => !n.read_status);

  const menuItems = [
    { name: 'Command Center', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Digital Twin', path: '/digital-twin', icon: Activity },
    { name: 'Patient Workflow', path: '/patients', icon: Users },
    { name: 'OT Management', path: '/ot', icon: ClipboardList },
    { name: 'CSSD Tracker', path: '/cssd', icon: Package },
    { name: 'Analytics Insights', path: '/analytics', icon: BarChart3 },
    { name: 'AI Copilot', path: '/ai-copilot', icon: MessageSquare },
    { name: 'Demo Simulator', path: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    api.logout();
  };

  const handleReadNotif = async (id: number) => {
    try {
      await api.readNotification(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_status: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="bg-hospital-600 p-2 rounded-lg text-white font-bold flex items-center justify-center">
              FC
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">FlowCare AI</h1>
              <span className="text-xs text-hospital-400 font-semibold tracking-wider uppercase">twin engine</span>
            </div>
          </div>
          
          {/* Nav */}
          <nav className="p-4 space-y-1">
            {menuItems.map(item => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-hospital-600 text-white shadow-lg shadow-hospital-900/30' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile / Logout */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="bg-slate-800 p-2 rounded-full text-slate-300">
              <UserIcon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 font-mono truncate">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition-all"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${wsStatus === 'open' ? 'bg-emerald-500 animate-pulse' : wsStatus === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'}`} />
            <span className="text-xs text-slate-400 uppercase font-mono">
              Live Stream: {wsStatus === 'open' ? 'CONNECTED' : wsStatus === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'}
            </span>
          </div>

          {/* Actions: Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="p-2 bg-slate-800 rounded-lg text-slate-300 hover:text-white relative hover:bg-slate-700 transition-all"
            >
              <Bell size={18} />
              {activeNotifs.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-bold text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-900">
                  {activeNotifs.length}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="font-semibold text-white">Role Notifications ({user?.role})</h3>
                  <span className="text-[10px] font-mono bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">RBAC Active</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-700">
                  {activeNotifs.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      No unread alerts for your role.
                    </div>
                  ) : (
                    activeNotifs.map(n => (
                      <div key={n.id} className="p-4 hover:bg-slate-750/30 transition-all space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            n.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {n.severity}
                          </span>
                          <button 
                            onClick={() => handleReadNotif(n.id)}
                            className="text-[10px] text-hospital-400 hover:text-hospital-300 font-semibold"
                          >
                            Mark Read
                          </button>
                        </div>
                        <h4 className="font-semibold text-sm text-white leading-snug">{n.title}</h4>
                        <p className="text-xs text-slate-400">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Route Viewport */}
        <main className="flex-1 overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/digital-twin" element={<DigitalTwin />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/ot" element={<OTs />} />
            <Route path="/ot/:id" element={<OTDetail />} />
            <Route path="/cssd" element={<CSSD />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/ai-copilot" element={<Copilot />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
