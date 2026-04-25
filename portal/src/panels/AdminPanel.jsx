import React from 'react';
import MapView from '../components/MapView';
import PriorityQueue from '../components/PriorityQueue';
import AgentFeed from '../components/AgentFeed';
import SimulatorConsole from '../components/SimulatorConsole';
import ResourceGrid from '../components/ResourceGrid';
import HospitalStatusPanel from '../components/HospitalStatusPanel';
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
  agentEvents = [],
  hospitals = [],
  mapFocus,
  mciActive = false,
  onResolveIncident,
  onFocusIncident,
}) => {
  const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED');
  const duplicates = incidents.filter(i => i.dispatch_status === 'merged_duplicate');
  const availableResources = resources.filter(r => r.status === 'available').length;

  return (
    <div className="admin-panel">
      {/* Top Bar */}
      <div className={`admin-topbar ${mciActive ? 'mci-active' : ''}`}>
        <div className="admin-topbar-brand">
          <div className="admin-brand-icon">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <div className="admin-brand-name">AEGIS <span>Command</span></div>
            <div className="admin-brand-sub">Emergency Dispatch Control • Delhi NCR</div>
          </div>
          {mciActive && (
            <div className="mci-alert-badge">
              <AlertTriangle size={14} /> MCI ACTIVE
            </div>
          )}
        </div>

        <div className="admin-stats-row">
          <StatBadge icon={Activity} label="Active" value={activeIncidents.length} color="#C53030" />
          <StatBadge icon={Radio} label="Merged" value={duplicates.length} color="#B7791F" />
          <StatBadge icon={Users} label="Available" value={availableResources} color="#2F855A" />
          <StatBadge icon={Zap} label="Status" value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="status-dot status-dot-online" />Online
            </span>
          } />
        </div>
      </div>

      {/* Main Grid */}
      <div className="admin-grid">
        {/* TOP LEFT — Tactical Map */}
        <div className="admin-card admin-map-card">
          <div className="admin-card-header">
            <span>🗺️ Tactical Response Map</span>
            <span className="admin-card-count">{activeIncidents.length} active</span>
          </div>
          <div className="admin-map-container">
            <MapView incidents={incidents} resources={resources} focusOn={mapFocus} />
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

        {/* BOTTOM LEFT — Agent Trail + Input Console */}
        <div className="admin-card admin-agent-card">
          <div className="admin-card-header">
            <span>🤖 AI Agent Intelligence Trail</span>
            {agentEvents.length > 0 && (
              <span className="admin-card-count">{agentEvents.length} events</span>
            )}
          </div>
          <div className="admin-agent-split">
            <div className="admin-simulator">
              <SimulatorConsole />
            </div>
            <div className="admin-feed">
              <AgentFeed events={agentEvents} />
            </div>
          </div>
        </div>

        {/* BOTTOM RIGHT — Resources + Hospitals */}
        <div className="admin-card admin-resource-card">
          <div className="admin-card-header">
            <span>🚑 Resources & Hospitals</span>
          </div>
          <div className="admin-resource-split">
            <div className="admin-resource-section">
              <div className="admin-section-label">Fleet Status</div>
              <ResourceGrid resources={resources} />
            </div>
            <div className="admin-hospital-section">
              <div className="admin-section-label">Hospital Capacity</div>
              <HospitalStatusPanel hospitals={hospitals} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
