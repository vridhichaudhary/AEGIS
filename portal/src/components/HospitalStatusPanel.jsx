import React from 'react';
import { Building2 as HospitalIcon, Flame as FireIcon, Activity, Thermometer } from 'lucide-react';

const CapacityBox = ({ icon: Icon, title, value, label, status, onClick }) => (
    <div 
        onClick={onClick}
        className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group"
    >
        <div className="flex justify-between items-start">
            <div className={`p-2.5 rounded-xl transition-colors ${status === 'critical' ? 'bg-red-50 text-red-600' : status === 'warning' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                <Icon size={18} />
            </div>
            <div className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${status === 'critical' ? 'bg-red-100 text-red-700' : status === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {status === 'critical' ? 'Low' : status === 'warning' ? 'Alert' : 'Normal'}
            </div>
        </div>
        <div className="min-w-0">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{title}</h4>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">{value}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
            </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ${status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-orange-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (value / 15) * 100)}%` }}
                />
            </div>
        </div>
    </div>
);

const StationStatusPanel = ({ hospitals = [], depots = [], onFocus }) => {
  const fireStations = (depots || []).filter(d => d.type === 'fire');

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 gap-4 p-4 overflow-y-auto custom-scrollbar h-full">
        {/* Hospitals */}
        <div className="flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md py-2 z-10 mb-2">
            <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Activity size={14} /> Medical Facilities
            </div>
            <div className="h-[1px] flex-1 bg-slate-100 mx-4" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            {hospitals.map((hospital) => {
                const beds = hospital.available;
                let status = "success";
                if (beds < 2) status = "critical";
                else if (beds <= 5) status = "warning";

                return (
                    <CapacityBox 
                        key={hospital.id}
                        icon={HospitalIcon}
                        title={hospital.name}
                        value={beds}
                        label="Beds"
                        status={status}
                        onClick={() => onFocus && onFocus({ lat: hospital.lat, lng: hospital.lng })}
                    />
                );
            })}
        </div>

        {/* Fire Stations */}
        <div className="flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md py-2 z-10 mt-6 mb-2">
            <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Thermometer size={14} /> Fire Rescue
            </div>
            <div className="h-[1px] flex-1 bg-slate-100 mx-4" />
        </div>

        <div className="grid grid-cols-2 gap-4 pb-4">
            {fireStations.map((station) => {
                const trucks = station.available?.fire_trucks || 0;
                let status = "success";
                if (trucks === 0) status = "critical";
                else if (trucks === 1) status = "warning";

                return (
                    <CapacityBox 
                        key={station.id}
                        icon={FireIcon}
                        title={station.name}
                        value={trucks}
                        label="Trucks"
                        status={status}
                        onClick={() => onFocus && onFocus({ lat: station.lat, lng: station.lng })}
                    />
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default StationStatusPanel;
