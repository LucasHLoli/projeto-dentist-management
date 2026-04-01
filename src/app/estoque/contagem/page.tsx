'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, Save, ChevronLeft, Check } from 'lucide-react'
import Link from 'next/link'

interface LoteContagem {
  id: number
  insumo: { nome: string; unidadeMedida: string }
  quantidade: number
  quantidadeAtual: number
  validade: string | null
  validadeConfirmada: boolean
  status: string
  quantidadeContada: string   // input controlado
  novaValidade: string        // input controlado
}

export default function ContagemPage() {
  const [lotes, setLotes] = useState<LoteContagem[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    fetch('/api/estoque/lotes?status=ATIVO&fefo=true')
      .then((r) => r.json())
      .then((data) => {
        setLotes(
          data.map((l: LoteContagem) => ({
            ...l,
            quantidadeContada: String(l.quantidadeAtual),
            novaValidade: l.validade ? l.validade.slice(0, 10) : '',
          }))
        )
      })
      .finally(() => setLoading(false))
  }, [])

  function updateLote(id: number, field: 'quantidadeContada' | 'novaValidade', value: string) {
    setLotes((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }

  async function salvarContagem() {
    setSalvando(true)
    try {
      const itens = lotes.map((l) => ({
        loteId: l.id,
        quantidadeContada: Number(l.quantidadeContada) || 0,
        validade: l.novaValidade ? new Date(l.novaValidade).toISOString() : undefined,
      }))

      await fetch('/api/estoque/contagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacoes, itens }),
      })

      setSalvo(true)
      setTimeout(() => setSalvo(false), 3000)
    } finally {
      setSalvando(false)
    }
  }

  const totalLotes = lotes.length
  const semValidade = lotes.filter((l) => !l.novaValidade).length
  const divergentes = lotes.filter(
    (l) => Math.abs(Number(l.quantidadeContada) - l.quantidadeAtual) > 0
  ).length

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Link
              href="/estoque"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
            >
              <ChevronLeft size={14} /> Estoque
            </Link>
          </div>
          <h1>Contagem de Estoque</h1>
          <p>Inventário periódico — confirme as quantidades e validades de cada lote</p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={salvarContagem}
          disabled={salvando || lotes.length === 0}
        >
          {salvo ? (
            <><Check size={14} /> Salvo!</>
          ) : salvando ? (
            'Salvando...'
          ) : (
            <><Save size={14} /> Salvar contagem</>
          )}
        </button>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon"><ClipboardList size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Lotes para contar</div>
          <div className="stat-card-value">{totalLotes}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon"><ClipboardList size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Sem validade</div>
          <div className="stat-card-value">{semValidade}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-icon"><ClipboardList size={18} strokeWidth={2} /></div>
          <div className="stat-card-label">Divergências</div>
          <div className="stat-card-value">{divergentes}</div>
        </div>
      </div>

      {/* Observações */}
      <div className="glass-card" style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
          Observações da contagem (opcional)
        </label>
        <input
          className="input"
          style={{ width: '100%' }}
          placeholder="Ex: Contagem bimestral — março/2026"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          suppressHydrationWarning
        />
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Carregando lotes...
        </div>
      ) : lotes.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-muted)' }}>Nenhum lote ativo para contagem.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th style={{ textAlign: 'center' }}>Qtd. Sistema</th>
                  <th style={{ textAlign: 'center' }}>Qtd. Contada</th>
                  <th>Validade</th>
                  <th style={{ textAlign: 'center' }}>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((lote) => {
                  const contada = Number(lote.quantidadeContada)
                  const diff = contada - lote.quantidadeAtual
                  const temDivergencia = diff !== 0

                  return (
                    <tr key={lote.id} style={{ background: temDivergencia ? 'rgba(var(--amber-rgb), 0.04)' : undefined }}>
                      <td style={{ fontWeight: 500 }}>
                        {lote.insumo?.nome}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>
                          ({lote.insumo?.unidadeMedida})
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {lote.quantidadeAtual}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          className="input"
                          style={{ width: '80px', textAlign: 'center', padding: '4px 8px' }}
                          value={lote.quantidadeContada}
                          onChange={(e) => updateLote(lote.id, 'quantidadeContada', e.target.value)}
                          min={0}
                          step={1}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="input"
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                          value={lote.novaValidade}
                          onChange={(e) => updateLote(lote.id, 'novaValidade', e.target.value)}
                        />
                        {!lote.validadeConfirmada && !lote.novaValidade && (
                          <span style={{ color: 'var(--accent-amber)', fontSize: '0.7rem', display: 'block' }}>
                            ⚠ Preencher
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {diff === 0 ? (
                          <span className="badge badge-emerald">OK</span>
                        ) : (
                          <span className={`badge ${diff > 0 ? 'badge-teal' : 'badge-rose'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
