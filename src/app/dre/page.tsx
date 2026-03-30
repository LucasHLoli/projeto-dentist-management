'use client';

import { dreData } from '@/lib/data';
import { useState } from 'react';

export default function DREPage() {
  const [year, setYear] = useState('2025');
  const data = year === '2025' ? dreData.revenue2025 : dreData.revenue2026;
  const total = data.reduce((a, b) => a + b, 0);
  const max = Math.max(...data);

  return (
    <div>
      <div className="page-header">
        <h1>DRE — Demonstrativo de Resultado</h1>
        <p>Análise de receitas por categoria e mês</p>
      </div>

      <div className="filter-row">
        <button className={`tab ${year === '2025' ? 'active' : ''}`} onClick={() => setYear('2025')}>2025</button>
        <button className={`tab ${year === '2026' ? 'active' : ''}`} onClick={() => setYear('2026')}>2026</button>
        <div style={{ marginLeft: 'auto', fontSize: '0.9rem' }}>
          Total Anual: <strong style={{ color: 'var(--accent-emerald)' }}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="glass-card-title" style={{ marginBottom: 'var(--space-lg)' }}>Receita Mensal — {year}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '200px' }}>
          {data.map((value, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {value > 0 ? `R$${(value / 1000).toFixed(1)}k` : ''}
              </span>
              <div style={{
                width: '100%',
                height: `${max > 0 ? (value / max) * 160 : 0}px`,
                background: value > 3000 ? 'var(--gradient-hero)' : value > 1000 ? 'var(--gradient-teal)' : 'rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                transition: 'height 0.5s ease',
                minHeight: value > 0 ? '4px' : '0',
              }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dreData.months[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th style={{ textAlign: 'right' }}>Receita</th>
                <th>% do Total</th>
                <th>Desempenho</th>
              </tr>
            </thead>
            <tbody>
              {data.map((value, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{dreData.months[i]}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td>{total > 0 ? ((value / total) * 100).toFixed(1) : '0'}%</td>
                  <td>
                    <div className="progress-bar" style={{ width: '150px' }}>
                      <div className="progress-bar-fill" style={{
                        width: `${max > 0 ? (value / max) * 100 : 0}%`,
                        background: 'var(--gradient-hero)',
                      }}/>
                    </div>
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
