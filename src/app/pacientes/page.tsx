'use client';

import { useState, useEffect } from 'react';
import { PRONTUARIO_COLUMNS, COLUMN_LABELS, COLUMN_GROUPS } from '@/lib/google-config';

// Interface for Google Sheets rows
type PatientRecord = Record<string, string>;

function PatientModal({ patient, onClose, onUpdate }: { patient: PatientRecord; onClose: () => void; onUpdate: (rowIndex: string, colIndex: number, value: string) => Promise<void> }) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [localPatient, setLocalPatient] = useState(patient);

  const handleEditClick = (colName: string, currentValue: string) => {
    setEditingField(colName);
    setEditValue(currentValue);
  };

  const handleSave = async (colName: string) => {
    if (editValue === localPatient[colName]) {
      setEditingField(null);
      return;
    }

    setIsSaving(true);
    const colIndex = PRONTUARIO_COLUMNS.indexOf(colName);
    
    try {
      await onUpdate(localPatient._rowIndex, colIndex, editValue);
      setLocalPatient(prev => ({ ...prev, [colName]: editValue }));
      setEditingField(null);
    } catch (err) {
      alert('Erro ao salvar no Google Sheets');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 'calc(-1 * var(--space-xl, 2rem))', background: 'var(--bg-secondary)', padding: 'var(--space-xl, 2rem) var(--space-xl, 2rem) 1rem var(--space-xl, 2rem)', margin: 'calc(-1 * var(--space-xl, 2rem)) calc(-1 * var(--space-xl, 2rem)) var(--space-xl, 2rem) calc(-1 * var(--space-xl, 2rem))', zIndex: 10, borderBottom: '1px solid var(--border-glass)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0' }}>
          <div>
            <div className="modal-title">{localPatient['Nome completo:'] || 'Paciente sem nome'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Linha: {localPatient._rowIndex} • Cadastrado em: {localPatient['Carimbo de data/hora']}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginTop: 'var(--space-md)' }}>
          {COLUMN_GROUPS.map(group => (
            <div key={group.title} style={{ marginBottom: 'var(--space-xl)' }}>
              <div className="glass-card-title" style={{ marginBottom: 'var(--space-md)', color: 'var(--accent-teal)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                {group.title}
              </div>
              
              <div className="grid-2">
                {group.columns.map(colIndex => {
                  const colName = PRONTUARIO_COLUMNS[colIndex];
                  const label = COLUMN_LABELS[colName] || colName;
                  const value = localPatient[colName] || '';
                  const isEditing = editingField === colName;

                  return (
                    <div key={colName} style={{ background: 'var(--bg-glass)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{label}</span>
                        {!isEditing && (
                          <button 
                            onClick={() => handleEditClick(colName, value)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            ✎ Editar
                          </button>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input 
                            autoFocus
                            className="form-input" 
                            style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave(colName)}
                            suppressHydrationWarning
                          />
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => handleSave(colName)}
                            disabled={isSaving}
                            style={{ padding: '0 8px' }}
                          >
                            {isSaving ? '...' : '✓'}
                          </button>
                          <button 
                            className="btn btn-sm btn-secondary" 
                            onClick={() => setEditingField(null)}
                            disabled={isSaving}
                            style={{ padding: '0 8px' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, minHeight: '20px', whiteSpace: 'pre-wrap' }}>
                          {value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PacientesPage() {
  const [search, setSearch] = useState('');
  const [filterPlano, setFilterPlano] = useState('');
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthenticated, setNotAuthenticated] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setNotAuthenticated(false);
    try {
      const res = await fetch('/api/sheets?sheet=Prontuário');
      const json = await res.json();
      
      if (res.status === 401) {
        setNotAuthenticated(true);
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      
      // Sort by newest first (descending row index)
      const sorted = json.data.sort((a: any, b: any) => Number(b._rowIndex) - Number(a._rowIndex));
      setPatients(sorted);
    } catch (err: any) {
      // Silent fail — connection issues handled via /sistema page
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (rowIndex: string, colIndex: number, value: string) => {
    const res = await fetch('/api/sheets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: 'Prontuário', row: Number(rowIndex), col: colIndex, value }),
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    // Update local state without refetching
    setPatients(prev => prev.map(p => {
      if (p._rowIndex === rowIndex) {
        return { ...p, [PRONTUARIO_COLUMNS[colIndex]]: value };
      }
      return p;
    }));
  };

  const filtered = patients.filter(p => {
    const nome = p['Nome completo:'] || '';
    const cpf = p['CPF:'] || '';
    const plano = p['Qual o plano de saúde?'] || '';
    
    const matchSearch = nome.toLowerCase().includes(search.toLowerCase()) || cpf.includes(search);
    const matchPlano = !filterPlano || plano === filterPlano;
    return matchSearch && matchPlano;
  });

  const planos = [...new Set(patients.map(p => p['Qual o plano de saúde?'] || 'Sem Plano').filter(Boolean))];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Pacientes</h1>
          <p>Gestão de prontuários com sincronização Google Sheets — {patients.length} registros conectados</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
          {loading ? 'Sincronizando...' : '🔄 Sincronizar'}
        </button>
      </div>

      {notAuthenticated && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: 'var(--space-xl)', textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔗</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Planilha não conectada</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
            Para carregar os prontuários, conecte a planilha Google na página de Sistema.
          </div>
          <a href="/sistema" style={{ display: 'inline-block', padding: '8px 20px', background: 'var(--accent-purple)', color: '#fff', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            Ir para Sistema →
          </a>
        </div>
      )}

      <div className="filter-row">
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon">🔍</span>
          <input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            suppressHydrationWarning
          />
        </div>
        <select className="form-input" style={{ width: '180px' }} value={filterPlano} onChange={e => setFilterPlano(e.target.value)}>
          <option value="">Todos os planos</option>
          {planos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        {loading && patients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ animation: 'pulse 1.5s infinite', color: 'var(--accent-primary)' }}>↻</div>
            <div className="empty-state-text">Carregando dados da Planilha Google...</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Paciente</th>
                  <th style={{ width: '10%' }}>Plano</th>
                  <th style={{ width: '16%' }} className="tooltip-container" data-tooltip="Já apresentou reação com anestesia bucal?">
                    <div className="truncate-text">Já apresentou reação com anestesia bucal?</div>
                  </th>
                  <th style={{ width: '11%' }} className="tooltip-container" data-tooltip="Gripado/Sinusite?">
                    <div className="truncate-text">Gripado/Sinusite?</div>
                  </th>
                  <th style={{ width: '14%' }} className="tooltip-container" data-tooltip="Medicamentos Uso Contínuo">
                    <div className="truncate-text">Medicamentos Uso Contínuo</div>
                  </th>
                  <th style={{ width: '13%' }} className="tooltip-container" data-tooltip="Você tem medo de dentista?">
                    <div className="truncate-text">Você tem medo de dentista?</div>
                  </th>
                  <th style={{ width: '10%' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const nome = p['Nome completo:'] || 'Registro Sem Nome';
                  const atualizado = p['Atualizado? Favor Atualizar quando paciente retornar '];
                  
                  return (
                    <tr key={p._rowIndex} style={{ cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                          <div className="avatar" style={{ background: `hsl(${Number(p._rowIndex) * 20}, 60%, 25%)`, color: `hsl(${Number(p._rowIndex) * 20}, 80%, 70%)` }}>
                            {nome.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{nome}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Linha: {p._rowIndex} • CPF: {p['CPF:'] || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {p['Qual o plano de saúde?'] ? (
                          <span className={`badge ${
                            p['Qual o plano de saúde?'] === 'Particular' ? 'badge-amber' :
                            p['Qual o plano de saúde?'] === 'Uniodonto' ? 'badge-teal' :
                            p['Qual o plano de saúde?'] === 'Camed' ? 'badge-purple' : 'badge-rose'
                          }`}>
                            {p['Qual o plano de saúde?']}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p['Já apresentou reação com anestesia bucal?'] ? (
                          <span className={`badge ${
                            p['Já apresentou reação com anestesia bucal?'].toLowerCase().includes('sim') ? 'badge-rose' : 'badge-slate'
                          }`}>
                            {p['Já apresentou reação com anestesia bucal?']}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {p['No momento presente, você se encontra gripado/resfriado/sinusite?'] ? (
                          <span className={`badge ${
                            p['No momento presente, você se encontra gripado/resfriado/sinusite?'].toLowerCase() === 'sim' ? 'badge-rose' : 'badge-emerald'
                          }`}>
                            {p['No momento presente, você se encontra gripado/resfriado/sinusite?']}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                         {p['Está tomando alguma medicação. Se sim, qual(is)?'] || 'Nenhuma'}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p['Você tem medo de dentista?'] ? (
                          <span className={`badge ${
                            p['Você tem medo de dentista?'].toLowerCase().includes('sim') ? 'badge-amber' : 'badge-slate'
                          }`}>
                            {p['Você tem medo de dentista?']}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); setSelectedPatient(p); }}>
                          Completar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filtered.length === 0 && !loading && (
              <div className="empty-state">
                <div className="empty-state-text">Nenhum paciente encontrado.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPatient && (
        <PatientModal 
          patient={selectedPatient} 
          onClose={() => setSelectedPatient(null)} 
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
