'use client'

import { useState, useRef, DragEvent } from 'react'
import { Upload, FileText, X, Check, AlertTriangle, ChevronRight } from 'lucide-react'
import NfeDuplicadaModal from './NfeDuplicadaModal'

interface LoteImportado {
  loteId: number
  insumoId: number
  nomeInsumo: string
  nomeBruto: string
  quantidade: number
  unidade: string
  custoUnitario: number
  aiMatchConfianca: number
  aiSugestao: string
  validadeConfirmada: boolean
  validadeExtraida: string | null // extraída pelo Gemini Vision
  validade?: string
}

interface ImportResult {
  ok: boolean
  nfeImportId: number
  fornecedor: { cnpj: string; nome: string }
  numero: string
  dataEmissao: string
  valorTotal: number
  lotesImportados: LoteImportado[]
  aviso: string
  fonte?: 'xml' | 'danfe_gemini'
}

interface Props {
  onClose: () => void
  onImported: () => void
}

interface ClassificacaoSugerida {
  grupoCategoria: string
  unidadeMedida: string
  confianca: number
  observacoes: string
}

export default function NFeUploadModal({ onClose, onImported }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validades, setValidades] = useState<Record<number, string>>({})
  const [salvandoValidades, setSalvandoValidades] = useState(false)
  const [classificacoes, setClassificacoes] = useState<Record<number, ClassificacaoSugerida>>({})
  const [duplicadaData, setDuplicadaData] = useState<{ existente: any; nova: any } | null>(null)
  const [substituindo, setSubstituindo] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const FORMATOS_ACEITOS = ['.xml', '.pdf', '.jpg', '.jpeg', '.png']

  function validarArquivo(file: File): boolean {
    const nome = file.name.toLowerCase()
    return FORMATOS_ACEITOS.some((ext) => nome.endsWith(ext))
  }

  function labelArquivo(file: File): string {
    const nome = file.name.toLowerCase()
    if (nome.endsWith('.xml')) return 'XML NF-e'
    if (nome.endsWith('.pdf')) return 'DANFE PDF'
    return 'Imagem DANFE'
  }

  async function processarXML(file: File) {
    if (!validarArquivo(file)) {
      setError('Formato não suportado. Envie XML, PDF ou imagem da nota (JPG, PNG).')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('arquivo', file)

      const res = await fetch('/api/estoque/nfe', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.status === 409 && data.duplicada) {
        setDuplicadaData({ existente: data.existente, nova: data.nova })
        setPendingFile(file)
        setUploading(false)
        return
      }

      if (!res.ok) {
        setError(data.error ?? 'Erro ao processar NF-e')
        return
      }

      setResult(data)

      // Pré-preencher validades extraídas pelo Gemini
      const validadesPre: Record<number, string> = {}
      for (const lote of (data.lotesImportados ?? []) as LoteImportado[]) {
        if (lote.validadeExtraida) {
          // Converter YYYY-MM-DD → input[type=date] espera YYYY-MM-DD
          validadesPre[lote.loteId] = lote.validadeExtraida
        }
      }
      if (Object.keys(validadesPre).length > 0) {
        setValidades(validadesPre)
      }

      // Auto-classificar produtos novos (confiança IA = 0)
      const novos: LoteImportado[] = (data.lotesImportados ?? []).filter(
        (l: LoteImportado) => l.aiMatchConfianca === 0
      )
      if (novos.length > 0) {
        await Promise.all(
          novos.map(async (lote) => {
            try {
              const cr = await fetch('/api/estoque/ai/classificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nomeProduto: lote.nomeBruto }),
              })
              if (cr.ok) {
                const classif = await cr.json()
                setClassificacoes((prev) => ({ ...prev, [lote.loteId]: classif }))
              }
            } catch {
              // silencioso
            }
          })
        )
      }
    } catch {
      setError('Erro de conexão ao enviar o arquivo.')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processarXML(file)
  }

  async function confirmarValidades() {
    if (!result) return
    setSalvandoValidades(true)

    await Promise.all(
      result.lotesImportados.map(async (lote) => {
        const val = validades[lote.loteId]
        if (val) {
          await fetch(`/api/estoque/lotes/${lote.loteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              validade: new Date(val).toISOString(),
              validadeConfirmada: true,
            }),
          })
        }
      })
    )

    setSalvandoValidades(false)
    onImported()
  }

  async function handleManterExistente() {
    setDuplicadaData(null)
    setPendingFile(null)
  }

  async function handleSubstituir() {
    if (!duplicadaData) return
    setSubstituindo(true)
    try {
      await fetch(`/api/estoque/nfe/${duplicadaData.existente.id}`, { method: 'DELETE' })
      if (pendingFile) {
        await processarXML(pendingFile)
      }
    } catch {
      setError('Erro ao substituir nota fiscal')
    } finally {
      setSubstituindo(false)
      setDuplicadaData(null)
      setPendingFile(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{ width: '600px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Importar Nota Fiscal</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              XML · DANFE (PDF) · Foto da nota — Gemini extrai os dados automaticamente
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Fase 1: Upload */}
        {!result && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--accent-teal)' : 'var(--border)'}`,
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'rgba(var(--accent-teal-rgb), 0.05)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {uploading ? (
                <div style={{ color: 'var(--text-secondary)' }}>
                  <div style={{ marginBottom: '8px' }}>Processando nota com IA...</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Identificando produtos e fornecedor</div>
                </div>
              ) : (
                <>
                  <Upload size={32} style={{ color: 'var(--accent-teal)', marginBottom: '12px' }} />
                  <p style={{ margin: '0 0 4px', fontWeight: 500 }}>Arraste o arquivo aqui ou clique para selecionar</p>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    XML da NF-e · PDF do DANFE · Foto da nota (JPG, PNG)
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) processarXML(file)
              }}
            />

            {error && (
              <div
                style={{
                  marginTop: '12px', padding: '12px', borderRadius: '8px',
                  background: 'rgba(var(--rose-rgb), 0.1)', color: 'var(--accent-rose)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
          </>
        )}

        {duplicadaData && (
          <NfeDuplicadaModal
            existente={duplicadaData.existente}
            nova={duplicadaData.nova}
            onManter={handleManterExistente}
            onSubstituir={handleSubstituir}
            onCancelar={() => { setDuplicadaData(null); setPendingFile(null) }}
            substituindo={substituindo}
          />
        )}

        {/* Fase 2: Resultado + Confirmar validades */}
        {result && (
          <div>
            {/* Resumo da NF-e */}
            <div
              style={{
                background: 'rgba(var(--teal-rgb), 0.08)', borderRadius: '8px',
                padding: '12px 16px', marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{result.fornecedor.nome}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    CNPJ: {result.fornecedor.cnpj} · NF {result.numero}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>
                    R$ {result.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(result.dataEmissao).toLocaleDateString('pt-BR')}
                  </div>
                  {result.fonte === 'danfe_gemini' && (
                    <span className="badge badge-teal" style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                      ✨ Gemini Vision
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Aviso validade */}
            <div
              style={{
                background: 'rgba(var(--amber-rgb), 0.1)', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '8px',
                color: 'var(--accent-amber)', fontSize: '0.85rem',
              }}
            >
              <AlertTriangle size={14} />
              {result.aviso}
            </div>

            {/* Lista de lotes importados */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                {result.lotesImportados.length} produto{result.lotesImportados.length !== 1 ? 's' : ''} importado{result.lotesImportados.length !== 1 ? 's' : ''}
              </h4>

              {result.lotesImportados.map((lote) => (
                <div
                  key={lote.loteId}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${lote.validadeExtraida ? 'var(--accent-emerald)' : validades[lote.loteId] ? 'var(--accent-teal)' : 'var(--accent-amber)'}`,
                    marginBottom: '8px',
                    opacity: lote.validadeExtraida ? 1 : 0.9,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{lote.nomeInsumo}</div>
                      {lote.nomeBruto !== lote.nomeInsumo && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          NF-e: "{lote.nomeBruto}"
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <span className="badge badge-teal">
                          {lote.quantidade} {lote.unidade}
                        </span>
                        <span className="badge badge-emerald">
                          R$ {lote.custoUnitario.toFixed(2)}/un
                        </span>
                        {lote.aiMatchConfianca > 0 && (
                          <span
                            className={`badge ${lote.aiMatchConfianca >= 0.85 ? 'badge-emerald' : 'badge-amber'}`}
                            title={`Confiança IA: ${Math.round(lote.aiMatchConfianca * 100)}%`}
                          >
                            IA {Math.round(lote.aiMatchConfianca * 100)}%
                          </span>
                        )}
                        {lote.aiMatchConfianca === 0 && classificacoes[lote.loteId] && (
                          <span
                            className="badge badge-teal"
                            title={classificacoes[lote.loteId].observacoes}
                            style={{ fontSize: '0.7rem' }}
                          >
                            ✨ {classificacoes[lote.loteId].grupoCategoria} · {classificacoes[lote.loteId].unidadeMedida}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Campo de validade */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', color: lote.validadeExtraida ? 'var(--accent-emerald)' : 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {lote.validadeExtraida ? <Check size={11} /> : <AlertTriangle size={11} />}
                        {lote.validadeExtraida ? 'Validade (Gemini)' : 'Validade * (pendente)'}
                      </label>
                      <input
                        type="date"
                        className="input"
                        style={{ padding: '4px 8px', fontSize: '0.85rem', width: '140px' }}
                        value={validades[lote.loteId] ?? ''}
                        onChange={(e) =>
                          setValidades((prev) => ({ ...prev, [lote.loteId]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {Object.keys(validades).length}/{result.lotesImportados.length} validades preenchidas
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={onClose}>
                  Fechar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={confirmarValidades}
                  disabled={salvandoValidades}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {salvandoValidades ? (
                    'Salvando...'
                  ) : (
                    <>
                      <Check size={14} /> Confirmar importação
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
