import React, { useState, useEffect } from 'react';

const HospitalStatusPanel = ({ hospitals = [], currentIncident }) => {
  const [pulseHospitals, setPulseHospitals] = useState({});

  useEffect(() => {
    // When hospitals update, check for changed bed counts to trigger pulse
    const newPulses = {};
    hospitals.forEach(h => {
      newPulses[h.id] = true;
    });
    setPulseHospitals(newPulses);
    
    const timer = setTimeout(() => {
      setPulseHospitals({});
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [hospitals]);

  if (!hospitals || hospitals.length === 0) return null;

  return (
    <div className="glass rounded-xl overflow-hidden shadow-lg border border-teal-500/30 flex flex-col mt-4">
      <div className="bg-teal-900/30 p-3 flex justify-between items-center border-b border-teal-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold text-teal-300">Regional Hospital Status</h3>
        </div>
      </div>
      
      <div className="p-3 grid grid-cols-2 gap-3 bg-black/40">
        {hospitals.map((hospital) => {
          const isPulsing = pulseHospitals[hospital.id];
          const beds = hospital.available;
          
          let bedColorClass = "text-green-400 border-green-500/50 bg-green-900/20";
          if (beds < 2) bedColorClass = "text-red-400 border-red-500/50 bg-red-900/20";
          else if (beds <= 5) bedColorClass = "text-amber-400 border-amber-500/50 bg-amber-900/20";

          return (
            <div 
              key={hospital.id} 
              className={`bg-gray-800/80 rounded-lg p-3 border border-gray-700 transition-all ${isPulsing ? 'scale-[1.02] border-teal-500 shadow-[0_0_10px_rgba(45,212,191,0.5)]' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-xs font-bold text-white truncate max-w-[70%]">{hospital.name}</h4>
                <div className={`text-xs font-bold px-2 py-0.5 rounded border flex flex-col items-center ${bedColorClass}`}>
                  <span>{beds}</span>
                  <span className="text-[8px] uppercase tracking-tighter opacity-80">Beds</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1 mb-2">
                {hospital.specialties.map(spec => (
                  <span key={spec} className="text-[9px] bg-gray-700/50 text-gray-300 px-1.5 py-0.5 rounded border border-gray-600">
                    {spec}
                  </span>
                ))}
              </div>

              {currentIncident && currentIncident.location && currentIncident.location.latitude ? (
                <div className="text-[10px] text-gray-400 flex justify-between items-center border-t border-gray-700/50 pt-2 mt-2">
                  <span>Dist to incident:</span>
                  <span className="font-mono text-teal-300">
                    {calculateDistance(
                      currentIncident.location.latitude,
                      currentIncident.location.longitude,
                      hospital.lat,
                      hospital.lng
                    ).toFixed(1)} km
                  </span>
                </div>
              ) : (
                <div className="text-[10px] text-gray-500 italic mt-2">Awaiting incident data...</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Simple Haversine for frontend display
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
