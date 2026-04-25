import React, { useState } from 'react';

const NovelScenarioLog = ({ incidents = [] }) => {
  const [isOpen, setIsOpen] = useState(true);

  const novelIncidents = incidents.filter(i => i.triage_method === 'llm_novel_scenario');

  if (novelIncidents.length === 0) return null;

  return (
    <div className="glass rounded-xl overflow-hidden shadow-lg border border-purple-500/30 flex flex-col mt-4">
      <div 
        className="bg-purple-900/30 p-3 flex justify-between items-center border-b border-purple-500/30 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold text-purple-300">Novel Scenarios Handled ({novelIncidents.length})</h3>
        </div>
        <button className="text-purple-400 hover:text-purple-300">
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {isOpen && (
        <div className="p-3 space-y-3 max-h-80 overflow-y-auto custom-scrollbar bg-black/40">
          {novelIncidents.map((incident) => {
            const agentTrail = incident.agent_trail || [];
            const triageEvent = agentTrail.find(e => e.agent === 'triage');
            
            return (
              <div key={incident.incident_id} className="bg-gray-800/80 rounded-lg p-3 border border-purple-500/20 relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-mono text-xs text-purple-300 tracking-wider">
                    #{incident.incident_id.substring(0, 8)}
                  </div>
                  <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    incident.priority === 'P1' ? 'text-red-400 border-red-500/30 bg-red-900/20' : 
                    incident.priority === 'P2' ? 'text-orange-400 border-orange-500/30 bg-orange-900/20' :
                    'text-yellow-400 border-yellow-500/30 bg-yellow-900/20'
                  }`}>
                    {incident.priority} ASSIGNED
                  </div>
                </div>
                
                <div className="text-xs text-gray-300 italic mb-2 border-l-2 border-purple-500/50 pl-2">
                  "{incident.transcript}"
                </div>
                
                {triageEvent && (
                  <div className="bg-purple-900/20 rounded p-2 border border-purple-500/10">
                     <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-1 font-bold">LLM Reasoning</div>
                     <p className="text-[11px] text-purple-200 leading-snug">
                       {triageEvent.reasoning || 'No justification provided.'}
                     </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NovelScenarioLog;
