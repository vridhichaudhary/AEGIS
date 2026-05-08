import React, { useEffect, useState } from 'react';
import CitizenPanel from './panels/CitizenPanel';
import AdminPanel from './panels/AdminPanel';
import AARModal from './components/AARModal';
import { connectWebSocket } from './utils/websocket';
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

  useEffect(() => {
    const load = async () => {
      try {
        const [resData, hospData] = await Promise.all([
          fetch(`${API_BASE}/api/v1/resources`).then(r => r.json()),
          fetch(`${API_BASE}/api/v1/hospitals`).then(r => r.json()),
        ]);
        setResources(resData.resources || []);
        setDepots(resData.depots || []);
        setHospitals(hospData.hospitals || []);
      } catch (e) {
        console.warn('Backend waking up...', e.message);
      }
    };
    load();

    const ws = connectWebSocket((event) => {
      setWsStatus('connected');
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.type === 'incident_update') {
        const inc = data.payload;
        setIncidents(prev => {
          const others = prev.filter(i => i.incident_id !== inc.incident_id);
          return [inc, ...others];
        });
      } else if (data.type === 'agent_event') {
        setAgentEvents(prev => [data.payload, ...prev].slice(0, 30));
      } else if (data.type === 'resource_update') {
        // Full fleet update
        if (Array.isArray(data.payload)) {
          setResources(data.payload);
        }
      } else if (data.type === 'mci_activation') {
        setMciState({ active: true, zone: data.payload.zone, details: data.payload.details });
      } else if (data.type === 'mci_resolved') {
        setMciState({ active: false });
        if (data.payload.aar_report) setReportData(data.payload.aar_report);
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

  const activeIncidentCount = incidents.filter(i => i.status !== 'RESOLVED').length;
  const systemLabel = wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Recovering' : 'Connecting';

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
              <div className="app-brand-subtitle">AI-assisted emergency coordination for multilingual, high-volume public safety operations</div>
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
              latestCitizenIncident={incidents.find(i => i.status !== 'RESOLVED')}
              allDepots={depots}
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
            />
          )}
        </div>
      </div>

      <AARModal data={reportData} onClose={() => setReportData(null)} />
    </div>
  );
}

export default App;
