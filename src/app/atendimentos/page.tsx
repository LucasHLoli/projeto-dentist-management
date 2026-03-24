'use client';

import { sampleAppointments, Appointment } from '@/lib/data';
import { useState } from 'react';
import NovoAtendimentoModal from '@/components/NovoAtendimentoModal';
import { Stethoscope, ClipboardList, Sparkles, Search, Plus, Check, X, Trash2, Pencil } from 'lucide-react';

export default function AtendimentosPage() {
  const [search, setSearch] = useState('');
  const [filterPlano, setFilterPlano] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>(sampleAppointments);

  const filtered = appointments.filter(a => {
    const matchSearch = a.paciente.toLowerCase().includes(search.toLowerCase());
    const matchPlano = !filterPlano || a.planoSaude === filterPlano;
    return matchSearch && matchPlano;
  });

  const getProcedimento = (a: Appointment) => {
    return a.procedimentosParticular || a.procedimentosUniodonto || a.procedimentosCamed || a.procedimentosGeap || '—';
  };

  const handleSave = (appointment: Appointment) => {
    setAppointments(prev => {
      const exists = prev.find(a => a.id === appointment.id);
      if (exists) return prev.map(a => a.id === appointment.id ? appointment : a);
      return [appointment, ...prev];
    });
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este atendimento?')) {
      setAppointments(prev => prev.filter(a => a.id !== id));
    }
  };

  const nextId = appointments.length > 0 ? Math.max(...appointments.map(a => a.id)) + 1 : 1;

  return (
    <div>
      <div className="page-header">
        <h1>Atendimentos</h1>
        <p>Registro de procedimentos odontológicos e HOF</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon"><Stethoscope size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Total Atendimentos</div>
          <div className="stat-card-value">1.135</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon"><ClipboardList size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Com dados completos</div>
          <div className="stat-card-value">454</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon"><Sparkles size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Com Limpeza</div>
          <div className="stat-card-value">{appointments.filter(a => a.limpeza).length}</div>
        </div>
      </div>

      <div className="filter-row">
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon"><Search size={14} /></span>
          <input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} suppressHydrationWarning />
        </div>
        <select className="form-input" style={{ width: '180px' }} value={filterPlano} onChange={e => setFilterPlano(e.target.value)}>
          <option value="">Todos os planos</option>
          <option value="Particular">Particular</option>
          <option value="Uniodonto">Uniodonto</option>
          <option value="Camed">Camed</option>
          <option value="Geap">Geap</option>
        </select>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => { setEditingAppointment(null); setShowModal(true); }}>
          <Plus size={14} /> Novo Atendimento
        </button>
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
                <th></th>
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
                  <td>{a.limpeza ? <span className="badge badge-emerald"><Check size={10} /> Sim</span> : <span className="badge badge-rose"><X size={10} /> Não</span>}</td>
                  <td>{a.pediuRecibo ? <span className="badge badge-amber"><Check size={10} /> Sim</span> : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleEdit(a)}
                        title="Editar atendimento"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        title="Excluir atendimento"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <NovoAtendimentoModal
          onClose={handleCloseModal}
          onSave={handleSave}
          nextId={nextId}
          initialData={editingAppointment ?? undefined}
        />
      )}
    </div>
  );
}
