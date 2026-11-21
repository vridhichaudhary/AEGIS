import React, { useEffect, useState } from 'react';
import CitizenPanel from './panels/CitizenPanel';
import AdminPanel from './panels/AdminPanel';
import AARModal from './components/AARModal';
import { connectWebSocket } from './utils/websocket';
import { isPoint } from './components/MapView';
import { getApiBase } from './utils/runtimeConfig';
import { Activity, ShieldCheck, RadioTower } from 'lucide-react';

const API_BASE = getApiBase();

function App() {
  const [activePanel, setActivePanel] = useState('citizen'); // 'citizen' | 'admin'

  // Shared state
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [depots, setDepots] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [mciState, setMciState] = useState({ active: false });
  const [reportData, setReportData] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');

  const [citizenReport, setCitizenReport] = useState(null);
  const [actionError, setActionError] = useState('');
  const [threatIntel, setThreatIntel] = useState(null);

  const upsertIncident = incident => setIncidents(previous => [
    incident, ...previous.filter(item => item.incident_id !== incident.incident_id),
  ]);

  useEffect(() => {
    const socket = connectWebSocket((event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      const payload = data.payload;
      if (data.type === 'snapshot') {
        setIncidents(payload.incidents || []);
        setResources(payload.resources || []);
        setDepots(payload.depots || []);
        setHospitals(payload.hospitals || []);
        setMciState(payload.mci || { active: false });
        setThreatIntel(payload.threat_intel || null);
      } else if (data.type === 'incident_update') {
        upsertIncident(payload);
      } else if (data.type === 'agent_event') {
        setAgentEvents(previous => [payload, ...previous].slice(0, 30));
      } else if (data.type === 'resource_update') {
        setResources(payload.resources || []);
        setDepots(payload.depots || []);
      } else if (data.type === 'hospital_update') {
        setHospitals(payload);
      } else if (data.type === 'threat_intelligence') {
        setThreatIntel(payload);
      } else if (data.type === 'mci_activation') {
        setMciState({ ...payload, active: true });
      } else if (data.type === 'mci_resolved') {
        setMciState({ active: false });
        if (payload.aar_report) setReportData(payload.aar_report);
      }
    }, setWsStatus);
    return () => socket.close();
  }, []);

  const request = async (path, options) => {
    const response = await fetch(`${API_BASE}/api/v1/${path}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'The request could not be completed.');
    return data;
  };

  const resolveIncident = async id => {
    setActionError('');
    try {
      await request(`incidents/${id}/resolve`, { method: 'POST' });
      setIncidents(previous => previous.map(incident => incident.incident_id === id
        ? { ...incident, status: 'RESOLVED', incident_status: 'RESOLVED', requires_callback: false } : incident));
    } catch (error) {
      setActionError(error.message);
    }
  };

  const updateLocation = async (id, evidence) => {
    const updated = await request(`callback/${id}/response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evidence),
    });
    // WebSocket carries the complete persisted record. Keep a REST fallback during reconnects.
    if (wsStatus !== 'connected') upsertIncident({ ...updated, status: updated.incident_status });
    return updated;
  };

  const reviewIncident = async (id, category) => {
    const updated = await request(`incidents/${id}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    if (wsStatus !== 'connected') upsertIncident({ ...updated, status: updated.incident_status });
  };

  const openReport = async () => {
    setActionError('');
    try {
      setReportData(await request('report/generate'));
    } catch (error) {
      setActionError(error.message);
    }
  };

  const handleFocusIncident = incident => {
    const { latitude, longitude } = incident?.location || { latitude: incident?.lat, longitude: incident?.lng };
    if (isPoint(latitude, longitude)) setMapFocus({ lat: latitude, lng: longitude });
  };

  const activeIncidentCount = incidents.filter(i => i.status !== 'RESOLVED' && !i.is_duplicate).length;
  const systemLabel = { connected: 'Connected', reconnecting: 'Reconnecting', offline: 'Offline' }[wsStatus] || 'Connecting';
  const citizenIncident = incidents.find(incident => incident.incident_id === citizenReport?.incident_id) || citizenReport;

  return (
    <div className="app-root">
      <div className="app-shell">
        <header className="app-topbar">
          <div className="app-brand">
            <div className="app-brand-mark">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="app-brand-title">AEGIS Response Grid</div>
              <div className="app-brand-subtitle">India-wide reports · simulated regional fleet</div>
            </div>
          </div>

          <div className="app-view-switch">
            <button
              className={`app-view-pill ${activePanel === 'citizen' ? 'active' : ''}`}
              onClick={() => setActivePanel('citizen')}
            >
              <span className="app-view-icon">🆘</span>
              <span>
                <span className="app-view-title">SOS Portal</span>
                <span className="app-view-subtitle">Citizen Interface</span>
              </span>
            </button>

            <button
              className={`app-view-pill ${activePanel === 'admin' ? 'active' : ''}`}
              onClick={() => setActivePanel('admin')}
            >
              <span className="app-view-icon">📡</span>
              <span>
                <span className="app-view-title">Control Room</span>
                <span className="app-view-subtitle">Operations Console</span>
              </span>
              {activeIncidentCount > 0 && (
                <span className="app-view-count">{activeIncidentCount}</span>
              )}
            </button>
          </div>

          <div className="app-topbar-status">
            <div className="app-status-card">
              <div className={`ws-dot ${wsStatus === 'connected' ? 'connected' : wsStatus === 'reconnecting' ? 'reconnecting' : 'connecting'}`} />
              <div>
                <div className="app-status-label">Network State</div>
                <div className="app-status-value">{systemLabel}</div>
              </div>
            </div>
            <div className="app-status-card">
              <Activity size={16} />
              <div>
                <div className="app-status-label">Active Incidents</div>
                <div className="app-status-value">{activeIncidentCount}</div>
              </div>
            </div>
            <div className="app-status-card">
              <RadioTower size={16} />
              <div>
                <div className="app-status-label">Resources Online</div>
                <div className="app-status-value">{resources.filter(r => r.status === 'available').length}/{resources.length || 0}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="panel-content">
          {activePanel === 'citizen' ? (
            <CitizenPanel
              latestCitizenIncident={citizenIncident}
              onReport={setCitizenReport}
            />
          ) : (
            <AdminPanel
              incidents={incidents}
              resources={resources}
              depots={depots}
              agentEvents={agentEvents}
              hospitals={hospitals}
              mapFocus={mapFocus}
              mciActive={mciState.active}
              onResolveIncident={resolveIncident}
              onFocusIncident={handleFocusIncident}
              onUpdateLocation={updateLocation}
              onReviewIncident={reviewIncident}
              onOpenReport={openReport}
              actionError={actionError}
              networkLabel={systemLabel}
              threatIntel={threatIntel}
              mciDetails={mciState.details}
            />
          )}
        </div>
      </div>

      <AARModal data={reportData} onClose={() => setReportData(null)} />
    </div>
  );
}

export default App;
