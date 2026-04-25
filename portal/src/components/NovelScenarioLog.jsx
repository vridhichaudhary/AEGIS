import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu } from 'lucide-react';

const NovelScenarioLog = ({ incidents = [] }) => {
  const [isOpen, setIsOpen] = useState(true);
  const novelIncidents = incidents.filter(i => i.triage_method === 'llm_novel_scenario');

  if (novelIncidents.length === 0) return null;

  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface overflow-hidden">
      <div 
        className="section-header flex justify-between items-center cursor-pointer hover:bg-aegis-bg-hover transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-aegis-purple" />
          <span>Novel Scenarios Handled ({novelIncidents.length})</span>
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>

      {isOpen && (
        <div className="p-3 space-y-3 max-h-80 overflow-y-auto custom-scrollbar bg-aegis-bg-base/30">
          {novelIncidents.map((incident) => {
            const triageEvent = incident.agent_trail?.find(e => e.agent === 'triage');
            
            return (
              <div key={incident.incident_id} className="bg-aegis-bg-surface rounded p-2.5 border border-aegis-purple/20 relative group hover:border-aegis-purple/40 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="mono text-[10px] text-aegis-purple font-bold">
                    #{incident.incident_id.substring(0, 8).toUpperCase()}
                  </span>
                  <span className={`badge badge-xs mono ${
                    incident.priority === 'P1' ? 'badge-critical' : 
                    incident.priority === 'P2' ? 'badge-warning' :
                    'badge-info'
                  }`}>
                    {incident.priority} ASSIGNED
                  </span>
                </div>
                
                <div className="text-[11px] text-aegis-text-secondary italic mb-2 border-l-2 border-aegis-purple/40 pl-2">
                  "{incident.transcript}"
                </div>
                
                {triageEvent && (
                  <div className="bg-aegis-purple/5 rounded p-2 border border-aegis-purple/10">
                     <div className="text-[9px] text-aegis-purple font-bold uppercase tracking-widest mb-1">AI Cognitive Chain</div>
                     <p className="text-[10px] text-aegis-text-primary leading-relaxed">
                       {triageEvent.reasoning}
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
