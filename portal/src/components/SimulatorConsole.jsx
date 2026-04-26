import React, { useState, useRef } from 'react';
import { PhoneCall, Mic, UploadCloud, Loader, Send, Activity, FileAudio } from 'lucide-react';
import { getApiBase } from '../utils/runtimeConfig';

const transcripts = [
  "Help, aag lag gayi hai Sector 14 market mein, 3 log fas gaye hain ander!",
  "Mera accident ho gaya hai NH8 par, mujhe aur mere dost ko khoon aa raha hai, please ambulance bhejo jaldi!",
  "Hello, yaha do gaadiyo ki takkar hui hai, ek aadmi behosh hai.",
  "Bhaiya jaldi aao, yaha danga ho gaya hai, log chaku leke ghum rahe hain!",
  "Meri biwi ko labor pain ho raha hai, paani toot gaya hai, hum log traffic me phase hain."
];

const SimulatorConsole = () => {
  const [textInput, setTextInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle, processing, completed, error
  const [activeTab, setActiveTab] = useState('text'); // text, audio, random
  const [feedback, setFeedback] = useState('');
  const fileInputRef = useRef(null);

  const apiBase = getApiBase();

  const generateCallerId = () => `+91-112-${Math.floor(10000000 + Math.random() * 90000000)}`;

  const handleSubmitText = async (e) => {
    e?.preventDefault();
    if (!textInput.trim()) return;
    
    setStatus('processing');
    setFeedback('Processing text report...');
    const cid = generateCallerId();

    try {
      const response = await fetch(`${apiBase}/api/v1/emergency/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: textInput, caller_id: cid }),
      });
      if (!response.ok) throw new Error("Failed to submit");
      setStatus('completed');
      setFeedback('Incident successfully reported!');
      setTextInput('');
    } catch (error) {
      console.error("Failed to submit:", error);
      setStatus('error');
      setFeedback('Error reporting incident. Check backend connection.');
    }
    resetStatus();
  };

  const handleRandomScenario = async () => {
    const randomText = transcripts[Math.floor(Math.random() * transcripts.length)];
    setTextInput(randomText);
    setStatus('processing');
    setFeedback(`Processing: "${randomText}"`);
    const cid = generateCallerId();

    try {
      const response = await fetch(`${apiBase}/api/v1/emergency/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: randomText, caller_id: cid }),
      });
      if (!response.ok) throw new Error("Failed to submit");
      setStatus('completed');
      setFeedback('Random incident triggered!');
      setTextInput('');
    } catch (error) {
      console.error("Failed to submit:", error);
      setStatus('error');
      setFeedback('Error reporting incident.');
    }
    resetStatus();
  };

  const processAudioFile = async (file) => {
    if (!file) return;
    setStatus('processing');
    setFeedback(`Uploading and transcribing: ${file.name}`);
    const cid = generateCallerId();

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("caller_id", cid);

    try {
      const response = await fetch(`${apiBase}/api/v1/emergency/audio`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to process audio.");
      setStatus('completed');
      setFeedback('Audio processed and incident created!');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setFeedback("Error transcribing audio.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    resetStatus();
  };

  const resetStatus = () => {
    setTimeout(() => {
      setStatus('idle');
      setFeedback('');
    }, 4000);
  };

  return (
    <div className="flex flex-col h-full bg-white border-t border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
          <Activity size={16} className="text-teal-600" />
          Test Input Console
        </h3>
        {status !== 'idle' && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-widest ${
            status === 'processing' ? 'bg-blue-100 text-blue-700' :
            status === 'completed' ? 'bg-teal-100 text-teal-700' :
            'bg-red-100 text-red-700'
          }`}>
            {status === 'processing' && <Loader size={10} className="animate-spin" />}
            {status === 'processing' ? 'Processing' : status === 'completed' ? 'Success' : 'Error'}
          </span>
        )}
      </div>

      <div className="flex border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'text' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Text Input
        </button>
        <button 
          onClick={() => setActiveTab('audio')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'audio' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Audio
        </button>
        <button 
          onClick={() => setActiveTab('random')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'random' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Random
        </button>
      </div>

      <div className="flex-1 p-3 flex flex-col justify-start overflow-y-auto">
        {activeTab === 'text' && (
          <form onSubmit={handleSubmitText} className="flex flex-col gap-2 h-full">
            <textarea
              className="flex-1 p-2 border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-xs text-slate-700"
              placeholder="Type emergency transcript here..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={status === 'processing'}
              style={{ minHeight: '80px' }}
            />
            <button 
              type="submit" 
              disabled={!textInput.trim() || status === 'processing'}
              className="btn btn-primary w-full shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:shadow-none py-1.5 text-xs flex justify-center items-center gap-2 rounded-lg"
            >
              <Send size={14} /> Submit Report
            </button>
          </form>
        )}

        {activeTab === 'audio' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-400">
              <FileAudio size={24} />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 mt-1 max-w-[150px]">Supports .wav, .mp3, .m4a. Powered by Whisper.</p>
            </div>
            <input type="file" accept="audio/*" className="hidden" ref={fileInputRef} onChange={(e) => processAudioFile(e.target.files[0])} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={status === 'processing'}
              className="btn btn-ghost border border-slate-300 hover:bg-slate-100 hover:text-teal-600 disabled:opacity-50 text-xs flex items-center gap-2 px-4 py-1.5 rounded-lg"
            >
              <UploadCloud size={14} /> Choose File
            </button>
          </div>
        )}

        {activeTab === 'random' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 border border-slate-100 rounded-lg p-4 bg-slate-50">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-teal-100 rounded-full flex items-center justify-center text-teal-600 mb-2 shadow-sm border border-teal-200">
                <PhoneCall size={20} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Triggers a pre-configured multi-lingual test call.</p>
            </div>
            <button 
              onClick={handleRandomScenario}
              disabled={status === 'processing'}
              className="btn btn-primary shadow-lg shadow-teal-500/20 disabled:opacity-50 px-4 py-1.5 text-xs flex items-center gap-2 rounded-lg"
            >
              <Activity size={14} /> Trigger Random
            </button>
          </div>
        )}

        {feedback && (
          <div className={`mt-2 p-2 rounded text-[10px] text-center border font-semibold animate-slide-up ${
            status === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 
            status === 'processing' ? 'bg-blue-50 border-blue-200 text-blue-600' :
            'bg-teal-50 border-teal-200 text-teal-700'
          }`}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulatorConsole;
