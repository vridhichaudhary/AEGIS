import React, { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, Copy, Trash2, MoreHorizontal } from 'lucide-react';

const CategoryIcon = ({ category }) => {
  const cat = (category || 'emergency').toLowerCase();
  if (cat.includes('fire')) return <div className="shape-flame" />;
  if (cat.includes('medical') || cat.includes('accident')) return <div className="shape-pulse" />;
  if (cat.includes('police') || cat.includes('crime')) return <div className="shape-badge" />;
  return <div className="shape-buoy" />;
};

const ResourceIcon = ({ type }) => {
  const t = (type || '').toLowerCase();
  if (t.includes('ambulance') || t.includes('medic')) return <div className="res-shape res-medic" />;
  if (t.includes('fire')) return <div className="res-shape res-fire" />;
  if (t.includes('police')) return <div className="res-shape res-police" />;
  return <div className="res-shape bg-aegis-info" />;
};

const IncidentCard = ({ incident, onClick, onResolve, onAddNote, mViewTimeline, isMci }) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isNew, setIsNew] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsNew(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!incident.golden_hour_deadline) return;
    const update = () => {
      const diff = new Date(incident.golden_hour_deadline) - new Date();
      setTimeLeft(diff > 0 ? diff : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [incident.golden_hour_deadline]);

  const formatTime = (ms) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const isCritical = incident.priority === 'P1' || incident.priority === 'P2';
  const isDuplicate = incident.dispatch_status === 'merged_duplicate';
  const isResolved = incident.incident_status === 'RESOLVED';

  return (
    <>
      <div
        className={`relative flex flex-col gap-3 p-4 transition-all cursor-pointer group 
          ${isNew ? 'animate-incident-new ring-2 ring-aegis-accent ring-offset-2' : ''} 
          ${isResolved ? 'opacity-50 grayscale bg-slate-50' : 'bg-white hover:bg-slate-50'}
          ${isDuplicate ? 'opacity-60' : ''}
          rounded-xl border border-slate-200 shadow-sm hover:shadow-md mb-3`}
        style={{
          borderLeft: `${isMci ? '8px' : '4px'} solid ${isCritical ? '#C53030' : '#B7791F'}`,
        }}
        onClick={() => !isResolved && onClick(incident)}
        onContextMenu={handleContextMenu}
      >
        {/* TOP ROW */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className={`badge badge-${incident.priority.toLowerCase()} min-w-[80px] justify-center`}>
              {incident.priority} {isCritical ? 'CRITICAL' : 'ALERT'}
            </span>
            <div className="flex items-center gap-2 ml-1">
              <CategoryIcon category={incident.incident_type?.category} />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                {incident.incident_type?.category?.replace('_', ' ') || 'Emergency'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isCritical && timeLeft !== null && (
              <span className={`mono text-[11px] font-bold ${timeLeft < 900000 ? 'text-red-600 animate-pulse' : 'text-amber-600'}`}>
                {formatTime(timeLeft)}
              </span>
            )}
            <span className="mono text-[10px] font-bold text-slate-400">
              {incident.timestamp ? Math.floor((new Date() - new Date(incident.timestamp)) / 60000) : 0}m ago
            </span>
          </div>
        </div>

        {/* MIDDLE ROW */}
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-slate-400 mt-0.5" />
            <span className="text-sm text-slate-800 font-semibold line-clamp-1">
              {incident.location?.raw_text || 'Unknown Location'}
            </span>
          </div>
          <div className="flex gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border
              ${incident.channel === 'whatsapp' ? 'bg-green-50 text-green-700 border-green-200' : 
                incident.channel === 'voice' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                'bg-slate-50 text-slate-700 border-slate-200'}`}>
              {incident.channel || '112 Call'}
            </span>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="flex justify-between items-end border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            {incident.assigned_resources?.slice(0, 3).map((res, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                <ResourceIcon type={res.resource_type} />
                <span className="text-[10px] mono text-slate-600 font-bold uppercase">
                  {res.resource_type.split('_')[0].slice(0, 3)}-{res.resource_type.split('_').pop()}
                </span>
              </div>
            ))}
            {(incident.assigned_resources?.length || 0) > 3 && (
              <span className="text-[10px] text-slate-400 font-bold">+{incident.assigned_resources.length - 3}</span>
            )}
            {!incident.assigned_resources?.length && <span className="text-[10px] text-slate-400 italic">Deploying...</span>}
          </div>

          <div className="mono text-[10px] text-slate-500 font-bold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            {incident.assigned_resources?.[0]?.eta_minutes ? `${incident.assigned_resources[0].eta_minutes}m · 3.1km` : '--m'}
          </div>
        </div>

        {/* OVERLAYS */}
        {isDuplicate && (
          <div className="absolute inset-0 bg-aegis-medium/10 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-aegis-medium text-aegis-bg-base text-[10px] font-black px-3 py-1 rounded shadow-xl tracking-tighter">MERGED</span>
          </div>
        )}

        {isResolved && (
          <div className="absolute inset-0 bg-aegis-bg-base/20 flex items-center justify-center">
             <span className="bg-aegis-low text-white text-[10px] font-black px-3 py-1 rounded shadow-xl tracking-tighter uppercase">Resolved</span>
          </div>
        )}
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={closeContextMenu}
        >
          <div className="context-menu-item" onClick={() => { onResolve?.(incident.incident_id); closeContextMenu(); }}>
            <CheckCircle2 size={12} className="text-aegis-low" /> Mark Resolved
          </div>
          <div className="context-menu-item" onClick={() => { onAddNote?.(incident); closeContextMenu(); }}>
            <Copy size={12} className="text-aegis-info" /> Add Note
          </div>
          <div className="context-menu-item" onClick={() => { mViewTimeline?.(incident); closeContextMenu(); }}>
            <MoreHorizontal size={12} className="text-aegis-text-muted" /> View Timeline
          </div>
        </div>
      )}
    </>
  );
};

export default IncidentCard;
