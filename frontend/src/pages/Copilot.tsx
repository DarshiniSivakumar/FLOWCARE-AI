import React, { useState } from 'react';
import { api } from '../services/api';
import { MessageSquare, Send, Sparkles, AlertCircle } from 'lucide-react';

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

  const suggestionChips = [
    "Why is OT-02 delayed?",
    "Which surgeries are at risk?",
    "What is causing the bottleneck?",
    "What is the current CSSD status?"
  ];

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    
    // Add user message
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
        return <h3 key={i} className="text-base font-bold text-white mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('#### ')) {
        return <h4 key={i} className="text-sm font-bold text-white mt-3 mb-1">{line.replace('#### ', '')}</h4>;
      }
      if (line.startsWith('- ')) {
        // Handle bolding within bullet point
        const content = line.replace('- ', '');
        const parts = content.split('**');
        return (
          <li key={i} className="text-xs text-slate-300 ml-4 list-disc my-1.5 leading-relaxed">
            {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx} className="text-white font-bold">{part}</strong> : part)}
          </li>
        );
      }
      
      // Handle inline bolding **text**
      const parts = line.split('**');
      if (parts.length > 1) {
        return (
          <p key={i} className="text-xs text-slate-300 my-2 leading-relaxed">
            {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx} className="text-white font-bold">{part}</strong> : part)}
          </p>
        );
      }
      return <p key={i} className="text-xs text-slate-300 my-2 leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col justify-between bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
      
      {/* Copilot Header */}
      <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-hospital-600/10 text-hospital-400 rounded-xl">
            <Sparkles size={20} className="fill-hospital-400/20" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">FlowCare AI Copilot</h3>
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">operational assistant</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Ready</span>
        </div>
      </div>

      {/* Message window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, index) => (
          <div 
            key={index}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xl rounded-2xl p-5 ${
              msg.sender === 'user' 
                ? 'bg-hospital-600 text-white rounded-br-none shadow-lg' 
                : 'bg-slate-950 border border-slate-850 rounded-bl-none text-slate-300'
            }`}>
              {msg.sender === 'user' ? (
                <p className="text-xs font-semibold leading-relaxed">{msg.text}</p>
              ) : (
                <div className="space-y-1">
                  {renderMarkdown(msg.text)}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-950 border border-slate-850 rounded-2xl rounded-bl-none p-4 flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-hospital-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-hospital-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-hospital-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase">Analyzing live flows...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-slate-800 bg-slate-850 space-y-4">
        
        {/* Suggestion Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 select-none">
          {suggestionChips.map(chip => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              disabled={loading}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-[10px] text-slate-300 font-semibold transition-all hover:text-white shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input box */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Query rooms status, delay predictions or active bottlenecks..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-hospital-500 rounded-xl py-3 px-4 text-xs text-white placeholder-slate-500 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-hospital-600 hover:bg-hospital-500 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-lg active:scale-[0.98] shrink-0"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

    </div>
  );
}
