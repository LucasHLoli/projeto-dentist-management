import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateInsumoSchema = z.object({
  nome: z.string().min(1),
  unidadeMedida: z.string().default('UN'),
  unidadeUso: z.string().optional(),
  usosMin: z.number().positive().default(1),
  usosMax: z.number().positive().default(1),
  grupoCategoria: z.string().optional(),
  estoqueMinimo: z.number().nonnegative().default(5),
})

export async function GET() {
  try {
    const insumos = await db.insumo.findMany({
      include: {
        lotes: {
          where: { status: 'ATIVO' },
          orderBy: { validade: 'asc' },
        },
      },
      orderBy: { nome: 'asc' },
    })

    const result = insumos.map((insumo) => ({
      ...insumo,
      estoqueTotal: insumo.lotes.reduce((sum, l) => sum + l.quantidadeAtual, 0),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao buscar insumos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = CreateInsumoSchema.parse(body)

    const insumo = await db.insumo.create({ data })
    return NextResponse.json(insumo, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Erro ao criar insumo' }, { status: 500 })
  }
}
