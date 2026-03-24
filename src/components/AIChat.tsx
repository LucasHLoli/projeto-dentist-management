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
    content: '👋 Olá Dra.! Estou aqui para ajudar.\n\nPosso consultar dados, gerar relatórios e executar ações quando você pedir.\n\n💡 Exemplos:\n• "Busque o paciente Ana Beatriz"\n• "Qual o lucro de junho?"\n• "Estoque baixo"\n• "Retornos pendentes"',
    timestamp: INITIAL_TIMESTAMP,
  },
];

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isMinimized) {
      document.body.classList.add('chat-minimized');
    } else {
      document.body.classList.remove('chat-minimized');
    }
    return () => {
      document.body.classList.remove('chat-minimized');
    };
  }, [isMinimized]);

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

  if (isMinimized) {
    return (
      <div className="ai-chat-minimized" onClick={() => setIsMinimized(false)}>
        <span>🤖</span>
        <span className="ai-chat-minimized-dot" />
      </div>
    );
  }

  return (
    <aside className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="ai-chat-header-info">
          <div className="ai-chat-header-dot" />
          <span className="ai-chat-header-title">Assistente AI</span>
        </div>
        <button className="ai-chat-minimize" onClick={() => setIsMinimized(true)} title="Minimizar">
          ─
        </button>
      </div>

      <div className="ai-chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`ai-msg ${msg.role}`}>
            <div className="ai-msg-content" style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
            <div className="ai-msg-time">
              {isMounted ? msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="ai-msg assistant">
            <div className="ai-msg-content ai-typing">
              <span>●</span><span>●</span><span>●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-chat-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Pergunte à AI..."
          disabled={isTyping}
        />
        <button onClick={handleSend} disabled={isTyping || !input.trim()}>
          ➤
        </button>
      </div>
    </aside>
  );
}
