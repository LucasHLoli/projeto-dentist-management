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

const mockResponses: Record<string, string> = {
  'lucro': '📊 **Lucro por Mês (2025)**\n\n• Jun: R$ 7.410,19 ✨ (melhor)\n• Dez: R$ 6.419,69\n• Set: R$ 5.687,88\n\n**Total Anual:** R$ 40.485,86\n\nQuer um relatório completo?',
  'estoque': '📦 **Alerta de Estoque Baixo**\n\n⚠️ Mepvacaína — 3 un.\n⚠️ Hipoclorito — 2 un.\n⚠️ Pasta Profilática — 1 un.\n\nDeseja que eu gere um pedido?',
  'retorno': '🔄 **Retornos Pendentes**\n\n1. Ana Paula — 1m e 12d\n2. Carlos Eduardo — 3m e 5d\n3. Maria José — 6m e 2d\n\nPreparo as mensagens de WhatsApp?',
  'paciente': '👥 **263 pacientes** cadastrados\n\nPor plano:\n• Particular: 109\n• Uniodonto: 98\n• Camed: 34\n• Geap: 22\n\n55 prontuários desatualizados.',
  'busque': '🔍 Buscando...\n\n**Ana Beatriz Fernandes Ramos**\n📞 85 991234567\n📧 anabeatriz@gmail.com\n🏥 Particular\n🦷 Queixa: Clareamento\n✅ Prontuário atualizado',
  'backup': '💾 **Backup executado!**\n\nTodas as abas foram salvas em `backups/`.\nPróximo automático: 01:00.',
  'agenda': '📅 **Agenda de Hoje**\n\n09:00 — Ana Beatriz (Clareamento)\n10:30 — Carlos Eduardo (Canal)\n14:00 — Maria José (Limpeza)\n\n3 consultas agendadas.',
};

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isMinimized) {
      document.body.classList.add('chat-minimized');
    } else {
      document.body.classList.remove('chat-minimized');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('chat-minimized');
    };
  }, [isMinimized]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const query = input;
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const lower = query.toLowerCase();
      let response = '🤔 Entendi! Com o sistema conectado ao Google Sheets, eu poderei consultar dados reais.\n\nExperimente:\n• lucro, estoque, retorno\n• busque [nome]\n• backup, agenda';

      for (const [key, value] of Object.entries(mockResponses)) {
        if (lower.includes(key)) {
          response = value;
          break;
        }
      }

      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }]);
    }, 1200);
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
            <div className="ai-msg-content">{msg.content}</div>
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
