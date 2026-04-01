import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    const nota = await db.nFeImport.findUnique({
      where: { id: numId },
      include: {
        fornecedor: true,
        lotes: {
          include: {
            insumo: {
              select: { id: true, nome: true, grupoCategoria: true, unidadeMedida: true, unidadeUso: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!nota) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

    return NextResponse.json(nota)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao buscar nota' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // Soft delete nos lotes da nota (marca como DESCARTADO)
    await db.lote.updateMany({
      where: { nfeImportId: numId },
      data: { status: 'DESCARTADO', quantidadeAtual: 0 },
    })

    // Remove a nota
    await db.nFeImport.delete({ where: { id: numId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao remover nota' }, { status: 500 })
  }
}
