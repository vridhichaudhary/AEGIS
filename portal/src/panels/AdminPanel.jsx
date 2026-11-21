import React, { useCallback, useState } from 'react';
import OperatorIncident from '../components/OperatorIncident';
import WhatsAppSimulator from '../components/WhatsAppSimulator';
import VoiceCommand from '../components/VoiceCommand';
import ThreatIntelligencePanel from '../components/ThreatIntelligencePanel';
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
  onUpdateLocation,
  onReviewIncident,
  onOpenReport,
  actionError,
  networkLabel,
  threatIntel,
  mciDetails,
}) => {
  const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED' && !i.is_duplicate);
  const [selected, setSelected] = useState(null);
  const [picking, setPicking] = useState(false);
  const [draftPin, setDraftPin] = useState(null);
  const selectedIncident = incidents.find(incident => incident.incident_id === selected);
  const clearPin = () => { setDraftPin(null); setPicking(false); };
  const selectIncident = incident => {
    if (selected !== incident.incident_id) clearPin();
    setSelected(incident.incident_id);
    onFocusIncident(incident);
    requestAnimationFrame(() => document.getElementById("selected-incident")?.scrollIntoView({ block: "nearest" }));
  };
  const pickPin = useCallback(pin => { setDraftPin(pin); setPicking(false); document.getElementById("selected-incident")?.scrollIntoView({ block: "nearest" }); }, []);

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
            <div className="admin-brand-sub">Delhi NCR dispatch exercises</div>
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
              {networkLabel}
            </span>
          } />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-sm text-slate-700">{activeIncidents.filter(incident => incident.requires_callback).length} location follow-ups</span>
        <button className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold" onClick={onOpenReport}>Exercise report</button>
        <VoiceCommand />
      </div>
      {actionError && <p className="mb-3 text-sm text-red-700" role="alert">{actionError}</p>}
      {mciActive && mciDetails && <p className="mb-3 text-sm text-amber-900">{mciDetails.resource_gap_analysis}</p>}

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
            <MapView incidents={incidents} depots={depots} focusOn={mapFocus}
              onPickPin={picking ? pickPin : undefined} draftPin={draftPin} />
          </div>
        </div>

        <div className="admin-card admin-queue-card">
          <PriorityQueue
            isMci={mciActive}
            incidents={incidents}
            onResolve={onResolveIncident}
            onFocus={selectIncident}
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
      {selectedIncident && (
        <div className="my-3" id="selected-incident">
          <OperatorIncident key={selected} incident={selectedIncident} draftPin={draftPin} picking={picking}
            onPick={() => {
              if (!picking) document.querySelector(".admin-map-card")?.scrollIntoView({ block: "nearest" });
              setPicking(value => !value);
            }} onClearPin={clearPin}
            onUpdate={onUpdateLocation} onReview={onReviewIncident} onClose={() => { setSelected(null); clearPin(); }}
            onResolve={onResolveIncident} />
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <WhatsAppSimulator />
        {threatIntel && <ThreatIntelligencePanel data={threatIntel} />}
      </div>
    </div>
  );
};


export default AdminPanel;
