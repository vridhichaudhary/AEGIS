import React from 'react';

const ResourceGrid = ({ resources = [], prepositionOrders = [] }) => {
  // Group by type for availability counts
  const typeCounts = (resources || []).reduce((acc, r) => {
    const type = r.type || 'unknown';
    if (!acc[type]) acc[type] = { total: 0, available: 0, dispatched: 0, returning: 0 };
    acc[type].total++;
    if (r.status === 'available') acc[type].available++;
    else if (r.status === 'dispatched') acc[type].dispatched++;
    else if (r.status === 'returning') acc[type].returning++;
    return acc;
  }, {});

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'dispatched': return 'bg-red-500 animate-pulse';
      case 'returning': return 'bg-amber-500';
      case 'on_scene': return 'bg-blue-400';
      case 'pre_positioned': return 'bg-cyan-400 animate-ping';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 h-80 overflow-hidden flex flex-col border border-gray-700/50 bg-[#0D151C]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold flex items-center gap-2 text-blue-400 uppercase tracking-widest">
          <span className="text-lg">🚓</span> Resource Fleet Grid
        </h2>
        <div className="flex gap-3">
           {Object.keys(typeCounts).slice(0, 3).map(type => (
             <div key={type} className="text-[10px] bg-gray-800/50 px-2 py-1 rounded border border-gray-700">
               <span className="text-gray-400 uppercase mr-1">{type.split('_')[0]}:</span>
               <span className="text-green-400 font-bold">{typeCounts[type].available}</span>
             </div>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {allResources.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center text-gray-600 text-sm italic h-full">
            <p>Scanning resource frequencies...</p>
          </div>
        ) : (
          allResources.map((resource, idx) => (
            <div 
              key={resource.id || resource.name || idx} 
              className={`glass p-3 rounded-lg flex flex-col border border-gray-700/30 transition-all hover:bg-white/5 relative group ${resource.is_prepositioned ? 'border-cyan-500/50 bg-cyan-900/10' : ''}`}
            >
              {/* Preempted Badge */}
              {resource.preempted && (
                <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded shadow-lg font-bold z-10 animate-bounce">
                  PREEMPTED
                </div>
              )}

              <div className="flex justify-between items-start mb-1">
                <p className="font-bold text-gray-200 text-xs capitalize truncate">
                  {resource.type?.replace('_', ' ') || 'Unit'}
                </p>
                <span className="text-[9px] font-mono text-gray-500">{resource.id || 'N/A'}</span>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(resource.status)}`}></span>
                <span className="text-[10px] text-gray-400 uppercase font-medium tracking-tighter">
                  {resource.status?.replace('_', ' ') || 'Idle'}
                  {resource.status === 'returning' && resource.eta_return && (
                    <span className="text-amber-500 ml-1">({resource.eta_return}m)</span>
                  )}
                </span>
              </div>

              {resource.location && (
                <p className="text-[9px] text-gray-500 mt-2 truncate opacity-70 group-hover:opacity-100 transition-opacity">
                  📍 {typeof resource.location === 'object' ? resource.location.raw_text : resource.location}
                </p>
              )}
              
              {resource.is_prepositioned && (
                <div className="mt-2 py-0.5 px-2 bg-cyan-500/20 rounded border border-cyan-500/30">
                  <p className="text-[8px] text-cyan-400 font-bold uppercase tracking-widest text-center">AI Predicted Need</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ResourceGrid;
