import React, { useState } from 'react';
import { Bell, BellOff, Terminal, Cpu } from 'lucide-react';

const ValidationPanel = ({ data }) => {
  const { authenticity_score, reasoning, recommended_action, validation_method } = data;
  let statusColor = '#2F855A'; // success
  if (authenticity_score < 45) statusColor = '#C53030'; // critical
  else if (authenticity_score < 70) statusColor = '#B7791F'; // warning

  return (
    <div className={`mt-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50`}>
       <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
         <div className="flex flex-col">
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Integrity Check</span>
           <span className="text-[9px] text-teal-600 font-bold uppercase tracking-tight mt-0.5">
             Engine: {validation_method || 'AI-Heuristic'}
           </span>
         </div>
         <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200" style={{ color: statusColor }}>
              {recommended_action}
            </span>
            <div className="text-xs font-bold text-slate-800 mono">{authenticity_score}%</div>
         </div>
       </div>
       <ul className="space-y-1">
         {reasoning.map((r, i) => (
           <li key={i} className="text-[11px] text-slate-600 leading-tight flex gap-2">
             <span className="text-slate-300 mt-1">•</span>
             <span>{r}</span>
           </li>
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
    <div className="mt-2 p-3 rounded-xl border border-amber-200 bg-amber-50/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Deduplication</span>
        <span className="ml-auto px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-amber-600 border border-amber-100 mono">{pct}% Match</span>
      </div>
      <p className="text-[11px] text-slate-800 font-semibold leading-tight">
        Linking to active incident <span className="mono font-bold text-amber-700">#{shortId}</span>
      </p>
      {reasoning && (
        <p className="text-[10px] text-slate-500 mt-1.5 leading-tight italic">{reasoning}</p>
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
      if (agent === 'ingestion') return `Distress transmission received via ${event.channel || 'primary channel'}. Processing...`;
      if (agent === 'parsing') {
        const category = (decision.match(/Extracted\s+([a-zA-Z_]+)/i) || [])[1] || 'unknown';
        const location = (reasoning.match(/Location=([^,]+)/i) || [])[1] || 'the area';
        return `Extracted ${category.replace('_', ' ')} metadata. Geolocation focused on ${location}.`;
      }
      if (agent === 'triage') {
        const priority = (decision.match(/Assigned\s+(P\d)/i) || [])[1] || 'Priority';
        return `Severity set to ${priority}. ${reasoning.split('.')[0]}.`;
      }
      if (agent === 'dispatch') return `Deployment confirmed for ${decision.replace('Assigned ', '')}. ETA calculations active.`;
      if (agent === 'deduplication' && event.decision?.toLowerCase().includes('duplicate')) {
        const confMatch = (event.reasoning || '').match(/([\d.]+)%/);
        const confidence = confMatch ? parseFloat(confMatch[1]) / 100 : (event.duplicate_confidence || 0);
        const dupOf = (event.reasoning || '').match(/incident ([a-f0-9]{8})/)?.[1] || null;
        return { type: 'duplicate_panel', data: { duplicate_of: dupOf, duplicate_confidence: confidence, reasoning: event.reasoning } };
      }
      if (agent === 'validation') {
        try { return { type: 'validation_panel', data: JSON.parse(reasoning) }; }
        catch (e) { return `Validation check: ${decision}`; }
      }
    } catch (e) {}
    return `${decision}`;
  };

  const processedEvents = events.slice(0, 15).map((event, i, arr) => {
    let deltaText = '0.0s';
    if (i < arr.length - 1 && arr[i+1]?.timestamp && event.timestamp) {
       const currTime = new Date(event.timestamp).getTime();
       const prevTime = new Date(arr[i+1].timestamp).getTime();
       const diff = ((currTime - prevTime) / 1000).toFixed(1);
       if (!isNaN(diff) && diff >= 0) deltaText = `+${diff}s`;
    }
    return { ...event, narrative: formatNarrative(event), deltaText };
  });

  const renderNarrative = (narrative, isLatest) => {
    if (typeof narrative === 'object') {
      if (narrative.type === 'validation_panel') return <ValidationPanel data={narrative.data} />;
      if (narrative.type === 'duplicate_panel') return <DuplicatePanel data={narrative.data} />;
    }
    return (
      <p className={`${isLatest ? 'text-sm font-bold text-slate-800' : 'text-xs text-slate-600'} leading-relaxed mt-1`}>
        {narrative}
      </p>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
         {processedEvents.length > 0 ? (
           processedEvents.map((evt, idx) => (
             <div key={idx} className={`relative pl-6 border-l-2 ${idx === 0 ? 'border-teal-500' : 'border-slate-100 opacity-80'}`}>
                {idx === 0 && (
                  <div className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-teal-500 ring-4 ring-teal-50 shadow-sm shadow-teal-500/20 animate-pulse"></div>
                )}
                {idx !== 0 && (
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-200"></div>
                )}
                
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${idx === 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                      {evt.agent}
                    </span>
                    {idx === 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-teal-50 text-[8px] font-bold text-teal-600 border border-teal-100">LATEST</span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 mono">
                    {evt.deltaText !== '0.0s' ? evt.deltaText : ''}
                  </span>
                </div>
                {renderNarrative(evt.narrative, idx === 0)}
             </div>
           ))
         ) : (
           <div className="flex flex-col items-center justify-center h-full text-slate-300 py-12">
             <Cpu size={32} className="mb-3 opacity-20" />
             <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Monitoring Ingress Pipelines</span>
           </div>
         )}
      </div>
    </div>
  );
};

export default AgentFeed;