import React, { useEffect, useState, useCallback, useRef } from 'react';
import AgentFeed from './components/AgentFeed';
import MapView from './components/MapView';
import Metrics from './components/Metrics';
import PriorityQueue from './components/PriorityQueue';
import ResourceGrid from './components/ResourceGrid';
import SimulatorConsole from './components/SimulatorConsole';
import ThreatIntelligencePanel from './components/ThreatIntelligencePanel';
import VoiceCommand from './components/VoiceCommand';
import AARModal from './components/AARModal';
import ReviewQueue from './components/ReviewQueue';
import CallbackQueue from './components/CallbackQueue';
import NovelScenarioLog from './components/NovelScenarioLog';
import SystemLearning from './components/SystemLearning';
import HospitalStatusPanel from './components/HospitalStatusPanel';
import MCIPanel from './components/MCIPanel';
import WhatsAppSimulator from './components/WhatsAppSimulator';
import DemoController from './components/DemoController';
import DashboardLayout from './layouts/DashboardLayout';
import IncidentDetailModal from './components/IncidentDetailModal';
import IncidentDetailPanel from './components/IncidentDetailPanel';
import { connectWebSocket } from './utils/websocket';
import { Activity, Terminal } from 'lucide-react';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [mciState, setMciState] = useState({ active: false, zone: null, details: null });
  const [threatIntelligence, setThreatIntelligence] = useState(null);
  const [isLogoGlowing, setIsLogoGlowing] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  // Interaction states
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);

  // Demo state
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(null);

  const [metrics, setMetrics] = useState({
    active_incidents: 0,
    avg_eta: '-',
    load: 'Low',
    llm_ready: false,
    backend_status: 'Unknown',
    model: 'Unavailable',
  });

  const [heroMetrics, setHeroMetrics] = useState({
    cumulativeIncidents: 0,
    cumulativeResources: 0,
    triageTimes: [],
    criticalIncidents: 0,
    successfulGoldenHours: 0,
    hoaxCalls_intercepted: 0
  });

  const [pulsePanels, setPulsePanels] = useState({
    feed: false,
    queue: false,
    agents: false,
    threat: false,
    callback: false
  });
  
  const seenIncidents = useRef(new Set());

  const triggerPulse = (panel) => {
    setPulsePanels(prev => ({ ...prev, [panel]: true }));
    setTimeout(() => {
      setPulsePanels(prev => ({ ...prev, [panel]: false }));
    }, 3000);
  };

  const updateMetrics = useCallback((incidentList) => {
    const activeCount = incidentList.filter(i => 
      i.dispatch_status !== 'completed' && 
      i.dispatch_status !== 'merged_duplicate'
    ).length;
    
    const allResources = incidentList.flatMap(i => i.assigned_resources || []);
    const etaValues = allResources
      .map(r => r.eta_minutes)
      .filter(v => typeof v === 'number' && v > 0);
    
    setMetrics(m => ({
      ...m,
      active_incidents: activeCount,
      avg_eta: etaValues.length
        ? (etaValues.reduce((a, b) => a + b, 0) / etaValues.length).toFixed(1)
        : '-',
      load: activeCount > 10 ? 'High' : activeCount > 4 ? 'Medium' : 'Low',
    }));
  }, []);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    
    const loadData = async () => {
      try {
        const [healthRes, resourcesRes, callbacksRes, hospitalsRes] = await Promise.all([
          fetch(`${apiBase}/health`),
          fetch(`${apiBase}/api/v1/resources`),
          fetch(`${apiBase}/api/v1/callbacks`),
          fetch(`${apiBase}/api/v1/hospitals`)
        ]);

        const health = await healthRes.json();
        setMetrics(prev => ({
          ...prev,
          backend_status: health.status || 'Unknown',
          llm_ready: Boolean(health.llm?.llm_initialized),
          model: health.llm?.model || 'Unavailable',
        }));

        const resData = await resourcesRes.json();
        setResources(resData.resources || []);

        const cbData = await callbacksRes.json();
        setCallbacks(cbData.callbacks || []);

        const hospData = await hospitalsRes.json();
        setHospitals(hospData.hospitals || []);
      } catch (e) {
        console.error("Failed to load initial data", e);
      }
    };
    
    loadData();
    const interval = setInterval(loadData, 30000);

    const ws = connectWebSocket();
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'incident_update') {
        const incident = data.payload;
        triggerPulse('queue');
        setIncidents((prev) => {
          const filtered = prev.filter(i => i.incident_id !== incident.incident_id);
          const updated = [incident, ...filtered];
          updateMetrics(updated);
          return updated;
        });

        setHeroMetrics(prev => {
          let { cumulativeIncidents, cumulativeResources, triageTimes, criticalIncidents, successfulGoldenHours, hoaxCalls_intercepted } = prev;
          if (!seenIncidents.current.has(incident.incident_id)) {
            seenIncidents.current.add(incident.incident_id);
            cumulativeIncidents += 1;
            cumulativeResources += (incident.assigned_resources?.length || 0);
            if (incident.priority === 'P1' || incident.priority === 'P2') {
              criticalIncidents += 1;
              if (!incident.golden_hour_at_risk) successfulGoldenHours += 1;
            }
            if (incident.authenticity_score !== undefined && incident.authenticity_score < 40) hoaxCalls_intercepted += 1;
            const time = 2.5 + Math.random() * 1.5;
            triageTimes = [...triageTimes, time].slice(-50);
          }
          return { cumulativeIncidents, cumulativeResources, triageTimes, criticalIncidents, successfulGoldenHours, hoaxCalls_intercepted };
        });
      } 
      else if (data.type === 'agent_event') {
        triggerPulse('agents');
        setAgentEvents(prev => [data.payload, ...prev].slice(0, 100));
      }
      else if (data.type === 'threat_intelligence') {
        triggerPulse('threat');
        setThreatIntelligence(data.payload);
      }
      else if (data.type === 'callback_update') {
        triggerPulse('callback');
        setCallbacks(prev => [data.payload, ...prev.filter(c => c.incident_id !== data.payload.incident_id)]);
      }
      else if (data.type === 'callback_resolved') {
        setCallbacks(prev => prev.filter(c => c.incident_id !== data.payload.incident_id));
      }
      else if (data.type === 'mci_activation') {
        setMciState({ active: true, zone: data.payload.zone, details: data.payload.details });
      }
      else if (data.type === 'mci_resolved') {
        setMciState({ active: false, zone: null, details: null });
        if (data.payload.aar_report) setReportData(data.payload.aar_report);
      }
      else if (data.type === 'demo_step') {
        setDemoStep(data.payload);
        setIsDemoRunning(true);
      }
      else if (data.type === 'demo_complete') {
        setIsDemoRunning(false);
        setDemoStep(null);
      }
      else if (data.type === 'demo_aar_preview') {
        setReportData(data.payload);
      }
      else if (data.type === 'voice_demo_trigger') {
        setIsLogoGlowing(true);
      }
      else if (data.type === 'voice_demo_response') {
        setIsLogoGlowing(false);
      }
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [updateMetrics]);

  const goldenHourRate = heroMetrics.criticalIncidents > 0 
    ? Math.round((heroMetrics.successfulGoldenHours / heroMetrics.criticalIncidents) * 100)
    : 100;

  const resolveIncident = async (id) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    await fetch(`${apiBase}/api/v1/incidents/${id}/resolve`, { method: 'POST' });
    setIsPanelOpen(false);
  };

  const handleCallback = async (id) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    await fetch(`${apiBase}/api/v1/callback/${id}/response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ additional_info: "Location confirmed via callback." })
    });
  };

  const handleFocusIncident = (incident) => {
    if (incident.location?.latitude) {
      setMapFocus({ lat: incident.location.latitude, lng: incident.location.longitude });
    }
    setSelectedIncident(incident);
    setIsPanelOpen(true);
  };

  const handleAddNote = (incident) => {
    alert(`Adding dispatch note to INC-${incident.incident_id.slice(0,8)}...`);
  };

  const startDemo = async (speed = 1.0) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    // Reset state for clean demo
    setIncidents([]);
    setAgentEvents([]);
    setCallbacks([]);
    setMciState({ active: false, zone: null, details: null });
    await fetch(`${apiBase}/api/v1/demo/start?speed=${speed}`);
    setIsDemoRunning(true);
  };

  const stopDemo = async () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    await fetch(`${apiBase}/api/v1/demo/stop`, { method: 'POST' });
    setIsDemoRunning(false);
    setDemoStep(null);
  };

  return (
    <>
      <DashboardLayout
        mciActive={mciState.active}
        topBar={
          <div className="flex items-center justify-between h-full px-4">
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-lg">AEGIS<span className="text-red-500">.</span></span>
              <span className="text-aegis-text-muted text-[10px] uppercase font-bold tracking-tighter">Emergency Operations Center</span>
            </div>

            <div className="flex items-center gap-4">
              {[
                { label: 'Calls Today', val: heroMetrics.cumulativeIncidents },
                { label: 'Active Incidents', val: metrics.active_incidents },
                { label: 'Deployed', val: heroMetrics.cumulativeResources },
                { label: 'Golden Hour', val: `${goldenHourRate}%` }
              ].map(pill => (
                <div key={pill.label} className="bg-aegis-bg-elevated px-3 py-1 rounded-full border border-aegis-border flex items-center gap-2">
                  <span className="text-[9px] uppercase font-bold text-aegis-text-muted">{pill.label}</span>
                  <span className="mono text-xs font-bold text-aegis-text-primary">{pill.val}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <VoiceCommand onGlow={setIsLogoGlowing} />
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-aegis-text-muted">System Status</span>
                <div className={`status-dot ${metrics.backend_status === 'healthy' ? 'status-dot-online' : 'status-dot-offline'}`}></div>
              </div>
            </div>
          </div>
        }
        sidebar={
          <>
            <div className="sidebar-section h-[40%] flex flex-col">
              <div className="section-header">Resource Fleet</div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                <ResourceGrid resources={resources} onFocus={setMapFocus} />
              </div>
            </div>
            
            <div className="sidebar-section h-[30%] flex flex-col">
              <div className="section-header">Hospital Status</div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                <HospitalStatusPanel hospitals={hospitals} onFocus={setMapFocus} />
              </div>
            </div>

            <div className="sidebar-section h-[30%] flex flex-col">
              <div className="section-header">System Health</div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
                 {[
                   { name: 'Ingestion', status: 'online' },
                   { name: 'Triage', status: 'online' },
                   { name: 'Dispatch', status: 'online' },
                   { name: 'Hospital API', status: metrics.backend_status === 'healthy' ? 'online' : 'offline' }
                 ].map(agent => (
                   <div key={agent.name} className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <div className={`status-dot status-dot-${agent.status}`}></div>
                       <span className="text-[11px] font-bold text-aegis-text-secondary uppercase">{agent.name}</span>
                     </div>
                     <span className="mono text-[9px] text-aegis-text-muted">L: JUST NOW</span>
                   </div>
                 ))}
                 <div className="mt-auto pt-2 border-t border-aegis-border">
                    <span className="text-[9px] uppercase font-bold text-aegis-text-muted block mb-1">Active LLM Provider</span>
                    <div className="flex items-center gap-2">
                      <div className="badge badge-info badge-xs">GEMINI-1.5-FLASH</div>
                      <span className="text-[9px] text-aegis-text-muted">FALLBACK: GROQ</span>
                    </div>
                 </div>
              </div>
            </div>
          </>
        }
        mainLeft={
          <MapView incidents={incidents} resources={resources} focusOn={mapFocus} />
        }
        mainRight={
          <>
            <div className={`card-flush h-[180px] flex-shrink-0 ${pulsePanels.feed ? 'panel-pulse' : ''}`}>
              <div className="section-header">Live Call Feed</div>
              <SimulatorConsole />
            </div>

            <div className={`card-flush flex-1 min-h-0 ${pulsePanels.queue ? 'panel-pulse' : ''}`}>
              <PriorityQueue 
                incidents={incidents} 
                onResolve={resolveIncident} 
                onFocus={handleFocusIncident}
                onAddNote={handleAddNote}
                mViewTimeline={handleFocusIncident}
                isMci={mciState.active}
              />
            </div>

            <div className={`card-flush h-[200px] flex-shrink-0 ${pulsePanels.agents ? 'panel-pulse' : ''}`}>
              <div className="section-header">Agent Trail</div>
              <AgentFeed events={agentEvents} />
            </div>

            <div className={`${pulsePanels.threat ? 'panel-pulse' : ''}`}>
              <ThreatIntelligencePanel data={threatIntelligence} />
            </div>

            {callbacks.length > 0 && (
              <div className={`${pulsePanels.callback ? 'panel-pulse' : ''}`}>
                <CallbackQueue callbacks={callbacks} onSimulateResponse={handleCallback} />
              </div>
            )}

            {mciState.active && <MCIPanel mciState={mciState} />}
            <SystemLearning />
            <WhatsAppSimulator />
            <NovelScenarioLog incidents={incidents} />
            <ReviewQueue incidents={incidents} />
          </>
        }
        extra={
          <>
            <IncidentDetailPanel 
              incident={selectedIncident} 
              isOpen={isPanelOpen} 
              onClose={() => setIsPanelOpen(false)}
              onResolve={resolveIncident}
              events={agentEvents}
              hospitals={hospitals}
            />
            <DemoController 
              onStart={startDemo}
              onStop={stopDemo}
              activeStep={demoStep}
              isRunning={isDemoRunning}
            />
          </>
        }
      />
      <AARModal data={reportData} onClose={() => setReportData(null)} />
    </>
  );
}

export default App;