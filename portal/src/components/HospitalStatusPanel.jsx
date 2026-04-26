import React from 'react';
import { Building2 as HospitalIcon, Flame as FireIcon } from 'lucide-react';

const StationStatusPanel = ({ hospitals = [], depots = [], onFocus }) => {
  const fireStations = (depots || []).filter(d => d.type === 'fire');

  return (
    <div className="flex flex-col gap-1 p-2 overflow-y-auto max-h-[300px]">
      {/* Hospitals */}
      <div className="admin-section-label sticky top-0 bg-white z-10">Medical Facilities</div>
      {hospitals.map((hospital) => {
        const beds = hospital.available;
        let bedStatus = "success";
        if (beds < 2) bedStatus = "critical";
        else if (beds <= 5) bedStatus = "warning";

        return (
          <div 
            key={hospital.id} 
            className="flex justify-between items-center p-3 rounded-xl hover:bg-white transition-all cursor-pointer group hover:shadow-sm"
            onClick={() => onFocus && onFocus({ lat: hospital.lat, lng: hospital.lng })}
          >
            <div className="flex items-center gap-3 min-w-0">
               <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                  <HospitalIcon size={16} />
               </div>
               <div className="flex flex-col min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate uppercase tracking-tight">
                    {hospital.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-bold uppercase truncate">
                    {hospital.specialties[0]}
                  </span>
               </div>
            </div>
            <div className={`badge badge-${bedStatus} min-w-[50px] justify-center mono`}>
              {beds} BEDS
            </div>
          </div>
        );
      })}

      {/* Fire Stations */}
      <div className="admin-section-label sticky top-0 bg-white z-10 mt-4">Fire Rescue Stations</div>
      {fireStations.map((station) => {
        const trucks = station.available?.fire_trucks || 0;
        let truckStatus = "success";
        if (trucks === 0) truckStatus = "critical";
        else if (trucks === 1) truckStatus = "warning";

        return (
          <div 
            key={station.id} 
            className="flex justify-between items-center p-3 rounded-xl hover:bg-white transition-all cursor-pointer group hover:shadow-sm"
            onClick={() => onFocus && onFocus({ lat: station.lat, lng: station.lng })}
          >
            <div className="flex items-center gap-3 min-w-0">
               <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:text-orange-600 group-hover:bg-orange-50 transition-colors">
                  <FireIcon size={16} />
               </div>
               <div className="flex flex-col min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate uppercase tracking-tight">
                    {station.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-bold uppercase truncate">
                    FIRE & RESCUE
                  </span>
               </div>
            </div>
            <div className={`badge badge-${truckStatus} min-w-[60px] justify-center mono`}>
              {trucks} TRUCKS
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StationStatusPanel;

