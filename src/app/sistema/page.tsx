'use client';

import { useState, useEffect } from 'react';

type Status = {
  googleSheets: { connected: boolean; authUrl: string | null };
  groqAI: { connected: boolean };
} | null;

function StatusCard({
  icon,
  title,
  description,
  connected,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  description: string;
  connected: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-lg)' }}>
      <div style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{title}</span>
          <span style={{
            padding: '2px 10px',
            borderRadius: '99px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.12)',
            color: connected ? 'var(--accent-teal)' : 'var(--text-muted)',
          }}>
            {connected ? '● Conectado' : '○ Não conectado'}
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: actionLabel ? 'var(--space-md)' : 0 }}>
          {description}
        </p>
        {actionLabel && onAction && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onAction}
            style={{ fontSize: '0.8rem' }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SistemaPage() {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSheets = () => {
    if (status?.googleSheets?.authUrl) {
      window.open(status.googleSheets.authUrl, '_blank');
    }
  };

  const allConnected = status?.googleSheets.connected && status?.groqAI.connected;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sistema</h1>
          <p>Status das integrações e conexões da clínica</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStatus} disabled={loading}>
          {loading ? 'Verificando...' : '🔄 Atualizar'}
        </button>
      </div>

      <div className="glass-card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: loading ? 'var(--text-muted)' : allConnected ? 'var(--accent-teal)' : 'var(--accent-amber, #f59e0b)',
          boxShadow: loading ? 'none' : allConnected ? '0 0 8px var(--accent-teal)' : '0 0 8px #f59e0b',
        }} />
        <span style={{ fontWeight: 500 }}>
          {loading ? 'Verificando status...' : allConnected ? 'Todas as integrações ativas' : 'Uma ou mais integrações precisam de atenção'}
        </span>
      </div>

      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
          Carregando status...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <StatusCard
            icon="📊"
            title="Google Sheets"
            description={
              status?.googleSheets.connected
                ? 'Planilha conectada. Os dados de Pacientes, Atendimentos e Financeiro estão sendo sincronizados.'
                : 'Planilha não conectada. Clique em Conectar para autorizar o acesso ao Google Sheets.'
            }
            connected={!!status?.googleSheets.connected}
            actionLabel={status?.googleSheets.connected ? undefined : 'Conectar Google Sheets →'}
            onAction={status?.googleSheets.connected ? undefined : handleConnectSheets}
          />

          <StatusCard
            icon="🤖"
            title="Groq AI"
            description={
              status?.groqAI.connected
                ? 'API da Groq ativa. O Assistente AI está operacional com o modelo llama-3.3-70b-versatile.'
                : 'Chave de API da Groq não configurada. O Assistente AI não funcionará.'
            }
            connected={!!status?.groqAI.connected}
          />

          <StatusCard
            icon="🖥️"
            title="Servidor"
            description="Servidor Next.js rodando localmente na porta 5000. Todas as rotas de API estão ativas."
            connected={true}
          />
        </div>
      )}

      {status?.googleSheets.connected && (
        <div className="glass-card" style={{ marginTop: 'var(--space-lg)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>Reconectar Google Sheets</div>
          Se precisar revogar e reconectar com outra conta, autorize novamente pelo link abaixo:
          <br />
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleConnectSheets(); }}
            style={{ color: 'var(--accent-purple)', textDecoration: 'underline', marginTop: '6px', display: 'inline-block' }}
          >
            Abrir fluxo de autorização Google →
          </a>
        </div>
      )}
    </div>
  );
}
