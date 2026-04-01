'use client'

import { X } from 'lucide-react'

interface NfeItem {
  nome: string
  categoria: string | null
  quantidade: number
  custoUnitario: number | null
  validade: string | null
  unidade: string
}

interface NfeComparacao {
  id?: number
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  valorTotal: number
  fornecedor: { cnpj: string; nome: string }
  itens: NfeItem[]
}

interface Props {
  existente: NfeComparacao
  nova: NfeComparacao
  onManter: () => void
  onSubstituir: () => void
  onCancelar: () => void
  substituindo?: boolean
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function formatCurrency(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type DiffType = 'same' | 'changed' | 'only-old' | 'only-new'

function diffItens(existente: NfeItem[], nova: NfeItem[]): { item: NfeItem; comparacao?: NfeItem; diff: DiffType }[] {
  const result: { item: NfeItem; comparacao?: NfeItem; diff: DiffType }[] = []
  const usedNew = new Set<number>()

  for (const eItem of existente) {
    const matchIdx = nova.findIndex((n, idx) =>
      !usedNew.has(idx) && n.nome.toLowerCase() === eItem.nome.toLowerCase()
    )
    if (matchIdx >= 0) {
      usedNew.add(matchIdx)
      const nItem = nova[matchIdx]
      const changed = nItem.quantidade !== eItem.quantidade || nItem.custoUnitario !== eItem.custoUnitario
      result.push({ item: eItem, comparacao: nItem, diff: changed ? 'changed' : 'same' })
    } else {
      result.push({ item: eItem, diff: 'only-old' })
    }
  }

  nova.forEach((nItem, idx) => {
    if (!usedNew.has(idx)) {
      result.push({ item: nItem, diff: 'only-new' })
    }
  })

  return result
}

const DIFF_COLORS: Record<DiffType, string> = {
  same: 'transparent',
  changed: 'rgba(234,179,8,0.1)',
  'only-old': 'rgba(244,63,94,0.1)',
  'only-new': 'rgba(20,184,166,0.1)',
}

const DIFF_LABELS: Record<DiffType, string> = {
  same: '',
  changed: 'Alterado',
  'only-old': 'Só na existente',
  'only-new': 'Só na nova',
}

export default function NfeDuplicadaModal({ existente, nova, onManter, onSubstituir, onCancelar, substituindo }: Props) {
  const diffs = diffItens(existente.itens, nova.itens)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={onCancelar}
    >
      <div
        className="glass-card"
        style={{ width: '750px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--accent-amber)' }}>NF-e Duplicada Detectada</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
              Chave: {existente.chaveAcesso.slice(0, 20)}...
            </p>
          </div>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Comparação header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(244,63,94,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--accent-rose)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>NF-e Existente</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>NF {existente.numero}/{existente.serie}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(existente.dataEmissao)}</div>
            <div style={{ fontWeight: 600, marginTop: '4px' }}>{formatCurrency(existente.valorTotal)}</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(20,184,166,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--accent-teal)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>NF-e Nova</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>NF {nova.numero}/{nova.serie}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(nova.dataEmissao)}</div>
            <div style={{ fontWeight: 600, marginTop: '4px' }}>{formatCurrency(nova.valorTotal)}</div>
          </div>
        </div>

        {/* Diff de itens */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '0.8rem', marginBottom: '8px' }}>Comparação de Itens</h4>
          <div className="table-container">
            <table style={{ fontSize: '0.7rem' }}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ textAlign: 'center' }}>Qtd Existente</th>
                  <th style={{ textAlign: 'center' }}>Qtd Nova</th>
                  <th style={{ textAlign: 'center' }}>Vlr Existente</th>
                  <th style={{ textAlign: 'center' }}>Vlr Nova</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d, i) => (
                  <tr key={i} style={{ background: DIFF_COLORS[d.diff] }}>
                    <td style={{ fontWeight: 500 }}>{d.item.nome}</td>
                    <td style={{ textAlign: 'center' }}>
                      {d.diff !== 'only-new' ? `${d.item.quantidade} ${d.item.unidade}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {d.diff === 'only-old' ? '—' : d.comparacao ? `${d.comparacao.quantidade} ${d.comparacao.unidade}` : `${d.item.quantidade} ${d.item.unidade}`}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {d.diff !== 'only-new' ? formatCurrency(d.item.custoUnitario) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {d.diff === 'only-old' ? '—' : formatCurrency(d.comparacao?.custoUnitario ?? d.item.custoUnitario)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {DIFF_LABELS[d.diff] && (
                        <span className={`badge ${d.diff === 'only-new' ? 'badge-teal' : d.diff === 'only-old' ? 'badge-rose' : 'badge-amber'}`} style={{ fontSize: '0.6rem' }}>
                          {DIFF_LABELS[d.diff]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancelar} disabled={substituindo}>
            Cancelar
          </button>
          <button className="btn btn-secondary" onClick={onManter} disabled={substituindo}>
            Manter Existente
          </button>
          <button
            className="btn btn-primary"
            onClick={onSubstituir}
            disabled={substituindo}
            style={{ background: 'var(--accent-amber)' }}
          >
            {substituindo ? 'Substituindo...' : 'Substituir pela Nova'}
          </button>
        </div>
      </div>
    </div>
  )
}
