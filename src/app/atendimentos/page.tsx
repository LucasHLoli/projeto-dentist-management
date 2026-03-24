'use client';

import { sampleAppointments } from '@/lib/data';
import { useState } from 'react';

export default function AtendimentosPage() {
  const [search, setSearch] = useState('');
  const [filterPlano, setFilterPlano] = useState('');

  const filtered = sampleAppointments.filter(a => {
    const matchSearch = a.paciente.toLowerCase().includes(search.toLowerCase());
    const matchPlano = !filterPlano || a.planoSaude === filterPlano;
    return matchSearch && matchPlano;
  });

  const getProcedimento = (a: typeof sampleAppointments[0]) => {
    return a.procedimentosParticular || a.procedimentosUniodonto || a.procedimentosCamed || a.procedimentosGeap || '—';
  };

  return (
    <div>
      <div className="page-header">
        <h1>Atendimentos</h1>
        <p>Registro de procedimentos odontológicos e HOF</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon">🦷</div>
          <div className="stat-card-label">Total Atendimentos</div>
          <div className="stat-card-value">1.135</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon">📋</div>
          <div className="stat-card-label">Com dados completos</div>
          <div className="stat-card-value">454</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon">🧹</div>
          <div className="stat-card-label">Com Limpeza</div>
          <div className="stat-card-value">{sampleAppointments.filter(a => a.limpeza).length}</div>
        </div>
      </div>

      <div className="filter-row">
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon">🔍</span>
          <input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: '180px' }} value={filterPlano} onChange={e => setFilterPlano(e.target.value)}>
          <option value="">Todos os planos</option>
          <option value="Particular">Particular</option>
          <option value="Uniodonto">Uniodonto</option>
          <option value="Camed">Camed</option>
          <option value="Geap">Geap</option>
        </select>
        <button className="btn btn-primary">+ Novo Atendimento</button>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Plano</th>
                <th>Procedimento</th>
                <th>Limpeza</th>
                <th>Recibo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>{a.data.split('-').reverse().join('/')}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.paciente}</td>
                  <td>
                    <span className={`badge ${
                      a.planoSaude === 'Particular' ? 'badge-amber' :
                      a.planoSaude === 'Uniodonto' ? 'badge-teal' :
                      a.planoSaude === 'Camed' ? 'badge-purple' : 'badge-rose'
                    }`}>
                      {a.planoSaude}
                    </span>
                  </td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getProcedimento(a)}
                  </td>
                  <td>{a.limpeza ? <span className="badge badge-emerald">Sim</span> : <span className="badge badge-rose">Não</span>}</td>
                  <td>{a.pediuRecibo ? <span className="badge badge-amber">Sim</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
