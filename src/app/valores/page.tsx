'use client';

import { useState } from 'react';
import { particularProcedures } from '@/lib/procedures';
import { Search, DollarSign } from 'lucide-react';

export default function ValoresPage() {
  const [search, setSearch] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');

  const grupos = Array.from(new Set(particularProcedures.map(p => p.grupo).filter(Boolean))) as string[];

  const filtered = particularProcedures.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.grupo?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchGrupo = !filterGrupo || p.grupo === filterGrupo;
    return matchSearch && matchGrupo;
  });

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div>
      <div className="page-header">
        <h1>Valores dos Procedimentos</h1>
        <p>Tabela Particular 2025 / 2026</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon"><DollarSign size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Total de Procedimentos</div>
          <div className="stat-card-value">{particularProcedures.length}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon"><DollarSign size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Grupos</div>
          <div className="stat-card-value">{grupos.length}</div>
        </div>
      </div>

      <div className="filter-row">
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon"><Search size={14} /></span>
          <input
            placeholder="Buscar procedimento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            suppressHydrationWarning
          />
        </div>
        <select
          className="form-input"
          style={{ width: '200px' }}
          value={filterGrupo}
          onChange={e => setFilterGrupo(e.target.value)}
        >
          <option value="">Todos os grupos</option>
          {grupos.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Procedimento</th>
                <th>Grupo</th>
                <th style={{ textAlign: 'right' }}>Valor 2025</th>
                <th style={{ textAlign: 'right' }}>Valor 2026</th>
                <th style={{ textAlign: 'right' }}>Variação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const variacao = ((p.valor2026 - p.valor2025) / p.valor2025) * 100;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.nome}</td>
                    <td>
                      <span className="badge badge-teal">{p.grupo}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.valor2025)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-teal)' }}>{fmt(p.valor2026)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="badge badge-emerald">+{variacao.toFixed(0)}%</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Nenhum procedimento encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
