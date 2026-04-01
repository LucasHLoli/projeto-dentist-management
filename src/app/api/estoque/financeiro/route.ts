import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/estoque/financeiro?mes=3&ano=2026
// Retorna custo total de materiais consumidos no período
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') ? Number(searchParams.get('mes')) : null
    const ano = searchParams.get('ano') ? Number(searchParams.get('ano')) : new Date().getFullYear()

    // Definir intervalo
    let dataInicio: Date
    let dataFim: Date

    if (mes) {
      dataInicio = new Date(ano, mes - 1, 1)
      dataFim = new Date(ano, mes, 1)
    } else {
      dataInicio = new Date(ano, 0, 1)
      dataFim = new Date(ano + 1, 0, 1)
    }

    // Buscar consumos com custo do lote
    const consumos = await db.consumoInsumo.findMany({
      where: { createdAt: { gte: dataInicio, lt: dataFim } },
      include: {
        insumo: true,
        lote: { select: { custoUnitario: true } },
      },
    })

    // Calcular custo por insumo
    const custosPorInsumo: Record<number, { nome: string; quantidade: number; custo: number }> = {}

    let custoTotal = 0

    for (const consumo of consumos) {
      const custoUnitario = consumo.lote?.custoUnitario ?? 0
      const custo = consumo.quantidade * custoUnitario

      custoTotal += custo

      if (!custosPorInsumo[consumo.insumoId]) {
        custosPorInsumo[consumo.insumoId] = {
          nome: consumo.insumo.nome,
          quantidade: 0,
          custo: 0,
        }
      }

      custosPorInsumo[consumo.insumoId].quantidade += consumo.quantidade
      custosPorInsumo[consumo.insumoId].custo += custo
    }

    const breakdown = Object.entries(custosPorInsumo)
      .map(([id, data]) => ({ insumoId: Number(id), ...data }))
      .sort((a, b) => b.custo - a.custo)

    return NextResponse.json({
      periodo: { mes, ano },
      custoTotal: Number(custoTotal.toFixed(2)),
      breakdown,
      totalConsumos: consumos.length,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao calcular financeiro de estoque' }, { status: 500 })
  }
}
