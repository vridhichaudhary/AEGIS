import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneCall, Radio, Activity, Mic, UploadCloud, Loader, RefreshCw, AudioWaveform } from 'lucide-react';

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

  return (
    <div className="flex flex-col h-full bg-slate-50 border-b border-slate-100">
      <div className="px-5 py-4 flex flex-1 flex-col">
        {status !== 'idle' ? (
          <div className="flex flex-col h-full animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 animate-pulse">
                  <PhoneCall size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800">{callerId}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Incoming Call</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest ${
                status === 'incoming' ? 'bg-red-50 text-red-600' : 
                status === 'transcribing' ? 'bg-teal-50 text-teal-600' : 
                'bg-blue-50 text-blue-600'
              }`}>
                {status.toUpperCase()}
              </span>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
               <div className="flex items-end gap-1 mb-4 h-6">
                  {[...Array(12)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-1.5 rounded-full bg-teal-500/20 ${status === 'transcribing' ? 'animate-waveform' : ''}`} 
                      style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }} 
                    />
                  ))}
               </div>
               <p className="text-sm text-slate-700 italic text-center font-medium leading-relaxed px-4">
                "{displayedText || '...'}"
               </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
             <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <AudioWaveform size={24} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pipeline Idle</span>
             </div>
             
             <div className="flex gap-3 w-full max-w-xs">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 btn btn-ghost justify-center border-dashed border-2 hover:border-teal-500 hover:text-teal-600 transition-all"
                >
                  <UploadCloud size={16} />
                  <span>Upload</span>
                </button>
                <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => processAudioFile(e.target.files[0])} />
                
                <button 
                  onClick={() => setStatus('incoming')}
                  className="flex-1 btn btn-primary justify-center shadow-lg shadow-teal-700/20"
                >
                  <PhoneCall size={16} />
                  <span>Test Call</span>
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulatorConsole;