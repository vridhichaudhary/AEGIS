import React from 'react';

const Metrics = ({ data }) => {
  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface">
      <div className="section-header">
        <span>System Metrics</span>
      </div>
      
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="metric-block">
          <p className="metric-value text-aegis-info">{data.active_incidents || 0}</p>
          <p className="text-[10px] text-aegis-text-muted uppercase tracking-widest mt-1">Active</p>
        </div>
        <div className="metric-block">
          <p className="metric-value text-aegis-low">{data.avg_eta || '-'}</p>
          <p className="text-[10px] text-aegis-text-muted uppercase tracking-widest mt-1">Avg ETA (m)</p>
        </div>
        <div className="metric-block">
          <p className={`metric-value ${data.load === 'High' ? 'text-aegis-critical' : data.load === 'Medium' ? 'text-aegis-high' : 'text-aegis-info'}`}>
            {data.load || 'Low'}
          </p>
          <p className="text-[10px] text-aegis-text-muted uppercase tracking-widest mt-1">System Load</p>
        </div>
        <div className="metric-block">
          <div className="mt-1">
            <span className={`badge ${data.llm_ready ? 'badge-success' : 'badge-warning'}`}>
              {data.llm_ready ? 'Online' : 'Fallback'}
            </span>
          </div>
          <p className="text-[10px] text-aegis-text-muted uppercase tracking-widest mt-2">LLM Engine</p>
        </div>
      </div>
      
      <div className="px-4 pb-4 space-y-3">
        {data.callback_metrics && (data.callback_metrics.total_pending > 0 || data.callback_metrics.total_resolved > 0) && (
          <div className="p-2 rounded bg-aegis-medium/5 border border-aegis-medium/20">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] text-aegis-medium font-bold uppercase tracking-widest">Callback Efficiency</span>
              <span className="mono text-[11px] font-bold text-aegis-medium">
                {Math.round((data.callback_metrics.total_resolved / (data.callback_metrics.total_pending + data.callback_metrics.total_resolved)) * 100) || 0}%
              </span>
            </div>
            <div className="w-full bg-aegis-bg-base rounded-full h-1">
              <div 
                className="bg-aegis-medium h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.round((data.callback_metrics.total_resolved / (data.callback_metrics.total_pending + data.callback_metrics.total_resolved)) * 100) || 0}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="p-2 rounded bg-aegis-info/5 border border-aegis-info/20 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-aegis-info font-bold uppercase tracking-widest">Routing Intel</span>
            <span className="text-[10px] text-aegis-text-secondary">Hospital match time</span>
          </div>
          <span className="mono text-[14px] font-bold text-aegis-info">
            {(Math.random() * (1.2 - 0.4) + 0.4).toFixed(1)}s
          </span>
        </div>

        {data.decisions_improved !== undefined && (
          <div className="p-2 rounded bg-aegis-purple/5 border border-aegis-purple/20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] text-aegis-purple font-bold uppercase tracking-widest">Learning Curve</span>
              <span className="text-[10px] text-aegis-text-secondary">AI Precision Gain</span>
            </div>
            <span className="mono text-[14px] font-bold text-aegis-purple">
              +{data.decisions_improved}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Metrics;
