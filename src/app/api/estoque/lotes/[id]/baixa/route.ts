import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const BaixaSchema = z.object({
  quantidade: z.number().positive(),
  motivo: z.enum(['PERDA', 'VENCIMENTO', 'DANO', 'OUTRO']),
  observacao: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { quantidade, motivo, observacao } = BaixaSchema.parse(body)

    const lote = await db.lote.findUnique({ where: { id: Number(id) } })
    if (!lote) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    if (quantidade > lote.quantidadeAtual) {
      return NextResponse.json({ error: 'Quantidade maior que o estoque atual' }, { status: 400 })
    }

    const novaQtd = lote.quantidadeAtual - quantidade
    const novoStatus = novaQtd <= 0 ? 'ESGOTADO' : lote.status

    const atualizado = await db.lote.update({
      where: { id: Number(id) },
      data: { quantidadeAtual: novaQtd, status: novoStatus },
      include: { insumo: true },
    })

    return NextResponse.json({ ok: true, lote: atualizado, motivo, observacao })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Erro ao registrar baixa' }, { status: 500 })
  }
}
