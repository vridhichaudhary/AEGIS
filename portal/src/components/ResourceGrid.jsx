import React from 'react';
import { Truck, Car, Bike, LifeBuoy, Zap } from 'lucide-react';

const RESOURCE_ICONS = {
  ambulance: <Car size={16} />,
  fire_truck: <Truck size={16} />,
  police_bike: <Bike size={16} />,
  rescue_boat: <LifeBuoy size={16} />,
  drone: <Zap size={16} />,
};

const ResourceGrid = ({ resources = [], onFocus }) => {
  const aggregated = resources.reduce((acc, r) => {
    const type = r.type || 'unknown';
    if (!acc[type]) acc[type] = { type, total: 0, available: 0, sample: r };
    acc[type].total += 1;
    if (r.status === 'available') acc[type].available += 1;
    return acc;
  }, {});

  const resourceTypes = Object.values(aggregated);

  if (resourceTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-[10px] uppercase tracking-widest italic">
        <p>No units deployed</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {resourceTypes.map((res) => {
        const percent = (res.available / res.total) * 100;
        let barColor = '#2F855A'; // aegis-low (Green)
        if (percent < 20) barColor = '#C53030'; // aegis-critical (Red)
        else if (percent <= 50) barColor = '#B7791F'; // aegis-medium (Yellow)

        return (
          <div 
            key={res.type} 
            className="flex flex-col gap-2 p-3 rounded-xl hover:bg-white transition-all cursor-pointer group hover:shadow-sm"
            onClick={() => {
              if (onFocus && res.sample.location) {
                 const loc = typeof res.sample.location === 'object' ? res.sample.location : { latitude: 28.6139, longitude: 77.2090 };
                 onFocus(loc);
              }
            }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                  {RESOURCE_ICONS[res.type] || <Truck size={16} />}
                </div>
                <span className="font-bold text-slate-800 text-xs capitalize tracking-tight">
                  {res.type.replace('_', ' ')}
                </span>
              </div>
              <div className="mono text-[11px] font-bold">
                <span className="text-slate-800">{res.available}</span>
                <span className="text-slate-400 mx-0.5">/</span>
                <span className="text-slate-500">{res.total}</span>
              </div>
            </div>

            {/* Mini Bar Chart */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-700 ease-out" 
                style={{ width: `${percent}%`, backgroundColor: barColor }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ResourceGrid;
