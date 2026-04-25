import React, { useState } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';

const SimulatorConsole = () => {
  const [transcript, setTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Initialize speech recognition
  React.useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = 'hi-IN'; // Hindi, change to 'en-IN' for English
      
      recog.onresult = (event) => {
        const speechResult = event.results[0][0].transcript;
        setTranscript(prev => prev + ' ' + speechResult);
        setIsListening(false);
      };
      
      recog.onerror = () => {
        setIsListening(false);
      };
      
      recog.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recog);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) {
      alert('Speech recognition not supported in your browser');
      return;
    }
    
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!transcript.trim()) return;

    setIsSubmitting(true);
    try {
      await fetch(`${apiBase}/api/v1/emergency/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, caller_id: 'frontend_user' }),
      });
      setTranscript('');
    } catch (error) {
      console.error("Failed to submit:", error);
      alert('Failed to submit. Make sure backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulation = async (scenario) => {
    try {
      await fetch(`${apiBase}/api/v1/simulation/run?scenario=${scenario}&count=3`, {
        method: 'POST',
      });
    } catch (error) {
      console.error(`Simulation failed:`, error);
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="text-purple-400">🎙️</span> Incident Input
      </h2>
      
      <form onSubmit={handleReport} className="flex flex-col gap-3">
        <div className="relative">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type or speak emergency call..."
            className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 pr-12 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none h-24 w-full"
            disabled={isSubmitting || isListening}
          />
          
          {/* Mic Button */}
          {recognition && (
            <button
              type="button"
              onClick={toggleListening}
              className={`absolute right-2 top-2 p-2 rounded-lg transition-all ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting || !transcript.trim() || isListening}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Processing...
            </>
          ) : (
            <>
              <Send size={16} />
              Dispatch Emergency
            </>
          )}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">
          Quick Simulations
        </p>
        <div className="flex gap-2">
          <button 
            onClick={() => handleSimulation('normal')}
            className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs py-2 px-2 rounded transition-colors"
          >
            Normal
          </button>
          <button 
            onClick={() => handleSimulation('flood')}
            className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs py-2 px-2 rounded transition-colors"
          >
            Flood
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimulatorConsole;