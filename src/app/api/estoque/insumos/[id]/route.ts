import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const UpdateInsumoSchema = z.object({
  nome: z.string().min(1).optional(),
  unidadeMedida: z.string().optional(),
  unidadeUso: z.string().nullable().optional(),
  usosMin: z.number().positive().optional(),
  usosMax: z.number().positive().optional(),
  grupoCategoria: z.string().nullable().optional(),
  estoqueMinimo: z.number().nonnegative().optional(),
  fotoUrl: z.string().nullable().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = UpdateInsumoSchema.parse(body)

    const insumo = await db.insumo.update({
      where: { id: Number(id) },
      data,
    })
    return NextResponse.json(insumo)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Erro ao atualizar insumo' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.insumo.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao deletar insumo' }, { status: 500 })
  }
}
