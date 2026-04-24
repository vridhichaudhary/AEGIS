import React from 'react';

const PriorityQueue = ({ incidents }) => {
  return (
    <div className="glass-card rounded-xl p-5 flex-1 overflow-auto scrollbar-hide flex flex-col">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-slow"></span>
        Priority Queue
        <span className="ml-auto text-xs font-normal text-gray-400 bg-gray-800 px-2 py-1 rounded-full">{incidents.length} Active</span>
      </h2>
      <div className="space-y-3 flex-1">
        {incidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm italic opacity-70">
            <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p>No active incidents</p>
          </div>
        ) : (
          incidents.map((incident, idx) => (
            <div key={incident.incident_id} className={`glass p-4 rounded-lg border-l-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-slide-up ${
              incident.priority === 'P1' ? 'border-l-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]' :
              incident.priority === 'P2' ? 'border-l-orange-500' :
              incident.priority === 'P3' ? 'border-l-yellow-500' : 'border-l-green-500'
            }`} style={{animationDelay: `${idx * 50}ms`}}>
              <div className="flex justify-between items-start mb-1">
                <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                  incident.priority === 'P1' ? 'bg-red-500/20 text-red-400' :
                  incident.priority === 'P2' ? 'bg-orange-500/20 text-orange-400' :
                  incident.priority === 'P3' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                }`}>{incident.priority}</span>
                <span className="text-xs text-gray-400 font-mono">{new Date(incident.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
              </div>
              <p className="text-sm font-medium mt-2">{incident.incident_type?.category || 'Emergency'} <span className="text-gray-400 font-normal text-xs ml-1">({incident.incident_type?.subcategory || 'general'})</span></p>
              <div className="flex gap-2 mt-2">
                {incident.location && <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-1 rounded border border-gray-700">📍 {incident.location.raw_text || 'Unknown'}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PriorityQueue;
