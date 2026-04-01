import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type {
  AIStockProvider, FuzzyMatchResult, ConsumoSugerido, AlertaRuptura,
  TendenciaConsumo, OrdemCompra, ItemOrdemCompra, ClassificacaoInsumo,
  AnomaliaConsumo, AvaliacaoFornecedor, ResumoSemanal, MensagemChat, RespostaChat,
} from './ai-providers'

function getGenAI() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY não configurada')
  return new GoogleGenerativeAI(key)
}

// ─── Helper: modelo com JSON mode ────────────────────────────────────────────

function jsonModel(schema: object, temperature = 0, maxOutputTokens = 512) {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema as never,
      temperature,
      maxOutputTokens,
    },
  })
}

function textModel(temperature = 0.7, maxOutputTokens = 1024) {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature, maxOutputTokens },
  })
}

async function generateJSON<T>(model: ReturnType<typeof jsonModel>, prompt: string): Promise<T> {
  const result = await model.generateContent(prompt)
  return JSON.parse(result.response.text()) as T
}

// ─── GeminiStockProvider ─────────────────────────────────────────────────────

export class GeminiStockProvider implements AIStockProvider {

  // ── 1. Fuzzy match NF-e ────────────────────────────────────────────────────

  async fuzzyMatchInsumo(
    nomeBruto: string,
    catalogo: { id: number; nome: string }[]
  ): Promise<FuzzyMatchResult> {
    if (catalogo.length === 0) return { insumoId: null, confianca: 0, sugestao: 'NOVO', nomeBruto }

    const model = jsonModel({
      type: SchemaType.OBJECT,
      properties: {
        insumoId: { type: SchemaType.NUMBER, nullable: true },
        confianca: { type: SchemaType.NUMBER },
        sugestao: { type: SchemaType.STRING },
      },
      required: ['insumoId', 'confianca', 'sugestao'],
    }, 0, 150)

    const prompt = `Você é especialista em insumos odontológicos brasileiros.
Nome na nota fiscal: "${nomeBruto}"
Catálogo (id | nome):
${catalogo.map(i => `${i.id} | ${i.nome}`).join('\n')}

Encontre a melhor correspondência. Regras:
- confianca >= 0.85: correspondência forte (aceitar automaticamente)
- confianca < 0.85: dúvida (pedir confirmação)
- Sem correspondência: insumoId null, confianca 0, sugestao "NOVO"
- Ignore diferenças de case, acentuação, siglas e unidades (2.5% vs 2,5%, ML vs mL)`

    try {
      const r = await generateJSON<{ insumoId: number | null; confianca: number; sugestao: string }>(model, prompt)
      return { ...r, nomeBruto }
    } catch {
      return { insumoId: null, confianca: 0, sugestao: 'NOVO', nomeBruto }
    }
  }

  // ── 2. Sugestão de consumo por procedimento ────────────────────────────────

  async sugerirConsumo(
    nomeProcedimento: string,
    catalogo: { id: number; nome: string; unidadeMedida: string }[]
  ): Promise<ConsumoSugerido[]> {
    if (catalogo.length === 0) return []

    const model = jsonModel({
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          insumoId: { type: SchemaType.NUMBER },
          nomeInsumo: { type: SchemaType.STRING },
          quantidadeSugerida: { type: SchemaType.NUMBER },
          justificativa: { type: SchemaType.STRING },
        },
        required: ['insumoId', 'nomeInsumo', 'quantidadeSugerida', 'justificativa'],
      },
    }, 0.2, 400)

    const prompt = `Você é especialista em protocolos clínicos odontológicos brasileiros.
Procedimento: "${nomeProcedimento}"
Insumos disponíveis (id | nome | unidade):
${catalogo.map(i => `${i.id} | ${i.nome} | ${i.unidadeMedida}`).join('\n')}

Liste apenas os insumos tipicamente usados neste procedimento. Se nenhum for tipicamente necessário, retorne array vazio [].
Para quantidade, use frações (0.25 = ¼ de um frasco, 1 = uma unidade completa).`

    try {
      return await generateJSON<ConsumoSugerido[]>(model, prompt)
    } catch {
      return []
    }
  }

  // ── 3. Alerta de ruptura ───────────────────────────────────────────────────

  async gerarAlertaRuptura(params: {
    insumoId: number; nome: string; estoqueAtual: number
    consumoMedioDiario: number; ultimoFornecedor?: string; diasDesdeUltimoLote?: number
  }): Promise<AlertaRuptura> {
    const { insumoId, nome, estoqueAtual, consumoMedioDiario, ultimoFornecedor, diasDesdeUltimoLote } = params
    const diasRestantes = consumoMedioDiario > 0 ? Math.floor(estoqueAtual / consumoMedioDiario) : null
    const urgencia: AlertaRuptura['urgencia'] =
      diasRestantes === null ? 'ok' : diasRestantes <= 7 ? 'critico' : diasRestantes <= 30 ? 'alerta' : 'ok'

    if (urgencia === 'ok') return { insumoId, nome, estoqueAtual, diasRestantes, mensagemAI: '', urgencia }

    const model = textModel(0.4, 120)
    const prompt = `Clínica odontológica. Alerta de estoque — gere UMA frase curta e acionável (máx 2 linhas):
Insumo: ${nome} | Estoque: ${estoqueAtual} un | Consumo médio: ${consumoMedioDiario.toFixed(2)} un/dia | Dias estimados: ${diasRestantes ?? '?'}
${ultimoFornecedor ? `Fornecedor: ${ultimoFornecedor}` : ''}${diasDesdeUltimoLote ? ` | Último pedido: ${diasDesdeUltimoLote} dias atrás` : ''}
Responda apenas a frase, em português, sem prefixos ou aspas.`

    try {
      const result = await model.generateContent(prompt)
      return { insumoId, nome, estoqueAtual, diasRestantes, mensagemAI: result.response.text().trim(), urgencia }
    } catch {
      return { insumoId, nome, estoqueAtual, diasRestantes, mensagemAI: `${nome}: ~${diasRestantes ?? '?'} dias de estoque.`, urgencia }
    }
  }

  // ── 4. Análise de tendência de consumo ────────────────────────────────────

  async analisarTendenciaConsumo(params: {
    insumoId: number; nome: string
    consumos30dias: { data: string; quantidade: number }[]
    consumos90dias: { data: string; quantidade: number }[]
  }): Promise<TendenciaConsumo> {
    const { insumoId, nome, consumos30dias, consumos90dias } = params

    const soma30 = consumos30dias.reduce((s, c) => s + c.quantidade, 0)
    const soma60_90 = consumos90dias.filter(c => {
      const d = new Date(c.data); const limite = new Date(); limite.setDate(limite.getDate() - 30); return d < limite
    }).reduce((s, c) => s + c.quantidade, 0)

    const media30 = soma30 / 30
    const media60_90 = soma60_90 / 60

    const model = jsonModel({
      type: SchemaType.OBJECT,
      properties: {
        tendencia: { type: SchemaType.STRING },
        percentualMudanca: { type: SchemaType.NUMBER },
        narrativa: { type: SchemaType.STRING },
        alertar: { type: SchemaType.BOOLEAN },
      },
      required: ['tendencia', 'percentualMudanca', 'narrativa', 'alertar'],
    }, 0.3, 400)

    const prompt = `Analise a tendência de consumo do insumo "${nome}" em uma clínica odontológica:
- Média diária últimos 30 dias: ${media30.toFixed(3)} un/dia (total: ${soma30})
- Média diária 31–90 dias atrás: ${media60_90.toFixed(3)} un/dia (total: ${soma60_90})

Responda em JSON com:
- tendencia: "crescente" | "estavel" | "decrescente"
- percentualMudanca: número (positivo = crescimento, negativo = queda)
- narrativa: frase em português explicando a tendência e o que isso significa para a clínica
- alertar: true se a tendência requer atenção imediata`

    try {
      const r = await generateJSON<{ tendencia: string; percentualMudanca: number; narrativa: string; alertar: boolean }>(model, prompt)
      return {
        insumoId, nome,
        tendencia: r.tendencia as TendenciaConsumo['tendencia'],
        percentualMudanca: r.percentualMudanca,
        mediaRecente: media30,
        mediaAnterior: media60_90,
        narrativa: r.narrativa,
        alertar: r.alertar,
      }
    } catch {
      const delta = media60_90 > 0 ? ((media30 - media60_90) / media60_90) * 100 : 0
      return {
        insumoId, nome,
        tendencia: delta > 10 ? 'crescente' : delta < -10 ? 'decrescente' : 'estavel',
        percentualMudanca: delta,
        mediaRecente: media30,
        mediaAnterior: media60_90,
        narrativa: 'Análise indisponível no momento.',
        alertar: false,
      }
    }
  }

  // ── 5. Geração de ordem de compra ─────────────────────────────────────────

  async gerarOrdemCompra(params: {
    itensCriticos: {
      insumoId: number; nome: string; estoqueAtual: number; estoqueMinimo: number
      consumoMedioDiario: number; custoUnitarioMedio: number | null
    }[]
  }): Promise<OrdemCompra> {
    const model = jsonModel({
      type: SchemaType.OBJECT,
      properties: {
        itens: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              insumoId: { type: SchemaType.NUMBER },
              nome: { type: SchemaType.STRING },
              estoqueAtual: { type: SchemaType.NUMBER },
              estoqueMinimo: { type: SchemaType.NUMBER },
              quantidadeSugerida: { type: SchemaType.NUMBER },
              custoEstimado: { type: SchemaType.NUMBER, nullable: true },
              prioridade: { type: SchemaType.STRING },
              justificativa: { type: SchemaType.STRING },
            },
            required: ['insumoId', 'nome', 'estoqueAtual', 'estoqueMinimo', 'quantidadeSugerida', 'prioridade', 'justificativa'],
          },
        },
        custoTotalEstimado: { type: SchemaType.NUMBER },
        resumo: { type: SchemaType.STRING },
      },
      required: ['itens', 'custoTotalEstimado', 'resumo'],
    }, 0.2, 600)

    const prompt = `Você é gestor de suprimentos de uma clínica odontológica.
Gere uma ordem de compra para os itens abaixo que estão abaixo do estoque mínimo.

Itens críticos:
${params.itensCriticos.map(i =>
  `- ${i.nome}: estoque ${i.estoqueAtual}/${i.estoqueMinimo} mín | consumo ${i.consumoMedioDiario.toFixed(2)}/dia${i.custoUnitarioMedio ? ` | R$${i.custoUnitarioMedio.toFixed(2)}/un` : ''}`
).join('\n')}

Para cada item:
- quantidadeSugerida: suficiente para 60 dias + 20% reserva
- prioridade: "urgente" (estoque=0 ou dias<7), "normal" (dias 7-30), "planejamento" (>30 dias)
- custoEstimado: quantidadeSugerida × custoUnitarioMedio (null se sem custo)
- resumo: parágrafo executivo em português descrevendo a ordem`

    try {
      const r = await generateJSON<{ itens: ItemOrdemCompra[]; custoTotalEstimado: number; resumo: string }>(model, prompt)
      return { ...r, geradoEm: new Date().toISOString() }
    } catch {
      const itens: ItemOrdemCompra[] = params.itensCriticos.map(i => ({
        insumoId: i.insumoId, nome: i.nome, estoqueAtual: i.estoqueAtual, estoqueMinimo: i.estoqueMinimo,
        quantidadeSugerida: Math.ceil(i.consumoMedioDiario * 72),
        custoEstimado: i.custoUnitarioMedio ? Math.ceil(i.consumoMedioDiario * 72) * i.custoUnitarioMedio : null,
        prioridade: i.estoqueAtual === 0 ? 'urgente' : 'normal',
        justificativa: 'Abaixo do estoque mínimo.',
      }))
      return { itens, custoTotalEstimado: itens.reduce((s, i) => s + (i.custoEstimado ?? 0), 0), resumo: 'Ordem gerada automaticamente.', geradoEm: new Date().toISOString() }
    }
  }

  // ── 6. Classificação de insumo ────────────────────────────────────────────

  async classificarInsumo(nomeProduto: string): Promise<ClassificacaoInsumo> {
    const model = jsonModel({
      type: SchemaType.OBJECT,
      properties: {
        grupoCategoria: { type: SchemaType.STRING },
        subcategoria: { type: SchemaType.STRING, nullable: true },
        unidadeMedida: { type: SchemaType.STRING },
        usosMin: { type: SchemaType.NUMBER },
        usosMax: { type: SchemaType.NUMBER },
        confianca: { type: SchemaType.NUMBER },
        observacoes: { type: SchemaType.STRING },
      },
      required: ['grupoCategoria', 'subcategoria', 'unidadeMedida', 'usosMin', 'usosMax', 'confianca', 'observacoes'],
    }, 0, 200)

    const prompt = `Você é especialista em materiais odontológicos brasileiros.
Classifique o insumo: "${nomeProduto}"

Categorias válidas: Anestesia, Endodontia, Limpeza/Profilaxia, Restauração, Prótese, Periodontia, EPI, Diagnóstico, Radiologia, Esterilização, Emergência, Outros

Subcategorias por grupo:
Endodontia: Limas Manuais, Limas Rotatórias, Cones, Seladores/Cimentos, Irrigação
Anestesia: Com Vasoconstritor, Sem Vasoconstritor, Tópica
Restauração: Resinas, Adesivos, Ácidos, Ionômeros, Acabamento
Luvas/EPI: Luvas, Sugadores, Lençol de Borracha
Limpeza/Esterilização: Pasta Profilática, Escovas, Pedra Pomes
Medicamentos: Anti-inflamatório, Curativo, Clareador
Exodontia: Fios de Sutura, Lâminas
Outros: Brocas, Microbrush, Tiras

Se nenhuma subcategoria se aplicar, retorne subcategoria: null.

Unidades válidas: UN (unidade), CX (caixa), FR (frasco), ML (mililitro), G (grama), KG (quilograma), PC (pacote), RL (rolo), BL (bloco)

usosMin/usosMax: quantos atendimentos/procedimentos um produto rende em média (ex: frasco de anestesia = 8 a 15 usos)
confianca: 0.0 a 1.0 (sua certeza na classificação)`

    try {
      return await generateJSON<ClassificacaoInsumo>(model, prompt)
    } catch {
      return { grupoCategoria: 'Outros', subcategoria: null, unidadeMedida: 'UN', usosMin: 1, usosMax: 1, confianca: 0, observacoes: 'Classificação automática indisponível.' }
    }
  }

  // ── 7. Detecção de anomalia de consumo ────────────────────────────────────

  async detectarAnomaliaConsumo(params: {
    insumoId: number; nome: string; quantidadeHoje: number
    historico60dias: { data: string; quantidade: number }[]
  }): Promise<AnomaliaConsumo> {
    const { insumoId, nome, quantidadeHoje, historico60dias } = params

    // Calcular média e desvio padrão server-side
    const qtds = historico60dias.map(h => h.quantidade)
    const media = qtds.length > 0 ? qtds.reduce((s, q) => s + q, 0) / qtds.length : 0
    const variance = qtds.length > 1 ? qtds.reduce((s, q) => s + Math.pow(q - media, 2), 0) / (qtds.length - 1) : 0
    const stddev = Math.sqrt(variance)
    const fatorDesvio = stddev > 0 ? Math.abs(quantidadeHoje - media) / stddev : 0

    const model = jsonModel({
      type: SchemaType.OBJECT,
      properties: {
        anomalia: { type: SchemaType.BOOLEAN },
        explicacao: { type: SchemaType.STRING },
        severidade: { type: SchemaType.STRING },
      },
      required: ['anomalia', 'explicacao', 'severidade'],
    }, 0.1, 300)

    const prompt = `Analise se o consumo de hoje é anômalo para o insumo "${nome}" em uma clínica odontológica:
- Quantidade consumida hoje: ${quantidadeHoje} un
- Média histórica (60 dias): ${media.toFixed(2)} un/dia
- Desvio padrão: ${stddev.toFixed(2)}
- Fator de desvio (z-score): ${fatorDesvio.toFixed(2)}

Responda:
- anomalia: true se fator desvio > 2.0 ou consumo hoje > 3× média
- severidade: "normal" (z<1.5), "suspeito" (1.5≤z<2.5), "anomalo" (z≥2.5)
- explicacao: frase em português explicando o que significa e o que pode ter causado`

    try {
      const r = await generateJSON<{ anomalia: boolean; explicacao: string; severidade: string }>(model, prompt)
      return {
        insumoId, nome, anomalia: r.anomalia, quantidadeHoje,
        mediaHistorica: media, desvioPadrao: stddev, fatorDesvio,
        explicacao: r.explicacao,
        severidade: r.severidade as AnomaliaConsumo['severidade'],
      }
    } catch {
      return {
        insumoId, nome, anomalia: fatorDesvio > 2,
        quantidadeHoje, mediaHistorica: media, desvioPadrao: stddev, fatorDesvio,
        explicacao: fatorDesvio > 2 ? 'Consumo incomum detectado.' : 'Consumo dentro do normal.',
        severidade: fatorDesvio >= 2.5 ? 'anomalo' : fatorDesvio >= 1.5 ? 'suspeito' : 'normal',
      }
    }
  }

  // ── 8. Avaliação de fornecedor ────────────────────────────────────────────

  async avaliarFornecedor(params: {
    fornecedorId: number; nome: string
    lotes: { createdAt: string; quantidade: number; custoUnitario: number | null; insumoNome: string }[]
  }): Promise<AvaliacaoFornecedor> {
    const { fornecedorId, nome, lotes } = params
    const totalGasto = lotes.reduce((s, l) => s + l.quantidade * (l.custoUnitario ?? 0), 0)

    const model = jsonModel({
      type: SchemaType.OBJECT,
      properties: {
        notaGeral: { type: SchemaType.NUMBER },
        notaConfiabilidade: { type: SchemaType.NUMBER },
        notaCusto: { type: SchemaType.NUMBER },
        notaQualidade: { type: SchemaType.NUMBER },
        narrativa: { type: SchemaType.STRING },
        recomendacao: { type: SchemaType.STRING },
      },
      required: ['notaGeral', 'notaConfiabilidade', 'notaCusto', 'notaQualidade', 'narrativa', 'recomendacao'],
    }, 0.5, 600)

    const ultimosLotes = lotes.slice(0, 20)
    const prompt = `Avalie o fornecedor "${nome}" de uma clínica odontológica com base no histórico:
Total de lotes: ${lotes.length} | Gasto total: R$${totalGasto.toFixed(2)}
Últimos ${ultimosLotes.length} lotes:
${ultimosLotes.map(l => `${new Date(l.createdAt).toLocaleDateString('pt-BR')} | ${l.insumoNome} | ${l.quantidade} un | ${l.custoUnitario ? `R$${l.custoUnitario.toFixed(2)}/un` : 'custo ?'}`).join('\n')}

Forneça notas de 0 a 10 para: confiabilidade (frequência/consistência de entregas), custo-benefício, qualidade percebida.
- recomendacao: "manter" (≥7), "avaliar" (4–6), "substituir" (<4)
- narrativa: parágrafo em português com análise contextualizada`

    try {
      const r = await generateJSON<{ notaGeral: number; notaConfiabilidade: number; notaCusto: number; notaQualidade: number; narrativa: string; recomendacao: string }>(model, prompt)
      return { fornecedorId, nome, ...r, totalLotes: lotes.length, totalGasto, recomendacao: r.recomendacao as AvaliacaoFornecedor['recomendacao'] }
    } catch {
      return { fornecedorId, nome, notaGeral: 5, notaConfiabilidade: 5, notaCusto: 5, notaQualidade: 5, totalLotes: lotes.length, totalGasto, narrativa: 'Avaliação indisponível.', recomendacao: 'avaliar' }
    }
  }

  // ── 9. Resumo semanal executivo ────────────────────────────────────────────

  async resumoEstoqueSemanal(params: {
    consumosSemana: { insumoNome: string; quantidade: number; custo: number }[]
    insumosAbaixoMinimo: { nome: string; estoqueAtual: number; estoqueMinimo: number }[]
    custoSemanaAnterior: number
    custoSemanaAtual: number
  }): Promise<ResumoSemanal> {
    const { consumosSemana, insumosAbaixoMinimo, custoSemanaAnterior, custoSemanaAtual } = params

    const model = jsonModel({
      type: SchemaType.OBJECT,
      properties: {
        tendenciaCustos: { type: SchemaType.STRING },
        acoes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        narrativa: { type: SchemaType.STRING },
        insumosZerados: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ['tendenciaCustos', 'acoes', 'narrativa', 'insumosZerados'],
    }, 0.6, 800)

    const hoje = new Date()
    const semanaPassada = new Date(hoje); semanaPassada.setDate(hoje.getDate() - 7)
    const top5 = [...consumosSemana].sort((a, b) => b.custo - a.custo).slice(0, 5)

    const prompt = `Você é gestor de suprimentos de uma clínica odontológica. Gere um resumo semanal executivo.

Período: ${semanaPassada.toLocaleDateString('pt-BR')} a ${hoje.toLocaleDateString('pt-BR')}
Custo esta semana: R$${custoSemanaAtual.toFixed(2)}
Custo semana anterior: R$${custoSemanaAnterior.toFixed(2)}
Variação: ${custoSemanaAnterior > 0 ? (((custoSemanaAtual - custoSemanaAnterior) / custoSemanaAnterior) * 100).toFixed(1) : '?'}%

Top 5 consumos por custo:
${top5.map(c => `- ${c.insumoNome}: ${c.quantidade} un | R$${c.custo.toFixed(2)}`).join('\n')}

Itens abaixo do mínimo (${insumosAbaixoMinimo.length}):
${insumosAbaixoMinimo.map(i => `- ${i.nome}: ${i.estoqueAtual}/${i.estoqueMinimo}`).join('\n') || 'Nenhum'}

Forneça:
- tendenciaCustos: "alta" | "estavel" | "queda"
- acoes: lista de 3-5 ações recomendadas para esta semana
- narrativa: parágrafo executivo de 2-3 frases em português
- insumosZerados: lista de nomes de insumos com estoque = 0`

    try {
      const r = await generateJSON<{ tendenciaCustos: string; acoes: string[]; narrativa: string; insumosZerados: string[] }>(model, prompt)
      return {
        periodo: { inicio: semanaPassada.toISOString(), fim: hoje.toISOString() },
        totalConsumido: consumosSemana.reduce((s, c) => s + c.quantidade, 0),
        custoSemana: custoSemanaAtual,
        insumosZerados: r.insumosZerados,
        insumosAbaixoMinimo: insumosAbaixoMinimo.map(i => i.nome),
        topConsumo: top5.map(c => ({ nome: c.insumoNome, quantidade: c.quantidade, custo: c.custo })),
        tendenciaCustos: r.tendenciaCustos as ResumoSemanal['tendenciaCustos'],
        acoes: r.acoes,
        narrativa: r.narrativa,
      }
    } catch {
      return {
        periodo: { inicio: semanaPassada.toISOString(), fim: hoje.toISOString() },
        totalConsumido: consumosSemana.reduce((s, c) => s + c.quantidade, 0),
        custoSemana: custoSemanaAtual,
        insumosZerados: [],
        insumosAbaixoMinimo: insumosAbaixoMinimo.map(i => i.nome),
        topConsumo: top5.map(c => ({ nome: c.insumoNome, quantidade: c.quantidade, custo: c.custo })),
        tendenciaCustos: 'estavel',
        acoes: ['Verificar itens abaixo do estoque mínimo.'],
        narrativa: 'Resumo semanal gerado automaticamente.',
      }
    }
  }

  // ── 10. Chat dedicado de estoque ──────────────────────────────────────────

  async responderPerguntaEstoque(params: {
    pergunta: string
    historico: MensagemChat[]
    contextoEstoque: string
  }): Promise<RespostaChat> {
    const { pergunta, historico, contextoEstoque } = params

    const systemInstruction = `Você é a IA de gestão de estoque da DentFlow, uma clínica odontológica em Fortaleza, Ceará.
Você tem acesso completo ao estado atual do estoque e pode responder qualquer pergunta sobre insumos, lotes, consumo, fornecedores e custos.
Responda sempre em português do Brasil. Seja preciso com números. Quando sugerir ações, seja específico e prático.

${contextoEstoque}`

    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    })

    const chat = model.startChat({
      history: historico.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    })

    try {
      const result = await chat.sendMessage(pergunta)
      const resposta = result.response.text()
      return {
        resposta,
        fonteDados: ['Banco de dados de estoque em tempo real'],
        acoesSugeridas: [],
      }
    } catch {
      return {
        resposta: 'Não consegui processar sua pergunta no momento. Tente novamente.',
        fonteDados: [],
      }
    }
  }
}
