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
        className={`relative flex flex-col gap-3 p-3 transition-all cursor-pointer group 
          ${isNew ? 'animate-incident-new' : ''} 
          ${isResolved ? 'opacity-50 grayscale scale-[0.98]' : 'bg-aegis-bg-surface hover:bg-aegis-bg-elevated'}
          ${isDuplicate ? 'opacity-60' : ''}
          rounded-r border border-aegis-border border-l-0 shadow-lg mb-2`}
        style={{
          borderLeft: `${isMci ? '8px' : '4px'} solid var(--aegis-${incident.priority.toLowerCase()})`,
        }}
        onClick={() => !isResolved && onClick(incident)}
        onContextMenu={handleContextMenu}
      >
        {/* TOP ROW */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-aegis-${incident.priority.toLowerCase()}/10 text-aegis-${incident.priority.toLowerCase()} border border-aegis-${incident.priority.toLowerCase()}/30 w-[90px] text-center`}>
              {incident.priority} {isCritical ? 'CRITICAL' : 'ALERT'}
            </span>
            <div className="flex items-center gap-1.5 ml-1">
              <CategoryIcon category={incident.incident_type?.category} />
              <span className="text-[11px] font-bold text-aegis-text-primary uppercase tracking-wide">
                {incident.incident_type?.category?.replace('_', ' ') || 'Emergency'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isCritical && timeLeft !== null && (
              <span className={`mono text-[11px] font-bold ${timeLeft < 900000 ? 'text-aegis-critical animate-pulse' : 'text-aegis-medium'}`}>
                {formatTime(timeLeft)}
              </span>
            )}
            <span className="mono text-[10px] text-aegis-text-muted">
              {incident.timestamp ? Math.floor((new Date() - new Date(incident.timestamp)) / 60000) : 0}m ago
            </span>
          </div>
        </div>

        {/* MIDDLE ROW */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-1.5">
            <MapPin size={12} className="text-aegis-text-muted mt-0.5" />
            <span className="text-[13px] text-aegis-text-primary font-medium line-clamp-1">
              {incident.location?.raw_text || 'Unknown Location'}
            </span>
          </div>
          <div className="flex gap-2">
            <span className={`px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-widest border border-aegis-border
              ${incident.channel === 'whatsapp' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 
                incident.channel === 'voice' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 
                'bg-gray-500/10 text-gray-500 border-gray-500/30'}`}>
              {incident.channel || '112 Call'}
            </span>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="flex justify-between items-end border-t border-aegis-border/50 pt-2">
          <div className="flex items-center gap-2">
            {incident.assigned_resources?.slice(0, 3).map((res, i) => (
              <div key={i} className="flex items-center gap-1 bg-aegis-bg-base/50 px-1.5 py-0.5 rounded border border-aegis-border">
                <ResourceIcon type={res.resource_type} />
                <span className="text-[9px] mono text-aegis-text-secondary font-bold uppercase">
                  {res.resource_type.split('_')[0].slice(0, 3)}-{res.resource_type.split('_').pop()}
                </span>
              </div>
            ))}
            {(incident.assigned_resources?.length || 0) > 3 && (
              <span className="text-[9px] text-aegis-text-muted mono">+{incident.assigned_resources.length - 3}</span>
            )}
            {!incident.assigned_resources?.length && <span className="text-[9px] text-aegis-text-muted italic">Awaiting dispatch...</span>}
          </div>

          <div className="mono text-[10px] text-aegis-text-secondary font-bold bg-aegis-bg-base/50 px-2 py-0.5 rounded border border-aegis-border">
            {incident.assigned_resources?.[0]?.eta_minutes ? `${incident.assigned_resources[0].eta_minutes}m · 3.1km` : '--m · --km'}
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
          <div className="context-menu-item" onClick={() => { onResolve(incident.incident_id); closeContextMenu(); }}>
            <CheckCircle2 size={12} className="text-aegis-low" /> Mark Resolved
          </div>
          <div className="context-menu-item" onClick={() => { onAddNote(incident); closeContextMenu(); }}>
            <Copy size={12} className="text-aegis-info" /> Add Note
          </div>
          <div className="context-menu-item" onClick={() => { mViewTimeline(incident); closeContextMenu(); }}>
            <MoreHorizontal size={12} className="text-aegis-text-muted" /> View Timeline
          </div>
        </div>
      )}
    </>
  );
};

export default IncidentCard;
