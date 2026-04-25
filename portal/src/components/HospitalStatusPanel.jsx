import React from 'react';
import { Building2 as HospitalIcon } from 'lucide-react';

const HospitalStatusPanel = ({ hospitals = [], onFocus }) => {
  if (!hospitals || hospitals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-[10px] uppercase tracking-widest italic">
        <p>Awaiting Hospital Link...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
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
    </div>
  );
};

export default HospitalStatusPanel;
