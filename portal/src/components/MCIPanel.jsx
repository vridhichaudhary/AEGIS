import React from 'react';

const MCIPanel = ({ mciState }) => {
  if (!mciState || !mciState.active) return null;

  const { zone, details } = mciState;

  return (
    <div className="bg-red-950/40 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.3)] border-2 border-red-500/50 flex flex-col mb-4 animate-pulse-slow">
      <div className="bg-red-900/60 p-3 flex justify-between items-center border-b border-red-500/50">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-bounce">🚨</span>
          <div>
            <h2 className="font-black text-red-200 tracking-widest uppercase text-lg leading-tight">MCI ACTIVE — {zone}</h2>
            <p className="text-red-400 text-xs font-bold uppercase tracking-wider">NDMA Protocol Activated</p>
          </div>
        </div>
        <div className="bg-red-950/80 px-3 py-1 rounded border border-red-500/50">
          <span className="text-xs text-red-300 font-mono">T-MINUS</span>
          <span className="text-lg font-bold text-red-400 ml-2 font-mono tracking-wider">
             EST 45m
          </span>
        </div>
      </div>

      {details && (
        <div className="p-4 grid grid-cols-2 gap-4">
          <div className="bg-black/50 p-3 rounded-lg border border-red-500/30">
            <h4 className="text-red-400 text-[10px] font-bold uppercase tracking-widest mb-1 border-b border-red-500/20 pb-1">Mutual Aid Request</h4>
            <p className="text-red-100 text-sm">{details.mutual_aid_request}</p>
          </div>
          <div className="bg-black/50 p-3 rounded-lg border border-red-500/30">
            <h4 className="text-red-400 text-[10px] font-bold uppercase tracking-widest mb-1 border-b border-red-500/20 pb-1">Hospital Alert</h4>
            <p className="text-red-100 text-sm">{details.hospital_alert}</p>
          </div>
          <div className="bg-black/50 p-3 rounded-lg border border-red-500/30 col-span-2">
            <h4 className="text-red-400 text-[10px] font-bold uppercase tracking-widest mb-1 border-b border-red-500/20 pb-1">Resource Gap Analysis</h4>
            <p className="text-red-100 text-sm">{details.resource_gap_analysis}</p>
          </div>
          <div className="bg-red-900/20 p-3 rounded-lg border border-red-500/30 col-span-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <h4 className="text-red-400 text-[10px] font-bold uppercase tracking-widest mb-1">Public Media Advisory</h4>
            <p className="text-red-200 text-xs italic">"{details.media_advisory_draft}"</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCIPanel;
