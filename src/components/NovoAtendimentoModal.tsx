'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Appointment, samplePatients } from '@/lib/data';
import { particularProcedures, getRestauracaoValue, buildRestauracaoNome } from '@/lib/procedures';
import { X, Plus, Trash2, Zap, Check } from 'lucide-react';

interface ConsumoSugerido {
  insumoId: number;
  nomeInsumo: string;
  quantidadeSugerida: number;
  justificativa: string;
  aceito: boolean;
}

const PLANOS = ['Particular', 'Uniodonto', 'Camed', 'Geap'] as const;
type Plano = typeof PLANOS[number];

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Débito', 'Crédito'] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

interface PaymentLine {
  id: number;
  method: PaymentMethod;
  value: string;
  autoFilled: boolean;
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

interface DropdownCoords { top: number; left: number; width: number }

interface Props {
  onClose: () => void;
  onSave: (appointment: Appointment) => void;
  nextId: number;
  initialData?: Appointment;
}

export default function NovoAtendimentoModal({ onClose, onSave, nextId, initialData }: Props) {
  const editing = !!initialData;

  const [data, setData] = useState(initialData?.data ?? new Date().toLocaleDateString('en-CA'));
  const [pacienteInput, setPacienteInput] = useState(initialData?.paciente ?? '');
  const [pacienteSelected, setPacienteSelected] = useState(initialData?.paciente ?? '');
  const [plano, setPlano] = useState<Plano>((initialData?.planoSaude as Plano) ?? 'Particular');

  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [patientCoords, setPatientCoords] = useState<DropdownCoords>({ top: 0, left: 0, width: 0 });
  const patientInputRef = useRef<HTMLInputElement>(null);

  const [procedureSearch, setProcedureSearch] = useState('');
  const [showProcDropdown, setShowProcDropdown] = useState(false);
  const [procCoords, setProcCoords] = useState<DropdownCoords>({ top: 0, left: 0, width: 0 });
  const procInputRef = useRef<HTMLInputElement>(null);

  const [selectedProcedures, setSelectedProcedures] = useState<SelectedProcedure[]>(() => {
    if (!initialData) return [];
    const raw = initialData.procedimentosParticular || initialData.procedimentosUniodonto ||
                initialData.procedimentosCamed || initialData.procedimentosGeap || '';
    if (!raw) return [];
    return raw.split(',').map((n, i) => ({ id: `init-${i}`, nome: n.trim(), valor2026: 0 }));
  });
  const [restauracaoState, setRestauracaoState] = useState<RestauracaoState | null>(null);
  const [restauracaoProcId, setRestauracaoProcId] = useState<string | null>(null);

  const [valorCustom, setValorCustom] = useState(false);
  const [valorCustomInput, setValorCustomInput] = useState('');
  const [justificativaCustom, setJustificativaCustom] = useState('');

  const [pediuRecibo, setPediuRecibo] = useState(initialData?.pediuRecibo ?? false);
  const [limpeza, setLimpeza] = useState(initialData?.limpeza ?? false);
  const [descricaoQueixa, setDescricaoQueixa] = useState(initialData?.descricaoQueixa ?? '');
  const [detalhesDespesa, setDetalhesDespesa] = useState(initialData?.detalhesDespesa ?? '');
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    { id: 1, method: 'Pix', value: '', autoFilled: false },
  ]);
  const [consumosSugeridos, setConsumosSugeridos] = useState<ConsumoSugerido[]>([]);
  const [loadingSugestao, setLoadingSugestao] = useState(false);

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
    ? (parseFloat(valorCustomInput) || 0)
    : selectedProcedures.reduce((sum, p) => sum + p.valor2026, 0);
  const totalPagamento = paymentLines.reduce((sum, l) => sum + (parseFloat(l.value) || 0), 0);

  const calcPatientCoords = useCallback(() => {
    if (patientInputRef.current) {
      const r = patientInputRef.current.getBoundingClientRect();
      setPatientCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, []);

  const calcProcCoords = useCallback(() => {
    if (procInputRef.current) {
      const r = procInputRef.current.getBoundingClientRect();
      setProcCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (patientInputRef.current && !patientInputRef.current.closest('[data-patient-wrap]')?.contains(target))
        setShowPatientDropdown(false);
      if (procInputRef.current && !procInputRef.current.closest('[data-proc-wrap]')?.contains(target))
        setShowProcDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (totalProcedimentos > 0) {
      setPaymentLines(prev =>
        prev.map((l, i) => {
          if (i === 0 && (l.autoFilled || l.value === '')) {
            return { ...l, value: totalProcedimentos.toFixed(2), autoFilled: true };
          }
          return l;
        })
      );
    }
  }, [totalProcedimentos]);

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
    // Buscar sugestão de consumo de materiais via IA
    setLoadingSugestao(true);
    fetch(`/api/estoque/consumo?procedimentoId=${id}&nome=${encodeURIComponent(nome)}`)
      .then(r => r.json())
      .then(data => {
        const novasSugestoes: ConsumoSugerido[] = (data.sugestoes ?? []).map((s: Omit<ConsumoSugerido, 'aceito'>) => ({
          ...s,
          aceito: true,
        }));
        setConsumosSugeridos(prev => {
          // Evitar duplicar o mesmo insumo
          const existentes = new Set(prev.map(s => s.insumoId));
          return [...prev, ...novasSugestoes.filter(s => !existentes.has(s.insumoId))];
        });
      })
      .catch(() => {})
      .finally(() => setLoadingSugestao(false));
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
    setPaymentLines(prev => [...prev, { id: Date.now(), method: 'Pix', value: '', autoFilled: false }]);
  };

  const removePaymentLine = (id: number) => {
    setPaymentLines(prev => prev.filter(l => l.id !== id));
  };

  const updatePaymentLine = (id: number, field: 'method' | 'value', val: string) => {
    setPaymentLines(prev => prev.map(l =>
      l.id === id ? { ...l, [field]: val, autoFilled: field === 'value' ? false : l.autoFilled } : l
    ));
  };

  const pacienteValido = (pacienteSelected || pacienteInput).trim().length > 0;
  const customValido = !valorCustom || (valorCustomInput !== '' && justificativaCustom.trim().length > 0);
  const canSave = pacienteValido && customValido;

  const handleSave = () => {
    if (!canSave) return;
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

    // Registrar consumo de materiais (FEFO) se houver sugestões aceitas
    const insumosAceitos = consumosSugeridos.filter(s => s.aceito);
    if (insumosAceitos.length > 0) {
      fetch('/api/estoque/consumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atendimentoId: String(appointment.id),
          insumos: insumosAceitos.map(s => ({
            insumoId: s.insumoId,
            quantidade: s.quantidadeSugerida,
            origem: 'AI_SUGERIDO',
          })),
        }),
      }).catch(() => {});
    }

    onClose();
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const diff = totalPagamento - totalProcedimentos;

  return (
    <>
      {/* Patient dropdown (fixed, outside scroll) */}
      {showPatientDropdown && filteredPatients.length > 0 && (
        <div style={{ ...dropdownStyle, position: 'fixed', top: patientCoords.top, left: patientCoords.left, width: patientCoords.width }}>
          {filteredPatients.slice(0, 8).map(p => (
            <div key={p.id} style={dropdownItemStyle}
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

      {/* Procedure dropdown (fixed, outside scroll) */}
      {showProcDropdown && filteredProcedures.length > 0 && (
        <div style={{ ...dropdownStyle, position: 'fixed', top: procCoords.top, left: procCoords.left, width: procCoords.width }}>
          {filteredProcedures.slice(0, 10).map(p => (
            <div key={p.id} style={dropdownItemStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onMouseDown={() => handleSelectProcedure(p)}
            >
              <span style={{ color: 'var(--text-primary)' }}>{p.nome}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-teal)', marginLeft: '8px' }}>{fmt(p.valor2026)}</span>
              {p.isRestauracao && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px' }}>(faces/qtd)</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" style={{ maxWidth: '660px', width: '95vw', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

          <div className="modal-header">
            <span className="modal-title">{editing ? 'Editar Atendimento' : 'Novo Atendimento'}</span>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingRight: '4px' }}>

            {/* Data */}
            <div>
              <label style={labelStyle}>Data <Req /></label>
              <input type="date" className="form-input" style={{ width: '100%' }} value={data} onChange={e => setData(e.target.value)} />
            </div>

            {/* Paciente */}
            <div data-patient-wrap="">
              <label style={labelStyle}>Paciente <Req /></label>
              <input
                ref={patientInputRef}
                type="text"
                className="form-input"
                style={{ width: '100%' }}
                placeholder="Digite o nome do paciente..."
                value={pacienteInput}
                onChange={e => { setPacienteInput(e.target.value); setPacienteSelected(''); setShowPatientDropdown(true); calcPatientCoords(); }}
                onFocus={() => { setShowPatientDropdown(true); calcPatientCoords(); }}
                autoComplete="off"
              />
            </div>

            {/* Plano */}
            <div>
              <label style={labelStyle}>Plano de Saúde</label>
              <select className="form-input" style={{ width: '100%' }} value={plano} onChange={e => setPlano(e.target.value as Plano)}>
                {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Procedimentos Particular */}
            {plano === 'Particular' && (
              <div data-proc-wrap="">
                <label style={labelStyle}>Procedimentos Particular</label>
                <input
                  ref={procInputRef}
                  type="text"
                  className="form-input"
                  style={{ width: '100%' }}
                  placeholder="Digite para buscar um procedimento..."
                  value={procedureSearch}
                  onChange={e => { setProcedureSearch(e.target.value); setShowProcDropdown(true); calcProcCoords(); }}
                  onFocus={() => { setShowProcDropdown(true); calcProcCoords(); }}
                  autoComplete="off"
                />

                {/* Configurador de Restauração */}
                {restauracaoState && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid var(--accent-teal)', borderRadius: '10px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-teal)' }}>⚙ Configurar Restauração</div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Faces</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {(['1F', '2F', '3F', '4F'] as const).map(f => (
                            <button key={f} type="button"
                              onClick={() => setRestauracaoState(s => s ? { ...s, faces: f } : null)}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: restauracaoState.faces === f ? 'var(--accent-teal)' : 'transparent', color: restauracaoState.faces === f ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                            >{f}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Qtd.</label>
                        <input type="number" min={1} max={5} className="form-input" style={{ width: '64px' }}
                          value={restauracaoState.quantidade}
                          onChange={e => setRestauracaoState(s => s ? { ...s, quantidade: Math.max(1, Math.min(5, parseInt(e.target.value) || 1)) } : null)}
                        />
                      </div>
                      <button type="button" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={confirmRestauracao}>Adicionar</button>
                      <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.82rem' }} onClick={() => { setRestauracaoState(null); setRestauracaoProcId(null); }}>✕</button>
                    </div>
                    <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>
                      {buildRestauracaoNome(restauracaoState.faces, restauracaoState.quantidade)} — {fmt(getRestauracaoValue(restauracaoState.faces, restauracaoState.quantidade, '2026'))}
                    </div>
                  </div>
                )}

                {/* Chips de procedimentos */}
                {selectedProcedures.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {selectedProcedures.map(p => (
                      <span key={p.id} style={chipStyle}>
                        {p.nome}
                        {p.valor2026 > 0 && <span style={{ marginLeft: '4px', opacity: 0.7, fontSize: '0.74rem' }}>({fmt(p.valor2026)})</span>}
                        <button type="button" onClick={() => removeProcedure(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 5px', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Sugestão de materiais IA */}
                {(consumosSugeridos.length > 0 || loadingSugestao) && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <Zap size={12} style={{ color: '#6366f1' }} />
                      {loadingSugestao ? 'IA identificando materiais...' : 'Materiais sugeridos pela IA'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {consumosSugeridos.map((s, i) => (
                        <span
                          key={s.insumoId}
                          title={s.justificativa}
                          onClick={() => setConsumosSugeridos(prev => prev.map((x, j) => j === i ? { ...x, aceito: !x.aceito } : x))}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 8px', borderRadius: '12px', fontSize: '0.78rem',
                            cursor: 'pointer', userSelect: 'none',
                            background: s.aceito ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.05)',
                            border: `1px solid ${s.aceito ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                            color: s.aceito ? '#6366f1' : 'var(--text-muted)',
                            textDecoration: s.aceito ? 'none' : 'line-through',
                          }}
                        >
                          {s.aceito && <Check size={9} />}
                          {s.nomeInsumo} ×{s.quantidadeSugerida}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valor personalizado */}
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                      background: valorCustom ? 'var(--accent-primary)' : 'transparent',
                      border: `2px solid ${valorCustom ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                      transition: 'all 0.15s',
                    }}>
                      {valorCustom && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </span>
                    <input type="checkbox" checked={valorCustom} onChange={e => setValorCustom(e.target.checked)} style={{ display: 'none' }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Cobrar valor diferente da tabela</span>
                  </label>

                  {valorCustom && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={labelStyle}>Valor (R$) <Req /></label>
                        <input type="number" className="form-input" style={{ width: '100%' }} placeholder="0,00" min={0} step={0.01}
                          value={valorCustomInput} onChange={e => setValorCustomInput(e.target.value)} />
                      </div>
                      <div style={{ flex: '3 1 200px' }}>
                        <label style={labelStyle}>Justificativa <Req /></label>
                        <input type="text" className="form-input" style={{ width: '100%' }} placeholder="Ex: Desconto por retorno..."
                          value={justificativaCustom} onChange={e => setJustificativaCustom(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Total */}
                {totalProcedimentos > 0 && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total dos procedimentos</span>
                    <strong style={{ color: 'var(--accent-teal)', fontSize: '1rem' }}>{fmt(totalProcedimentos)}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Procedimentos Convênio */}
            {plano !== 'Particular' && (
              <div>
                <label style={labelStyle}>Procedimentos {plano}</label>
                <input type="text" className="form-input" style={{ width: '100%' }}
                  placeholder={`Descreva os procedimentos de ${plano}...`}
                  value={selectedProcedures.map(p => p.nome).join(', ')}
                  onChange={e => {
                    const names = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
                    setSelectedProcedures(names.map((n, i) => ({ id: `free-${i}`, nome: n, valor2026: 0 })));
                  }}
                />
              </div>
            )}

            {/* Separador */}
            <div style={{ borderTop: '1px solid var(--border-glass)', margin: '2px 0' }} />

            {/* Limpeza + Recibo */}
            <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
              <CheckboxField id="limpeza" label="Realizou limpeza" checked={limpeza} onChange={setLimpeza} />
              <CheckboxField id="recibo" label="Pediu recibo" checked={pediuRecibo} onChange={setPediuRecibo} />
            </div>

            {/* Pagamento Particular */}
            {plano === 'Particular' && (
              <div>
                <label style={labelStyle}>Formas de Pagamento</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {paymentLines.map((line, idx) => (
                    <div key={line.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select className="form-input" style={{ width: '130px', flexShrink: 0 }}
                        value={line.method} onChange={e => updatePaymentLine(line.id, 'method', e.target.value)}>
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem', pointerEvents: 'none' }}>R$</span>
                        <input type="number" className="form-input" style={{ width: '100%', paddingLeft: '32px' }}
                          placeholder="0,00" min={0} step={0.01}
                          value={line.value}
                          onChange={e => updatePaymentLine(line.id, 'value', e.target.value)}
                        />
                      </div>
                      {paymentLines.length > 1 && (
                        <button type="button" onClick={() => removePaymentLine(line.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary"
                  style={{ marginTop: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={addPaymentLine}>
                  <Plus size={13} /> Adicionar forma de pagamento
                </button>

                {totalPagamento > 0 && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total pagamento</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{fmt(totalPagamento)}</strong>
                    </div>
                    {totalProcedimentos > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Diferença</span>
                        <strong style={{ color: diff === 0 ? 'var(--accent-teal)' : diff < 0 ? '#f87171' : '#f59e0b' }}>
                          {diff >= 0 ? '+' : ''}{fmt(diff)}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pagamento Convênio */}
            {plano !== 'Particular' && (
              <div>
                <label style={labelStyle}>Observação de Pagamento</label>
                <input type="text" className="form-input" style={{ width: '100%' }}
                  placeholder="Ex: Autorização enviada, aguardando glosa..."
                  value={convenioPagamento} onChange={e => setConvenioPagamento(e.target.value)} />
              </div>
            )}

            {/* Queixa */}
            <div>
              <label style={labelStyle}>Queixa / Observações Clínicas</label>
              <textarea className="form-input" style={{ width: '100%', minHeight: '72px', resize: 'vertical' }}
                placeholder="Descreva a queixa do paciente ou observações clínicas..."
                value={descricaoQueixa} onChange={e => setDescricaoQueixa(e.target.value)} />
            </div>

            {/* Insumos */}
            <div>
              <label style={labelStyle}>Detalhes de Despesa / Insumos</label>
              <input type="text" className="form-input" style={{ width: '100%' }}
                placeholder="Ex: Escova robinson, Pasta profilática..."
                value={detalhesDespesa} onChange={e => setDetalhesDespesa(e.target.value)} />
            </div>

          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-lg)', borderTop: '1px solid var(--border-glass)', paddingTop: 'var(--space-lg)' }}>
            <div style={{ fontSize: '0.78rem', color: '#f87171' }}>
              {!pacienteValido && 'Preencha o nome do paciente'}
              {pacienteValido && valorCustom && !valorCustomInput && 'Preencha o valor personalizado'}
              {pacienteValido && valorCustom && valorCustomInput && !justificativaCustom && 'Preencha a justificativa'}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary" onClick={onClose} type="button">Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} type="button"
                disabled={!canSave}
                style={{ opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}>
                {editing ? 'Salvar alterações' : 'Salvar'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

function Req() {
  return <span style={{ color: '#f87171', marginLeft: '2px' }}>*</span>;
}

function CheckboxField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
        background: checked ? 'var(--accent-primary)' : 'transparent',
        border: `2px solid ${checked ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
        transition: 'all 0.15s',
      }}>
        {checked && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </span>
      <input type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</span>
    </label>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--space-xs)',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
};

const dropdownStyle: React.CSSProperties = {
  background: '#111827',
  border: '1px solid rgba(99,102,241,0.3)',
  borderRadius: '8px',
  boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
  zIndex: 99999,
  maxHeight: '240px',
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
  background: 'rgba(16, 185, 129, 0.12)',
  border: '1px solid rgba(16, 185, 129, 0.4)',
  color: 'var(--accent-teal)',
  fontSize: '0.8rem',
  fontWeight: 500,
};
