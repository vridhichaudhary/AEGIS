import React, { useMemo } from 'react';

const CHANNEL_CONFIG = {
  whatsapp: { label: 'WhatsApp', color: '#25D366', bg: 'rgba(37,211,102,0.15)' },
  voice_call: { label: '112 Call', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  voice_upload: { label: 'Audio Upload', color: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
  operator: { label: 'Operator', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
};

const ChannelChart = ({ incidents = [] }) => {
  const counts = useMemo(() => {
    const c = {};
    incidents.forEach(inc => {
      const ch = inc.channel || (inc.audio_source === 'voice_upload' ? 'voice_upload' : 'voice_call');
      c[ch] = (c[ch] || 0) + 1;
    });
    return c;
  }, [incidents]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) return null;

  // Build conic-gradient segments
  let cumulativePercent = 0;
  const segments = Object.entries(counts).map(([channel, count]) => {
    const pct = (count / total) * 100;
    const cfg = CHANNEL_CONFIG[channel] || { label: channel, color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' };
    const start = cumulativePercent;
    cumulativePercent += pct;
    return { channel, count, pct, color: cfg.color, label: cfg.label, start };
  });

  const gradient = segments.map(s => `${s.color} ${s.start.toFixed(1)}% ${(s.start + s.pct).toFixed(1)}%`).join(', ');

  return (
    <div className="glass rounded-xl overflow-hidden shadow-lg border border-gray-700/50 flex flex-col mt-4">
      <div className="bg-gray-800/40 p-3 flex items-center gap-2 border-b border-gray-700/50">
        <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
        <h3 className="font-bold text-indigo-300 text-sm">Channel Distribution</h3>
      </div>
      <div className="p-4 flex items-center gap-6">
        {/* Donut */}
        <div className="relative flex-shrink-0 w-20 h-20">
          <div
            className="w-full h-full rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          />
          {/* centre hole */}
          <div className="absolute inset-2 bg-gray-900 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-gray-300">{total}</span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1">
          {segments.map(s => (
            <div key={s.channel} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }}></div>
                <span className="text-gray-300 font-medium">{s.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-gray-400">{s.count}</span>
                <span className="text-[10px]" style={{ color: s.color }}>{s.pct.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChannelChart;
