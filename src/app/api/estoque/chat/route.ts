import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getAIProvider } from '@/lib/ai-providers'
import { getConsumoMedioDiario } from '@/lib/fefo'

const MensagemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const BodySchema = z.object({
  messages: z.array(MensagemSchema).min(1),
})

async function construirContextoRico(): Promise<string> {
  const hoje = new Date()
  const d30 = new Date(hoje); d30.setDate(hoje.getDate() - 30)
  const d15 = new Date(hoje); d15.setDate(hoje.getDate() - 0) // próximos 15 dias
  const d15Future = new Date(hoje); d15Future.setDate(hoje.getDate() + 15)
  const d7 = new Date(hoje); d7.setDate(hoje.getDate() - 7)

  const [insumos, consumos30, lotesVencendo, consumosSemana] = await Promise.all([
    db.insumo.findMany({
      include: {
        lotes: { where: { status: 'ATIVO' }, select: { quantidadeAtual: true, custoUnitario: true } },
      },
    }),
    db.consumoInsumo.findMany({
      where: { createdAt: { gte: d30 } },
      include: {
        insumo: { select: { nome: true } },
        lote: { select: { custoUnitario: true } },
      },
    }),
    db.lote.findMany({
      where: {
        status: 'ATIVO',
        validade: { gte: hoje, lte: d15Future },
        validadeConfirmada: true,
      },
      include: { insumo: { select: { nome: true } } },
      orderBy: { validade: 'asc' },
    }),
    db.consumoInsumo.findMany({
      where: { createdAt: { gte: d7 } },
      include: {
        insumo: { select: { nome: true } },
        lote: { select: { custoUnitario: true } },
      },
    }),
  ])

  const linhas: string[] = []
  linhas.push(`Data atual: ${hoje.toLocaleDateString('pt-BR')}`)
  linhas.push('')

  // Insumos críticos (abaixo do mínimo)
  const criticos = insumos
    .map((i) => ({
      nome: i.nome,
      estoqueAtual: i.lotes.reduce((s, l) => s + l.quantidadeAtual, 0),
      estoqueMinimo: i.estoqueMinimo,
    }))
    .filter((i) => i.estoqueAtual < i.estoqueMinimo)

  if (criticos.length > 0) {
    linhas.push('INSUMOS CRÍTICOS (abaixo do mínimo):')
    criticos.forEach((i) => {
      linhas.push(`- ${i.nome}: ${i.estoqueAtual} un (mínimo: ${i.estoqueMinimo})`)
    })
    linhas.push('')
  }

  // Lotes vencendo em 15 dias
  if (lotesVencendo.length > 0) {
    linhas.push('LOTES VENCENDO NOS PRÓXIMOS 15 DIAS:')
    lotesVencendo.forEach((l) => {
      const d = l.validade ? new Date(l.validade).toLocaleDateString('pt-BR') : '?'
      linhas.push(`- ${l.insumo.nome}: ${l.quantidadeAtual} un, vence ${d}`)
    })
    linhas.push('')
  }

  // Top 10 insumos por estoque
  const top10 = insumos
    .map((i) => ({
      nome: i.nome,
      unidadeMedida: i.unidadeMedida,
      estoqueAtual: i.lotes.reduce((s, l) => s + l.quantidadeAtual, 0),
    }))
    .sort((a, b) => b.estoqueAtual - a.estoqueAtual)
    .slice(0, 10)

  linhas.push('ESTOQUE ATUAL (top 10):')
  top10.forEach((i) => {
    linhas.push(`- ${i.nome}: ${i.estoqueAtual} ${i.unidadeMedida}`)
  })
  linhas.push('')

  // Top consumo nos últimos 30 dias
  const mapaConsumo = new Map<string, number>()
  for (const c of consumos30) {
    mapaConsumo.set(c.insumo.nome, (mapaConsumo.get(c.insumo.nome) ?? 0) + c.quantidade)
  }
  const topConsumo = Array.from(mapaConsumo.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (topConsumo.length > 0) {
    linhas.push('TOP 5 INSUMOS MAIS CONSUMIDOS (30 dias):')
    topConsumo.forEach(([nome, qtd]) => linhas.push(`- ${nome}: ${qtd} un`))
    linhas.push('')
  }

  // Custo semanal (4 semanas)
  const custoSemana = consumosSemana.reduce(
    (s, c) => s + (c.lote?.custoUnitario ?? 0) * c.quantidade,
    0
  )
  linhas.push(`CUSTO DE MATERIAIS (última semana): R$ ${custoSemana.toFixed(2)}`)

  const custo30 = consumos30.reduce(
    (s, c) => s + (c.lote?.custoUnitario ?? 0) * c.quantidade,
    0
  )
  linhas.push(`CUSTO DE MATERIAIS (últimos 30 dias): R$ ${custo30.toFixed(2)}`)

  return linhas.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages } = BodySchema.parse(body)

    const ultima = messages[messages.length - 1]
    const historico = messages.slice(0, -1)
    const contextoEstoque = await construirContextoRico()

    const resultado = await getAIProvider().responderPerguntaEstoque({
      pergunta: ultima.content,
      historico,
      contextoEstoque,
    })

    return NextResponse.json(resultado)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('[estoque/chat]', error)
    return NextResponse.json({ error: 'Erro no chat de estoque' }, { status: 500 })
  }
}
