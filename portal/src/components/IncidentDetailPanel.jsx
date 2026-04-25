import React from 'react';
import { X, Clock, Shield, AlertTriangle, Hospital, TrendingUp, TrendingDown, Terminal } from 'lucide-react';

const SentimentSparkline = ({ data = [40, 45, 30, 20, 35, 50, 45, 60] }) => {
  const width = 120;
  const height = 30;
  const max = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(' ');

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle cx={width} cy={height - (data[data.length - 1] / max) * height} r="3" fill="#3B82F6" />
      </svg>
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-aegis-text-primary">{data[data.length-1]}%</span>
        <span className="text-[8px] text-aegis-text-muted uppercase font-bold tracking-tighter">Distress</span>
      </div>
    </div>
  );
};

const IncidentDetailPanel = ({ incident, events = [], hospitals = [], isOpen, onClose, onResolve }) => {
  if (!incident) return null;

  const relevantEvents = events.filter(e => e.incident_id === incident.incident_id).slice(0, 8);
  const targetHospital = hospitals[0] || { name: 'Apollo Trauma Centre', available: 4 };

  return (
    <div className={`detail-panel ${isOpen ? 'open' : ''} flex flex-col`}>
      {/* Header */}
      <div className="p-4 border-b border-aegis-border flex justify-between items-center bg-aegis-bg-elevated/50">
        <div className="flex flex-col">
          <h2 className="text-sm font-black text-aegis-text-primary uppercase tracking-widest">Incident Intelligence</h2>
          <span className="mono text-[10px] text-aegis-text-muted">ID: {incident.incident_id?.slice(0, 12)}</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-aegis-bg-hover rounded-full transition-colors">
          <X size={18} className="text-aegis-text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
        {/* Sentiment Section */}
        <section>
          <div className="section-header mb-4 bg-transparent p-0 border-0">Caller Psychological State</div>
          <div className="bg-aegis-bg-base/30 p-4 rounded border border-aegis-border flex justify-between items-center">
            <SentimentSparkline />
            <div className="flex items-center gap-2 text-aegis-high">
               <TrendingUp size={16} />
               <span className="text-[10px] font-bold uppercase">Rising Agitation</span>
            </div>
          </div>
        </section>

        {/* Map Thumbnail Placeholder */}
        <section>
          <div className="section-header mb-4 bg-transparent p-0 border-0">Geospatial Context</div>
          <div className="h-32 bg-aegis-bg-base rounded border border-aegis-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
               <div className="w-4 h-4 bg-aegis-critical rounded-full animate-ping opacity-50" />
               <div className="w-2 h-2 bg-aegis-critical rounded-full absolute top-1 left-1" />
            </div>
            <div className="absolute bottom-2 left-2 bg-aegis-bg-elevated/90 px-2 py-1 rounded text-[9px] mono text-aegis-text-secondary border border-aegis-border">
              {incident.location?.latitude?.toFixed(4)}, {incident.location?.longitude?.toFixed(4)}
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section>
          <div className="section-header mb-4 bg-transparent p-0 border-0">Agent Decision Trail</div>
          <div className="space-y-4">
            {relevantEvents.length > 0 ? relevantEvents.map((evt, i) => (
              <div key={i} className="flex gap-3 relative">
                {i !== relevantEvents.length - 1 && <div className="absolute left-1.5 top-4 w-[1px] h-full bg-aegis-border" />}
                <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 z-10 ${i === 0 ? 'bg-aegis-info' : 'bg-aegis-text-muted'}`} />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-aegis-text-primary uppercase">{evt.agent}</span>
                    <span className="mono text-[9px] text-aegis-text-muted">14:2{i}:{10+i}</span>
                  </div>
                  <p className="text-[11px] text-aegis-text-secondary leading-normal">{evt.decision || evt.reasoning?.slice(0, 60)}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-6 text-aegis-text-muted text-[10px] uppercase italic opacity-50">
                 <Terminal size={20} className="mb-2" />
                 Processing pipeline active...
              </div>
            )}
          </div>
        </section>

        {/* Logistics Section */}
        <section>
          <div className="section-header mb-4 bg-transparent p-0 border-0">Logistics & Triage</div>
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-aegis-bg-base/30 p-3 rounded border border-aegis-border flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-aegis-info/10 rounded">
                    <Hospital size={16} className="text-aegis-info" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-aegis-text-primary uppercase">{targetHospital.name}</span>
                    <span className="text-[9px] text-aegis-text-muted font-bold">PRIMARY TRAUMA DESTINATION</span>
                  </div>
               </div>
               <div className="badge badge-success badge-sm mono font-bold">{targetHospital.available} BEDS</div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-4 bg-aegis-bg-elevated/50 border-t border-aegis-border grid grid-cols-2 gap-2">
        <button onClick={() => onResolve(incident.incident_id)} className="btn btn-success w-full justify-center">
          <Clock size={14} /> Resolve
        </button>
        <button className="btn btn-danger w-full justify-center">
          <AlertTriangle size={14} /> Escalate
        </button>
        <button className="btn btn-ghost w-full justify-center col-span-2 mt-1">
          <Shield size={14} /> Assign Additional Units
        </button>
      </div>
    </div>
  );
};

export default IncidentDetailPanel;
