import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BrainCircuit } from 'lucide-react';

const SystemLearning = () => {
  const [insight, setInsight] = useState(null);
  const [isOpen, setIsOpen] = useState(true);

  const fetchInsights = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
      const res = await fetch(`${apiBase}/api/v1/learning/insights`);
      if (res.ok) {
        const data = await res.json();
        if (data.rule_suggestions?.length > 0) setInsight(data);
      }
    } catch (e) {
      console.error("Failed to fetch insights", e);
    }
  };

  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleApply = async (rule) => {
    if (window.confirm(`Deploy this optimization to AEGIS Engine?\n\n"${rule}"`)) {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
        await fetch(`${apiBase}/api/v1/learning/apply`, { method: 'POST' });
        fetchInsights();
      } catch (e) {
        alert("Failed to apply rule");
      }
    }
  };

  if (!insight) return null;

  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface overflow-hidden">
      <div 
        className="section-header flex justify-between items-center cursor-pointer hover:bg-aegis-bg-hover transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <BrainCircuit size={14} className="text-aegis-info" />
          <span>Continuous Learning</span>
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>

      {isOpen && (
        <div className="p-3 space-y-4 max-h-80 overflow-y-auto custom-scrollbar bg-aegis-bg-base/30">
          {insight.rule_suggestions?.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] font-bold text-aegis-text-muted uppercase tracking-widest mb-1.5">Optimization Heuristics</div>
              {insight.rule_suggestions.map((rule, idx) => (
                <div key={idx} className="bg-aegis-info/5 rounded p-2.5 border border-aegis-info/20">
                  <p className="text-[11px] text-aegis-text-primary leading-relaxed mb-3 italic">"{rule}"</p>
                  <button 
                    onClick={() => handleApply(rule)}
                    className="btn btn-xs btn-primary w-full"
                  >
                    DEPLOY OPTIMIZATION
                  </button>
                </div>
              ))}
            </div>
          )}

          {insight.patterns_found?.length > 0 && (
            <div className="mt-4">
              <div className="text-[9px] font-bold text-aegis-text-muted uppercase tracking-widest mb-1.5">Pattern Detection History</div>
              <div className="flex flex-col gap-1.5">
                {insight.patterns_found.map((pattern, idx) => (
                  <div key={idx} className="text-[10px] text-aegis-text-secondary bg-aegis-bg-surface p-2 rounded border border-aegis-border">
                    {pattern}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemLearning;
