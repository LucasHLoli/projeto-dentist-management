import { db } from './db'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ConsumoInput {
  atendimentoId: string
  insumoId: number
  quantidade: number
  origem?: 'MANUAL' | 'AI_SUGERIDO' | 'TABELA'
}

export interface ConsumoResult {
  loteId: number | null
  quantidadeConsumida: number
  loteEsgotado: boolean
}

// ─── FEFO: lotes ordenados por validade (mais próximo primeiro) ───────────────

export async function getLotesFefo(insumoId: number) {
  return db.lote.findMany({
    where: {
      insumoId,
      status: 'ATIVO',
      quantidadeAtual: { gt: 0 },
    },
    orderBy: [
      // Lotes COM validade ordenados do mais próximo ao mais distante
      // Lotes SEM validade ficam por último
      { validade: 'asc' },
      { createdAt: 'asc' },
    ],
    include: { insumo: true, fornecedor: true },
  })
}

// ─── Registrar consumo por atendimento (FEFO automático) ─────────────────────

export async function registrarConsumo(input: ConsumoInput): Promise<ConsumoResult> {
  const { atendimentoId, insumoId, quantidade, origem = 'MANUAL' } = input

  // Busca o lote FEFO (mais próximo de vencer com estoque disponível)
  const lotes = await getLotesFefo(insumoId)
  const lote = lotes[0] ?? null

  let loteId: number | null = null
  let loteEsgotado = false

  if (lote) {
    loteId = lote.id
    const novaQuantidade = lote.quantidadeAtual - quantidade

    if (novaQuantidade <= 0) {
      // Lote esgotado
      await db.lote.update({
        where: { id: lote.id },
        data: { quantidadeAtual: 0, status: 'ESGOTADO' },
      })
      loteEsgotado = true
    } else {
      await db.lote.update({
        where: { id: lote.id },
        data: { quantidadeAtual: novaQuantidade },
      })
    }
  }

  await db.consumoInsumo.create({
    data: { atendimentoId, insumoId, loteId, quantidade, origem },
  })

  return { loteId, quantidadeConsumida: quantidade, loteEsgotado }
}

// ─── Estoque total de um insumo (soma de todos lotes ATIVO) ───────────────────

export async function getEstoqueTotal(insumoId: number): Promise<number> {
  const result = await db.lote.aggregate({
    where: { insumoId, status: 'ATIVO' },
    _sum: { quantidadeAtual: true },
  })
  return result._sum.quantidadeAtual ?? 0
}

// ─── Resumo de estoque de todos os insumos ────────────────────────────────────

export async function getEstoqueResumo() {
  const insumos = await db.insumo.findMany({
    include: {
      lotes: {
        where: { status: 'ATIVO' },
        orderBy: { validade: 'asc' },
      },
    },
  })

  return insumos.map((insumo) => {
    const estoqueTotal = insumo.lotes.reduce((sum, l) => sum + l.quantidadeAtual, 0)
    const proximoVencer = insumo.lotes.find((l) => l.validade)?.validade ?? null
    const critico = estoqueTotal <= insumo.estoqueMinimo

    return {
      id: insumo.id,
      nome: insumo.nome,
      unidadeMedida: insumo.unidadeMedida,
      grupoCategoria: insumo.grupoCategoria,
      fotoUrl: insumo.fotoUrl,
      estoqueTotal,
      estoqueMinimo: insumo.estoqueMinimo,
      critico,
      lotes: insumo.lotes,
      proximoVencer,
    }
  })
}

// ─── Calcular consumo médio diário (últimos N dias) ───────────────────────────

export async function getConsumoMedioDiario(insumoId: number, dias = 60): Promise<number> {
  const desde = new Date()
  desde.setDate(desde.getDate() - dias)

  const result = await db.consumoInsumo.aggregate({
    where: { insumoId, createdAt: { gte: desde } },
    _sum: { quantidade: true },
  })

  const totalConsumido = result._sum.quantidade ?? 0
  return totalConsumido / dias
}
