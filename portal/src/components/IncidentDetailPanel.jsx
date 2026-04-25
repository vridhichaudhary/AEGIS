import React from 'react';
import { X, Clock, Shield, AlertTriangle, Activity, TrendingUp, TrendingDown, Terminal, Map as MapIcon, ChevronRight } from 'lucide-react';

const SentimentSparkline = ({ data = [40, 45, 30, 20, 35, 50, 45, 60] }) => {
  const width = 140;
  const height = 40;
  const max = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(' ');

  return (
    <div className="flex items-center gap-4">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2C7A7B" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2C7A7B" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M0,${height} L${points} L${width},${height} Z`}
          fill="url(#lineGrad)"
        />
        <polyline
          fill="none"
          stroke="#2C7A7B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle cx={width} cy={height - (data[data.length - 1] / max) * height} r="4" fill="#2C7A7B" stroke="white" strokeWidth="2" />
      </svg>
      <div className="flex flex-col">
        <span className="text-sm font-black text-slate-800 leading-none">{data[data.length-1]}%</span>
        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Severity</span>
      </div>
    </div>
  );
};

const IncidentDetailPanel = ({ incident, events = [], hospitals = [], isOpen, onClose, onResolve }) => {
  if (!incident) return null;

  const relevantEvents = events.filter(e => e.incident_id === incident.incident_id).slice(0, 10);
  const targetHospital = hospitals[0] || { name: 'Apollo Trauma Centre', available: 4, specialties: ['Trauma'] };

  return (
    <div className={`detail-panel ${isOpen ? 'open' : ''} flex flex-col bg-white shadow-2xl`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-slate-800 tracking-tight">Tactical Intelligence</h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 mono">#{incident.incident_id?.slice(0, 8)}</span>
             <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Analysis</span>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* Sentiment Section */}
        <section>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Caller State Analysis</h4>
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
            <SentimentSparkline />
            <div className="flex flex-col items-end gap-1">
               <div className="flex items-center gap-1.5 text-amber-600">
                  <TrendingUp size={16} />
                  <span className="text-[11px] font-bold uppercase">Agitation Rising</span>
               </div>
               <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Vocal Stress Detected</span>
            </div>
          </div>
        </section>

        {/* Map Context */}
        <section>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Geolocation Context</h4>
          <div className="h-40 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] [background-size:20px_20px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
               <div className="w-8 h-8 bg-red-500/20 rounded-full animate-ping" />
               <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white absolute top-2.5 left-2.5 shadow-lg" />
            </div>
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] mono font-bold text-slate-600 border border-slate-200 shadow-sm flex items-center gap-2">
              <MapIcon size={12} />
              {incident.location?.latitude?.toFixed(4)}, {incident.location?.longitude?.toFixed(4)}
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agent Decision Trail</h4>
             <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Live Sync</span>
          </div>
          <div className="space-y-6">
            {relevantEvents.length > 0 ? relevantEvents.map((evt, i) => (
              <div key={i} className="flex gap-4 relative group">
                {i !== relevantEvents.length - 1 && <div className="absolute left-[11px] top-6 w-[1.5px] h-full bg-slate-100" />}
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 z-10 shadow-sm border ${i === 0 ? 'bg-teal-500 border-teal-400 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                  {i === 0 ? <Activity size={12} /> : <div className="w-1 h-1 rounded-full bg-current" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-black uppercase tracking-tight ${i === 0 ? 'text-slate-800' : 'text-slate-500'}`}>{evt.agent}</span>
                    <span className="text-[10px] font-bold text-slate-300 mono">{new Date(evt.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <p className={`text-xs leading-relaxed mt-1 ${i === 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {evt.decision || evt.reasoning}
                  </p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                 <Terminal size={24} className="mb-3 opacity-20" />
                 <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Ingesting Pipeline Metadata...</span>
              </div>
            )}
          </div>
        </section>

        {/* Logistics Section */}
        <section>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Resource Logistics</h4>
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between group hover:bg-blue-50 transition-all cursor-pointer">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 group-hover:scale-105 transition-transform">
                  <Activity size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{targetHospital.name}</span>
                  <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-0.5">Primary Trauma Dest.</span>
                </div>
             </div>
             <div className="px-3 py-1.5 bg-white rounded-lg border border-blue-200 text-blue-700 mono font-black text-xs shadow-sm">
               {targetHospital.available} BEDS
             </div>
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-3">
        <button 
          onClick={() => onResolve(incident.incident_id)} 
          className="flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-teal-700/20 transition-all active:scale-95"
        >
          <Clock size={16} /> Resolve
        </button>
        <button 
          className="flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-sm transition-all active:scale-95 border border-red-100"
        >
          <AlertTriangle size={16} /> Escalate
        </button>
        <button className="flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-sm transition-all border border-slate-200 col-span-2 shadow-sm">
          <Shield size={16} /> Assign Additional Units
        </button>
      </div>
    </div>
  );
};

export default IncidentDetailPanel;
