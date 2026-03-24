'use client';

import { useState } from 'react';
import { Appointment } from '@/lib/data';

const PLANOS = ['Particular', 'Uniodonto', 'Camed', 'Geap'] as const;
type Plano = typeof PLANOS[number];

const TABS = ['Identificação', 'Procedimentos', 'Financeiro'] as const;
type Tab = typeof TABS[number];

interface Props {
  onClose: () => void;
  onSave: (appointment: Appointment) => void;
  nextId: number;
}

const emptyForm = {
  data: '',
  paciente: '',
  planoSaude: 'Particular' as Plano,
  procedimentosParticular: '',
  procedimentosUniodonto: '',
  procedimentosCamed: '',
  procedimentosGeap: '',
  descricaoQueixa: '',
  limpeza: false,
  pediuRecibo: false,
  modalidadePagamento: '',
  parcelas: 1,
  detalhesDespesa: '',
};

export default function NovoAtendimentoModal({ onClose, onSave, nextId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Identificação');
  const [form, setForm] = useState(emptyForm);

  const set = (field: keyof typeof emptyForm, value: string | boolean | number) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const getProcedimentoField = (): keyof typeof emptyForm => {
    switch (form.planoSaude) {
      case 'Uniodonto': return 'procedimentosUniodonto';
      case 'Camed': return 'procedimentosCamed';
      case 'Geap': return 'procedimentosGeap';
      default: return 'procedimentosParticular';
    }
  };

  const handleSave = () => {
    const appointment: Appointment = {
      id: nextId,
      data: form.data || new Date().toISOString().split('T')[0],
      paciente: form.paciente,
      planoSaude: form.planoSaude,
      procedimentosParticular: form.procedimentosParticular,
      procedimentosUniodonto: form.procedimentosUniodonto,
      procedimentosCamed: form.procedimentosCamed,
      procedimentosGeap: form.procedimentosGeap,
      descricaoQueixa: form.descricaoQueixa,
      limpeza: form.limpeza,
      pediuRecibo: form.pediuRecibo,
      modalidadePagamento: form.modalidadePagamento,
      parcelas: form.parcelas,
      detalhesDespesa: form.detalhesDespesa,
    };
    onSave(appointment);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Novo Atendimento</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Identificação' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Data</label>
              <input
                type="date"
                className="form-input"
                style={{ width: '100%' }}
                value={form.data}
                onChange={e => set('data', e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nome do Paciente</label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="Nome completo do paciente"
                value={form.paciente}
                onChange={e => set('paciente', e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Plano de Saúde</label>
              <select
                className="form-input"
                style={{ width: '100%' }}
                value={form.planoSaude}
                onChange={e => set('planoSaude', e.target.value)}
              >
                {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'Procedimentos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Procedimentos {form.planoSaude}
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder={`Procedimentos para ${form.planoSaude}`}
                value={form[getProcedimentoField()] as string}
                onChange={e => set(getProcedimentoField(), e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Descrição da Queixa</label>
              <textarea
                className="form-input"
                style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                placeholder="Descreva a queixa do paciente"
                value={form.descricaoQueixa}
                onChange={e => set('descricaoQueixa', e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <input
                type="checkbox"
                id="limpeza"
                checked={form.limpeza}
                onChange={e => set('limpeza', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="limpeza" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Realizou limpeza</label>
            </div>
          </div>
        )}

        {activeTab === 'Financeiro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pediu Recibo</label>
              <select
                className="form-input"
                style={{ width: '100%' }}
                value={form.pediuRecibo ? 'sim' : 'nao'}
                onChange={e => set('pediuRecibo', e.target.value === 'sim')}
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Modalidade de Pagamento</label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="Ex: Dinheiro, Cartão, Pix..."
                value={form.modalidadePagamento}
                onChange={e => set('modalidadePagamento', e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Número de Parcelas</label>
              <input
                type="number"
                className="form-input"
                style={{ width: '100%' }}
                min={1}
                value={form.parcelas}
                onChange={e => set('parcelas', Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)', borderTop: '1px solid var(--border-glass)', paddingTop: 'var(--space-lg)' }}>
          <button className="btn btn-secondary" onClick={onClose} type="button">Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} type="button">Salvar</button>
        </div>
      </div>
    </div>
  );
}
