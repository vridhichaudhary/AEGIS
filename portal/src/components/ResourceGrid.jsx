import React from 'react';

const ResourceGrid = ({ resources }) => {
  return (
    <div className="glass-card rounded-xl p-5 h-64 overflow-auto scrollbar-hide flex flex-col">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="text-blue-400">🚓</span> Emergency Resources
      </h2>
      <div className="grid grid-cols-2 gap-3 flex-1">
        {resources.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center text-gray-500 text-sm italic opacity-70 h-full">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <p>No resources deployed</p>
          </div>
        ) : (
          resources.map((resource, idx) => (
            <div key={resource.id || resource.name || idx} className="glass p-3 rounded-lg flex flex-col justify-center animate-fade-in transition-all hover:scale-105" style={{animationDelay: `${idx * 50}ms`}}>
              <p className="font-bold text-blue-300 text-sm capitalize">{resource.type?.replace('_', ' ') || 'Unit'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${resource.status === 'dispatched' ? 'bg-yellow-500 animate-pulse' : resource.status === 'on_scene' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                <span className="text-xs text-gray-300 capitalize">{resource.status?.replace('_', ' ') || 'Idle'}</span>
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
