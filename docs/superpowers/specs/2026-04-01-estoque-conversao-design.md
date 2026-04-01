# Estoque — Conversão Embalagem → Unidade de Uso

**Data:** 2026-04-01  
**Status:** Aprovado

---

## Problema

O sistema registra estoque mas não distingue entre unidade de compra e unidade de uso.
Exemplo: a doutora compra 10 CX de luvas (50 luvas cada) → estoque deve ser 500 luvas, não 10.
Sem essa conversão, o saldo exibido não reflete a realidade do consumo.

O desconto por atendimento (usos por item) fica fora do escopo desta iteração — será tratado depois.

---

## Escopo desta iteração

1. Lote passa a registrar unidade de compra + fator de conversão
2. Estoque continua em unidades de uso (pós-conversão)
3. Formulário de entrada guia a doutora na conversão
4. Tela de estoque exibe: saldo em uso, info do lote de origem, validade mais próxima

---

## Modelo de dados

### Lote — 3 campos novos

| Campo | Tipo | Descrição |
|---|---|---|
| `unidadeCompra` | String? | Ex: "CX", "FR", "PCT", "UN" |
| `fatorConversao` | Float? | Quantas unidades de uso por embalagem. Ex: 50 |
| `quantidadeCompra` | Float? | Quantas embalagens entraram. Ex: 10 |

`quantidade` e `quantidadeAtual` continuam em **unidades de uso** (resultado da conversão).

### Insumo — 1 campo novo

| Campo | Tipo | Descrição |
|---|---|---|
| `unidadeUso` | String? | Label da unidade de uso. Ex: "luvas", "ml", "unid" |

> `usosMin` e `usosMax` (usos por item por atendimento) permanecem no schema mas fora da UI por ora.

---

## UX — Formulário de entrada (novo produto ou entrada em existente)

```
Produto:    [Luvas Latex M              ]
Categoria:  [Luvas          ] ← IA sugere, editável

Quantidade comprada:  [10]  unidade: [CX  ]
1 CX equivale a:      [50] [luvas   ]

→ Entrará no estoque: 500 luvas

Validade: [03/2027]   Custo unitário (opt): [R$ 0,00]
```

- Campos `unidadeCompra` e `fatorConversao` são opcionais — se não preenchidos, `quantidade = quantidadeCompra`
- Preview "Entrará no estoque: X unidades" atualiza em tempo real
- Categoria sugerida pela IA via `/api/estoque/ai/classificar` existente

---

## UX — Card na tela de estoque

```
┌─────────────────────────────────────────────────────┐
│ Luvas Latex M                        [Luvas]   [+]  │
│ 500 luvas  ·  último lote: 10 CX (50 cada)          │
│ Validade: 03/2027                                   │
│ ████████░░  mínimo: 100              ✅ OK           │
└─────────────────────────────────────────────────────┘
```

- **Validade** = a mais próxima entre os lotes ativos (FEFO)
- Ícone de status: ✅ ok / ⚠️ vencendo em < 6 meses / 🔴 vencido ou crítico
- Botão `[+]` abre formulário de entrada direto naquele produto
- Header da página tem botão `+ Novo Produto`

---

## Catálogo inicial

75 produtos fornecidos pela doutora com `usosMin` = `usosMax` (usos por item).
Serão populados via seed/migração com `unidadeUso` = "unid" por padrão.
A doutora ajusta conforme cadastra os primeiros lotes.

---

## Fora do escopo

- Desconto automático de estoque por atendimento (usos por item) — próxima iteração
- Múltiplas unidades por produto (CX50 vs CX100)
- Histórico de conversões por fornecedor
