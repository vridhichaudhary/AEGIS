import React, { useState } from 'react';

const SimulatorConsole = () => {
  const [transcript, setTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

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
      console.error("Failed to submit report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulation = async (scenario) => {
    try {
      await fetch(`${apiBase}/api/v1/simulation/run?scenario=${scenario}&count=3`, {
        method: 'POST',
        headers: { 'accept': 'application/json' }
      });
    } catch (error) {
      console.error(`Failed to run ${scenario} simulation:`, error);
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="text-purple-400">🎙️</span> Incident Input
      </h2>
      
      <form onSubmit={handleReport} className="flex flex-col gap-3">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Type an emergency call here (e.g. 'Sector 14 me aag lag gayi hai, jaldi aao')..."
          className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none h-24"
          disabled={isSubmitting}
        />
        <button 
          type="submit" 
          disabled={isSubmitting || !transcript.trim()}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Processing...</>
          ) : (
            'Dispatch Emergency'
          )}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">Quick Simulations</p>
        <div className="flex gap-2">
          <button 
            onClick={() => handleSimulation('normal')}
            className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs py-2 px-2 rounded transition-colors"
          >
            Normal Load
          </button>
          <button 
            onClick={() => handleSimulation('flood')}
            className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs py-2 px-2 rounded transition-colors"
          >
            Flood Scenario
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimulatorConsole;
