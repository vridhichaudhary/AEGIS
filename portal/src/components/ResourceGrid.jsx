import React from 'react';

const ResourceGrid = ({ resources }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 h-64 overflow-auto">
      <h2 className="text-lg font-semibold mb-4">Emergency Resources</h2>
      <div className="grid grid-cols-2 gap-2">
        {resources.length === 0 ? (
          <p className="text-gray-500 text-sm italic col-span-2">No resources available</p>
        ) : (
          resources.map(resource => (
            <div key={resource.id || resource.name} className="bg-gray-700 p-2 rounded text-sm">
              <p className="font-medium text-blue-300">{resource.type || 'Unit'}</p>
              <p className="text-xs text-gray-400">{resource.status || 'Idle'}</p>
              <p className="text-[10px] text-gray-500">{resource.location || ''}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ResourceGrid;
