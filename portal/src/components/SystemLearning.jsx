import React, { useState, useEffect } from 'react';

const SystemLearning = () => {
  const [insight, setInsight] = useState(null);
  const [isOpen, setIsOpen] = useState(true);

  const fetchInsights = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
      const res = await fetch(`${apiBase}/api/v1/learning/insights`);
      if (res.ok) {
        const data = await res.json();
        // If empty, keep null
        if (data.rule_suggestions && data.rule_suggestions.length > 0) {
          setInsight(data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch insights", e);
    }
  };

  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  const handleApply = async (rule) => {
    if (window.confirm(`Apply this learning to AEGIS Core Rules?\n\n"${rule}"`)) {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
        await fetch(`${apiBase}/api/v1/learning/apply`, { method: 'POST' });
        alert("Rule successfully applied and merged into heuristic engine.");
        // We can optimistically re-fetch or clear
        fetchInsights();
      } catch (e) {
        alert("Failed to apply rule");
      }
    }
  };

  if (!insight) return null;

  return (
    <div className="glass rounded-xl overflow-hidden shadow-lg border border-teal-500/30 flex flex-col mt-4">
      <div 
        className="bg-teal-900/30 p-3 flex justify-between items-center border-b border-teal-500/30 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold text-teal-300">System Learning</h3>
        </div>
        <button className="text-teal-400 hover:text-teal-300">
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {isOpen && (
        <div className="p-3 space-y-4 max-h-80 overflow-y-auto custom-scrollbar bg-black/40">
          
          {insight.rule_suggestions && insight.rule_suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-2">Suggested Optimizations</div>
              {insight.rule_suggestions.map((rule, idx) => (
                <div key={idx} className="bg-teal-900/20 rounded-lg p-3 border border-teal-500/40">
                  <p className="text-sm text-teal-100 mb-3">"{rule}"</p>
                  <button 
                    onClick={() => handleApply(rule)}
                    className="w-full bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 border border-teal-500/50 py-1.5 rounded text-xs font-bold transition-colors"
                  >
                    Apply Suggestion
                  </button>
                </div>
              ))}
            </div>
          )}

          {insight.patterns_found && insight.patterns_found.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Learning History (Patterns)</div>
              <ul className="space-y-2">
                {insight.patterns_found.map((pattern, idx) => (
                  <li key={idx} className="text-xs text-gray-300 bg-gray-800/50 p-2 rounded border border-gray-700">
                    {pattern}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default SystemLearning;
