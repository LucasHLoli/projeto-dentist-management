import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateLoteSchema = z.object({
  insumoId: z.number().int().positive(),
  fornecedorId: z.number().int().positive().optional(),
  codigoLote: z.string().optional(),
  // Campos de conversão (opcionais)
  unidadeCompra: z.string().optional(),
  fatorConversao: z.number().positive().optional(),
  quantidadeCompra: z.number().positive().optional(),
  // quantidade em unidades de uso — calculado automaticamente se fator informado
  quantidade: z.number().positive().optional(),
  custoUnitario: z.number().nonnegative().optional(),
  validade: z.string().refine(
    (v) => !v || !isNaN(new Date(v).getTime()),
    { message: 'Data inválida' }
  ).optional(),
  validadeConfirmada: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const insumoId = searchParams.get('insumoId')
    const status = searchParams.get('status') ?? 'ATIVO'
    const fefo = searchParams.get('fefo') === 'true'
    const comTaxa = searchParams.get('comTaxa') === 'true'

    const where: Record<string, unknown> = { status }
    if (insumoId) where.insumoId = Number(insumoId)

    const lotes = await db.lote.findMany({
      where,
      orderBy: fefo ? [{ validade: 'asc' }, { createdAt: 'asc' }] : { createdAt: 'desc' },
      include: {
        insumo: {
          select: {
            id: true,
            nome: true,
            grupoCategoria: true,
            unidadeMedida: true,
            unidadeUso: true,
            estoqueMinimo: true,
          },
        },
        fornecedor: { select: { id: true, cnpj: true, nome: true } },
        nfeImport: {
          select: {
            id: true,
            numero: true,
            serie: true,
            chaveAcesso: true,
            dataEmissao: true,
            valorTotal: true,
          },
        },
      },
    })

    if (!comTaxa) return NextResponse.json(lotes)

    // Calculate monthly usage rate per insumo (last 90 days / 3 months)
    const noventaDiasAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const insumoIds = [...new Set(lotes.map((l) => l.insumoId))]

    const consumos = await db.consumoInsumo.groupBy({
      by: ['insumoId'],
      _sum: { quantidade: true },
      where: {
        insumoId: { in: insumoIds },
        createdAt: { gte: noventaDiasAtras },
      },
    })

    const taxaMap = new Map<number, number>()
    for (const c of consumos) {
      taxaMap.set(c.insumoId, (c._sum.quantidade ?? 0) / 3)
    }

    const result = lotes.map((l) => ({
      ...l,
      taxaUsoMensal: taxaMap.get(l.insumoId) ?? 0,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao buscar lotes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = CreateLoteSchema.parse(body)

    // Calcular quantidade em unidades de uso
    let quantidadeUso: number
    if (data.fatorConversao && data.quantidadeCompra) {
      quantidadeUso = data.quantidadeCompra * data.fatorConversao
    } else if (data.quantidade) {
      quantidadeUso = data.quantidade
    } else {
      return NextResponse.json(
        { error: 'Informe quantidade ou (quantidadeCompra + fatorConversao)' },
        { status: 400 }
      )
    }

    const lote = await db.lote.create({
      data: {
        insumoId: data.insumoId,
        fornecedorId: data.fornecedorId,
        codigoLote: data.codigoLote,
        unidadeCompra: data.unidadeCompra,
        fatorConversao: data.fatorConversao,
        // Only store quantidadeCompra when conversion is complete
        quantidadeCompra: data.fatorConversao && data.quantidadeCompra ? data.quantidadeCompra : undefined,
        quantidade: quantidadeUso,
        quantidadeAtual: quantidadeUso,
        custoUnitario: data.custoUnitario,
        validade: data.validade ? new Date(data.validade) : undefined,
        validadeConfirmada: data.validadeConfirmada,
        status: 'ATIVO',
      },
      include: { insumo: true, fornecedor: true },
    })
    return NextResponse.json(lote, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Erro ao criar lote' }, { status: 500 })
  }
}
