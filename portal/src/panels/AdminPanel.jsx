import React from 'react';
import MapView from '../components/MapView';
import PriorityQueue from '../components/PriorityQueue';
import AgentFeed from '../components/AgentFeed';
import SimulatorConsole from '../components/SimulatorConsole';
import ResourceGrid from '../components/ResourceGrid';
import StationStatusPanel from '../components/HospitalStatusPanel';
import { Activity, Shield, Users, Zap, Radio, AlertTriangle } from 'lucide-react';

const StatBadge = ({ icon: Icon, label, value, color = '#2C7A7B' }) => (
  <div className="admin-stat-badge">
    <Icon size={16} style={{ color }} />
    <div>
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}</div>
    </div>
  </div>
);

const AdminPanel = ({
  incidents = [],
  resources = [],
  depots = [],
  agentEvents = [],
  hospitals = [],
  mapFocus,
  mciActive = false,
  onResolveIncident,
  onFocusIncident,
}) => {
  const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED');
  const duplicates = incidents.filter(i => i.is_duplicate);
  const totalMerged = incidents.reduce((acc, inc) => acc + (inc.merged_count || 1) - 1, 0);
  const availableResources = resources.filter(r => r.status === 'available').length;

  return (
    <div className="admin-panel animate-fade-in">
      {/* Top Bar */}
      <div className={`admin-topbar ${mciActive ? 'mci-active' : ''}`}>
        <div className="admin-topbar-brand">
          <div className="admin-brand-icon">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <div className="admin-brand-name">AEGIS <span>Command</span></div>
            <div className="admin-brand-sub">Smart City Emergency Dispatch • Delhi NCR</div>
          </div>
          {mciActive && (
            <div className="mci-alert-badge animate-pulse">
              <AlertTriangle size={14} /> MCI ACTIVE
            </div>
          )}
        </div>

        <div className="admin-stats-row">
          <StatBadge icon={Activity} label="Active Sites" value={activeIncidents.length} color="#E53E3E" />
          <StatBadge icon={Radio} label="Duplicates" value={totalMerged} color="#D69E2E" />
          <StatBadge icon={Users} label="Available" value={`${availableResources}/${resources.length}`} color="#38A169" />
          <StatBadge icon={Zap} label="System" value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="status-dot status-dot-online" />Live
            </span>
          } />
        </div>
      </div>

      {/* Main Grid */}
      <div className="admin-grid">
        {/* TOP LEFT — Tactical Map */}
        <div className="admin-card admin-map-card overflow-hidden">
          <div className="admin-card-header">
            <span>🗺️ Tactical Response Map</span>
            <span className="admin-card-count">{activeIncidents.length} incidents</span>
          </div>
          <div className="admin-map-container h-full">
            <MapView incidents={incidents} resources={resources} depots={depots} focusOn={mapFocus} />
          </div>
        </div>

        {/* TOP RIGHT — Priority Queue */}
        <div className="admin-card admin-queue-card">
          <PriorityQueue
            incidents={incidents}
            onResolve={onResolveIncident}
            onFocus={onFocusIncident}
          />
        </div>

        {/* BOTTOM LEFT — Agent Decision Feed */}
        <div className="admin-card admin-agent-card">
          <div className="admin-card-header">
            <span>🤖 AI Agent Decision Feed</span>
            {agentEvents.length > 0 && (
              <span className="admin-card-count">{agentEvents.length} events</span>
            )}
          </div>
          <div className="admin-feed-container h-full overflow-y-auto">
            <AgentFeed events={agentEvents} />
          </div>
        </div>

        {/* BOTTOM RIGHT — Resources & Hospitals */}
        <div className="admin-card admin-resource-card">
          <div className="admin-card-header">
            <span>🚑 Smart City Resources</span>
          </div>
          <div className="admin-resource-split">
            <div className="admin-resource-section">
              <div className="admin-section-label">Active Fleet</div>
              <ResourceGrid resources={resources} />
            </div>
            <div className="admin-hospital-section">
              <div className="admin-section-label">Medical & Fire Capacity</div>
              <StationStatusPanel hospitals={hospitals} depots={depots} onFocus={onFocusIncident} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default AdminPanel;
