import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneCall, Radio, Activity, Mic, UploadCloud, Loader } from 'lucide-react';

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

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Max size is 5MB.");
      return;
    }

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
      
      if (!response.ok) {
        throw new Error("Failed to process audio.");
      }

      const data = await response.json();
      
      // The transcript is in the first agent's trail or reasoning
      const transcript = data.agent_trail[0]?.reasoning || "Audio processed successfully.";
      
      setDisplayedText(transcript);
      setStatus('processing');
      
      setTimeout(() => {
        setStatus('completed');
        setTimeout(() => {
          setStatus('idle');
          setIsAudioMode(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }, 3000);
      }, 1000);

    } catch (error) {
      console.error(error);
      setDisplayedText("Error transcribing audio. Check backend logs or try again.");
      setStatus('completed');
      setTimeout(() => { setStatus('idle'); setIsAudioMode(false); }, 3000);
    }
  };

  const handleFileUpload = (e) => {
    processAudioFile(e.target.files[0]);
  };

  const handleSampleUpload = async (filename, label) => {
    try {
      setStatus('transcribing');
      setIsAudioMode(true);
      
      const response = await fetch(`${apiBase}/demo_assets/${filename}`);
      if (!response.ok) throw new Error("Sample not found");
      
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'audio/wav' });
      
      await processAudioFile(file);
    } catch (error) {
      console.error("Sample fetch failed:", error);
      setDisplayedText("Sample audio file not found.");
      setStatus('completed');
      setTimeout(() => { setStatus('idle'); setIsAudioMode(false); }, 2000);
    }
  };

  // Auto Simulator Logic
  useEffect(() => {
    if (isAudioMode) return; // Disable auto-play when uploading audio
    
    let timeout;
    
    if (status === 'idle') {
      // Increase idle time to 30s to allow manual testing
      timeout = setTimeout(() => {
        const nextIdx = (currentIndex + 1) % transcripts.length;
        setCurrentIndex(nextIdx);
        setCallerId(`+91-112-${Math.floor(10000000 + Math.random() * 90000000)}`);
        setDisplayedText('');
        setStatus('incoming');
      }, 30000);
    } else if (status === 'incoming') {
      timeout = setTimeout(() => {
        setStatus('transcribing');
      }, 1500);
    } else if (status === 'transcribing') {
      const fullText = transcripts[currentIndex];
      if (displayedText.length < fullText.length) {
        timeout = setTimeout(() => {
          setDisplayedText(fullText.slice(0, displayedText.length + 1));
        }, 40); // 40ms per char
      } else {
        timeout = setTimeout(() => {
          setStatus('processing');
        }, 500);
      }
    } else if (status === 'processing') {
      handleReport(transcripts[currentIndex], callerId).finally(() => {
        setStatus('completed');
      });
    } else if (status === 'completed') {
      timeout = setTimeout(() => {
        setStatus('idle');
      }, 2000);
    }

    return () => clearTimeout(timeout);
  }, [status, displayedText, currentIndex, callerId, apiBase, isAudioMode]);

  return (
    <div className="glass-card rounded-xl flex flex-col overflow-hidden relative border border-gray-700/50 h-full">
      {/* Header */}
      <div className="bg-gray-900/80 border-b border-gray-700/50 p-3 flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2 text-gray-200 uppercase tracking-wider">
          <Radio size={16} className="text-blue-400" /> Live Call Feed
        </h2>
        
        {/* Status Badges */}
        {status === 'incoming' && (
          <div className="flex items-center gap-2 bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30 animate-pulse">
            <PhoneCall size={14} className="animate-bounce" />
            INCOMING CALL
          </div>
        )}
        {status === 'transcribing' && !isAudioMode && (
          <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
            <Activity size={14} className="animate-pulse" />
            ACTIVE CALL
          </div>
        )}
        {status === 'transcribing' && isAudioMode && (
          <div className="flex items-center gap-2 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold border border-purple-500/30 animate-pulse">
            <Loader size={14} className="animate-spin" />
            TRANSCRIBING WHISPER...
          </div>
        )}
        {(status === 'processing' || status === 'completed') && (
          <div className="flex items-center gap-2 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30">
            DISPATCHING...
          </div>
        )}
      </div>
      
      {/* Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-center min-h-[150px]">
        {status !== 'idle' ? (
          <div className="animate-fade-in flex flex-col items-center justify-center h-full">
             <div className="flex items-center justify-between w-full max-w-sm mb-4">
               <div className="text-gray-400 text-sm font-mono flex items-center gap-2 bg-gray-800/50 px-3 py-1 rounded-md border border-gray-700">
                 <Phone size={14} /> Caller ID: {callerId}
               </div>
               {isAudioMode && (status === 'processing' || status === 'completed') && (
                 <div className="text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1">
                   <Mic size={10} /> Transcribed from Audio
                 </div>
               )}
             </div>
             
             {status === 'transcribing' && (
                <div className="flex items-end gap-1 mb-6 h-8">
                  {[...Array(15)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-1.5 rounded-t waveform-bar ${isAudioMode ? 'bg-purple-400' : 'bg-green-400'}`}
                      style={{ 
                        animationDelay: `${Math.random() * 0.5}s`,
                        height: `${Math.random() * 60 + 40}%`
                      }}
                    />
                  ))}
                </div>
             )}

             <div className="relative w-full max-w-sm mx-auto">
               <div className="bg-gray-900/80 rounded-lg p-4 text-center border border-gray-700 min-h-[100px] flex flex-col items-center justify-center">
                 {isAudioMode && status === 'transcribing' ? (
                    <p className="text-gray-400 text-sm italic animate-pulse">Running Whisper offline transcription model...</p>
                 ) : (
                    <p className="text-gray-100 font-medium text-lg leading-relaxed italic">
                      "{displayedText}
                      {status === 'transcribing' && !isAudioMode && <span className="animate-pulse bg-gray-300 w-2 h-5 inline-block align-middle ml-1"></span>}"
                    </p>
                 )}
               </div>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
             <div className="text-xs font-medium animate-pulse mb-4 text-center">
               SYSTEM STANDBY<br/>
               <span className="opacity-50 text-[10px]">Waiting for next emergency call...</span>
             </div>
             
             <div className="w-full max-w-[200px] p-3 border border-dashed border-gray-600 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors flex flex-col items-center justify-center cursor-pointer relative group" onClick={() => fileInputRef.current?.click()}>
               <UploadCloud size={18} className="text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
               <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Upload Recording</span>
               <input 
                 type="file" 
                 accept="audio/wav,audio/mp3,audio/mpeg,audio/ogg" 
                 className="hidden" 
                 ref={fileInputRef}
                 onChange={handleFileUpload}
               />
             </div>
          </div>
        )}
      </div>

      {/* Persistent Quick Test Samples */}
      <div className="bg-gray-900/50 border-t border-gray-700/50 p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Quick Test Samples (Hindi)</span>
            {status !== 'idle' && (
              <button 
                onClick={() => { setStatus('idle'); setIsAudioMode(false); }}
                className="text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-tighter"
              >
                Reset Feed
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => handleSampleUpload('fire_emergency.wav', 'Fire')}
              disabled={status === 'transcribing' || status === 'processing'}
              className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-30 border border-red-500/30 rounded py-1.5 px-1 text-[9px] font-bold text-red-400 uppercase transition-colors flex items-center justify-center gap-1"
            >
              <Activity size={10} /> Fire
            </button>
            <button 
              onClick={() => handleSampleUpload('accident_emergency.wav', 'Accident')}
              disabled={status === 'transcribing' || status === 'processing'}
              className="bg-orange-500/10 hover:bg-orange-500/20 disabled:opacity-30 border border-orange-500/30 rounded py-1.5 px-1 text-[9px] font-bold text-orange-400 uppercase transition-colors flex items-center justify-center gap-1"
            >
              <Activity size={10} /> Accident
            </button>
            <button 
              onClick={() => handleSampleUpload('medical_emergency.wav', 'Medical')}
              disabled={status === 'transcribing' || status === 'processing'}
              className="bg-green-500/10 hover:bg-green-500/20 disabled:opacity-30 border border-green-500/30 rounded py-1.5 px-1 text-[9px] font-bold text-green-400 uppercase transition-colors flex items-center justify-center gap-1"
            >
              <Activity size={10} /> Medical
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress Footer */}
      <div className="h-1 w-full bg-gray-800">
         <div 
           className={`h-full transition-all duration-300 ${status === 'completed' ? 'bg-green-500 w-full' : status === 'processing' ? 'bg-blue-500 w-3/4' : status === 'transcribing' ? (isAudioMode ? 'bg-purple-500 w-1/2' : 'bg-emerald-400 w-1/2') : status === 'incoming' ? 'bg-red-500 w-1/4' : 'bg-transparent w-0'}`}
         />
      </div>
    </div>
  );
};

export default SimulatorConsole;