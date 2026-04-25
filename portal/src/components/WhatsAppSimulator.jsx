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

    const userMsg = { from: 'user', text: template.message.text?.body || 'Shared live location', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
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
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, replyMsg]);
          setSending(false);
        }, 1500);
      } else {
        throw new Error('Webhook failed');
      }
    } catch (e) {
      setTimeout(() => {
        setMessages(prev => [...prev, { from: 'aegis', text: 'Error connecting to AEGIS. Please try again.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        setSending(false);
      }, 1000);
    }
  };

  return (
    <div className="glass rounded-xl overflow-hidden shadow-lg border border-green-500/30 flex flex-col mt-4">
      <div className="bg-green-900/30 p-3 flex justify-between items-center border-b border-green-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold text-green-300 text-sm">WhatsApp Simulator</h3>
          <span className="text-[10px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded border border-green-600/40 font-bold uppercase">Demo Mode</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-black text-lg select-none">W</div>
        </div>
      </div>

      {/* Chat thread */}
      <div className="bg-[#0B141A] h-52 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-xs italic">Select a template below to send a mock emergency...</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs leading-relaxed shadow ${msg.from === 'user' ? 'bg-[#005C4B] text-white rounded-br-none' : 'bg-[#1F2C34] text-gray-200 rounded-bl-none'}`}>
              {msg.from === 'aegis' && <div className="text-green-400 text-[10px] font-bold mb-1">AEGIS System</div>}
              <p>{msg.text}</p>
              <div className={`text-[10px] mt-1 ${msg.from === 'user' ? 'text-green-300/70 text-right' : 'text-gray-500'}`}>{msg.time}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-[#1F2C34] px-3 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="p-3 bg-black/40 flex flex-col gap-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Quick Templates</p>
        <div className="flex flex-col gap-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              disabled={sending}
              onClick={() => sendMessage(t)}
              className={`text-left text-xs px-3 py-2 rounded border transition-all ${selectedTemplate === t.id && sending ? 'border-green-500 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-green-600 hover:bg-green-900/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="font-bold">{t.label}</span>
              <p className="text-gray-500 text-[10px] mt-0.5 truncate">{t.message.text?.body}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSimulator;
