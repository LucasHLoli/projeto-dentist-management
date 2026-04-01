'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, ChevronDown, ChevronRight, RefreshCw, Table } from 'lucide-react'

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

interface Nota {
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function formatMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const [exportando, setExportando] = useState(false)

  function carregarNotas() {
    setLoading(true)
    setErro(null)
    fetch('/api/estoque/nfe')
      .then((r) => {
        if (!r.ok) throw new Error('Erro ao carregar notas')
        return r.json()
      })
      .then(setNotas)
      .catch(() => setErro('Erro ao carregar notas fiscais. Tente novamente.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    carregarNotas()
  }, [])

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
      alert('Erro ao exportar Excel')
    } finally {
      setExportando(false)
    }
  }

  async function downloadNota(notaId: number) {
    const res = await fetch(`/api/estoque/nfe/${notaId}/download`)
    if (!res.ok) { alert('Arquivo não disponível'); return }
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notas Fiscais</h1>
          <p>Histórico de NF-e importadas, produtos e downloads</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={carregarNotas}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={exportarExcel}
            disabled={exportando || notas.length === 0}
          >
            <Table size={14} /> {exportando ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon"><FileText size={18} /></div>
          <div className="stat-card-label">Total de Notas</div>
          <div className="stat-card-value">{notas.length}</div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-card-icon"><Table size={18} /></div>
          <div className="stat-card-label">Total de Produtos</div>
          <div className="stat-card-value">{notas.reduce((s, n) => s + n.totalProdutos, 0)}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon"><Download size={18} /></div>
          <div className="stat-card-label">Valor Total Importado</div>
          <div className="stat-card-value" style={{ fontSize: '1rem' }}>
            {formatMoeda(notas.reduce((s, n) => s + n.valorTotal, 0))}
          </div>
        </div>
      </div>

      {erro && (
        <div style={{ padding: '12px 16px', background: 'rgba(244,63,94,0.1)', borderRadius: '8px', color: 'var(--accent-rose)', marginBottom: '12px' }}>
          {erro}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Carregando notas...
        </div>
      ) : notas.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            Nenhuma NF-e importada. Use &quot;Importar NF-e&quot; na tela de Estoque.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notas.map((nota) => {
            const expandida = expandidas.has(nota.id)
            return (
              <div key={nota.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Cabeçalho da nota */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 16px', cursor: 'pointer',
                    borderBottom: expandida ? '1px solid var(--border)' : 'none',
                  }}
                  onClick={() => toggleExpand(nota.id)}
                >
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    {expandida ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>NF {nota.numero}/{nota.serie}</span>
                      <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>
                        {nota.totalProdutos} produto{nota.totalProdutos !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {nota.fornecedor.nome} · CNPJ {nota.fornecedor.cnpj}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 600 }}>{formatMoeda(nota.valorTotal)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(nota.dataEmissao)}</div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); downloadNota(nota.id) }}
                    disabled={!nota.xmlPath}
                    title={nota.xmlPath ? 'Baixar arquivo original' : 'Arquivo não disponível'}
                  >
                    <Download size={12} /> Baixar
                  </button>
                </div>

                {/* Produtos da nota (expandido) */}
                {expandida && (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Categoria</th>
                          <th style={{ textAlign: 'center' }}>Qtd</th>
                          <th style={{ textAlign: 'right' }}>Vlr. Unit.</th>
                          <th style={{ textAlign: 'right' }}>Vlr. Total</th>
                          <th>Lote</th>
                          <th>Validade</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nota.lotes.map((lote) => (
                          <tr key={lote.id}>
                            <td style={{ fontWeight: 500 }}>{lote.nomeProduto}</td>
                            <td>
                              {lote.categoria
                                ? <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>{lote.categoria}</span>
                                : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                              }
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {lote.quantidade} {lote.unidadeMedida}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                              {lote.custoUnitario != null ? formatMoeda(lote.custoUnitario) : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                              {lote.custoUnitario != null
                                ? formatMoeda(lote.custoUnitario * lote.quantidade)
                                : '—'}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {lote.codigoLote ?? '—'}
                            </td>
                            <td style={{ fontSize: '0.8rem' }}>
                              {lote.validade
                                ? formatDate(lote.validade)
                                : <span style={{ color: 'var(--accent-amber)' }}>⚠ pendente</span>
                              }
                            </td>
                            <td>
                              <span className={`badge ${
                                lote.status === 'ATIVO' ? 'badge-emerald' :
                                lote.status === 'ESGOTADO' ? 'badge-amber' :
                                'badge-rose'
                              }`} style={{ fontSize: '0.7rem' }}>
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
