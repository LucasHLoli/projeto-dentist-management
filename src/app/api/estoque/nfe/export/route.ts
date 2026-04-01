import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    const notas = await db.nFeImport.findMany({
      include: {
        fornecedor: true,
        lotes: {
          include: {
            insumo: { select: { nome: true, grupoCategoria: true, unidadeMedida: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { dataEmissao: 'desc' },
    })

    // One row per lote (product) per NF-e
    const rows: Record<string, unknown>[] = []

    for (const nota of notas) {
      for (const lote of nota.lotes) {
        rows.push({
          'Número NF-e': nota.numero,
          'Série': nota.serie,
          'Data Emissão': new Date(nota.dataEmissao).toLocaleDateString('pt-BR'),
          'CNPJ Fornecedor': nota.fornecedor.cnpj,
          'Nome Fornecedor': nota.fornecedor.nome,
          'Valor Total NF-e (R$)': nota.valorTotal.toFixed(2),
          'Produto': lote.insumo?.nome ?? '—',
          'Categoria': lote.insumo?.grupoCategoria ?? '—',
          'Unidade': lote.insumo?.unidadeMedida ?? 'UN',
          'Qtd Comprada': lote.quantidade,
          'Qtd Atual em Estoque': lote.quantidadeAtual,
          'Valor Unitário (R$)': lote.custoUnitario != null ? lote.custoUnitario.toFixed(2) : '—',
          'Valor Total Item (R$)': lote.custoUnitario != null
            ? (lote.custoUnitario * lote.quantidade).toFixed(2)
            : '—',
          'Código Lote': lote.codigoLote ?? '—',
          'Validade': lote.validade
            ? new Date(lote.validade).toLocaleDateString('pt-BR')
            : '—',
          'Status': lote.status,
          'Chave de Acesso': nota.chaveAcesso,
        })
      }
    }

    // Handle empty case
    if (rows.length === 0) {
      rows.push({ 'Aviso': 'Nenhuma nota fiscal importada.' })
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Notas Fiscais')

    // Auto column widths
    const colWidths = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length, 14) }))
    ws['!cols'] = colWidths

    const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const today = new Date().toISOString().slice(0, 10)
    return new NextResponse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="estoque_notas_${today}.xlsx"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao gerar Excel' }, { status: 500 })
  }
}
