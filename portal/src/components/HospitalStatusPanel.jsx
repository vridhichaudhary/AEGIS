import React, { useState, useEffect } from 'react';

const HospitalStatusPanel = ({ hospitals = [], currentIncident }) => {
  const [pulseHospitals, setPulseHospitals] = useState({});

  useEffect(() => {
    const newPulses = {};
    hospitals.forEach(h => { newPulses[h.id] = true; });
    setPulseHospitals(newPulses);
    const timer = setTimeout(() => setPulseHospitals({}), 800);
    return () => clearTimeout(timer);
  }, [hospitals]);

  if (!hospitals || hospitals.length === 0) return null;

  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface overflow-hidden">
      <div className="section-header flex justify-between items-center">
        <span>Regional Hospital Status</span>
        <span className="badge badge-info badge-xs">LIVE</span>
      </div>
      
      <div className="p-3 grid grid-cols-1 gap-2 bg-aegis-bg-base/30">
        {hospitals.map((hospital) => {
          const isPulsing = pulseHospitals[hospital.id];
          const beds = hospital.available;
          
          let bedBadgeClass = "badge-success";
          if (beds < 2) bedBadgeClass = "badge-critical";
          else if (beds <= 5) bedBadgeClass = "badge-warning";

          return (
            <div 
              key={hospital.id} 
              className={`bg-aegis-bg-surface rounded p-2 border border-aegis-border transition-all ${isPulsing ? 'border-aegis-info bg-aegis-info/5' : ''}`}
            >
              <div className="flex justify-between items-center mb-1.5">
                <h4 className="text-[11px] font-bold text-aegis-text-primary truncate max-w-[140px] uppercase tracking-wide">{hospital.name}</h4>
                <div className={`badge ${bedBadgeClass} badge-xs px-2 py-0 min-w-[32px] flex justify-center mono`}>
                  {beds} <span className="text-[7px] ml-0.5 opacity-70">BEDS</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1 mb-1.5">
                {hospital.specialties.slice(0, 3).map(spec => (
                  <span key={spec} className="text-[8px] bg-aegis-bg-elevated text-aegis-text-muted px-1 py-0.5 rounded border border-aegis-border font-bold uppercase">
                    {spec}
                  </span>
                ))}
              </div>

              {currentIncident?.location?.latitude ? (
                <div className="text-[9px] text-aegis-text-muted flex justify-between items-center border-t border-aegis-border pt-1.5">
                  <span className="uppercase tracking-widest opacity-70">Distance</span>
                  <span className="mono font-bold text-aegis-info">
                    {calculateDistance(
                      currentIncident.location.latitude,
                      currentIncident.location.longitude,
                      hospital.lat,
                      hospital.lng
                    ).toFixed(1)} KM
                  </span>
                </div>
              ) : (
                <div className="text-[9px] text-aegis-text-muted italic opacity-50">Standby for triage...</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default HospitalStatusPanel;
