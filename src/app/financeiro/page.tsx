'use client';

import { sampleFinancials } from '@/lib/data';
import { useState } from 'react';

export default function FinanceiroPage() {
  const [search, setSearch] = useState('');

  const totalOrcamento = sampleFinancials.reduce((a, b) => a + b.orcamento, 0);
  const totalCusto = sampleFinancials.reduce((a, b) => a + b.custoProcedimento, 0);
  const totalLiquido = sampleFinancials.reduce((a, b) => a + b.resultadoLiquido, 0);
  const margemMedia = sampleFinancials.filter(f => f.margemOperacional > 0).reduce((a, b) => a + b.margemOperacional, 0) / sampleFinancials.filter(f => f.margemOperacional > 0).length;

  const filtered = sampleFinancials.filter(f => f.paciente.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1>Análise Financeira</h1>
        <p>Controle detalhado de receitas, custos e margens por procedimento</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-card-icon">💰</div>
          <div className="stat-card-label">Orçamento Total</div>
          <div className="stat-card-value">R$ {totalOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-icon">📉</div>
          <div className="stat-card-label">Custo Total</div>
          <div className="stat-card-value">R$ {totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-card-icon">📈</div>
          <div className="stat-card-label">Resultado Líquido</div>
          <div className="stat-card-value">R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon">📊</div>
          <div className="stat-card-label">Margem Média</div>
          <div className="stat-card-value">{(margemMedia * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div className="filter-row">
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon">🔍</span>
          <input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Plano</th>
                <th>Pagamento</th>
                <th style={{ textAlign: 'right' }}>Orçamento</th>
                <th style={{ textAlign: 'right' }}>Custo</th>
                <th style={{ textAlign: 'right' }}>Resultado</th>
                <th style={{ textAlign: 'right' }}>Margem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id}>
                  <td>{new Date(f.data).toLocaleDateString('pt-BR')}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.paciente}</td>
                  <td><span className={`badge ${f.plano === 'Particular' ? 'badge-amber' : f.plano === 'Uniodonto' ? 'badge-teal' : f.plano === 'Camed' ? 'badge-purple' : 'badge-rose'}`}>{f.plano}</span></td>
                  <td>{f.modalidadePagamento || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>R$ {f.orcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right', color: 'var(--accent-rose)' }}>R$ {f.custoProcedimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: f.resultadoLiquido >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    R$ {f.resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {f.margemOperacional > 0 ? (
                      <span className="badge badge-emerald">{(f.margemOperacional * 100).toFixed(0)}%</span>
                    ) : (
                      <span className="badge badge-rose">0%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
