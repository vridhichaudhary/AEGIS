import React from 'react';

const Metrics = ({ data }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 h-44">
      <h2 className="text-lg font-semibold mb-2">System Metrics</h2>
      <div className="grid grid-cols-2 gap-3 text-center pt-2">
        <div>
          <p className="text-2xl font-bold text-blue-400">{data.active_incidents || 0}</p>
          <p className="text-xs text-gray-400">Active</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">{data.avg_eta || '-'}</p>
          <p className="text-xs text-gray-400">Avg ETA (m)</p>
        </div>
        <div>
          <p className="text-xl font-bold text-amber-400">{data.load || 'Low'}</p>
          <p className="text-xs text-gray-400">Load</p>
        </div>
        <div>
          <p className={`text-sm font-bold ${data.llm_ready ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.llm_ready ? 'Ready' : 'Fallback'}
          </p>
          <p className="text-xs text-gray-400">LLM Status</p>
        </div>
      </div>
      <div className="mt-3 border-t border-gray-700 pt-3 text-xs text-gray-400">
        <p>Backend: {data.backend_status || 'Unknown'}</p>
        <p>Model: {data.model || 'Unavailable'}</p>
      </div>
    </div>
  );
};

export default Metrics;
