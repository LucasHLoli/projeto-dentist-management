import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'
import type { NFeData } from './nfe-parser'
import crypto from 'crypto'

// ─── Unidades aceitas pelo banco ─────────────────────────────────────────────

const UNIDADES_VALIDAS = ['UN', 'CX', 'FR', 'ML', 'G', 'KG', 'PC', 'RL', 'AMP', 'TB', 'CT', 'LT', 'SC', 'PT'] as const
type Unidade = typeof UNIDADES_VALIDAS[number]

function normalizarUnidade(raw: string): Unidade {
  const u = raw.toUpperCase().trim()
  // Mapeamento de abreviações comuns em notas fiscais
  const mapa: Record<string, Unidade> = {
    UN: 'UN', UND: 'UN', UNID: 'UN', UNIDADE: 'UN', PÇ: 'UN', PC: 'PC', PCS: 'PC', PEÇA: 'PC',
    CX: 'CX', CAIXA: 'CX', CAX: 'CX',
    FR: 'FR', FRASCO: 'FR', FRS: 'FR',
    ML: 'ML', MIL: 'ML',
    G: 'G', GR: 'G', GRS: 'G', GRAMA: 'G', GRAMAS: 'G',
    KG: 'KG', KILO: 'KG', QUILOGRAMA: 'KG',
    RL: 'RL', ROLO: 'RL',
    AMP: 'AMP', AMPOLA: 'AMP',
    TB: 'TB', TUBO: 'TB',
    CT: 'CT', CARTELA: 'CT', CART: 'CT',
    LT: 'LT', LITRO: 'LT', LITROS: 'LT', L: 'LT',
    SC: 'SC', SACHE: 'SC', SACHÊ: 'SC',
    PT: 'PT', POTE: 'PT',
  }
  return mapa[u] ?? 'UN'
}

// ─── Schema Gemini ────────────────────────────────────────────────────────────

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    numero: { type: SchemaType.STRING },
    serie: { type: SchemaType.STRING },
    dataEmissao: { type: SchemaType.STRING, description: 'Data de emissão YYYY-MM-DD' },
    chaveAcesso: { type: SchemaType.STRING, description: '44 dígitos numéricos ou string vazia' },
    valorTotal: { type: SchemaType.NUMBER },
    fornecedorCnpj: { type: SchemaType.STRING, description: 'Somente dígitos, sem pontos ou traços' },
    fornecedorNome: { type: SchemaType.STRING },
    itens: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nomeProduto: { type: SchemaType.STRING, description: 'Nome completo do produto como aparece na nota' },
          quantidade: { type: SchemaType.NUMBER, description: 'Quantidade numérica (pode ser decimal)' },
          unidade: {
            type: SchemaType.STRING,
            description: 'Use EXATAMENTE uma dessas siglas: UN, CX, FR, ML, G, KG, PC, RL, AMP, TB, CT, LT, SC, PT. Traduzir "FRASCO" para FR, "CAIXA" para CX, "UNIDADE" para UN, etc.',
          },
          valorUnitario: { type: SchemaType.NUMBER, description: 'Preço por unidade em reais' },
          valorTotal: { type: SchemaType.NUMBER, description: 'Valor total do item em reais' },
          validade: {
            type: SchemaType.STRING,
            description: 'Data de validade do produto se aparecer na nota, formato YYYY-MM-DD. String vazia se não informada.',
          },
        },
        required: ['nomeProduto', 'quantidade', 'unidade', 'valorUnitario', 'valorTotal', 'validade'],
      },
    },
  },
  required: ['numero', 'serie', 'dataEmissao', 'valorTotal', 'fornecedorCnpj', 'fornecedorNome', 'itens'],
}

const PROMPT = `Você é um extrator especializado em notas fiscais brasileiras para uma clínica odontológica.

Extraia TODOS os dados desta nota fiscal (DANFE, PDF ou foto) com máxima precisão.

═══ REGRAS OBRIGATÓRIAS ═══

FORNECEDOR:
- Extraia o EMITENTE (quem vendeu/forneceu), NÃO o destinatário
- CNPJ: somente os 14 dígitos, sem pontos, traços ou barras

PRODUTOS — campo "unidade":
Use EXATAMENTE uma dessas siglas conforme a tabela abaixo:
  UN  → Unidade, und, unid, pç, peça
  CX  → Caixa, cx, caixa
  FR  → Frasco, frs, frasco
  ML  → Mililitro, ml
  G   → Grama, gr, grs, g
  KG  → Quilograma, kg, kilo
  PC  → Peça, pcs, pc
  RL  → Rolo, rl
  AMP → Ampola, amp
  TB  → Tubo, tb, tubo
  CT  → Cartela, cart, ct
  LT  → Litro, lt, l, litros
  SC  → Sachê, sache, sc
  PT  → Pote, pt

VALIDADE:
- Se aparecer na nota (rótulo, descrição do produto, campo específico), extraia no formato YYYY-MM-DD
- Se não aparecer, retorne string vazia ""
- Datas com apenas mês/ano (ex: "12/2026") → use o último dia do mês: "2026-12-31"

VALORES:
- valorUnitario = preço por unidade em reais (número decimal)
- valorTotal = quantidade × valorUnitario

DATA DE EMISSÃO: formato YYYY-MM-DD

CHAVE DE ACESSO: 44 dígitos (código de barras do DANFE). Se não visível, retorne "".

Retorne JSON válido com TODOS os campos.`

// ─── Parser principal ─────────────────────────────────────────────────────────

export interface DanfeItem {
  nomeProduto: string
  quantidade: number
  unidade: Unidade
  valorUnitario: number
  valorTotal: number
  validade: string | null // YYYY-MM-DD ou null
}

export interface DanfeResult extends NFeData {
  itensComValidade: DanfeItem[]
}

export async function parseDanfe(
  fileBuffer: Buffer,
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<DanfeResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0,
      maxOutputTokens: 2048,
    },
  })

  const base64Data = fileBuffer.toString('base64')

  const result = await model.generateContent([
    { text: PROMPT },
    { inlineData: { mimeType, data: base64Data } },
  ])

  const raw = JSON.parse(result.response.text())

  // Normalizar chave de acesso
  const chaveAcesso =
    typeof raw.chaveAcesso === 'string' && /^\d{44}$/.test(raw.chaveAcesso)
      ? raw.chaveAcesso
      : `DANFE${crypto.randomBytes(20).toString('hex')}`.slice(0, 44)

  // Normalizar CNPJ
  const cnpj = String(raw.fornecedorCnpj ?? '').replace(/\D/g, '').padStart(14, '0')

  // Normalizar data de emissão
  let dataEmissao: Date
  try {
    dataEmissao = new Date(raw.dataEmissao)
    if (isNaN(dataEmissao.getTime())) dataEmissao = new Date()
  } catch {
    dataEmissao = new Date()
  }

  // Normalizar itens
  const itensComValidade: DanfeItem[] = (raw.itens ?? []).map((item: {
    nomeProduto: string
    quantidade: number
    unidade: string
    valorUnitario: number
    valorTotal: number
    validade: string
  }) => {
    const validade = item.validade && item.validade.trim() !== ''
      ? item.validade.trim()
      : null

    return {
      nomeProduto: String(item.nomeProduto ?? '').trim() || 'Produto sem nome',
      quantidade: Number(item.quantidade) || 1,
      unidade: normalizarUnidade(String(item.unidade ?? 'UN')),
      valorUnitario: Number(item.valorUnitario) || 0,
      valorTotal: Number(item.valorTotal) || 0,
      validade,
    }
  })

  const nfeData: NFeData = {
    chaveAcesso,
    numero: String(raw.numero ?? '0'),
    serie: String(raw.serie ?? '1'),
    dataEmissao,
    valorTotal: Number(raw.valorTotal) || 0,
    fornecedor: {
      cnpj: cnpj || '00000000000000',
      nome: String(raw.fornecedorNome ?? 'Fornecedor não identificado').trim(),
    },
    itens: itensComValidade.map((i) => ({
      nomeProduto: i.nomeProduto,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valorUnitario: i.valorUnitario,
      valorTotal: i.valorTotal,
    })),
  }

  return { ...nfeData, itensComValidade }
}

// ─── Detectar tipo MIME pelo buffer ──────────────────────────────────────────

export function detectMimeType(
  buffer: Buffer,
  filename: string
): 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp'

  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'

  return null
}
