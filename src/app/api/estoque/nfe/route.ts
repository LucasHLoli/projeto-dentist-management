import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { parseNFe } from '@/lib/nfe-parser'
import { parseDanfe, detectMimeType } from '@/lib/danfe-parser'
import { fuzzyMatchInsumo } from '@/lib/ai-stock'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const notas = await db.nFeImport.findMany({
      include: {
        fornecedor: { select: { cnpj: true, nome: true } },
        lotes: {
          where: { status: { not: 'DESCARTADO' } },
          include: {
            insumo: { select: { nome: true, grupoCategoria: true, unidadeMedida: true } },
          },
        },
      },
      orderBy: { dataEmissao: 'desc' },
    })

    const result = notas.map((n) => ({
      id: n.id,
      numero: n.numero,
      serie: n.serie,
      chaveAcesso: n.chaveAcesso,
      dataEmissao: n.dataEmissao,
      valorTotal: n.valorTotal,
      xmlPath: n.xmlPath,
      fornecedor: n.fornecedor,
      totalProdutos: n.lotes.length,
      lotes: n.lotes.map((l) => ({
        id: l.id,
        nomeProduto: l.insumo?.nome ?? '—',
        categoria: l.insumo?.grupoCategoria ?? null,
        quantidade: l.quantidade,
        quantidadeAtual: l.quantidadeAtual,
        custoUnitario: l.custoUnitario,
        validade: l.validade,
        validadeConfirmada: l.validadeConfirmada,
        codigoLote: l.codigoLote,
        status: l.status,
        unidadeMedida: l.insumo?.unidadeMedida ?? 'UN',
      })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao buscar notas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = (formData.get('arquivo') ?? formData.get('xml')) as File | null

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const isXml = file.name.toLowerCase().endsWith('.xml')

    // ── 1. Parse ─────────────────────────────────────────────────────────────

    let nfeData
    let itensComValidade: { validade: string | null }[] = []

    try {
      if (isXml) {
        nfeData = parseNFe(buffer.toString('utf-8'))
        itensComValidade = nfeData.itens.map(() => ({ validade: null }))
      } else {
        const mimeType = detectMimeType(buffer, file.name)
        if (!mimeType) {
          return NextResponse.json(
            { error: 'Formato não suportado. Envie XML, PDF ou imagem (JPG, PNG).' },
            { status: 422 }
          )
        }
        const danfeResult = await parseDanfe(buffer, mimeType)
        nfeData = danfeResult
        itensComValidade = danfeResult.itensComValidade.map((i) => ({ validade: i.validade }))
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Erro ao processar arquivo: ${err instanceof Error ? err.message : 'formato não reconhecido'}` },
        { status: 422 }
      )
    }

    // ── 2. Salvar arquivo ────────────────────────────────────────────────────

    const ext = file.name.split('.').pop() ?? 'xml'
    const filename = `nfe_${nfeData.chaveAcesso}.${ext}`
    const uploadPath = path.join(process.cwd(), 'public/uploads/notas', filename)
    await writeFile(uploadPath, buffer)

    // ── 3. Upsert Fornecedor ─────────────────────────────────────────────────

    const fornecedor = await db.fornecedor.upsert({
      where: { cnpj: nfeData.fornecedor.cnpj },
      create: { cnpj: nfeData.fornecedor.cnpj, nome: nfeData.fornecedor.nome },
      update: { nome: nfeData.fornecedor.nome },
    })

    // ── 4. Criar NFeImport ───────────────────────────────────────────────────

    const nfeImport = await db.nFeImport.upsert({
      where: { chaveAcesso: nfeData.chaveAcesso },
      create: {
        chaveAcesso: nfeData.chaveAcesso,
        numero: nfeData.numero,
        serie: nfeData.serie,
        dataEmissao: nfeData.dataEmissao,
        valorTotal: nfeData.valorTotal,
        xmlPath: `/uploads/notas/${filename}`,
        fornecedorId: fornecedor.id,
      },
      update: {},
    })

    // ── 5. Fuzzy match + criar lotes ─────────────────────────────────────────

    const catalogoInsumos = await db.insumo.findMany({ select: { id: true, nome: true } })
    const lotesImportados = []

    for (let idx = 0; idx < nfeData.itens.length; idx++) {
      const item = nfeData.itens[idx]
      const validadeExtraida = itensComValidade[idx]?.validade ?? null
      const matchResult = await fuzzyMatchInsumo(item.nomeProduto, catalogoInsumos)

      let insumoId: number

      if (matchResult.insumoId && matchResult.confianca >= 0.85) {
        insumoId = matchResult.insumoId
      } else {
        const novoInsumo = await db.insumo.create({
          data: { nome: item.nomeProduto, unidadeMedida: item.unidade },
        })
        insumoId = novoInsumo.id
        catalogoInsumos.push({ id: novoInsumo.id, nome: novoInsumo.nome })
      }

      // Se Gemini extraiu validade, já salva como confirmada
      const validadeDate = validadeExtraida ? new Date(validadeExtraida) : null
      const validadeConfirmada = validadeDate !== null && !isNaN(validadeDate.getTime())

      const lote = await db.lote.create({
        data: {
          insumoId,
          nfeImportId: nfeImport.id,
          fornecedorId: fornecedor.id,
          quantidade: item.quantidade,
          quantidadeAtual: item.quantidade,
          custoUnitario: item.valorUnitario,
          status: 'ATIVO',
          validade: validadeDate && !isNaN(validadeDate.getTime()) ? validadeDate : undefined,
          validadeConfirmada,
          aiMatchConfianca: matchResult.confianca,
        },
        include: { insumo: true },
      })

      lotesImportados.push({
        loteId: lote.id,
        insumoId: lote.insumoId,
        nomeInsumo: lote.insumo.nome,
        nomeBruto: item.nomeProduto,
        quantidade: item.quantidade,
        unidade: item.unidade,
        custoUnitario: item.valorUnitario,
        aiMatchConfianca: matchResult.confianca,
        aiSugestao: matchResult.sugestao,
        validadeExtraida: validadeExtraida, // validade extraída pelo Gemini (pode ser null)
        validadeConfirmada,
      })
    }

    const itensComValidadePendente = lotesImportados.filter((l) => !l.validadeConfirmada).length
    const aviso = itensComValidadePendente > 0
      ? `${itensComValidadePendente} produto(s) sem validade detectada — confirme as datas abaixo.`
      : 'Todas as validades foram extraídas automaticamente. Verifique se estão corretas.'

    return NextResponse.json({
      ok: true,
      nfeImportId: nfeImport.id,
      fornecedor: { cnpj: fornecedor.cnpj, nome: fornecedor.nome },
      numero: nfeData.numero,
      serie: nfeData.serie,
      dataEmissao: nfeData.dataEmissao,
      valorTotal: nfeData.valorTotal,
      fonte: isXml ? 'xml' : 'danfe_gemini',
      lotesImportados,
      aviso,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao processar nota fiscal' }, { status: 500 })
  }
}
