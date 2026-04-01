import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    const nota = await db.nFeImport.findUnique({
      where: { id: numId },
      select: {
        xmlPath: true,
        numero: true,
        serie: true,
        fornecedor: { select: { nome: true } },
      },
    })

    if (!nota?.xmlPath) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    const filePath = path.join(process.cwd(), 'public', nota.xmlPath)
    const resolved = path.resolve(filePath)
    const allowed = path.resolve(path.join(process.cwd(), 'public', 'uploads', 'notas'))
    if (!resolved.startsWith(allowed + path.sep) && resolved !== allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const buffer = await readFile(filePath)
    const ext = nota.xmlPath.split('.').pop()?.toLowerCase() ?? 'bin'

    const contentType =
      ext === 'xml' ? 'application/xml' :
      ext === 'pdf' ? 'application/pdf' :
      'application/octet-stream'

    const safeName = nota.fornecedor.nome.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
    const nomeArquivo = `NF-${nota.numero}-${nota.serie}_${safeName}.${ext}`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao baixar arquivo' }, { status: 500 })
  }
}
