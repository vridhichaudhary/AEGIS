import React, { useState, useEffect, useRef, useCallback } from 'react';
import MapView, { isPoint, locationSource } from "../components/MapView";
import { dispatchLabel } from "../utils/incidentStatus";
import { getApiBase } from '../utils/runtimeConfig';
import { MapPinned } from 'lucide-react';

const API_BASE = getApiBase();

const PRIORITY_COLORS = { P1: '#C53030', P2: '#C05621', P3: '#B7791F', P4: '#2F855A', P5: '#718096' };
const SCENARIOS = [
  { label: 'Hinglish fire', transcript: 'Aag lagi hai Sector 14 mein! 3 log faase hain.' },
  { label: 'Unknown location', transcript: 'Heart attack, patient unconscious. Please send help.' },
  { label: 'Noida address', transcript: 'Two vehicles collided at Sector 18 Noida. A person is unconscious.' },
];
const STATUS_STEPS = ['Received', 'Parsing', 'Triaged', 'Dispatched'];

const generateCallerId = () => `+91-112-${Math.floor(10000000 + Math.random() * 90000000)}`;

const deriveStatusStep = (incident) => {
  if (!incident) return null;

  const dispatchStatus = incident.dispatch_status;
  if (['assigned', 'partially_assigned'].includes(dispatchStatus) || incident.incident_status === 'DISPATCHED') {
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

const CitizenPanel = ({ latestCitizenIncident, onReport }) => {
  const [text, setText] = useState('');
  const [callerId] = useState(generateCallerId);
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState('en-IN');
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const incident = latestCitizenIncident;
  const statusStep = submitting ? 'Parsing' : deriveStatusStep(incident);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const startVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input is unavailable in this browser. You can type your report.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = voiceLanguage;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Voice input was interrupted. You can type your report.");
    };
    recognition.start();
  }, [listening, voiceLanguage]);

  const handleSubmit = async (transcript = text) => {
    if (!transcript.trim() || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/v1/emergency/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, caller_id: callerId, location }),
      });

      if (!res.ok) throw new Error('Could not submit the report. Try again in a moment.');
      const data = await res.json();
      onReport(data);
      setLocation(null);
      setText('');
    } catch (e) {
      console.error('SOS submit failed:', e);
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="citizen-panel animate-fade-in">
      <div className="citizen-header">
        <div className="citizen-header-main">
          <div className="citizen-logo-container">
            <div className="citizen-logo-pulse"></div>
            <div className="citizen-logo">🆘</div>
          </div>
          <div>
            <div className="citizen-eyebrow">Emergency Intake Interface</div>
            <h1 className="citizen-title">Citizen SOS Portal</h1>
            <p className="citizen-subtitle">Practice reporting an incident in English, Hindi, or Hinglish.</p>
          </div>
        </div>
        <div className="citizen-caller-info">
          <div className="citizen-caller-label">Exercise session</div>
          <div className="citizen-caller-id">{callerId}</div>
        </div>
      </div>

      <div className="citizen-trust-row">
        <div className="citizen-trust-chip">
          <MapPinned size={14} />
          Assisted location capture
        </div>
      </div>

      <div className="citizen-body">
        <div className="citizen-input-section">
          <div className="sos-input-container card-premium">
            <div className="sos-input-intro">
              <div>
                <div className="sos-input-kicker">Immediate reporting</div>
                <h2 className="sos-input-heading">Report an emergency in one step</h2>
              </div>
              <div className="sos-mode-pill">Simulation</div>
            </div>
            <p className="sos-input-sub">Describe what is happening, where you are, and who is affected.</p>
            
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
              <div className="flex flex-wrap gap-2 mb-2" aria-label="Sample reports">
                {SCENARIOS.map(scenario => (
                  <button key={scenario.label} className="rounded border bg-white px-2 py-1 text-xs"
                    disabled={submitting} onClick={() => { setText(scenario.transcript); setLocation(null); }}>{scenario.label}</button>
                ))}
              </div>
              <textarea
                className="sos-textarea-premium"
                placeholder="What is happening? Tell us location and situation..."
                value={text}
                onChange={e => setText(e.target.value)}
                disabled={submitting}
                rows={3}
                maxLength={4000}
              />
              <button
                className="sos-submit-btn-premium"
                onClick={() => handleSubmit()}
                disabled={text.trim().length < 3 || submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner-small" /> PROCESSING...
                  </span>
                ) : (
                  'Submit simulation report'
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4 text-sm">
              <label className="flex items-center gap-2">Voice language
                <select className="rounded border px-2 py-1" value={voiceLanguage} onChange={event => setVoiceLanguage(event.target.value)} disabled={listening}>
                  <option value="en-IN">English</option><option value="hi-IN">Hindi</option>
                </select>
              </label>
              <button type="button" className="rounded border bg-white px-3 py-1" onClick={() => setLocation(location ? null : { latitude: 28.6304, longitude: 77.2177 })} disabled={submitting}>
                {location ? 'Remove demo pin' : 'Attach demo location pin'}
              </button>
            </div>
            {location && <p className="mt-2 text-xs">Pin attached · {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}
            {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          </div>
        </div>

        <div className="citizen-status-section">
          {statusStep ? (
            <div className="sos-response-container animate-fade-in">
              <div className="sos-card card-premium mb-6">
                <div className="sos-card-header p-4">
                  <div>
                    <div className="sos-card-kicker">Response progress</div>
                    <h3 className="sos-card-title flex items-center gap-2">Live dispatch status</h3>
                  </div>
                  {incident?.priority && (
                    <span className="sos-priority-indicator" style={{ backgroundColor: PRIORITY_COLORS[incident.priority] }}>
                      {incident.priority}
                    </span>
                  )}
                </div>
                <div className="px-4 pb-6">
                    <StatusTrack status={statusStep} />
                </div>
                {incident && <div className="px-4 pb-4 text-sm text-slate-700" role="status">
                  <strong>{incident.status === 'RESOLVED' ? 'Resolved' : dispatchLabel(incident.dispatch_status)}</strong>
                  <span className="ml-2 font-mono text-xs">#{incident.incident_id.slice(0, 8).toUpperCase()}</span>
                  {incident.requires_callback && <p className="mt-1">{incident.suggested_callback_script}</p>}
                </div>}
              </div>

              {isPoint(incident?.location?.latitude, incident?.location?.longitude) && (
                <div className="sos-card card-premium mb-6 overflow-hidden">
                  <div className="sos-card-header p-4">
                    <h3 className="sos-card-title">Incident map</h3>
                    <span className="sos-location-badge">{locationSource(incident.location.source)}</span>
                  </div>
                  <div className="p-2"><MapView incidents={[incident]} compact /></div>
                </div>
              )}

              {incident?.status !== 'RESOLVED' && incident?.assigned_resources?.length > 0 ? (
                <div className="sos-card card-premium animate-slide-up border-t-4 border-green-500">
                  <div className="dispatch-confirmed-header">
                    <div>
                      <div className="sos-card-kicker">Unit mobilization</div>
                      <h3 className="sos-card-title text-green-900">Simulated dispatch</h3>
                    </div>
                    <span className="dispatch-confirmed-chip">Units assigned</span>
                  </div>
                  <div className="sos-resources-list">
                    {incident.assigned_resources.map((r, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0">
                        <div className="text-2xl">{r.resource_type.startsWith('fire') ? '🚒' : r.resource_type.startsWith('ambulance') ? '🚑' : '🚓'}</div>
                        <div className="flex-1">
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.resource_type.replace('_', ' ')}</div>
                             <div className="text-sm font-bold text-slate-800">Unit #{r.resource_id} dispatched from {r.depot_name || 'Central Base'}</div>
                             <div className="text-[11px] text-green-600 font-bold mt-1">Estimated arrival · {r.eta_minutes} min ({r.route_source === 'osrm' ? 'road route' : 'straight line'})</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="citizen-idle-state animate-fade-in">
              <div className="citizen-idle-card">
                <div className="citizen-idle-visual">
                  <div className="idle-ring ring-1"></div>
                  <div className="idle-ring ring-2"></div>
                  <div className="idle-ring ring-3"></div>
                  <div className="idle-icon">🛡️</div>
                </div>
                <div className="citizen-idle-copy">
                  <h2 className="idle-title">Ready for a report</h2>
                  <p className="idle-desc">Submit a sample to see how the simulator classifies the incident, verifies its location, and assigns available units.</p>
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
