import React, { useState } from 'react';
import { Bell, BellOff, Terminal } from 'lucide-react';

const ValidationPanel = ({ data }) => {

  const { authenticity_score, reasoning, recommended_action, validation_method } = data;
  let colorClass = 'text-green-400 border-green-500/30';
  if (authenticity_score < 45) colorClass = 'text-red-500 border-red-500/30';
  else if (authenticity_score < 70) colorClass = 'text-yellow-400 border-yellow-500/30';

  return (
    <div className={`mt-2 p-3 rounded-lg border ${colorClass.split(' ')[1]} bg-gray-900/50`}>
       <div className="flex justify-between items-center mb-2 border-b border-gray-700/50 pb-2">
         <div className="flex flex-col">
           <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Prank Detection</span>
           {validation_method === 'rule_based' && (
             <span className="text-[8px] text-amber-400 font-bold uppercase tracking-widest mt-0.5">
               Validated by: Rule Engine
             </span>
           )}
         </div>
         <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold ${colorClass.split(' ')[0]} uppercase tracking-widest`}>{recommended_action}</span>
            <div className={`text-sm font-mono font-bold ${colorClass.split(' ')[0]}`}>{authenticity_score}/100</div>
         </div>
       </div>
       <ul className="list-disc pl-4 space-y-1.5">
         {reasoning.map((r, i) => (
           <li key={i} className="text-[11px] text-gray-400 leading-snug">{r}</li>
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
    <div className="mt-2 p-3 rounded-lg border border-amber-500/40 bg-amber-900/10">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-amber-400 text-lg">⚠</span>
        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Duplicate Suppressed</span>
        <span className="ml-auto text-[10px] font-mono font-bold text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-500/30">{pct}% match</span>
      </div>
      <p className="text-[11px] text-amber-200 leading-snug">
        Merging with incident <span className="font-mono font-bold text-amber-300">#{shortId}…</span> — preventing duplicate dispatch.
      </p>
      {reasoning && (
        <p className="text-[10px] text-amber-400/70 mt-1 leading-snug">{reasoning}</p>
      )}
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
      if (agent === 'ingestion') {
        return `📞 Ingestion: Distress call received, processing transcript...`;
      }
      if (agent === 'parsing') {
        const category = (decision.match(/Extracted\s+([a-zA-Z_]+)/i) || [])[1] || 'unknown';
        const location = (reasoning.match(/Location=([^,]+)/i) || [])[1] || 'the area';
        const victims = (reasoning.match(/Victims=(\d+)/i) || [])[1] || 'multiple';
        const formattedCategory = category.replace('_', ' ');
        return `📍 Parsing: Identified ${formattedCategory} emergency near ${location}, ${victims} people at risk.`;
      }
      if (agent === 'triage') {
        const priority = (decision.match(/Assigned\s+(P\d)/i) || [])[1] || 'Priority';
        const shortReason = reasoning.split('.')[0] || reasoning;
        return `⚡ Triage: Severity upgraded to ${priority} — ${shortReason}.`;
      }
      if (agent === 'dispatch') {
        const unit = decision.replace('Assigned ', '') || 'Emergency unit';
        return `🚑 Dispatched ${unit} — ${reasoning}.`;
      }
      if (agent === 'deduplication') {
        const isDup = event.decision?.toLowerCase().includes('duplicate detected');
        if (isDup) {
          // Extract confidence from reasoning string or event field
          const confMatch = (event.reasoning || '').match(/([\d.]+)%/);
          const confidence = confMatch ? parseFloat(confMatch[1]) / 100 : (event.duplicate_confidence || 0);
          const dupOf = (event.reasoning || '').match(/incident ([a-f0-9]{8})/)?.[1] || null;
          return {
            type: 'duplicate_panel',
            data: {
              duplicate_of: dupOf,
              duplicate_confidence: confidence,
              reasoning: event.reasoning,
            },
          };
        }
        return `🔍 Dedup: ${event.decision} — ${event.reasoning || ''}`;
      }
      if (agent === 'validation') {
        try {
          const parsed = JSON.parse(reasoning);
          return { type: 'validation_panel', data: parsed };
        } catch (e) {
          return `🛡️ Validation: ${decision}`;
        }
      }
    } catch (e) {
      // Fallback if parsing fails
    }
    
    return `🤖 ${event.agent}: ${decision}`;
  };

  const processedEvents = events.slice(0, 6).map((event, i, arr) => {
    let deltaText = '0.0s';
    if (i < arr.length - 1 && arr[i+1]?.timestamp && event.timestamp) {
       const currTime = new Date(event.timestamp).getTime();
       const prevTime = new Date(arr[i+1].timestamp).getTime();
       const diff = ((currTime - prevTime) / 1000).toFixed(1);
       if (!isNaN(diff) && diff >= 0) {
          deltaText = `+${diff}s`;
       }
    } else if (i === arr.length - 1 && events.length > 0) {
       deltaText = 'Start';
    }
    
    return {
      ...event,
      narrative: formatNarrative(event),
      deltaText
    };
  });

  const latestEvent = processedEvents[0];
  const historyEvents = processedEvents.slice(1, 6);

  const renderNarrative = (narrative, isLatest) => {
    if (typeof narrative === 'object') {
      if (narrative.type === 'validation_panel') return <ValidationPanel data={narrative.data} />;
      if (narrative.type === 'duplicate_panel') return <DuplicatePanel data={narrative.data} />;
    }
    return (
      <p className={`${isLatest ? 'text-[15px] font-bold text-white' : 'text-[12px] text-gray-300'} leading-relaxed tracking-wide`}>
        {narrative}
      </p>
    );
  };

  return (
    <div className="glass-card rounded-xl flex flex-col h-full border border-gray-700/50 overflow-hidden bg-[#0A1118]">
      {/* Header */}
      <div className="bg-gray-900/90 border-b border-gray-700/50 p-3 flex items-center justify-between shadow-md">
         <h2 className="text-xs font-bold flex items-center gap-2 text-blue-400 uppercase tracking-widest">
           <Terminal size={14} /> Mission Control Log
         </h2>
         <button 
           onClick={() => setSoundEnabled(!soundEnabled)}
           className={`p-1.5 rounded-md transition-colors ${soundEnabled ? 'text-green-400 bg-green-400/10 border border-green-500/20' : 'text-gray-500 bg-gray-800 border border-gray-700'}`}
           title="Toggle Sound Notifications"
         >
           {soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
         </button>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-4 overflow-hidden relative">
         {latestEvent ? (
           <>
             {/* Latest Event */}
             <div className="relative pl-4 border-l-2 border-red-500">
               <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></div>
               <div className="flex items-center justify-between mb-1.5">
                 <span className="text-[10px] text-red-400 font-mono tracking-wider uppercase font-bold">{latestEvent.agent}</span>
                 <span className="text-[10px] font-mono text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded border border-gray-700">
                    {latestEvent.deltaText}
                 </span>
               </div>
               {renderNarrative(latestEvent.narrative, true)}
             </div>

             {/* Timeline separator */}
             <div className="w-full h-px bg-gradient-to-r from-gray-700/50 to-transparent my-1"></div>

             {/* History Events */}
             <div className="flex flex-col gap-3.5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
               {historyEvents.map((evt, idx) => {
                 const opacityStyle = { opacity: 1 - (idx * 0.15) };
                 
                 return (
                   <div key={idx} className="relative pl-4 border-l border-gray-700" style={opacityStyle}>
                     <div className="absolute -left-[3px] top-1.5 w-1 h-1 rounded-full bg-blue-500"></div>
                     <div className="flex items-center justify-between mb-1">
                       <span className="text-[9px] text-blue-400/80 font-mono tracking-wider uppercase">{evt.agent}</span>
                       <span className="text-[9px] font-mono text-gray-500">
                          {evt.deltaText}
                       </span>
                     </div>
                     {renderNarrative(evt.narrative, false)}
                   </div>
                 );
               })}
             </div>
           </>
         ) : (
           <div className="flex items-center justify-center h-full text-gray-600 text-sm font-mono tracking-widest uppercase">
             Awaiting incoming transmissions...
           </div>
         )}
      </div>
    </div>
  );
};

export default AgentFeed;