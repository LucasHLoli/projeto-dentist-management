'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, Bot, Monitor, RefreshCw, type LucideIcon } from 'lucide-react';

type Status = {
  googleSheets: { connected: boolean; authUrl: string };
  groqAI: { connected: boolean };
  server: { port: number | string; env: string; uptime: string };
} | null;

function StatusCard({
  icon: Icon,
  title,
  connected,
  children,
}: {
  icon: LucideIcon;
  title: string;
  connected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-lg)' }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: 'var(--radius-md)',
        background: connected ? 'rgba(20, 184, 166, 0.12)' : 'rgba(239, 68, 68, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        color: connected ? 'var(--accent-teal)' : '#ef4444',
      }}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{title}</span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 500, padding: '2px 8px', borderRadius: '999px',
            background: connected ? 'rgba(20, 184, 166, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: connected ? 'var(--accent-teal)' : '#ef4444',
          }}>
            {connected ? '● Conectado' : '○ Não conectado'}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SistemaPage() {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status');
      setStatus(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const allConnected = status?.googleSheets.connected && status?.groqAI.connected;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Sistema</h1>
          <p>Status das integrações e conexões da clínica</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStatus} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          {loading ? 'Verificando...' : 'Atualizar'}
        </button>
      </div>

      {/* Status geral */}
      <div className="glass-card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: loading ? 'var(--text-muted)' : allConnected ? 'var(--accent-teal)' : '#f59e0b',
          boxShadow: loading ? 'none' : allConnected ? '0 0 8px var(--accent-teal)' : '0 0 8px #f59e0b',
        }} />
        <span style={{ fontWeight: 500 }}>
          {loading ? 'Verificando conexões...' : allConnected ? 'Todas as integrações ativas' : 'Uma ou mais integrações precisam de atenção'}
        </span>
      </div>

      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
          Verificando conexões...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          {/* Google Sheets */}
          <StatusCard icon={LayoutGrid} title="Google Sheets" connected={!!status?.googleSheets.connected}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>
              {status?.googleSheets.connected
                ? 'Planilha conectada. Prontuários dos pacientes estão sendo sincronizados.'
                : 'Token expirado ou não autorizado. Clique abaixo para autenticar com o Google.'}
            </p>
            {status?.googleSheets.authUrl && (
              <a
                href={status.googleSheets.authUrl}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: status.googleSheets.connected ? 'rgba(100,116,139,0.15)' : 'var(--accent-teal)',
                  color: status.googleSheets.connected ? 'var(--text-muted)' : '#000',
                  fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
                }}
              >
                {status.googleSheets.connected ? '↺ Reconectar Google Sheets' : '→ Autorizar Google Sheets'}
              </a>
            )}
          </StatusCard>

          {/* Groq AI */}
          <StatusCard icon={Bot} title="Groq AI" connected={!!status?.groqAI.connected}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {status?.groqAI.connected
                ? 'API da Groq ativa. Assistente AI operacional com llama-3.3-70b-versatile.'
                : <>Chave não configurada. Adicione <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4 }}>GROQ_API_KEY</code> no arquivo <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4 }}>.env.local</code>.</>}
            </p>
          </StatusCard>

          {/* Servidor */}
          <StatusCard icon={Monitor} title="Servidor" connected={true}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {status
                ? `Next.js na porta ${status.server.port} (${status.server.env}) · Ativo há ${status.server.uptime}`
                : 'Servidor Next.js ativo.'}
            </p>
          </StatusCard>

        </div>
      )}
    </div>
  );
}
