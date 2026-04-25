import React, { useEffect, useState, useRef } from 'react';
import CitizenPanel from './panels/CitizenPanel';
import AdminPanel from './panels/AdminPanel';
import AARModal from './components/AARModal';
import { connectWebSocket } from './utils/websocket';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://aegis-5lpx.onrender.com';

function App() {
  const [activePanel, setActivePanel] = useState('citizen'); // 'citizen' | 'admin'

  // Shared state
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [mciState, setMciState] = useState({ active: false });
  const [reportData, setReportData] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'connected' | 'reconnecting'

  // Latest incident for citizen panel (most recent non-resolved)
  const latestIncident = incidents.find(i => i.status !== 'RESOLVED') || null;

  useEffect(() => {
    // Load initial data
    const load = async () => {
      try {
        const [resData, hospData] = await Promise.all([
          fetch(`${API_BASE}/api/v1/resources`).then(r => r.json()),
          fetch(`${API_BASE}/api/v1/hospitals`).then(r => r.json()),
        ]);
        setResources(resData.resources || []);
        setHospitals(hospData.hospitals || []);
      } catch (e) {
        console.warn('Initial data load failed (backend may be waking up):', e.message);
      }
    };
    load();

    // WebSocket with reconnection
    const ws = connectWebSocket((event) => {
      setWsStatus('connected');
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.type === 'incident_update') {
        const inc = data.payload;
        setIncidents(prev => {
          const filtered = prev.filter(i => i.incident_id !== inc.incident_id);
          return [inc, ...filtered];
        });
      } else if (data.type === 'agent_event') {
        setAgentEvents(prev => [data.payload, ...prev].slice(0, 50));
      } else if (data.type === 'mci_activation') {
        setMciState({ active: true, zone: data.payload.zone, details: data.payload.details });
      } else if (data.type === 'mci_resolved') {
        setMciState({ active: false });
        if (data.payload.aar_report) setReportData(data.payload.aar_report);
      } else if (data.type === 'resource_update') {
        if (data.payload?.resources) setResources(data.payload.resources);
      }
    });

    return () => ws.close();
  }, []);

  const resolveIncident = async (id) => {
    try {
      await fetch(`${API_BASE}/api/v1/incidents/${id}/resolve`, { method: 'POST' });
      setIncidents(prev => prev.map(i =>
        i.incident_id === id ? { ...i, status: 'RESOLVED' } : i
      ));
    } catch (e) {
      console.error('Resolve failed:', e);
    }
  };

  const handleFocusIncident = (incident) => {
    if (incident?.location?.latitude) {
      setMapFocus({ lat: incident.location.latitude, lng: incident.location.longitude });
    }
  };

  return (
    <div className="app-root">
      {/* Panel Toggle Navigation */}
      <div className="panel-nav">
        <button
          className={`panel-tab ${activePanel === 'citizen' ? 'active' : ''}`}
          onClick={() => setActivePanel('citizen')}
        >
          <span className="panel-tab-icon">🆘</span>
          <span className="panel-tab-label">SOS Portal</span>
          <span className="panel-tab-sub">Citizen View</span>
        </button>

        <div className="panel-nav-divider" />

        <button
          className={`panel-tab ${activePanel === 'admin' ? 'active' : ''}`}
          onClick={() => setActivePanel('admin')}
        >
          <span className="panel-tab-icon">📡</span>
          <span className="panel-tab-label">Control Room</span>
          <span className="panel-tab-sub">Admin Dashboard</span>
          {incidents.filter(i => i.status !== 'RESOLVED').length > 0 && (
            <span className="panel-tab-badge">
              {incidents.filter(i => i.status !== 'RESOLVED').length}
            </span>
          )}
        </button>

        {/* WS Status Indicator */}
        <div className="ws-status-indicator">
          <div className={`ws-dot ${wsStatus === 'connected' ? 'connected' : wsStatus === 'reconnecting' ? 'reconnecting' : 'connecting'}`} />
          <span>{wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}</span>
        </div>
      </div>

      {/* Panel Content */}
      <div className="panel-content">
        {activePanel === 'citizen' ? (
          <CitizenPanel latestCitizenIncident={latestIncident} />
        ) : (
          <AdminPanel
            incidents={incidents}
            resources={resources}
            agentEvents={agentEvents}
            hospitals={hospitals}
            mapFocus={mapFocus}
            mciActive={mciState.active}
            onResolveIncident={resolveIncident}
            onFocusIncident={handleFocusIncident}
          />
        )}
      </div>

      <AARModal data={reportData} onClose={() => setReportData(null)} />
    </div>
  );
}

export default App;