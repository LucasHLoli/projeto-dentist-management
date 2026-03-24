'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INITIAL_TIMESTAMP = new Date(0);

const initialMessages: Message[] = [
  {
    id: 1,
    role: 'assistant',
    content: '👋 Olá! Sou o assistente de gestão da DentFlow.\n\nPosso te ajudar com:\n\n• 📊 **Relatórios financeiros** — "Qual foi o lucro de junho?"\n• 👥 **Busca de pacientes** — "Encontre pacientes do plano Uniodonto"\n• 📦 **Estoque** — "Quais insumos estão com estoque baixo?"\n• 🔄 **Retornos** — "Quais pacientes precisam de retorno?"\n• 📈 **Análises** — "Compare receita 2025 vs 2026"\n\nComo posso ajudar?',
    timestamp: INITIAL_TIMESTAMP,
  },
];

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const history = newMessages
        .filter(m => m.id !== 1)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'Erro ao obter resposta.';

      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: '⚠️ Erro de conexão. Tente novamente.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>🤖 Assistente AI</h1>
        <p>Converse com a inteligência artificial para gerenciar sua clínica</p>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
              <div style={{ fontSize: '0.65rem', color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', marginTop: '6px' }}>
                {isMounted ? msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="chat-message assistant" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ animation: 'pulse 1s infinite' }}>●</span>
              <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
              <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre pacientes, financeiro, estoque..."
            disabled={isTyping}
          />
          <button onClick={handleSend} disabled={isTyping || !input.trim()}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
