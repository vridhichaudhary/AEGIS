import React, { useEffect, useState, useCallback } from 'react';
import AgentFeed from './components/AgentFeed';
import MapView from './components/MapView';
import Metrics from './components/Metrics';
import PriorityQueue from './components/PriorityQueue';
import ResourceGrid from './components/ResourceGrid';
import SimulatorConsole from './components/SimulatorConsole';
import { connectWebSocket } from './utils/websocket';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [metrics, setMetrics] = useState({
    active_incidents: 0,
    avg_eta: '-',
    load: 'Low',
    llm_ready: false,
    backend_status: 'Unknown',
    model: 'Unavailable',
  });

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
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    
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
    
    loadHealth();
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
      } 
      else if (data.type === 'resource_update') {
        setResources(data.payload);
      } 
      else if (data.type === 'agent_event') {
        setAgentEvents(prev => [data.payload, ...prev].slice(0, 100));
      }
    };

    return () => {
      clearInterval(healthInterval);
      if (ws.readyState === 1) ws.close();
    };
  }, [updateMetrics]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="glass p-4 border-b border-blue-500/30 flex items-center justify-between z-10 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg">
            A
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              AEGIS Command Center
            </h1>
            <p className="text-sm text-blue-300">Agentic Emergency Grid Intelligence System</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
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
              <PriorityQueue incidents={incidents} />
            </div>
            <div className="w-1/3">
              <SimulatorConsole />
            </div>
          </div>
        </div>

        {/* Right: Metrics + Resources + Feed */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden min-h-0">
          <Metrics data={metrics} />
          <ResourceGrid resources={resources} />
          <AgentFeed events={agentEvents} />
        </div>
      </div>
    </div>
  );
}

export default App;