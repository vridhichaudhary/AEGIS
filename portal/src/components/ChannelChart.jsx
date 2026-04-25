import React, { useMemo } from 'react';

const CHANNEL_CONFIG = {
  whatsapp: { label: 'WhatsApp', color: '#3B82F6', bg: 'badge-info' }, // Unified with design system info
  voice_call: { label: '112 Call', color: '#3B82F6', bg: 'badge-blue' },
  voice_upload: { label: 'Audio Upload', color: '#A855F7', bg: 'badge-purple' },
  operator: { label: 'Operator', color: '#9CA3AF', bg: 'badge-muted' },
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

  let cumulativePercent = 0;
  const segments = Object.entries(counts).map(([channel, count]) => {
    const pct = (count / total) * 100;
    const cfg = CHANNEL_CONFIG[channel] || { label: channel, color: '#9CA3AF' };
    const start = cumulativePercent;
    cumulativePercent += pct;
    return { channel, count, pct, color: cfg.color, label: cfg.label, start };
  });

  const gradient = segments.map(s => `${s.color} ${s.start.toFixed(1)}% ${(s.start + s.pct).toFixed(1)}%`).join(', ');

  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface overflow-hidden">
      <div className="section-header">
        <span>Channel Distribution</span>
      </div>
      <div className="p-3 flex items-center gap-4">
        <div className="relative flex-shrink-0 w-16 h-16">
          <div
            className="w-full h-full rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
          />
          <div className="absolute inset-1.5 bg-aegis-bg-surface rounded-full flex items-center justify-center">
            <span className="text-[10px] mono font-bold text-aegis-text-primary">{total}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          {segments.map(s => (
            <div key={s.channel} className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                <span className="text-aegis-text-secondary font-medium">{s.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="mono text-aegis-text-muted">{s.count}</span>
                <span className="mono font-bold" style={{ color: s.color }}>{s.pct.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChannelChart;
