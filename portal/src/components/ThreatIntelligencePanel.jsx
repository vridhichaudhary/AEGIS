import React from 'react';
import { ShieldAlert, Crosshair, MapPin, Zap } from 'lucide-react';

const ThreatIntelligencePanel = ({ data }) => {
  if (!data) return null;

  const getThreatColor = (level) => {
    switch(level) {
      case 'CRITICAL': return 'bg-red-500 text-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
      case 'HIGH': return 'bg-orange-500 text-orange-500 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]';
      case 'MEDIUM': return 'bg-yellow-500 text-yellow-500 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]';
      case 'LOW': default: return 'bg-green-500 text-green-500 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]';
    }
  };

  const threatColor = getThreatColor(data.threat_level);

  return (
    <div className={`glass-card rounded-xl p-5 border flex flex-col mb-4 bg-[#0A1118]/80 ${threatColor.split(' ')[2]} ${threatColor.split(' ')[3]}`}>
      <div className="flex justify-between items-center mb-4 border-b border-gray-700/50 pb-3">
        <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-gray-200">
          <ShieldAlert size={16} className={`${threatColor.split(' ')[1]} animate-pulse`} />
          Threat Intelligence <span className="text-[10px] text-gray-500 lowercase">(30m forecast)</span>
        </h2>
        <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${threatColor.split(' ')[0]}/10 ${threatColor.split(' ')[1]} ${threatColor.split(' ')[2]}`}>
          {data.threat_level}
        </span>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar max-h-48 pr-2">
        {/* Risk Zones */}
        {data.risk_zones?.length > 0 && (
          <div>
            <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <MapPin size={10} /> High Risk Zones
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.risk_zones.map((zone, i) => (
                <span key={i} className="text-[11px] bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-0.5 rounded">
                  {zone}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cascade Predictions */}
        {data.cascade_predictions?.length > 0 && (
          <div>
            <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Zap size={10} /> Projected Cascades
            </h3>
            <div className="space-y-2">
              {data.cascade_predictions.map((pred, i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700 p-2 rounded flex justify-between items-center">
                  <span className="text-xs text-gray-300">{pred.description}</span>
                  <span className="text-[10px] font-mono text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                    {pred.confidence_percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pre-positioning */}
        {data.preposition_orders?.length > 0 && (
          <div>
            <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Crosshair size={10} /> Pre-positioning Directives
            </h3>
            <div className="space-y-2">
              {data.preposition_orders.map((order, i) => (
                <div key={i} className="bg-blue-500/5 border border-blue-500/20 p-2 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-blue-400 uppercase">{order.resource_type}</span>
                    <span className="text-[10px] text-gray-400 font-mono">to {order.destination}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-snug">{order.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreatIntelligencePanel;
