import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { db } from '@/lib/db'
import { getConsumoMedioDiario } from '@/lib/fefo'
import { formatarContextoEstoque } from '@/lib/ai-stock'

const BASE_SYSTEM_PROMPT = `Você é o assistente de IA da DentFlow, uma clínica odontológica em Fortaleza, Ceará. Você ajuda a Dra. a gerenciar sua clínica respondendo perguntas sobre pacientes, finanças, estoque e retornos.

CLÍNICA:
- 263 pacientes cadastrados
- Planos: Particular (109), Uniodonto (98), Camed (34), Geap (22)
- 1.135 atendimentos no total

FINANCEIRO (2025):
- Receita total: R$ 72.877,23
- Lucro líquido: R$ 40.485,86 (margem ~55%)
- Melhor mês: Junho (R$ 7.410,19 lucro, margem 62.2%)

RETORNOS PENDENTES:
- Ana Paula Vaz da Silva — 1 mês e 12 dias (Uniodonto)
- Carlos Eduardo Silva Mendes — 3 meses e 5 dias (Uniodonto)
- Maria José Santos — 6 meses (Particular)

INSTRUÇÕES:
- Responda sempre em português do Brasil
- Seja conciso, útil e profissional
- Use formatação markdown (negrito, listas) quando adequado
- Se não tiver certeza de algo, diga que precisaria verificar os dados em tempo real
- Quando relevante, sugira ações práticas
- Use emojis com moderação para facilitar a leitura`

async function buildEstoqueContext(): Promise<string> {
  try {
    const hoje = new Date()
    const em30dias = new Date(hoje)
    em30dias.setDate(hoje.getDate() + 30)
    const mesPassado = new Date(hoje)
    mesPassado.setDate(hoje.getDate() - 30)

    const insumos = await db.insumo.findMany({
      include: {
        lotes: {
          where: { status: 'ATIVO' },
          orderBy: { validade: 'asc' },
        },
      },
    })

    const criticos: { nome: string; estoqueAtual: number; diasRestantes: number | null }[] = []
    const top10: { nome: string; estoqueAtual: number; unidadeMedida: string }[] = []
    const vencendo30dias: { nome: string; lotes: { validade: Date | null; quantidadeAtual: number }[] }[] = []

    for (const insumo of insumos) {
      const estoqueAtual = insumo.lotes.reduce((sum, l) => sum + l.quantidadeAtual, 0)

      if (estoqueAtual <= insumo.estoqueMinimo) {
        const consumoMedio = await getConsumoMedioDiario(insumo.id, 60)
        const diasRestantes = consumoMedio > 0 ? Math.floor(estoqueAtual / consumoMedio) : null
        criticos.push({ nome: insumo.nome, estoqueAtual, diasRestantes })
      }

      const lotesVencendo = insumo.lotes.filter(
        (l) => l.validade && l.validade <= em30dias && l.validade > hoje
      )
      if (lotesVencendo.length > 0) {
        vencendo30dias.push({ nome: insumo.nome, lotes: lotesVencendo })
      }

      top10.push({ nome: insumo.nome, estoqueAtual, unidadeMedida: insumo.unidadeMedida })
    }

    top10.sort((a, b) => b.estoqueAtual - a.estoqueAtual)

    // Custo de material do último mês
    const consumosMes = await db.consumoInsumo.findMany({
      where: { createdAt: { gte: mesPassado } },
      include: { lote: { select: { custoUnitario: true } } },
    })
    const custoUltimoMes = consumosMes.reduce(
      (sum, c) => sum + c.quantidade * (c.lote?.custoUnitario ?? 0),
      0
    )

    return formatarContextoEstoque({
      criticos,
      top10: top10.slice(0, 10),
      vencendo30dias,
      custoUltimoMes,
    })
  } catch {
    return ''
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Campo messages é obrigatório' }, { status: 400 })
    }

    // Delegar ao chat de estoque quando a pergunta for sobre materiais/insumos
    const ultimaMensagem: string = messages[messages.length - 1]?.content ?? ''
    const precisaEstoque = /estoque|insumo|material|lote|venc|comprar|pedir|ruptura|acabou|faltou|fornecedor|consumo/i.test(
      ultimaMensagem
    )

    if (precisaEstoque) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:5000'
        const res = await fetch(`${baseUrl}/api/estoque/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
        })
        if (res.ok) {
          const data = await res.json()
          return NextResponse.json({ reply: data.resposta })
        }
      } catch {
        // fallback para Groq abaixo
      }
    }

    let systemPrompt = BASE_SYSTEM_PROMPT
    if (precisaEstoque) {
      const estoqueCtx = await buildEstoqueContext()
      if (estoqueCtx) systemPrompt += '\n\n' + estoqueCtx
    }

    const groq = new Groq({ apiKey })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: 1024,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content || 'Não consegui gerar uma resposta.'
    return NextResponse.json({ reply })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao chamar a API de IA'
    console.error('Groq API error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
