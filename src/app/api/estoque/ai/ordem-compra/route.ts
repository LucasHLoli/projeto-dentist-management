import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAIProvider } from '@/lib/ai-providers'
import { getConsumoMedioDiario } from '@/lib/fefo'

export async function GET() {
  try {
    // Busca insumos abaixo do estoque mínimo
    const insumos = await db.insumo.findMany({
      include: {
        lotes: {
          where: { status: 'ATIVO' },
          select: { quantidadeAtual: true, custoUnitario: true },
        },
      },
    })

    const itensCriticos = await Promise.all(
      insumos
        .map((insumo) => {
          const estoqueAtual = insumo.lotes.reduce((s, l) => s + l.quantidadeAtual, 0)
          return { insumo, estoqueAtual }
        })
        .filter(({ insumo, estoqueAtual }) => estoqueAtual <= insumo.estoqueMinimo)
        .map(async ({ insumo, estoqueAtual }) => {
          const consumoMedioDiario = await getConsumoMedioDiario(insumo.id, 60)
          const lotesComCusto = insumo.lotes.filter((l) => l.custoUnitario !== null)
          const custoUnitarioMedio =
            lotesComCusto.length > 0
              ? lotesComCusto.reduce((s, l) => s + (l.custoUnitario ?? 0), 0) / lotesComCusto.length
              : null
          return {
            insumoId: insumo.id,
            nome: insumo.nome,
            estoqueAtual,
            estoqueMinimo: insumo.estoqueMinimo,
            consumoMedioDiario,
            custoUnitarioMedio,
          }
        })
    )

    if (itensCriticos.length === 0) {
      return NextResponse.json({
        itens: [],
        custoTotalEstimado: 0,
        resumo: 'Nenhum insumo abaixo do estoque mínimo no momento.',
        geradoEm: new Date().toISOString(),
      })
    }

    const resultado = await getAIProvider().gerarOrdemCompra({ itensCriticos })
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[AI ordem-compra]', error)
    return NextResponse.json({ error: 'Erro ao gerar ordem de compra' }, { status: 500 })
  }
}
