import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

    const loadHealth = async () => {
      try {
        const response = await fetch(`${apiBase}/health`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
    const ws = connectWebSocket();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'incident_update') {
        setIncidents((prev) => {
          const next = [data.payload, ...prev.filter((incident) => incident.incident_id !== data.payload.incident_id)];
          const activeCount = next.length;
          const etaValues = next
            .flatMap((incident) => incident.assigned_resources || [])
            .map((resource) => resource.eta_minutes)
            .filter((value) => typeof value === 'number');

          setMetrics((prevMetrics) => ({
            ...prevMetrics,
            active_incidents: activeCount,
            avg_eta: etaValues.length
              ? (etaValues.reduce((sum, value) => sum + value, 0) / etaValues.length).toFixed(1)
              : '-',
            load: activeCount > 10 ? 'High' : activeCount > 4 ? 'Medium' : 'Low',
          }));

          return next;
        });
      } else if (data.type === 'resource_update') {
        setResources(data.payload);
      } else if (data.type === 'agent_event') {
        setAgentEvents((prev) => [data.payload, ...prev].slice(0, 50));
      }
    };

    return () => {
      if (ws.readyState === 1) {
        ws.close();
      } else {
        ws.onopen = () => ws.close();
      }
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-transparent text-white overflow-hidden">
      <header className="glass p-4 border-b border-gray-700/50 flex items-center justify-between z-10 relative">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">AEGIS Command Center</h1>
          <p className="text-sm text-gray-400">Real-time Emergency Dispatch Intelligence</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${metrics.backend_status === 'healthy' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse-slow' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'}`}></div>
                <span className="text-sm text-gray-300">API</span>
            </div>
            <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${metrics.llm_ready ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse-slow' : 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)]'}`}></div>
                <span className="text-sm text-gray-300">LLM ({metrics.model})</span>
            </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 gap-4 p-4 overflow-hidden lg:grid-cols-12 relative z-0">
        <div className="lg:col-span-8 flex flex-col gap-4 min-h-0 animate-fade-in">
          <MapView incidents={incidents} resources={resources} />
          <div className="flex-1 min-h-0 flex gap-4">
            <PriorityQueue incidents={incidents} />
            <div className="w-1/3 flex flex-col min-h-0">
               <SimulatorConsole />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden min-h-0 animate-fade-in" style={{animationDelay: '100ms'}}>
          <Metrics data={metrics} />
          <ResourceGrid resources={resources} />
          <AgentFeed events={agentEvents} />
        </div>
      </div>
    </div>
  );
}

export default App;
