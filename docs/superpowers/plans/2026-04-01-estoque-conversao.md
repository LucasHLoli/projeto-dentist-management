# Estoque — Conversão Embalagem → Unidade de Uso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o sistema registrar estoque em unidades de uso, com conversão de embalagem definida pela doutora no momento da entrada.

**Architecture:** Adicionar 3 campos ao modelo `Lote` (unidadeCompra, fatorConversao, quantidadeCompra) e 1 ao `Insumo` (unidadeUso). O backend calcula `quantidade = quantidadeCompra * fatorConversao` antes de salvar. A UI exibe o resultado e mostra as informações de lote+validade nos cards de estoque. Um modal `EntradaLoteModal` é adicionado para entrada manual por produto.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma 7 + SQLite, Zod 4, React 18

---

## File Map

| Arquivo | O que muda |
|---|---|
| `prisma/schema.prisma` | +3 campos em `Lote`, +1 em `Insumo` |
| `src/app/api/estoque/lotes/route.ts` | Schema Zod + cálculo da conversão no POST |
| `src/app/api/estoque/insumos/route.ts` | +`unidadeUso` no CreateInsumoSchema |
| `src/app/api/estoque/insumos/[id]/route.ts` | +`unidadeUso` no UpdateInsumoSchema |
| `src/app/estoque/page.tsx` | Types atualizados, cards com info lote+validade, `EntradaLoteModal`, botão `[+]` por insumo |

---

## Task 1: Migração do schema Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao schema**

Em `prisma/schema.prisma`, localizar o model `Lote` e adicionar após `codigoLote`:

```prisma
  unidadeCompra    String?
  fatorConversao   Float?
  quantidadeCompra Float?
```

E no model `Insumo`, adicionar após `unidadeMedida`:

```prisma
  unidadeUso      String?
```

O model `Lote` completo fica:

```prisma
model Lote {
  id                  Int          @id @default(autoincrement())
  insumoId            Int
  insumo              Insumo       @relation(fields: [insumoId], references: [id])
  nfeImportId         Int?
  nfeImport           NFeImport?   @relation(fields: [nfeImportId], references: [id])
  fornecedorId        Int?
  fornecedor          Fornecedor?  @relation(fields: [fornecedorId], references: [id])
  codigoLote          String?
  unidadeCompra       String?
  fatorConversao      Float?
  quantidadeCompra    Float?
  quantidade          Float
  quantidadeAtual     Float
  custoUnitario       Float?
  validade            DateTime?
  validadeConfirmada  Boolean      @default(false)
  status              String       @default("ATIVO")
  fotoNotaUrl         String?
  aiMatchConfianca    Float?
  createdAt           DateTime     @default(now())
  consumos            ConsumoInsumo[]
  contagemItens       ContagemItem[]
}
```

- [ ] **Step 2: Rodar migração**

```bash
npx prisma migrate dev --name add-conversao-lote
```

Saída esperada: `✔ Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerar cliente Prisma**

```bash
npx prisma generate
```

Saída esperada: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add conversao embalagem campos to Lote + unidadeUso to Insumo"
```

---

## Task 2: Atualizar API de lotes (POST com conversão)

**Files:**
- Modify: `src/app/api/estoque/lotes/route.ts`

- [ ] **Step 1: Atualizar o schema Zod e o handler POST**

Substituir o conteúdo de `src/app/api/estoque/lotes/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const CreateLoteSchema = z.object({
  insumoId: z.number().int().positive(),
  fornecedorId: z.number().int().positive().optional(),
  codigoLote: z.string().optional(),
  // Campos de conversão (opcionais)
  unidadeCompra: z.string().optional(),      // ex: "CX"
  fatorConversao: z.number().positive().optional(), // ex: 50 (1 CX = 50 unidades)
  quantidadeCompra: z.number().positive().optional(), // ex: 10 (10 CX)
  // quantidade em unidades de uso — calculado automaticamente se fator informado
  quantidade: z.number().positive().optional(),
  custoUnitario: z.number().nonnegative().optional(),
  validade: z.string().optional(),
  validadeConfirmada: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const insumoId = searchParams.get('insumoId')
    const status = searchParams.get('status') ?? 'ATIVO'
    const fefo = searchParams.get('fefo') === 'true'

    const where: Record<string, unknown> = { status }
    if (insumoId) where.insumoId = Number(insumoId)

    const lotes = await db.lote.findMany({
      where,
      orderBy: fefo ? [{ validade: 'asc' }, { createdAt: 'asc' }] : { createdAt: 'desc' },
      include: { insumo: true, fornecedor: true, nfeImport: true },
    })

    return NextResponse.json(lotes)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro ao buscar lotes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = CreateLoteSchema.parse(body)

    // Calcular quantidade em unidades de uso
    let quantidadeUso: number
    if (data.fatorConversao && data.quantidadeCompra) {
      quantidadeUso = data.quantidadeCompra * data.fatorConversao
    } else if (data.quantidade) {
      quantidadeUso = data.quantidade
    } else {
      return NextResponse.json(
        { error: 'Informe quantidade ou (quantidadeCompra + fatorConversao)' },
        { status: 400 }
      )
    }

    const lote = await db.lote.create({
      data: {
        insumoId: data.insumoId,
        fornecedorId: data.fornecedorId,
        codigoLote: data.codigoLote,
        unidadeCompra: data.unidadeCompra,
        fatorConversao: data.fatorConversao,
        quantidadeCompra: data.quantidadeCompra,
        quantidade: quantidadeUso,
        quantidadeAtual: quantidadeUso,
        custoUnitario: data.custoUnitario,
        validade: data.validade ? new Date(data.validade) : undefined,
        validadeConfirmada: data.validadeConfirmada,
        status: 'ATIVO',
      },
      include: { insumo: true, fornecedor: true },
    })
    return NextResponse.json(lote, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Erro ao criar lote' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar que o servidor compila sem erros**

```bash
curl -s http://localhost:5000/api/estoque/lotes | head -c 100
```

Saída esperada: JSON com array de lotes (ou `[]`)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/estoque/lotes/route.ts
git commit -m "feat: lotes POST calcula quantidade via fatorConversao * quantidadeCompra"
```

---

## Task 3: Atualizar APIs de insumos (unidadeUso)

**Files:**
- Modify: `src/app/api/estoque/insumos/route.ts`
- Modify: `src/app/api/estoque/insumos/[id]/route.ts`

- [ ] **Step 1: Adicionar `unidadeUso` ao CreateInsumoSchema**

Em `src/app/api/estoque/insumos/route.ts`, substituir o schema:

```typescript
const CreateInsumoSchema = z.object({
  nome: z.string().min(1),
  unidadeMedida: z.string().default('UN'),
  unidadeUso: z.string().optional(),         // ex: "luvas", "ml", "unid"
  usosMin: z.number().positive().default(1),
  usosMax: z.number().positive().default(1),
  grupoCategoria: z.string().optional(),
  estoqueMinimo: z.number().nonnegative().default(5),
})
```

- [ ] **Step 2: Adicionar `unidadeUso` ao UpdateInsumoSchema**

Em `src/app/api/estoque/insumos/[id]/route.ts`, substituir o schema:

```typescript
const UpdateInsumoSchema = z.object({
  nome: z.string().min(1).optional(),
  unidadeMedida: z.string().optional(),
  unidadeUso: z.string().nullable().optional(),
  usosMin: z.number().positive().optional(),
  usosMax: z.number().positive().optional(),
  grupoCategoria: z.string().nullable().optional(),
  estoqueMinimo: z.number().nonnegative().optional(),
  fotoUrl: z.string().nullable().optional(),
})
```

- [ ] **Step 3: Verificar compilação**

```bash
curl -s http://localhost:5000/api/estoque/insumos | head -c 200
```

Saída esperada: JSON com array de insumos

- [ ] **Step 4: Commit**

```bash
git add src/app/api/estoque/insumos/route.ts src/app/api/estoque/insumos/\[id\]/route.ts
git commit -m "feat: insumos API aceita campo unidadeUso"
```

---

## Task 4: Atualizar types e cards na tela de estoque

**Files:**
- Modify: `src/app/estoque/page.tsx` (linhas 11–35 — interfaces)

- [ ] **Step 1: Atualizar as interfaces TypeScript no topo do arquivo**

Substituir as interfaces `InsumoResumo` e `LoteResumo` (linhas 13–35):

```typescript
interface InsumoResumo {
  id: number
  nome: string
  unidadeMedida: string
  unidadeUso: string | null
  grupoCategoria: string | null
  fotoUrl: string | null
  estoqueTotal: number
  estoqueMinimo: number
  critico: boolean
  proximoVencer: string | null
  lotes: LoteResumo[]
}

interface LoteResumo {
  id: number
  quantidade: number
  quantidadeAtual: number
  unidadeCompra: string | null
  fatorConversao: number | null
  quantidadeCompra: number | null
  validade: string | null
  validadeConfirmada: boolean
  status: string
  custoUnitario: number | null
  codigoLote: string | null
}
```

- [ ] **Step 2: Atualizar coluna "Estoque" e adicionar coluna "Lote/Origem" na tabela**

Localizar o `<thead>` da tab estoque (linha ~342) e substituir:

```tsx
<thead>
  <tr>
    <th>Insumo</th>
    <th>Categoria</th>
    <th style={{ textAlign: 'center' }}>Estoque</th>
    <th>Último Lote</th>
    <th>Validade</th>
    <th>Nível</th>
    <th></th>
  </tr>
</thead>
```

- [ ] **Step 3: Atualizar as linhas da tabela para mostrar lote + validade + botão `[+]`**

Localizar o `return (` dentro do `.map((insumo) => {` (linha ~359) e substituir o `<tr>` completo:

```tsx
return (
  <tr key={insumo.id}>
    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
      {insumo.fotoUrl && (
        <img
          src={insumo.fotoUrl}
          alt=""
          style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }}
        />
      )}
      {insumo.nome}
      {insumo.critico && (
        <AlertTriangle size={12} style={{ color: 'var(--accent-rose)', marginLeft: 6, verticalAlign: 'middle' }} />
      )}
    </td>
    <td>
      {insumo.grupoCategoria ? (
        <span className="badge badge-teal">{insumo.grupoCategoria}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      )}
    </td>
    <td style={{ textAlign: 'center' }}>
      <span style={{ fontWeight: 600 }}>{insumo.estoqueTotal}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        {' '}{insumo.unidadeUso ?? insumo.unidadeMedida}
      </span>
    </td>
    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
      {(() => {
        const ultimo = insumo.lotes[insumo.lotes.length - 1]
        if (!ultimo) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        if (ultimo.unidadeCompra && ultimo.fatorConversao && ultimo.quantidadeCompra) {
          return (
            <span>
              {ultimo.quantidadeCompra} {ultimo.unidadeCompra}
              <span style={{ color: 'var(--text-muted)' }}> ({ultimo.fatorConversao} cada)</span>
            </span>
          )
        }
        return <span>{ultimo.quantidade} {insumo.unidadeUso ?? insumo.unidadeMedida}</span>
      })()}
    </td>
    <td>
      {badgeValidade(
        insumo.proximoVencer,
        insumo.lotes[0]?.validadeConfirmada ?? false
      )}
    </td>
    <td>
      <div className="progress-bar" style={{ width: '80px' }}>
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%`, background: cor }}
        />
      </div>
    </td>
    <td>
      <button
        className="btn btn-secondary"
        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
        onClick={() => setEntradaInsumoId(insumo.id)}
        title="Registrar entrada"
      >
        <Plus size={12} />
      </button>
    </td>
  </tr>
)
```

- [ ] **Step 4: Adicionar estado `entradaInsumoId` no componente principal**

Localizar o bloco de `useState` (linha ~114) e adicionar após `showNovoInsumoModal`:

```typescript
const [entradaInsumoId, setEntradaInsumoId] = useState<number | null>(null)
```

- [ ] **Step 5: Verificar que a tela compila — abrir http://localhost:5000/estoque**

Deve exibir a tabela com as novas colunas "Último Lote" e "Validade" e botão `+` em cada linha.

- [ ] **Step 6: Commit**

```bash
git add src/app/estoque/page.tsx
git commit -m "feat: tabela de estoque exibe lote de origem, validade e botão de entrada"
```

---

## Task 5: Modal de entrada de lote (EntradaLoteModal)

**Files:**
- Modify: `src/app/estoque/page.tsx` — adicionar componente `EntradaLoteModal` antes do `export default`

- [ ] **Step 1: Adicionar interface e componente `EntradaLoteModal`**

Inserir antes do `export default function EstoquePage()`:

```typescript
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
  insumos: InsumoResumo[]
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
  const preview = qtdCompra > 0 && fator > 0
    ? qtdCompra * fator
    : qtdCompra > 0
    ? qtdCompra
    : 0
  const unidadeLabel = form.unidadeUso || insumo?.unidadeMedida || 'unid'

  async function salvar() {
    if (!form.quantidadeCompra || parseFloat(form.quantidadeCompra) <= 0) {
      setErro('Informe a quantidade comprada')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const payload: Record<string, unknown> = {
        insumoId,
        quantidadeCompra: parseFloat(form.quantidadeCompra),
      }
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

      // Salvar unidadeUso no insumo se informada e diferente
      if (form.unidadeUso && form.unidadeUso !== insumo?.unidadeUso) {
        await fetch(`/api/estoque/insumos/${insumoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unidadeUso: form.unidadeUso }),
        })
      }

      onSaved()
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card" style={{ width: 420, padding: '24px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Entrada de Estoque</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
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
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Qtd comprada *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.quantidadeCompra}
                onChange={(e) => setForm((f) => ({ ...f, quantidadeCompra: e.target.value }))}
                placeholder="ex: 10"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Unidade de compra
              </label>
              <input
                type="text"
                className="form-input"
                value={form.unidadeCompra}
                onChange={(e) => setForm((f) => ({ ...f, unidadeCompra: e.target.value }))}
                placeholder="ex: CX, FR, PCT"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                1 {form.unidadeCompra || 'unid'} equivale a
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.fatorConversao}
                onChange={(e) => setForm((f) => ({ ...f, fatorConversao: e.target.value }))}
                placeholder="ex: 50"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Unidade de uso
              </label>
              <input
                type="text"
                className="form-input"
                value={form.unidadeUso}
                onChange={(e) => setForm((f) => ({ ...f, unidadeUso: e.target.value }))}
                placeholder="ex: luvas, ml, unid"
              />
            </div>
          </div>

          {preview > 0 && (
            <div style={{
              padding: '10px 14px', background: 'var(--accent-teal-muted, rgba(20,184,166,0.1))',
              borderRadius: '6px', fontSize: '0.85rem', color: 'var(--accent-teal)',
              borderLeft: '3px solid var(--accent-teal)',
            }}>
              → Entrará no estoque: <strong>{preview} {unidadeLabel}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Validade
              </label>
              <input
                type="month"
                className="form-input"
                value={form.validade}
                onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value ? e.target.value + '-01' : '' }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Custo unitário (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.custoUnitario}
                onChange={(e) => setForm((f) => ({ ...f, custoUnitario: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>

          {erro && (
            <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', padding: '6px 10px', background: 'rgba(244,63,94,0.1)', borderRadius: 4 }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Registrar Entrada'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Renderizar `EntradaLoteModal` no JSX do `EstoquePage`**

No `return (` do `EstoquePage`, antes do último `</div>` de fechamento, adicionar:

```tsx
{entradaInsumoId !== null && (
  <EntradaLoteModal
    insumoId={entradaInsumoId}
    insumos={insumos}
    onClose={() => setEntradaInsumoId(null)}
    onSaved={fetchInsumos}
  />
)}
```

- [ ] **Step 3: Testar o fluxo manualmente**

1. Abrir http://localhost:5000/estoque
2. Clicar no botão `+` ao lado de qualquer insumo existente
3. Preencher: Qtd = 10, Unidade = CX, Fator = 50, Unidade de uso = luvas
4. Verificar que aparece "→ Entrará no estoque: 500 luvas"
5. Clicar "Registrar Entrada"
6. Verificar que o estoque atualiza na tabela com o novo saldo

- [ ] **Step 4: Commit**

```bash
git add src/app/estoque/page.tsx
git commit -m "feat: EntradaLoteModal com conversão embalagem→uso e preview em tempo real"
```

---

## Task 6: Atualizar modal "Novo Insumo" para incluir unidadeUso

**Files:**
- Modify: `src/app/estoque/page.tsx` — modal `showNovoInsumoModal`

- [ ] **Step 1: Adicionar `unidadeUso` ao estado `novoInsumo`**

Localizar (linha ~123):
```typescript
const [novoInsumo, setNovoInsumo] = useState({ nome: '', unidadeMedida: 'UN', grupoCategoria: '', estoqueMinimo: 5 })
```

Substituir por:
```typescript
const [novoInsumo, setNovoInsumo] = useState({ nome: '', unidadeMedida: 'UN', unidadeUso: '', grupoCategoria: '', estoqueMinimo: 5 })
```

- [ ] **Step 2: Adicionar campo `unidadeUso` no formulário do modal "Novo Insumo"**

Localizar o modal de `showNovoInsumoModal` no JSX (procurar por `showNovoInsumoModal &&`). Após o campo de `unidadeMedida`, inserir:

```tsx
<div style={{ marginBottom: '12px' }}>
  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
    Unidade de uso (ex: luvas, ml, unid)
  </label>
  <input
    type="text"
    className="form-input"
    value={novoInsumo.unidadeUso}
    onChange={(e) => setNovoInsumo((n) => ({ ...n, unidadeUso: e.target.value }))}
    placeholder="ex: luvas"
    style={{ width: '100%' }}
  />
</div>
```

- [ ] **Step 3: Resetar `unidadeUso` ao fechar o modal**

Localizar onde `setNovoInsumo` reseta após salvar (linha ~217):
```typescript
setNovoInsumo({ nome: '', unidadeMedida: 'UN', grupoCategoria: '', estoqueMinimo: 5 })
```
Substituir por:
```typescript
setNovoInsumo({ nome: '', unidadeMedida: 'UN', unidadeUso: '', grupoCategoria: '', estoqueMinimo: 5 })
```

- [ ] **Step 4: Verificar criação de insumo com unidadeUso**

1. Abrir http://localhost:5000/estoque
2. Clicar "Novo Insumo"
3. Preencher nome "Teste", unidade de uso "unid"
4. Salvar e verificar que o insumo aparece na lista

- [ ] **Step 5: Commit final**

```bash
git add src/app/estoque/page.tsx
git commit -m "feat: modal novo insumo inclui campo unidadeUso"
```
