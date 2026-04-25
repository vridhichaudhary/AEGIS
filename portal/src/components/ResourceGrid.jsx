import React from 'react';

const ResourceGrid = ({ resources, prepositionOrders }) => {
  // Combine real resources with fake prepositioned ones
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

  return (
    <div className="glass-card rounded-xl p-5 h-64 overflow-auto scrollbar-hide flex flex-col">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="text-blue-400">🚓</span> Emergency Resources
      </h2>
      <div className="grid grid-cols-2 gap-3 flex-1">
        {allResources.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center text-gray-500 text-sm italic opacity-70 h-full">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <p>No resources deployed</p>
          </div>
        ) : (
          allResources.map((resource, idx) => (
            <div key={resource.id || resource.name || idx} className={`glass p-3 rounded-lg flex flex-col justify-center animate-fade-in transition-all hover:scale-105 ${resource.is_prepositioned ? 'border-2 border-blue-500/50 bg-blue-900/20' : ''}`} style={{animationDelay: `${idx * 50}ms`}}>
              <p className="font-bold text-blue-300 text-sm capitalize flex items-center justify-between">
                <span className="truncate">{resource.type?.replace('_', ' ') || 'Unit'}</span>
                {resource.is_prepositioned && (
                  <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse ml-2 whitespace-nowrap">
                    Predicted Incoming
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${resource.is_prepositioned ? 'bg-cyan-400 animate-ping' : resource.status === 'dispatched' ? 'bg-yellow-500 animate-pulse' : resource.status === 'on_scene' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                <span className="text-xs text-gray-300 capitalize truncate">{resource.status?.replace('_', ' ') || 'Idle'}</span>
              </div>
              {resource.location && <p className="text-[10px] text-gray-500 mt-2 truncate">📍 {typeof resource.location === 'object' ? resource.location.raw_text : resource.location}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ResourceGrid;
