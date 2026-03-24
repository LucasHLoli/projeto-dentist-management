'use client';

import { useState, useRef, useEffect } from 'react';
import { Appointment, samplePatients } from '@/lib/data';
import { particularProcedures, getRestauracaoValue, buildRestauracaoNome } from '@/lib/procedures';
import { X, Plus, Trash2 } from 'lucide-react';

const PLANOS = ['Particular', 'Uniodonto', 'Camed', 'Geap'] as const;
type Plano = typeof PLANOS[number];

const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Débito', 'Crédito'] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

interface PaymentLine {
  id: number;
  method: PaymentMethod;
  value: string;
}

interface SelectedProcedure {
  id: string;
  nome: string;
  valor2026: number;
}

interface RestauracaoState {
  faces: '1F' | '2F' | '3F' | '4F';
  quantidade: number;
}

interface Props {
  onClose: () => void;
  onSave: (appointment: Appointment) => void;
  nextId: number;
  initialData?: Appointment;
}

export default function NovoAtendimentoModal({ onClose, onSave, nextId, initialData }: Props) {
  const editing = !!initialData;

  const [data, setData] = useState(
    initialData?.data ?? new Date().toLocaleDateString('en-CA')
  );
  const [pacienteInput, setPacienteInput] = useState(initialData?.paciente ?? '');
  const [pacienteSelected, setPacienteSelected] = useState(initialData?.paciente ?? '');
  const [plano, setPlano] = useState<Plano>((initialData?.planoSaude as Plano) ?? 'Particular');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientRef = useRef<HTMLDivElement>(null);

  const [procedureSearch, setProcedureSearch] = useState('');
  const [showProcDropdown, setShowProcDropdown] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState<SelectedProcedure[]>(() => {
    if (!initialData) return [];
    const raw = initialData.procedimentosParticular || initialData.procedimentosUniodonto ||
                initialData.procedimentosCamed || initialData.procedimentosGeap || '';
    if (!raw) return [];
    return raw.split(',').map((n, i) => ({ id: `init-${i}`, nome: n.trim(), valor2026: 0 }));
  });
  const [restauracaoState, setRestauracaoState] = useState<RestauracaoState | null>(null);
  const [restauracaoProcId, setRestauracaoProcId] = useState<string | null>(null);
  const procRef = useRef<HTMLDivElement>(null);

  const [valorCustom, setValorCustom] = useState(false);
  const [valorCustomInput, setValorCustomInput] = useState('');
  const [justificativaCustom, setJustificativaCustom] = useState('');

  const [pediuRecibo, setPediuRecibo] = useState(initialData?.pediuRecibo ?? false);
  const [limpeza, setLimpeza] = useState(initialData?.limpeza ?? false);
  const [descricaoQueixa, setDescricaoQueixa] = useState(initialData?.descricaoQueixa ?? '');
  const [detalhesDespesa, setDetalhesDespesa] = useState(initialData?.detalhesDespesa ?? '');
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    { id: 1, method: 'Pix', value: '' },
  ]);
  const [convenioPagamento, setConvenioPagamento] = useState(
    plano !== 'Particular' ? (initialData?.modalidadePagamento ?? '') : ''
  );

  const filteredPatients = samplePatients.filter(p =>
    p.nome.toLowerCase().includes(pacienteInput.toLowerCase()) && pacienteInput.length > 0
  );

  const filteredProcedures = plano === 'Particular'
    ? particularProcedures.filter(p =>
        p.nome.toLowerCase().includes(procedureSearch.toLowerCase()) && procedureSearch.length > 0
      )
    : [];

  const totalProcedimentos = valorCustom
    ? parseFloat(valorCustomInput) || 0
    : selectedProcedures.reduce((sum, p) => sum + p.valor2026, 0);
  const totalPagamento = paymentLines.reduce((sum, l) => sum + (parseFloat(l.value) || 0), 0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node))
        setShowPatientDropdown(false);
      if (procRef.current && !procRef.current.contains(e.target as Node))
        setShowProcDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPatient = (patient: typeof samplePatients[0]) => {
    setPacienteInput(patient.nome);
    setPacienteSelected(patient.nome);
    setPlano(patient.planoSaude as Plano);
    setShowPatientDropdown(false);
  };

  const handleSelectProcedure = (proc: typeof particularProcedures[0]) => {
    if (proc.isRestauracao) {
      setRestauracaoProcId(proc.id);
      const facesMatch = proc.id.match(/restauracao-(\d)f/);
      const faces = facesMatch ? (`${facesMatch[1]}F` as '1F' | '2F' | '3F' | '4F') : '1F';
      setRestauracaoState({ faces, quantidade: 1 });
      setShowProcDropdown(false);
      setProcedureSearch('');
      return;
    }
    addProcedure(proc.id, proc.nome, proc.valor2026);
    if (proc.isLimpeza) setLimpeza(true);
    setShowProcDropdown(false);
    setProcedureSearch('');
  };

  const addProcedure = (id: string, nome: string, valor: number) => {
    if (selectedProcedures.find(p => p.id === id)) return;
    setSelectedProcedures(prev => [...prev, { id, nome, valor2026: valor }]);
  };

  const removeProcedure = (id: string) => {
    setSelectedProcedures(prev => prev.filter(p => p.id !== id));
  };

  const confirmRestauracao = () => {
    if (!restauracaoState || !restauracaoProcId) return;
    const { faces, quantidade } = restauracaoState;
    const nome = buildRestauracaoNome(faces, quantidade);
    const valor = getRestauracaoValue(faces, quantidade, '2026');
    const uid = `${restauracaoProcId}-q${quantidade}-${Date.now()}`;
    setSelectedProcedures(prev => [...prev, { id: uid, nome, valor2026: valor }]);
    setRestauracaoState(null);
    setRestauracaoProcId(null);
  };

  const addPaymentLine = () => {
    setPaymentLines(prev => [...prev, { id: Date.now(), method: 'Pix', value: '' }]);
  };

  const removePaymentLine = (id: number) => {
    setPaymentLines(prev => prev.filter(l => l.id !== id));
  };

  const updatePaymentLine = (id: number, field: 'method' | 'value', val: string) => {
    setPaymentLines(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  };

  const pacienteValido = (pacienteSelected || pacienteInput).trim().length > 0;

  const handleSave = () => {
    if (!pacienteValido) return;
    const procedimentoNomes = selectedProcedures.map(p => p.nome).join(', ');
    const modalidade = plano === 'Particular'
      ? paymentLines.map(l => `${l.method}: R$ ${l.value}`).join(' + ')
      : convenioPagamento;

    const appointment: Appointment = {
      id: initialData?.id ?? nextId,
      data,
      paciente: pacienteSelected || pacienteInput,
      planoSaude: plano,
      procedimentosParticular: plano === 'Particular' ? procedimentoNomes : '',
      procedimentosUniodonto: plano === 'Uniodonto' ? procedimentoNomes : '',
      procedimentosCamed: plano === 'Camed' ? procedimentoNomes : '',
      procedimentosGeap: plano === 'Geap' ? procedimentoNomes : '',
      descricaoQueixa,
      limpeza,
      pediuRecibo,
      modalidadePagamento: modalidade,
      parcelas: 1,
      detalhesDespesa: valorCustom
        ? `${detalhesDespesa}${detalhesDespesa ? ' | ' : ''}Valor customizado: R$${valorCustomInput} — ${justificativaCustom}`
        : detalhesDespesa,
    };
    onSave(appointment);
    onClose();
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const diff = totalPagamento - totalProcedimentos;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: '680px', width: '95vw', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        <div className="modal-header">
          <span className="modal-title">{editing ? 'Editar Atendimento' : 'Novo Atendimento'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', padding: '0 2px 4px' }}>

          {/* ── Data ── */}
          <div>
            <label style={labelStyle}>Data <span style={{ color: '#f87171' }}>*</span></label>
            <input
              type="date"
              className="form-input"
              style={{ width: '100%' }}
              value={data}
              onChange={e => setData(e.target.value)}
            />
          </div>

          {/* ── Paciente ── */}
          <div ref={patientRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Paciente <span style={{ color: '#f87171' }}>*</span></label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%' }}
              placeholder="Digite o nome do paciente..."
              value={pacienteInput}
              onChange={e => {
                setPacienteInput(e.target.value);
                setPacienteSelected('');
                setShowPatientDropdown(true);
              }}
              onFocus={() => setShowPatientDropdown(true)}
              autoComplete="off"
            />
            {showPatientDropdown && filteredPatients.length > 0 && (
              <div style={dropdownStyle}>
                {filteredPatients.map(p => (
                  <div
                    key={p.id}
                    style={dropdownItemStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onMouseDown={() => handleSelectPatient(p)}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.nome}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{p.planoSaude}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Plano ── */}
          <div>
            <label style={labelStyle}>Plano de Saúde</label>
            <select
              className="form-input"
              style={{ width: '100%' }}
              value={plano}
              onChange={e => setPlano(e.target.value as Plano)}
            >
              {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* ── Procedimentos ── */}
          <div ref={procRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Procedimentos {plano}</label>
            {plano === 'Particular' ? (
              <>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%' }}
                  placeholder="Digite para buscar um procedimento..."
                  value={procedureSearch}
                  onChange={e => { setProcedureSearch(e.target.value); setShowProcDropdown(true); }}
                  onFocus={() => setShowProcDropdown(true)}
                  autoComplete="off"
                />
                {showProcDropdown && filteredProcedures.length > 0 && (
                  <div style={dropdownStyle}>
                    {filteredProcedures.map(p => (
                      <div
                        key={p.id}
                        style={dropdownItemStyle}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onMouseDown={() => handleSelectProcedure(p)}
                      >
                        <span style={{ color: 'var(--text-primary)' }}>{p.nome}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-teal)', marginLeft: '8px' }}>{fmt(p.valor2026)}</span>
                        {p.isRestauracao && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px' }}>(configurar faces/qte)</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {restauracaoState && (
                  <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--accent-teal)', borderRadius: '8px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-teal)' }}>Configurar Restauração</div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Faces</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(['1F', '2F', '3F', '4F'] as const).map(f => (
                            <button key={f} type="button"
                              onClick={() => setRestauracaoState(s => s ? { ...s, faces: f } : null)}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: restauracaoState.faces === f ? 'var(--accent-teal)' : 'transparent', color: restauracaoState.faces === f ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}
                            >{f}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Quantidade</label>
                        <input type="number" min={1} max={5} className="form-input" style={{ width: '70px' }}
                          value={restauracaoState.quantidade}
                          onChange={e => setRestauracaoState(s => s ? { ...s, quantidade: Math.max(1, Math.min(5, parseInt(e.target.value) || 1)) } : null)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                        <button type="button" className="btn btn-primary" style={{ padding: '4px 14px', fontSize: '0.82rem' }} onClick={confirmRestauracao}>Adicionar</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.82rem' }} onClick={() => { setRestauracaoState(null); setRestauracaoProcId(null); }}>Cancelar</button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Prévia: {buildRestauracaoNome(restauracaoState.faces, restauracaoState.quantidade)} — {fmt(getRestauracaoValue(restauracaoState.faces, restauracaoState.quantidade, '2026'))}
                    </div>
                  </div>
                )}

                {selectedProcedures.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {selectedProcedures.map(p => (
                      <span key={p.id} style={chipStyle}>
                        {p.nome}
                        {p.valor2026 > 0 && <span style={{ marginLeft: '4px', opacity: 0.7, fontSize: '0.75rem' }}>({fmt(p.valor2026)})</span>}
                        <button type="button" onClick={() => removeProcedure(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* ── Valor personalizado ── */}
                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: valorCustom ? '12px' : '0' }}>
                    <input
                      type="checkbox"
                      id="valorCustom"
                      checked={valorCustom}
                      onChange={e => setValorCustom(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="valorCustom" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Cobrar valor diferente da tabela
                    </label>
                  </div>
                  {valorCustom && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={labelStyle}>Valor a cobrar (R$)</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '100%' }}
                          placeholder="0,00"
                          min={0}
                          step={0.01}
                          value={valorCustomInput}
                          onChange={e => setValorCustomInput(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Justificativa <span style={{ color: '#f87171' }}>*</span></label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ width: '100%' }}
                          placeholder="Ex: Desconto por retorno, paciente especial..."
                          value={justificativaCustom}
                          onChange={e => setJustificativaCustom(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {(selectedProcedures.length > 0 || valorCustom) && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total dos procedimentos:</span>
                    <strong style={{ color: 'var(--accent-teal)' }}>{fmt(totalProcedimentos)}</strong>
                  </div>
                )}
              </>
            ) : (
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder={`Descreva os procedimentos de ${plano}...`}
                value={selectedProcedures.map(p => p.nome).join(', ')}
                onChange={e => {
                  const names = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
                  setSelectedProcedures(names.map((n, i) => ({ id: `free-${i}`, nome: n, valor2026: 0 })));
                }}
              />
            )}
          </div>

          {/* ── Limpeza + Recibo ── */}
          <div style={{ display: 'flex', gap: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="limpeza" checked={limpeza} onChange={e => setLimpeza(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="limpeza" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Realizou limpeza</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="recibo" checked={pediuRecibo} onChange={e => setPediuRecibo(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="recibo" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Pediu recibo</label>
            </div>
          </div>

          {/* ── Pagamento Particular ── */}
          {plano === 'Particular' && (
            <div>
              <label style={labelStyle}>Formas de Pagamento</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {paymentLines.map(line => (
                  <div key={line.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      className="form-input"
                      style={{ width: '140px', flexShrink: 0 }}
                      value={line.method}
                      onChange={e => updatePaymentLine(line.id, 'method', e.target.value)}
                    >
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      style={{ flex: 1 }}
                      placeholder="R$ 0,00"
                      min={0}
                      step={0.01}
                      value={line.value}
                      onChange={e => updatePaymentLine(line.id, 'value', e.target.value)}
                    />
                    {paymentLines.length > 1 && (
                      <button type="button" onClick={() => removePaymentLine(line.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary" style={{ marginTop: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={addPaymentLine}>
                <Plus size={13} /> Adicionar forma de pagamento
              </button>
              {totalPagamento > 0 && (
                <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total pagamento:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{fmt(totalPagamento)}</strong>
                  </div>
                  {(selectedProcedures.length > 0 || valorCustom) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Diferença:</span>
                      <strong style={{ color: diff === 0 ? 'var(--accent-teal)' : diff < 0 ? '#f87171' : '#f59e0b' }}>
                        {diff >= 0 ? '+' : ''}{fmt(diff)}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Pagamento Convênio ── */}
          {plano !== 'Particular' && (
            <div>
              <label style={labelStyle}>Observação de Pagamento</label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="Ex: Autorização enviada, aguardando glosa..."
                value={convenioPagamento}
                onChange={e => setConvenioPagamento(e.target.value)}
              />
            </div>
          )}

          {/* ── Queixa ── */}
          <div>
            <label style={labelStyle}>Queixa / Observações Clínicas</label>
            <textarea
              className="form-input"
              style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
              placeholder="Descreva a queixa do paciente ou observações clínicas..."
              value={descricaoQueixa}
              onChange={e => setDescricaoQueixa(e.target.value)}
            />
          </div>

          {/* ── Detalhes ── */}
          <div>
            <label style={labelStyle}>Detalhes de Despesa / Insumos</label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%' }}
              placeholder="Ex: Escova robinson, Pasta profilática..."
              value={detalhesDespesa}
              onChange={e => setDetalhesDespesa(e.target.value)}
            />
          </div>

        </div>

        {/* ── Footer fixo ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-lg)', borderTop: '1px solid var(--border-glass)', paddingTop: 'var(--space-lg)' }}>
          {!pacienteValido && (
            <span style={{ fontSize: '0.78rem', color: '#f87171' }}>Preencha o nome do paciente para salvar</span>
          )}
          {(valorCustom && !justificativaCustom) && (
            <span style={{ fontSize: '0.78rem', color: '#f87171' }}>Preencha a justificativa do valor customizado</span>
          )}
          {pacienteValido && (!valorCustom || justificativaCustom) && <span />}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: 'auto' }}>
            <button className="btn btn-secondary" onClick={onClose} type="button">Cancelar</button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              type="button"
              disabled={!pacienteValido || (valorCustom && !justificativaCustom)}
              style={{ opacity: (!pacienteValido || (valorCustom && !justificativaCustom)) ? 0.5 : 1, cursor: (!pacienteValido || (valorCustom && !justificativaCustom)) ? 'not-allowed' : 'pointer' }}
            >
              {editing ? 'Salvar alterações' : 'Salvar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--space-xs)',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-glass)',
  borderRadius: '8px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  zIndex: 9999,
  maxHeight: '220px',
  overflowY: 'auto',
};

const dropdownItemStyle: React.CSSProperties = {
  padding: '10px 14px',
  cursor: 'pointer',
  borderBottom: '1px solid var(--border-glass)',
  fontSize: '0.88rem',
  background: 'transparent',
  transition: 'background 0.1s',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: '20px',
  background: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid var(--accent-teal)',
  color: 'var(--accent-teal)',
  fontSize: '0.8rem',
  fontWeight: 500,
};
