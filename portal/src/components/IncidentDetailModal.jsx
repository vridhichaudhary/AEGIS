import React from 'react';
import { X, MapPin, Clock, Shield, AlertTriangle, Phone, User, Activity } from 'lucide-react';

const IncidentDetailModal = ({ incident, onClose }) => {
  if (!incident) return null;

  const priorityColors = {
    P1: 'text-aegis-critical',
    P2: 'text-aegis-high',
    P3: 'text-aegis-medium',
    P4: 'text-aegis-low',
    P5: 'text-aegis-text-muted'
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-aegis-bg-base/80 backdrop-blur-md p-6">
      <div className="bg-aegis-bg-surface border border-aegis-border w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-aegis-border flex justify-between items-center bg-aegis-bg-elevated/50">
          <div className="flex items-center gap-3">
            <span className={`text-xl font-black ${priorityColors[incident.priority]}`}>{incident.priority}</span>
            <div>
              <h2 className="text-lg font-bold text-aegis-text-primary leading-tight">
                {incident.incident_type?.category?.replace('_', ' ') || 'Emergency Incident'}
              </h2>
              <p className="text-[10px] text-aegis-text-muted mono uppercase tracking-widest">INC-{incident.incident_id?.slice(0, 8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-aegis-text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 grid grid-cols-2 gap-6">
          <div className="space-y-6">
            <section>
              <h3 className="text-[10px] font-bold text-aegis-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <MapPin size={12} /> Location Intelligence
              </h3>
              <p className="text-sm text-aegis-text-primary font-medium">{incident.location?.raw_text}</p>
              <div className="mt-2 p-2 bg-aegis-bg-base rounded border border-aegis-border text-[11px] text-aegis-text-secondary mono">
                LAT: {incident.location?.latitude?.toFixed(4) || 'N/A'} | LNG: {incident.location?.longitude?.toFixed(4) || 'N/A'}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-bold text-aegis-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Activity size={12} /> Situation Summary
              </h3>
              <p className="text-sm text-aegis-text-secondary leading-relaxed italic">
                "{incident.transcript || 'No transcript available'}"
              </p>
            </section>
          </div>

          <div className="space-y-6">
            <section>
              <h3 className="text-[10px] font-bold text-aegis-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Shield size={12} /> Deployment Status
              </h3>
              <div className="space-y-2">
                {incident.assigned_resources?.map((res, i) => (
                  <div key={i} className="p-2 rounded border border-aegis-info/30 bg-aegis-info/5 flex justify-between items-center">
                    <span className="text-[11px] font-bold text-aegis-info capitalize">{res.resource_type.replace('_', ' ')}</span>
                    <span className="badge badge-info badge-xs">ETA {res.eta_minutes}M</span>
                  </div>
                ))}
                {!incident.assigned_resources?.length && (
                  <div className="p-3 rounded border border-dashed border-aegis-border text-center">
                    <p className="text-[10px] text-aegis-text-muted uppercase font-bold">Awaiting Dispatch</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-bold text-aegis-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} /> Risk Analysis
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-aegis-bg-elevated border border-aegis-border">
                  <span className="text-[9px] text-aegis-text-muted block uppercase">Authenticity</span>
                  <span className="text-sm font-bold text-aegis-low">{incident.authenticity_score}%</span>
                </div>
                <div className="p-2 rounded bg-aegis-bg-elevated border border-aegis-border">
                  <span className="text-[9px] text-aegis-text-muted block uppercase">Victims</span>
                  <span className="text-sm font-bold text-aegis-high">{incident.victim_count || 'Unknown'}</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-aegis-border bg-aegis-bg-elevated/30 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-ghost">Dismiss</button>
          <button className="btn btn-primary">Intervene (Override)</button>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetailModal;
