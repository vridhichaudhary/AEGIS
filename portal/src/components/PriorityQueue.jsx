import React, { useState } from 'react';
import { AlertCircle, Search, Filter } from 'lucide-react';
import IncidentCard from './IncidentCard';

const PriorityQueue = ({ incidents, onResolve, onFocus, onAddNote, mViewTimeline, isMci }) => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const agencyFilter = (incident) => {
    if (activeTab === 'ALL') return true;
    const reqs = (incident.assigned_resources || []).map(r => r.resource_type.toLowerCase());
    if (activeTab === 'POLICE') return reqs.some(r => r.includes('police'));
    if (activeTab === 'FIRE') return reqs.some(r => r.includes('fire') || r.includes('rescue'));
    if (activeTab === 'MEDICAL') return reqs.some(r => r.includes('ambulance') || r.includes('medic'));
    return false;
  };

  const searchFilter = (incident) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      incident.incident_id?.toLowerCase().includes(term) ||
      incident.location?.raw_text?.toLowerCase().includes(term) ||
      incident.incident_type?.category?.toLowerCase().includes(term)
    );
  };

  const sortedIncidents = [...incidents]
    .filter(i => i.dispatch_status !== 'merged_duplicate' || i.incident_status === 'RESOLVED')
    .filter(agencyFilter)
    .filter(searchFilter)
    .sort((a, b) => {
      // Resolved items to bottom
      if (a.incident_status === 'RESOLVED' && b.incident_status !== 'RESOLVED') return 1;
      if (b.incident_status === 'RESOLVED' && a.incident_status !== 'RESOLVED') return -1;

      // Priority sort
      const priorityMap = { P1: 5, P2: 4, P3: 3, P4: 2, P5: 1 };
      const scoreA = priorityMap[a.priority] || 0;
      const scoreB = priorityMap[b.priority] || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

  const tabs = [
    { id: 'ALL', label: 'All' },
    { id: 'POLICE', label: 'Police' },
    { id: 'FIRE', label: 'Fire' },
    { id: 'MEDICAL', label: 'Medical' }
  ];

  return (
    <div className="flex flex-col h-full bg-aegis-bg-surface overflow-hidden">
      <div className="section-header flex justify-between items-center bg-aegis-bg-elevated/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} className="text-aegis-critical" />
          <span>Priority Operations Queue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-aegis-text-muted" />
            <input 
              type="text" 
              placeholder="SEARCH..." 
              className="bg-aegis-bg-base border border-aegis-border rounded px-6 py-0.5 text-[9px] mono text-aegis-text-primary outline-none focus:border-aegis-info w-24"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="mono text-[10px] text-aegis-text-muted bg-aegis-bg-base px-1.5 py-0.5 rounded border border-aegis-border">
            {sortedIncidents.length}
          </span>
        </div>
      </div>
      
      {/* Agency Tabs */}
      <div className="flex px-2 py-1.5 gap-1 border-b border-aegis-border bg-aegis-bg-elevated/30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-all
              ${activeTab === tab.id ? 'bg-aegis-info text-white shadow-lg shadow-aegis-info/20' : 'text-aegis-text-muted hover:text-aegis-text-secondary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {sortedIncidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-aegis-text-muted text-[10px] uppercase tracking-widest opacity-30 italic py-12">
            <p>System Normal</p>
            <p className="text-[8px] mt-1">NO ACTIVE THREATS</p>
          </div>
        ) : (
          sortedIncidents.map((incident) => (
            <IncidentCard
              key={incident.incident_id}
              incident={incident}
              onClick={onFocus}
              onResolve={onResolve}
              onAddNote={onAddNote}
              mViewTimeline={mViewTimeline}
              isMci={isMci}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PriorityQueue;