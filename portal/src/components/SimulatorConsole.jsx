import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, Radio, Activity } from 'lucide-react';

const transcripts = [
  "Help, aag lag gayi hai Sector 14 market mein, 3 log fas gaye hain ander!",
  "Mera accident ho gaya hai NH8 par, mujhe aur mere dost ko khoon aa raha hai, please ambulance bhejo jaldi!",
  "Hello, yaha do gaadiyo ki takkar hui hai, ek aadmi behosh hai.",
  "Bhaiya jaldi aao, yaha danga ho gaya hai, log chaku leke ghum rahe hain!",
  "Meri biwi ko labor pain ho raha hai, paani toot gaya hai, hum log traffic me phase hain.",
  "Ambience Mall ke pass blast hua hai, bahut dhua nikal raha hai, jaldi fire brigade bhejo!",
  "Meri building me bhukamp ke baad chhat gir gayi hai, do bache andar hai!",
  "Hello, mujhe chest pain ho raha hai, saans lene mein takleef ho rahi hai. Main Sector 50, block B mein hu.",
  "Station ke bahar ek laawaris bag pada hai, isme se tiktik ki awaaz aa rahi hai, bomb ho sakta hai!",
  "Bhaiya jaldi ambulance bhejo, 3rd floor ki seedhiyo se bacha gir gaya hai, behosh hai."
];

const SimulatorConsole = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [status, setStatus] = useState('incoming'); // incoming, transcribing, processing, completed, idle
  const [callerId, setCallerId] = useState('+91-112-84739201');
  
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

  useEffect(() => {
    let timeout;
    
    if (status === 'idle') {
      timeout = setTimeout(() => {
        const nextIdx = (currentIndex + 1) % transcripts.length;
        setCurrentIndex(nextIdx);
        setCallerId(`+91-112-${Math.floor(10000000 + Math.random() * 90000000)}`);
        setDisplayedText('');
        setStatus('incoming');
      }, 3000);
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
        }, 500); // short pause after typing finishes
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
  }, [status, displayedText, currentIndex, callerId, apiBase]);

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
        {status === 'transcribing' && (
          <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
            <Activity size={14} className="animate-pulse" />
            ACTIVE CALL
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
             <div className="text-gray-400 text-sm font-mono mb-4 flex items-center gap-2 bg-gray-800/50 px-3 py-1 rounded-md border border-gray-700">
               <Phone size={14} /> Caller ID: {callerId}
             </div>
             
             {status === 'transcribing' && (
                <div className="flex items-end gap-1 mb-6 h-8">
                  {[...Array(15)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-green-400 rounded-t waveform-bar"
                      style={{ 
                        animationDelay: `${Math.random() * 0.5}s`,
                        height: `${Math.random() * 60 + 40}%`
                      }}
                    />
                  ))}
                </div>
             )}

             <div className="relative w-full max-w-sm mx-auto">
               <div className="bg-gray-900/80 rounded-lg p-4 text-center border border-gray-700 min-h-[100px] flex items-center justify-center">
                 <p className="text-gray-100 font-medium text-lg leading-relaxed italic">
                   "{displayedText}
                   {status === 'transcribing' && <span className="animate-pulse bg-gray-300 w-2 h-5 inline-block align-middle ml-1"></span>}"
                 </p>
               </div>
             </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm font-medium animate-pulse">
             Waiting for next emergency call...
          </div>
        )}
      </div>
      
      {/* Progress Footer */}
      <div className="h-1 w-full bg-gray-800">
         <div 
           className={`h-full transition-all duration-300 ${status === 'completed' ? 'bg-green-500 w-full' : status === 'processing' ? 'bg-blue-500 w-3/4' : status === 'transcribing' ? 'bg-emerald-400 w-1/2' : status === 'incoming' ? 'bg-red-500 w-1/4' : 'bg-transparent w-0'}`}
         />
      </div>
    </div>
  );
};

export default SimulatorConsole;