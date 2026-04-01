'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Package, AlertTriangle, Clock, Search, Plus, Upload,
  ClipboardList, Truck, RefreshCw, ChevronRight, ChevronDown, Zap, X,
  BarChart2, Star, TrendingUp, TrendingDown, Minus,
  FileText, Download, Table,
} from 'lucide-react'
import NFeUploadModal from '@/components/NFeUploadModal'
import { useToast } from '@/components/Toast'

// ─── Hooks utilitários ──────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function SkeletonTable({ rows = 6, cols = 8 }: { rows?: number; cols?: number }) {
  const widths = ['120px', '80px', '70px', '90px', '60px', '80px', '80px', '70px']
  return (
    <div className="glass-card" style={{ padding: 0 }}>
      <div className="table-container">
        <div style={{ padding: '12px 16px', display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: widths[i % widths.length], height: '10px' }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="skeleton-row">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="skeleton-cell" style={{ width: widths[c % widths.length], animationDelay: `${r * 0.05}s` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface InsumoResumo {
  id: number
  nome: string
  unidadeMedida: string
  grupoCategoria: string | null
  fotoUrl: string | null
  estoqueTotal: number
  estoqueMinimo: number
  critico: boolean
  proximoVencer: string | null
  lotes: LoteResumo[]
}

interface LoteResumo {
  id: number
  quantidade: number
  quantidadeAtual: number
  validade: string | null
  validadeConfirmada: boolean
  status: string
  custoUnitario: number | null
  codigoLote: string | null
}

interface Alerta {
  insumoId: number
  nome: string
  estoqueAtual: number
  diasRestantes: number | null
  mensagemAI: string
  urgencia: 'critico' | 'alerta' | 'ok'
}

interface ResumoSemanal {
  periodo: { inicio: string; fim: string }
  totalConsumido: number
  custoSemana: number
  insumosZerados: string[]
  insumosAbaixoMinimo: string[]
  topConsumo: { nome: string; quantidade: number; custo: number }[]
  tendenciaCustos: 'alta' | 'estavel' | 'queda'
  acoes: string[]
  narrativa: string
}

interface TendenciaInsumo {
  tendencia: 'crescente' | 'estavel' | 'decrescente'
  percentualMudanca: number
  narrativa: string
}

interface AvaliacaoFornecedor {
  fornecedorId: number
  nome: string
  notaGeral: number
  notaConfiabilidade: number
  notaCusto: number
  notaQualidade: number
  totalLotes: number
  totalGasto: number
  narrativa: string
  recomendacao: 'manter' | 'avaliar' | 'substituir'
}

const CATEGORIAS = [
  'Endodontia', 'Luvas/EPI', 'Anestesia', 'Restauração',
  'Limpeza/Esterilização', 'Prótese', 'Radiografia', 'Ortodontia',
  'Exodontia', 'Periodontia', 'Cirurgia Periodontal', 'Medicamentos', 'Outros',
]

const SUBCATEGORIAS_MAP: Record<string, string[]> = {
  'Endodontia': ['Limas Manuais', 'Limas Rotatórias', 'Cones', 'Seladores/Cimentos', 'Irrigação'],
  'Anestesia': ['Com Vasoconstritor', 'Sem Vasoconstritor', 'Tópica'],
  'Restauração': ['Resinas', 'Adesivos', 'Ácidos', 'Ionômeros', 'Acabamento'],
  'Luvas/EPI': ['Luvas', 'Sugadores', 'Lençol de Borracha'],
  'Limpeza/Esterilização': ['Pasta Profilática', 'Escovas', 'Pedra Pomes'],
  'Medicamentos': ['Anti-inflamatório', 'Curativo', 'Clareador'],
  'Exodontia': ['Fios de Sutura', 'Lâminas'],
  'Outros': ['Brocas', 'Microbrush', 'Tiras'],
}

interface NFeResumo {
  id: number
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  valorTotal: number
}

interface LoteCompleto {
  id: number
  insumoId: number
  insumo: {
    id: number
    nome: string
    grupoCategoria: string | null
    subcategoria: string | null
    unidadeMedida: string
    unidadeUso: string | null
    estoqueMinimo: number
    usosMin: number
    usosMax: number
  }
  fornecedor: { id: number; cnpj: string; nome: string } | null
  nfeImport: NFeResumo | null
  codigoLote: string | null
  quantidade: number
  quantidadeAtual: number
  custoUnitario: number | null
  validade: string | null
  validadeConfirmada: boolean
  status: string
  unidadeCompra: string | null
  fatorConversao: number | null
  quantidadeCompra: number | null
  taxaUsoMensal: number
}

type Tab = 'estoque' | 'lotes' | 'alertas' | 'fornecedores' | 'notas' | 'catalogo'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function diasRestantes(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.floor(diff / 86400000)
}

function badgeValidade(dateStr: string | null, confirmada: boolean) {
  if (!dateStr) {
    return (
      <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>
        ⚠ Sem validade
      </span>
    )
  }
  const dias = diasRestantes(dateStr)!
  if (dias < 0) return <span className="badge badge-rose">Vencido</span>
  if (dias <= 30) return <span className="badge badge-rose">{formatDate(dateStr)}</span>
  if (dias <= 90) return <span className="badge badge-amber">{formatDate(dateStr)}</span>
  return (
    <span className={`badge ${confirmada ? 'badge-emerald' : 'badge-teal'}`}>
      {formatDate(dateStr)}
    </span>
  )
}

// ─── BaixaModal ──────────────────────────────────────────────────────────────

function BaixaModal({
  loteId,
  lote,
  onClose,
  onSaved,
}: {
  loteId: number
  lote: LoteCompleto
  onClose: () => void
  onSaved: (qtdBaixada: number) => void
}) {
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState<'PERDA' | 'VENCIMENTO' | 'DANO' | 'OUTRO'>('PERDA')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    const qtd = parseFloat(quantidade)
    if (!qtd || qtd <= 0) { setErro('Informe a quantidade'); return }
    if (qtd > lote.quantidadeAtual) { setErro('Quantidade maior que o estoque'); return }
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/estoque/lotes/${loteId}/baixa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: qtd, motivo, observacao }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao registrar')
      }
      onSaved(qtd)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card" style={{ width: 400, padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Registrar Baixa</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ marginBottom: '16px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
          <strong>{lote.insumo.nome}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
            Atual: {lote.quantidadeAtual} {lote.insumo.unidadeUso ?? lote.insumo.unidadeMedida}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Motivo</label>
            <select className="input" style={{ width: '100%' }} value={motivo} onChange={(e) => setMotivo(e.target.value as typeof motivo)}>
              <option value="PERDA">Perda</option>
              <option value="VENCIMENTO">Vencimento</option>
              <option value="DANO">Dano</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Quantidade a baixar *</label>
            <input
              type="number" min="0.01" step="0.01" max={lote.quantidadeAtual}
              className="input" style={{ width: '100%' }}
              value={quantidade} onChange={(e) => setQuantidade(e.target.value)}
              placeholder={`máx ${lote.quantidadeAtual}`}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Observação (opcional)</label>
            <input
              type="text" className="input" style={{ width: '100%' }}
              value={observacao} onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: produto amassado..."
            />
          </div>
          {erro && <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{ background: 'var(--accent-amber)' }}>
              {salvando ? 'Salvando...' : 'Registrar Baixa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── EntradaLoteModal ─────────────────────────────────────────────────────────

interface EntradaLoteForm {
  unidadeCompra: string
  fatorConversao: string
  quantidadeCompra: string
  unidadeUso: string
  validade: string
  custoUnitario: string
}

function EntradaLoteModal({
  insumoId,
  insumos,
  onClose,
  onSaved,
}: {
  insumoId: number
  insumos: LoteCompleto['insumo'][]
  onClose: () => void
  onSaved: () => void
}) {
  const insumo = insumos.find((i) => i.id === insumoId)
  const [form, setForm] = useState<EntradaLoteForm>({
    unidadeCompra: '', fatorConversao: '', quantidadeCompra: '',
    unidadeUso: insumo?.unidadeUso ?? '', validade: '', custoUnitario: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const qtdCompra = parseFloat(form.quantidadeCompra) || 0
  const fator = parseFloat(form.fatorConversao) || 0
  const preview = qtdCompra > 0 && fator > 0 ? qtdCompra * fator : qtdCompra > 0 ? qtdCompra : 0
  const unidadeLabel = form.unidadeUso || insumo?.unidadeMedida || 'unid'

  async function salvar() {
    if (!form.quantidadeCompra || parseFloat(form.quantidadeCompra) <= 0) {
      setErro('Informe a quantidade comprada'); return
    }
    setSalvando(true); setErro(null)
    try {
      const payload: Record<string, unknown> = { insumoId, quantidadeCompra: parseFloat(form.quantidadeCompra) }
      if (form.unidadeCompra) payload.unidadeCompra = form.unidadeCompra
      if (fator > 0) payload.fatorConversao = fator
      if (!fator) payload.quantidade = parseFloat(form.quantidadeCompra)
      if (form.validade) payload.validade = new Date(form.validade).toISOString()
      if (form.custoUnitario) payload.custoUnitario = parseFloat(form.custoUnitario)

      const res = await fetch('/api/estoque/lotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erro') }

      if (form.unidadeUso && form.unidadeUso !== insumo?.unidadeUso) {
        await fetch(`/api/estoque/insumos/${insumoId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unidadeUso: form.unidadeUso }),
        })
      }
      onSaved(); onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSalvando(false) }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card" style={{ width: 420, padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Entrada de Estoque</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        {insumo && (
          <div style={{ marginBottom: '16px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
            <strong>{insumo.nome}</strong>
            {insumo.grupoCategoria && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{insumo.grupoCategoria}</span>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Qtd comprada *</label>
              <input type="number" min="0" step="0.01" className="input" value={form.quantidadeCompra} onChange={(e) => setForm((f) => ({ ...f, quantidadeCompra: e.target.value }))} placeholder="ex: 10" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Unidade de compra</label>
              <input type="text" className="input" value={form.unidadeCompra} onChange={(e) => setForm((f) => ({ ...f, unidadeCompra: e.target.value }))} placeholder="ex: CX, FR, PCT" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>1 {form.unidadeCompra || 'unid'} equivale a</label>
              <input type="number" min="0" step="0.01" className="input" value={form.fatorConversao} onChange={(e) => setForm((f) => ({ ...f, fatorConversao: e.target.value }))} placeholder="ex: 50" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Unidade de uso</label>
              <input type="text" className="input" value={form.unidadeUso} onChange={(e) => setForm((f) => ({ ...f, unidadeUso: e.target.value }))} placeholder="ex: luvas, ml, unid" />
            </div>
          </div>
          {preview > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(20,184,166,0.1)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--accent-teal)', borderLeft: '3px solid var(--accent-teal)' }}>
              → Entrará no estoque: <strong>{preview} {unidadeLabel}</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Validade</label>
              <input type="month" className="input" value={form.validade} onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value ? e.target.value + '-01' : '' }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Custo unitário (R$)</label>
              <input type="number" min="0" step="0.01" className="input" value={form.custoUnitario} onChange={(e) => setForm((f) => ({ ...f, custoUnitario: e.target.value }))} placeholder="0,00" />
            </div>
          </div>
          {erro && <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', padding: '6px 10px', background: 'rgba(244,63,94,0.1)', borderRadius: 4 }}>{erro}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Registrar Entrada'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EstoquePage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('estoque')
  const [insumos, setInsumos] = useState<InsumoResumo[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [vencendo30, setVencendo30] = useState<{ nome: string; lotes: { validade: string | null; quantidadeAtual: number }[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAlertas, setLoadingAlertas] = useState(false)
  const [search, setSearch] = useState('')
  const [showNFeModal, setShowNFeModal] = useState(false)
  const [showNovoInsumoModal, setShowNovoInsumoModal] = useState(false)
  const [novoInsumo, setNovoInsumo] = useState({ nome: '', unidadeMedida: 'UN', unidadeUso: '', grupoCategoria: '', estoqueMinimo: 5 })
  const [salvandoInsumo, setSalvandoInsumo] = useState(false)
  const [showResumoModal, setShowResumoModal] = useState(false)
  const [resumoSemanal, setResumoSemanal] = useState<ResumoSemanal | null>(null)
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [tendencias, setTendencias] = useState<Record<number, TendenciaInsumo>>({})
  const [lotes, setLotes] = useState<LoteCompleto[]>([])
  const [loadingLotes, setLoadingLotes] = useState(true)
  const [searchLotes, setSearchLotes] = useState('')
  const debouncedSearch = useDebounce(searchLotes, 200)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroSubcategoria, setFiltroSubcategoria] = useState('')
  const [editandoCategoria, setEditandoCategoria] = useState<number | null>(null)
  const [baixaLoteId, setBaixaLoteId] = useState<number | null>(null)
  const [entradaInsumoId, setEntradaInsumoId] = useState<number | null>(null)

  async function abrirResumoIA() {
    setShowResumoModal(true)
    if (resumoSemanal) return
    setLoadingResumo(true)
    try {
      const res = await fetch('/api/estoque/ai/resumo-semanal')
      const data = await res.json()
      setResumoSemanal(data)
    } catch {
      // silencioso
    } finally {
      setLoadingResumo(false)
    }
  }

  async function carregarTendencia(insumoId: number) {
    if (tendencias[insumoId]) return
    try {
      const res = await fetch(`/api/estoque/ai/tendencia?insumoId=${insumoId}`)
      const data = await res.json()
      setTendencias((prev) => ({ ...prev, [insumoId]: data }))
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    if (tab === 'alertas' && alertas.length > 0) {
      alertas.forEach((a) => carregarTendencia(a.insumoId))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertas, tab])

  const fetchInsumos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/estoque/insumos')
      const data = await res.json()
      setInsumos(data)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAlertas = useCallback(async () => {
    setLoadingAlertas(true)
    try {
      const res = await fetch('/api/estoque/alertas')
      const data = await res.json()
      setAlertas(data.alertas ?? [])
      setVencendo30(data.vencendoEm30 ?? [])
    } catch {
      // silencioso
    } finally {
      setLoadingAlertas(false)
    }
  }, [])

  const fetchLotes = useCallback(async () => {
    setLoadingLotes(true)
    try {
      const res = await fetch('/api/estoque/lotes?comTaxa=true')
      const data = await res.json()
      setLotes(data)
    } catch {
      // silencioso
    } finally {
      setLoadingLotes(false)
    }
  }, [])

  useEffect(() => {
    fetchInsumos()
  }, [fetchInsumos])

  useEffect(() => {
    if (tab === 'alertas') fetchAlertas()
  }, [tab, fetchAlertas])

  useEffect(() => {
    if (tab === 'estoque') fetchLotes()
  }, [tab, fetchLotes])

  const insumosFiltered = insumos.filter((i) =>
    i.nome.toLowerCase().includes(search.toLowerCase()) ||
    (i.grupoCategoria ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalItens = lotes.filter((l) => l.status === 'ATIVO').length
  const totalCriticos = lotes.filter((l) => l.status === 'ATIVO' && l.quantidadeAtual <= l.insumo.estoqueMinimo).length
  const totalSemValidade = lotes.filter((l) => l.status === 'ATIVO' && !l.validade).length

  async function salvarNovoInsumo() {
    if (!novoInsumo.nome.trim()) return
    setSalvandoInsumo(true)
    try {
      await fetch('/api/estoque/insumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoInsumo),
      })
      setShowNovoInsumoModal(false)
      setNovoInsumo({ nome: '', unidadeMedida: 'UN', unidadeUso: '', grupoCategoria: '', estoqueMinimo: 5 })
      fetchInsumos()
      toast('Insumo cadastrado', 'success')
    } finally {
      setSalvandoInsumo(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Estoque</h1>
          <p>Controle de insumos, lotes, validades e reabastecimento</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={abrirResumoIA}
          >
            <BarChart2 size={14} /> Resumo IA
          </button>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowNovoInsumoModal(true)}
          >
            <Plus size={14} /> Novo Insumo
          </button>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowNFeModal(true)}
          >
            <Upload size={14} /> Importar NF-e
          </button>
          <a
            href="/estoque/contagem"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <ClipboardList size={14} /> Contagem
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon"><Package size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Lotes Ativos</div>
          <div className="stat-card-value">{totalItens}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-icon"><AlertTriangle size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Estoque Crítico</div>
          <div className="stat-card-value">{totalCriticos}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon"><Clock size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Sem Validade</div>
          <div className="stat-card-value">{totalSemValidade}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        {(['estoque', 'lotes', 'alertas', 'fornecedores', 'notas', 'catalogo'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent-teal)' : '2px solid transparent',
              color: tab === t ? 'var(--accent-teal)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: tab === t ? 600 : 400,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
            }}
          >
            {t === 'estoque' && <Package size={13} />}
            {t === 'lotes' && <Truck size={13} />}
            {t === 'alertas' && <Zap size={13} />}
            {t === 'fornecedores' && <RefreshCw size={13} />}
            {t === 'notas' && <FileText size={13} />}
            {t === 'catalogo' && <ClipboardList size={13} />}
            {t === 'alertas' && alertas.length > 0
              ? `Alertas (${alertas.length})`
              : t === 'notas'
                ? 'Notas Fiscais'
                : t === 'fornecedores'
                  ? 'Fornecedores'
                  : t === 'catalogo'
                    ? 'Catálogo'
                    : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab: Estoque */}
      {tab === 'estoque' && (
        <div className="tab-content-enter" key="tab-estoque">
          <div className="filter-row" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div className="search-bar" style={{ flex: 1 }}>
              <span className="search-bar-icon"><Search size={14} /></span>
              <input
                placeholder="Buscar produto, fornecedor ou NF-e..."
                value={searchLotes}
                onChange={(e) => setSearchLotes(e.target.value)}
                suppressHydrationWarning
              />
            </div>
            <select
              className="input"
              style={{ width: '160px' }}
              value={filtroCategoria}
              onChange={(e) => { setFiltroCategoria(e.target.value); setFiltroSubcategoria('') }}
            >
              <option value="">Todas categorias</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {filtroCategoria && SUBCATEGORIAS_MAP[filtroCategoria] && (
              <select className="input" style={{ width: '150px' }} value={filtroSubcategoria}
                onChange={(e) => setFiltroSubcategoria(e.target.value)}>
                <option value="">Todas sub</option>
                {SUBCATEGORIAS_MAP[filtroCategoria].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          {loadingLotes ? (
            <SkeletonTable rows={6} cols={8} />
          ) : (
            <div className="glass-card" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr style={{ userSelect: 'none', fontSize: '0.7rem' }}>
                      <th style={{ textAlign: 'center' }}>Produto</th>
                      <th style={{ textAlign: 'center' }}>Categoria</th>
                      <th style={{ textAlign: 'center' }}>NF-e</th>
                      <th style={{ textAlign: 'center' }}>Vlr. Nota</th>
                      <th style={{ textAlign: 'center' }}>Qtd</th>
                      <th style={{ textAlign: 'center' }}>Vlr/item</th>
                      <th style={{ textAlign: 'center' }}>Vlr/uso</th>
                      <th style={{ textAlign: 'center' }}>Lote</th>
                      <th style={{ textAlign: 'center' }}>Validade</th>
                      <th style={{ textAlign: 'center' }}>Taxa/mês</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes
                      .filter((l) => {
                        if (l.status === 'DESCARTADO') return false
                        const q = debouncedSearch.toLowerCase()
                        if (q && !l.insumo.nome.toLowerCase().includes(q) &&
                            !l.nfeImport?.numero.includes(q) &&
                            !(l.fornecedor?.nome ?? '').toLowerCase().includes(q)) return false
                        if (filtroCategoria && l.insumo.grupoCategoria !== filtroCategoria) return false
                        if (filtroSubcategoria && l.insumo.subcategoria !== filtroSubcategoria) return false
                        return true
                      })
                      .map((lote) => (
                        <tr key={lote.id} style={{ opacity: lote.status === 'ESGOTADO' ? 0.5 : 1, userSelect: 'none', fontSize: '0.7rem' }}>
                          <td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: '150px', textAlign: 'center' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lote.insumo.nome}
                            </div>
                            {lote.insumo.grupoCategoria === null && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--accent-amber)' }}>⚠ sem categoria</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {editandoCategoria === lote.id ? (
                              <select
                                className="input"
                                style={{ padding: '2px 4px', fontSize: '0.73rem' }}
                                defaultValue={lote.insumo.grupoCategoria ?? ''}
                                autoFocus
                                onBlur={async (e) => {
                                  const novaCategoria = e.target.value || null
                                  try {
                                    await fetch(`/api/estoque/lotes/${lote.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ grupoCategoria: novaCategoria }),
                                    })
                                  } catch {
                                    // silencioso — categoria reverte visualmente
                                  }
                                  setEditandoCategoria(null)
                                  fetchLotes()
                                }}
                              >
                                <option value="">— sem categoria —</option>
                                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : (
                              <span
                                className={`badge ${lote.insumo.grupoCategoria ? 'badge-teal' : 'badge-amber'}`}
                                style={{ cursor: 'pointer', fontSize: '0.68rem' }}
                                onClick={() => setEditandoCategoria(lote.id)}
                                title="Clique para editar"
                              >
                                {lote.insumo.grupoCategoria ?? 'definir'}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {lote.nfeImport ? `NF ${lote.nfeImport.numero}/${lote.nfeImport.serie}` : '—'}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lote.nfeImport
                              ? `R$ ${lote.nfeImport.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {lote.quantidadeAtual}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginLeft: 2 }}>
                              {lote.insumo.unidadeUso ?? lote.insumo.unidadeMedida}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {lote.custoUnitario != null ? `R$ ${lote.custoUnitario.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {(() => {
                              if (!lote.custoUnitario) return '—'
                              const usosMedio = (lote.insumo.usosMin + lote.insumo.usosMax) / 2
                              if (usosMedio <= 1) return '—'
                              const vlrUso = lote.custoUnitario / usosMedio
                              return (
                                <span title={`R$ ${lote.custoUnitario.toFixed(2)} ÷ ${usosMedio} usos`} style={{ color: 'var(--accent-teal)' }}>
                                  R$ {vlrUso.toFixed(2)}
                                </span>
                              )
                            })()}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {lote.codigoLote ?? '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {badgeValidade(lote.validade, lote.validadeConfirmada)}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {lote.taxaUsoMensal > 0
                              ? <span style={{ color: 'var(--accent-teal)' }}>{lote.taxaUsoMensal.toFixed(1)}/mês</span>
                              : <span>—</span>
                            }
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '3px 7px', fontSize: '0.72rem' }}
                                onClick={() => setEntradaInsumoId(lote.insumoId)}
                                title="Entrada de estoque"
                              >
                                <Plus size={11} />
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '3px 7px', fontSize: '0.72rem', color: 'var(--accent-amber)' }}
                                onClick={() => setBaixaLoteId(lote.id)}
                                title="Registrar baixa/perda"
                                disabled={lote.quantidadeAtual <= 0}
                              >
                                <Minus size={11} />
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '3px 7px', fontSize: '0.72rem', color: 'var(--accent-rose)' }}
                                onClick={async () => {
                                  if (!confirm(`Remover lote de "${lote.insumo.nome}"?`)) return
                                  const prev = lotes
                                  setLotes((cur) => cur.filter((l) => l.id !== lote.id))
                                  toast('Lote removido', 'success')
                                  const res = await fetch(`/api/estoque/lotes/${lote.id}`, { method: 'DELETE' })
                                  if (!res.ok) {
                                    setLotes(prev)
                                    toast('Erro ao remover lote', 'error')
                                  }
                                }}
                                title="Remover lote"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {lotes.filter((l) => l.status !== 'DESCARTADO').length === 0 && (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          Nenhum item no estoque. Importe uma NF-e ou cadastre manualmente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {baixaLoteId !== null && (
            <BaixaModal
              loteId={baixaLoteId}
              lote={lotes.find((l) => l.id === baixaLoteId)!}
              onClose={() => setBaixaLoteId(null)}
              onSaved={(qtdBaixada: number) => {
                setLotes((prev) => prev.map((l) => {
                  if (l.id !== baixaLoteId) return l
                  const novaQtd = l.quantidadeAtual - qtdBaixada
                  return { ...l, quantidadeAtual: novaQtd, status: novaQtd <= 0 ? 'ESGOTADO' : l.status }
                }))
                setBaixaLoteId(null)
                toast('Baixa registrada', 'success')
              }}
            />
          )}
          {entradaInsumoId !== null && (
            <EntradaLoteModal
              insumoId={entradaInsumoId}
              insumos={lotes.map((l) => l.insumo)}
              onClose={() => setEntradaInsumoId(null)}
              onSaved={() => {
                setEntradaInsumoId(null)
                toast('Entrada registrada', 'success')
                fetchLotes()
              }}
            />
          )}
        </div>
      )}

      {/* Tab: Lotes (FEFO) */}
      {tab === 'lotes' && <div className="tab-content-enter" key="tab-lotes"><LotesTab /></div>}

      {/* Tab: Alertas IA */}
      {tab === 'alertas' && (
        <div className="tab-content-enter" key="tab-alertas">
          {loadingAlertas ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Gerando alertas com IA...
            </div>
          ) : alertas.length === 0 && vencendo30.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
              <Zap size={32} style={{ color: 'var(--accent-emerald)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum alerta crítico no momento.</p>
            </div>
          ) : (
            <>
              {alertas.map((alerta) => {
                const tend = tendencias[alerta.insumoId]
                return (
                  <div
                    key={alerta.insumoId}
                    className="glass-card"
                    style={{
                      marginBottom: '12px',
                      borderLeft: `3px solid ${alerta.urgencia === 'critico' ? 'var(--accent-rose)' : 'var(--accent-amber)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span className={`badge ${alerta.urgencia === 'critico' ? 'badge-rose' : 'badge-amber'}`}>
                            {alerta.urgencia === 'critico' ? '🔴 Crítico' : '🟡 Alerta'}
                          </span>
                          <strong>{alerta.nome}</strong>
                          {tend && (
                            <span
                              className={`badge ${tend.tendencia === 'crescente' ? 'badge-rose' : tend.tendencia === 'decrescente' ? 'badge-teal' : 'badge-amber'}`}
                              style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}
                              title={tend.narrativa}
                            >
                              {tend.tendencia === 'crescente' ? <TrendingUp size={10} /> : tend.tendencia === 'decrescente' ? <TrendingDown size={10} /> : <Minus size={10} />}
                              {tend.tendencia === 'crescente' ? `+${tend.percentualMudanca}%` : tend.tendencia === 'decrescente' ? `${tend.percentualMudanca}%` : 'Estável'}
                            </span>
                          )}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                          {alerta.mensagemAI}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                        <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{alerta.estoqueAtual}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>em estoque</div>
                        {alerta.diasRestantes !== null && (
                          <div style={{ color: alerta.urgencia === 'critico' ? 'var(--accent-rose)' : 'var(--accent-amber)', fontSize: '0.8rem', marginTop: '4px' }}>
                            ~{alerta.diasRestantes} dias
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {vencendo30.length > 0 && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} /> Vencendo em 30 dias
                  </h3>
                  {vencendo30.map((item, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}
                    >
                      <span>{item.nome}</span>
                      <span className="badge badge-amber">
                        {formatDate(item.lotes[0]?.validade ?? null)} · {item.lotes[0]?.quantidadeAtual} un
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Fornecedores */}
      {tab === 'fornecedores' && <div className="tab-content-enter" key="tab-fornecedores"><FornecedoresTab /></div>}

      {/* Tab: Notas Fiscais */}
      {tab === 'notas' && <div className="tab-content-enter" key="tab-notas"><NotasTab /></div>}

      {tab === 'catalogo' && <div className="tab-content-enter" key="tab-catalogo"><CatalogoTab /></div>}

      {/* Modal Resumo IA */}
      {showResumoModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowResumoModal(false)}
        >
          <div
            className="glass-card"
            style={{ width: '560px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} /> Resumo Semanal IA
              </h3>
              <button onClick={() => setShowResumoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {loadingResumo ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                Gerando resumo com IA...
              </div>
            ) : resumoSemanal ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{resumoSemanal.narrativa}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Custo da semana</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>R$ {resumoSemanal.custoSemana.toFixed(2)}</div>
                    <span className={`badge ${resumoSemanal.tendenciaCustos === 'alta' ? 'badge-rose' : resumoSemanal.tendenciaCustos === 'queda' ? 'badge-teal' : 'badge-amber'}`} style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                      {resumoSemanal.tendenciaCustos === 'alta' ? '↑ Alta' : resumoSemanal.tendenciaCustos === 'queda' ? '↓ Queda' : '→ Estável'}
                    </span>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total consumido</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{resumoSemanal.totalConsumido} un</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{resumoSemanal.periodo.inicio} → {resumoSemanal.periodo.fim}</div>
                  </div>
                </div>

                {resumoSemanal.topConsumo.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '8px', fontSize: '0.9rem' }}>Top Consumo</h4>
                    <div className="glass-card" style={{ padding: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Insumo</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Qtd</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Custo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumoSemanal.topConsumo.map((item, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{item.nome}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.85rem' }}>{item.quantidade}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.85rem' }}>R$ {item.custo.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {resumoSemanal.acoes.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '8px', fontSize: '0.9rem' }}>Ações Sugeridas</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {resumoSemanal.acoes.map((acao, i) => (
                        <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{acao}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {resumoSemanal.insumosAbaixoMinimo.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '8px', fontSize: '0.9rem', color: 'var(--accent-rose)' }}>Abaixo do Mínimo</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {resumoSemanal.insumosAbaixoMinimo.map((nome, i) => (
                        <span key={i} className="badge badge-rose">{nome}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Erro ao carregar resumo.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal NF-e Upload */}
      {showNFeModal && (
        <NFeUploadModal
          onClose={() => setShowNFeModal(false)}
          onImported={() => { setShowNFeModal(false); fetchInsumos(); fetchLotes(); toast('NF-e importada com sucesso!', 'success') }}
        />
      )}

      {/* Modal Novo Insumo */}
      {showNovoInsumoModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowNovoInsumoModal(false)}
        >
          <div
            className="glass-card"
            style={{ width: '420px', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3>Novo Insumo</h3>
              <button onClick={() => setShowNovoInsumoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nome *</label>
                <input
                  className="input"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={novoInsumo.nome}
                  onChange={(e) => setNovoInsumo((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Hipoclorito de Sódio 2.5%"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Unidade</label>
                  <select
                    className="input"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={novoInsumo.unidadeMedida}
                    onChange={(e) => setNovoInsumo((p) => ({ ...p, unidadeMedida: e.target.value }))}
                  >
                    {['UN', 'CX', 'FR', 'ML', 'G', 'KG', 'PC'].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estoque mínimo</label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={novoInsumo.estoqueMinimo}
                    onChange={(e) => setNovoInsumo((p) => ({ ...p, estoqueMinimo: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Unidade de uso</label>
                <input
                  className="input"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={novoInsumo.unidadeUso}
                  onChange={(e) => setNovoInsumo((p) => ({ ...p, unidadeUso: e.target.value }))}
                  placeholder="Ex: luvas, ml, unid"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Categoria</label>
                <input
                  className="input"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={novoInsumo.grupoCategoria}
                  onChange={(e) => setNovoInsumo((p) => ({ ...p, grupoCategoria: e.target.value }))}
                  placeholder="Ex: Anestesia, EPI, Endodontia..."
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowNovoInsumoModal(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={salvarNovoInsumo} disabled={salvandoInsumo || !novoInsumo.nome}>
                  {salvandoInsumo ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componente: Notas Fiscais ───────────────────────────────────────────

interface LoteNota {
  id: number
  nomeProduto: string
  categoria: string | null
  quantidade: number
  custoUnitario: number | null
  validade: string | null
  codigoLote: string | null
  status: string
  unidadeMedida: string
}

interface NotaFiscal {
  id: number
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  valorTotal: number
  xmlPath: string | null
  fornecedor: { cnpj: string; nome: string }
  totalProdutos: number
  lotes: LoteNota[]
}

function NotasTab() {
  const { toast } = useToast()
  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const [exportando, setExportando] = useState(false)

  function carregarNotas() {
    setLoading(true)
    setErro(null)
    fetch('/api/estoque/nfe')
      .then((r) => {
        if (!r.ok) throw new Error('Erro')
        return r.json()
      })
      .then(setNotas)
      .catch(() => setErro('Erro ao carregar notas fiscais. Tente novamente.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregarNotas() }, [])

  function toggleExpand(id: number) {
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function exportarExcel() {
    setExportando(true)
    try {
      const res = await fetch('/api/estoque/nfe/export')
      if (!res.ok) throw new Error('Erro')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estoque_notas_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Erro ao exportar Excel', 'error')
    } finally {
      setExportando(false)
    }
  }

  async function downloadNota(notaId: number) {
    const res = await fetch(`/api/estoque/nfe/${notaId}/download`)
    if (!res.ok) { toast('Arquivo não disponível', 'warning'); return }
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') ?? ''
    const match = cd.match(/filename="([^"]+)"/)
    const filename = match?.[1] ?? `nota_${notaId}`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deletarNota(notaId: number, numero: string) {
    if (!confirm(`Remover NF ${numero} e todos os seus lotes?`)) return
    const res = await fetch(`/api/estoque/nfe/${notaId}`, { method: 'DELETE' })
    if (!res.ok) { toast('Erro ao remover nota', 'error'); return }
    toast(`NF ${numero} removida`, 'success')
    carregarNotas()
  }

  const totalProdutos = notas.reduce((s, n) => s + n.totalProdutos, 0)
  const valorTotal = notas.reduce((s, n) => s + n.valorTotal, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Notas: </span>
            <strong>{notas.length}</strong>
          </div>
          <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Produtos: </span>
            <strong>{totalProdutos}</strong>
          </div>
          <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total: </span>
            <strong>{valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            onClick={carregarNotas}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            onClick={exportarExcel}
            disabled={exportando || notas.length === 0}
          >
            <Table size={13} /> {exportando ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {erro && (
        <div style={{ padding: '12px 16px', background: 'rgba(244,63,94,0.1)', borderRadius: '8px', color: 'var(--accent-rose)', marginBottom: '12px', fontSize: '0.85rem' }}>
          {erro}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '4px' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="skeleton" style={{ width: '180px', height: '14px' }} />
                  <div className="skeleton" style={{ width: '260px', height: '10px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <div className="skeleton" style={{ width: '90px', height: '14px' }} />
                  <div className="skeleton" style={{ width: '70px', height: '10px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : notas.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhuma NF-e importada. Use &quot;Importar NF-e&quot; acima.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notas.map((nota) => {
            const expandida = expandidas.has(nota.id)
            return (
              <div key={nota.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', cursor: 'pointer',
                    borderBottom: expandida ? '1px solid var(--border)' : 'none',
                    userSelect: 'none',
                  }}
                  onClick={() => toggleExpand(nota.id)}
                >
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    {expandida ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>NF {nota.numero}/{nota.serie}</span>
                      <span className="badge badge-teal" style={{ fontSize: '0.68rem' }}>
                        {nota.totalProdutos} prod{nota.totalProdutos !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {nota.fornecedor.nome} · {nota.fornecedor.cnpj}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {nota.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(nota.dataEmissao).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                      onClick={() => downloadNota(nota.id)}
                      disabled={!nota.xmlPath}
                      title={nota.xmlPath ? 'Baixar arquivo original' : 'Arquivo não disponível'}
                    >
                      <Download size={11} /> Baixar
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--accent-rose)' }}
                      onClick={() => deletarNota(nota.id, nota.numero)}
                      title="Remover nota e seus lotes"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>

                {expandida && (
                  <div className="table-container accordion-enter">
                    <table style={{ fontSize: '0.7rem' }}>
                      <thead>
                        <tr style={{ userSelect: 'none' }}>
                          <th style={{ textAlign: 'center' }}>Produto</th>
                          <th style={{ textAlign: 'center' }}>Categoria</th>
                          <th style={{ textAlign: 'center' }}>Qtd</th>
                          <th style={{ textAlign: 'center' }}>Vlr. Unit.</th>
                          <th style={{ textAlign: 'center' }}>Vlr. Total</th>
                          <th style={{ textAlign: 'center' }}>Lote</th>
                          <th style={{ textAlign: 'center' }}>Validade</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nota.lotes.map((lote) => (
                          <tr key={lote.id} style={{ userSelect: 'none' }}>
                            <td style={{ fontWeight: 500, textAlign: 'center' }}>{lote.nomeProduto}</td>
                            <td style={{ textAlign: 'center' }}>
                              {lote.categoria
                                ? <span className="badge badge-teal" style={{ fontSize: '0.68rem' }}>{lote.categoria}</span>
                                : <span style={{ color: 'var(--text-muted)' }}>—</span>
                              }
                            </td>
                            <td style={{ textAlign: 'center' }}>{lote.quantidade} {lote.unidadeMedida}</td>
                            <td style={{ textAlign: 'center' }}>
                              {lote.custoUnitario != null ? lote.custoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {lote.custoUnitario != null
                                ? (lote.custoUnitario * lote.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : '—'}
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{lote.codigoLote ?? '—'}</td>
                            <td style={{ textAlign: 'center' }}>
                              {lote.validade
                                ? new Date(lote.validade).toLocaleDateString('pt-BR')
                                : <span style={{ color: 'var(--accent-amber)' }}>⚠ pendente</span>
                              }
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${
                                lote.status === 'ATIVO' ? 'badge-emerald' :
                                lote.status === 'ESGOTADO' ? 'badge-amber' : 'badge-rose'
                              }`} style={{ fontSize: '0.68rem' }}>
                                {lote.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sub-componente: Lotes ────────────────────────────────────────────────────

function LotesTab() {
  const [lotes, setLotes] = useState<(LoteResumo & { insumo: { nome: string }; fornecedor: { nome: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [editandoValidade, setEditandoValidade] = useState<number | null>(null)
  const [novaValidade, setNovaValidade] = useState('')

  useEffect(() => {
    fetch('/api/estoque/lotes?fefo=true')
      .then((r) => r.json())
      .then(setLotes)
      .finally(() => setLoading(false))
  }, [])

  async function salvarValidade(loteId: number) {
    await fetch(`/api/estoque/lotes/${loteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validade: novaValidade ? new Date(novaValidade).toISOString() : null, validadeConfirmada: true }),
    })
    setLotes((prev) =>
      prev.map((l) =>
        l.id === loteId ? { ...l, validade: novaValidade || null, validadeConfirmada: true } : l
      )
    )
    setEditandoValidade(null)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando lotes...</div>
  }

  return (
    <div className="glass-card" style={{ padding: 0 }}>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Fornecedor</th>
              <th style={{ textAlign: 'center' }}>Qtd. Atual</th>
              <th>Validade</th>
              <th>Status</th>
              <th>Custo Unit.</th>
            </tr>
          </thead>
          <tbody>
            {lotes.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Nenhum lote cadastrado.</td></tr>
            ) : (
              lotes.map((lote) => (
                <tr key={lote.id}>
                  <td style={{ fontWeight: 500 }}>{lote.insumo?.nome ?? '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{lote.fornecedor?.nome ?? '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{lote.quantidadeAtual}</td>
                  <td>
                    {editandoValidade === lote.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          type="date"
                          className="input"
                          style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                          value={novaValidade}
                          onChange={(e) => setNovaValidade(e.target.value)}
                        />
                        <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => salvarValidade(lote.id)}>
                          OK
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setEditandoValidade(null)}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        onClick={() => { setEditandoValidade(lote.id); setNovaValidade(lote.validade ? lote.validade.slice(0, 10) : '') }}
                      >
                        {badgeValidade(lote.validade, lote.validadeConfirmada)}
                        {!lote.validadeConfirmada && (
                          <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${lote.status === 'ATIVO' ? 'badge-emerald' : lote.status === 'VENCIDO' ? 'badge-rose' : 'badge-amber'}`}>
                      {lote.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {lote.custoUnitario ? `R$ ${lote.custoUnitario.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Sub-componente: Fornecedores ─────────────────────────────────────────────

interface FornecedorItem {
  id: number
  cnpj: string
  nome: string
  email: string | null
  telefone: string | null
  totalLotes: number
}

function FornecedoresTab() {
  const { toast } = useToast()
  const [fornecedores, setFornecedores] = useState<(FornecedorItem & {
    totalNfe: number
    totalProdutos: number
    totalValorNfe: number
    ultimoPedido: string | null
    produtos: { nome: string; quantidade: number; custoUnitario: number | null }[]
  })[]>([])
  const [loading, setLoading] = useState(true)
  const [avaliacoes, setAvaliacoes] = useState<Record<number, AvaliacaoFornecedor>>({})
  const [loadingAvaliacao, setLoadingAvaliacao] = useState<number | null>(null)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [produtosVisiveis, setProdutosVisiveis] = useState<Set<number>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/estoque/nfe').then((r) => r.json()),
      fetch('/api/estoque/lotes?fefo=true').then((r) => r.json()),
    ])
      .then(([notas, lotes]: [any[], any[]]) => {
        const mapa = new Map<number, {
          id: number; cnpj: string; nome: string; email: string | null; telefone: string | null
          totalLotes: number; totalNfe: number; totalProdutos: Set<string>; totalValorNfe: number
          ultimoPedido: string | null; produtos: Map<string, { nome: string; quantidade: number; custoUnitario: number | null }>
        }>()

        for (const lote of lotes) {
          if (!lote.fornecedor) continue
          const f = lote.fornecedor
          if (!mapa.has(f.id)) {
            mapa.set(f.id, {
              ...f, totalLotes: 0, totalNfe: 0, totalProdutos: new Set(),
              totalValorNfe: 0, ultimoPedido: null, produtos: new Map(),
            })
          }
          const entry = mapa.get(f.id)!
          entry.totalLotes++
          if (lote.insumo?.nome) {
            entry.totalProdutos.add(lote.insumo.nome)
            const key = lote.insumo.nome
            const prev = entry.produtos.get(key)
            entry.produtos.set(key, {
              nome: key,
              quantidade: (prev?.quantidade ?? 0) + (lote.quantidadeAtual ?? 0),
              custoUnitario: lote.custoUnitario ?? prev?.custoUnitario ?? null,
            })
          }
        }

        for (const nota of notas) {
          const fId = nota.fornecedor?.cnpj
            ? Array.from(mapa.values()).find((f) => f.cnpj === nota.fornecedor.cnpj)?.id
            : null
          if (fId && mapa.has(fId)) {
            const entry = mapa.get(fId)!
            entry.totalNfe++
            entry.totalValorNfe += nota.valorTotal ?? 0
            const dataEmissao = nota.dataEmissao ? new Date(nota.dataEmissao).toISOString() : null
            if (dataEmissao && (!entry.ultimoPedido || dataEmissao > entry.ultimoPedido)) {
              entry.ultimoPedido = dataEmissao
            }
          }
        }

        setFornecedores(
          Array.from(mapa.values()).map((f) => ({
            id: f.id, cnpj: f.cnpj, nome: f.nome, email: f.email, telefone: f.telefone,
            totalLotes: f.totalLotes, totalNfe: f.totalNfe, totalProdutos: f.totalProdutos.size,
            totalValorNfe: f.totalValorNfe, ultimoPedido: f.ultimoPedido,
            produtos: Array.from(f.produtos.values()),
          }))
        )
      })
      .catch(() => toast('Erro ao carregar fornecedores', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  async function avaliarFornecedor(fornecedorId: number) {
    if (avaliacoes[fornecedorId]) {
      setExpandidos((prev) => {
        const next = new Set(prev)
        if (next.has(fornecedorId)) next.delete(fornecedorId)
        else next.add(fornecedorId)
        return next
      })
      return
    }
    setLoadingAvaliacao(fornecedorId)
    setExpandidos((prev) => new Set(prev).add(fornecedorId))
    try {
      const res = await fetch(`/api/estoque/ai/fornecedor?fornecedorId=${fornecedorId}`)
      const data = await res.json()
      setAvaliacoes((prev) => ({ ...prev, [fornecedorId]: data }))
    } catch {
      toast('Erro ao avaliar fornecedor', 'error')
    } finally {
      setLoadingAvaliacao(null)
    }
  }

  function toggleProdutos(fId: number) {
    setProdutosVisiveis((prev) => {
      const next = new Set(prev)
      if (next.has(fId)) next.delete(fId)
      else next.add(fId)
      return next
    })
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando fornecedores...</div>
  }

  if (fornecedores.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
        <Truck size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Fornecedores são cadastrados automaticamente ao importar NF-e.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {fornecedores.map((f) => {
        const av = avaliacoes[f.id]
        const expandido = expandidos.has(f.id)
        const mostrarProdutos = produtosVisiveis.has(f.id)

        return (
          <div key={f.id} className="glass-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.nome}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                  CNPJ: {f.cnpj} · {f.totalNfe} NF-e{f.totalNfe !== 1 ? 's' : ''} · {f.totalProdutos} produto{f.totalProdutos !== 1 ? 's' : ''}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                  {f.ultimoPedido && <>Último pedido: {new Date(f.ultimoPedido).toLocaleDateString('pt-BR')} · </>}
                  Total NF-e: <strong style={{ color: 'var(--text-secondary)' }}>R$ {f.totalValorNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.7rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => avaliarFornecedor(f.id)}
                disabled={loadingAvaliacao === f.id}
              >
                <Star size={11} />
                {loadingAvaliacao === f.id ? 'Avaliando...' : av ? (expandido ? 'Recolher' : 'Ver Avaliação') : 'Avaliar IA'}
              </button>
            </div>

            {f.produtos.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => toggleProdutos(f.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--accent-teal)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  {mostrarProdutos ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Ver {f.produtos.length} produto{f.produtos.length !== 1 ? 's' : ''}
                </button>
                {mostrarProdutos && (
                  <div style={{ marginTop: '6px', background: 'var(--bg-elevated)', borderRadius: '6px', padding: '8px 10px' }}>
                    {f.produtos.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.7rem', borderBottom: i < f.produtos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.nome}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {p.quantidade > 0 && <>{p.quantidade} un</>}
                          {p.custoUnitario != null && <> · R$ {p.custoUnitario.toFixed(2)}/un</>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {expandido && av && (
              <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                  {[
                    { label: 'Geral', value: av.notaGeral },
                    { label: 'Confiabilidade', value: av.notaConfiabilidade },
                    { label: 'Custo', value: av.notaCusto },
                    { label: 'Qualidade', value: av.notaQualidade },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: 'center', padding: '4px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{label}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: value >= 8 ? 'var(--accent-emerald)' : value >= 6 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                        {value}/10
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{av.narrativa}</p>
                <span className={`badge ${av.recomendacao === 'manter' ? 'badge-emerald' : av.recomendacao === 'avaliar' ? 'badge-amber' : 'badge-rose'}`} style={{ fontSize: '0.65rem' }}>
                  {av.recomendacao === 'manter' ? '✓ Manter' : av.recomendacao === 'avaliar' ? '⚠ Avaliar' : '✗ Substituir'}
                </span>
              </div>
            )}
            {expandido && !av && loadingAvaliacao === f.id && (
              <div style={{ marginTop: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px' }}>
                Avaliando fornecedor com IA...
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── CatalogoTab ─────────────────────────────────────────────────────────────

function CatalogoTab() {
  const { toast } = useToast()
  const [insumos, setInsumos] = useState<{
    id: number; nome: string; unidadeMedida: string; unidadeUso: string | null
    grupoCategoria: string | null; subcategoria: string | null
    usosMin: number; usosMax: number; estoqueMinimo: number
    fatorConversaoMedio: number | null; custoUnitarioMedio: number | null
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<{ id: number; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [searchCatalogo, setSearchCatalogo] = useState('')
  const [filtroCat, setFiltroCat] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/estoque/insumos').then((r) => r.json()),
      fetch('/api/estoque/lotes?fefo=true').then((r) => r.json()),
    ])
      .then(([insumosData, lotesData]: [any[], any[]]) => {
        const fatorMap = new Map<number, number[]>()
        const custoMap = new Map<number, number[]>()
        for (const lote of lotesData) {
          if (lote.fatorConversao && lote.fatorConversao > 0) {
            fatorMap.set(lote.insumoId, [...(fatorMap.get(lote.insumoId) ?? []), lote.fatorConversao])
          }
          if (lote.custoUnitario && lote.custoUnitario > 0) {
            custoMap.set(lote.insumoId, [...(custoMap.get(lote.insumoId) ?? []), lote.custoUnitario])
          }
        }
        const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

        setInsumos(insumosData.map((i: any) => ({
          id: i.id, nome: i.nome,
          unidadeMedida: i.unidadeMedida ?? 'UN',
          unidadeUso: i.unidadeUso ?? null,
          grupoCategoria: i.grupoCategoria ?? null,
          subcategoria: i.subcategoria ?? null,
          usosMin: i.usosMin ?? 1, usosMax: i.usosMax ?? 1,
          estoqueMinimo: i.estoqueMinimo ?? 5,
          fatorConversaoMedio: fatorMap.has(i.id) ? avg(fatorMap.get(i.id)!) : null,
          custoUnitarioMedio: custoMap.has(i.id) ? avg(custoMap.get(i.id)!) : null,
        })))
      })
      .finally(() => setLoading(false))
  }, [])

  async function salvarCampo(insumoId: number, campo: string, valor: string) {
    const payload: Record<string, unknown> = {}
    if (campo === 'usosMin' || campo === 'usosMax' || campo === 'estoqueMinimo') {
      payload[campo] = parseFloat(valor) || 1
    } else {
      payload[campo] = valor || null
    }
    try {
      const res = await fetch(`/api/estoque/insumos/${insumoId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setInsumos((prev) => prev.map((i) => i.id === insumoId ? { ...i, ...payload } as typeof i : i))
        toast('Salvo', 'success')
      }
    } catch { toast('Erro ao salvar', 'error') }
    setEditando(null)
  }

  function startEdit(id: number, campo: string, currentValue: string) {
    setEditando({ id, campo })
    setEditValue(currentValue)
  }

  const filtered = insumos.filter((i) => {
    if (searchCatalogo && !i.nome.toLowerCase().includes(searchCatalogo.toLowerCase())) return false
    if (filtroCat && i.grupoCategoria !== filtroCat) return false
    return true
  })

  if (loading) return <SkeletonTable rows={8} cols={7} />

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon"><Search size={14} /></span>
          <input placeholder="Buscar produto..." value={searchCatalogo} onChange={(e) => setSearchCatalogo(e.target.value)} />
        </div>
        <select className="input" style={{ width: '160px' }} value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
          <option value="">Todas categorias</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-container">
          <table style={{ fontSize: '0.7rem' }}>
            <thead>
              <tr style={{ fontSize: '0.7rem' }}>
                <th>Produto</th>
                <th style={{ textAlign: 'center' }}>Categoria</th>
                <th style={{ textAlign: 'center' }}>Subcategoria</th>
                <th style={{ textAlign: 'center' }}>Und. Compra</th>
                <th style={{ textAlign: 'center' }}>Fator Conv.</th>
                <th style={{ textAlign: 'center' }}>Usos/Un</th>
                <th style={{ textAlign: 'center' }}>VLR/Uso médio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Nenhum insumo cadastrado.</td></tr>
              ) : filtered.map((ins) => {
                const usosMedio = (ins.usosMin + ins.usosMax) / 2
                const vlrUso = ins.custoUnitarioMedio && usosMedio > 0 ? ins.custoUnitarioMedio / usosMedio : null

                return (
                  <tr key={ins.id}>
                    <td style={{ fontWeight: 500 }}>{ins.nome}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${ins.grupoCategoria ? 'badge-teal' : 'badge-amber'}`} style={{ fontSize: '0.6rem' }}>
                        {ins.grupoCategoria ?? 'definir'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {editando?.id === ins.id && editando.campo === 'subcategoria' ? (
                        <input className="input" style={{ width: '100px', padding: '2px 4px', fontSize: '0.7rem' }}
                          value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => salvarCampo(ins.id, 'subcategoria', editValue)}
                          onKeyDown={(e) => e.key === 'Enter' && salvarCampo(ins.id, 'subcategoria', editValue)}
                          autoFocus />
                      ) : (
                        <span style={{ cursor: 'pointer', color: ins.subcategoria ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: '0.65rem' }}
                          onClick={() => startEdit(ins.id, 'subcategoria', ins.subcategoria ?? '')}>
                          {ins.subcategoria ?? 'definir'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{ins.unidadeMedida}</td>
                    <td style={{ textAlign: 'center' }}>{ins.fatorConversaoMedio ? `1\u2192${ins.fatorConversaoMedio}` : '\u2014'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {editando?.id === ins.id && editando.campo === 'usos' ? (
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          <input type="number" min="1" step="1" className="input"
                            style={{ width: '40px', padding: '2px', fontSize: '0.7rem', textAlign: 'center' }}
                            value={editValue.split('-')[0] ?? '1'}
                            onChange={(e) => setEditValue(`${e.target.value}-${editValue.split('-')[1] ?? '1'}`)}
                            autoFocus />
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                          <input type="number" min="1" step="1" className="input"
                            style={{ width: '40px', padding: '2px', fontSize: '0.7rem', textAlign: 'center' }}
                            value={editValue.split('-')[1] ?? '1'}
                            onChange={(e) => setEditValue(`${editValue.split('-')[0] ?? '1'}-${e.target.value}`)}
                            onBlur={async () => {
                              const [min, max] = editValue.split('-').map(Number)
                              await fetch(`/api/estoque/insumos/${ins.id}`, {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ usosMin: min || 1, usosMax: max || 1 }),
                              })
                              setInsumos((prev) => prev.map((i) => i.id === ins.id ? { ...i, usosMin: min || 1, usosMax: max || 1 } : i))
                              setEditando(null)
                              toast('Usos atualizados', 'success')
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const [min, max] = editValue.split('-').map(Number)
                                await fetch(`/api/estoque/insumos/${ins.id}`, {
                                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ usosMin: min || 1, usosMax: max || 1 }),
                                })
                                setInsumos((prev) => prev.map((i) => i.id === ins.id ? { ...i, usosMin: min || 1, usosMax: max || 1 } : i))
                                setEditando(null)
                                toast('Usos atualizados', 'success')
                              }
                            }} />
                        </div>
                      ) : (
                        <span style={{ cursor: 'pointer', color: usosMedio > 1 ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                          onClick={() => startEdit(ins.id, 'usos', `${ins.usosMin}-${ins.usosMax}`)}>
                          {ins.usosMin === ins.usosMax ? ins.usosMin : `${ins.usosMin}-${ins.usosMax}`}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {vlrUso && usosMedio > 1
                        ? <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>R$ {vlrUso.toFixed(2)}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>\u2014</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
