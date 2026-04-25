import React, { useState, useEffect } from 'react';

const CallbackQueue = ({ callbacks = [], onSimulateResponse }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [timers, setTimers] = useState({});

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimers = {};
      callbacks.forEach((cb) => {
        const start = new Date(cb.created_at).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - start) / 1000);
        
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
    <div className="glass rounded-xl overflow-hidden shadow-lg border border-yellow-500/30 flex flex-col mt-4">
      <div 
        className="bg-yellow-500/20 p-3 flex justify-between items-center border-b border-yellow-500/30 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold text-yellow-400">Pending Callbacks ({callbacks.length})</h3>
        </div>
        <button className="text-yellow-400 hover:text-yellow-300">
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {isOpen && (
        <div className="p-3 space-y-3 max-h-80 overflow-y-auto custom-scrollbar bg-black/40">
          {callbacks.map((cb) => (
            <div key={cb.incident_id} className="bg-gray-800/80 rounded-lg p-3 border border-yellow-500/20 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-2">
                <div className="font-mono text-sm font-bold text-white tracking-widest">
                  {cb.caller_id && cb.caller_id !== 'Unknown' ? 
                    cb.caller_id.replace(/(\+\d{2})-(\d{4})-(\d{2})(\d{4})/, "$1-XXXX-XX$4") : 
                    '+91-XXXX-XX1234'
                  }
                </div>
                <div className="text-xs font-mono text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
                  {timers[cb.incident_id] || '0:00'}
                </div>
              </div>
              
              <div className="text-xs text-gray-400 mb-2">
                Missing: <span className="text-red-400 font-semibold">{cb.missing_fields?.join(', ') || 'Information'}</span>
              </div>
              
              <div className="bg-blue-900/30 border border-blue-500/30 rounded p-2 mb-3">
                <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1 font-bold">Suggested Script</div>
                <div className="text-sm text-blue-100 italic">
                  "{cb.suggested_question || 'Could you provide more details about your location?'}"
                </div>
              </div>

              <button
                onClick={() => onSimulateResponse(cb.incident_id)}
                className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/50 py-1.5 rounded text-xs font-bold transition-colors"
              >
                Simulate Callback Response
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallbackQueue;
