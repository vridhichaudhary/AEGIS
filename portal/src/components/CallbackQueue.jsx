import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, PhoneForwarded } from 'lucide-react';

const CallbackQueue = ({ callbacks = [], onSimulateResponse }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [timers, setTimers] = useState({});

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimers = {};
      callbacks.forEach((cb) => {
        const diff = Math.floor((new Date().getTime() - new Date(cb.created_at).getTime()) / 1000);
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        newTimers[cb.incident_id] = `${m}:${s.toString().padStart(2, '0')}`;
      });
      setTimers(newTimers);
    }, 1000);
    return () => clearInterval(interval);
  }, [callbacks]);

  if (callbacks.length === 0) return null;

  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface overflow-hidden">
      <div 
        className="section-header flex justify-between items-center cursor-pointer hover:bg-aegis-bg-hover transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <PhoneForwarded size={14} className="text-aegis-high" />
          <span>Pending Callbacks ({callbacks.length})</span>
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>

      {isOpen && (
        <div className="p-3 space-y-3 max-h-80 overflow-y-auto custom-scrollbar bg-aegis-bg-base/30">
          {callbacks.map((cb) => (
            <div key={cb.incident_id} className="bg-aegis-bg-surface rounded p-3 border border-aegis-high/20 relative group hover:border-aegis-high/40 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="mono text-[11px] font-bold text-aegis-text-primary tracking-widest">
                  {cb.caller_id && cb.caller_id !== 'Unknown' ? 
                    cb.caller_id.replace(/(\+\d{2})-(\d{4})-(\d{2})(\d{4})/, "$1-XXXX-XX$4") : 
                    '+91-XXXX-XX1234'
                  }
                </span>
                <span className="badge badge-warning badge-xs mono">
                  {timers[cb.incident_id] || '0:00'}
                </span>
              </div>
              
              <div className="text-[10px] text-aegis-text-muted mb-2 uppercase tracking-widest">
                Missing: <span className="text-aegis-critical font-bold">{cb.missing_fields?.join(', ') || 'Information'}</span>
              </div>
              
              <div className="bg-aegis-info/5 border border-aegis-info/20 rounded p-2 mb-3">
                <div className="text-[9px] text-aegis-info uppercase tracking-widest mb-1 font-bold">Heuristic Prompt</div>
                <div className="text-[11px] text-aegis-text-secondary italic leading-relaxed">
                  "{cb.suggested_question || 'Awaiting dynamic script...'}"
                </div>
              </div>

              <button
                onClick={() => onSimulateResponse(cb.incident_id)}
                className="btn btn-xs btn-warning w-full"
              >
                SIMULATE OPERATOR RESPONSE
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallbackQueue;
