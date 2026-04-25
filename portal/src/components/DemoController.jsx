import React, { useState, useEffect } from 'react';
import { Play, Square, Pause, SkipForward, Info, Eye, EyeOff, Settings } from 'lucide-react';

const DemoController = ({ onStart, onStop, activeStep, isRunning }) => {
  const [showNotes, setShowNotes] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'p') {
        setShowNotes(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalSteps = 8;
  const progress = activeStep ? (activeStep.act / totalSteps) * 100 : 0;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-4 w-full max-w-2xl px-6">
      
      {/* Presenter Notes Overlay */}
      {showNotes && activeStep && (
        <div className="bg-aegis-bg-elevated/95 border border-aegis-accent/50 p-6 rounded-lg shadow-2xl backdrop-blur-xl w-full animate-slide-up">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-aegis-accent uppercase tracking-widest flex items-center gap-2">
              <Info size={12} /> Presenter Briefing: Act {activeStep.act}
            </span>
            <button onClick={() => setShowNotes(false)} className="text-aegis-text-muted hover:text-white">
              <EyeOff size={14} />
            </button>
          </div>
          <p className="text-sm text-aegis-text-primary leading-relaxed font-medium italic">
            "{activeStep.notes}"
          </p>
          <div className="mt-4 pt-3 border-t border-aegis-border flex gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] text-aegis-text-muted uppercase font-bold">Talking Point</span>
              <span className="text-[11px] text-aegis-text-secondary">Emphasize the {activeStep.name.toLowerCase()} capabilities.</span>
            </div>
          </div>
        </div>
      )}

      {/* Controller Bar */}
      <div className="bg-aegis-bg-surface/90 border border-aegis-border p-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-4 w-full h-12 relative overflow-hidden">
        {/* Progress Background */}
        <div 
          className="absolute left-0 top-0 bottom-0 bg-aegis-accent/5 transition-all duration-500" 
          style={{ width: `${progress}%` }} 
        />
        
        <div className="flex items-center gap-2 pl-2 z-10">
          {!isRunning ? (
            <button onClick={() => onStart(speed)} className="p-2 bg-aegis-accent text-white rounded-full hover:scale-110 transition-transform">
              <Play size={16} fill="currentColor" />
            </button>
          ) : (
            <button onClick={onStop} className="p-2 bg-aegis-critical text-white rounded-full hover:scale-110 transition-transform">
              <Square size={16} fill="currentColor" />
            </button>
          )}
        </div>

        <div className="flex-1 px-2 z-10 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-aegis-text-primary uppercase tracking-tighter truncate max-w-[200px]">
              {activeStep ? `Act ${activeStep.act}: ${activeStep.name}` : 'System Idle — Ready for Mission Demo'}
            </span>
            <div className="flex items-center gap-1">
               <div className="w-24 h-1 bg-aegis-border rounded-full overflow-hidden">
                 <div className="h-full bg-aegis-accent transition-all duration-500" style={{ width: `${progress}%` }} />
               </div>
               <span className="text-[9px] mono text-aegis-text-muted">{Math.round(progress)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button onClick={() => setShowNotes(!showNotes)} className={`p-1.5 rounded hover:bg-aegis-bg-hover transition-colors ${showNotes ? 'text-aegis-accent' : 'text-aegis-text-muted'}`}>
                <Eye size={16} />
             </button>
             <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 text-aegis-text-muted hover:text-white transition-colors">
                <Settings size={16} />
             </button>
          </div>
        </div>

        {/* Speed Settings Popup */}
        {showSettings && (
          <div className="absolute bottom-14 right-4 bg-aegis-bg-elevated border border-aegis-border p-3 rounded-lg shadow-xl z-20 flex flex-col gap-2 min-w-[120px]">
            <span className="text-[9px] font-bold text-aegis-text-muted uppercase">Playback Speed</span>
            <div className="flex gap-1">
              {[0.5, 1.0, 2.0].map(s => (
                <button 
                  key={s} 
                  onClick={() => { setSpeed(s); setShowSettings(false); }}
                  className={`px-2 py-1 text-[10px] mono rounded ${speed === s ? 'bg-aegis-accent text-white' : 'bg-aegis-bg-base text-aegis-text-secondary hover:bg-aegis-bg-hover'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-[9px] text-aegis-text-muted uppercase tracking-[0.2em] font-bold animate-pulse">
        Operational Narrative Simulation Engine
      </div>
    </div>
  );
};

export default DemoController;
