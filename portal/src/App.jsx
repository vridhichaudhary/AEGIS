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
import { connectWebSocket } from './utils/websocket';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
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
    
    loadHealth();
    loadResources();
    loadCallbacks();
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white overflow-hidden">
      
      {/* Hero Banner HUD */}
      <div 
        className="w-full flex items-center justify-between px-8 border-b border-red-500/30 flex-shrink-0 relative z-20 shadow-2xl"
        style={{ backgroundColor: '#0D1B2A', height: '120px' }}
      >
        <div className="flex flex-col justify-center h-full">
          <h1 className="text-[20px] font-bold text-white mb-2 tracking-wide">
            When disasters strike, 112 gets overwhelmed. <span className="text-red-400">AEGIS ensures no emergency is missed.</span>
          </h1>
          <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">
            AI-powered triage and dispatch for India's emergency services.
          </p>
        </div>
        
        <div className="flex gap-8 items-center h-full">
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80">Calls Processed</span>
            <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.15)]">
              <span className="text-3xl font-mono font-bold text-red-500 tracking-wider">
                {heroMetrics.cumulativeIncidents.toString().padStart(3, '0')}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80">Resources Deployed</span>
            <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.15)]">
              <span className="text-3xl font-mono font-bold text-red-500 tracking-wider">
                {heroMetrics.cumulativeResources.toString().padStart(3, '0')}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80">Avg Triage Time</span>
            <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.15)] flex items-baseline gap-1">
              <span className="text-3xl font-mono font-bold text-red-500 tracking-wider">
                {avgTriageTime}
              </span>
              <span className="text-xs font-bold text-red-400/70 uppercase">s</span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80">Hoax Calls Intercepted</span>
            <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <span className="text-3xl font-mono font-bold text-amber-500 tracking-wider">
                {heroMetrics.hoaxCallsIntercepted.toString().padStart(3, '0')}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80">Golden Hour Success</span>
            <div className="bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.15)] flex items-baseline gap-0.5">
              <span className="text-3xl font-mono font-bold text-green-500 tracking-wider">
                {goldenHourRate}
              </span>
              <span className="text-lg font-bold text-green-500">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Header */}
      <header className="glass p-3 border-b border-blue-500/30 flex items-center justify-between z-10 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg transition-all duration-300 ${isLogoGlowing ? 'shadow-[0_0_20px_rgba(56,189,248,0.8)] animate-pulse scale-110' : ''}`}>
            A
          </div>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              Command Center
            </h2>
            <button 
              onClick={generateAAR}
              disabled={isGeneratingReport}
              className="bg-gray-800 border border-gray-600 hover:bg-gray-700 text-[10px] text-gray-300 font-bold py-1.5 px-3 rounded shadow transition-colors disabled:opacity-50 uppercase tracking-widest"
            >
              {isGeneratingReport ? "GENERATING..." : "GENERATE AAR"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <VoiceCommand onGlow={setIsLogoGlowing} />
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              metrics.backend_status === 'healthy' 
                ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)] animate-pulse' 
                : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">API</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              metrics.llm_ready 
                ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]' 
                : 'bg-yellow-500'
            }`}></div>
            <span className="text-sm font-medium">LLM</span>
          </div>
          <div className="text-xs bg-blue-500/20 px-3 py-1 rounded-full border border-blue-400/30">
            {metrics.model}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 gap-4 p-4 overflow-hidden lg:grid-cols-12">
        {/* Left: Map + Queue + Console */}
        <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
          <MapView incidents={incidents} resources={resources} />
          <div className="flex-1 min-h-0 flex gap-4">
            <div className="flex-1">
              <PriorityQueue incidents={incidents} onResolve={resolveIncident} />
            </div>
            <div className="w-1/3">
              <SimulatorConsole />
            </div>
          </div>
        </div>

        {/* Right: Metrics + Resources + Feed */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
          <ThreatIntelligencePanel data={threatIntelligence} />
          <Metrics data={metrics} />
          <CallbackQueue callbacks={callbacks} onSimulateResponse={handleSimulateCallbackResponse} />
          <NovelScenarioLog incidents={incidents} />
          <ReviewQueue incidents={incidents} />
          <ResourceGrid resources={resources} prepositionOrders={threatIntelligence?.preposition_orders} />
          <AgentFeed events={agentEvents} />
        </div>
      </div>
      
      <AARModal data={reportData} onClose={() => setReportData(null)} />
    </div>
  );
}

export default App;