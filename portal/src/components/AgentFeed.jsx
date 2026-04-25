import React, { useState } from 'react';
import { Bell, BellOff, Terminal } from 'lucide-react';

const ValidationPanel = ({ data }) => {
  const { authenticity_score, reasoning, recommended_action, validation_method } = data;
  let colorClass = 'badge-success';
  if (authenticity_score < 45) colorClass = 'badge-critical';
  else if (authenticity_score < 70) colorClass = 'badge-warning';

  return (
    <div className={`mt-2 p-2 rounded border bg-aegis-bg-base border-aegis-border`}>
       <div className="flex justify-between items-center mb-1.5 border-b border-aegis-border pb-1.5">
         <div className="flex flex-col">
           <span className="text-[10px] font-bold text-aegis-text-secondary uppercase tracking-widest">Prank Detection</span>
           {validation_method === 'rule_based' && (
             <span className="text-[8px] text-aegis-medium font-bold uppercase tracking-widest mt-0.5">
               Engine: Ruleset
             </span>
           )}
         </div>
         <div className="flex items-center gap-2">
            <span className={`badge badge-xs ${colorClass}`}>{recommended_action}</span>
            <div className={`text-[11px] mono font-bold text-aegis-text-primary`}>{authenticity_score}%</div>
         </div>
       </div>
       <ul className="list-disc pl-3 space-y-1">
         {reasoning.map((r, i) => (
           <li key={i} className="text-[10px] text-aegis-text-secondary leading-tight">{r}</li>
         ))}
       </ul>
    </div>
  );
};

const DuplicatePanel = ({ data }) => {
  const { duplicate_of, duplicate_confidence, reasoning } = data;
  const pct = Math.round((duplicate_confidence || 0) * 100);
  const shortId = duplicate_of ? duplicate_of.slice(0, 8) : '???';
  return (
    <div className="mt-2 p-2 rounded border border-aegis-medium/30 bg-aegis-medium/5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold text-aegis-medium uppercase tracking-widest">Deduplication</span>
        <span className="ml-auto badge badge-warning badge-xs mono">{pct}% match</span>
      </div>
      <p className="text-[10px] text-aegis-text-primary leading-tight">
        Merging with <span className="mono font-bold text-aegis-medium">#{shortId}</span>
      </p>
      {reasoning && (
        <p className="text-[9px] text-aegis-text-muted mt-1 leading-tight">{reasoning}</p>
      )}
    </div>
  );
};

const NovelScenarioPanel = ({ data }) => {
  const { priority, reasoning } = data;
  return (
    <div className="mt-2 p-2 rounded border border-aegis-purple/30 bg-aegis-purple/5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold text-aegis-purple uppercase tracking-widest">Novel Scenario</span>
        <span className={`ml-auto badge badge-purple badge-xs mono`}>{priority}</span>
      </div>
      <p className="text-[10px] text-aegis-text-primary leading-tight italic border-l border-aegis-purple/40 pl-2">
        {reasoning}
      </p>
    </div>
  );
};

const AgentFeed = ({ events = [] }) => {
  const [soundEnabled, setSoundEnabled] = useState(true);

  const formatNarrative = (event) => {
    const agent = event.agent?.toLowerCase() || '';
    const decision = event.decision || '';
    const reasoning = event.reasoning || '';
    
    try {
      if (agent === 'ingestion') return `Distress call received, processing transcript...`;
      if (agent === 'parsing') {
        const category = (decision.match(/Extracted\s+([a-zA-Z_]+)/i) || [])[1] || 'unknown';
        const location = (reasoning.match(/Location=([^,]+)/i) || [])[1] || 'the area';
        const victims = (reasoning.match(/Victims=(\d+)/i) || [])[1] || 'multiple';
        return `Identified ${category.replace('_', ' ')} near ${location}, ${victims} at risk.`;
      }
      if (agent === 'triage') {
        const priority = (decision.match(/Assigned\s+(P\d)/i) || [])[1] || 'Priority';
        if (event.triage_method === 'llm_novel_scenario') return { type: 'novel_scenario_panel', data: { priority, reasoning: event.reasoning } };
        return `Severity upgraded to ${priority} — ${reasoning.split('.')[0]}.`;
      }
      if (agent === 'dispatch') return `Dispatched ${decision.replace('Assigned ', '')} — ${reasoning}.`;
      if (agent === 'deduplication') {
        if (event.decision?.toLowerCase().includes('duplicate detected')) {
          const confMatch = (event.reasoning || '').match(/([\d.]+)%/);
          const confidence = confMatch ? parseFloat(confMatch[1]) / 100 : (event.duplicate_confidence || 0);
          const dupOf = (event.reasoning || '').match(/incident ([a-f0-9]{8})/)?.[1] || null;
          return { type: 'duplicate_panel', data: { duplicate_of: dupOf, duplicate_confidence: confidence, reasoning: event.reasoning } };
        }
        return `Dedup: ${event.decision}`;
      }
      if (agent === 'validation') {
        try { return { type: 'validation_panel', data: JSON.parse(reasoning) }; }
        catch (e) { return `Validation: ${decision}`; }
      }
    } catch (e) {}
    return `${decision}`;
  };

  const processedEvents = events.slice(0, 8).map((event, i, arr) => {
    let deltaText = '0.0s';
    if (i < arr.length - 1 && arr[i+1]?.timestamp && event.timestamp) {
       const currTime = new Date(event.timestamp).getTime();
       const prevTime = new Date(arr[i+1].timestamp).getTime();
       const diff = ((currTime - prevTime) / 1000).toFixed(1);
       if (!isNaN(diff) && diff >= 0) deltaText = `+${diff}s`;
    } else if (i === arr.length - 1 && events.length > 0) deltaText = 'START';
    
    return { ...event, narrative: formatNarrative(event), deltaText };
  });

  const latestEvent = processedEvents[0];
  const historyEvents = processedEvents.slice(1);

  const renderNarrative = (narrative, isLatest) => {
    if (typeof narrative === 'object') {
      if (narrative.type === 'validation_panel') return <ValidationPanel data={narrative.data} />;
      if (narrative.type === 'duplicate_panel') return <DuplicatePanel data={narrative.data} />;
      if (narrative.type === 'novel_scenario_panel') return <NovelScenarioPanel data={narrative.data} />;
    }
    return (
      <p className={`${isLatest ? 'text-[12px] font-semibold text-aegis-text-primary' : 'text-[11px] text-aegis-text-secondary'} leading-normal`}>
        {narrative}
      </p>
    );
  };

  return (
    <div className="card-flush flex flex-col h-full bg-aegis-bg-surface">
      <div className="section-header flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-aegis-info" />
          <span>Mission Control Log</span>
        </div>
        <button 
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`btn btn-xs p-1 ${soundEnabled ? 'text-aegis-low' : 'text-aegis-text-muted'}`}
        >
          {soundEnabled ? <Bell size={12} /> : <BellOff size={12} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
         {latestEvent ? (
           <>
             {/* Latest Event */}
             <div className="relative pl-4 border-l-2 border-aegis-critical">
               <div className="absolute -left-[5px] top-1.5 status-dot status-dot-online"></div>
               <div className="flex items-center justify-between mb-1">
                 <span className="text-[10px] text-aegis-critical mono font-bold uppercase">{latestEvent.agent}</span>
                 <span className="text-[9px] mono text-aegis-text-muted bg-aegis-bg-base px-1.5 rounded border border-aegis-border">
                    {latestEvent.deltaText}
                 </span>
               </div>
               {renderNarrative(latestEvent.narrative, true)}
             </div>

             <div className="divider"></div>

             {/* History Events */}
             <div className="flex flex-col gap-3">
               {historyEvents.map((evt, idx) => (
                 <div key={idx} className="relative pl-4 border-l border-aegis-border opacity-70 hover:opacity-100 transition-opacity">
                   <div className="absolute -left-[3px] top-1.5 w-1 h-1 rounded-full bg-aegis-info"></div>
                   <div className="flex items-center justify-between mb-0.5">
                     <span className="text-[9px] text-aegis-info mono font-bold uppercase">{evt.agent}</span>
                     <span className="text-[9px] mono text-aegis-text-muted">{evt.deltaText}</span>
                   </div>
                   {renderNarrative(evt.narrative, false)}
                 </div>
               ))}
             </div>
           </>
         ) : (
           <div className="flex items-center justify-center h-full text-aegis-text-muted text-[10px] uppercase tracking-widest opacity-50 italic">
             Awaiting incoming transmissions...
           </div>
         )}
      </div>
    </div>
  );
};

export default AgentFeed;