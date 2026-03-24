'use client';

import { analyticsDFC } from '@/lib/data';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

export default function DFCPage() {
  const totalReceita = analyticsDFC.receita.reduce((a, b) => a + b, 0);
  const totalCusto = analyticsDFC.custo.reduce((a, b) => a + b, 0);
  const totalLucro = analyticsDFC.lucro.reduce((a, b) => a + b, 0);
  const max = Math.max(...analyticsDFC.receita, ...analyticsDFC.custo);

  return (
    <div>
      <div className="page-header">
        <h1>DFC — Fluxo de Caixa</h1>
        <p>Demonstrativo de entradas e saídas financeiras com análise mensal</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon"><DollarSign size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Receita Total</div>
          <div className="stat-card-value">R$ {totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-icon"><TrendingDown size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Custo Total</div>
          <div className="stat-card-value">R$ {totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon"><TrendingUp size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Lucro Líquido</div>
          <div className="stat-card-value">R$ {totalLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="glass-card-header">
          <div className="glass-card-title">Receita vs Custo Mensal</div>
          <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: '0.75rem' }}>
            <span><span style={{ color: 'var(--accent-emerald)' }}>●</span> Receita</span>
            <span><span style={{ color: 'var(--accent-rose)' }}>●</span> Custo</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '200px' }}>
          {analyticsDFC.months.map((month, i) => (
            <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '170px', width: '100%' }}>
                <div style={{
                  flex: 1,
                  height: `${max > 0 ? (analyticsDFC.receita[i] / max) * 160 : 0}px`,
                  background: 'var(--gradient-teal)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.5s ease',
                  minHeight: analyticsDFC.receita[i] > 0 ? '4px' : '0',
                }} />
                <div style={{
                  flex: 1,
                  height: `${max > 0 ? (analyticsDFC.custo[i] / max) * 160 : 0}px`,
                  background: 'var(--gradient-rose)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.5s ease',
                  minHeight: analyticsDFC.custo[i] > 0 ? '4px' : '0',
                  opacity: 0.7,
                }} />
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{month}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="glass-card" style={{ padding: 0 }}>
          <div style={{ padding: 'var(--space-lg)' }}>
            <div className="glass-card-title">Breakdown Mensal</div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th style={{ textAlign: 'right' }}>Receita</th>
                  <th style={{ textAlign: 'right' }}>Custo</th>
                  <th style={{ textAlign: 'right' }}>Lucro</th>
                </tr>
              </thead>
              <tbody>
                {analyticsDFC.months.map((month, i) => (
                  <tr key={month}>
                    <td style={{ fontWeight: 500 }}>{month}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-emerald)' }}>R$ {analyticsDFC.receita[i].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-rose)' }}>R$ {analyticsDFC.custo[i].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: analyticsDFC.lucro[i] >= 0 ? 'var(--accent-primary)' : 'var(--accent-rose)' }}>
                      R$ {analyticsDFC.lucro[i].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card">
          <div className="glass-card-title" style={{ marginBottom: 'var(--space-lg)' }}>Estrutura de Custos</div>
          {analyticsDFC.estruturaCustos.map((item, i) => {
            const maxCost = Math.max(...analyticsDFC.estruturaCustos.map(c => c.total));
            return (
              <div key={item.nome} style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span>{item.nome}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{
                    width: `${(item.total / maxCost) * 100}%`,
                    background: `hsl(${200 + i * 30}, 70%, 50%)`,
                  }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
