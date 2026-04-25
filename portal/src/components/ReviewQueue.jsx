import React from 'react';
import { ShieldAlert, UserCheck, Search } from 'lucide-react';

const ReviewQueue = ({ incidents = [] }) => {
  const heldIncidents = incidents.filter(i => 
    i.dispatch_status === 'review_required' || i.incident_status === 'REVIEW'
  );

  return (
    <div className="glass-card rounded-xl p-5 h-72 flex flex-col border border-amber-500/30 bg-[#0D151C]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold flex items-center gap-2 text-amber-400 uppercase tracking-widest">
          <ShieldAlert size={18} /> Review Queue
        </h2>
        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded border border-amber-500/30 font-bold">
          {heldIncidents.length} HELD
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
        {heldIncidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 text-xs italic">
            <UserCheck size={24} className="mb-2 opacity-20" />
            <p>No calls pending review</p>
          </div>
        ) : (
          heldIncidents.map((incident) => {
            // Try to extract validation details from the reasoning in agent_trail if available
            // In a real app, this would be part of the incident object
            return (
              <div key={incident.incident_id} className="p-3 rounded-lg bg-amber-900/10 border border-amber-500/20 relative group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono font-bold text-amber-300">#{incident.incident_id.slice(0, 8)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-1.5 rounded border border-red-500/20">
                      SCORE: {incident.authenticity_score}%
                    </span>
                  </div>
                </div>
                
                <p className="text-[11px] text-gray-300 line-clamp-2 mb-2 italic">
                  "{incident.location?.raw_text || 'Unknown Location'}: {incident.incident_type?.category || 'Emergency'}"
                </p>

                <div className="flex gap-2">
                  <button className="flex-1 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1">
                    <Search size={10} /> Investigate
                  </button>
                  <button className="flex-1 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[9px] font-bold uppercase tracking-wider rounded border border-gray-700 transition-colors">
                    Dismiss
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
