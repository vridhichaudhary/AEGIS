import React from 'react';

const AgentFeed = ({ events }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 max-h-64 overflow-auto">
      <h2 className="text-lg font-semibold mb-2">Agent Activity Feed</h2>
      <div className="space-y-2">
        {events.map((event, idx) => (
          <div key={idx} className="text-xs border-l-2 border-blue-500 pl-2">
            <div className="font-mono text-gray-400">{event.agent}</div>
            <div className="text-white">{event.decision}</div>
            <div className="text-gray-500">{event.reasoning}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentFeed;