import React from 'react';
import { ShieldAlert, Crosshair, MapPin, Zap } from 'lucide-react';

const ThreatIntelligencePanel = ({ data }) => {
  if (!data) return null;

  const getThreatBadge = (level) => {
    switch(level) {
      case 'CRITICAL': return 'badge-critical';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-info';
      default: return 'badge-success';
    }
  };

  return (
    <div className={`card-flush flex flex-col bg-aegis-bg-surface overflow-hidden ${data.threat_level === 'CRITICAL' ? 'border-aegis-critical/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}`}>
      <div className="section-header flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className={data.threat_level === 'CRITICAL' ? 'text-aegis-critical animate-pulse' : 'text-aegis-info'} />
          <span>Threat Intelligence</span>
        </div>
        <span className={`badge ${getThreatBadge(data.threat_level)} badge-xs`}>
          {data.threat_level}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar max-h-64">
        {/* Risk Zones */}
        {data.risk_zones?.length > 0 && (
          <div>
            <h3 className="text-[9px] text-aegis-text-muted font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <MapPin size={10} /> Active Risk Zones
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.risk_zones.map((zone, i) => (
                <span key={i} className="badge badge-outline text-[10px] mono">
                  {zone}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cascade Predictions */}
        {data.cascade_predictions?.length > 0 && (
          <div>
            <h3 className="text-[9px] text-aegis-text-muted font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Zap size={10} /> Predicted Cascades
            </h3>
            <div className="space-y-1.5">
              {data.cascade_predictions.map((pred, i) => (
                <div key={i} className="bg-aegis-bg-base/50 border border-aegis-border p-2 rounded flex justify-between items-center group hover:border-aegis-high/30 transition-colors">
                  <span className="text-[11px] text-aegis-text-secondary">{pred.description}</span>
                  <span className="mono text-[10px] font-bold text-aegis-high bg-aegis-high/10 px-1.5 py-0.5 rounded ml-2">
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
            <h3 className="text-[9px] text-aegis-text-muted font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Crosshair size={10} /> Deploy Directives
            </h3>
            <div className="space-y-2">
              {data.preposition_orders.map((order, i) => (
                <div key={i} className="bg-aegis-info/5 border border-aegis-info/20 p-2 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-aegis-info uppercase mono">{order.resource_type}</span>
                    <span className="text-[9px] text-aegis-text-muted mono">→ {order.destination}</span>
                  </div>
                  <p className="text-[10px] text-aegis-text-secondary leading-snug italic">"{order.reason}"</p>
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
