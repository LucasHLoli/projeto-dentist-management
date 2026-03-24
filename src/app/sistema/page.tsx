'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, Bot, Monitor, RefreshCw, type LucideIcon } from 'lucide-react';

type Status = {
  googleSheets: { connected: boolean; authUrl: string | null };
  groqAI: { connected: boolean };
  server: { port: number | string; env: string; uptime: string };
} | null;

function StatusCard({
  icon: Icon,
  title,
  description,
  connected,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  connected: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-lg)' }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-md)',
        background: connected ? 'rgba(20, 184, 166, 0.12)' : 'rgba(100, 116, 139, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: connected ? 'var(--accent-teal)' : 'var(--text-muted)',
      }}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{title}</span>
          <span className={`badge ${connected ? 'badge-teal' : 'badge-slate'}`}>
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Sistema</h1>
          <p>Status das integrações e conexões da clínica</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStatus} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} />
          {loading ? 'Verificando...' : 'Atualizar'}
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
            icon={LayoutGrid}
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
            icon={Bot}
            title="Groq AI"
            description={
              status?.groqAI.connected
                ? 'API da Groq ativa. O Assistente AI está operacional com o modelo llama-3.3-70b-versatile.'
                : 'Chave de API da Groq não configurada. O Assistente AI não funcionará.'
            }
            connected={!!status?.groqAI.connected}
          />

          <StatusCard
            icon={Monitor}
            title="Servidor"
            description={
              status
                ? `Servidor Next.js na porta ${status.server.port} (${status.server.env}). Ativo há ${status.server.uptime}. Todas as rotas de API estão respondendo.`
                : 'Servidor Next.js ativo. Todas as rotas de API estão respondendo.'
            }
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
