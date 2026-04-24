import React from 'react';

const PriorityQueue = ({ incidents }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex-1 overflow-auto">
      <h2 className="text-lg font-semibold mb-4">Priority Queue</h2>
      <div className="space-y-2">
        {incidents.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No active incidents</p>
        ) : (
          incidents.map(incident => (
            <div key={incident.incident_id} className={`bg-gray-700 p-3 rounded border-l-4 ${
              incident.priority === 'P1' ? 'border-red-500' :
              incident.priority === 'P2' ? 'border-orange-500' :
              incident.priority === 'P3' ? 'border-yellow-500' : 'border-green-500'
            }`}>
              <div className="flex justify-between">
                <span className="font-bold">{incident.priority}</span>
                <span className="text-xs text-gray-400">{new Date(incident.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm mt-1">{incident.incident_type?.category || 'Emergency'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PriorityQueue;
