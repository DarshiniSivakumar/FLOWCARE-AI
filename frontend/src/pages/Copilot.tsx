import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { Send, Sparkles, Bot, User } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
}

export default function Copilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'assistant', text: "Hello! I am your FlowCare AI Operations Copilot. I analyze real-time hospital event streams, predict bottlenecks, and recommend scheduling solutions.\n\nAsk me questions like:\n- **'Why is OT-02 delayed?'**\n- **'Which surgeries are at risk?'**\n- **'What is causing the current bottleneck?'**\n- **'What is the current CSSD status?'**" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestionChips = [
    "Why is OT-02 delayed?",
    "Which surgeries are at risk?",
    "What is causing the bottleneck?",
    "What is the current CSSD status?"
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    setMessages(prev => [...prev, { sender: 'user', text: textToSend }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askCopilot(textToSend);
      setMessages(prev => [...prev, { sender: 'assistant', text: res.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { sender: 'assistant', text: "Sorry, I encountered an issue querying the database." }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-sm font-bold text-slate-900 mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('#### ')) {
        return <h4 key={i} className="text-xs font-bold text-slate-900 mt-3 mb-1">{line.replace('#### ', '')}</h4>;
      }
      if (line.startsWith('- ')) {
        const content = line.replace('- ', '');
        const parts = content.split('**');
        return (
          <li key={i} className="text-xs text-slate-700 ml-4 list-disc my-1.5 leading-relaxed">
            {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx} className="text-slate-900 font-bold">{part}</strong> : part)}
          </li>
        );
      }
      const parts = line.split('**');
      if (parts.length > 1) {
        return (
          <p key={i} className="text-xs text-slate-700 my-2 leading-relaxed">
            {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx} className="text-slate-900 font-bold">{part}</strong> : part)}
          </p>
        );
      }
      if (!line.trim()) return <div key={i} className="h-1" />;
      return <p key={i} className="text-xs text-slate-700 my-2 leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="space-y-0 flex flex-col h-[calc(100vh-10rem)]">

      {/* Header — matches light theme of other pages */}
      <div className="bg-white border border-slate-200 rounded-t-2xl px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-hospital-100 text-hospital-600 rounded-xl border border-hospital-200">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-lg leading-tight">FlowCare AI Copilot</h2>
            <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Operational Assistant</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-emerald-700 font-bold uppercase">Ready</span>
        </div>
      </div>

      {/* Suggestion chips bar */}
      <div className="bg-white border-x border-slate-200 px-6 py-3 flex gap-2 overflow-x-auto shrink-0 border-t border-slate-100">
        {suggestionChips.map(chip => (
          <button
            key={chip}
            onClick={() => handleSend(chip)}
            disabled={loading}
            className="px-3.5 py-1.5 bg-slate-50 hover:bg-hospital-50 border border-slate-200 hover:border-hospital-300 rounded-full text-[10px] text-slate-600 hover:text-hospital-700 font-semibold transition-all shrink-0"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message window */}
      <div className="flex-1 overflow-y-auto bg-slate-50 border-x border-slate-200 px-6 py-6 space-y-6">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-hospital-100 border border-hospital-200 flex items-center justify-center text-hospital-600 shrink-0 mt-1">
                <Bot size={16} />
              </div>
            )}

            <div className={`max-w-xl rounded-2xl p-4 shadow-sm ${
              msg.sender === 'user'
                ? 'bg-hospital-600 text-white rounded-br-none'
                : 'bg-white border border-slate-200 rounded-bl-none text-slate-800'
            }`}>
              {msg.sender === 'user' ? (
                <p className="text-xs font-semibold leading-relaxed">{msg.text}</p>
              ) : (
                <div className="space-y-0.5">
                  {renderMarkdown(msg.text)}
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                <User size={16} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start gap-3">
            <div className="w-8 h-8 rounded-full bg-hospital-100 border border-hospital-200 flex items-center justify-center text-hospital-600 shrink-0 mt-1">
              <Bot size={16} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-4 flex items-center gap-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-hospital-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-hospital-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-hospital-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase">Analyzing live flows...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border border-slate-200 rounded-b-2xl p-4 shadow-sm shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Query room status, delay predictions or active bottlenecks..."
            className="flex-1 bg-slate-50 border border-slate-300 focus:border-hospital-500 rounded-xl py-3 px-4 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-hospital-600 hover:bg-hospital-700 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-sm active:scale-[0.98] shrink-0"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

    </div>
  );
}
