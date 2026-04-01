import { NextRequest, NextResponse } from 'next/server'
import { registrarConsumo } from '@/lib/fefo'
import { sugerirConsumo } from '@/lib/ai-stock'
import { db } from '@/lib/db'
import { z } from 'zod'

const ConsumoSchema = z.object({
  atendimentoId: z.string().min(1),
  insumos: z.array(
    z.object({
      insumoId: z.number().int().positive(),
      quantidade: z.number().positive(),
      origem: z.enum(['MANUAL', 'AI_SUGERIDO', 'TABELA']).default('MANUAL'),
    })
  ),
})

// POST — registrar consumo de múltiplos insumos por atendimento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { atendimentoId, insumos } = ConsumoSchema.parse(body)

    const resultados = await Promise.all(
      insumos.map((item) =>
        registrarConsumo({
          atendimentoId,
          insumoId: item.insumoId,
          quantidade: item.quantidade,
          origem: item.origem,
        })
      )
    )

    return NextResponse.json({ ok: true, resultados })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Erro ao registrar consumo' }, { status: 500 })
  }
}

// GET — sugestão de consumo por procedimento (via IA)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const procedimentoId = searchParams.get('procedimentoId')
    const nomeProcedimento = searchParams.get('nome')

    if (!nomeProcedimento) {
      return NextResponse.json({ error: 'Parâmetro nome é obrigatório' }, { status: 400 })
    }

    // 1. Verificar tabela de conversão (sem IA)
    if (procedimentoId) {
      const vinculos = await db.procedimentoInsumo.findMany({
        where: { procedimentoId },
        include: { insumo: true },
      })

      if (vinculos.length > 0) {
        return NextResponse.json({
          fonte: 'TABELA',
          sugestoes: vinculos.map((v) => ({
            insumoId: v.insumoId,
            nomeInsumo: v.insumo.nome,
            quantidadeSugerida: v.quantidadePorUso,
            justificativa: v.observacoes ?? 'Conforme tabela de conversão',
          })),
        })
      }
    }

    // 2. Sem vínculo → usar IA
    const catalogoInsumos = await db.insumo.findMany({
      select: { id: true, nome: true, unidadeMedida: true },
      orderBy: { nome: 'asc' },
    })

    const sugestoes = await sugerirConsumo(nomeProcedimento, catalogoInsumos)

    return NextResponse.json({ fonte: 'AI', sugestoes })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao gerar sugestão' }, { status: 500 })
  }
}
