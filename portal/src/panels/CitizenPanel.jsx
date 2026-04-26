import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://aegis-5lpx.onrender.com';

const PRIORITY_COLORS = { P1: '#C53030', P2: '#C05621', P3: '#B7791F', P4: '#2F855A', P5: '#718096' };
const STATUS_STEPS = ['Received', 'Parsing', 'Triaged', 'Dispatched'];

const generateCallerId = () => `+91-112-${Math.floor(10000000 + Math.random() * 90000000)}`;

const deriveStatusStep = (incident) => {
  if (!incident) return null;

  const dispatchStatus = incident.dispatch_status;
  if (dispatchStatus === 'assigned' || incident.incident_status === 'DISPATCHED') {
    return 'Dispatched';
  }

  if (
    dispatchStatus === 'awaiting_location' ||
    dispatchStatus === 'pending_callback' ||
    dispatchStatus === 'review_required' ||
    dispatchStatus === 'resource_unavailable' ||
    dispatchStatus === 'not_required' ||
    incident.priority
  ) {
    return 'Triaged';
  }

  return 'Parsing';
};

// ─── Haversine Distance ────────────────────────────────────────────────────────
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ─── Small Incident Map ───────────────────────────────────────────────────────
const IncidentMiniMap = ({ incident, depots = [] }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const incidentMarkerRef = useRef(null);
  const depotMarkersRef = useRef([]);
  const vectorRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([28.6139, 77.2090], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(mapInstance.current);
    }

    if (incident?.location?.latitude) {
      const lat = incident.location.latitude;
      const lng = incident.location.longitude;
      const incPos = [lat, lng];

      if (incidentMarkerRef.current) {
        mapInstance.current.removeLayer(incidentMarkerRef.current);
      }

      const color = PRIORITY_COLORS[incident.priority] || '#C53030';
      const html = `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:4px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.4);animation:pulse-ring 1.5s infinite;"></div>`;
      const icon = L.divIcon({ className: '', html, iconSize: [22, 22], iconAnchor: [11, 11] });
      incidentMarkerRef.current = L.marker(incPos, { icon }).addTo(mapInstance.current);
      
      // Clear old vectors and markers
      vectorRef.current.forEach(v => mapInstance.current.removeLayer(v));
      vectorRef.current = [];
      depotMarkersRef.current.forEach(m => mapInstance.current.removeLayer(m));
      depotMarkersRef.current = [];

  // Find top 3 nearest — prefer category-relevant depot types
      const cat = incident?.incident_type?.category || 'other';
      const typePreference = {
        'accident': ['ambulance', 'police', 'fire'],
        'medical':  ['ambulance', 'police', 'fire'],
        'fire':     ['fire', 'ambulance', 'rescue'],
        'violence': ['police', 'ambulance', 'fire'],
        'natural_disaster': ['rescue', 'ambulance', 'fire'],
      };
      const preferred = typePreference[cat] || ['ambulance', 'police', 'fire'];

      const nearby = depots.map(d => ({
          ...d,
          dist: haversineDistance(lat, lng, d.lat, d.lng),
          typeOrder: preferred.indexOf(d.type) >= 0 ? preferred.indexOf(d.type) : 99,
      })).sort((a, b) => a.typeOrder !== b.typeOrder ? a.typeOrder - b.typeOrder : a.dist - b.dist).slice(0, 3);

      nearby.forEach(depot => {
          const emoji = depot.type === 'fire' ? '🚒' : depot.type === 'police' ? '👮' : '🏥';
          const dColor = depot.type === 'fire' ? '#C05621' : depot.type === 'police' ? '#553C9A' : '#2B6CB0';
          
          const dHtml = `<div style="background:white;width:30px;height:30px;border-radius:50%;border:2px solid ${dColor};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${emoji}</div>`;
          const dIcon = L.divIcon({ className: '', html: dHtml, iconSize: [30, 30], iconAnchor: [15, 15] });
          const m = L.marker([depot.lat, depot.lng], { icon: dIcon }).addTo(mapInstance.current);
          depotMarkersRef.current.push(m);

          // Draw vector line with arrowhead
          const poly = L.polyline([[depot.lat, depot.lng], incPos], {
              color: dColor,
              weight: 2,
              dashArray: '5, 8',
              opacity: 0.6,
              className: 'tactical-vector'
          }).addTo(mapInstance.current);
          vectorRef.current.push(poly);

          // Add a small arrowhead at the incident end
          const arrowHtml = `<div style="color:${dColor}; font-size:12px; transform: rotate(${getAngle([depot.lat, depot.lng], incPos)}deg);">➤</div>`;
          const arrowIcon = L.divIcon({ className: '', html: arrowHtml, iconSize: [12, 12], iconAnchor: [6, 6] });
          const arrowMarker = L.marker(incPos, { icon: arrowIcon, zIndexOffset: -10 }).addTo(mapInstance.current);
          vectorRef.current.push(arrowMarker);
      });

      mapInstance.current.flyTo(incPos, 14, { animate: true, duration: 1 });
    }
  }, [incident, depots]);

  // Helper to get angle for arrowhead
  const getAngle = (start, end) => {
    const dy = end[0] - start[0];
    const dx = end[1] - start[1];
    return Math.atan2(dy, dx) * 180 / Math.PI + 90;
  };

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div style={{ height: '280px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

// ─── Status Track ─────────────────────────────────────────────────────────────
const StatusTrack = ({ status }) => {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="sos-status-track-horizontal">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex-1 flex flex-col items-center relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 z-10
              ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110' : 'bg-slate-100 text-slate-400'}`}>
              {done ? '✓' : idx + 1}
            </div>
            <span className={`mt-2 text-[10px] font-black uppercase tracking-widest ${active ? 'text-blue-700' : 'text-slate-400'}`}>
              {step}
            </span>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`absolute left-[50%] right-[-50%] top-4 h-[2px] transition-colors duration-500
                ${idx < currentIdx ? 'bg-green-500' : 'bg-slate-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Response Metrics ─────────────────────────────────────────────────────────
const ResponseMetrics = ({ closest }) => {
    if (!closest) return null;
    const { depot, distance, eta } = closest;
    const emoji = depot.type === 'fire' ? '🚒' : depot.type === 'police' ? '👮' : '🏥';
    
    return (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-4 animate-slide-up mb-6">
            <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl border border-blue-200">
                {emoji}
            </div>
            <div className="flex-1">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Closest Responder</div>
                <div className="text-sm font-bold text-slate-800">{depot.name}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1">📍 <strong>{distance.toFixed(1)} km</strong></span>
                    <span className="flex items-center gap-1">⏱️ <strong>{eta.toFixed(0)} mins</strong></span>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <div className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-blue-200">EN ROUTE</div>
            </div>
        </div>
    );
};

// ─── Nearby Station Row ───────────────────────────────────────────────────────
const NearbyStationRow = ({ depot, distance, eta }) => {
  const emoji = depot.type === 'fire' ? '🚒' : depot.type === 'police' ? '👮' : '🏥';
  const color = depot.type === 'fire' ? '#C05621' : depot.type === 'police' ? '#553C9A' : '#2B6CB0';
  
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm" style={{ backgroundColor: `${color}10`, color, border: `1px solid ${color}20` }}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color }}>{depot.type} STATION</div>
        <div className="text-sm font-bold text-slate-800 truncate">{depot.name}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {distance.toFixed(1)} km away • Response: <span className="font-bold text-slate-700">{eta.toFixed(0)} mins</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Citizen Panel ───────────────────────────────────────────────────────
const CitizenPanel = ({ latestCitizenIncident, allDepots = [] }) => {
  const [text, setText] = useState('');
  const [callerId] = useState(generateCallerId);
  const [submitting, setSubmitting] = useState(false);
  const [statusStep, setStatusStep] = useState(null);
  const [incident, setIncident] = useState(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (latestCitizenIncident) {
      setIncident(latestCitizenIncident);
      setStatusStep(deriveStatusStep(latestCitizenIncident));
    }
  }, [latestCitizenIncident]);

  // Sort by incident-category relevance first, then by distance
  const getTypeOrder = (type, cat) => {
    const pref = { accident: ['ambulance','police','fire'], medical: ['ambulance','police','fire'],
      fire: ['fire','ambulance','rescue'], violence: ['police','ambulance','fire'],
      natural_disaster: ['rescue','ambulance','fire'] };
    const order = pref[cat] || ['ambulance','police','fire'];
    const idx = order.indexOf(type);
    return idx >= 0 ? idx : 99;
  };
  const incidentCat = incident?.incident_type?.category || 'other';
  const nearbyStations = incident?.location?.latitude ? allDepots.map(d => {
    const dist = haversineDistance(incident.location.latitude, incident.location.longitude, d.lat, d.lng);
    const speed = d.type === 'police' ? 45 : d.type === 'fire' ? 35 : 40;
    const eta = (dist / speed) * 60;
    return { depot: d, distance: dist, eta, typeOrder: getTypeOrder(d.type, incidentCat) };
  }).sort((a, b) => a.typeOrder !== b.typeOrder ? a.typeOrder - b.typeOrder : a.distance - b.distance).slice(0, 3) : [];

  const startVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input not supported in this browser.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
  }, [listening]);

  const handleSubmit = async (transcript = text) => {
    if (!transcript.trim() || submitting) return;
    setSubmitting(true);
    setStatusStep('Received');
    setIncident(null);

    try {
      setStatusStep('Parsing');

      const res = await fetch(`${API_BASE}/api/v1/emergency/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, caller_id: callerId }),
      });

      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      setIncident(data);
      setStatusStep(deriveStatusStep(data));
      setText('');
    } catch (e) {
      console.error('SOS submit failed:', e);
      setStatusStep(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="citizen-panel animate-fade-in">
      <div className="citizen-header">
        <div className="citizen-logo-container">
          <div className="citizen-logo-pulse"></div>
          <div className="citizen-logo">🆘</div>
        </div>
        <div>
          <h1 className="citizen-title">Citizen SOS Portal</h1>
          <p className="citizen-subtitle">Delhi NCR Smart City Response Network</p>
        </div>
        <div className="citizen-caller-info">
          <div className="citizen-caller-label">Your Secure ID</div>
          <div className="citizen-caller-id">{callerId}</div>
        </div>
      </div>

      <div className="citizen-body">
        <div className="citizen-input-section">
          <div className="sos-input-container card-premium">
            <h2 className="sos-input-heading">Report Emergency</h2>
            <p className="sos-input-sub">Speak clearly or type the situation. Help will be dispatched instantly.</p>
            
            <button
              className={`sos-voice-btn-large ${listening ? 'listening' : ''}`}
              onClick={startVoice}
              disabled={submitting}
            >
              <div className="sos-voice-icon-wrapper">
                {listening ? '⏹' : '🎙️'}
              </div>
              <div className="sos-voice-text">
                {listening ? 'Listening... Tap to stop' : 'Tap to Speak (Hindi/English)'}
              </div>
              {listening && <div className="sos-voice-waves"><span></span><span></span><span></span></div>}
            </button>

            <div className="sos-divider"><span>OR</span></div>

            <div className="sos-text-area-wrapper">
              <textarea
                className="sos-textarea-premium"
                placeholder="What is happening? Tell us location and situation..."
                value={text}
                onChange={e => setText(e.target.value)}
                disabled={submitting}
                rows={3}
              />
              <button
                className="sos-submit-btn-premium"
                onClick={() => handleSubmit()}
                disabled={!text.trim() || submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner-small" /> PROCESSING...
                  </span>
                ) : (
                  'INITIATE EMERGENCY RESPONSE'
                )}
              </button>
            </div>

            <div className="sos-security-note">
              🔒 End-to-end encrypted connection to Emergency Command
            </div>
          </div>
        </div>

        <div className="citizen-status-section">
          {statusStep ? (
            <div className="sos-response-container animate-fade-in">
              <div className="sos-card card-premium mb-6">
                <div className="sos-card-header p-4">
                  <h3 className="sos-card-title flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                    Live Dispatch Status
                  </h3>
                  {incident?.priority && (
                    <span className="sos-priority-indicator" style={{ backgroundColor: PRIORITY_COLORS[incident.priority] }}>
                      {incident.priority}
                    </span>
                  )}
                </div>
                <div className="px-4 pb-6">
                    <StatusTrack status={statusStep} />
                </div>
                {nearbyStations.length > 0 && (
                    <div className="px-4 pb-4">
                        <ResponseMetrics closest={nearbyStations[0]} />
                    </div>
                )}
              </div>

              <div className="sos-card card-premium mb-6 overflow-hidden">
                <div className="sos-card-header p-4 bg-slate-50/50 border-b border-slate-100">
                  <h3 className="sos-card-title">📍 Tactical Deployment Map</h3>
                  <span className="sos-location-badge bg-white shadow-sm">{incident?.location?.raw_text || 'Detecting Location...'}</span>
                </div>
                <div className="p-2">
                    <IncidentMiniMap incident={incident} depots={allDepots} />
                </div>
              </div>

              {nearbyStations.length > 0 && (
                <div className="sos-card card-premium mb-6">
                   <div className="sos-card-header p-4 border-b border-slate-100 bg-slate-50/50">
                     <h3 className="sos-card-title">🚨 Nearby Response Centers</h3>
                   </div>
                   <div className="p-0">
                     {nearbyStations.map((ns, idx) => (
                       <NearbyStationRow key={idx} {...ns} />
                     ))}
                   </div>
                </div>
              )}

              {incident?.assigned_resources?.length > 0 ? (
                <div className="sos-card card-premium animate-slide-up border-t-4 border-green-500">
                  <h3 className="sos-card-title p-4 border-b border-slate-100 bg-green-50/50 text-green-800">✅ Dispatch Confirmed</h3>
                  <div className="sos-resources-list">
                    {incident.assigned_resources.map((r, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0">
                        <div className="text-2xl">🚑</div>
                        <div className="flex-1">
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.resource_type.replace('_', ' ')}</div>
                             <div className="text-sm font-bold text-slate-800">Unit #{r.resource_id} dispatched from {r.depot_name || 'Central Base'}</div>
                             <div className="text-[11px] text-green-600 font-bold mt-1">Status: EN ROUTE (ETA: {r.eta_minutes || '~5'} mins)</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : statusStep === 'Dispatched' ? (
                <div className="sos-card card-premium p-10 text-center border-dashed border-2 border-slate-200">
                  <div className="spinner-large mx-auto mb-4" />
                  <p className="font-bold text-slate-600">Coordinating nearest units...</p>
                  <p className="text-xs text-slate-400 mt-2">AI Agents are securing the closest hospital and rescue fleet.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="citizen-idle-state animate-fade-in">
              <div className="citizen-idle-visual">
                <div className="idle-ring ring-1"></div>
                <div className="idle-ring ring-2"></div>
                <div className="idle-ring ring-3"></div>
                <div className="idle-icon">🛡️</div>
              </div>
              <h2 className="idle-title">Delhi NCR Response Network</h2>
              <p className="idle-desc">AEGIS AI agents are on standby 24/7 to provide instant emergency assistance across the National Capital Region.</p>
              
              <div className="idle-stats">
                <div className="idle-stat">
                  <div className="stat-value">25+</div>
                  <div className="stat-label">Smart Bases</div>
                </div>
                <div className="idle-stat">
                  <div className="stat-value">&lt;3s</div>
                  <div className="stat-label">Response Time</div>
                </div>
                <div className="idle-stat">
                  <div className="stat-value">100%</div>
                  <div className="stat-label">Live Support</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitizenPanel;
