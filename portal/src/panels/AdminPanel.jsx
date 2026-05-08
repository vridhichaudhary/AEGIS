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
      <div className={`admin-topbar ${mciActive ? 'mci-active' : ''}`}>
        <div className="admin-topbar-brand">
          <div className="admin-brand-icon">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <div className="admin-brand-kicker">Unified emergency command</div>
            <div className="admin-brand-name">AEGIS <span>Command</span></div>
            <div className="admin-brand-sub">Smart city dispatch orchestration for Delhi NCR control rooms</div>
          </div>
          {mciActive && (
            <div className="mci-alert-badge animate-pulse">
              <AlertTriangle size={14} /> MCI ACTIVE
            </div>
          )}
        </div>

        <div className="admin-stats-row">
          <StatBadge icon={Activity} label="Active Sites" value={activeIncidents.length} color="#D16A5A" />
          <StatBadge icon={Radio} label="Duplicates" value={totalMerged} color="#B38A4A" />
          <StatBadge icon={Users} label="Available" value={`${availableResources}/${resources.length}`} color="#2D8A72" />
          <StatBadge icon={Zap} label="System" value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="status-dot status-dot-online" />Live
            </span>
          } />
        </div>
      </div>

      <div className="admin-overview-strip">
        <div className="admin-overview-card">
          <div className="admin-overview-label">Operational posture</div>
          <div className="admin-overview-value">{mciActive ? 'Mass-casualty protocol engaged' : 'Steady-state monitoring'}</div>
          <div className="admin-overview-text">Incident intake, AI triage, dispatch assignment, and resource telemetry are synchronized in one live operator surface.</div>
        </div>
        <div className="admin-overview-card">
          <div className="admin-overview-label">Queue health</div>
          <div className="admin-overview-value">{activeIncidents.length === 0 ? 'No active threats' : `${activeIncidents.length} active incidents under watch`}</div>
          <div className="admin-overview-text">Duplicates are merged before dispatch, while unresolved priorities stay visible for intervention and field coordination.</div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-card admin-map-card overflow-hidden">
          <div className="admin-card-header">
            <div>
              <div className="admin-card-kicker">Geospatial overview</div>
              <span>Tactical response map</span>
            </div>
            <span className="admin-card-count">{activeIncidents.length} incidents</span>
          </div>
          <div className="admin-map-container h-full">
            <MapView incidents={incidents} resources={resources} depots={depots} focusOn={mapFocus} />
          </div>
        </div>

        <div className="admin-card admin-queue-card">
          <PriorityQueue
            incidents={incidents}
            onResolve={onResolveIncident}
            onFocus={onFocusIncident}
          />
        </div>

        <div className="admin-card admin-agent-card">
          <div className="admin-card-header">
            <div>
              <div className="admin-card-kicker">Reasoning trace</div>
              <span>AI agent decision feed</span>
            </div>
            {agentEvents.length > 0 && (
              <span className="admin-card-count">{agentEvents.length} events</span>
            )}
          </div>
          <div className="admin-feed-container h-full overflow-y-auto">
            <AgentFeed events={agentEvents} />
          </div>
        </div>

        <div className="admin-card admin-resource-card overflow-hidden">
          <div className="admin-card-header">
            <div>
              <div className="admin-card-kicker">Field capacity</div>
              <span>Smart city resources</span>
            </div>
          </div>
          <div className="flex flex-col h-full min-h-0 overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-slate-50">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Active Fleet Status</div>
              <ResourceGrid resources={resources} />
            </div>
            <div className="p-4 bg-slate-50/30">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Facility Capacity Monitoring</div>
              <StationStatusPanel hospitals={hospitals} depots={depots} onFocus={onFocusIncident} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default AdminPanel;
