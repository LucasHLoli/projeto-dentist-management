// ─── Re-exports dos tipos existentes ────────────────────────────────────────
export type { FuzzyMatchResult, ConsumoSugerido, AlertaRuptura } from './ai-stock'

// ─── Novos tipos das skills Gemini ───────────────────────────────────────────

export interface TendenciaConsumo {
  insumoId: number
  nome: string
  tendencia: 'crescente' | 'estavel' | 'decrescente'
  percentualMudanca: number
  mediaRecente: number
  mediaAnterior: number
  narrativa: string
  alertar: boolean
}

export interface ItemOrdemCompra {
  insumoId: number
  nome: string
  estoqueAtual: number
  estoqueMinimo: number
  quantidadeSugerida: number
  custoEstimado: number | null
  prioridade: 'urgente' | 'normal' | 'planejamento'
  justificativa: string
}

export interface OrdemCompra {
  itens: ItemOrdemCompra[]
  custoTotalEstimado: number
  resumo: string
  geradoEm: string
}

export interface ClassificacaoInsumo {
  grupoCategoria: string
  subcategoria: string | null   // NEW
  unidadeMedida: string
  usosMin: number
  usosMax: number
  confianca: number
  observacoes: string
}

export interface AnomaliaConsumo {
  insumoId: number
  nome: string
  anomalia: boolean
  quantidadeHoje: number
  mediaHistorica: number
  desvioPadrao: number
  fatorDesvio: number
  explicacao: string
  severidade: 'normal' | 'suspeito' | 'anomalo'
}

export interface AvaliacaoFornecedor {
  fornecedorId: number
  nome: string
  notaGeral: number
  notaConfiabilidade: number
  notaCusto: number
  notaQualidade: number
  totalLotes: number
  totalGasto: number
  narrativa: string
  recomendacao: 'manter' | 'avaliar' | 'substituir'
}

export interface ResumoSemanal {
  periodo: { inicio: string; fim: string }
  totalConsumido: number
  custoSemana: number
  insumosZerados: string[]
  insumosAbaixoMinimo: string[]
  topConsumo: { nome: string; quantidade: number; custo: number }[]
  tendenciaCustos: 'alta' | 'estavel' | 'queda'
  acoes: string[]
  narrativa: string
}

export interface MensagemChat {
  role: 'user' | 'assistant'
  content: string
}

export interface RespostaChat {
  resposta: string
  fonteDados: string[]
  acoesSugeridas?: string[]
}

// ─── Interface abstrata ───────────────────────────────────────────────────────

import type { FuzzyMatchResult, ConsumoSugerido, AlertaRuptura } from './ai-stock'

export interface AIStockProvider {
  // Skills existentes
  fuzzyMatchInsumo(
    nomeBruto: string,
    catalogo: { id: number; nome: string }[]
  ): Promise<FuzzyMatchResult>

  sugerirConsumo(
    nomeProcedimento: string,
    catalogo: { id: number; nome: string; unidadeMedida: string }[]
  ): Promise<ConsumoSugerido[]>

  gerarAlertaRuptura(params: {
    insumoId: number
    nome: string
    estoqueAtual: number
    consumoMedioDiario: number
    ultimoFornecedor?: string
    diasDesdeUltimoLote?: number
  }): Promise<AlertaRuptura>

  // Skills novas
  analisarTendenciaConsumo(params: {
    insumoId: number
    nome: string
    consumos30dias: { data: string; quantidade: number }[]
    consumos90dias: { data: string; quantidade: number }[]
  }): Promise<TendenciaConsumo>

  gerarOrdemCompra(params: {
    itensCriticos: {
      insumoId: number
      nome: string
      estoqueAtual: number
      estoqueMinimo: number
      consumoMedioDiario: number
      custoUnitarioMedio: number | null
    }[]
  }): Promise<OrdemCompra>

  classificarInsumo(nomeProduto: string): Promise<ClassificacaoInsumo>

  detectarAnomaliaConsumo(params: {
    insumoId: number
    nome: string
    quantidadeHoje: number
    historico60dias: { data: string; quantidade: number }[]
  }): Promise<AnomaliaConsumo>

  avaliarFornecedor(params: {
    fornecedorId: number
    nome: string
    lotes: {
      createdAt: string
      quantidade: number
      custoUnitario: number | null
      insumoNome: string
    }[]
  }): Promise<AvaliacaoFornecedor>

  resumoEstoqueSemanal(params: {
    consumosSemana: { insumoNome: string; quantidade: number; custo: number }[]
    insumosAbaixoMinimo: { nome: string; estoqueAtual: number; estoqueMinimo: number }[]
    custoSemanaAnterior: number
    custoSemanaAtual: number
  }): Promise<ResumoSemanal>

  responderPerguntaEstoque(params: {
    pergunta: string
    historico: MensagemChat[]
    contextoEstoque: string
  }): Promise<RespostaChat>
}

// ─── Factory + Singleton ──────────────────────────────────────────────────────

let _provider: AIStockProvider | null = null

export function createAIProvider(): AIStockProvider {
  // Importação lazy para evitar ciclo no build
  if (process.env.GEMINI_API_KEY) {
    const { GeminiStockProvider } = require('./gemini-stock') as { GeminiStockProvider: new () => AIStockProvider }
    return new GeminiStockProvider()
  }
  console.warn('[AI] GEMINI_API_KEY não configurada — usando Groq como fallback')
  const { GroqStockProvider } = require('./ai-stock') as { GroqStockProvider: new () => AIStockProvider }
  return new GroqStockProvider()
}

export function getAIProvider(): AIStockProvider {
  if (!_provider) _provider = createAIProvider()
  return _provider
}

// ─── Helper de fallback ───────────────────────────────────────────────────────

export async function callWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    return await primary()
  } catch (err) {
    console.error('[AI] Provedor primário falhou, usando fallback:', err)
    return await fallback()
  }
}
