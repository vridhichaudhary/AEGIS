import React from 'react';
import { ShieldAlert, AlertTriangle, Radio } from 'lucide-react';

const MCIPanel = ({ mciState }) => {
  if (!mciState || !mciState.active) return null;

  const { zone, details } = mciState;

  return (
    <div className="card priority-border-p1 bg-aegis-critical/5 mb-4 animate-pulse-slow overflow-hidden">
      <div className="bg-aegis-critical/10 p-3 flex justify-between items-center border-b border-aegis-critical/30">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-aegis-critical" size={24} />
          <div>
            <h2 className="font-bold text-aegis-text-primary tracking-[0.15em] uppercase text-lg leading-tight">MCI ACTIVE — {zone}</h2>
            <p className="text-aegis-critical text-[10px] font-bold uppercase tracking-[0.1em]">NDMA Protocol Level 4</p>
          </div>
        </div>
        <div className="bg-aegis-bg-base px-3 py-1.5 rounded border border-aegis-critical/30 flex flex-col items-end">
          <span className="text-[9px] text-aegis-text-muted mono font-bold">STABILIZATION ETA</span>
          <span className="text-sm font-bold text-aegis-critical mono tracking-wider">45:00 MIN</span>
        </div>
      </div>

      {details && (
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="p-2 rounded bg-aegis-bg-base border border-aegis-border">
            <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-aegis-border">
              <Radio size={10} className="text-aegis-high" />
              <h4 className="text-aegis-high text-[9px] font-bold uppercase tracking-widest">Mutual Aid Request</h4>
            </div>
            <p className="text-aegis-text-primary text-[11px] leading-relaxed">{details.mutual_aid_request}</p>
          </div>
          
          <div className="p-2 rounded bg-aegis-bg-base border border-aegis-border">
            <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-aegis-border">
              <AlertTriangle size={10} className="text-aegis-high" />
              <h4 className="text-aegis-high text-[9px] font-bold uppercase tracking-widest">Hospital Alert</h4>
            </div>
            <p className="text-aegis-text-primary text-[11px] leading-relaxed">{details.hospital_alert}</p>
          </div>

          <div className="p-2 rounded bg-aegis-bg-base border border-aegis-border col-span-2">
            <h4 className="text-aegis-text-muted text-[9px] font-bold uppercase tracking-widest mb-1.5 pb-1 border-b border-aegis-border">Resource Gap Analysis</h4>
            <p className="text-aegis-text-primary text-[11px] leading-relaxed">{details.resource_gap_analysis}</p>
          </div>

          <div className="p-2 rounded bg-aegis-critical/5 border border-aegis-critical/20 col-span-2">
            <h4 className="text-aegis-critical text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <span className="status-dot status-dot-offline"></span>
              Public Advisory Draft
            </h4>
            <p className="text-aegis-text-secondary text-[11px] italic leading-relaxed">"{details.media_advisory_draft}"</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCIPanel;
