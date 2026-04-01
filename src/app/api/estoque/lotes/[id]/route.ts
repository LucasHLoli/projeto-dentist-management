import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import path from 'path'
import { writeFile } from 'fs/promises'

const UpdateLoteSchema = z.object({
  validade: z.string().datetime().nullable().optional(),
  validadeConfirmada: z.boolean().optional(),
  quantidadeAtual: z.number().nonnegative().optional(),
  custoUnitario: z.number().nonnegative().optional(),
  status: z.enum(['ATIVO', 'ESGOTADO', 'VENCIDO', 'DESCARTADO']).optional(),
  codigoLote: z.string().optional(),
  grupoCategoria: z.string().nullable().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const contentType = request.headers.get('content-type') ?? ''

    // Upload de foto da nota (multipart)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('foto') as File | null

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filename = `nota_lote_${id}_${Date.now()}.${ext}`
      const uploadPath = path.join(process.cwd(), 'public/uploads/notas', filename)

      await writeFile(uploadPath, buffer)

      const lote = await db.lote.update({
        where: { id: Number(id) },
        data: { fotoNotaUrl: `/uploads/notas/${filename}` },
      })
      return NextResponse.json(lote)
    }

    // Atualização de campos normais (JSON)
    const body = await request.json()
    const data = UpdateLoteSchema.parse(body)

    const { grupoCategoria, ...loteFields } = data
    const updateData: Record<string, unknown> = { ...loteFields }
    if (loteFields.validade !== undefined) {
      updateData.validade = loteFields.validade ? new Date(loteFields.validade) : null
    }

    const lote = await db.lote.update({
      where: { id: Number(id) },
      data: updateData,
      include: { insumo: true },
    })

    if (grupoCategoria !== undefined) {
      await db.insumo.update({
        where: { id: lote.insumoId },
        data: { grupoCategoria },
      })
    }

    return NextResponse.json(lote)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Erro ao atualizar lote' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const lote = await db.lote.update({
      where: { id: Number(id) },
      data: { status: 'DESCARTADO', quantidadeAtual: 0 },
    })
    return NextResponse.json({ ok: true, lote })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao remover lote' }, { status: 500 })
  }
}
