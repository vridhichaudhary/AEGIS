import React, { useState, useEffect } from 'react';
import { Clock, MapPin, AlertCircle, ShieldAlert, Mic } from 'lucide-react';

const CHANNEL_META = {
  whatsapp:     { label: 'WhatsApp', badge: 'W', color: 'badge-whatsapp' },
  voice_upload: { label: 'Audio Upload', badge: '🎙', color: 'badge-purple' },
  voice_call:   { label: '112 Call', badge: '📞', color: 'badge-blue' },
  operator:     { label: 'Operator', badge: 'OP', color: 'badge-muted' },
};

const ChannelBadge = ({ channel, audioSource }) => {
  const ch = channel || (audioSource === 'voice_upload' ? 'voice_upload' : 'voice_call');
  const meta = CHANNEL_META[ch] || CHANNEL_META.voice_call;
  return (
    <span className={`badge ${meta.color} text-[9px] px-1.5 py-0.5`}>
      {meta.badge} {meta.label}
    </span>
  );
};

const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const target = new Date(deadline).getTime();
    
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setTimeLeft(diff);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  
  let colorClass = 'badge-success';
  if (minutes < 15) colorClass = 'badge-critical';
  else if (minutes < 30) colorClass = 'badge-warning';

  return (
    <div className={`badge ${colorClass} font-mono px-2 py-1`}>
      <Clock size={10} className={minutes < 15 ? "animate-pulse" : ""} />
      <span>{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
};

const CoordinationTimeline = ({ timings }) => {
  if (!timings || !timings.is_multi_agency) return null;

  return (
    <div className="mt-2 p-2 rounded bg-aegis-bg-base border border-aegis-border">
      <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-aegis-border">
        <span className="text-[9px] font-bold text-aegis-info uppercase tracking-widest flex items-center gap-1">
          <ShieldAlert size={10} /> Joint Ops Timeline
        </span>
        <span className="text-[9px] mono text-aegis-text-muted">
          Gap: <span className="text-aegis-info font-bold">{timings.coordination_gap_seconds}s</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {timings.timeline.map((t, i) => (
          <div key={i} className="flex justify-between items-center text-[10px]">
            <div className="flex items-center gap-2">
              <span className="mono text-aegis-text-muted">{i+1}</span>
              <span className={`font-bold ${t.agency === 'POLICE' ? 'text-aegis-info' : t.agency === 'FIRE' ? 'text-aegis-high' : 'text-aegis-low'}`}>
                {t.agency}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 bg-aegis-bg-surface rounded-full w-10 overflow-hidden">
                 <div className="h-full bg-aegis-info/50" style={{ width: `${Math.min(100, (t.delay_seconds / timings.coordination_gap_seconds) * 100 || 100)}%` }}></div>
              </div>
              <span className="mono text-aegis-text-muted">+{t.delay_seconds}s</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PriorityQueue = ({ incidents, onResolve, onFocus }) => {
  const [activeTab, setActiveTab] = useState('ALL');

  const agencyFilter = (incident) => {
    if (activeTab === 'ALL') return true;
    if (incident.agency_timings && incident.agency_timings.timeline) {
      return incident.agency_timings.timeline.some(t => t.agency === activeTab);
    }
    if (!incident.assigned_resources) return false;
    const reqs = incident.assigned_resources.map(r => r.resource_type.toLowerCase());
    if (activeTab === 'POLICE') return reqs.some(r => r.includes('police'));
    if (activeTab === 'FIRE') return reqs.some(r => r.includes('fire') || r.includes('rescue'));
    if (activeTab === 'MEDICAL') return reqs.some(r => r.includes('ambulance'));
    return false;
  };

  const sortedIncidents = [...incidents]
    .filter(i => i.dispatch_status !== 'merged_duplicate')
    .filter(agencyFilter)
    .sort((a, b) => {
      if (a.dispatch_status === 'review_required' && b.dispatch_status !== 'review_required') return -1;
      if (b.dispatch_status === 'review_required' && a.dispatch_status !== 'review_required') return 1;
      
      const priorityMap = { P1: 5, P2: 4, P3: 3, P4: 2, P5: 1 };
      const scoreA = priorityMap[a.priority] || 0;
      const scoreB = priorityMap[b.priority] || 0;
      
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

  const priorityBadges = {
    P1: 'badge-p1',
    P2: 'badge-p2',
    P3: 'badge-p3',
    P4: 'badge-p4',
    P5: 'badge-p5'
  };

  const tabs = [
    { id: 'ALL', label: 'All Incidents' },
    { id: 'POLICE', label: 'Police' },
    { id: 'FIRE', label: 'Fire' },
    { id: 'MEDICAL', label: 'Medical' }
  ];

  return (
    <div className="card-flush flex flex-col h-full bg-aegis-bg-surface">
      <div className="section-header flex justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} className="text-aegis-critical" />
          <span>Priority Queue</span>
        </div>
        <span className="mono text-[10px] text-aegis-text-muted">{sortedIncidents.length} Active</span>
      </div>
      
      {/* Agency Tabs */}
      <div className="flex px-3 py-2 gap-1 border-b border-aegis-border bg-aegis-bg-elevated/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-xs ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {sortedIncidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-aegis-text-muted text-xs opacity-50 uppercase tracking-widest">
            <p>System Ready</p>
            <p className="text-[10px] mt-1">Awaiting Incidents</p>
          </div>
        ) : (
          sortedIncidents.map((incident, idx) => {
            const isCritical = incident.priority === 'P1' || incident.priority === 'P2';
            const isReviewQueue = incident.dispatch_status === 'review_required';
            const isJointOps = incident.agency_timings?.is_multi_agency;
            const priorityClass = `priority-border-${incident.priority.toLowerCase()}`;
            
            return (
              <div
                key={incident.incident_id}
                className={`card p-3 animate-slide-up flex flex-col relative cursor-pointer hover:border-aegis-accent transition-all ${isReviewQueue ? 'priority-border-p1 bg-aegis-critical/5' : priorityClass}`}
                style={{ animationDelay: `${idx * 40}ms` }}
                onClick={() => onFocus && onFocus(incident)}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${isReviewQueue ? 'badge-critical' : priorityBadges[incident.priority]}`}>
                      {incident.priority}
                    </span>
                    <span className="font-semibold text-aegis-text-primary text-[13px]">
                      {incident.incident_type?.category?.replace('_', ' ') || 'Emergency'}
                    </span>
                    {isJointOps && (
                       <span className="badge badge-info text-[9px] px-1.5">JOINT OPS</span>
                    )}
                    {incident.audio_source === 'voice_upload' && (
                       <span className="badge badge-purple text-[9px] px-1.5 flex items-center gap-1">
                         <Mic size={10} /> AUDIO
                       </span>
                    )}
                    <ChannelBadge channel={incident.channel} audioSource={incident.audio_source} />
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    {isReviewQueue ? (
                      <span className="badge badge-critical animate-pulse text-[9px]">PENDING REVIEW</span>
                    ) : (
                      <span className={`text-[10px] font-bold mono ${
                        incident.dispatch_status === 'assigned' ? 'text-aegis-low' :
                        incident.dispatch_status === 'pending' ? 'text-aegis-medium' :
                        'text-aegis-text-muted'
                      }`}>
                        {incident.dispatch_status?.toUpperCase()}
                      </span>
                    )}
                    {isCritical && incident.golden_hour_deadline && !isReviewQueue && (
                      <CountdownTimer deadline={incident.golden_hour_deadline} />
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-xs text-aegis-text-secondary mb-2">
                  <MapPin size={12} className="mt-0.5 flex-shrink-0 text-aegis-text-muted" />
                  <span className="line-clamp-1">{incident.location?.raw_text || 'Location unknown'}</span>
                </div>

                {isJointOps && !isReviewQueue && <CoordinationTimeline timings={incident.agency_timings} />}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-aegis-border">
                  <div className="flex items-center gap-1.5 text-aegis-text-muted mono text-[10px]">
                    <Clock size={10} />
                    <span>
                      {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                      }) : '--:--:--'}
                    </span>
                  </div>
                  
                  {incident.assigned_resources?.length > 0 && !isReviewQueue && (
                    <div className="flex items-center gap-2">
                      <span className="text-aegis-info font-bold text-[10px] uppercase">
                        {incident.assigned_resources.length} Units
                      </span>
                      {incident.assigned_resources[0]?.eta_minutes && (
                        <span className="badge badge-info text-[9px]">
                          ETA {incident.assigned_resources[0].eta_minutes}m
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {incident.golden_hour_at_risk && !isReviewQueue && incident.incident_status !== 'RESOLVED' && (
                  <div className="mt-2 py-1 px-2 rounded bg-aegis-critical/10 border border-aegis-critical/20 text-aegis-critical text-[9px] font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
                    <AlertCircle size={10} className="animate-pulse" /> 
                    <span>GOLDEN HOUR AT RISK</span>
                  </div>
                )}

                {incident.incident_status !== 'RESOLVED' && !isReviewQueue && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onResolve(incident.incident_id); }}
                    className="btn btn-ghost btn-xs w-full mt-2"
                  >
                    Resolve Incident
                  </button>
                )}

                {incident.incident_status === 'RESOLVED' && (
                  <div className="mt-2 py-1 bg-aegis-low/10 text-aegis-low text-[9px] font-bold uppercase tracking-widest rounded border border-aegis-low/20 text-center">
                    Resolved
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PriorityQueue;