import React from 'react';

const ResourceGrid = ({ resources = [], prepositionOrders = [] }) => {
  const allResources = [...(resources || [])];
  
  if (prepositionOrders && prepositionOrders.length > 0) {
    prepositionOrders.forEach((order, idx) => {
      allResources.push({
        id: `PRE-${idx}`,
        type: order.resource_type,
        status: 'pre_positioned',
        location: order.destination,
        is_prepositioned: true
      });
    });
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'available': return 'status-dot-online';
      case 'dispatched': return 'status-dot-offline'; // Using red for busy/out
      case 'returning': return 'status-dot-warning';
      case 'on_scene': return 'status-dot-offline';
      case 'pre_positioned': return 'status-dot-online';
      default: return 'status-dot-idle';
    }
  };

  const getBadgeClass = (status) => {
    switch (status) {
      case 'available': return 'badge-success';
      case 'dispatched': return 'badge-critical';
      case 'returning': return 'badge-warning';
      case 'on_scene': return 'badge-critical';
      case 'pre_positioned': return 'badge-info';
      default: return 'badge-muted';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {allResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-aegis-text-muted text-[10px] uppercase tracking-widest opacity-50 italic">
          <p>No field units detected</p>
        </div>
      ) : (
        allResources.map((resource, idx) => (
          <div 
            key={resource.id || resource.name || idx} 
            className={`p-2 rounded border transition-all flex flex-col gap-1.5 ${resource.is_prepositioned ? 'bg-aegis-info/5 border-aegis-info/30' : 'bg-aegis-bg-elevated/30 border-aegis-border'}`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className={`status-dot ${getStatusClass(resource.status)}`}></div>
                <span className="font-bold text-aegis-text-primary text-[11px] capitalize">
                  {resource.type?.replace('_', ' ') || 'Unit'}
                </span>
              </div>
              <span className="mono text-[10px] text-aegis-text-muted">{resource.id || 'N/A'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className={`badge badge-xs ${getBadgeClass(resource.status)}`}>
                {resource.status?.replace('_', ' ') || 'Idle'}
                {resource.status === 'returning' && resource.eta_return && ` (${resource.eta_return}m)`}
              </span>
              
              {resource.preempted && (
                <span className="badge badge-critical badge-xs animate-bounce">PREEMPTED</span>
              )}
            </div>

            {resource.location && (
              <div className="flex items-center gap-1.5 text-[10px] text-aegis-text-muted truncate">
                <span className="opacity-50">📍</span>
                <span className="truncate">{typeof resource.location === 'object' ? resource.location.raw_text : resource.location}</span>
              </div>
            )}
            
            {resource.is_prepositioned && (
              <div className="py-0.5 px-2 bg-aegis-info/10 rounded border border-aegis-info/20">
                <p className="text-[8px] text-aegis-info font-bold uppercase tracking-widest text-center">AI Predicted Deployment</p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default ResourceGrid;
