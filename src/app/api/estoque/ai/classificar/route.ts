import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAIProvider } from '@/lib/ai-providers'

const Body = z.object({ nomeProduto: z.string().min(1) })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nomeProduto } = Body.parse(body)

    const resultado = await getAIProvider().classificarInsumo(nomeProduto)
    return NextResponse.json(resultado)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('[AI classificar]', error)
    return NextResponse.json({ error: 'Erro ao classificar insumo' }, { status: 500 })
  }
}
