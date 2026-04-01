import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAIProvider } from '@/lib/ai-providers'

export async function GET() {
  try {
    const hoje = new Date()
    const d7 = new Date(hoje); d7.setDate(hoje.getDate() - 7)
    const d14 = new Date(hoje); d14.setDate(hoje.getDate() - 14)

    const [consumosSemana, consumosSemanaAnterior, insumosAbaixoMinimo] = await Promise.all([
      db.consumoInsumo.findMany({
        where: { createdAt: { gte: d7 } },
        include: {
          insumo: { select: { nome: true } },
          lote: { select: { custoUnitario: true } },
        },
      }),
      db.consumoInsumo.findMany({
        where: { createdAt: { gte: d14, lt: d7 } },
        include: { lote: { select: { custoUnitario: true } } },
      }),
      db.insumo.findMany({
        include: {
          lotes: { where: { status: 'ATIVO' }, select: { quantidadeAtual: true } },
        },
      }),
    ])

    // Agrupa consumos por insumo
    const mapaConsumo = new Map<string, { quantidade: number; custo: number }>()
    for (const c of consumosSemana) {
      const key = c.insumo.nome
      const custo = (c.lote?.custoUnitario ?? 0) * c.quantidade
      const prev = mapaConsumo.get(key) ?? { quantidade: 0, custo: 0 }
      mapaConsumo.set(key, { quantidade: prev.quantidade + c.quantidade, custo: prev.custo + custo })
    }
    const consumosSemanaAgregado = Array.from(mapaConsumo.entries()).map(([insumoNome, v]) => ({
      insumoNome,
      ...v,
    }))

    const custoSemanaAtual = consumosSemana.reduce(
      (s, c) => s + (c.lote?.custoUnitario ?? 0) * c.quantidade,
      0
    )
    const custoSemanaAnteriorTotal = consumosSemanaAnterior.reduce(
      (s, c) => s + (c.lote?.custoUnitario ?? 0) * c.quantidade,
      0
    )

    const insumosAbaixo = insumosAbaixoMinimo
      .map((i) => ({
        nome: i.nome,
        estoqueAtual: i.lotes.reduce((s, l) => s + l.quantidadeAtual, 0),
        estoqueMinimo: i.estoqueMinimo,
      }))
      .filter((i) => i.estoqueAtual < i.estoqueMinimo)

    const resultado = await getAIProvider().resumoEstoqueSemanal({
      consumosSemana: consumosSemanaAgregado,
      insumosAbaixoMinimo: insumosAbaixo,
      custoSemanaAnterior: custoSemanaAnteriorTotal,
      custoSemanaAtual,
    })

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[AI resumo-semanal]', error)
    return NextResponse.json({ error: 'Erro ao gerar resumo semanal' }, { status: 500 })
  }
}
