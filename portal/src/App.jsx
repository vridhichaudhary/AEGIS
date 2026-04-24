import React, { useEffect, useState } from 'react';
import AgentFeed from './components/AgentFeed';
import MapView from './components/MapView';
import Metrics from './components/Metrics';
import PriorityQueue from './components/PriorityQueue';
import ResourceGrid from './components/ResourceGrid';
import { connectWebSocket } from './utils/websocket';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [metrics, setMetrics] = useState({
    active_incidents: 0,
    avg_eta: '-',
    load: 'Low',
  });

  useEffect(() => {
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

          setMetrics({
            active_incidents: activeCount,
            avg_eta: etaValues.length
              ? (etaValues.reduce((sum, value) => sum + value, 0) / etaValues.length).toFixed(1)
              : '-',
            load: activeCount > 10 ? 'High' : activeCount > 4 ? 'Medium' : 'Low',
          });

          return next;
        });
      } else if (data.type === 'resource_update') {
        setResources(data.payload);
      } else if (data.type === 'agent_event') {
        setAgentEvents((prev) => [data.payload, ...prev].slice(0, 50));
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold">AEGIS Command Center</h1>
        <p className="text-sm text-gray-400">Real-time Emergency Dispatch Intelligence</p>
      </header>

      <div className="flex-1 grid grid-cols-1 gap-4 p-4 overflow-hidden lg:grid-cols-12">
        <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
          <MapView incidents={incidents} resources={resources} />
          <PriorityQueue incidents={incidents} />
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4 overflow-auto min-h-0">
          <ResourceGrid resources={resources} />
          <AgentFeed events={agentEvents} />
          <Metrics data={metrics} />
        </div>
      </div>
    </div>
  );
}

export default App;
