import React from 'react';
import { Truck, Car, Bike, LifeBuoy, Zap } from 'lucide-react';

const RESOURCE_ICONS = {
  ambulance: <Car size={14} />,
  fire_truck: <Truck size={14} />,
  police_bike: <Bike size={14} />,
  rescue_boat: <LifeBuoy size={14} />,
  drone: <Zap size={14} />,
};

const ResourceGrid = ({ resources = [], onFocus }) => {
  // Aggregate resources by type
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
      <div className="flex flex-col items-center justify-center py-8 text-aegis-text-muted text-[10px] uppercase tracking-widest opacity-50 italic">
        <p>No field units detected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {resourceTypes.map((res) => {
        const percent = (res.available / res.total) * 100;
        let barColor = 'var(--aegis-low)';
        if (percent < 20) barColor = 'var(--aegis-critical)';
        else if (percent <= 50) barColor = 'var(--aegis-medium)';

        return (
          <div 
            key={res.type} 
            className="flex flex-col gap-1.5 p-2 rounded hover:bg-aegis-bg-elevated/50 transition-colors cursor-pointer group"
            onClick={() => {
              if (onFocus && res.sample.location) {
                 const loc = typeof res.sample.location === 'object' ? res.sample.location : { latitude: 28.6139, longitude: 77.2090 };
                 onFocus(loc);
              }
            }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-aegis-text-secondary group-hover:text-aegis-accent transition-colors">
                  {RESOURCE_ICONS[res.type] || <Truck size={14} />}
                </span>
                <span className="font-bold text-aegis-text-primary text-[11px] capitalize tracking-wide">
                  {res.type.replace('_', ' ')}
                </span>
              </div>
              <div className="mono text-[10px] text-aegis-text-muted">
                <span className="text-aegis-text-primary">{res.available}</span> / {res.total}
              </div>
            </div>

            {/* Mini Bar Chart */}
            <div className="h-1.5 w-full bg-aegis-border rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500" 
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
