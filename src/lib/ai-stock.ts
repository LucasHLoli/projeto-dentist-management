import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FuzzyMatchResult {
  insumoId: number | null
  confianca: number         // 0–1
  sugestao: string          // nome do insumo sugerido ou "NOVO"
  nomeBruto: string         // nome original da NF-e
}

export interface ConsumoSugerido {
  insumoId: number
  nomeInsumo: string
  quantidadeSugerida: number
  justificativa: string
}

export interface AlertaRuptura {
  insumoId: number
  nome: string
  estoqueAtual: number
  diasRestantes: number | null
  mensagemAI: string
  urgencia: 'critico' | 'alerta' | 'ok'
}

// ─── 1. Fuzzy match na importação NF-e ───────────────────────────────────────

export async function fuzzyMatchInsumo(
  nomeBruto: string,
  catalogoInsumos: { id: number; nome: string }[]
): Promise<FuzzyMatchResult> {
  if (catalogoInsumos.length === 0) {
    return { insumoId: null, confianca: 0, sugestao: 'NOVO', nomeBruto }
  }

  const prompt = `Você é um assistente de estoque de clínica odontológica.

Nome do produto na nota fiscal: "${nomeBruto}"

Catálogo de insumos existentes (id | nome):
${catalogoInsumos.map((i) => `${i.id} | ${i.nome}`).join('\n')}

Responda SOMENTE com JSON válido, sem explicação, neste formato exato:
{
  "insumoId": <número do id ou null se não houver correspondência>,
  "confianca": <número de 0 a 1>,
  "sugestao": "<nome do insumo correspondente ou NOVO se não encontrar>"
}

Regras:
- Confiança ≥ 0.85 significa correspondência forte (aceitar automaticamente)
- Confiança < 0.85 significa dúvida (mostrar para confirmar)
- Se nenhum insumo do catálogo corresponder, retorne insumoId: null, confianca: 0, sugestao: "NOVO"`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0,
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const result = JSON.parse(jsonMatch?.[0] ?? '{}')

    return {
      insumoId: result.insumoId ?? null,
      confianca: Number(result.confianca ?? 0),
      sugestao: result.sugestao ?? 'NOVO',
      nomeBruto,
    }
  } catch {
    return { insumoId: null, confianca: 0, sugestao: 'NOVO', nomeBruto }
  }
}

// ─── Categorias válidas (espelha a constante do frontend) ────────────────────

const CATEGORIAS_VALIDAS = [
  'Endodontia', 'Luvas/EPI', 'Anestesia', 'Restauração',
  'Limpeza/Esterilização', 'Prótese', 'Radiografia', 'Ortodontia',
  'Exodontia', 'Periodontia', 'Cirurgia Periodontal', 'Medicamentos', 'Outros',
]

// ─── 1b. Categorização automática de insumo por nome ─────────────────────────

export async function categorizarInsumo(nomeProduto: string): Promise<string> {
  const prompt = `Você é um assistente de estoque de clínica odontológica.
Classifique o produto abaixo em UMA das categorias listadas.

Produto: "${nomeProduto}"

Categorias disponíveis:
${CATEGORIAS_VALIDAS.join(', ')}

Responda SOMENTE com o nome exato de uma categoria da lista, sem explicação.
Se não souber classificar, responda: Outros`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 30,
      temperature: 0,
    })
    const resposta = (completion.choices[0]?.message?.content ?? '').trim()
    return CATEGORIAS_VALIDAS.includes(resposta) ? resposta : 'Outros'
  } catch {
    return 'Outros'
  }
}

// ─── SUBCATEGORIAS_MAP ────────────────────────────────────────────────────────

const SUBCATEGORIAS_MAP: Record<string, string[]> = {
  'Endodontia': ['Limas Manuais', 'Limas Rotatórias', 'Cones', 'Seladores/Cimentos', 'Irrigação'],
  'Anestesia': ['Com Vasoconstritor', 'Sem Vasoconstritor', 'Tópica'],
  'Restauração': ['Resinas', 'Adesivos', 'Ácidos', 'Ionômeros', 'Acabamento'],
  'Luvas/EPI': ['Luvas', 'Sugadores', 'Lençol de Borracha'],
  'Limpeza/Esterilização': ['Pasta Profilática', 'Escovas', 'Pedra Pomes'],
  'Medicamentos': ['Anti-inflamatório', 'Curativo', 'Clareador'],
  'Exodontia': ['Fios de Sutura', 'Lâminas'],
  'Outros': ['Brocas', 'Microbrush', 'Tiras'],
}

export { SUBCATEGORIAS_MAP }

export async function categorizarInsumoCompleto(nomeProduto: string): Promise<{ grupoCategoria: string; subcategoria: string | null }> {
  const grupoCategoria = await categorizarInsumo(nomeProduto)
  const subcategorias = SUBCATEGORIAS_MAP[grupoCategoria]
  if (!subcategorias || subcategorias.length === 0) {
    return { grupoCategoria, subcategoria: null }
  }

  const prompt = `Produto odontológico: "${nomeProduto}"
Categoria: ${grupoCategoria}

Subcategorias disponíveis: ${subcategorias.join(', ')}

Responda SOMENTE com o nome exato de uma subcategoria da lista. Se nenhuma se aplicar, responda: null`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 30,
      temperature: 0,
    })
    const resposta = (completion.choices[0]?.message?.content ?? '').trim()
    const sub = subcategorias.includes(resposta) ? resposta : null
    return { grupoCategoria, subcategoria: sub }
  } catch {
    return { grupoCategoria, subcategoria: null }
  }
}

// ─── 2. Sugestão de consumo por procedimento ─────────────────────────────────

export async function sugerirConsumo(
  nomeProcedimento: string,
  catalogoInsumos: { id: number; nome: string; unidadeMedida: string }[]
): Promise<ConsumoSugerido[]> {
  if (catalogoInsumos.length === 0) return []

  const prompt = `Você é especialista em materiais odontológicos.

Procedimento realizado: "${nomeProcedimento}"

Insumos disponíveis no estoque (id | nome | unidade):
${catalogoInsumos.map((i) => `${i.id} | ${i.nome} | ${i.unidadeMedida}`).join('\n')}

Liste apenas os insumos que TIPICAMENTE são usados neste procedimento.
Responda SOMENTE com JSON válido, sem explicação:
[
  {
    "insumoId": <id>,
    "nomeInsumo": "<nome>",
    "quantidadeSugerida": <número>,
    "justificativa": "<por que é usado>"
  }
]

Se nenhum insumo do catálogo for tipicamente usado, retorne: []`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.2,
    })

    const content = completion.choices[0]?.message?.content ?? '[]'
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    const result = JSON.parse(jsonMatch?.[0] ?? '[]')

    return Array.isArray(result) ? result : []
  } catch {
    return []
  }
}

// ─── 3. Previsão de ruptura com linguagem natural ─────────────────────────────

export async function gerarAlertaRuptura(params: {
  insumoId: number
  nome: string
  estoqueAtual: number
  consumoMedioDiario: number
  ultimoFornecedor?: string
  diasDesdeUltimoLote?: number
}): Promise<AlertaRuptura> {
  const { insumoId, nome, estoqueAtual, consumoMedioDiario, ultimoFornecedor, diasDesdeUltimoLote } =
    params

  const diasRestantes =
    consumoMedioDiario > 0 ? Math.floor(estoqueAtual / consumoMedioDiario) : null

  const urgencia: AlertaRuptura['urgencia'] =
    diasRestantes === null ? 'ok'
    : diasRestantes <= 7 ? 'critico'
    : diasRestantes <= 30 ? 'alerta'
    : 'ok'

  // Só chama IA para crítico ou alerta
  if (urgencia === 'ok') {
    return { insumoId, nome, estoqueAtual, diasRestantes, mensagemAI: '', urgencia }
  }

  const prompt = `Você é um assistente de estoque de clínica odontológica. Gere UMA frase curta e acionável (máximo 2 linhas) sobre este alerta de estoque:

Insumo: ${nome}
Estoque atual: ${estoqueAtual} unidades
Consumo médio: ${consumoMedioDiario.toFixed(2)} un/dia
Dias estimados até esgotar: ${diasRestantes ?? 'indeterminado'}
${ultimoFornecedor ? `Último fornecedor: ${ultimoFornecedor}` : ''}
${diasDesdeUltimoLote ? `Dias desde o último pedido: ${diasDesdeUltimoLote}` : ''}

Responda apenas a frase, sem prefixos, sem aspas.`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.4,
    })

    const mensagemAI = completion.choices[0]?.message?.content?.trim() ?? ''
    return { insumoId, nome, estoqueAtual, diasRestantes, mensagemAI, urgencia }
  } catch {
    const fallback = diasRestantes
      ? `${nome}: ~${diasRestantes} dias de estoque restantes.`
      : `${nome}: sem movimentação recente.`
    return { insumoId, nome, estoqueAtual, diasRestantes, mensagemAI: fallback, urgencia }
  }
}

// ─── GroqStockProvider — implementa AIStockProvider delegando para funções acima ──

import type {
  AIStockProvider,
  TendenciaConsumo,
  OrdemCompra,
  ClassificacaoInsumo,
  AnomaliaConsumo,
  AvaliacaoFornecedor,
  ResumoSemanal,
  MensagemChat,
  RespostaChat,
} from './ai-providers'

export class GroqStockProvider implements AIStockProvider {
  // ── Skills existentes (delegam para funções standalone acima) ────────────

  fuzzyMatchInsumo(
    nomeBruto: string,
    catalogo: { id: number; nome: string }[]
  ): Promise<FuzzyMatchResult> {
    return fuzzyMatchInsumo(nomeBruto, catalogo)
  }

  sugerirConsumo(
    nomeProcedimento: string,
    catalogo: { id: number; nome: string; unidadeMedida: string }[]
  ): Promise<ConsumoSugerido[]> {
    return sugerirConsumo(nomeProcedimento, catalogo)
  }

  gerarAlertaRuptura(params: {
    insumoId: number
    nome: string
    estoqueAtual: number
    consumoMedioDiario: number
    ultimoFornecedor?: string
    diasDesdeUltimoLote?: number
  }): Promise<AlertaRuptura> {
    return gerarAlertaRuptura(params)
  }

  // ── Skills novas — fallbacks determinísticos sem chamada AI ─────────────

  async analisarTendenciaConsumo(params: {
    insumoId: number
    nome: string
    consumos30dias: { data: string; quantidade: number }[]
    consumos90dias: { data: string; quantidade: number }[]
  }): Promise<TendenciaConsumo> {
    const { insumoId, nome, consumos30dias, consumos90dias } = params
    const media30 =
      consumos30dias.length > 0
        ? consumos30dias.reduce((s, c) => s + c.quantidade, 0) / consumos30dias.length
        : 0
    const consume60_90 = consumos90dias.slice(0, Math.max(0, consumos90dias.length - 30))
    const mediaAnterior =
      consume60_90.length > 0
        ? consume60_90.reduce((s, c) => s + c.quantidade, 0) / consume60_90.length
        : media30

    const pct = mediaAnterior > 0 ? ((media30 - mediaAnterior) / mediaAnterior) * 100 : 0
    const tendencia: TendenciaConsumo['tendencia'] =
      pct > 10 ? 'crescente' : pct < -10 ? 'decrescente' : 'estavel'

    return {
      insumoId,
      nome,
      tendencia,
      percentualMudanca: Math.round(pct * 10) / 10,
      mediaRecente: Math.round(media30 * 100) / 100,
      mediaAnterior: Math.round(mediaAnterior * 100) / 100,
      narrativa: `Consumo médio recente de ${media30.toFixed(2)} un/dia (${tendencia}).`,
      alertar: tendencia === 'crescente' && pct > 25,
    }
  }

  async gerarOrdemCompra(params: {
    itensCriticos: {
      insumoId: number
      nome: string
      estoqueAtual: number
      estoqueMinimo: number
      consumoMedioDiario: number
      custoUnitarioMedio: number | null
    }[]
  }): Promise<OrdemCompra> {
    const itens = params.itensCriticos.map((i) => {
      const reposicao = Math.max(i.estoqueMinimo * 2 - i.estoqueAtual, 1)
      const prioridade =
        i.estoqueAtual === 0
          ? 'urgente'
          : i.estoqueAtual < i.estoqueMinimo
          ? 'normal'
          : 'planejamento'
      return {
        insumoId: i.insumoId,
        nome: i.nome,
        estoqueAtual: i.estoqueAtual,
        estoqueMinimo: i.estoqueMinimo,
        quantidadeSugerida: reposicao,
        custoEstimado: i.custoUnitarioMedio ? i.custoUnitarioMedio * reposicao : null,
        prioridade: prioridade as 'urgente' | 'normal' | 'planejamento',
        justificativa: `Estoque ${i.estoqueAtual} abaixo do mínimo ${i.estoqueMinimo}.`,
      }
    })
    const custoTotal = itens.reduce((s, i) => s + (i.custoEstimado ?? 0), 0)
    return {
      itens,
      custoTotalEstimado: custoTotal,
      resumo: `${itens.length} item(ns) para reposição. Custo estimado R$ ${custoTotal.toFixed(2)}.`,
      geradoEm: new Date().toISOString(),
    }
  }

  async classificarInsumo(nomeProduto: string): Promise<ClassificacaoInsumo> {
    const nome = nomeProduto.toUpperCase()
    let grupoCategoria = 'Geral'
    if (/ANEST|LIDOC|MEPIV|ARTICAI/i.test(nome)) grupoCategoria = 'Anestesia'
    else if (/LUVA|MASCARA|OCUL|AVENTAL|DESCART/i.test(nome)) grupoCategoria = 'EPI'
    else if (/HIPOCLOR|EDTA|CLOREX/i.test(nome)) grupoCategoria = 'Endodontia'
    else if (/RESINA|CIMENT|LINER|BASE/i.test(nome)) grupoCategoria = 'Restauração'
    else if (/FITA|PAPEL|FILME|RADIOG/i.test(nome)) grupoCategoria = 'Diagnóstico'
    else if (/GEL|FLÚOR|SELANT/i.test(nome)) grupoCategoria = 'Prevenção'
    return {
      grupoCategoria,
      subcategoria: null,
      unidadeMedida: 'UN',
      usosMin: 1,
      usosMax: 5,
      confianca: 0.5,
      observacoes: 'Classificação automática básica — confirme manualmente.',
    }
  }

  async detectarAnomaliaConsumo(params: {
    insumoId: number
    nome: string
    quantidadeHoje: number
    historico60dias: { data: string; quantidade: number }[]
  }): Promise<AnomaliaConsumo> {
    const { insumoId, nome, quantidadeHoje, historico60dias } = params
    const n = historico60dias.length
    if (n < 5) {
      return {
        insumoId,
        nome,
        anomalia: false,
        quantidadeHoje,
        mediaHistorica: quantidadeHoje,
        desvioPadrao: 0,
        fatorDesvio: 0,
        explicacao: 'Histórico insuficiente para análise.',
        severidade: 'normal',
      }
    }
    const media = historico60dias.reduce((s, c) => s + c.quantidade, 0) / n
    const variance = historico60dias.reduce((s, c) => s + (c.quantidade - media) ** 2, 0) / n
    const dp = Math.sqrt(variance)
    const fator = dp > 0 ? (quantidadeHoje - media) / dp : 0
    const severidade: AnomaliaConsumo['severidade'] =
      Math.abs(fator) > 3 ? 'anomalo' : Math.abs(fator) > 2 ? 'suspeito' : 'normal'
    return {
      insumoId,
      nome,
      anomalia: severidade !== 'normal',
      quantidadeHoje,
      mediaHistorica: Math.round(media * 100) / 100,
      desvioPadrao: Math.round(dp * 100) / 100,
      fatorDesvio: Math.round(fator * 100) / 100,
      explicacao:
        severidade === 'normal'
          ? 'Consumo dentro do padrão histórico.'
          : `Consumo ${fator > 0 ? 'acima' : 'abaixo'} do esperado (${Math.abs(fator).toFixed(1)}σ).`,
      severidade,
    }
  }

  async avaliarFornecedor(params: {
    fornecedorId: number
    nome: string
    lotes: { createdAt: string; quantidade: number; custoUnitario: number | null; insumoNome: string }[]
  }): Promise<AvaliacaoFornecedor> {
    const { fornecedorId, nome, lotes } = params
    const totalGasto = lotes.reduce((s, l) => s + (l.custoUnitario ?? 0) * l.quantidade, 0)
    return {
      fornecedorId,
      nome,
      notaGeral: 7,
      notaConfiabilidade: 7,
      notaCusto: 7,
      notaQualidade: 7,
      totalLotes: lotes.length,
      totalGasto,
      narrativa: `${nome}: ${lotes.length} lotes fornecidos, total R$ ${totalGasto.toFixed(2)}.`,
      recomendacao: 'manter',
    }
  }

  async resumoEstoqueSemanal(params: {
    consumosSemana: { insumoNome: string; quantidade: number; custo: number }[]
    insumosAbaixoMinimo: { nome: string; estoqueAtual: number; estoqueMinimo: number }[]
    custoSemanaAnterior: number
    custoSemanaAtual: number
  }): Promise<ResumoSemanal> {
    const { consumosSemana, insumosAbaixoMinimo, custoSemanaAnterior, custoSemanaAtual } = params
    const hoje = new Date()
    const semanaAtras = new Date(hoje)
    semanaAtras.setDate(hoje.getDate() - 7)
    const top = [...consumosSemana]
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 5)
      .map((c) => ({ nome: c.insumoNome, quantidade: c.quantidade, custo: c.custo }))
    const tendencia: ResumoSemanal['tendenciaCustos'] =
      custoSemanaAtual > custoSemanaAnterior * 1.05
        ? 'alta'
        : custoSemanaAtual < custoSemanaAnterior * 0.95
        ? 'queda'
        : 'estavel'
    return {
      periodo: {
        inicio: semanaAtras.toISOString().split('T')[0],
        fim: hoje.toISOString().split('T')[0],
      },
      totalConsumido: consumosSemana.reduce((s, c) => s + c.quantidade, 0),
      custoSemana: custoSemanaAtual,
      insumosZerados: [],
      insumosAbaixoMinimo: insumosAbaixoMinimo.map((i) => i.nome),
      topConsumo: top,
      tendenciaCustos: tendencia,
      acoes: insumosAbaixoMinimo.map((i) => `Repor ${i.nome} (atual: ${i.estoqueAtual})`),
      narrativa: `Semana encerrada. Custo: R$ ${custoSemanaAtual.toFixed(2)} (${tendencia}). ${insumosAbaixoMinimo.length} insumo(s) abaixo do mínimo.`,
    }
  }

  async responderPerguntaEstoque(params: {
    pergunta: string
    historico: MensagemChat[]
    contextoEstoque: string
  }): Promise<RespostaChat> {
    const { pergunta, historico, contextoEstoque } = params
    const systemMsg = `Você é um assistente de estoque odontológico. Responda apenas com base nos dados fornecidos.\n\n${contextoEstoque}`
    const messages = [
      { role: 'system' as const, content: systemMsg },
      ...historico.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: pergunta },
    ]
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      })
      const resposta = completion.choices[0]?.message?.content?.trim() ?? 'Não foi possível responder.'
      return { resposta, fonteDados: ['Groq/Llama'], acoesSugeridas: [] }
    } catch {
      return { resposta: 'Serviço de IA temporariamente indisponível.', fonteDados: [], acoesSugeridas: [] }
    }
  }
}

// ─── 4. Contexto de estoque para injetar no chat ──────────────────────────────

export function formatarContextoEstoque(dados: {
  criticos: { nome: string; estoqueAtual: number; diasRestantes: number | null }[]
  top10: { nome: string; estoqueAtual: number; unidadeMedida: string }[]
  vencendo30dias: { nome: string; lotes: { validade: Date | null; quantidadeAtual: number }[] }[]
  custoUltimoMes: number
}): string {
  const linhas: string[] = ['ESTOQUE REAL (dados ao vivo):']

  if (dados.criticos.length > 0) {
    linhas.push('\nCRÍTICOS (abaixo do mínimo):')
    dados.criticos.forEach((i) => {
      const dias = i.diasRestantes ? ` (~${i.diasRestantes} dias)` : ''
      linhas.push(`- ${i.nome}: ${i.estoqueAtual} un${dias}`)
    })
  }

  if (dados.vencendo30dias.length > 0) {
    linhas.push('\nVENCENDO EM 30 DIAS:')
    dados.vencendo30dias.forEach((i) => {
      const lote = i.lotes[0]
      if (lote?.validade) {
        const d = lote.validade.toLocaleDateString('pt-BR')
        linhas.push(`- ${i.nome}: ${lote.quantidadeAtual} un, vence ${d}`)
      }
    })
  }

  if (dados.top10.length > 0) {
    linhas.push('\nESTOQUE DISPONÍVEL (top 10):')
    dados.top10.forEach((i) => {
      linhas.push(`- ${i.nome}: ${i.estoqueAtual} ${i.unidadeMedida}`)
    })
  }

  linhas.push(`\nCusto total de materiais (último mês): R$ ${dados.custoUltimoMes.toFixed(2)}`)

  return linhas.join('\n')
}
