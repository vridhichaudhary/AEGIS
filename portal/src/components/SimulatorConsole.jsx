import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneCall, Radio, Activity, Mic, UploadCloud, Loader, RefreshCw } from 'lucide-react';

const transcripts = [
  "Help, aag lag gayi hai Sector 14 market mein, 3 log fas gaye hain ander!",
  "Mera accident ho gaya hai NH8 par, mujhe aur mere dost ko khoon aa raha hai, please ambulance bhejo jaldi!",
  "Hello, yaha do gaadiyo ki takkar hui hai, ek aadmi behosh hai.",
  "Bhaiya jaldi aao, yaha danga ho gaya hai, log chaku leke ghum rahe hain!",
  "Meri biwi ko labor pain ho raha hai, paani toot gaya hai, hum log traffic me phase hain."
];

const SimulatorConsole = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [status, setStatus] = useState('idle'); // incoming, transcribing, processing, completed, idle
  const [callerId, setCallerId] = useState('+91-112-84739201');
  const [isAudioMode, setIsAudioMode] = useState(false);
  const fileInputRef = useRef(null);
  
  const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

  const handleReport = async (transcriptText, cid) => {
    try {
      await fetch(`${apiBase}/api/v1/emergency/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText, caller_id: cid }),
      });
    } catch (error) {
      console.error("Failed to submit:", error);
    }
  };

  const processAudioFile = async (file) => {
    if (!file) return;
    setIsAudioMode(true);
    const newCallerId = `+91-112-${Math.floor(10000000 + Math.random() * 90000000)}`;
    setCallerId(newCallerId);
    setDisplayedText('');
    setStatus('transcribing');

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("caller_id", newCallerId);

    try {
      const response = await fetch(`${apiBase}/api/v1/emergency/audio`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to process audio.");
      const data = await response.json();
      const transcript = data.agent_trail[0]?.reasoning || "Audio processed successfully.";
      setDisplayedText(transcript);
      setStatus('processing');
      setTimeout(() => {
        setStatus('completed');
        setTimeout(() => { setStatus('idle'); setIsAudioMode(false); if (fileInputRef.current) fileInputRef.current.value = ""; }, 3000);
      }, 1000);
    } catch (error) {
      setDisplayedText("Error transcribing audio.");
      setStatus('completed');
      setTimeout(() => { setStatus('idle'); setIsAudioMode(false); }, 3000);
    }
  };

  useEffect(() => {
    if (isAudioMode) return;
    let timeout;
    if (status === 'idle') {
      timeout = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % transcripts.length);
        setCallerId(`+91-112-${Math.floor(10000000 + Math.random() * 90000000)}`);
        setDisplayedText('');
        setStatus('incoming');
      }, 30000);
    } else if (status === 'incoming') {
      timeout = setTimeout(() => setStatus('transcribing'), 1500);
    } else if (status === 'transcribing') {
      const fullText = transcripts[currentIndex];
      if (displayedText.length < fullText.length) {
        timeout = setTimeout(() => setDisplayedText(fullText.slice(0, displayedText.length + 1)), 40);
      } else {
        timeout = setTimeout(() => setStatus('processing'), 500);
      }
    } else if (status === 'processing') {
      handleReport(transcripts[currentIndex], callerId).finally(() => setStatus('completed'));
    } else if (status === 'completed') {
      timeout = setTimeout(() => setStatus('idle'), 2000);
    }
    return () => clearTimeout(timeout);
  }, [status, displayedText, currentIndex, callerId, isAudioMode]);

  const handleSampleUpload = async (filename) => {
    try {
      setStatus('transcribing');
      setIsAudioMode(true);
      const response = await fetch(`${apiBase}/demo_assets/${filename}`);
      if (!response.ok) throw new Error("Sample not found");
      const blob = await response.blob();
      await processAudioFile(new File([blob], filename, { type: 'audio/wav' }));
    } catch (error) {
      setDisplayedText("Sample audio file not found.");
      setStatus('completed');
      setTimeout(() => { setStatus('idle'); setIsAudioMode(false); }, 2000);
    }
  };

  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface overflow-hidden">
      <div className="section-header flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-aegis-info" />
          <span>Live Call Simulator</span>
        </div>
        {status !== 'idle' && (
          <button onClick={() => { setStatus('idle'); setIsAudioMode(false); }} className="text-aegis-info hover:text-white transition-colors">
            <RefreshCw size={12} />
          </button>
        )}
      </div>
      
      <div className="p-3 flex-1 flex flex-col min-h-[140px]">
        {status !== 'idle' ? (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col gap-1">
                <span className="mono text-[10px] text-aegis-text-muted flex items-center gap-1">
                  <Phone size={10} /> {callerId}
                </span>
                {isAudioMode && (status === 'processing' || status === 'completed') && (
                  <span className="badge badge-purple badge-xs">AUDIO UPLOAD</span>
                )}
              </div>
              <span className={`badge badge-xs animate-pulse ${
                status === 'incoming' ? 'badge-critical' : 
                status === 'transcribing' ? 'badge-success' : 
                'badge-info'
              }`}>
                {status.toUpperCase()}
              </span>
            </div>

            <div className="flex-1 bg-aegis-bg-base/50 rounded border border-aegis-border p-3 flex flex-col items-center justify-center relative overflow-hidden">
              {status === 'transcribing' && (
                <div className="flex items-end gap-0.5 mb-2 h-4 absolute top-2 right-2 opacity-50">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className={`w-1 rounded-t bg-aegis-low animate-pulse`} style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              )}
              
              <p className="text-[12px] text-aegis-text-primary italic leading-relaxed text-center font-medium">
                {isAudioMode && status === 'transcribing' ? 'Running Whisper transcription...' : `"${displayedText || '...'}"`}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-4">
             <div className="text-[10px] font-bold text-aegis-text-muted uppercase tracking-[0.2em] animate-pulse">System Standby</div>
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="btn btn-ghost w-full flex flex-col py-3 border-dashed"
             >
               <UploadCloud size={16} className="text-aegis-purple mb-1" />
               <span className="text-[9px] uppercase tracking-widest">Upload Audio Recording</span>
               <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => processAudioFile(e.target.files[0])} />
             </button>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-aegis-border bg-aegis-bg-elevated/30">
        <span className="text-[9px] font-bold text-aegis-text-muted uppercase tracking-widest mb-2 block">Quick Test Samples</span>
        <div className="grid grid-cols-3 gap-2">
          {['Fire', 'Accident', 'Medical'].map(type => (
            <button 
              key={type}
              onClick={() => handleSampleUpload(`${type.toLowerCase()}_emergency.wav`)}
              disabled={status !== 'idle'}
              className="btn btn-xs btn-ghost text-[9px]"
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SimulatorConsole;