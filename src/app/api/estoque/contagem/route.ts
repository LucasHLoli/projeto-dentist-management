import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const ContagemSchema = z.object({
  observacoes: z.string().optional(),
  criadoPor: z.string().optional(),
  itens: z.array(
    z.object({
      loteId: z.number().int().positive(),
      quantidadeContada: z.number().nonnegative(),
      validade: z.string().datetime().nullable().optional(),
      observacoes: z.string().optional(),
    })
  ),
})

// POST — registrar contagem periódica
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = ContagemSchema.parse(body)

    // Criar contagem + itens em transação
    const contagem = await db.$transaction(async (tx) => {
      const c = await tx.contagemEstoque.create({
        data: {
          observacoes: data.observacoes,
          criadoPor: data.criadoPor,
        },
      })

      for (const item of data.itens) {
        await tx.contagemItem.create({
          data: {
            contagemId: c.id,
            loteId: item.loteId,
            quantidadeContada: item.quantidadeContada,
            validade: item.validade ? new Date(item.validade) : undefined,
            observacoes: item.observacoes,
          },
        })

        // Atualizar quantidade real do lote
        await tx.lote.update({
          where: { id: item.loteId },
          data: {
            quantidadeAtual: item.quantidadeContada,
            // Se validade foi confirmada na contagem, atualizar
            ...(item.validade
              ? { validade: new Date(item.validade), validadeConfirmada: true }
              : {}),
          },
        })
      }

      return c
    })

    return NextResponse.json({ ok: true, contagemId: contagem.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Erro ao registrar contagem' }, { status: 500 })
  }
}

// GET — histórico de contagens
export async function GET() {
  try {
    const contagens = await db.contagemEstoque.findMany({
      orderBy: { data: 'desc' },
      include: {
        itens: {
          include: { lote: { include: { insumo: true } } },
        },
      },
    })
    return NextResponse.json(contagens)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao buscar contagens' }, { status: 500 })
  }
}
