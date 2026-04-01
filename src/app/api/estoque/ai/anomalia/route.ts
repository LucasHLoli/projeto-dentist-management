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
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const d60 = new Date(hoje); d60.setDate(hoje.getDate() - 60)

    const [consumosHoje, historico60] = await Promise.all([
      db.consumoInsumo.findMany({
        where: { insumoId, createdAt: { gte: inicioHoje } },
        select: { quantidade: true },
      }),
      db.consumoInsumo.findMany({
        where: { insumoId, createdAt: { gte: d60, lt: inicioHoje } },
        select: { createdAt: true, quantidade: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const quantidadeHoje = consumosHoje.reduce((s, c) => s + c.quantidade, 0)

    const resultado = await getAIProvider().detectarAnomaliaConsumo({
      insumoId,
      nome: insumo.nome,
      quantidadeHoje,
      historico60dias: historico60.map((c) => ({
        data: c.createdAt.toISOString().split('T')[0],
        quantidade: c.quantidade,
      })),
    })

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[AI anomalia]', error)
    return NextResponse.json({ error: 'Erro ao detectar anomalia' }, { status: 500 })
  }
}
