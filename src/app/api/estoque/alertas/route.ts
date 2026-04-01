import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getConsumoMedioDiario } from '@/lib/fefo'
import { gerarAlertaRuptura } from '@/lib/ai-stock'

export async function GET() {
  try {
    const hoje = new Date()
    const em30dias = new Date(hoje)
    em30dias.setDate(hoje.getDate() + 30)

    // 1. Insumos com estoque crítico
    const insumos = await db.insumo.findMany({
      include: {
        lotes: {
          where: { status: 'ATIVO' },
          orderBy: { validade: 'asc' },
          include: { fornecedor: true },
        },
      },
    })

    const alertas = []
    const vencendoEm30 = []

    for (const insumo of insumos) {
      const estoqueTotal = insumo.lotes.reduce((sum, l) => sum + l.quantidadeAtual, 0)
      const critico = estoqueTotal <= insumo.estoqueMinimo

      // Lotes vencendo em 30 dias
      const lotesVencendo = insumo.lotes.filter(
        (l) => l.validade && l.validade <= em30dias && l.validade > hoje
      )
      if (lotesVencendo.length > 0) {
        vencendoEm30.push({
          insumoId: insumo.id,
          nome: insumo.nome,
          lotes: lotesVencendo.map((l) => ({
            loteId: l.id,
            validade: l.validade,
            quantidadeAtual: l.quantidadeAtual,
          })),
        })
      }

      if (critico || estoqueTotal < insumo.estoqueMinimo * 2) {
        const consumoMedio = await getConsumoMedioDiario(insumo.id, 60)
        const ultimoFornecedor = insumo.lotes[0]?.fornecedor?.nome
        const diasDesdeUltimoLote = insumo.lotes[0]
          ? Math.floor((hoje.getTime() - insumo.lotes[0].createdAt.getTime()) / 86400000)
          : undefined

        const alerta = await gerarAlertaRuptura({
          insumoId: insumo.id,
          nome: insumo.nome,
          estoqueAtual: estoqueTotal,
          consumoMedioDiario: consumoMedio,
          ultimoFornecedor,
          diasDesdeUltimoLote,
        })

        if (alerta.urgencia !== 'ok') {
          alertas.push(alerta)
        }
      }
    }

    // Ordenar: crítico primeiro, depois alerta
    alertas.sort((a, b) => {
      if (a.urgencia === 'critico' && b.urgencia !== 'critico') return -1
      if (a.urgencia !== 'critico' && b.urgencia === 'critico') return 1
      return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999)
    })

    return NextResponse.json({ alertas, vencendoEm30 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao gerar alertas' }, { status: 500 })
  }
}
