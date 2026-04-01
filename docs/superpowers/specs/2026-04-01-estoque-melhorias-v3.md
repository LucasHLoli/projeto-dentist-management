# Estoque Melhorias v3 — Design Spec

**Data:** 2026-04-01
**Autor:** Lucas + Claude
**Status:** Aprovado

---

## Contexto

O módulo de estoque (`src/app/estoque/page.tsx`, 1.666 linhas) foi entregue na v1/v2 com banco SQLite, FEFO, NF-e XML/PDF/imagem via Gemini, IA (Groq/Gemini) para classificação e alertas. Esta v3 foca em: UX profissional, latência, dados corretos de fornecedores, detecção de NF-e duplicada, custo real por uso e rastreabilidade por subcategoria.

---

## 1. UI/UX — Scroll horizontal + fontes + CSS

### Problema
- Scroll horizontal visível na página de estoque
- Fontes grandes demais para densidade de dados

### Solução
- `overflow-x: hidden` no container principal
- Tabelas: reduzir de `0.75rem` → `0.7rem`; headers: `0.85rem` → `0.8rem`
- Revisar `min-width` das colunas para caber sem overflow
- **Regra CSS global:** revisar todo CSS do estoque de ponta a ponta em cada entrega para evitar retrabalho

### Arquivos afetados
- `src/app/estoque/page.tsx` (inline styles)
- `src/app/globals.css` (se houver classes `.table-container`, `.glass-card`)

---

## 2. Optimistic Updates — Latência zero percebida

### Problema
Fluxo atual: clica +/- → abre modal → POST API → espera resposta → `fetchLotes()` inteiro → atualiza UI. Percepção de lentidão.

### Solução
- **Optimistic update:** ao confirmar no modal, atualizar `lotes[]` no estado local imediatamente
- **Eliminar `fetchLotes()` full reload** após cada ação — mutar apenas o item afetado no array
- **Rollback:** se API falhar, reverter estado e mostrar toast de erro
- **Toast instantâneo** no sucesso (sem esperar resposta)

### Fluxo novo
```
Clica + → Modal → Confirma → [UI atualiza instant] → [POST em background] → [Toast success/rollback]
```

### Arquivos afetados
- `src/app/estoque/page.tsx` — funções `onSaved` dos modais BaixaModal e EntradaLoteModal

---

## 3. Fornecedores — Redesign

### Problema
- "Total gasto: R$780" é `SUM(custoUnitario × quantidade)` dos lotes, não reflete pagamento real
- Com 1 lote, informação é confusa e enganosa
- Cards ocupam muito espaço com notas de avaliação sempre visíveis

### Solução

**Card compacto (estado padrão):**
```
IMPLANTE MAIS                                    [Avaliar ★]
CNPJ: 46584818000108 · 1 NF-e · 3 produtos
Último pedido: 15/03/2026 · Total NF-e: R$ 780,00
[Ver 3 produtos ▸]
```

**Mudanças:**
- **"Total gasto" → "Total NF-e"**: somar `valorTotal` das NFeImport do fornecedor (valor real da nota)
- **Contar NF-e e produtos** em vez de "lotes"
- **Mostrar data do último pedido** (MAX dataEmissao das NF-e)
- **Accordion de produtos**: "Ver N produtos →" expande lista com nome, qtd, valor unitário
- **Avaliação IA expandível**: clicar "Avaliar" expande o card com notas + narrativa; recolhe ao clicar de novo

### Dados necessários
- Fetch fornecedores via endpoint dedicado (não via lotes) — ou agregar no frontend:
  - `totalNfe`: COUNT de NFeImport por fornecedorId
  - `totalProdutos`: COUNT DISTINCT de insumoId nos lotes
  - `totalValorNfe`: SUM de NFeImport.valorTotal
  - `ultimoPedido`: MAX de NFeImport.dataEmissao
  - `produtos[]`: lista de { nome, qtd, valorUnitario }

### Arquivos afetados
- `src/app/estoque/page.tsx` — componente `FornecedoresTab` (linhas 1540-1665)

---

## 4. NF-e Duplicada — Detecção + Comparação lado a lado

### Problema
Se doutora importa a mesma NF-e duas vezes, cria lotes duplicados sem aviso.

### Detecção
- No `POST /api/estoque/nfe`, antes de criar registros:
  1. Checar `chaveAcesso` existente no banco
  2. Se encontrar: retornar `{ duplicada: true, existente: NFeResumoCompleto, nova: NFeDataParsed }` com status 409
  3. Frontend intercepta 409 e abre modal de comparação

### Modal de Comparação (`NfeDuplicadaModal`)
**Layout:** Duas colunas lado a lado

| | NF-e Existente | NF-e Nova |
|---|---|---|
| Número/Série | 12345/1 | 12345/1 |
| Data Emissão | 15/03/2026 | 15/03/2026 |
| Valor Total | R$ 780,00 | R$ 780,00 |
| Fornecedor | IMPLANTE MAIS | IMPLANTE MAIS |

**Tabela de itens com diff visual:**
- 🟢 Verde: item só na nova
- 🔴 Vermelho: item só na existente
- 🟡 Amarelo: item em ambas com valor/qtd diferente
- Sem cor: idêntico

**Ações:**
- **"Manter Existente"** → descarta upload, fecha modal
- **"Substituir pela Nova"** → `DELETE /api/estoque/nfe/:id` (marca lotes DESCARTADO) + reimporta
- **"Cancelar"** → volta ao modal de upload

### Novo componente
- `src/components/NfeDuplicadaModal.tsx`

### Arquivos afetados
- `src/app/api/estoque/nfe/route.ts` — POST handler: adicionar check de duplicata
- `src/components/NFeUploadModal.tsx` — interceptar resposta 409
- `src/components/NfeDuplicadaModal.tsx` — novo

---

## 5. NF-e Multi-produto — Polir UX + Teste

### Problema
Tela de confirmação pós-import é lista simples, difícil de usar com 5+ itens.

### Solução
- Melhorar tela de confirmação no `NFeUploadModal` para tabela clara:
  - Colunas: Produto | Match IA (%) | Qtd | Valor | Validade Extraída | Editar Validade
  - Badges de confiança: ≥85% verde, 50-84% amarelo, <50% vermelho
- Cada item com campo de validade editável inline (date picker)
- Botão "Confirmar Todos" salva validades em batch

### Teste
- Criar teste com XML de exemplo contendo 5+ produtos
- Validar: parser extrai todos → cada item vira Lote separado → validades independentes

### Arquivos afetados
- `src/components/NFeUploadModal.tsx` — fase de confirmação
- Novo: arquivo de teste (local a definir no plano)

---

## 6. Coluna VLR/Uso + Nova Aba "Catálogo"

### Conceito
Cada produto tem cadeia de conversão:
```
Compra → Unidades → Usos → VLR/Uso
CX luva (R$25) → 50 luvas → 50 usos (1/luva) → R$0,50/uso
CX resina (R$450) → 10 seringas → 100 usos (10/seringa) → R$4,50/uso
CX lima Protaper (R$321) → 6 limas → 36 usos (6/lima) → R$8,92/uso
```

### 6A — Nova coluna "VLR/Uso" na tab Estoque
- Posição: ao lado de "Vlr/item"
- Cálculo: `custoUnitario / ((usosMin + usosMax) / 2)`
- Se `usosMin === usosMax === 1` (default), VLR/Uso = VLR/item (sem duplicar visualmente — mostrar "—" ou omitir)
- Tooltip: "R$321,20 ÷ 6 usos = R$53,53/uso"

### 6B — Nova aba "Catálogo" (posição: após "Notas Fiscais")
Nova tab com tipo `'catalogo'` adicionada ao type `Tab`.

**Tabela:**
| Produto | Categoria | Subcategoria | Und. Compra | Fator Conv. | Usos/Un (min-max) | VLR/Uso médio | Ações |
|---|---|---|---|---|---|---|---|
| Luva Procedimento | Luvas/EPI | Luvas | CX | 50 | 1-1 | R$0,50 | ✏️ |
| Lima Protaper F1 | Endodontia | Limas Rotatórias | CX | 6 | 5-7 | R$8,92 | ✏️ |

**Edição inline:** Clicar em qualquer célula editável abre input. Salva via PUT `/api/estoque/insumos/:id`.

**IA auto-preenche:** Quando novo Insumo criado via NF-e:
1. IA classifica `grupoCategoria` + `subcategoria`
2. IA sugere `usosMin`, `usosMax` baseado no nome do produto
3. Sistema verifica se já existe Insumo similar com valores cadastrados → copia
4. Doutora confirma/ajusta — próxima vez, match automático

### Schema changes (Prisma)
```prisma
model Insumo {
  // campos existentes...
  subcategoria  String?   // NOVO — subcategoria dentro do grupo
}
```

Campos `usosMin`, `usosMax`, `unidadeUso`, `fatorConversao` já existem no schema.

### Arquivos afetados
- `prisma/schema.prisma` — adicionar `subcategoria` ao Insumo
- `src/app/estoque/page.tsx` — nova aba Catálogo, nova coluna VLR/Uso
- `src/app/api/estoque/insumos/route.ts` — aceitar subcategoria no PUT
- `src/lib/ai-stock.ts` + `src/lib/gemini-stock.ts` — classificação incluir subcategoria

---

## 7. Subcategorias Híbridas (Grupo + Sub) com IA

### Modelo
- **Grupo (obrigatório):** 13 categorias existentes mantidas
- **Subcategoria (opcional):** texto livre, sugerido pela IA

### Mapa inicial de subcategorias

| Grupo | Subcategorias |
|---|---|
| Endodontia | Limas Manuais, Limas Rotatórias, Cones, Seladores/Cimentos, Irrigação |
| Anestesia | Com Vasoconstritor, Sem Vasoconstritor, Tópica |
| Restauração | Resinas, Adesivos, Ácidos, Ionômeros, Acabamento |
| Luvas/EPI | Luvas, Sugadores, Lençol de Borracha |
| Limpeza/Esterilização | Pasta Profilática, Escovas, Pedra Pomes |
| Medicamentos | Anti-inflamatório, Curativo, Clareador |
| Exodontia | Fios de Sutura, Lâminas |
| Outros | Brocas, Microbrush, Tiras |

### Fluxo IA
1. NF-e importada → para cada item novo, IA retorna `{ grupoCategoria, subcategoria, confianca }`
2. Se confiança ≥ 0.85 → auto-aplica
3. Se < 0.85 → mostra sugestão para doutora confirmar
4. Subcategorias confirmadas ficam como referência para matches futuros

### Filtros na tab Estoque
- Filtro de categoria existente vira **dois dropdowns**: Grupo → Subcategoria (cascata)
- Subcategoria popula dinamicamente com base no grupo selecionado

### Arquivos afetados
- `src/app/estoque/page.tsx` — CATEGORIAS vira mapa com subcategorias, filtro cascata
- `src/lib/ai-stock.ts` — prompt de classificação retorna subcategoria
- `src/lib/gemini-stock.ts` — idem
- `src/components/NFeUploadModal.tsx` — mostrar subcategoria sugerida

---

## Regra CSS transversal

**Em toda entrega:**
- Verificar `overflow-x` no container
- Fontes consistentes: tabela `0.7rem`, badges `0.65rem`, headers `0.8rem`
- Sem `min-width` que estoure viewport
- Testar com sidebar aberta (viewport reduzido)
- Cores: usar CSS variables existentes (`var(--text-primary)`, `var(--accent-emerald)`, etc.)

---

## Fora de escopo
- Migração de banco (continua SQLite)
- Auth real (NextAuth/Clerk)
- Integração com atendimentos (consumo automático por procedimento — futuro)
- Export PDF do catálogo
