# Estoque Melhorias v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve estoque UX (no horizontal scroll, smaller fonts, instant operations), redesign Fornecedores tab with real NF-e data, detect duplicate NF-e with side-by-side comparison, add VLR/Uso column + Catálogo tab, and implement hybrid subcategories.

**Architecture:** All changes are in the existing Next.js 15 App Router + Prisma SQLite stack. The main `page.tsx` (1,666 lines) already has sub-components for each tab. We add 2 new components (`NfeDuplicadaModal`, `CatalogoTab`), 1 schema migration (subcategoria field), and modify existing files. CSS review is integrated into each task.

**Tech Stack:** Next.js 15, TypeScript strict, Prisma (SQLite), Gemini 2.5-flash, Groq Llama 3.3, Lucide React, CSS Variables

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/estoque/page.tsx` | Main page: CSS fixes, optimistic updates, FornecedoresTab redesign, VLR/Uso column, Catálogo tab, subcategoria filters |
| Modify | `src/app/globals.css` | Table overflow fix, font size variables for estoque |
| Create | `src/components/NfeDuplicadaModal.tsx` | Side-by-side NF-e comparison modal |
| Modify | `src/components/NFeUploadModal.tsx` | Handle 409 duplicata response, improved confirmation table |
| Modify | `src/app/api/estoque/nfe/route.ts` | Duplicate detection (chaveAcesso check), return existing + new for comparison |
| Modify | `prisma/schema.prisma` | Add `subcategoria` field to Insumo |
| Modify | `src/lib/ai-stock.ts` | Add subcategoria to categorization prompt |
| Modify | `src/lib/gemini-stock.ts` | Add subcategoria to classification response |
| Modify | `src/lib/ai-providers.ts` | Add subcategoria to ClassificacaoInsumo type |

---

## Task 1: CSS — Remove horizontal scroll + reduce fonts

**Files:**
- Modify: `src/app/globals.css:425-429` (table-container)
- Modify: `src/app/estoque/page.tsx:677-693` (table header), `706` (row font-size)

- [ ] **Step 1: Fix table-container overflow in globals.css**

In `src/app/globals.css`, find the `.table-container` rule (line ~425):

```css
/* BEFORE */
.table-container {
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-glass);
}
```

Change to:

```css
.table-container {
  overflow-x: auto;
  max-width: 100%;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-glass);
}

.table-container table {
  table-layout: auto;
  width: 100%;
}
```

- [ ] **Step 2: Reduce font sizes in estoque table**

In `src/app/estoque/page.tsx`, find the table row rendering (line ~706):

```tsx
// BEFORE
<tr key={lote.id} style={{ opacity: lote.status === 'ESGOTADO' ? 0.5 : 1, userSelect: 'none', fontSize: '0.75rem' }}>
```

Change to:

```tsx
<tr key={lote.id} style={{ opacity: lote.status === 'ESGOTADO' ? 0.5 : 1, userSelect: 'none', fontSize: '0.7rem' }}>
```

- [ ] **Step 3: Reduce header font in table**

In `src/app/estoque/page.tsx`, add explicit font-size to the `<thead>` (line ~681):

```tsx
// BEFORE
<tr style={{ userSelect: 'none' }}>
```

Change to:

```tsx
<tr style={{ userSelect: 'none', fontSize: '0.7rem' }}>
```

- [ ] **Step 4: Tighten column widths to prevent overflow**

In `src/app/estoque/page.tsx`, update the Produto column cell (line ~707):

```tsx
// BEFORE
<td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: '180px', textAlign: 'center' }}>
```

Change to:

```tsx
<td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: '150px', textAlign: 'center' }}>
```

And the Vlr. Nota column (line ~754), add maxWidth:

```tsx
// BEFORE
<td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
  {lote.nfeImport
    ? `R$ ${lote.nfeImport.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
```

Change to:

```tsx
<td style={{ textAlign: 'center', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
  {lote.nfeImport
    ? `R$ ${lote.nfeImport.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
```

- [ ] **Step 5: Also reduce fonts in sub-tab tables (Lotes, Notas)**

In `LotesTab` component (line ~1375), the accordion table:

```tsx
// BEFORE
<table style={{ fontSize: '0.75rem' }}>
```

Change to:

```tsx
<table style={{ fontSize: '0.7rem' }}>
```

- [ ] **Step 6: Verify — run dev server and check no horizontal scroll**

Run: `npm run dev -- --port 5000`

Open http://localhost:5000/estoque — verify:
- No horizontal scrollbar on Estoque tab
- Fonts are visibly smaller but still readable
- All columns fit within viewport with sidebar open

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/app/estoque/page.tsx
git commit -m "$(cat <<'EOF'
fix: remove horizontal scroll and reduce font sizes in estoque

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Optimistic updates for +/- stock operations

**Files:**
- Modify: `src/app/estoque/page.tsx:830-845` (BaixaModal onSaved, EntradaLoteModal onSaved)

- [ ] **Step 1: Refactor BaixaModal onSaved to use optimistic update**

In `src/app/estoque/page.tsx`, find the BaixaModal usage (line ~830):

```tsx
// BEFORE
{baixaLoteId !== null && (
  <BaixaModal
    loteId={baixaLoteId}
    lote={lotes.find((l) => l.id === baixaLoteId)!}
    onClose={() => setBaixaLoteId(null)}
    onSaved={() => { setBaixaLoteId(null); fetchLotes(); toast('Baixa registrada', 'success') }}
  />
)}
```

Change to:

```tsx
{baixaLoteId !== null && (
  <BaixaModal
    loteId={baixaLoteId}
    lote={lotes.find((l) => l.id === baixaLoteId)!}
    onClose={() => setBaixaLoteId(null)}
    onSaved={(qtdBaixada: number) => {
      // Optimistic: atualizar estado local imediatamente
      setLotes((prev) => prev.map((l) => {
        if (l.id !== baixaLoteId) return l
        const novaQtd = l.quantidadeAtual - qtdBaixada
        return { ...l, quantidadeAtual: novaQtd, status: novaQtd <= 0 ? 'ESGOTADO' : l.status }
      }))
      setBaixaLoteId(null)
      toast('Baixa registrada', 'success')
    }}
  />
)}
```

- [ ] **Step 2: Update BaixaModal to pass quantity to onSaved**

In the `BaixaModal` component (line ~188), update the interface and salvar function:

```tsx
// BEFORE (line ~188-198)
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
```

Change to:

```tsx
function BaixaModal({
  loteId,
  lote,
  onClose,
  onSaved,
}: {
  loteId: number
  lote: LoteCompleto
  onClose: () => void
  onSaved: (qtdBaixada: number) => void
}) {
```

And in the `salvar` function (line ~222), change:

```tsx
// BEFORE
onSaved()
```

To:

```tsx
onSaved(qtd)
```

- [ ] **Step 3: Refactor EntradaLoteModal onSaved to avoid full reload**

In `src/app/estoque/page.tsx`, find the EntradaLoteModal usage (line ~838):

```tsx
// BEFORE
{entradaInsumoId !== null && (
  <EntradaLoteModal
    insumoId={entradaInsumoId}
    insumos={lotes.map((l) => l.insumo)}
    onClose={() => setEntradaInsumoId(null)}
    onSaved={() => { setEntradaInsumoId(null); fetchLotes() }}
  />
)}
```

Change to:

```tsx
{entradaInsumoId !== null && (
  <EntradaLoteModal
    insumoId={entradaInsumoId}
    insumos={lotes.map((l) => l.insumo)}
    onClose={() => setEntradaInsumoId(null)}
    onSaved={() => {
      setEntradaInsumoId(null)
      toast('Entrada registrada', 'success')
      // Background refresh — não bloqueia UI
      fetchLotes()
    }}
  />
)}
```

- [ ] **Step 4: Make delete lote optimistic**

In `src/app/estoque/page.tsx`, find the delete button onClick (line ~800):

```tsx
// BEFORE
onClick={async () => {
  if (!confirm(`Remover lote de "${lote.insumo.nome}"?`)) return
  const res = await fetch(`/api/estoque/lotes/${lote.id}`, { method: 'DELETE' })
  if (res.ok) toast('Lote removido', 'success')
  else toast('Erro ao remover lote', 'error')
  fetchLotes()
}}
```

Change to:

```tsx
onClick={async () => {
  if (!confirm(`Remover lote de "${lote.insumo.nome}"?`)) return
  // Optimistic: remove da lista imediatamente
  const prev = lotes
  setLotes((cur) => cur.filter((l) => l.id !== lote.id))
  toast('Lote removido', 'success')
  const res = await fetch(`/api/estoque/lotes/${lote.id}`, { method: 'DELETE' })
  if (!res.ok) {
    // Rollback
    setLotes(prev)
    toast('Erro ao remover lote', 'error')
  }
}}
```

- [ ] **Step 5: Verify — test +/- and delete are instant**

Open http://localhost:5000/estoque
- Click `-` on a lote → register baixa → UI updates instantly
- Click `X` on a lote → confirm → row disappears instantly
- Click `+` on a lote → add entrada → toast appears, list refreshes in background

- [ ] **Step 6: Commit**

```bash
git add src/app/estoque/page.tsx
git commit -m "$(cat <<'EOF'
feat: optimistic updates for stock operations (zero perceived latency)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Prisma schema — add subcategoria field

**Files:**
- Modify: `prisma/schema.prisma:49` (Insumo model)

- [ ] **Step 1: Add subcategoria field to Insumo model**

In `prisma/schema.prisma`, find the Insumo model (line ~41), after `grupoCategoria`:

```prisma
// BEFORE
  grupoCategoria  String?
  estoqueMinimo   Float                @default(5)
```

Change to:

```prisma
  grupoCategoria  String?
  subcategoria    String?
  estoqueMinimo   Float                @default(5)
```

- [ ] **Step 2: Run migration**

```bash
cd "/workspaces/Projeto Dentist Management" && npx prisma migrate dev --name add-subcategoria
```

Expected: Migration created and applied. `src/generated/prisma` regenerated.

- [ ] **Step 3: Verify migration**

```bash
cd "/workspaces/Projeto Dentist Management" && npx prisma studio --port 5555 &
```

Or just verify the column exists:

```bash
cd "/workspaces/Projeto Dentist Management" && sqlite3 prisma/dev.db ".schema Insumo" 2>/dev/null || npx prisma db push
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "$(cat <<'EOF'
feat: add subcategoria field to Insumo model

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: AI classification — add subcategoria to prompts

**Files:**
- Modify: `src/lib/ai-providers.ts:35-42` (ClassificacaoInsumo type)
- Modify: `src/lib/ai-stock.ts:84-116` (categorizarInsumo function)
- Modify: `src/lib/gemini-stock.ts` (classificarInsumo method)

- [ ] **Step 1: Update ClassificacaoInsumo type**

In `src/lib/ai-providers.ts`, find the interface (line ~35):

```tsx
// BEFORE
export interface ClassificacaoInsumo {
  grupoCategoria: string
  unidadeMedida: string
  usosMin: number
  usosMax: number
  confianca: number
  observacoes: string
}
```

Change to:

```tsx
export interface ClassificacaoInsumo {
  grupoCategoria: string
  subcategoria: string | null
  unidadeMedida: string
  usosMin: number
  usosMax: number
  confianca: number
  observacoes: string
}
```

- [ ] **Step 2: Update Groq categorizarInsumo to return subcategoria**

In `src/lib/ai-stock.ts`, find `categorizarInsumo` (line ~92). Replace the entire function:

```tsx
// BEFORE
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
```

Change to:

```tsx
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
```

- [ ] **Step 3: Update Gemini classificarInsumo to include subcategoria**

In `src/lib/gemini-stock.ts`, find the `classificarInsumo` method. Add `subcategoria` to the JSON schema and prompt. The schema should include:

```tsx
subcategoria: { type: SchemaType.STRING, nullable: true },
```

And the prompt should include:

```
Subcategorias disponíveis por grupo:
Endodontia: Limas Manuais, Limas Rotatórias, Cones, Seladores/Cimentos, Irrigação
Anestesia: Com Vasoconstritor, Sem Vasoconstritor, Tópica
Restauração: Resinas, Adesivos, Ácidos, Ionômeros, Acabamento
Luvas/EPI: Luvas, Sugadores, Lençol de Borracha
Limpeza/Esterilização: Pasta Profilática, Escovas, Pedra Pomes
Medicamentos: Anti-inflamatório, Curativo, Clareador
Exodontia: Fios de Sutura, Lâminas
Outros: Brocas, Microbrush, Tiras

Se nenhuma subcategoria se aplicar, retorne subcategoria: null.
```

- [ ] **Step 4: Verify — TypeScript compiles**

```bash
cd "/workspaces/Projeto Dentist Management" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to ClassificacaoInsumo or subcategoria.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-providers.ts src/lib/ai-stock.ts src/lib/gemini-stock.ts
git commit -m "$(cat <<'EOF'
feat: add subcategoria to AI classification (hybrid group + sub)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: NF-e duplicate detection — API + comparison modal

**Files:**
- Modify: `src/app/api/estoque/nfe/route.ts:56-225` (POST handler)
- Create: `src/components/NfeDuplicadaModal.tsx`
- Modify: `src/components/NFeUploadModal.tsx:82-93` (handle 409)

- [ ] **Step 1: Add duplicate check to NF-e POST API**

In `src/app/api/estoque/nfe/route.ts`, after parsing the NF-e data (after line ~95, before "Salvar arquivo"), add duplicate check:

```tsx
    // ── 1b. Check for duplicate ─────────────────────────────────────────────
    const existente = await db.nFeImport.findUnique({
      where: { chaveAcesso: nfeData.chaveAcesso },
      include: {
        fornecedor: { select: { cnpj: true, nome: true } },
        lotes: {
          where: { status: { not: 'DESCARTADO' } },
          include: { insumo: { select: { nome: true, grupoCategoria: true, unidadeMedida: true } } },
        },
      },
    })

    if (existente) {
      return NextResponse.json({
        duplicada: true,
        existente: {
          id: existente.id,
          numero: existente.numero,
          serie: existente.serie,
          chaveAcesso: existente.chaveAcesso,
          dataEmissao: existente.dataEmissao,
          valorTotal: existente.valorTotal,
          fornecedor: existente.fornecedor,
          itens: existente.lotes.map((l) => ({
            nome: l.insumo?.nome ?? '—',
            categoria: l.insumo?.grupoCategoria ?? null,
            quantidade: l.quantidade,
            custoUnitario: l.custoUnitario,
            validade: l.validade,
            unidade: l.insumo?.unidadeMedida ?? 'UN',
          })),
        },
        nova: {
          numero: nfeData.numero,
          serie: nfeData.serie,
          chaveAcesso: nfeData.chaveAcesso,
          dataEmissao: nfeData.dataEmissao,
          valorTotal: nfeData.valorTotal,
          fornecedor: nfeData.fornecedor,
          itens: nfeData.itens.map((item, idx) => ({
            nome: item.nomeProduto,
            categoria: null,
            quantidade: item.quantidade,
            custoUnitario: item.valorUnitario,
            validade: itensComValidade[idx]?.validade ?? null,
            unidade: item.unidade,
          })),
        },
      }, { status: 409 })
    }
```

Also remove the `upsert` for NFeImport (line ~114) and replace with `create` since we now handle duplicates explicitly:

```tsx
    // BEFORE
    const nfeImport = await db.nFeImport.upsert({
      where: { chaveAcesso: nfeData.chaveAcesso },
      create: { ... },
      update: {},
    })
```

Change to:

```tsx
    const nfeImport = await db.nFeImport.create({
      data: {
        chaveAcesso: nfeData.chaveAcesso,
        numero: nfeData.numero,
        serie: nfeData.serie,
        dataEmissao: nfeData.dataEmissao,
        valorTotal: nfeData.valorTotal,
        xmlPath: `/uploads/notas/${filename}`,
        fornecedorId: fornecedor.id,
      },
    })
```

- [ ] **Step 2: Create NfeDuplicadaModal component**

Create `src/components/NfeDuplicadaModal.tsx`:

```tsx
'use client'

import { X } from 'lucide-react'

interface NfeItem {
  nome: string
  categoria: string | null
  quantidade: number
  custoUnitario: number | null
  validade: string | null
  unidade: string
}

interface NfeComparacao {
  id?: number
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  valorTotal: number
  fornecedor: { cnpj: string; nome: string }
  itens: NfeItem[]
}

interface Props {
  existente: NfeComparacao
  nova: NfeComparacao
  onManter: () => void
  onSubstituir: () => void
  onCancelar: () => void
  substituindo?: boolean
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function formatCurrency(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type DiffType = 'same' | 'changed' | 'only-old' | 'only-new'

function diffItens(existente: NfeItem[], nova: NfeItem[]): { item: NfeItem; comparacao?: NfeItem; diff: DiffType }[] {
  const result: { item: NfeItem; comparacao?: NfeItem; diff: DiffType }[] = []
  const usedNew = new Set<number>()

  for (const eItem of existente) {
    const matchIdx = nova.findIndex((n, idx) =>
      !usedNew.has(idx) && n.nome.toLowerCase() === eItem.nome.toLowerCase()
    )
    if (matchIdx >= 0) {
      usedNew.add(matchIdx)
      const nItem = nova[matchIdx]
      const changed = nItem.quantidade !== eItem.quantidade ||
        nItem.custoUnitario !== eItem.custoUnitario
      result.push({ item: eItem, comparacao: nItem, diff: changed ? 'changed' : 'same' })
    } else {
      result.push({ item: eItem, diff: 'only-old' })
    }
  }

  nova.forEach((nItem, idx) => {
    if (!usedNew.has(idx)) {
      result.push({ item: nItem, diff: 'only-new' })
    }
  })

  return result
}

const DIFF_COLORS: Record<DiffType, string> = {
  same: 'transparent',
  changed: 'rgba(234,179,8,0.1)',
  'only-old': 'rgba(244,63,94,0.1)',
  'only-new': 'rgba(20,184,166,0.1)',
}

const DIFF_LABELS: Record<DiffType, string> = {
  same: '',
  changed: '⚠ Alterado',
  'only-old': '✗ Só na existente',
  'only-new': '✓ Só na nova',
}

export default function NfeDuplicadaModal({ existente, nova, onManter, onSubstituir, onCancelar, substituindo }: Props) {
  const diffs = diffItens(existente.itens, nova.itens)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={onCancelar}
    >
      <div
        className="glass-card"
        style={{ width: '750px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--accent-amber)' }}>NF-e Duplicada Detectada</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
              Chave: {existente.chaveAcesso.slice(0, 20)}...
            </p>
          </div>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Comparação header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(244,63,94,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--accent-rose)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>NF-e Existente</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>NF {existente.numero}/{existente.serie}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(existente.dataEmissao)}</div>
            <div style={{ fontWeight: 600, marginTop: '4px' }}>{formatCurrency(existente.valorTotal)}</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(20,184,166,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--accent-teal)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>NF-e Nova</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>NF {nova.numero}/{nova.serie}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(nova.dataEmissao)}</div>
            <div style={{ fontWeight: 600, marginTop: '4px' }}>{formatCurrency(nova.valorTotal)}</div>
          </div>
        </div>

        {/* Diff de itens */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '0.8rem', marginBottom: '8px' }}>Comparação de Itens</h4>
          <div className="table-container">
            <table style={{ fontSize: '0.7rem' }}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ textAlign: 'center' }}>Qtd Existente</th>
                  <th style={{ textAlign: 'center' }}>Qtd Nova</th>
                  <th style={{ textAlign: 'center' }}>Vlr Existente</th>
                  <th style={{ textAlign: 'center' }}>Vlr Nova</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d, i) => (
                  <tr key={i} style={{ background: DIFF_COLORS[d.diff] }}>
                    <td style={{ fontWeight: 500 }}>{d.item.nome}</td>
                    <td style={{ textAlign: 'center' }}>
                      {d.diff !== 'only-new' ? `${d.item.quantidade} ${d.item.unidade}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {d.diff === 'only-old' ? '—' : d.comparacao ? `${d.comparacao.quantidade} ${d.comparacao.unidade}` : `${d.item.quantidade} ${d.item.unidade}`}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {d.diff !== 'only-new' ? formatCurrency(d.item.custoUnitario) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {d.diff === 'only-old' ? '—' : formatCurrency(d.comparacao?.custoUnitario ?? d.item.custoUnitario)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {DIFF_LABELS[d.diff] && (
                        <span className={`badge ${d.diff === 'only-new' ? 'badge-teal' : d.diff === 'only-old' ? 'badge-rose' : 'badge-amber'}`} style={{ fontSize: '0.6rem' }}>
                          {DIFF_LABELS[d.diff]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancelar} disabled={substituindo}>
            Cancelar
          </button>
          <button className="btn btn-secondary" onClick={onManter} disabled={substituindo}>
            Manter Existente
          </button>
          <button
            className="btn btn-primary"
            onClick={onSubstituir}
            disabled={substituindo}
            style={{ background: 'var(--accent-amber)' }}
          >
            {substituindo ? 'Substituindo...' : 'Substituir pela Nova'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Handle 409 in NFeUploadModal**

In `src/components/NFeUploadModal.tsx`, add import and state:

```tsx
// Add import at top
import NfeDuplicadaModal from './NfeDuplicadaModal'
```

Add state after existing state declarations (line ~52):

```tsx
const [duplicadaData, setDuplicadaData] = useState<{ existente: any; nova: any } | null>(null)
const [substituindo, setSubstituindo] = useState(false)
const [pendingFile, setPendingFile] = useState<File | null>(null)
```

In `processarXML` (line ~87), change the error handling:

```tsx
// BEFORE
if (!res.ok) {
  setError(data.error ?? 'Erro ao processar NF-e')
  return
}
```

Change to:

```tsx
if (res.status === 409 && data.duplicada) {
  setDuplicadaData({ existente: data.existente, nova: data.nova })
  setPendingFile(file)
  setUploading(false)
  return
}
if (!res.ok) {
  setError(data.error ?? 'Erro ao processar NF-e')
  return
}
```

Add handler functions before the return statement:

```tsx
async function handleManterExistente() {
  setDuplicadaData(null)
  setPendingFile(null)
}

async function handleSubstituir() {
  if (!duplicadaData) return
  setSubstituindo(true)
  try {
    // Delete existing NF-e first
    await fetch(`/api/estoque/nfe/${duplicadaData.existente.id}`, { method: 'DELETE' })
    // Re-upload
    if (pendingFile) {
      await processarXML(pendingFile)
    }
  } catch {
    setError('Erro ao substituir nota fiscal')
  } finally {
    setSubstituindo(false)
    setDuplicadaData(null)
    setPendingFile(null)
  }
}
```

Add the modal render before the closing `</div>` of the main modal:

```tsx
{duplicadaData && (
  <NfeDuplicadaModal
    existente={duplicadaData.existente}
    nova={duplicadaData.nova}
    onManter={handleManterExistente}
    onSubstituir={handleSubstituir}
    onCancelar={() => { setDuplicadaData(null); setPendingFile(null) }}
    substituindo={substituindo}
  />
)}
```

- [ ] **Step 4: Verify — TypeScript compiles**

```bash
cd "/workspaces/Projeto Dentist Management" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/estoque/nfe/route.ts src/components/NfeDuplicadaModal.tsx src/components/NFeUploadModal.tsx
git commit -m "$(cat <<'EOF'
feat: detect duplicate NF-e with side-by-side comparison modal

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Redesign FornecedoresTab

**Files:**
- Modify: `src/app/estoque/page.tsx:1540-1665` (FornecedoresTab component)

- [ ] **Step 1: Replace FornecedoresTab with redesigned version**

In `src/app/estoque/page.tsx`, replace the entire `FornecedoresTab` function (lines 1551-1665) with:

```tsx
function FornecedoresTab() {
  const { toast } = useToast()
  const [fornecedores, setFornecedores] = useState<(FornecedorItem & {
    totalNfe: number
    totalProdutos: number
    totalValorNfe: number
    ultimoPedido: string | null
    produtos: { nome: string; quantidade: number; custoUnitario: number | null }[]
  })[]>([])
  const [loading, setLoading] = useState(true)
  const [avaliacoes, setAvaliacoes] = useState<Record<number, AvaliacaoFornecedor>>({})
  const [loadingAvaliacao, setLoadingAvaliacao] = useState<number | null>(null)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [produtosVisiveis, setProdutosVisiveis] = useState<Set<number>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/estoque/nfe').then((r) => r.json()),
      fetch('/api/estoque/lotes?fefo=true').then((r) => r.json()),
    ])
      .then(([notas, lotes]: [any[], any[]]) => {
        const mapa = new Map<number, {
          id: number; cnpj: string; nome: string; email: string | null; telefone: string | null
          totalLotes: number; totalNfe: number; totalProdutos: Set<string>; totalValorNfe: number
          ultimoPedido: string | null; produtos: Map<string, { nome: string; quantidade: number; custoUnitario: number | null }>
        }>()

        // Dados dos lotes (fornecedor + produtos)
        for (const lote of lotes) {
          if (!lote.fornecedor) continue
          const f = lote.fornecedor
          if (!mapa.has(f.id)) {
            mapa.set(f.id, {
              ...f, totalLotes: 0, totalNfe: 0, totalProdutos: new Set(),
              totalValorNfe: 0, ultimoPedido: null, produtos: new Map(),
            })
          }
          const entry = mapa.get(f.id)!
          entry.totalLotes++
          if (lote.insumo?.nome) {
            entry.totalProdutos.add(lote.insumo.nome)
            const key = lote.insumo.nome
            const prev = entry.produtos.get(key)
            entry.produtos.set(key, {
              nome: key,
              quantidade: (prev?.quantidade ?? 0) + (lote.quantidadeAtual ?? 0),
              custoUnitario: lote.custoUnitario ?? prev?.custoUnitario ?? null,
            })
          }
        }

        // Dados das NF-e (valor real, contagem, datas)
        for (const nota of notas) {
          const fId = nota.fornecedor?.cnpj
            ? Array.from(mapa.values()).find((f) => f.cnpj === nota.fornecedor.cnpj)?.id
            : null
          if (fId && mapa.has(fId)) {
            const entry = mapa.get(fId)!
            entry.totalNfe++
            entry.totalValorNfe += nota.valorTotal ?? 0
            const dataEmissao = nota.dataEmissao ? new Date(nota.dataEmissao).toISOString() : null
            if (dataEmissao && (!entry.ultimoPedido || dataEmissao > entry.ultimoPedido)) {
              entry.ultimoPedido = dataEmissao
            }
          }
        }

        setFornecedores(
          Array.from(mapa.values()).map((f) => ({
            id: f.id, cnpj: f.cnpj, nome: f.nome, email: f.email, telefone: f.telefone,
            totalLotes: f.totalLotes, totalNfe: f.totalNfe, totalProdutos: f.totalProdutos.size,
            totalValorNfe: f.totalValorNfe, ultimoPedido: f.ultimoPedido,
            produtos: Array.from(f.produtos.values()),
          }))
        )
      })
      .catch(() => toast('Erro ao carregar fornecedores', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  async function avaliarFornecedor(fornecedorId: number) {
    if (avaliacoes[fornecedorId]) {
      // Toggle expand
      setExpandidos((prev) => {
        const next = new Set(prev)
        if (next.has(fornecedorId)) next.delete(fornecedorId)
        else next.add(fornecedorId)
        return next
      })
      return
    }
    setLoadingAvaliacao(fornecedorId)
    setExpandidos((prev) => new Set(prev).add(fornecedorId))
    try {
      const res = await fetch(`/api/estoque/ai/fornecedor?fornecedorId=${fornecedorId}`)
      const data = await res.json()
      setAvaliacoes((prev) => ({ ...prev, [fornecedorId]: data }))
    } catch {
      toast('Erro ao avaliar fornecedor', 'error')
    } finally {
      setLoadingAvaliacao(null)
    }
  }

  function toggleProdutos(fId: number) {
    setProdutosVisiveis((prev) => {
      const next = new Set(prev)
      if (next.has(fId)) next.delete(fId)
      else next.add(fId)
      return next
    })
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando fornecedores...</div>
  }

  if (fornecedores.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
        <Truck size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Fornecedores são cadastrados automaticamente ao importar NF-e.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {fornecedores.map((f) => {
        const av = avaliacoes[f.id]
        const expandido = expandidos.has(f.id)
        const mostrarProdutos = produtosVisiveis.has(f.id)

        return (
          <div key={f.id} className="glass-card" style={{ padding: '14px 16px' }}>
            {/* Header compacto */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.nome}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                  CNPJ: {f.cnpj} · {f.totalNfe} NF-e{f.totalNfe !== 1 ? 's' : ''} · {f.totalProdutos} produto{f.totalProdutos !== 1 ? 's' : ''}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                  {f.ultimoPedido && <>Último pedido: {new Date(f.ultimoPedido).toLocaleDateString('pt-BR')} · </>}
                  Total NF-e: <strong style={{ color: 'var(--text-secondary)' }}>R$ {f.totalValorNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.7rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => avaliarFornecedor(f.id)}
                disabled={loadingAvaliacao === f.id}
              >
                <Star size={11} />
                {loadingAvaliacao === f.id ? 'Avaliando...' : av ? (expandido ? 'Recolher' : 'Ver Avaliação') : 'Avaliar IA'}
              </button>
            </div>

            {/* Accordion: produtos */}
            {f.produtos.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => toggleProdutos(f.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--accent-teal)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  {mostrarProdutos ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Ver {f.produtos.length} produto{f.produtos.length !== 1 ? 's' : ''}
                </button>
                {mostrarProdutos && (
                  <div style={{ marginTop: '6px', background: 'var(--bg-elevated)', borderRadius: '6px', padding: '8px 10px' }}>
                    {f.produtos.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.7rem', borderBottom: i < f.produtos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.nome}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {p.quantidade > 0 && <>{p.quantidade} un</>}
                          {p.custoUnitario != null && <> · R$ {p.custoUnitario.toFixed(2)}/un</>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Avaliação IA expandível */}
            {expandido && av && (
              <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                  {[
                    { label: 'Geral', value: av.notaGeral },
                    { label: 'Confiabilidade', value: av.notaConfiabilidade },
                    { label: 'Custo', value: av.notaCusto },
                    { label: 'Qualidade', value: av.notaQualidade },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: 'center', padding: '4px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{label}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: value >= 8 ? 'var(--accent-emerald)' : value >= 6 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                        {value}/10
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{av.narrativa}</p>
                <span className={`badge ${av.recomendacao === 'manter' ? 'badge-emerald' : av.recomendacao === 'avaliar' ? 'badge-amber' : 'badge-rose'}`} style={{ fontSize: '0.65rem' }}>
                  {av.recomendacao === 'manter' ? '✓ Manter' : av.recomendacao === 'avaliar' ? '⚠ Avaliar' : '✗ Substituir'}
                </span>
              </div>
            )}
            {expandido && !av && loadingAvaliacao === f.id && (
              <div style={{ marginTop: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px' }}>
                Avaliando fornecedor com IA...
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify — open Fornecedores tab**

Open http://localhost:5000/estoque → tab Fornecedores
- Cards show: nome, CNPJ, NF-e count, produtos count, Total NF-e (not Total gasto)
- "Ver N produtos" accordion works
- "Avaliar IA" button expands/collapses evaluation

- [ ] **Step 3: Commit**

```bash
git add src/app/estoque/page.tsx
git commit -m "$(cat <<'EOF'
feat: redesign Fornecedores tab with real NF-e data and compact layout

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: VLR/Uso column in Estoque tab

**Files:**
- Modify: `src/app/estoque/page.tsx:680-690` (table header), `706-815` (table rows)
- Modify: `src/app/estoque/page.tsx:127-151` (LoteCompleto type)

- [ ] **Step 1: Add usosMin/usosMax to LoteCompleto type**

In `src/app/estoque/page.tsx`, update the `LoteCompleto` interface (line ~127):

```tsx
// BEFORE
  insumo: {
    id: number
    nome: string
    grupoCategoria: string | null
    unidadeMedida: string
    unidadeUso: string | null
    estoqueMinimo: number
  }
```

Change to:

```tsx
  insumo: {
    id: number
    nome: string
    grupoCategoria: string | null
    subcategoria: string | null
    unidadeMedida: string
    unidadeUso: string | null
    estoqueMinimo: number
    usosMin: number
    usosMax: number
  }
```

- [ ] **Step 2: Update the API endpoint to return usosMin/usosMax/subcategoria**

In the lotes API (wherever `include: { insumo: { select: ... } }` is used), ensure `usosMin`, `usosMax`, and `subcategoria` are included in the select. Check `src/app/api/estoque/lotes/route.ts` and add:

```tsx
insumo: { select: { id: true, nome: true, grupoCategoria: true, subcategoria: true, unidadeMedida: true, unidadeUso: true, estoqueMinimo: true, usosMin: true, usosMax: true } },
```

- [ ] **Step 3: Add VLR/Uso column header**

In `src/app/estoque/page.tsx`, find the table headers (line ~686), after `Vlr/item`:

```tsx
// BEFORE
<th style={{ textAlign: 'center' }}>Vlr/item</th>
<th style={{ textAlign: 'center' }}>Lote</th>
```

Change to:

```tsx
<th style={{ textAlign: 'center' }}>Vlr/item</th>
<th style={{ textAlign: 'center' }}>Vlr/uso</th>
<th style={{ textAlign: 'center' }}>Lote</th>
```

- [ ] **Step 4: Add VLR/Uso column cell**

After the Vlr/item cell (line ~766), add the VLR/Uso cell:

```tsx
// After the Vlr/item <td>
<td style={{ textAlign: 'center' }}>
  {(() => {
    if (!lote.custoUnitario) return '—'
    const usosMedio = (lote.insumo.usosMin + lote.insumo.usosMax) / 2
    if (usosMedio <= 1) return '—'
    const vlrUso = lote.custoUnitario / usosMedio
    return (
      <span title={`R$ ${lote.custoUnitario.toFixed(2)} ÷ ${usosMedio} usos`} style={{ color: 'var(--accent-teal)' }}>
        R$ {vlrUso.toFixed(2)}
      </span>
    )
  })()}
</td>
```

- [ ] **Step 5: Update colSpan for empty state**

Find the empty table row (line ~818):

```tsx
// BEFORE
<td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
```

Change to:

```tsx
<td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
```

- [ ] **Step 6: Verify — VLR/Uso shows for products with usos > 1**

Open http://localhost:5000/estoque
- Products with usosMin/usosMax = 1: show "—" in VLR/Uso
- Products with usos > 1: show calculated R$ value with tooltip
- No horizontal scroll introduced

- [ ] **Step 7: Commit**

```bash
git add src/app/estoque/page.tsx src/app/api/estoque/lotes/
git commit -m "$(cat <<'EOF'
feat: add VLR/Uso column to estoque tab

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: New Catálogo tab

**Files:**
- Modify: `src/app/estoque/page.tsx:153` (Tab type), `614-648` (tab bar), add CatalogoTab component

- [ ] **Step 1: Add 'catalogo' to Tab type**

In `src/app/estoque/page.tsx`, find the Tab type (line ~153):

```tsx
// BEFORE
type Tab = 'estoque' | 'lotes' | 'alertas' | 'fornecedores' | 'notas'
```

Change to:

```tsx
type Tab = 'estoque' | 'lotes' | 'alertas' | 'fornecedores' | 'notas' | 'catalogo'
```

- [ ] **Step 2: Add tab button in the tab bar**

In the tab bar (line ~615):

```tsx
// BEFORE
{(['estoque', 'lotes', 'alertas', 'fornecedores', 'notas'] as Tab[]).map((t) => (
```

Change to:

```tsx
{(['estoque', 'lotes', 'alertas', 'fornecedores', 'notas', 'catalogo'] as Tab[]).map((t) => (
```

And in the icon/label section (line ~634), add:

```tsx
{t === 'catalogo' && <ClipboardList size={13} />}
```

And in the label logic (line ~639), update to handle 'catalogo':

```tsx
// BEFORE
{t === 'alertas' && alertas.length > 0
  ? `Alertas (${alertas.length})`
  : t === 'notas'
    ? 'Notas Fiscais'
    : t === 'fornecedores'
      ? 'Fornecedores'
      : t.charAt(0).toUpperCase() + t.slice(1)}
```

Change to:

```tsx
{t === 'alertas' && alertas.length > 0
  ? `Alertas (${alertas.length})`
  : t === 'notas'
    ? 'Notas Fiscais'
    : t === 'fornecedores'
      ? 'Fornecedores'
      : t === 'catalogo'
        ? 'Catálogo'
        : t.charAt(0).toUpperCase() + t.slice(1)}
```

- [ ] **Step 3: Add CatalogoTab component**

Add before the closing `}` of the file (before the final exports/end), a new component:

```tsx
// ─── Sub-componente: Catálogo de Uso ─────────────────────────────────────────

function CatalogoTab() {
  const { toast } = useToast()
  const [insumos, setInsumos] = useState<{
    id: number; nome: string; unidadeMedida: string; unidadeUso: string | null
    grupoCategoria: string | null; subcategoria: string | null
    usosMin: number; usosMax: number; estoqueMinimo: number
    fatorConversaoMedio: number | null; custoUnitarioMedio: number | null
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<{ id: number; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [searchCatalogo, setSearchCatalogo] = useState('')
  const [filtroCat, setFiltroCat] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/estoque/insumos').then((r) => r.json()),
      fetch('/api/estoque/lotes?fefo=true').then((r) => r.json()),
    ])
      .then(([insumosData, lotesData]: [any[], any[]]) => {
        // Calcular fator de conversão médio e custo unitário médio por insumo
        const fatorMap = new Map<number, number[]>()
        const custoMap = new Map<number, number[]>()
        for (const lote of lotesData) {
          if (lote.fatorConversao && lote.fatorConversao > 0) {
            fatorMap.set(lote.insumoId, [...(fatorMap.get(lote.insumoId) ?? []), lote.fatorConversao])
          }
          if (lote.custoUnitario && lote.custoUnitario > 0) {
            custoMap.set(lote.insumoId, [...(custoMap.get(lote.insumoId) ?? []), lote.custoUnitario])
          }
        }

        const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

        setInsumos(insumosData.map((i: any) => ({
          id: i.id,
          nome: i.nome,
          unidadeMedida: i.unidadeMedida ?? 'UN',
          unidadeUso: i.unidadeUso ?? null,
          grupoCategoria: i.grupoCategoria ?? null,
          subcategoria: i.subcategoria ?? null,
          usosMin: i.usosMin ?? 1,
          usosMax: i.usosMax ?? 1,
          estoqueMinimo: i.estoqueMinimo ?? 5,
          fatorConversaoMedio: fatorMap.has(i.id) ? avg(fatorMap.get(i.id)!) : null,
          custoUnitarioMedio: custoMap.has(i.id) ? avg(custoMap.get(i.id)!) : null,
        })))
      })
      .finally(() => setLoading(false))
  }, [])

  async function salvarCampo(insumoId: number, campo: string, valor: string) {
    const payload: Record<string, unknown> = {}
    if (campo === 'usosMin' || campo === 'usosMax' || campo === 'estoqueMinimo') {
      payload[campo] = parseFloat(valor) || 1
    } else {
      payload[campo] = valor || null
    }

    try {
      const res = await fetch(`/api/estoque/insumos/${insumoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setInsumos((prev) => prev.map((i) => i.id === insumoId ? { ...i, ...payload } as typeof i : i))
        toast('Salvo', 'success')
      }
    } catch {
      toast('Erro ao salvar', 'error')
    }
    setEditando(null)
  }

  function startEdit(id: number, campo: string, currentValue: string) {
    setEditando({ id, campo })
    setEditValue(currentValue)
  }

  const filtered = insumos.filter((i) => {
    if (searchCatalogo && !i.nome.toLowerCase().includes(searchCatalogo.toLowerCase())) return false
    if (filtroCat && i.grupoCategoria !== filtroCat) return false
    return true
  })

  if (loading) return <SkeletonTable rows={8} cols={7} />

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-bar-icon"><Search size={14} /></span>
          <input
            placeholder="Buscar produto..."
            value={searchCatalogo}
            onChange={(e) => setSearchCatalogo(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: '160px' }} value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
          <option value="">Todas categorias</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-container">
          <table style={{ fontSize: '0.7rem' }}>
            <thead>
              <tr style={{ fontSize: '0.7rem' }}>
                <th>Produto</th>
                <th style={{ textAlign: 'center' }}>Categoria</th>
                <th style={{ textAlign: 'center' }}>Subcategoria</th>
                <th style={{ textAlign: 'center' }}>Und. Compra</th>
                <th style={{ textAlign: 'center' }}>Fator Conv.</th>
                <th style={{ textAlign: 'center' }}>Usos/Un</th>
                <th style={{ textAlign: 'center' }}>VLR/Uso médio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Nenhum insumo cadastrado.</td></tr>
              ) : filtered.map((ins) => {
                const usosMedio = (ins.usosMin + ins.usosMax) / 2
                const vlrUso = ins.custoUnitarioMedio && usosMedio > 0 ? ins.custoUnitarioMedio / usosMedio : null

                return (
                  <tr key={ins.id}>
                    <td style={{ fontWeight: 500 }}>{ins.nome}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${ins.grupoCategoria ? 'badge-teal' : 'badge-amber'}`} style={{ fontSize: '0.6rem' }}>
                        {ins.grupoCategoria ?? 'definir'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {editando?.id === ins.id && editando.campo === 'subcategoria' ? (
                        <input
                          className="input"
                          style={{ width: '100px', padding: '2px 4px', fontSize: '0.7rem' }}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => salvarCampo(ins.id, 'subcategoria', editValue)}
                          onKeyDown={(e) => e.key === 'Enter' && salvarCampo(ins.id, 'subcategoria', editValue)}
                          autoFocus
                        />
                      ) : (
                        <span
                          style={{ cursor: 'pointer', color: ins.subcategoria ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: '0.65rem' }}
                          onClick={() => startEdit(ins.id, 'subcategoria', ins.subcategoria ?? '')}
                        >
                          {ins.subcategoria ?? 'definir'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {ins.unidadeMedida}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {ins.fatorConversaoMedio ? `1→${ins.fatorConversaoMedio}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {editando?.id === ins.id && editando.campo === 'usos' ? (
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          <input
                            type="number" min="1" step="1"
                            className="input" style={{ width: '40px', padding: '2px', fontSize: '0.7rem', textAlign: 'center' }}
                            value={editValue.split('-')[0] ?? '1'}
                            onChange={(e) => setEditValue(`${e.target.value}-${editValue.split('-')[1] ?? '1'}`)}
                            autoFocus
                          />
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                          <input
                            type="number" min="1" step="1"
                            className="input" style={{ width: '40px', padding: '2px', fontSize: '0.7rem', textAlign: 'center' }}
                            value={editValue.split('-')[1] ?? '1'}
                            onChange={(e) => setEditValue(`${editValue.split('-')[0] ?? '1'}-${e.target.value}`)}
                            onBlur={async () => {
                              const [min, max] = editValue.split('-').map(Number)
                              await fetch(`/api/estoque/insumos/${ins.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ usosMin: min || 1, usosMax: max || 1 }),
                              })
                              setInsumos((prev) => prev.map((i) => i.id === ins.id ? { ...i, usosMin: min || 1, usosMax: max || 1 } : i))
                              setEditando(null)
                              toast('Usos atualizados', 'success')
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const [min, max] = editValue.split('-').map(Number)
                                await fetch(`/api/estoque/insumos/${ins.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ usosMin: min || 1, usosMax: max || 1 }),
                                })
                                setInsumos((prev) => prev.map((i) => i.id === ins.id ? { ...i, usosMin: min || 1, usosMax: max || 1 } : i))
                                setEditando(null)
                                toast('Usos atualizados', 'success')
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <span
                          style={{ cursor: 'pointer', color: usosMedio > 1 ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                          onClick={() => startEdit(ins.id, 'usos', `${ins.usosMin}-${ins.usosMax}`)}
                        >
                          {ins.usosMin === ins.usosMax ? ins.usosMin : `${ins.usosMin}-${ins.usosMax}`}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {vlrUso && usosMedio > 1
                        ? <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>R$ {vlrUso.toFixed(2)}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Render CatalogoTab in main component**

After the notas tab render (after the `{tab === 'notas' && ...}` block), add:

```tsx
{tab === 'catalogo' && <div className="tab-content-enter" key="tab-catalogo"><CatalogoTab /></div>}
```

- [ ] **Step 5: Verify — Catálogo tab works**

Open http://localhost:5000/estoque → tab Catálogo
- Table shows all insumos with categories, subcategories, usos, VLR/Uso
- Click subcategoria cell → inline edit
- Click usos cell → inline edit with min-max
- Search and filter work

- [ ] **Step 6: Commit**

```bash
git add src/app/estoque/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Catálogo tab with usage tracking and inline editing

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Subcategoria filters in Estoque tab

**Files:**
- Modify: `src/app/estoque/page.tsx:112-116` (CATEGORIAS constant), `437-438` (filter state), `663-671` (filter UI)

- [ ] **Step 1: Add SUBCATEGORIAS_MAP constant**

In `src/app/estoque/page.tsx`, after the CATEGORIAS constant (line ~116), add:

```tsx
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
```

- [ ] **Step 2: Add subcategoria filter state**

In the component state (line ~438), after `filtroCategoria`:

```tsx
// BEFORE
const [filtroCategoria, setFiltroCategoria] = useState('')
```

Change to:

```tsx
const [filtroCategoria, setFiltroCategoria] = useState('')
const [filtroSubcategoria, setFiltroSubcategoria] = useState('')
```

- [ ] **Step 3: Update filter UI to cascading dropdowns**

In the filter row (line ~663), replace the categoria select:

```tsx
// BEFORE
<select
  className="input"
  style={{ width: '180px' }}
  value={filtroCategoria}
  onChange={(e) => setFiltroCategoria(e.target.value)}
>
  <option value="">Todas categorias</option>
  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
</select>
```

Change to:

```tsx
<select
  className="input"
  style={{ width: '160px' }}
  value={filtroCategoria}
  onChange={(e) => { setFiltroCategoria(e.target.value); setFiltroSubcategoria('') }}
>
  <option value="">Todas categorias</option>
  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
</select>
{filtroCategoria && SUBCATEGORIAS_MAP[filtroCategoria] && (
  <select
    className="input"
    style={{ width: '150px' }}
    value={filtroSubcategoria}
    onChange={(e) => setFiltroSubcategoria(e.target.value)}
  >
    <option value="">Todas sub</option>
    {SUBCATEGORIAS_MAP[filtroCategoria].map((s) => <option key={s} value={s}>{s}</option>)}
  </select>
)}
```

- [ ] **Step 4: Update lotes filter to include subcategoria**

In the lotes filter logic (line ~696-703):

```tsx
// BEFORE
if (filtroCategoria && l.insumo.grupoCategoria !== filtroCategoria) return false
```

Change to:

```tsx
if (filtroCategoria && l.insumo.grupoCategoria !== filtroCategoria) return false
if (filtroSubcategoria && l.insumo.subcategoria !== filtroSubcategoria) return false
```

- [ ] **Step 5: Verify — cascading filter works**

Open http://localhost:5000/estoque
- Select "Endodontia" → subcategoria dropdown appears with: Limas Manuais, Limas Rotatórias, etc.
- Select "Limas Manuais" → only limas manuais shown
- Change group → subcategoria resets

- [ ] **Step 6: Commit**

```bash
git add src/app/estoque/page.tsx
git commit -m "$(cat <<'EOF'
feat: cascading category/subcategory filters in estoque tab

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update Insumos API to accept subcategoria

**Files:**
- Modify: `src/app/api/estoque/insumos/route.ts` (or wherever PUT handler is)

- [ ] **Step 1: Find and update the insumos PUT handler**

In the PUT handler for `/api/estoque/insumos/[id]`, ensure `subcategoria` is accepted in the update payload:

```tsx
// In the update data object, add:
subcategoria: body.subcategoria !== undefined ? body.subcategoria : undefined,
usosMin: body.usosMin !== undefined ? body.usosMin : undefined,
usosMax: body.usosMax !== undefined ? body.usosMax : undefined,
```

- [ ] **Step 2: Verify — edit subcategoria and usos from Catálogo tab**

Open http://localhost:5000/estoque → Catálogo
- Click a subcategoria cell → type "Limas Manuais" → press Enter
- Click usos cell → set 5-7 → press Enter
- Refresh page → values persist

- [ ] **Step 3: Commit**

```bash
git add src/app/api/estoque/insumos/
git commit -m "$(cat <<'EOF'
feat: accept subcategoria and usos fields in insumos API

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final CSS review + integration test

**Files:**
- Modify: `src/app/estoque/page.tsx` (any remaining CSS issues)

- [ ] **Step 1: Full CSS audit of estoque page**

Open http://localhost:5000/estoque and check ALL tabs:
- [ ] Estoque tab: no horizontal scroll, fonts 0.7rem, VLR/Uso column fits
- [ ] Lotes tab: no horizontal scroll
- [ ] Alertas tab: badges readable at smaller fonts
- [ ] Fornecedores tab: compact cards, accordion works
- [ ] Notas Fiscais tab: no horizontal scroll
- [ ] Catálogo tab: table fits, inline edits work

Fix any remaining issues found.

- [ ] **Step 2: Test NF-e import flow end-to-end**

1. Upload an XML NF-e with multiple products
2. Verify all products appear in confirmation screen with validade fields
3. Confirm validades
4. Check products appear in Estoque tab with correct VLR/Uso
5. Try uploading same NF-e again → duplicate modal should appear
6. Test "Manter Existente" and "Substituir" options

- [ ] **Step 3: Verify TypeScript strict mode**

```bash
cd "/workspaces/Projeto Dentist Management" && npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: CSS review and integration fixes for estoque v3

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | CSS: scroll + fonts | globals.css, page.tsx |
| 2 | Optimistic updates | page.tsx (BaixaModal, EntradaLoteModal, delete) |
| 3 | Schema: subcategoria | schema.prisma |
| 4 | AI: subcategoria prompts | ai-stock.ts, gemini-stock.ts, ai-providers.ts |
| 5 | NF-e duplicada | nfe/route.ts, NfeDuplicadaModal.tsx, NFeUploadModal.tsx |
| 6 | Fornecedores redesign | page.tsx (FornecedoresTab) |
| 7 | VLR/Uso column | page.tsx, lotes API |
| 8 | Catálogo tab | page.tsx (CatalogoTab) |
| 9 | Subcategoria filters | page.tsx (cascading dropdowns) |
| 10 | API: subcategoria/usos | insumos API |
| 11 | CSS review + integration | all files |
