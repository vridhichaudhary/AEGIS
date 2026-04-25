import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, MessageSquare } from 'lucide-react';

const VoiceCommand = ({ onGlow }) => {
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState('en-US');
  const [voiceLog, setVoiceLog] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onstart = () => setIsListening(true);
      
      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        handleCommand(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, [language]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current.lang = language;
      recognitionRef.current?.start();
    }
  };

  const handleCommand = async (transcript) => {
    // Add to log as user
    setVoiceLog(prev => [{ speaker: 'user', text: transcript }, ...prev].slice(0, 5));
    
    const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
    try {
      const response = await fetch(`${apiBase}/api/v1/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: transcript, language })
      });
      
      const data = await response.json();
      const spokenResponse = data.spoken_response;
      
      setVoiceLog(prev => [{ speaker: 'agent', text: spokenResponse }, ...prev].slice(0, 5));
      speak(spokenResponse, language);
    } catch (error) {
      console.error("Failed to process command:", error);
    }
  };

  const speak = (text, lang) => {
    if ('speechSynthesis' in window) {
      onGlow(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      
      utterance.onend = () => onGlow(false);
      utterance.onerror = () => onGlow(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="relative flex items-center gap-3 ml-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-white transition-colors relative"
      >
        <MessageSquare size={18} />
        {voiceLog.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>}
      </button>

      <select 
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="bg-[#0D1B2A] border border-gray-600 text-xs rounded px-1 py-0.5 text-gray-300 outline-none"
      >
        <option value="en-US">EN</option>
        <option value="hi-IN">HI</option>
      </select>

      <button
        onClick={toggleListening}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg border ${
          isListening 
            ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
            : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30'
        }`}
      >
        {isListening ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      {/* Voice Log Dropdown */}
      {isOpen && (
        <div className="absolute top-12 right-0 w-72 bg-[#0A1118] border border-blue-500/30 rounded-lg shadow-2xl p-3 z-50 animate-fade-in">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 pb-2">Voice Command Log</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
            {voiceLog.length === 0 ? (
              <p className="text-xs text-gray-500 text-center italic">No commands recorded.</p>
            ) : (
              voiceLog.map((log, i) => (
                <div key={i} className={`flex flex-col ${log.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                  <span className={`text-[10px] uppercase font-bold mb-0.5 ${log.speaker === 'user' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {log.speaker === 'user' ? 'Dispatcher' : 'JARVIS'}
                  </span>
                  <div className={`text-xs p-2 rounded-lg max-w-[85%] ${
                    log.speaker === 'user' ? 'bg-blue-900/40 border border-blue-500/20 text-gray-200 rounded-tr-none' 
                    : 'bg-emerald-900/20 border border-emerald-500/20 text-gray-300 rounded-tl-none'
                  }`}>
                    {log.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceCommand;
