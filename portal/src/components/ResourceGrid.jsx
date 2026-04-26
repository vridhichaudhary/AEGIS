import React from 'react';
import { Truck, Car, Bike, LifeBuoy, Zap, ShieldCheck } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-[10px] uppercase tracking-widest italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <ShieldCheck size={24} className="mb-2 opacity-20" />
        <p>No units deployed</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4">
      {resourceTypes.map((res) => {
        const percent = (res.available / res.total) * 100;
        let barColorClass = 'bg-green-500'; 
        let bgClass = 'bg-green-50';
        let textClass = 'text-green-700';

        if (percent < 20) {
            barColorClass = 'bg-red-500';
            bgClass = 'bg-red-50';
            textClass = 'text-red-700';
        } else if (percent <= 50) {
            barColorClass = 'bg-orange-500';
            bgClass = 'bg-orange-50';
            textClass = 'text-orange-700';
        }

        return (
          <div 
            key={res.type} 
            className="group bg-white border border-slate-100 p-4 rounded-2xl hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-200 transition-all cursor-pointer"
            onClick={() => {
              if (onFocus && res.sample.location) {
                 const loc = typeof res.sample.location === 'object' ? res.sample.location : { latitude: 28.6139, longitude: 77.2090 };
                 onFocus(loc);
              }
            }}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl transition-all ${bgClass} ${textClass} group-hover:scale-110`}>
                  {RESOURCE_ICONS[res.type] || <Truck size={18} />}
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">
                    {res.type.replace('_', ' ')}
                  </h4>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Active Fleet</div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="mono text-xs font-black text-slate-700">
                  {res.available} <span className="text-[10px] font-bold text-slate-300">/ {res.total}</span>
                </div>
                <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${textClass}`}>
                    {percent.toFixed(0)}% READY
                </div>
              </div>
            </div>

            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ease-out ${barColorClass}`} 
                style={{ width: `${percent}%` }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ResourceGrid;
