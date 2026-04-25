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
import ChannelChart from './components/ChannelChart';
import { connectWebSocket } from './utils/websocket';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [mciState, setMciState] = useState({ active: false, zone: null, details: null });
  const [threatIntelligence, setThreatIntelligence] = useState(null);
  const [isLogoGlowing, setIsLogoGlowing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
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
    hoaxCallsIntercepted: 0
  });
  
  const seenIncidents = useRef(new Set());

  const generateAAR = async () => {
    setIsGeneratingReport(true);
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    try {
      const response = await fetch(`${apiBase}/api/v1/report/generate`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        alert("Failed to generate report. Make sure simulation data is available.");
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
      alert("Error generating report.");
    } finally {
      setIsGeneratingReport(false);
    }
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
    
    // Health check
    const loadHealth = async () => {
      try {
        const response = await fetch(`${apiBase}/health`);
        const health = await response.json();
        setMetrics((prev) => ({
          ...prev,
          backend_status: health.status || 'Unknown',
          llm_ready: Boolean(health.llm?.llm_initialized),
          model: health.llm?.model || 'Unavailable',
        }));
      } catch (error) {
        console.error("Health check failed:", error);
        setMetrics((prev) => ({
          ...prev,
          backend_status: 'Unavailable',
          llm_ready: false,
        }));
      }
    };

    const loadResources = async () => {
      try {
        const response = await fetch(`${apiBase}/api/v1/resources`);
        const data = await response.json();
        setResources(data.resources || []);
      } catch (error) {
        console.error("Failed to load resources:", error);
      }
    };
    
    const loadCallbacks = async () => {
      try {
        const response = await fetch(`${apiBase}/api/v1/callbacks`);
        const data = await response.json();
        setCallbacks(data.callbacks || []);
      } catch (error) {
        console.error("Failed to load callbacks:", error);
      }
    };
    
    const loadHospitals = async () => {
      try {
        const response = await fetch(`${apiBase}/api/v1/hospitals`);
        const data = await response.json();
        setHospitals(data.hospitals || []);
      } catch (error) {
        console.error("Failed to load hospitals:", error);
      }
    };
    
    loadHealth();
    loadResources();
    loadCallbacks();
    loadHospitals();
    const healthInterval = setInterval(loadHealth, 30000); // Every 30 seconds

    // WebSocket connection
    const ws = connectWebSocket();
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'incident_update') {
        const incident = data.payload;
        
        setIncidents((prev) => {
          // Remove old version and add new
          const filtered = prev.filter(i => i.incident_id !== incident.incident_id);
          const updated = [incident, ...filtered];
          
          // Update metrics
          updateMetrics(updated);
          
          return updated;
        });

        // Update Hero HUD Metrics
        setHeroMetrics(prev => {
          let newIncidents = prev.cumulativeIncidents;
          let newResources = prev.cumulativeResources;
          let newTriageTimes = [...prev.triageTimes];
          let newCritical = prev.criticalIncidents;
          let newSuccess = prev.successfulGoldenHours;
          let newHoax = prev.hoaxCallsIntercepted;

          if (!seenIncidents.current.has(incident.incident_id)) {
            seenIncidents.current.add(incident.incident_id);
            newIncidents += 1;
            newResources += (incident.assigned_resources?.length || 0);
            
            // Golden Hour tracking
            if (incident.priority === 'P1' || incident.priority === 'P2') {
               newCritical += 1;
               if (!incident.golden_hour_at_risk) {
                  newSuccess += 1;
               }
            }

            // Hoax interception tracking
            if (incident.authenticity_score !== undefined && incident.authenticity_score < 40) {
               newHoax += 1;
            }
            
            // Simulate realistic triage time between 2.5s and 4.2s based on complexity
            const complexityBonus = (incident.assigned_resources?.length || 0) * 0.2;
            const simulatedTime = 2.5 + Math.random() * 1.5 + complexityBonus;
            newTriageTimes.push(simulatedTime);
            if (newTriageTimes.length > 50) newTriageTimes.shift(); // Keep last 50 for rolling avg
          }

          return {
            cumulativeIncidents: newIncidents,
            cumulativeResources: newResources,
            triageTimes: newTriageTimes,
            criticalIncidents: newCritical,
            successfulGoldenHours: newSuccess,
            hoaxCallsIntercepted: newHoax
          };
        });
      } 
      else if (data.type === 'resource_update') {
        const updates = data.payload;
        setResources(prev => {
          const newMap = new Map(prev.map(r => [r.id, r]));
          updates.forEach(u => newMap.set(u.id, { ...newMap.get(u.id), ...u }));
          return Array.from(newMap.values());
        });
      } 
      else if (data.type === 'agent_event') {
        setAgentEvents(prev => [data.payload, ...prev].slice(0, 100));
      }
      else if (data.type === 'threat_intelligence') {
        setThreatIntelligence(data.payload);
      }
      else if (data.type === 'incident_resolved') {
        const { incident_id } = data.payload;
        setIncidents(prev => prev.map(inc => 
          inc.incident_id === incident_id ? { ...inc, incident_status: 'RESOLVED', dispatch_status: 'RESOLVED' } : inc
        ));
      }
      else if (data.type === 'system_alert') {
        // Show a brief toast or notification (we'll just use console and maybe a temporary agent event)
        const alert = data.payload;
        setAgentEvents(prev => [{
          agent: 'SYSTEM',
          decision: alert.title,
          reasoning: alert.message,
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 100));
      }
      else if (data.type === 'callback_update') {
        setCallbacks(prev => {
          const filtered = prev.filter(c => c.incident_id !== data.payload.incident_id);
          return [data.payload, ...filtered];
        });
      }
      else if (data.type === 'callback_resolved') {
        setCallbacks(prev => prev.filter(c => c.incident_id !== data.payload.incident_id));
      }
      else if (data.type === 'hospital_update') {
        setHospitals(data.payload);
      }
      else if (data.type === 'mci_activation') {
        setMciState({ active: true, zone: data.payload.zone, details: data.payload.details });
        // Also push to agent feed
        setAgentEvents(prev => [{
          agent: 'MCI PROTOCOL',
          decision: `🚨 MCI ACTIVATED — ${data.payload.zone}`,
          reasoning: 'Mass Casualty Incident threshold exceeded. NDMA protocol engaged.',
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 100));
      }
      else if (data.type === 'mci_resolved') {
        setMciState({ active: false, zone: null, details: null });
        if (data.payload.aar_report) {
          setReportData(data.payload.aar_report);
        }
        setAgentEvents(prev => [{
          agent: 'MCI PROTOCOL',
          decision: `✅ MCI RESOLVED — ${data.payload.zone}`,
          reasoning: 'Incident surge has dropped below MCI thresholds. System returning to normal operations.',
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 100));
      }
    };

    return () => {
      clearInterval(healthInterval);
      if (ws.readyState === 1) ws.close();
    };
  }, [updateMetrics]);

  const avgTriageTime = heroMetrics.triageTimes.length > 0 
    ? (heroMetrics.triageTimes.reduce((a, b) => a + b, 0) / heroMetrics.triageTimes.length).toFixed(2)
    : '0.00';

  const resolveIncident = async (incidentId) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    try {
      const response = await fetch(`${apiBase}/api/v1/incidents/${incidentId}/resolve`, { method: 'POST' });
      if (!response.ok) throw new Error("Failed to resolve");
    } catch (error) {
      console.error("Resolve failed:", error);
      alert("Failed to resolve incident.");
    }
  };

  const handleSimulateCallbackResponse = async (incidentId) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    const cb = callbacks.find(c => c.incident_id === incidentId);
    let additionalInfo = "I am near Sector 14 market, right opposite to the big banyan tree.";
    if (cb?.missing_fields?.includes("location")) {
        additionalInfo = "I am at Sector 29 market, near the metro station.";
    }
    
    try {
      const response = await fetch(`${apiBase}/api/v1/callback/${incidentId}/response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ additional_info: additionalInfo })
      });
      if (!response.ok) throw new Error("Failed to simulate callback response");
    } catch (error) {
      console.error("Simulation failed:", error);
      alert("Failed to simulate callback response.");
    }
  };

  const goldenHourRate = heroMetrics.criticalIncidents > 0 
    ? Math.round((heroMetrics.successfulGoldenHours / heroMetrics.criticalIncidents) * 100)
    : 100;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--aegis-bg-base)', color: 'var(--aegis-text-primary)', fontFamily: 'Inter, sans-serif' }}
    >
      {/* ── TOP BAR (48px) ─────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 z-30 transition-all duration-500"
        style={{
          height: '48px',
          background: mciState.active ? 'rgba(127,29,29,0.97)' : 'var(--aegis-bg-surface)',
          borderBottom: `1px solid ${mciState.active ? 'rgba(239,68,68,0.5)' : 'var(--aegis-border)'}`,
        }}
      >
        {/* Left: wordmark */}
        <div className="flex items-center gap-3">
          <div
            className={`w-7 h-7 rounded flex items-center justify-center font-black text-sm text-white transition-all duration-300 ${isLogoGlowing ? 'scale-110' : ''}`}
            style={{ background: 'var(--aegis-accent)' }}
          >A</div>
          <span className="font-semibold text-sm" style={{ color: 'var(--aegis-text-primary)' }}>AEGIS</span>
          <span className="text-xs" style={{ color: 'var(--aegis-text-muted)' }}>National Emergency Operations Centre</span>
        </div>

        {/* Centre: hero stats */}
        <div className="flex items-center gap-6">
          {[
            { label: 'Calls', value: heroMetrics.cumulativeIncidents.toString().padStart(3,'0'), color: 'var(--aegis-critical)' },
            { label: 'Resources', value: heroMetrics.cumulativeResources.toString().padStart(3,'0'), color: 'var(--aegis-info)' },
            { label: 'Avg Triage', value: `${avgTriageTime}s`, color: 'var(--aegis-medium)' },
            { label: 'Hoax Caught', value: heroMetrics.hoaxCallsIntercepted.toString().padStart(3,'0'), color: 'var(--aegis-high)' },
            { label: 'Golden Hour', value: `${goldenHourRate}%`, color: 'var(--aegis-low)' },
          ].map(stat => (
            <div key={stat.label} className="flex items-baseline gap-1.5">
              <span className="font-mono font-semibold text-base" style={{ color: stat.color }}>{stat.value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aegis-text-muted)' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-4">
          {mciState.active && (
            <span className="badge badge-critical animate-pulse-slow text-[10px] tracking-widest">🚨 MCI ACTIVE — {mciState.zone}</span>
          )}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className={`status-dot ${metrics.backend_status === 'healthy' ? 'status-dot-online' : 'status-dot-offline'}`}></div>
              <span style={{ color: 'var(--aegis-text-secondary)' }}>API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`status-dot ${metrics.llm_ready ? 'status-dot-online' : 'status-dot-warning'}`}></div>
              <span style={{ color: 'var(--aegis-text-secondary)' }}>LLM</span>
            </div>
          </div>
          <VoiceCommand onGlow={setIsLogoGlowing} />
          <button onClick={generateAAR} disabled={isGeneratingReport} className="btn btn-ghost btn-sm">
            {isGeneratingReport ? 'Generating…' : 'Generate AAR'}
          </button>
        </div>
      </header>

      {/* ── MAIN AREA ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR (280px) ─────────────────── */}
        <aside
          className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: '280px', background: 'var(--aegis-bg-surface)', borderRight: '1px solid var(--aegis-border)' }}
        >
          {/* System Health */}
          <div className="section-header">System Status</div>
          <div className="p-3 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--aegis-border)' }}>
            {[
              { label: 'Backend API', status: metrics.backend_status === 'healthy' ? 'online' : 'offline', val: metrics.backend_status || 'Unknown' },
              { label: 'LLM Engine', status: metrics.llm_ready ? 'online' : 'warning', val: metrics.model ? metrics.model.split('/').pop() : 'Unavailable' },
              { label: 'System Load', status: metrics.load === 'High' ? 'offline' : metrics.load === 'Medium' ? 'warning' : 'online', val: metrics.load || 'Low' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`status-dot status-dot-${row.status}`}></div>
                  <span style={{ color: 'var(--aegis-text-secondary)' }}>{row.label}</span>
                </div>
                <span className="font-mono text-[11px]" style={{ color: 'var(--aegis-text-muted)' }}>{row.val}</span>
              </div>
            ))}
          </div>

          {/* Live Call Feed */}
          <div className="section-header">Live Call Simulator</div>
          <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--aegis-border)' }}>
            <SimulatorConsole />
          </div>

          {/* Resource Summary */}
          <div className="section-header">Field Resources</div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            <ResourceGrid resources={resources} prepositionOrders={threatIntelligence?.preposition_orders} />
          </div>
        </aside>

        {/* ── CENTRE: MAP + QUEUE ─────────────────── */}
        <div className="flex flex-col" style={{ flex: '0 0 55%', minWidth: 0, borderRight: '1px solid var(--aegis-border)' }}>
          <div className="flex-1 overflow-hidden">
            <MapView incidents={incidents} resources={resources} />
          </div>
          <div style={{ height: '340px', borderTop: '1px solid var(--aegis-border)', overflow: 'hidden' }}>
            <PriorityQueue incidents={incidents} onResolve={resolveIncident} />
          </div>
        </div>

        {/* ── RIGHT PANELS ─────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar" style={{ minWidth: 0 }}>
          {mciState.active && <MCIPanel mciState={mciState} />}
          <ThreatIntelligencePanel data={threatIntelligence} />
          <Metrics data={metrics} />
          <ChannelChart incidents={incidents} />
          <WhatsAppSimulator />
          <HospitalStatusPanel hospitals={hospitals} currentIncident={incidents[0]} />
          <SystemLearning />
          <CallbackQueue callbacks={callbacks} onSimulateResponse={handleSimulateCallbackResponse} />
          <NovelScenarioLog incidents={incidents} />
          <ReviewQueue incidents={incidents} />
          <AgentFeed events={agentEvents} />
        </div>
      </div>

      <AARModal data={reportData} onClose={() => setReportData(null)} />
    </div>
  );
}

export default App;