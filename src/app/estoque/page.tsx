'use client';

import { sampleStock } from '@/lib/data';
import { useState } from 'react';
import { Package, AlertTriangle, Clock, Search, Plus, Check, X } from 'lucide-react';

export default function EstoquePage() {
  const [search, setSearch] = useState('');
  const filtered = sampleStock.filter(s => s.insumo.toLowerCase().includes(search.toLowerCase()));
  const lowStock = sampleStock.filter(s => s.estoqueReal <= 3);
  const expiringSoon = sampleStock.filter(s => s.mesesAteValidade <= 6);

  return (
    <div>
      <div className="page-header">
        <h1>Estoque</h1>
        <p>Controle de insumos, validades e reabastecimento — {sampleStock.length} itens cadastrados</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon"><Package size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Total de Itens</div>
          <div className="stat-card-value">{sampleStock.length}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-icon"><AlertTriangle size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Estoque Baixo (≤3)</div>
          <div className="stat-card-value">{lowStock.length}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon"><Clock size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Vencendo em 6 meses</div>
          <div className="stat-card-value">{expiringSoon.length}</div>
        </div>
      </div>

      <div className="filter-row">
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon"><Search size={14} /></span>
          <input placeholder="Buscar insumo..." value={search} onChange={e => setSearch(e.target.value)} suppressHydrationWarning />
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> Novo Item
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th style={{ textAlign: 'center' }}>Estoque</th>
                <th>Nível</th>
                <th>Validade</th>
                <th style={{ textAlign: 'center' }}>Usos Histórico</th>
                <th>Renovou</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const stockLevel = s.estoqueReal <= 3 ? 'critical' : s.estoqueReal <= 10 ? 'warning' : 'good';
                const stockPercent = Math.min(100, (s.estoqueReal / (s.estoqueContado || 1)) * 100);

                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.insumo}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{s.estoqueReal}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> / {s.estoqueContado}</span>
                    </td>
                    <td>
                      <div className="progress-bar" style={{ width: '120px' }}>
                        <div className="progress-bar-fill" style={{
                          width: `${stockPercent}%`,
                          background: stockLevel === 'critical' ? 'var(--accent-rose)' : stockLevel === 'warning' ? 'var(--accent-amber)' : 'var(--accent-emerald)'
                        }}/>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.mesesAteValidade <= 6 ? 'badge-rose' : 'badge-emerald'}`}>
                        {s.mesesAteValidade}m restantes
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{s.quantidadeUsadasHistoria}</td>
                    <td>{s.renovou ? <span className="badge badge-emerald"><Check size={10} /> Sim</span> : <span className="badge badge-rose"><X size={10} /> Não</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
