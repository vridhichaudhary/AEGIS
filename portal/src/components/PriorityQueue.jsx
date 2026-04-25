import React from 'react';
import { Clock, MapPin, AlertCircle } from 'lucide-react';

const PriorityQueue = ({ incidents }) => {
  // Sort by priority
  const sortedIncidents = [...incidents]
    .filter(i => i.dispatch_status !== 'merged_duplicate')
    .sort((a, b) => {
      const priorityMap = { P1: 5, P2: 4, P3: 3, P4: 2, P5: 1 };
      const scoreA = priorityMap[a.priority] || 0;
      const scoreB = priorityMap[b.priority] || 0;
      
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

  const priorityColors = {
    P1: 'from-red-500 to-red-600',
    P2: 'from-orange-500 to-orange-600',
    P3: 'from-yellow-500 to-yellow-600',
    P4: 'from-green-500 to-green-600',
    P5: 'from-gray-500 to-gray-600'
  };

  const priorityBorders = {
    P1: 'border-red-500',
    P2: 'border-orange-500',
    P3: 'border-yellow-500',
    P4: 'border-green-500',
    P5: 'border-gray-500'
  };

  return (
    <div className="glass-card rounded-xl p-5 h-full flex flex-col shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <AlertCircle className="text-red-400" size={20} />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">
            Priority Queue
          </span>
        </h2>
        <span className="text-xs bg-red-500/20 px-3 py-1 rounded-full border border-red-400/30 font-semibold">
          {sortedIncidents.length} Active
        </span>
      </div>
      
      <div className="space-y-3 flex-1 overflow-auto">
        {sortedIncidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm opacity-70">
            <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p className="font-medium">No Active Incidents</p>
            <p className="text-xs mt-1">System Ready</p>
          </div>
        ) : (
          sortedIncidents.map((incident, idx) => (
            <div
              key={incident.incident_id}
              className={`glass p-4 rounded-lg border-l-4 ${priorityBorders[incident.priority]} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-slide-up`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`bg-gradient-to-r ${priorityColors[incident.priority]} text-white px-3 py-1 rounded-md text-xs font-bold shadow-lg`}>
                    {incident.priority}
                  </span>
                  <span className="font-semibold text-white text-sm">
                    {incident.incident_type?.category || 'Emergency'}
                  </span>
                  {incident.incident_type?.subcategory && (
                    <span className="text-xs text-gray-400">
                      ({incident.incident_type.subcategory})
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-xs font-semibold ${
                    incident.dispatch_status === 'assigned' ? 'text-green-400' :
                    incident.dispatch_status === 'pending' ? 'text-yellow-400' :
                    'text-gray-400'
                  }`}>
                    {incident.dispatch_status?.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-gray-300 mb-2">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{incident.location?.raw_text || 'Location unknown'}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-gray-400">
                  <Clock size={12} />
                  <span className="font-mono">
                    {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    }) : 'N/A'}
                  </span>
                </div>
                {incident.assigned_resources?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">
                      {incident.assigned_resources.length} units
                    </span>
                    {incident.assigned_resources[0]?.eta_minutes && (
                      <span className="bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">
                        ETA {incident.assigned_resources[0].eta_minutes}m
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PriorityQueue;