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

      if (incidentMarkerRef.current) {
        mapInstance.current.removeLayer(incidentMarkerRef.current);
      }

      const color = PRIORITY_COLORS[incident.priority] || '#C53030';
      const html = `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);animation:pulse-ring 1.5s infinite;"></div>`;
      const icon = L.divIcon({ className: '', html, iconSize: [18, 18], iconAnchor: [9, 9] });
      incidentMarkerRef.current = L.marker([lat, lng], { icon }).addTo(mapInstance.current);
      incidentMarkerRef.current.bindPopup(`<b>${incident.priority} — ${incident.incident_type?.category?.replace('_', ' ') || 'Emergency'}</b><br>${incident.location?.raw_text || ''}`).openPopup();
      
      depotMarkersRef.current.forEach(m => mapInstance.current.removeLayer(m));
      depotMarkersRef.current = [];

      depots.forEach(depot => {
          const d = haversineDistance(lat, lng, depot.lat, depot.lng);
          if (d < 10) {
              const emoji = depot.type === 'fire' ? '🚒' : depot.type === 'police' ? '👮' : '🏥';
              const dHtml = `<div style="background:white;width:24px;height:24px;border-radius:50%;border:2px solid #3182CE;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.2);">${emoji}</div>`;
              const dIcon = L.divIcon({ className: '', html: dHtml, iconSize: [24, 24], iconAnchor: [12, 12] });
              const m = L.marker([depot.lat, depot.lng], { icon: dIcon }).addTo(mapInstance.current);
              m.bindPopup(`<b>${depot.name}</b><br>${d.toFixed(1)}km away`);
              depotMarkersRef.current.push(m);
          }
      });

      mapInstance.current.flyTo([lat, lng], 14, { animate: true, duration: 1 });
    }
  }, [incident, depots]);

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div style={{ height: '220px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

// ─── Status Track ─────────────────────────────────────────────────────────────
const StatusTrack = ({ status }) => {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="sos-status-track">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <React.Fragment key={step}>
            <div className={`sos-status-step ${done ? 'done' : active ? 'active' : 'pending'}`}>
              <div className="sos-status-dot">
                {done ? '✓' : active ? (
                  <span className="sos-status-spinner" />
                ) : idx + 1}
              </div>
              <span className="sos-status-label">{step}</span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`sos-status-line ${done ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Resource Card ────────────────────────────────────────────────────────────
const ResourceCard = ({ resource }) => {
  const typeLabel = (resource.resource_type || resource.type || '').replace('_', ' ');
  const emoji = typeLabel.includes('ambulance') ? '🚑' : typeLabel.includes('fire') ? '🚒' : '🚓';
  return (
    <div className="sos-resource-card animate-slide-up">
      <div className="sos-resource-emoji">{emoji}</div>
      <div className="sos-resource-info">
        <div className="sos-resource-type">{typeLabel.toUpperCase()}</div>
        <div className="sos-resource-depot">Dispatch from {resource.depot_name || 'Nearest Base'}</div>
        <div className="sos-resource-eta">
          Distance: <strong>{resource.distance_km || '?' } km</strong> • ETA: <strong>{resource.eta_minutes || '~5'}m</strong>
        </div>
      </div>
      <div className="sos-resource-status dispatched">En Route</div>
    </div>
  );
};

// ─── Nearby Station Row ───────────────────────────────────────────────────────
const NearbyStationRow = ({ depot, distance, eta }) => {
  const emoji = depot.type === 'fire' ? '🚒' : depot.type === 'police' ? '👮' : '🏥';
  const color = depot.type === 'fire' ? '#C05621' : depot.type === 'police' ? '#553C9A' : '#2B6CB0';
  
  return (
    <div className="flex items-center gap-4 p-3 border-b border-slate-50 last:border-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: `${color}15`, color }}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-black uppercase tracking-wider opacity-60">{depot.type} STATION</div>
        <div className="text-sm font-bold text-slate-800 truncate">{depot.name}</div>
        <div className="text-[11px] text-slate-500">
          {distance.toFixed(1)} km away • Est. Response: <span className="font-bold text-slate-700">{eta.toFixed(0)} mins</span>
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
      setStatusStep('Dispatched');
    }
  }, [latestCitizenIncident]);

  const nearbyStations = incident?.location?.latitude ? allDepots.map(d => {
    const dist = haversineDistance(incident.location.latitude, incident.location.longitude, d.lat, d.lng);
    const speed = d.type === 'police' ? 45 : d.type === 'fire' ? 35 : 40;
    const eta = (dist / speed) * 60;
    return { depot: d, distance: dist, eta };
  }).sort((a, b) => a.distance - b.distance).slice(0, 3) : [];

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
      setTimeout(() => setStatusStep('Parsing'), 600);
      setTimeout(() => setStatusStep('Triaged'), 1500);

      const res = await fetch(`${API_BASE}/api/v1/emergency/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, caller_id: callerId }),
      });

      if (!res.ok) throw new Error('Backend error');
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
                <div className="sos-card-header">
                  <h3 className="sos-card-title">📡 Live Status</h3>
                  {incident?.priority && (
                    <span className="sos-priority-indicator" style={{ backgroundColor: PRIORITY_COLORS[incident.priority] }}>
                      {incident.priority}
                    </span>
                  )}
                </div>
                <StatusTrack status={statusStep} />
              </div>

              <div className="sos-card card-premium mb-6 overflow-hidden">
                <div className="sos-card-header p-4">
                  <h3 className="sos-card-title">📍 Deployment Site</h3>
                  <span className="sos-location-badge">{incident?.location?.raw_text || 'Detecting...'}</span>
                </div>
                <IncidentMiniMap incident={incident} depots={allDepots} />
              </div>

              {nearbyStations.length > 0 && (
                <div className="sos-card card-premium mb-6">
                   <div className="sos-card-header p-4 border-b border-slate-50">
                     <h3 className="sos-card-title">📍 Nearby Response Centers</h3>
                   </div>
                   <div className="p-1">
                     {nearbyStations.map((ns, idx) => (
                       <NearbyStationRow key={idx} {...ns} />
                     ))}
                   </div>
                </div>
              )}

              {incident?.assigned_resources?.length > 0 ? (
                <div className="sos-card card-premium animate-slide-up">
                  <h3 className="sos-card-title p-4 border-b border-slate-100">🚨 Responders Dispatched</h3>
                  <div className="sos-resources-list">
                    {incident.assigned_resources.map((r, i) => (
                      <ResourceCard key={i} resource={r} />
                    ))}
                  </div>
                  <div className="sos-dispatch-summary">
                    Emergency units are coordinating with <strong>{incident?.destination_hospital?.name || 'nearest trauma center'}</strong>. Stay where you are.
                  </div>
                </div>
              ) : statusStep === 'Dispatched' ? (
                <div className="sos-card card-premium p-8 text-center">
                  <div className="spinner-large mx-auto mb-4" />
                  <p className="font-bold text-slate-700">Coordinating nearest units...</p>
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
