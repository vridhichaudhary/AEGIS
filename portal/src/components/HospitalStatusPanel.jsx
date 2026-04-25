import React from 'react';

const HospitalStatusPanel = ({ hospitals = [], onFocus }) => {
  if (!hospitals || hospitals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-aegis-text-muted text-[10px] uppercase tracking-widest opacity-50 italic">
        <p>No hospital data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hospitals.map((hospital) => {
        const beds = hospital.available;
        let bedBadgeClass = "badge-success";
        if (beds < 2) bedBadgeClass = "badge-critical";
        else if (beds <= 5) bedBadgeClass = "badge-warning";

        return (
          <div 
            key={hospital.id} 
            className="flex justify-between items-center p-2 rounded hover:bg-aegis-bg-elevated/50 transition-colors cursor-pointer group"
            onClick={() => onFocus && onFocus({ lat: hospital.lat, lng: hospital.lng })}
          >
            <div className="flex flex-col min-w-0">
              <h4 className="text-[11px] font-bold text-aegis-text-primary truncate uppercase tracking-wide">
                {hospital.name}
              </h4>
              <div className="flex gap-1 overflow-hidden">
                {hospital.specialties.slice(0, 1).map(spec => (
                  <span key={spec} className="text-[9px] text-aegis-text-muted font-medium uppercase truncate">
                    {spec}
                  </span>
                ))}
              </div>
            </div>
            <div className={`badge ${bedBadgeClass} badge-xs px-2 py-0.5 min-w-[32px] flex justify-center mono font-bold`}>
              {beds}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HospitalStatusPanel;
