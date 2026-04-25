import React from 'react';

const Metrics = ({ data }) => {
  return (
    <div className="glass-card rounded-xl p-5 flex flex-col justify-center">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="text-emerald-400">📊</span> System Metrics
      </h2>
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 transition-all hover:border-blue-500/50">
          <p className="text-3xl font-bold text-blue-400 animate-pulse-slow">{data.active_incidents || 0}</p>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Active</p>
        </div>
        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 transition-all hover:border-green-500/50">
          <p className="text-3xl font-bold text-green-400">{data.avg_eta || '-'}</p>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Avg ETA (m)</p>
        </div>
        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 transition-all hover:border-amber-500/50">
          <p className={`text-xl font-bold mt-1 ${data.load === 'High' ? 'text-red-400' : data.load === 'Medium' ? 'text-amber-400' : 'text-blue-400'}`}>{data.load || 'Low'}</p>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Load</p>
        </div>
        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 transition-all hover:border-emerald-500/50">
          <p className={`text-sm font-bold mt-2 ${data.llm_ready ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {data.llm_ready ? 'Online' : 'Fallback'}
          </p>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">LLM</p>
        </div>
      </div>
      
      {data.callback_metrics && (data.callback_metrics.total_pending > 0 || data.callback_metrics.total_resolved > 0) && (
        <div className="mt-4 bg-gray-800/50 p-3 rounded-lg border border-yellow-500/30">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Callback Resolution</span>
            <span className="text-sm font-bold text-yellow-400">
              {Math.round((data.callback_metrics.total_resolved / (data.callback_metrics.total_pending + data.callback_metrics.total_resolved)) * 100) || 0}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div 
              className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${Math.round((data.callback_metrics.total_resolved / (data.callback_metrics.total_pending + data.callback_metrics.total_resolved)) * 100) || 0}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-500">
            <span>Pending: {data.callback_metrics.total_pending}</span>
            <span>Resolved: {data.callback_metrics.total_resolved}</span>
          </div>
        </div>
      )}


      {data.decisions_improved !== undefined && (
        <div className="mt-3 bg-teal-900/20 p-3 rounded-lg border border-teal-500/30 flex items-center justify-between transition-all hover:bg-teal-900/30">
          <div className="flex flex-col">
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">AI Continuous Learning</span>
            <span className="text-xs text-teal-200/70">Decisions improved by feedback</span>
          </div>
          <div className="text-2xl font-bold text-teal-400 bg-teal-950 px-3 py-1 rounded-md border border-teal-500/50">
            {data.decisions_improved}
          </div>
        </div>
      )}
    </div>
  );
};

export default Metrics;
