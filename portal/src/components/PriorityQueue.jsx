import React, { useState, useEffect } from 'react';
import { Clock, MapPin, AlertCircle, ShieldAlert, Mic } from 'lucide-react';

const CHANNEL_META = {
  whatsapp:     { label: 'WhatsApp', badge: 'W', color: 'text-green-300 bg-green-900/30 border-green-500/40' },
  voice_upload: { label: 'Audio Upload', badge: '🎙', color: 'text-purple-300 bg-purple-900/30 border-purple-500/40' },
  voice_call:   { label: '112 Call', badge: '📞', color: 'text-blue-300 bg-blue-900/30 border-blue-500/40' },
  operator:     { label: 'Operator', badge: 'OP', color: 'text-gray-300 bg-gray-800/50 border-gray-600/40' },
};

const ChannelBadge = ({ channel, audioSource }) => {
  const ch = channel || (audioSource === 'voice_upload' ? 'voice_upload' : 'voice_call');
  const meta = CHANNEL_META[ch] || CHANNEL_META.voice_call;
  return (
    <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-widest flex items-center gap-0.5 ${meta.color}`}>
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
  
  let color = 'text-green-400 border-green-500/30 bg-green-500/10';
  if (minutes < 15) color = 'text-red-400 border-red-500/30 bg-red-500/10';
  else if (minutes < 30) color = 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';

  return (
    <div className={`flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded border ${color} shadow-inner`}>
      <Clock size={12} className={minutes < 15 ? "animate-pulse" : ""} />
      <span className="font-bold">{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
};

const CoordinationTimeline = ({ timings }) => {
  if (!timings || !timings.is_multi_agency) return null;

  return (
    <div className="mt-3 bg-[#0A1118]/80 rounded-lg p-3 border border-indigo-500/30 shadow-inner">
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700/50">
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <ShieldAlert size={12} className="animate-pulse" /> Joint Ops Timeline
        </span>
        <span className="text-[10px] font-mono text-gray-400">
          Coord Gap: <span className="text-indigo-300 font-bold">{timings.coordination_gap_seconds}s</span>
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {timings.timeline.map((t, i) => (
          <div key={i} className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="w-4 text-center font-mono text-[9px] text-gray-500">{i+1}</span>
              <span className={`font-bold tracking-wider ${t.agency === 'POLICE' ? 'text-blue-400' : t.agency === 'FIRE' ? 'text-orange-400' : 'text-green-400'}`}>
                {t.agency}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 bg-gray-700 rounded-full w-12 overflow-hidden flex justify-end">
                 <div className="h-full bg-indigo-500/50 rounded-full" style={{ width: `${Math.min(100, (t.delay_seconds / timings.coordination_gap_seconds) * 100 || 100)}%` }}></div>
              </div>
              <span className="font-mono text-[10px] text-gray-400 w-10 text-right">+{t.delay_seconds}s</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PriorityQueue = ({ incidents, onResolve }) => {
  const [activeTab, setActiveTab] = useState('ALL');

  const agencyFilter = (incident) => {
    if (activeTab === 'ALL') return true;
    if (incident.agency_timings && incident.agency_timings.timeline) {
      return incident.agency_timings.timeline.some(t => t.agency === activeTab);
    }
    // fallback
    if (!incident.assigned_resources) return false;
    const reqs = incident.assigned_resources.map(r => r.resource_type.toLowerCase());
    if (activeTab === 'POLICE') return reqs.some(r => r.includes('police'));
    if (activeTab === 'FIRE') return reqs.some(r => r.includes('fire') || r.includes('rescue'));
    if (activeTab === 'MEDICAL') return reqs.some(r => r.includes('ambulance'));
    return false;
  };

  const hasJointOps = incidents.some(i => i.agency_timings?.is_multi_agency && i.dispatch_status !== 'merged_duplicate');

  // Sort by priority, but push review_required to the top so they are always visible
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

  const priorityColors = {
    P1: 'from-red-500 to-red-600',
    P2: 'from-orange-500 to-orange-600',
    P3: 'from-yellow-500 to-yellow-600',
    P4: 'from-green-500 to-green-600',
    P5: 'from-gray-500 to-gray-600'
  };

  const priorityBorders = {
    P1: 'border-red-500',
    P2: 'border-orange-500',
    P3: 'border-yellow-500',
    P4: 'border-green-500',
    P5: 'border-gray-500'
  };

  const tabs = [
    { id: 'ALL', label: 'All Incidents' },
    { id: 'POLICE', label: 'Police 100', color: 'text-blue-400', bg: 'bg-blue-500' },
    { id: 'FIRE', label: 'Fire 101', color: 'text-orange-400', bg: 'bg-orange-500' },
    { id: 'MEDICAL', label: 'Medical 108', color: 'text-green-400', bg: 'bg-green-500' }
  ];

  return (
    <div className="glass-card rounded-xl p-5 h-full flex flex-col shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <AlertCircle className="text-red-400" size={20} />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">
            Priority Queue
          </span>
        </h2>
        <div className="flex gap-2">
          {hasJointOps && (
             <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-400/30 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
               <ShieldAlert size={12} /> Joint Ops Active
             </span>
          )}
          <span className="text-xs bg-red-500/20 px-3 py-1 rounded-full border border-red-400/30 font-semibold">
            {sortedIncidents.length} Active
          </span>
        </div>
      </div>
      
      {/* Agency Tabs */}
      <div className="flex space-x-1 bg-gray-900/50 p-1 rounded-lg mb-4 border border-gray-700/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-[11px] font-bold uppercase tracking-wider py-1.5 rounded-md transition-all ${
              activeTab === tab.id 
                ? `${tab.bg ? tab.bg + '/20' : 'bg-gray-700/50'} text-white border border-gray-600 shadow-sm` 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="space-y-3 flex-1 overflow-auto pr-1 custom-scrollbar">
        {sortedIncidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm opacity-70">
            <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p className="font-medium">No Incidents for {tabs.find(t => t.id === activeTab).label}</p>
            <p className="text-xs mt-1">System Ready</p>
          </div>
        ) : (
          sortedIncidents.map((incident, idx) => {
            const isCritical = incident.priority === 'P1' || incident.priority === 'P2';
            const isReviewQueue = incident.dispatch_status === 'review_required';
            const isJointOps = incident.agency_timings?.is_multi_agency;
            
            return (
              <div
                key={incident.incident_id}
                className={`glass p-4 rounded-lg border-l-4 ${isReviewQueue ? 'border-amber-500 bg-amber-900/10' : priorityBorders[incident.priority]} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-slide-up flex flex-col relative`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Background glow for joint ops */}
                {isJointOps && !isReviewQueue && (
                  <div className="absolute inset-0 bg-indigo-500/5 rounded-lg pointer-events-none border border-indigo-500/10"></div>
                )}
                
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`bg-gradient-to-r ${priorityColors[incident.priority]} text-white px-3 py-1 rounded-md text-xs font-bold shadow-lg`}>
                      {incident.priority}
                    </span>
                    <span className="font-semibold text-white text-sm">
                      {incident.incident_type?.category?.replace('_', ' ') || 'Emergency'}
                    </span>
                    {isJointOps && (
                       <span className="ml-1 text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 font-bold uppercase tracking-widest">
                         JOINT OPS
                       </span>
                    )}
                    {incident.audio_source === 'voice_upload' && (
                       <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold uppercase tracking-widest flex items-center gap-1">
                         <Mic size={10} /> AUDIO
                       </span>
                    )}
                    <ChannelBadge channel={incident.channel} audioSource={incident.audio_source} />
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {isReviewQueue ? (
                      <div className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                        [HOLD - REVIEW REQUIRED]
                      </div>
                    ) : (
                      <div className={`text-xs font-bold ${
                        incident.dispatch_status === 'assigned' ? 'text-green-400' :
                        incident.dispatch_status === 'pending' ? 'text-yellow-400' :
                        'text-gray-400'
                      }`}>
                        {incident.dispatch_status?.toUpperCase()}
                      </div>
                    )}
                    {isCritical && incident.golden_hour_deadline && !isReviewQueue && (
                      <CountdownTimer deadline={incident.golden_hour_deadline} />
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-gray-300 mb-2 relative z-10">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{incident.location?.raw_text || 'Location unknown'}</span>
                </div>

                {isJointOps && !isReviewQueue && (
                   <div className="relative z-10">
                     <CoordinationTimeline timings={incident.agency_timings} />
                   </div>
                )}

                <div className="flex items-center justify-between text-xs mt-3 relative z-10">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock size={12} />
                    <span className="font-mono">
                      {incident.timestamp ? new Date(incident.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      }) : 'N/A'}
                    </span>
                  </div>
                  {incident.assigned_resources?.length > 0 && !isReviewQueue && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-bold">
                        {incident.assigned_resources.length} units
                      </span>
                      {incident.assigned_resources[0]?.eta_minutes && (
                        <span className="bg-blue-500/20 px-2 py-0.5 rounded text-blue-300 font-medium border border-blue-500/20 shadow-sm">
                          ETA {incident.assigned_resources[0].eta_minutes}m
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {incident.golden_hour_at_risk && !isReviewQueue && incident.incident_status !== 'RESOLVED' && (
                  <div className="relative z-10 w-full bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest text-center mt-3 flex items-center justify-center gap-1.5 shadow-sm">
                    <AlertCircle size={12} className="animate-pulse" /> 
                    <span>GOLDEN HOUR AT RISK</span>
                  </div>
                )}

                {incident.incident_status !== 'RESOLVED' && !isReviewQueue && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onResolve(incident.incident_id);
                    }}
                    className="mt-3 w-full py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-bold uppercase tracking-widest rounded border border-gray-700 transition-colors"
                  >
                    Mark as Resolved
                  </button>
                )}

                {incident.incident_status === 'RESOLVED' && (
                  <div className="mt-3 w-full py-1.5 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-widest rounded border border-green-500/30 text-center">
                    Successfully Resolved
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