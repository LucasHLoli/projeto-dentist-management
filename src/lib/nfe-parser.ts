import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '_',
  isArray: (name) => name === 'det',
})

// ─── Schemas de validação ─────────────────────────────────────────────────────

const NFeItemSchema = z.object({
  nomeProduto: z.string(),
  codigoProduto: z.string().optional(),
  quantidade: z.number().positive(),
  unidade: z.string(),
  valorUnitario: z.number().nonnegative(),
  valorTotal: z.number().nonnegative(),
})

const NFeDataSchema = z.object({
  chaveAcesso: z.string().length(44),
  numero: z.string(),
  serie: z.string(),
  dataEmissao: z.date(),
  valorTotal: z.number().nonnegative(),
  fornecedor: z.object({
    cnpj: z.string(),
    nome: z.string(),
  }),
  itens: z.array(NFeItemSchema),
})

export type NFeItem = z.infer<typeof NFeItemSchema>
export type NFeData = z.infer<typeof NFeDataSchema>

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseNFe(xmlContent: string): NFeData {
  const raw = parser.parse(xmlContent)

  // Suporta NF-e com e sem wrapper nfeProc
  const nfe = raw?.nfeProc?.NFe ?? raw?.NFe
  if (!nfe) throw new Error('XML não reconhecido como NF-e válida')

  const infNFe = nfe.infNFe
  if (!infNFe) throw new Error('Elemento infNFe não encontrado')

  // Chave de acesso
  const chaveAcesso =
    raw?.nfeProc?.protNFe?.infProt?.chNFe ??
    infNFe?._Id?.replace('NFe', '') ??
    ''

  // Fornecedor
  const emit = infNFe.emit
  const cnpjRaw: string = String(emit?.CNPJ ?? emit?.CPF ?? '')
  const cnpj = cnpjRaw.replace(/\D/g, '')
  const nomeFornecedor: string = emit?.xFant ?? emit?.xNome ?? 'Fornecedor Desconhecido'

  // Identificação da NF
  const ide = infNFe.ide
  const numero: string = String(ide?.nNF ?? '')
  const serie: string = String(ide?.serie ?? '1')
  const dataEmissaoRaw: string = ide?.dhEmi ?? ide?.dEmi ?? ''
  const dataEmissao = new Date(dataEmissaoRaw)

  // Valor total
  const valorTotal: number = Number(infNFe.total?.ICMSTot?.vNF ?? 0)

  // Itens
  const dets = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det]
  const itens: NFeItem[] = dets
    .filter(Boolean)
    .map((det: Record<string, unknown>) => {
      const prod = det.prod as Record<string, unknown>
      return {
        nomeProduto: String(prod?.xProd ?? ''),
        codigoProduto: prod?.cProd ? String(prod.cProd) : undefined,
        quantidade: Number(prod?.qCom ?? 0),
        unidade: String(prod?.uCom ?? 'UN'),
        valorUnitario: Number(prod?.vUnCom ?? 0),
        valorTotal: Number(prod?.vProd ?? 0),
      }
    })

  const data = NFeDataSchema.parse({
    chaveAcesso,
    numero,
    serie,
    dataEmissao,
    valorTotal,
    fornecedor: { cnpj, nome: nomeFornecedor },
    itens,
  })

  return data
}
