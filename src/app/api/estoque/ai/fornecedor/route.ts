import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAIProvider } from '@/lib/ai-providers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fornecedorId = Number(searchParams.get('fornecedorId'))

    if (!fornecedorId || isNaN(fornecedorId)) {
      return NextResponse.json({ error: 'fornecedorId obrigatório' }, { status: 400 })
    }

    const fornecedor = await db.fornecedor.findUnique({ where: { id: fornecedorId } })
    if (!fornecedor) {
      return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 })
    }

    const lotes = await db.lote.findMany({
      where: { fornecedorId },
      include: { insumo: { select: { nome: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const resultado = await getAIProvider().avaliarFornecedor({
      fornecedorId,
      nome: fornecedor.nome,
      lotes: lotes.map((l) => ({
        createdAt: l.createdAt.toISOString(),
        quantidade: l.quantidade,
        custoUnitario: l.custoUnitario,
        insumoNome: l.insumo.nome,
      })),
    })

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[AI fornecedor]', error)
    return NextResponse.json({ error: 'Erro ao avaliar fornecedor' }, { status: 500 })
  }
}
