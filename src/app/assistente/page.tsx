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

const mockResponses: Record<string, string> = {
  'lucro': '📊 **Análise de Lucro**\n\nBaseado nos dados do DFC:\n\n| Mês | Lucro |\n|-----|-------|\n| Jun | R$ 7.410,19 |\n| Set | R$ 5.687,88 |\n| Dez | R$ 6.419,69 |\n\n**Total Anual:** R$ 40.485,86\n\nO mês de **junho** foi o mais lucrativo, com margem de 62.2%. Quer que eu gere um relatório detalhado?',
  'estoque': '📦 **Alerta de Estoque**\n\nItens com estoque crítico (≤ 3 unidades):\n\n• ⚠️ **Mepvacaína** — 3 unidades (validade: Ago/2025)\n• ⚠️ **Hipoclorito de Sódio** — 2 unidades (OK até Jan/2026)\n• ⚠️ **Pasta Profilática** — 1 unidade (validade: Dez/2025)\n\nRecomendo reabastecer esses itens o mais rápido possível. Deseja que eu gere um pedido de compra?',
  'retorno': '🔄 **Pacientes com Retorno Pendente**\n\nEncontrei 3 pacientes que precisam agendar retorno:\n\n1. **Ana Paula Vaz da Silva** — Última limpeza há 1 mês e 12 dias (Uniodonto)\n2. **Carlos Eduardo Silva Mendes** — Última limpeza há 3 meses e 5 dias (Uniodonto)\n3. **Maria José Santos** — Última limpeza há 6 meses (Particular)\n\nDeseja que eu prepare as mensagens de WhatsApp para envio?',
  'paciente': '👥 **Busca de Pacientes**\n\nAtualmente temos **263 pacientes** cadastrados.\n\nDistribuição por plano:\n• Particular: 109 pacientes\n• Uniodonto: 98 pacientes\n• Camed: 34 pacientes\n• Geap: 22 pacientes\n\n**55 prontuários** precisam ser atualizados. Quer que eu liste os desatualizados?',
};

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

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const lower = input.toLowerCase();
      let response = '🤔 Entendi sua pergunta! Em um sistema completo, eu consultaria o banco de dados para trazer a resposta exata.\n\nPor enquanto, experimente perguntar sobre:\n• Lucro/financeiro\n• Estoque\n• Retornos de pacientes\n• Dados de pacientes';

      for (const [key, value] of Object.entries(mockResponses)) {
        if (lower.includes(key)) {
          response = value;
          break;
        }
      }

      const assistantMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setIsTyping(false);
      setMessages(prev => [...prev, assistantMessage]);
    }, 1500);
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
