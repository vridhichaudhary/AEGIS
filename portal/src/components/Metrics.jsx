import React from 'react';

const Metrics = ({ data }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 h-32">
      <h2 className="text-lg font-semibold mb-2">System Metrics</h2>
      <div className="flex justify-around text-center pt-2">
        <div>
          <p className="text-2xl font-bold text-blue-400">{data.active_incidents || 0}</p>
          <p className="text-xs text-gray-400">Active</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">{data.avg_eta || '-'}</p>
          <p className="text-xs text-gray-400">Avg ETA (m)</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-purple-400">{data.load || 'Low'}</p>
          <p className="text-xs text-gray-400">Load</p>
        </div>
      </div>
    </div>
  );
};

export default Metrics;
