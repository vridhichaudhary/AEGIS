import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import IncidentCard from './IncidentCard';

const PriorityQueue = ({ incidents, onResolve, onFocus, onAddNote, mViewTimeline, isMci }) => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [incidents.length]);

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
    <div className="priority-queue-shell">
      <div className="priority-queue-header">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} className="text-aegis-critical" />
          <div>
            <div className="admin-card-kicker">Live incident stream</div>
            <span className="priority-queue-title">Priority operations queue</span>
          </div>
        </div>
        <div className="priority-queue-tools">
          <div className="priority-queue-search">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-aegis-text-muted" />
            <input 
              type="text" 
              placeholder="SEARCH..." 
              className="priority-queue-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="priority-queue-count mono">
            {sortedIncidents.length}
          </span>
        </div>
      </div>
      
      <div className="priority-queue-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`priority-queue-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div ref={scrollRef} className="priority-queue-body custom-scrollbar">
        {sortedIncidents.length === 0 ? (
          <div className="priority-queue-empty">
            <p className="priority-queue-empty-title">System normal</p>
            <p className="priority-queue-empty-sub">No active threats in the live queue</p>
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
