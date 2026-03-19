'use client';

import { sampleReturns } from '@/lib/data';
import { useState } from 'react';

export default function RetornosPage() {
  const [search, setSearch] = useState('');
  const filtered = sampleReturns.filter(r => r.paciente.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1>Retornos</h1>
        <p>Gestão de retorno de pacientes com envio de mensagens WhatsApp automáticas</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon">🔄</div>
          <div className="stat-card-label">Total na Lista</div>
          <div className="stat-card-value">111</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon">📅</div>
          <div className="stat-card-label">Aniversários Próximos</div>
          <div className="stat-card-value">{sampleReturns.filter(r => r.semanasAteAniversario <= 4).length}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon">💬</div>
          <div className="stat-card-label">Mensagens Pendentes</div>
          <div className="stat-card-value">{sampleReturns.length}</div>
        </div>
      </div>

      <div className="filter-row">
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon">🔍</span>
          <input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {filtered.map(r => (
          <div key={r.id} className="glass-card" style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'flex-start' }}>
            <div className="avatar avatar-lg" style={{ background: `hsl(${r.id * 90}, 60%, 25%)`, color: `hsl(${r.id * 90}, 80%, 70%)` }}>
              {r.paciente.charAt(0)}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>{r.paciente}</span>
                <span className={`badge ${r.planoSaude === 'Particular' ? 'badge-amber' : 'badge-teal'}`}>{r.planoSaude}</span>
                {!r.inativo && <span className="badge badge-emerald">Ativo</span>}
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-xl)', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                <span>🧹 {r.limpeza} limpezas</span>
                <span>⏱️ Última: {r.tempoUltimaLimpeza}</span>
                <span>🎂 {r.idade} anos</span>
                <span>📅 Aniversário em {r.semanasAteAniversario} semanas</span>
              </div>

              <div style={{ background: 'var(--bg-glass)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line', maxHeight: '80px', overflow: 'hidden' }}>
                💬 {r.textoWhatsapp}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', flexShrink: 0 }}>
              <a href={`https://${r.whatsappLink}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}>
                📱 WhatsApp
              </a>
              <button className="btn btn-sm btn-secondary">📋 Copiar Texto</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
