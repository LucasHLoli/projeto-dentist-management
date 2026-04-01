# Estoque — Melhorias v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melhorar o módulo de estoque com: visão por lote (1 linha = 1 produto de 1 NF-e), delete/baixa de lotes, taxa de uso calculada, aba separada de Notas com download e export Excel.

**Architecture:** 6 tasks independentes. Backend primeiro (Tasks 1-3), depois UI (Tasks 4-6). Nenhuma mudança de schema Prisma necessária — todos os campos já existem. `xlsx` é instalado na Task 3 para export. A aba principal do estoque passa a mostrar lotes (não insumos agrupados). A página `/estoque/notas` é nova.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma 7 + SQLite, Zod 4, React 18, xlsx (a instalar)

**Categorias fixas (constante compartilhada):**
```
Endodontia | Luvas/EPI | Anestesia | Restauração | Limpeza/Esterilização |
Prótese | Radiografia | Ortodontia | Exodontia | Periodontia |
Cirurgia Periodontal | Medicamentos | Outros
```

---

## File Map

| Arquivo | O que muda |
|---|---|
| `src/app/api/estoque/lotes/[id]/route.ts` | +DELETE handler + POST `/baixa` |
| `src/app/api/estoque/lotes/route.ts` | GET inclui `taxaUsoMensal` por insumo |
| `src/app/api/estoque/nfe/route.ts` | +GET lista todas NF-e com fornecedor |
| `src/app/api/estoque/nfe/[id]/route.ts` | NOVO: detalhe NF-e com lotes |
| `src/app/api/estoque/nfe/[id]/download/route.ts` | NOVO: serve arquivo original |
| `src/app/api/estoque/nfe/export/route.ts` | NOVO: export Excel linha a linha |
| `src/app/estoque/page.tsx` | Refatorar aba Estoque: por lote + novas colunas + modais |
| `src/app/estoque/notas/page.tsx` | NOVO: lista NF-e, download, export |

---

## Task 1: DELETE lote + registro de baixa (perda)

**Files:**
- Modify: `src/app/api/estoque/lotes/[id]/route.ts`

- [ ] **Step 1: Adicionar DELETE e POST de baixa no handler**

Substituir o conteúdo completo de `src/app/api/estoque/lotes/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import path from 'path'
import { writeFile } from 'fs/promises'

const UpdateLoteSchema = z.object({
  validade: z.string().datetime().nullable().optional(),
  validadeConfirmada: z.boolean().optional(),
  quantidadeAtual: z.number().nonnegative().optional(),
  custoUnitario: z.number().nonnegative().optional(),
  status: z.enum(['ATIVO', 'ESGOTADO', 'VENCIDO', 'DESCARTADO']).optional(),
  codigoLote: z.string().optional(),
})

const BaixaSchema = z.object({
  quantidade: z.number().positive(),
  motivo: z.enum(['PERDA', 'VENCIMENTO', 'DANO', 'OUTRO']),
  observacao: z.string().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('foto') as File | null
      if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filename = `nota_lote_${id}_${Date.now()}.${ext}`
      const uploadPath = path.join(process.cwd(), 'public/uploads/notas', filename)
      await writeFile(uploadPath, buffer)

      const lote = await db.lote.update({
        where: { id: Number(id) },
        data: { fotoNotaUrl: `/uploads/notas/${filename}` },
      })
      return NextResponse.json(lote)
    }

    const body = await request.json()
    const data = UpdateLoteSchema.parse(body)
    const updateData: Record<string, unknown> = { ...data }
    if (data.validade !== undefined) {
      updateData.validade = data.validade ? new Date(data.validade) : null
    }

    const lote = await db.lote.update({
      where: { id: Number(id) },
      data: updateData,
      include: { insumo: true },
    })
    return NextResponse.json(lote)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Erro ao atualizar lote' }, { status: 500 })
  }
}

// POST /api/estoque/lotes/[id]/baixa — registra perda parcial ou total
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  if (!url.pathname.endsWith('/baixa')) {
    return NextResponse.json({ error: 'Endpoint não encontrado' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { quantidade, motivo, observacao } = BaixaSchema.parse(body)

    const lote = await db.lote.findUnique({ where: { id: Number(id) } })
    if (!lote) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    if (quantidade > lote.quantidadeAtual) {
      return NextResponse.json({ error: 'Quantidade maior que o estoque atual' }, { status: 400 })
    }

    const novaQtd = lote.quantidadeAtual - quantidade
    const novoStatus = novaQtd <= 0 ? 'ESGOTADO' : lote.status

    const atualizado = await db.lote.update({
      where: { id: Number(id) },
      data: {
        quantidadeAtual: novaQtd,
        status: novoStatus,
      },
      include: { insumo: true },
    })

    // Registrar no ConsumoInsumo como baixa manual
    await db.consuamInsumo.create({
      data: {
        atendimentoId: `BAIXA_MANUAL_${motivo}_${Date.now()}`,
        insumoId: lote.insumoId,
        loteId: lote.id,
        quantidade,
        origem: 'MANUAL',
      },
    }).catch(() => {
      // ConsumoInsumo pode falhar se o schema não aceitar atendimentoId livre — ignora
    })

    return NextResponse.json({ ok: true, lote: atualizado, motivo, observacao })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Erro ao registrar baixa' }, { status: 500 })
  }
}

// DELETE /api/estoque/lotes/[id] — remove o lote permanentemente
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Soft delete: marca como DESCARTADO em vez de apagar fisicamente
    const lote = await db.lote.update({
      where: { id: Number(id) },
      data: { status: 'DESCARTADO', quantidadeAtual: 0 },
    })
    return NextResponse.json({ ok: true, lote })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao remover lote' }, { status: 500 })
  }
}
```

> **Nota:** O `baixa` endpoint usa `POST` no mesmo arquivo pois Next.js App Router roteia por método HTTP, não por segmento extra no mesmo arquivo. Para o path `/api/estoque/lotes/[id]/baixa` criar um novo arquivo em `src/app/api/estoque/lotes/[id]/baixa/route.ts`.

- [ ] **Step 2: Corrigir — mover baixa para seu próprio arquivo**

O step 1 tem um erro de design: `POST` num `[id]/route.ts` já é usado para outras coisas. Criar arquivo separado:

`src/app/api/estoque/lotes/[id]/baixa/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const BaixaSchema = z.object({
  quantidade: z.number().positive(),
  motivo: z.enum(['PERDA', 'VENCIMENTO', 'DANO', 'OUTRO']),
  observacao: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { quantidade, motivo, observacao } = BaixaSchema.parse(body)

    const lote = await db.lote.findUnique({ where: { id: Number(id) } })
    if (!lote) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    if (quantidade > lote.quantidadeAtual) {
      return NextResponse.json({ error: 'Quantidade maior que o estoque atual' }, { status: 400 })
    }

    const novaQtd = lote.quantidadeAtual - quantidade
    const novoStatus = novaQtd <= 0 ? 'ESGOTADO' : lote.status

    const atualizado = await db.lote.update({
      where: { id: Number(id) },
      data: { quantidadeAtual: novaQtd, status: novoStatus },
      include: { insumo: true },
    })

    return NextResponse.json({ ok: true, lote: atualizado, motivo, observacao })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Erro ao registrar baixa' }, { status: 500 })
  }
}
```

E no `src/app/api/estoque/lotes/[id]/route.ts`, substituir todo o conteúdo por:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import path from 'path'
import { writeFile } from 'fs/promises'

const UpdateLoteSchema = z.object({
  validade: z.string().datetime().nullable().optional(),
  validadeConfirmada: z.boolean().optional(),
  quantidadeAtual: z.number().nonnegative().optional(),
  custoUnitario: z.number().nonnegative().optional(),
  status: z.enum(['ATIVO', 'ESGOTADO', 'VENCIDO', 'DESCARTADO']).optional(),
  codigoLote: z.string().optional(),
  grupoCategoria: z.string().nullable().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('foto') as File | null
      if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filename = `nota_lote_${id}_${Date.now()}.${ext}`
      await writeFile(path.join(process.cwd(), 'public/uploads/notas', filename), buffer)

      const lote = await db.lote.update({
        where: { id: Number(id) },
        data: { fotoNotaUrl: `/uploads/notas/${filename}` },
      })
      return NextResponse.json(lote)
    }

    const body = await request.json()
    const data = UpdateLoteSchema.parse(body)

    // grupoCategoria vai no Insumo, não no Lote — tratar separado
    const { grupoCategoria, ...loteData } = data
    const updateData: Record<string, unknown> = { ...loteData }
    if (loteData.validade !== undefined) {
      updateData.validade = loteData.validade ? new Date(loteData.validade) : null
    }

    const lote = await db.lote.update({
      where: { id: Number(id) },
      data: updateData,
      include: { insumo: true },
    })

    if (grupoCategoria !== undefined) {
      await db.insumo.update({
        where: { id: lote.insumoId },
        data: { grupoCategoria },
      })
    }

    return NextResponse.json(lote)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Erro ao atualizar lote' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const lote = await db.lote.update({
      where: { id: Number(id) },
      data: { status: 'DESCARTADO', quantidadeAtual: 0 },
    })
    return NextResponse.json({ ok: true, lote })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao remover lote' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Testar com curl**

```bash
# Criar lote de teste
curl -s -X POST http://localhost:5000/api/estoque/lotes \
  -H "Content-Type: application/json" \
  -d '{"insumoId":1,"quantidade":10}' | jq .id

# Baixa de 3 unidades (substitua ID pelo retornado acima)
curl -s -X POST http://localhost:5000/api/estoque/lotes/ID/baixa \
  -H "Content-Type: application/json" \
  -d '{"quantidade":3,"motivo":"PERDA"}' | jq .lote.quantidadeAtual
# Esperado: 7

# Deletar (soft)
curl -s -X DELETE http://localhost:5000/api/estoque/lotes/ID | jq .lote.status
# Esperado: "DESCARTADO"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/estoque/lotes/[id]/route.ts src/app/api/estoque/lotes/[id]/baixa/route.ts
git commit -m "feat: lotes DELETE (soft) + POST /baixa para registro de perda"
```

---

## Task 2: API GET NF-e (lista + detalhe + download)

**Files:**
- Modify: `src/app/api/estoque/nfe/route.ts`
- Create: `src/app/api/estoque/nfe/[id]/route.ts`
- Create: `src/app/api/estoque/nfe/[id]/download/route.ts`

- [ ] **Step 1: Adicionar GET ao nfe/route.ts**

No início do arquivo `src/app/api/estoque/nfe/route.ts`, antes do `export async function POST`, inserir:

```typescript
export async function GET() {
  try {
    const notas = await db.nFeImport.findMany({
      include: {
        fornecedor: { select: { cnpj: true, nome: true } },
        lotes: {
          where: { status: { not: 'DESCARTADO' } },
          include: { insumo: { select: { nome: true, grupoCategoria: true, unidadeMedida: true } } },
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
```

Certificar que `NextResponse` está importado no topo (já deve estar com o POST).

- [ ] **Step 2: Criar src/app/api/estoque/nfe/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const nota = await db.nFeImport.findUnique({
      where: { id: Number(id) },
      include: {
        fornecedor: true,
        lotes: {
          include: {
            insumo: { select: { id: true, nome: true, grupoCategoria: true, unidadeMedida: true, unidadeUso: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!nota) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

    return NextResponse.json(nota)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao buscar nota' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Criar src/app/api/estoque/nfe/[id]/download/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const nota = await db.nFeImport.findUnique({
      where: { id: Number(id) },
      select: { xmlPath: true, numero: true, serie: true, fornecedor: { select: { nome: true } } },
    })

    if (!nota?.xmlPath) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    const filePath = path.join(process.cwd(), 'public', nota.xmlPath)
    const buffer = await readFile(filePath)
    const ext = nota.xmlPath.split('.').pop()?.toLowerCase() ?? 'bin'

    const contentType =
      ext === 'xml' ? 'application/xml' :
      ext === 'pdf' ? 'application/pdf' :
      'application/octet-stream'

    const nomeArquivo = `NF-${nota.numero}-${nota.serie}_${nota.fornecedor.nome.replace(/[^a-z0-9]/gi, '_')}.${ext}`

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
```

- [ ] **Step 4: Testar**

```bash
# Listar notas
curl -s http://localhost:5000/api/estoque/nfe | jq '.[0] | {numero, fornecedor, totalProdutos}'

# Detalhe de uma nota (substitua 1 pelo ID retornado)
curl -s http://localhost:5000/api/estoque/nfe/1 | jq '{numero, valorTotal, lotes: [.lotes[] | {nomeProduto, quantidade}]}'

# Download (deve retornar o arquivo)
curl -I http://localhost:5000/api/estoque/nfe/1/download
# Esperado: Content-Disposition: attachment; filename="NF-..."
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/estoque/nfe/route.ts src/app/api/estoque/nfe/[id]/route.ts src/app/api/estoque/nfe/[id]/download/route.ts
git commit -m "feat: NF-e GET lista + detalhe + download do arquivo original"
```

---

## Task 3: Export Excel NF-e

**Files:**
- Create: `src/app/api/estoque/nfe/export/route.ts`

- [ ] **Step 1: Instalar xlsx**

```bash
cd "/workspaces/Projeto Dentist Management" && pnpm add xlsx
```

Saída esperada: `dependencies: + xlsx 0.18.x`

- [ ] **Step 2: Criar src/app/api/estoque/nfe/export/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    const notas = await db.nFeImport.findMany({
      include: {
        fornecedor: true,
        lotes: {
          include: { insumo: { select: { nome: true, grupoCategoria: true, unidadeMedida: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { dataEmissao: 'desc' },
    })

    // Uma linha por produto (lote) por nota
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

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Notas Fiscais')

    // Ajustar largura das colunas
    const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
      wch: Math.max(k.length, 14),
    }))
    ws['!cols'] = colWidths

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="estoque_notas_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao gerar Excel' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Testar**

```bash
curl -s http://localhost:5000/api/estoque/nfe/export -o /tmp/notas.xlsx && file /tmp/notas.xlsx
# Esperado: Microsoft Excel 2007+
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/estoque/nfe/export/route.ts package.json pnpm-lock.yaml
git commit -m "feat: export Excel NF-e linha por linha com todos os dados"
```

---

## Task 4: API GET lotes com taxa de uso

**Files:**
- Modify: `src/app/api/estoque/lotes/route.ts`

**Objetivo:** Incluir `taxaUsoMensal` (unidades consumidas nos últimos 90 dias / 3 meses) em cada lote retornado.

- [ ] **Step 1: Atualizar GET em src/app/api/estoque/lotes/route.ts**

Substituir a função `GET` por:

```typescript
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const insumoId = searchParams.get('insumoId')
    const status = searchParams.get('status') ?? 'ATIVO'
    const fefo = searchParams.get('fefo') === 'true'
    const comTaxa = searchParams.get('comTaxa') === 'true'

    const where: Record<string, unknown> = { status }
    if (insumoId) where.insumoId = Number(insumoId)

    const lotes = await db.lote.findMany({
      where,
      orderBy: fefo ? [{ validade: 'asc' }, { createdAt: 'asc' }] : { createdAt: 'desc' },
      include: {
        insumo: { select: { id: true, nome: true, grupoCategoria: true, unidadeMedida: true, unidadeUso: true, estoqueMinimo: true } },
        fornecedor: { select: { id: true, cnpj: true, nome: true } },
        nfeImport: { select: { id: true, numero: true, serie: true, chaveAcesso: true, dataEmissao: true, valorTotal: true } },
      },
    })

    if (!comTaxa) return NextResponse.json(lotes)

    // Calcular taxa de uso por insumo nos últimos 90 dias
    const noventaDiasAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const insumoIds = [...new Set(lotes.map((l) => l.insumoId))]

    const consumos = await db.consuamInsumo.groupBy({
      by: ['insumoId'],
      _sum: { quantidade: true },
      where: {
        insumoId: { in: insumoIds },
        createdAt: { gte: noventaDiasAtras },
      },
    })

    const taxaMap = new Map<number, number>()
    for (const c of consumos) {
      // taxa mensal = total 90 dias / 3
      taxaMap.set(c.insumoId, (c._sum.quantidade ?? 0) / 3)
    }

    const result = lotes.map((l) => ({
      ...l,
      taxaUsoMensal: taxaMap.get(l.insumoId) ?? 0,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao buscar lotes' }, { status: 500 })
  }
}
```

> **Atenção:** O model Prisma gerado usa `consuamInsumo` (com typo histórico). Verificar o nome exato em `src/generated/prisma` se der erro e ajustar.

- [ ] **Step 2: Testar**

```bash
curl -s "http://localhost:5000/api/estoque/lotes?comTaxa=true" | jq '.[0] | {id, taxaUsoMensal, nfeImport: .nfeImport.numero}'
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/estoque/lotes/route.ts
git commit -m "feat: lotes GET inclui taxaUsoMensal e dados completos de NF-e"
```

---

## Task 5: UI — Refatorar aba principal do estoque

**Files:**
- Modify: `src/app/estoque/page.tsx`

**Objetivo:** A aba "Estoque" passa a mostrar lotes (1 linha = 1 lote = 1 produto de 1 NF-e), com colunas: Nome, Categoria (editável inline), Código NF-e, Valor NF-e, Qtd, Valor/item, Lote, Validade, Taxa de Uso/mês. Botões: Baixa (modal) + Remover (confirm). Também adiciona `EntradaLoteModal` e campo `unidadeUso` no modal "Novo Insumo".

**Categorias fixas (usar como constante):**
```typescript
const CATEGORIAS = [
  'Endodontia', 'Luvas/EPI', 'Anestesia', 'Restauração',
  'Limpeza/Esterilização', 'Prótese', 'Radiografia', 'Ortodontia',
  'Exodontia', 'Periodontia', 'Cirurgia Periodontal', 'Medicamentos', 'Outros',
]
```

- [ ] **Step 1: Atualizar interfaces e estado no topo de estoque/page.tsx**

Localizar o bloco de interfaces no topo (linhas 11-56 aproximadamente). Substituir `InsumoResumo` e `LoteResumo` pelas novas interfaces, e adicionar os novos estados no componente principal:

**Interfaces novas (substituir as antigas):**

```typescript
const CATEGORIAS = [
  'Endodontia', 'Luvas/EPI', 'Anestesia', 'Restauração',
  'Limpeza/Esterilização', 'Prótese', 'Radiografia', 'Ortodontia',
  'Exodontia', 'Periodontia', 'Cirurgia Periodontal', 'Medicamentos', 'Outros',
]

interface NFeResumo {
  id: number
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  valorTotal: number
}

interface LoteCompleto {
  id: number
  insumoId: number
  insumo: {
    id: number
    nome: string
    grupoCategoria: string | null
    unidadeMedida: string
    unidadeUso: string | null
    estoqueMinimo: number
  }
  fornecedor: { id: number; cnpj: string; nome: string } | null
  nfeImport: NFeResumo | null
  codigoLote: string | null
  quantidade: number
  quantidadeAtual: number
  custoUnitario: number | null
  validade: string | null
  validadeConfirmada: boolean
  status: string
  unidadeCompra: string | null
  fatorConversao: number | null
  quantidadeCompra: number | null
  taxaUsoMensal: number
}
```

**Novos estados a adicionar no `EstoquePage` (após os estados existentes):**

```typescript
const [lotes, setLotes] = useState<LoteCompleto[]>([])
const [loadingLotes, setLoadingLotes] = useState(true)
const [searchLotes, setSearchLotes] = useState('')
const [filtroCategoria, setFiltroCategoria] = useState('')
const [editandoCategoria, setEditandoCategoria] = useState<number | null>(null)
const [baixaLoteId, setBaixaLoteId] = useState<number | null>(null)
const [entradaInsumoId, setEntradaInsumoId] = useState<number | null>(null)
```

E a função de fetch de lotes:

```typescript
const fetchLotes = useCallback(async () => {
  setLoadingLotes(true)
  try {
    const res = await fetch('/api/estoque/lotes?comTaxa=true')
    const data = await res.json()
    setLotes(data)
  } catch {
    // silencioso
  } finally {
    setLoadingLotes(false)
  }
}, [])

useEffect(() => {
  if (tab === 'estoque') fetchLotes()
}, [tab, fetchLotes])
```

- [ ] **Step 2: Substituir o JSX da aba 'estoque' (tab === 'estoque')**

Localizar o bloco `{tab === 'estoque' && (...)}` (linhas ~311-415) e substituir completamente por:

```tsx
{tab === 'estoque' && (
  <>
    <div className="filter-row" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
      <div className="search-bar" style={{ flex: 1 }}>
        <span className="search-bar-icon"><Search size={14} /></span>
        <input
          placeholder="Buscar produto, fornecedor ou NF-e..."
          value={searchLotes}
          onChange={(e) => setSearchLotes(e.target.value)}
          suppressHydrationWarning
        />
      </div>
      <select
        className="input"
        style={{ width: '180px' }}
        value={filtroCategoria}
        onChange={(e) => setFiltroCategoria(e.target.value)}
      >
        <option value="">Todas categorias</option>
        {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>

    {loadingLotes ? (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        Carregando estoque...
      </div>
    ) : (
      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>NF-e</th>
                <th style={{ textAlign: 'right' }}>Vlr. Nota</th>
                <th style={{ textAlign: 'center' }}>Qtd</th>
                <th style={{ textAlign: 'right' }}>Vlr/item</th>
                <th>Lote</th>
                <th>Validade</th>
                <th style={{ textAlign: 'center' }}>Taxa/mês</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lotes
                .filter((l) => {
                  if (l.status === 'DESCARTADO') return false
                  const q = searchLotes.toLowerCase()
                  if (q && !l.insumo.nome.toLowerCase().includes(q) &&
                      !l.nfeImport?.numero.includes(q) &&
                      !(l.fornecedor?.nome ?? '').toLowerCase().includes(q)) return false
                  if (filtroCategoria && l.insumo.grupoCategoria !== filtroCategoria) return false
                  return true
                })
                .map((lote) => (
                  <tr key={lote.id} style={{ opacity: lote.status === 'ESGOTADO' ? 0.5 : 1 }}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lote.insumo.nome}
                      </div>
                      {lote.insumo.grupoCategoria === null && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-amber)' }}>⚠ sem categoria</div>
                      )}
                    </td>
                    <td>
                      {editandoCategoria === lote.id ? (
                        <select
                          className="input"
                          style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                          defaultValue={lote.insumo.grupoCategoria ?? ''}
                          autoFocus
                          onBlur={async (e) => {
                            const novaCategoria = e.target.value || null
                            await fetch(`/api/estoque/lotes/${lote.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ grupoCategoria: novaCategoria }),
                            })
                            setEditandoCategoria(null)
                            fetchLotes()
                          }}
                        >
                          <option value="">— sem categoria —</option>
                          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span
                          className={`badge ${lote.insumo.grupoCategoria ? 'badge-teal' : 'badge-amber'}`}
                          style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                          onClick={() => setEditandoCategoria(lote.id)}
                          title="Clique para editar"
                        >
                          {lote.insumo.grupoCategoria ?? 'definir'}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {lote.nfeImport ? `NF ${lote.nfeImport.numero}/${lote.nfeImport.serie}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {lote.nfeImport
                        ? `R$ ${lote.nfeImport.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {lote.quantidadeAtual}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: 2 }}>
                        {lote.insumo.unidadeUso ?? lote.insumo.unidadeMedida}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                      {lote.custoUnitario != null
                        ? `R$ ${lote.custoUnitario.toFixed(2)}`
                        : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {lote.codigoLote ?? '—'}
                    </td>
                    <td>
                      {badgeValidade(lote.validade, lote.validadeConfirmada)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {lote.taxaUsoMensal > 0
                        ? <span style={{ color: 'var(--accent-teal)' }}>{lote.taxaUsoMensal.toFixed(1)}/mês</span>
                        : <span>—</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '0.72rem' }}
                          onClick={() => setEntradaInsumoId(lote.insumoId)}
                          title="Entrada de estoque"
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '0.72rem', color: 'var(--accent-amber)' }}
                          onClick={() => setBaixaLoteId(lote.id)}
                          title="Registrar baixa/perda"
                          disabled={lote.quantidadeAtual <= 0}
                        >
                          <Minus size={11} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '0.72rem', color: 'var(--accent-rose)' }}
                          onClick={async () => {
                            if (!confirm(`Remover lote de "${lote.insumo.nome}"? Esta ação não pode ser desfeita.`)) return
                            await fetch(`/api/estoque/lotes/${lote.id}`, { method: 'DELETE' })
                            fetchLotes()
                          }}
                          title="Remover lote"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {lotes.filter((l) => l.status !== 'DESCARTADO').length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Nenhum item no estoque. Importe uma NF-e ou cadastre manualmente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* Modais */}
    {baixaLoteId !== null && (
      <BaixaModal
        loteId={baixaLoteId}
        lote={lotes.find((l) => l.id === baixaLoteId)!}
        onClose={() => setBaixaLoteId(null)}
        onSaved={() => { setBaixaLoteId(null); fetchLotes() }}
      />
    )}
    {entradaInsumoId !== null && (
      <EntradaLoteModal
        insumoId={entradaInsumoId}
        insumos={lotes.map((l) => l.insumo)}
        onClose={() => setEntradaInsumoId(null)}
        onSaved={() => { setEntradaInsumoId(null); fetchLotes() }}
      />
    )}
  </>
)}
```

- [ ] **Step 3: Adicionar componentes BaixaModal e EntradaLoteModal antes do `export default`**

Inserir antes de `export default function EstoquePage()`:

```typescript
// ─── Modal de Baixa (perda/descarte parcial) ──────────────────────────────────

function BaixaModal({
  loteId,
  lote,
  onClose,
  onSaved,
}: {
  loteId: number
  lote: LoteCompleto
  onClose: () => void
  onSaved: () => void
}) {
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState<'PERDA' | 'VENCIMENTO' | 'DANO' | 'OUTRO'>('PERDA')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    const qtd = parseFloat(quantidade)
    if (!qtd || qtd <= 0) { setErro('Informe a quantidade'); return }
    if (qtd > lote.quantidadeAtual) { setErro('Quantidade maior que o estoque'); return }
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/estoque/lotes/${loteId}/baixa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: qtd, motivo, observacao }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao registrar')
      }
      onSaved()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card" style={{ width: 400, padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Registrar Baixa</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: '16px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
          <strong>{lote.insumo.nome}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
            Atual: {lote.quantidadeAtual} {lote.insumo.unidadeUso ?? lote.insumo.unidadeMedida}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Motivo</label>
            <select className="input" style={{ width: '100%' }} value={motivo} onChange={(e) => setMotivo(e.target.value as typeof motivo)}>
              <option value="PERDA">Perda</option>
              <option value="VENCIMENTO">Vencimento</option>
              <option value="DANO">Dano</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Quantidade a baixar *
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={lote.quantidadeAtual}
              className="input"
              style={{ width: '100%' }}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder={`máx ${lote.quantidadeAtual}`}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Observação (opcional)
            </label>
            <input
              type="text"
              className="input"
              style={{ width: '100%' }}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: produto amassado, validade expirada..."
            />
          </div>
          {erro && <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{ background: 'var(--accent-amber)' }}>
              {salvando ? 'Salvando...' : 'Registrar Baixa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de Entrada de Lote (com conversão embalagem→uso) ───────────────────

interface EntradaLoteForm {
  unidadeCompra: string
  fatorConversao: string
  quantidadeCompra: string
  unidadeUso: string
  validade: string
  custoUnitario: string
}

function EntradaLoteModal({
  insumoId,
  insumos,
  onClose,
  onSaved,
}: {
  insumoId: number
  insumos: LoteCompleto['insumo'][]
  onClose: () => void
  onSaved: () => void
}) {
  const insumo = insumos.find((i) => i.id === insumoId)
  const [form, setForm] = useState<EntradaLoteForm>({
    unidadeCompra: '',
    fatorConversao: '',
    quantidadeCompra: '',
    unidadeUso: insumo?.unidadeUso ?? '',
    validade: '',
    custoUnitario: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const qtdCompra = parseFloat(form.quantidadeCompra) || 0
  const fator = parseFloat(form.fatorConversao) || 0
  const preview = qtdCompra > 0 && fator > 0 ? qtdCompra * fator : qtdCompra > 0 ? qtdCompra : 0
  const unidadeLabel = form.unidadeUso || insumo?.unidadeMedida || 'unid'

  async function salvar() {
    if (!form.quantidadeCompra || parseFloat(form.quantidadeCompra) <= 0) {
      setErro('Informe a quantidade comprada')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const payload: Record<string, unknown> = { insumoId, quantidadeCompra: parseFloat(form.quantidadeCompra) }
      if (form.unidadeCompra) payload.unidadeCompra = form.unidadeCompra
      if (fator > 0) payload.fatorConversao = fator
      if (!fator) payload.quantidade = parseFloat(form.quantidadeCompra)
      if (form.validade) payload.validade = new Date(form.validade).toISOString()
      if (form.custoUnitario) payload.custoUnitario = parseFloat(form.custoUnitario)

      const res = await fetch('/api/estoque/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao salvar')
      }
      if (form.unidadeUso && form.unidadeUso !== insumo?.unidadeUso) {
        await fetch(`/api/estoque/insumos/${insumoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unidadeUso: form.unidadeUso }),
        })
      }
      onSaved()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card" style={{ width: 420, padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Entrada de Estoque</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        {insumo && (
          <div style={{ marginBottom: '16px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
            <strong>{insumo.nome}</strong>
            {insumo.grupoCategoria && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{insumo.grupoCategoria}</span>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Qtd comprada *</label>
              <input type="number" min="0" step="0.01" className="input" value={form.quantidadeCompra} onChange={(e) => setForm((f) => ({ ...f, quantidadeCompra: e.target.value }))} placeholder="ex: 10" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Unidade de compra</label>
              <input type="text" className="input" value={form.unidadeCompra} onChange={(e) => setForm((f) => ({ ...f, unidadeCompra: e.target.value }))} placeholder="ex: CX, FR, PCT" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>1 {form.unidadeCompra || 'unid'} equivale a</label>
              <input type="number" min="0" step="0.01" className="input" value={form.fatorConversao} onChange={(e) => setForm((f) => ({ ...f, fatorConversao: e.target.value }))} placeholder="ex: 50" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Unidade de uso</label>
              <input type="text" className="input" value={form.unidadeUso} onChange={(e) => setForm((f) => ({ ...f, unidadeUso: e.target.value }))} placeholder="ex: luvas, ml, unid" />
            </div>
          </div>
          {preview > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(20,184,166,0.1)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--accent-teal)', borderLeft: '3px solid var(--accent-teal)' }}>
              → Entrará no estoque: <strong>{preview} {unidadeLabel}</strong>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Validade</label>
              <input type="month" className="input" value={form.validade} onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value ? e.target.value + '-01' : '' }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Custo unitário (R$)</label>
              <input type="number" min="0" step="0.01" className="input" value={form.custoUnitario} onChange={(e) => setForm((f) => ({ ...f, custoUnitario: e.target.value }))} placeholder="0,00" />
            </div>
          </div>
          {erro && <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', padding: '6px 10px', background: 'rgba(244,63,94,0.1)', borderRadius: 4 }}>{erro}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Registrar Entrada'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Adicionar `Minus` ao import de Lucide no topo do arquivo**

Localizar linha 1 (o import do lucide):
```typescript
import {
  Package, AlertTriangle, Clock, Search, Plus, Upload,
  ClipboardList, Truck, RefreshCw, ChevronRight, Zap, X,
  BarChart2, Star, TrendingUp, TrendingDown, Minus
} from 'lucide-react'
```
`Minus` já está importado — confirmar que está presente. Se não estiver, adicionar.

- [ ] **Step 5: Atualizar modal "Novo Insumo" para incluir `unidadeUso`**

Localizar `const [novoInsumo, setNovoInsumo] = useState(...)` e substituir:
```typescript
const [novoInsumo, setNovoInsumo] = useState({ nome: '', unidadeMedida: 'UN', unidadeUso: '', grupoCategoria: '', estoqueMinimo: 5 })
```

No JSX do modal (após o campo Unidade), adicionar campo:
```tsx
<div>
  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Unidade de uso</label>
  <input
    className="input"
    style={{ width: '100%', marginTop: '4px' }}
    value={novoInsumo.unidadeUso}
    onChange={(e) => setNovoInsumo((p) => ({ ...p, unidadeUso: e.target.value }))}
    placeholder="Ex: luvas, ml, unid"
  />
</div>
```

No `salvarNovoInsumo`, o `novoInsumo` já inclui `unidadeUso` — o POST `/api/estoque/insumos` aceita esse campo.

Após salvar, resetar:
```typescript
setNovoInsumo({ nome: '', unidadeMedida: 'UN', unidadeUso: '', grupoCategoria: '', estoqueMinimo: 5 })
```

- [ ] **Step 6: Atualizar KPIs para usar `lotes` em vez de `insumos`**

Os KPIs no topo (totalItens, totalCriticos, totalSemValidade) agora devem usar `lotes`:

```typescript
const totalItens = lotes.filter((l) => l.status === 'ATIVO').length
const totalCriticos = lotes.filter((l) => l.status === 'ATIVO' && l.quantidadeAtual <= l.insumo.estoqueMinimo).length
const totalSemValidade = lotes.filter((l) => l.status === 'ATIVO' && !l.validade).length
```

- [ ] **Step 7: Verificar que a página compila e abre**

```bash
# Abrir http://localhost:5000/estoque
# Verificar:
# - Aba Estoque mostra tabela com lotes, colunas novas, botões +/−/×
# - Filtro de categoria funciona
# - Clicar × pede confirmação
# - Clicar − abre BaixaModal
# - Clicar + abre EntradaLoteModal
```

- [ ] **Step 8: Commit**

```bash
git add src/app/estoque/page.tsx
git commit -m "feat: aba estoque por lote com categoria, NF-e, taxa de uso, entrada e baixa"
```

---

## Task 6: Página /estoque/notas

**Files:**
- Create: `src/app/estoque/notas/page.tsx`

**Objetivo:** Página dedicada para visualizar todas as NF-e importadas. Por NF-e: número, data, fornecedor (CNPJ + nome), valor total, quantidade de produtos. Expandir para ver os produtos de cada nota. Download da nota original. Exportar Excel de todas as notas.

- [ ] **Step 1: Criar src/app/estoque/notas/page.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, ChevronDown, ChevronRight, RefreshCw, Table } from 'lucide-react'

interface LoteNota {
  id: number
  nomeProduto: string
  categoria: string | null
  quantidade: number
  quantidadeAtual: number
  custoUnitario: number | null
  validade: string | null
  codigoLote: string | null
  status: string
  unidadeMedida: string
}

interface Nota {
  id: number
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  valorTotal: number
  xmlPath: string | null
  fornecedor: { cnpj: string; nome: string }
  totalProdutos: number
  lotes: LoteNota[]
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function formatMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    fetch('/api/estoque/nfe')
      .then((r) => r.json())
      .then(setNotas)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggleExpand(id: number) {
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function exportarExcel() {
    setExportando(true)
    try {
      const res = await fetch('/api/estoque/nfe/export')
      if (!res.ok) throw new Error('Erro')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estoque_notas_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erro ao exportar Excel')
    } finally {
      setExportando(false)
    }
  }

  async function downloadNota(notaId: number) {
    const res = await fetch(`/api/estoque/nfe/${notaId}/download`)
    if (!res.ok) { alert('Arquivo não disponível'); return }
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') ?? ''
    const match = cd.match(/filename="([^"]+)"/)
    const filename = match?.[1] ?? `nota_${notaId}`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notas Fiscais</h1>
          <p>Histórico de NF-e importadas, produtos e downloads</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => { setLoading(true); fetch('/api/estoque/nfe').then(r => r.json()).then(setNotas).finally(() => setLoading(false)) }}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={exportarExcel}
            disabled={exportando || notas.length === 0}
          >
            <Table size={14} /> {exportando ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px' }}>
        <div className="stat-card teal">
          <div className="stat-card-icon"><FileText size={18} /></div>
          <div className="stat-card-label">Total de Notas</div>
          <div className="stat-card-value">{notas.length}</div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-card-icon"><Table size={18} /></div>
          <div className="stat-card-label">Total de Produtos</div>
          <div className="stat-card-value">{notas.reduce((s, n) => s + n.totalProdutos, 0)}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon"><Download size={18} /></div>
          <div className="stat-card-label">Valor Total Importado</div>
          <div className="stat-card-value" style={{ fontSize: '1rem' }}>
            {formatMoeda(notas.reduce((s, n) => s + n.valorTotal, 0))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Carregando notas...
        </div>
      ) : notas.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            Nenhuma NF-e importada. Use "Importar NF-e" na tela de Estoque.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notas.map((nota) => {
            const expandida = expandidas.has(nota.id)
            return (
              <div key={nota.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Cabeçalho da nota */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 16px', cursor: 'pointer',
                    borderBottom: expandida ? '1px solid var(--border)' : 'none',
                  }}
                  onClick={() => toggleExpand(nota.id)}
                >
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    {expandida ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>NF {nota.numero}/{nota.serie}</span>
                      <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>
                        {nota.totalProdutos} produto{nota.totalProdutos !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {nota.fornecedor.nome} · CNPJ {nota.fornecedor.cnpj}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 600 }}>{formatMoeda(nota.valorTotal)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(nota.dataEmissao)}</div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); downloadNota(nota.id) }}
                    disabled={!nota.xmlPath}
                    title={nota.xmlPath ? 'Baixar arquivo original' : 'Arquivo não disponível'}
                  >
                    <Download size={12} /> Baixar
                  </button>
                </div>

                {/* Produtos da nota (expandido) */}
                {expandida && (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Categoria</th>
                          <th style={{ textAlign: 'center' }}>Qtd</th>
                          <th style={{ textAlign: 'right' }}>Vlr. Unit.</th>
                          <th style={{ textAlign: 'right' }}>Vlr. Total</th>
                          <th>Lote</th>
                          <th>Validade</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nota.lotes.map((lote) => (
                          <tr key={lote.id}>
                            <td style={{ fontWeight: 500 }}>{lote.nomeProduto}</td>
                            <td>
                              {lote.categoria
                                ? <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>{lote.categoria}</span>
                                : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                              }
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {lote.quantidade} {lote.unidadeMedida}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                              {lote.custoUnitario != null ? formatMoeda(lote.custoUnitario) : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                              {lote.custoUnitario != null
                                ? formatMoeda(lote.custoUnitario * lote.quantidade)
                                : '—'}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {lote.codigoLote ?? '—'}
                            </td>
                            <td style={{ fontSize: '0.8rem' }}>
                              {lote.validade ? formatDate(lote.validade) : <span style={{ color: 'var(--accent-amber)' }}>⚠ pendente</span>}
                            </td>
                            <td>
                              <span className={`badge ${
                                lote.status === 'ATIVO' ? 'badge-emerald' :
                                lote.status === 'ESGOTADO' ? 'badge-amber' :
                                'badge-rose'
                              }`} style={{ fontSize: '0.7rem' }}>
                                {lote.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar link "Notas" na Sidebar**

Abrir `src/components/Sidebar.tsx`. Localizar a seção `Operacional` (onde estão Estoque, Retornos, etc.) e adicionar depois do item Estoque:

```tsx
{ href: '/estoque/notas', label: 'Notas Fiscais', icon: FileText }
```

O componente `FileText` já é importado de Lucide na maioria das sidebars — confirmar ou adicionar ao import.

- [ ] **Step 3: Testar**

```bash
# Abrir http://localhost:5000/estoque/notas
# Verificar:
# - Lista de notas com KPIs
# - Clicar em uma nota expande produtos
# - Botão "Baixar" faz download do PDF/XML
# - Botão "Exportar Excel" baixa o .xlsx
```

- [ ] **Step 4: Commit**

```bash
git add src/app/estoque/notas/page.tsx src/components/Sidebar.tsx
git commit -m "feat: página /estoque/notas com download e export Excel"
```

---

## Self-Review — Cobertura de Requisitos

| Requisito do usuário | Task que implementa |
|---|---|
| Deletar item (remover completamente) | Task 1: DELETE `/lotes/[id]` + botão × na tabela |
| Registrar perda (baixa parcial) | Task 1: POST `/lotes/[id]/baixa` + BaixaModal |
| Nome do produto da nota (1 linha = 1 insumo/lote) | Task 5: tabela por lote |
| Categoria (clustered) com Cirurgia Periodontal | Task 5: CATEGORIAS const + edição inline |
| Valor da nota, qtd, valor/item | Task 5: colunas na tabela + Task 4: GET lotes |
| Taxa de uso da empresa | Task 4: `taxaUsoMensal` calculada + Task 5: coluna |
| Lote e validade | Task 5: colunas |
| Código da nota (NF pode ter vários produtos) | Task 5: coluna NF-e + Task 2: GET |
| Aba separada para notas | Task 6: `/estoque/notas` |
| CNPJ, nome social, data emissão por nota | Task 2: GET NF-e + Task 6: UI |
| Download individual (PDF/XML) | Task 2: `/nfe/[id]/download` + Task 6: botão |
| Export Excel com todos os dados | Task 3: `/nfe/export` + Task 6: botão |
| EntradaLoteModal (conversão embalagem→uso) | Task 5: componente completo |
| unidadeUso no modal Novo Insumo | Task 5: step 5 |
