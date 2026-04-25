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

const QUICK_SCENARIOS = [
  { label: '🔥 Fire', text: 'Aag lag gayi hai Sector 14 market mein, 3 log fas gaye hain!', color: '#C53030' },
  { label: '🚑 Medical', text: 'Mera accident ho gaya NH8 par, ambulance bhejo jaldi!', color: '#C05621' },
  { label: '👮 Crime', text: 'Yahan danga ho raha hai, log hathiyar lekar ghum rahe hain!', color: '#2B6CB0' },
  { label: '🚗 Accident', text: 'Do gaadiyo ki takkar hui hai, ek aadmi behosh hai, help!', color: '#B7791F' },
];

const PRIORITY_COLORS = { P1: '#C53030', P2: '#C05621', P3: '#B7791F', P4: '#2F855A', P5: '#718096' };

const STATUS_STEPS = ['Received', 'Parsing', 'Triaged', 'Dispatched'];

const generateCallerId = () => `+91-112-${Math.floor(10000000 + Math.random() * 90000000)}`;

// ─── Small Incident Map ───────────────────────────────────────────────────────
const IncidentMiniMap = ({ incident }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const incidentMarkerRef = useRef(null);

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
      mapInstance.current.flyTo([lat, lng], 14, { animate: true, duration: 1 });
    }

    return () => {};
  }, [incident]);

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
const StatusTrack = ({ status, priority }) => {
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
      {priority && (
        <div className="sos-priority-badge" style={{ background: PRIORITY_COLORS[priority] }}>
          {priority}
        </div>
      )}
    </div>
  );
};

// ─── Resource Card ────────────────────────────────────────────────────────────
const ResourceCard = ({ resource }) => {
  const typeLabel = (resource.resource_type || resource.type || '').replace('_', ' ');
  const emoji = typeLabel.includes('ambulance') ? '🚑' : typeLabel.includes('fire') ? '🚒' : '🚓';
  return (
    <div className="sos-resource-card">
      <div className="sos-resource-emoji">{emoji}</div>
      <div className="sos-resource-info">
        <div className="sos-resource-type">{typeLabel.toUpperCase()}</div>
        <div className="sos-resource-eta">ETA: {resource.eta_minutes || '~5'} min</div>
      </div>
      <div className="sos-resource-status dispatched">En Route</div>
    </div>
  );
};

// ─── Main Citizen Panel ───────────────────────────────────────────────────────
const CitizenPanel = ({ latestCitizenIncident }) => {
  const [text, setText] = useState('');
  const [callerId] = useState(generateCallerId);
  const [submitting, setSubmitting] = useState(false);
  const [statusStep, setStatusStep] = useState(null);  // null | 'Received' | 'Parsing' | 'Triaged' | 'Dispatched'
  const [incident, setIncident] = useState(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // Pick up incident from parent WebSocket state
  useEffect(() => {
    if (latestCitizenIncident) {
      setIncident(latestCitizenIncident);
      setStatusStep('Dispatched');
    }
  }, [latestCitizenIncident]);

  // Voice input via browser SpeechRecognition
  const startVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input not supported in this browser. Please use Chrome or Edge.');
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
      // Simulate pipeline steps
      setTimeout(() => setStatusStep('Parsing'), 400);
      setTimeout(() => setStatusStep('Triaged'), 1200);

      const res = await fetch(`${API_BASE}/api/v1/emergency/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, caller_id: callerId }),
      });

      if (!res.ok) throw new Error('Backend error');
      setStatusStep('Dispatched');
      setText('');
    } catch (e) {
      console.error('SOS submit failed:', e);
      setStatusStep('Received');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="citizen-panel">
      {/* Header */}
      <div className="citizen-header">
        <div className="citizen-logo">🛡️</div>
        <div>
          <h1 className="citizen-title">AEGIS Emergency</h1>
          <p className="citizen-subtitle">AI-Powered Emergency Dispatch • Delhi NCR</p>
        </div>
        <div className="citizen-caller-id">{callerId}</div>
      </div>

      <div className="citizen-body">
        {/* Left: SOS Input */}
        <div className="citizen-input-section">
          {/* Big Voice Button */}
          <button
            className={`sos-voice-btn ${listening ? 'listening' : ''}`}
            onClick={startVoice}
            disabled={submitting}
          >
            <span className="sos-voice-icon">{listening ? '⏹' : '🎙️'}</span>
            <span>{listening ? 'Listening... Click to stop' : 'Tap to Speak'}</span>
            {listening && <div className="sos-pulse-ring" />}
          </button>

          {/* Text Area */}
          <div className="sos-text-area-wrapper">
            <textarea
              className="sos-textarea"
              placeholder="या यहाँ टाइप करें / Or type here in Hindi, Hinglish, or English..."
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={submitting}
              rows={4}
            />
            <button
              className="sos-submit-btn"
              onClick={() => handleSubmit()}
              disabled={!text.trim() || submitting}
            >
              {submitting ? '⏳ Processing...' : '🆘 SEND SOS'}
            </button>
          </div>

          {/* Quick Scenarios */}
          <div className="sos-scenarios">
            <div className="sos-scenarios-label">Quick Demo Scenarios:</div>
            <div className="sos-scenarios-grid">
              {QUICK_SCENARIOS.map(s => (
                <button
                  key={s.label}
                  className="sos-scenario-btn"
                  style={{ '--scenario-color': s.color }}
                  onClick={() => { setText(s.text); handleSubmit(s.text); }}
                  disabled={submitting}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language Note */}
          <div className="sos-lang-note">
            🌐 Multilingual: Hindi • Hinglish • English — AI auto-detects language
          </div>
        </div>

        {/* Right: Status + Map */}
        <div className="citizen-status-section">
          {statusStep ? (
            <>
              {/* Status Track */}
              <div className="sos-card">
                <h3 className="sos-card-title">📡 Incident Status</h3>
                <StatusTrack status={statusStep} priority={incident?.priority} />
              </div>

              {/* Map */}
              <div className="sos-card">
                <h3 className="sos-card-title">📍 Your Location</h3>
                <IncidentMiniMap incident={incident} />
                {incident?.location?.raw_text && (
                  <p className="sos-location-text">{incident.location.raw_text}</p>
                )}
              </div>

              {/* Dispatched Resources */}
              {incident?.assigned_resources?.length > 0 && (
                <div className="sos-card">
                  <h3 className="sos-card-title">🚨 Units Dispatched</h3>
                  <div className="sos-resources-list">
                    {incident.assigned_resources.map((r, i) => (
                      <ResourceCard key={i} resource={r} />
                    ))}
                  </div>
                </div>
              )}

              {/* Awaiting dispatch indicator */}
              {statusStep !== 'Dispatched' && (
                <div className="sos-card sos-waiting-card">
                  <div className="sos-waiting-spinner" />
                  <span>AI agents processing your emergency...</span>
                </div>
              )}
            </>
          ) : (
            <div className="citizen-idle-state">
              <div className="citizen-idle-icon">🚨</div>
              <h2>In an Emergency?</h2>
              <p>Speak or type your emergency in any language.<br />Our AI will dispatch help in seconds.</p>
              <div className="citizen-feature-list">
                <div className="citizen-feature">⚡ &lt;3 second processing</div>
                <div className="citizen-feature">🧠 AI priority assessment</div>
                <div className="citizen-feature">📍 Automatic location detection</div>
                <div className="citizen-feature">🔄 Deduplication — no double dispatch</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitizenPanel;
