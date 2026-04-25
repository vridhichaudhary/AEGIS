import React, { useState } from 'react';

const TEMPLATES = [
  {
    id: 'accident',
    label: '🚗 Road Accident',
    message: { type: 'text', text: { body: 'bhai bahut bada accident hua hai sector 14 mein, 3 log ghayil hain, jaldi ambulance bhejo!' } }
  },
  {
    id: 'fire',
    label: '🔥 Building Fire',
    message: { type: 'text', text: { body: 'fire in a building near connaught place, 5th floor is on fire, people are trapped' } }
  },
  {
    id: 'medical_location',
    label: '🏥 Medical + Location',
    message: { type: 'location', text: { body: 'meri maa ko heart attack aa gaya hai, please help!' }, location: { latitude: 28.6304, longitude: 77.2177 } }
  }
];

const WhatsAppSimulator = () => {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

  const sendMessage = async (template) => {
    if (sending) return;
    setSending(true);
    setSelectedTemplate(template.id);

    const userMsg = { from: 'user', text: template.message.text?.body || 'Shared live location', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) };
    setMessages(prev => [...prev, userMsg]);

    try {
      const payload = {
        from: '919876543210',
        type: template.message.type,
        text: template.message.text,
        ...(template.message.location && { location: template.message.location })
      };
      const res = await fetch(`${apiBase}/api/v1/webhook/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setTimeout(() => {
          const replyMsg = {
            from: 'aegis',
            text: data.whatsapp_reply || `Emergency received. AEGIS ID: ${data.incident_id?.slice(0, 8).toUpperCase()}. Resources dispatched.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          };
          setMessages(prev => [...prev, replyMsg]);
          setSending(false);
        }, 1200);
      } else {
        throw new Error('Webhook failed');
      }
    } catch (e) {
      setTimeout(() => {
        setMessages(prev => [...prev, { from: 'aegis', text: 'Error connecting to AEGIS.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) }]);
        setSending(false);
      }, 1000);
    }
  };

  return (
    <div className="card-flush flex flex-col bg-aegis-bg-surface overflow-hidden">
      <div className="section-header flex justify-between items-center">
        <span>WhatsApp Channel</span>
        <span className="badge badge-whatsapp badge-xs">ACTIVE</span>
      </div>

      <div className="bg-aegis-bg-base/50 h-48 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-aegis-text-muted text-[10px] uppercase tracking-widest opacity-50 italic text-center">
            Awaiting WhatsApp transmissions...
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-2 py-1.5 rounded-lg text-[11px] leading-relaxed border ${
              msg.from === 'user' 
                ? 'bg-[#005C4B]/20 border-green-500/30 text-green-100 rounded-br-none' 
                : 'bg-aegis-bg-elevated border-aegis-border text-aegis-text-secondary rounded-bl-none'
            }`}>
              {msg.from === 'aegis' && <div className="text-aegis-low text-[9px] font-bold mb-0.5 mono">AEGIS SYSTEM</div>}
              <p>{msg.text}</p>
              <div className={`text-[8px] mt-1 mono ${msg.from === 'user' ? 'text-green-500/70 text-right' : 'text-aegis-text-muted'}`}>{msg.time}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-aegis-bg-elevated px-2 py-1.5 rounded border border-aegis-border rounded-bl-none">
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map(delay => (
                  <div key={delay} className="w-1 h-1 bg-aegis-text-muted rounded-full animate-bounce" style={{animationDelay:`${delay}ms`}}></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-aegis-bg-elevated/30 border-t border-aegis-border flex flex-col gap-2">
        <span className="text-[9px] font-bold text-aegis-text-muted uppercase tracking-widest">Mock Ingestion Templates</span>
        <div className="grid grid-cols-1 gap-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              disabled={sending}
              onClick={() => sendMessage(t)}
              className={`btn btn-xs btn-ghost text-left flex flex-col items-start py-1.5 h-auto ${selectedTemplate === t.id && sending ? 'border-aegis-low/50 bg-aegis-low/5' : ''}`}
            >
              <span className="font-bold text-[10px]">{t.label}</span>
              <p className="text-aegis-text-muted text-[9px] truncate w-full">{t.message.text?.body}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSimulator;
