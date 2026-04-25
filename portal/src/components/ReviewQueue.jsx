import React from 'react';
import { ShieldAlert, UserCheck, Search, Trash2 } from 'lucide-react';

const ReviewQueue = ({ incidents = [] }) => {
  const heldIncidents = incidents.filter(i => 
    i.dispatch_status === 'review_required' || i.incident_status === 'REVIEW'
  );

  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface overflow-hidden" style={{ height: '280px' }}>
      <div className="section-header flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-aegis-high" />
          <span>Review Queue</span>
        </div>
        <span className="badge badge-warning badge-xs">
          {heldIncidents.length} HELD
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 bg-aegis-bg-base/30">
        {heldIncidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-aegis-text-muted text-[10px] uppercase tracking-widest opacity-40 italic">
            <UserCheck size={20} className="mb-2 opacity-20" />
            <p>Verification complete</p>
          </div>
        ) : (
          heldIncidents.map((incident) => {
            return (
              <div key={incident.incident_id} className="bg-aegis-bg-surface rounded p-2.5 border border-aegis-high/20 group hover:border-aegis-high/40 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="mono text-[10px] font-bold text-aegis-high uppercase tracking-widest">
                    #{incident.incident_id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="mono text-[10px] font-bold text-aegis-critical bg-aegis-critical/10 px-1.5 rounded border border-aegis-critical/20">
                    S:{incident.authenticity_score}%
                  </span>
                </div>
                
                <p className="text-[11px] text-aegis-text-secondary leading-relaxed mb-3 italic">
                  "{incident.location?.raw_text || 'UNK'}: {incident.incident_type?.category || 'EVENT'}"
                </p>

                <div className="flex gap-2">
                  <button className="btn btn-xs btn-primary flex-1">
                    <Search size={10} className="mr-1" /> VERIFY
                  </button>
                  <button className="btn btn-xs btn-ghost flex-1">
                    <Trash2 size={10} className="mr-1" /> DISCARD
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ReviewQueue;
