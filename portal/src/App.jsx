import React, { useEffect, useState, useCallback, useRef } from 'react';
import AgentFeed from './components/AgentFeed';
import MapView from './components/MapView';
import PriorityQueue from './components/PriorityQueue';
import ResourceGrid from './components/ResourceGrid';
import SimulatorConsole from './components/SimulatorConsole';
import HospitalStatusPanel from './components/HospitalStatusPanel';
import DemoController from './components/DemoController';
import DashboardLayout from './layouts/DashboardLayout';
import IncidentDetailPanel from './components/IncidentDetailPanel';
import AARModal from './components/AARModal';
import { connectWebSocket } from './utils/websocket';
import { Activity, Shield, Users, Clock, Zap } from 'lucide-react';

function App() {
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [mciState, setMciState] = useState({ active: false, zone: null, details: null });
  const [reportData, setReportData] = useState(null);
  
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(null);

  const [metrics, setMetrics] = useState({
    active_incidents: 0,
    avg_eta: '-',
    load: 'Normal',
    backend_status: 'Healthy',
  });

  const seenIncidents = useRef(new Set());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const PRODUCTION_BACKEND = 'https://aegis-5lpx.onrender.com';
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : PRODUCTION_BACKEND);
    
    const loadData = async () => {
      try {
        const [healthRes, resourcesRes, hospitalsRes] = await Promise.all([
          fetch(`${apiBase}/health`),
          fetch(`${apiBase}/api/v1/resources`),
          fetch(`${apiBase}/api/v1/hospitals`)
        ]);

        if (!healthRes.ok) throw new Error("Backend offline");

        const health = await healthRes.json();
        const resData = await resourcesRes.json();
        const hospData = await hospitalsRes.json();

        setResources(resData.resources || []);
        setHospitals(hospData.hospitals || []);
        setLoading(false);
      } catch (e) {
        console.error("Failed to load initial data", e);
        setError("Connection to AEGIS Backend failed. Please ensure the server is running.");
        setLoading(false);
      }
    };
    
    loadData();

    const ws = connectWebSocket((event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'incident_update') {
        const incident = data.payload;
        setIncidents((prev) => {
          const filtered = prev.filter(i => i.incident_id !== incident.incident_id);
          const updated = [incident, ...filtered];
          setMetrics(m => ({ ...m, active_incidents: updated.filter(i => i.status !== 'RESOLVED').length }));
          return updated;
        });
      } 
      else if (data.type === 'agent_event') {
        setAgentEvents(prev => [data.payload, ...prev].slice(0, 50));
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
    });

    return () => ws.close();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-aegis-bg-base">
         <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-6"></div>
         <h2 className="text-xl font-bold text-slate-800">Initializing AEGIS Portal</h2>
         <p className="text-slate-500 text-sm mt-2 font-medium">Synchronizing with dispatch network...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-aegis-bg-base p-8 text-center">
         <div className="bg-red-50 p-6 rounded-3xl border border-red-100 mb-6">
            <AlertTriangle size={48} className="text-red-500" />
         </div>
         <h2 className="text-2xl font-bold text-slate-800">Network Error</h2>
         <p className="text-slate-500 mt-2 max-w-md font-medium">{error}</p>
         <button onClick={() => window.location.reload()} className="mt-8 btn btn-primary px-8 py-3 rounded-xl shadow-xl shadow-teal-700/20 transition-all active:scale-95">
            Retry Connection
         </button>
      </div>
    );
  }

  const resolveIncident = async (id) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://aegis-5lpx.onrender.com');
    await fetch(`${apiBase}/api/v1/incidents/${id}/resolve`, { method: 'POST' });
    setIsPanelOpen(false);
  };

  const handleFocusIncident = (incident) => {
    if (incident.location?.latitude) {
      setMapFocus({ lat: incident.location.latitude, lng: incident.location.longitude });
    }
    setSelectedIncident(incident);
    setIsPanelOpen(true);
  };

  const handleStartDemo = async (speed = 1.0) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://aegis-5lpx.onrender.com');
    await fetch(`${apiBase}/api/v1/demo/start?speed=${speed}`);
  };

  const handleStopDemo = async () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://aegis-5lpx.onrender.com');
    await fetch(`${apiBase}/api/v1/demo/stop`, { method: 'POST' });
  };

  return (
    <>
      <DashboardLayout
        mciActive={mciState.active}
        topBar={
          <div className="flex items-center justify-between w-full px-8">
            <div className="flex items-center gap-3">
              <div className="bg-aegis-accent p-2 rounded-lg">
                <Shield className="text-white" size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-aegis-text-primary tracking-tight">AEGIS<span className="text-aegis-accent"> Dispatch</span></span>
                <span className="text-[10px] uppercase font-bold text-aegis-text-muted tracking-widest">Emergency Management System</span>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <Activity className="text-red-500" size={18} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Active Incidents</span>
                  <span className="text-lg font-bold text-slate-800 leading-none">{metrics.active_incidents}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <Users className="text-blue-500" size={18} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Resources</span>
                  <span className="text-lg font-bold text-slate-800 leading-none">{resources.length}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <Zap className="text-amber-500" size={18} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">System Status</span>
                  <div className="flex items-center gap-1.5">
                    <div className="status-dot status-dot-online"></div>
                    <span className="text-xs font-bold text-slate-700">Online</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
               <button className="btn btn-primary shadow-lg shadow-teal-700/20">
                 System Console
               </button>
            </div>
          </div>
        }
        topLeft={
          <div className="h-full flex flex-col">
            <div className="section-header">Live Incident Map</div>
            <div className="flex-1 min-h-0">
               <MapView incidents={incidents} resources={resources} focusOn={mapFocus} />
            </div>
          </div>
        }
        topRight={
          <div className="h-full flex flex-col">
            <PriorityQueue 
              incidents={incidents} 
              onResolve={resolveIncident} 
              onFocus={handleFocusIncident}
            />
          </div>
        }
        bottomLeft={
          <div className="h-full flex flex-col">
            <div className="section-header">Testing Console & Agent Intelligence</div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="h-1/2 border-b border-slate-100">
                <SimulatorConsole />
              </div>
              <div className="flex-1 overflow-y-auto">
                <AgentFeed events={agentEvents} />
              </div>
            </div>
          </div>
        }
        bottomRight={
          <div className="h-full flex flex-col">
            <div className="section-header">Resources & Facilities</div>
            <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
               <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50">
                 <ResourceGrid resources={resources} />
               </div>
               <div className="h-1/2 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50">
                 <HospitalStatusPanel hospitals={hospitals} />
               </div>
            </div>
          </div>
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
              activeStep={demoStep}
              isRunning={isDemoRunning}
              onStart={handleStartDemo}
              onStop={handleStopDemo}
            />
          </>
        }
      />
      <AARModal data={reportData} onClose={() => setReportData(null)} />
    </>
  );
}

export default App;