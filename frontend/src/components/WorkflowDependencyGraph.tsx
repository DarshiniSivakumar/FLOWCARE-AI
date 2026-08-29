import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  GitFork, ShieldAlert, AlertCircle, User, 
  Activity, Package, Bed, Stethoscope, RefreshCw, Layers, ArrowRight
} from 'lucide-react';
import { Surgery, SurgeryDependencyTree, ResourceImpactAnalysis } from '../types';

export default function WorkflowDependencyGraph() {
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<number | null>(null);
  const [dependencyTree, setDependencyTree] = useState<SurgeryDependencyTree | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<ResourceImpactAnalysis | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string | number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSurgeries();
  }, []);

  const loadSurgeries = async () => {
    setLoading(true);
    try {
      const data = await api.getSurgeries();
      setSurgeries(data);
      if (data.length > 0 && !selectedSurgeryId) {
        setSelectedSurgeryId(data[0].id);
        fetchTree(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load surgeries for graph', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTree = async (surgeryId: number) => {
    try {
      const tree = await api.getSurgeryDependencyTree(surgeryId);
      setDependencyTree(tree);
      setSelectedEntity({ type: 'surgery', id: surgeryId });
      const impact = await api.analyzeResourceImpact('surgery', surgeryId);
      setImpactAnalysis(impact);
    } catch (err) {
      console.error('Failed to fetch dependency tree', err);
    }
  };

  const handleSurgeryChange = (id: number) => {
    setSelectedSurgeryId(id);
    fetchTree(id);
  };

  const handleNodeClick = async (type: string, id: string | number) => {
    setSelectedEntity({ type, id });
    try {
      const impact = await api.analyzeResourceImpact(type, id);
      setImpactAnalysis(impact);
    } catch (err) {
      console.error('Failed to fetch impact analysis', err);
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'surgery':
        return <Activity className="text-pink-600" size={16} />;
      case 'patient':
        return <User className="text-blue-600" size={16} />;
      case 'operating_theatre':
        return <Layers className="text-rose-600" size={16} />;
      case 'surgeon':
        return <Stethoscope className="text-emerald-600" size={16} />;
      case 'anaesthesia_team':
        return <User className="text-purple-600" size={16} />;
      case 'instrument_set':
      case 'instrument_pack':
        return <Package className="text-amber-600" size={16} />;
      case 'recovery_bed':
        return <Bed className="text-teal-600" size={16} />;
      default:
        return <GitFork className="text-slate-600" size={16} />;
    }
  };

  const formatTypeName = (type: string) => {
    return type
      .replace('_', ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const currentSurgery = surgeries.find(s => s.id === selectedSurgeryId);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="bg-hospital-100 p-2 rounded-lg text-hospital-600 border border-hospital-200">
              <GitFork size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Workflow Dependency Graph</h3>
              <p className="text-xs text-slate-500">Operational resource tree & multi-level cascade engine</p>
            </div>
          </div>
        </div>

        {/* Surgery Picker */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-600 font-semibold">Select Surgery:</label>
          <select 
            value={selectedSurgeryId || ''} 
            onChange={e => handleSurgeryChange(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-hospital-500 shadow-xs"
          >
            {surgeries.map(s => (
              <option key={s.id} value={s.id}>
                Surgery S{s.id} - {s.surgery_type} ({s.status})
              </option>
            ))}
          </select>
          <button 
            onClick={() => selectedSurgeryId && fetchTree(selectedSurgeryId)}
            className="p-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
            title="Refresh Graph"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Viewport: Tree View & Impact Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Interactive Dependency Tree */}
        <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <span className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider">
              Operational Hierarchy Tree
            </span>
            {currentSurgery && (
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                currentSurgery.status === 'SURGERY' ? 'bg-pink-100 text-pink-700 border border-pink-200' :
                currentSurgery.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                Status: {currentSurgery.status}
              </span>
            )}
          </div>

          {/* Root Surgery Node */}
          {dependencyTree ? (
            <div className="space-y-4">
              <div 
                onClick={() => handleNodeClick('surgery', dependencyTree.id)}
                className={`cursor-pointer p-4 rounded-xl border transition-all ${
                  selectedEntity?.type === 'surgery' && String(selectedEntity?.id) === String(dependencyTree.id)
                    ? 'bg-hospital-50 border-hospital-500 ring-2 ring-hospital-500/30 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-pink-100 p-2 rounded-lg text-pink-600 border border-pink-200">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Surgery S{dependencyTree.id}</h4>
                      <p className="text-xs text-slate-600">
                        {currentSurgery ? `${currentSurgery.surgery_type} • Urgency: ${currentSurgery.urgency_level}` : 'Operational Procedure'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-1 rounded font-bold">
                    Root Entity
                  </span>
                </div>
              </div>

              {/* Dependency Branches Tree */}
              <div className="pl-6 border-l-2 border-slate-300 space-y-3">
                <p className="text-[11px] font-mono text-slate-500 uppercase font-semibold mb-2">
                  ├── Direct Requirements ({dependencyTree.dependencies.length})
                </p>

                {dependencyTree.dependencies.map((dep, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleNodeClick(dep.type, dep.id)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all relative ${
                      selectedEntity?.type === dep.type && String(selectedEntity?.id) === String(dep.id)
                        ? 'bg-hospital-50 border-hospital-500 ring-1 ring-hospital-500/40 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg">
                          {getEntityIcon(dep.type)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{formatTypeName(dep.type)}</span>
                            <span className="text-hospital-600 font-mono text-[11px]">#{dep.id}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {dep.metadata?.reason ? dep.metadata.reason.replace(/_/g, ' ') : `Required for Surgery S${dependencyTree.id}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded uppercase font-semibold">
                          {dep.dependency_type}
                        </span>
                        <ArrowRight size={14} className="text-slate-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs italic">
              Loading workflow dependency tree...
            </div>
          )}
        </div>

        {/* Right Col: Impact Analysis & Cascade Inspector */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <ShieldAlert className="text-amber-600" size={16} />
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider font-mono">
              Cascading Impact Inspector
            </h4>
          </div>

          {selectedEntity ? (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
                <span className="text-[10px] text-slate-500 font-mono block uppercase">Selected Entity</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                  {getEntityIcon(selectedEntity.type)}
                  <span>{formatTypeName(selectedEntity.type)}: #{selectedEntity.id}</span>
                </p>
              </div>

              {impactAnalysis ? (
                <div className="space-y-3 text-xs">
                  {/* Directly Affected */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
                    <span className="font-bold text-slate-700 block mb-1 text-[11px]">
                      Direct Dependencies ({impactAnalysis.direct_affected.length})
                    </span>
                    {impactAnalysis.direct_affected.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No direct downstream dependencies</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {impactAnalysis.direct_affected.map((res, i) => (
                          <span key={i} className="text-[10px] bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded font-mono font-semibold">
                            {res.resource_type}:{res.resource_id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reverse Affected */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
                    <span className="font-bold text-slate-700 block mb-1 text-[11px]">
                      Reverse Dependencies ({impactAnalysis.reverse_affected.length})
                    </span>
                    {impactAnalysis.reverse_affected.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No upstream dependent entities</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {impactAnalysis.reverse_affected.map((res, i) => (
                          <span key={i} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-mono font-semibold">
                            {res.resource_type}:{res.resource_id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Affected Surgeries Summary */}
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 shadow-xs">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertCircle className="text-rose-600" size={14} />
                      <span className="font-bold text-rose-800 text-[11px]">
                        Surgeries Impacted by Delay ({impactAnalysis.affected_surgeries.length})
                      </span>
                    </div>
                    {impactAnalysis.affected_surgeries.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No surgeries at risk</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {impactAnalysis.affected_surgeries.map((s, i) => (
                          <span key={i} className="text-[10px] bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded font-mono font-bold">
                            Surgery #{s.resource_id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs text-center py-4">Computing cascade analysis...</div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-xs text-center py-6">
              Click any node in the tree to inspect operational dependencies and delay impact.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
