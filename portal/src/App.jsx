import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import PriorityQueue from './components/PriorityQueue';
import ResourceGrid from './components/ResourceGrid';
import AgentFeed from './components/AgentFeed';
import Metrics from './components/Metrics';
import { connectWebSocket } from './utils/websocket';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [metrics, setMetrics] = useState({});

  useEffect(() => {
    // Connect WebSocket
    const ws = connectWebSocket('ws://localhost:8000/ws/events');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'incident_update') {
        setIncidents(prev => [...prev, data.payload]);
      } else if (data.type === 'resource_update') {
        setResources(data.payload);
      } else if (data.type === 'agent_event') {
        setAgentEvents(prev => [data.payload, ...prev].slice(0, 50));
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 p-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold">AEGIS Command Center</h1>
        <p className="text-sm text-gray-400">Real-time Emergency Dispatch Intelligence</p>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left: Map + Priority Queue */}
        <div className="col-span-8 flex flex-col gap-4">
          <MapView incidents={incidents} resources={resources} />
          <PriorityQueue incidents={incidents} />
        </div>

        {/* Right: Resources + Agent Feed + Metrics */}
        <div className="col-span-4 flex flex-col gap-4 overflow-auto">
          <ResourceGrid resources={resources} />
          <AgentFeed events={agentEvents} />
          <Metrics data={metrics} />
        </div>
      </div>
    </div>
  );
}

export default App;