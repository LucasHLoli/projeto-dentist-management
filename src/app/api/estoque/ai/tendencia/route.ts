import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAIProvider } from '@/lib/ai-providers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const insumoId = Number(searchParams.get('insumoId'))

    if (!insumoId || isNaN(insumoId)) {
      return NextResponse.json({ error: 'insumoId obrigatório' }, { status: 400 })
    }

    const insumo = await db.insumo.findUnique({ where: { id: insumoId } })
    if (!insumo) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
    }

    const hoje = new Date()
    const d30 = new Date(hoje); d30.setDate(hoje.getDate() - 30)
    const d90 = new Date(hoje); d90.setDate(hoje.getDate() - 90)

    const [consumos30, consumos90] = await Promise.all([
      db.consumoInsumo.findMany({
        where: { insumoId, createdAt: { gte: d30 } },
        select: { createdAt: true, quantidade: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.consumoInsumo.findMany({
        where: { insumoId, createdAt: { gte: d90 } },
        select: { createdAt: true, quantidade: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const fmt = (c: { createdAt: Date; quantidade: number }) => ({
      data: c.createdAt.toISOString().split('T')[0],
      quantidade: c.quantidade,
    })

    const resultado = await getAIProvider().analisarTendenciaConsumo({
      insumoId,
      nome: insumo.nome,
      consumos30dias: consumos30.map(fmt),
      consumos90dias: consumos90.map(fmt),
    })

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[AI tendencia]', error)
    return NextResponse.json({ error: 'Erro ao analisar tendência' }, { status: 500 })
  }
}
