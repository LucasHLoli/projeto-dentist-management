# Docker Claude Container — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um container Docker isolado que roda Claude Code Pro com `--dangerously-skip-permissions` + Next.js na porta 5000, sem tocar nos arquivos do Windows host.

**Architecture:** O `docker-build.sh` copia `~/.claude/` para `.claude-build/` (sem credenciais) como build context, constrói a imagem, e limpa. O `docker-run.sh` monta as credenciais como volumes em runtime e passa as env vars via `--env-file`. O entrypoint sobe o Next.js em background, aguarda o servidor, e abre o Claude Code.

**Tech Stack:** Docker, Node.js 20 (bullseye), Python 3, Claude Code CLI, Next.js 15, wait-on, Playwright browsers

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `.dockerignore` | Criar | Excluir segredos e lixo do build context |
| `docker-entrypoint.sh` | Criar | Inicializar Next.js + abrir Claude Code |
| `Dockerfile` | Criar | Definir imagem completa com todas as dependências |
| `docker-build.sh` | Criar | Preparar build context e construir imagem |
| `docker-run.sh` | Criar | Rodar container com volumes e env vars corretos |

---

## Task 1: .dockerignore

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Criar `.dockerignore`**

```
node_modules/
.next/
.env.local
google-token.json
.claude-build/
backups/
*.xlsx
.git/
docs/
```

- [ ] **Step 2: Verificar que o arquivo existe**

```bash
cat .dockerignore
```
Expected: conteúdo acima impresso

- [ ] **Step 3: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore for Docker container"
```

---

## Task 2: docker-entrypoint.sh

**Files:**
- Create: `docker-entrypoint.sh`

- [ ] **Step 1: Criar `docker-entrypoint.sh`**

```bash
#!/bin/bash
set -e

# package.json já tem "dev": "next dev -p 5000 -H 0.0.0.0" — porta garantida
echo "==> Iniciando Next.js em background..."
cd /app
npm run dev &
NEXT_PID=$!

echo "==> Aguardando Next.js ficar disponível na porta 5000..."
wait-on http://localhost:5000 --timeout 120000 --interval 2000 || {
  echo "ERRO: Next.js não subiu em 120 segundos"
  kill $NEXT_PID 2>/dev/null
  exit 1
}

echo "==> Next.js disponível. Iniciando Claude Code..."
exec claude --dangerously-skip-permissions
```

- [ ] **Step 2: Verificar sintaxe do script**

```bash
bash -n docker-entrypoint.sh && echo "Sintaxe OK"
```
Expected: `Sintaxe OK`

- [ ] **Step 3: Commit**

```bash
git add docker-entrypoint.sh
git commit -m "chore: add Docker entrypoint script"
```

---

## Task 3: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Criar `Dockerfile`**

```dockerfile
FROM node:20-bullseye

# Evita prompts interativos durante o apt
ENV DEBIAN_FRONTEND=noninteractive

# Dependências do sistema
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Dependências Python
RUN pip3 install pandas openpyxl

# Claude Code CLI + utilitários globais
RUN npm install -g \
    @anthropic-ai/claude-code \
    wait-on

# MCPs pré-instalados
RUN npm install -g \
    @upstash/context7-mcp \
    @playwright/mcp

# Browsers do Playwright (chromium apenas)
RUN npx playwright install --with-deps chromium

# Config do Claude Code (.claude-build copiado pelo docker-build.sh)
COPY .claude-build/ /root/.claude/

# Projeto
WORKDIR /app
COPY . .
RUN npm install

# Entrypoint
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
```

- [ ] **Step 2: Verificar que o Dockerfile não tem erros de sintaxe básicos**

```bash
docker build --check . 2>&1 | head -20
```
Expected: sem erros de sintaxe (pode mostrar warnings)

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: add Dockerfile for Claude Code container"
```

---

## Task 4: docker-build.sh

**Files:**
- Create: `docker-build.sh`

- [ ] **Step 1: Criar `docker-build.sh`**

```bash
#!/bin/bash
set -e

echo "==> Preparando build context do .claude..."

# Copia ~/.claude para build context, excluindo credenciais
cp -r ~/.claude .claude-build
rm -f .claude-build/.credentials.json  # Remove DENTRO de .claude-build, não na raiz

echo "==> Construindo imagem dentflow-claude..."
docker build -t dentflow-claude .

echo "==> Limpando build context temporário..."
rm -rf .claude-build

echo ""
echo "✓ Imagem dentflow-claude construída com sucesso!"
echo "  Para rodar: bash docker-run.sh"
```

- [ ] **Step 2: Verificar sintaxe**

```bash
bash -n docker-build.sh && echo "Sintaxe OK"
```
Expected: `Sintaxe OK`

- [ ] **Step 3: Commit**

```bash
git add docker-build.sh
git commit -m "chore: add docker-build script"
```

---

## Task 5: docker-run.sh

**Files:**
- Create: `docker-run.sh`

- [ ] **Step 1: Criar `docker-run.sh`**

```bash
#!/bin/bash
set -e

# Verifica que .env.local existe
if [ ! -f ".env.local" ]; then
  echo "ERRO: .env.local não encontrado. Crie o arquivo com as variáveis de ambiente."
  exit 1
fi

# Verifica que google-token.json existe
if [ ! -f "google-token.json" ]; then
  echo "AVISO: google-token.json não encontrado. Google Sheets não vai funcionar."
fi

# Verifica que a imagem existe
if ! docker image inspect dentflow-claude &>/dev/null; then
  echo "ERRO: Imagem dentflow-claude não encontrada. Rode: bash docker-build.sh"
  exit 1
fi

echo "==> Iniciando container DentFlow..."
echo "    Next.js estará disponível em: http://localhost:5000"
echo "    Claude Code abrirá automaticamente com --dangerously-skip-permissions"
echo ""

# pwd -W retorna path no formato Windows (C:/Users/...) que o Docker Desktop espera
WINPATH=$(pwd -W 2>/dev/null || pwd)

docker run -it \
  -v "/c/Users/lolil/.claude/.credentials.json:/root/.claude/.credentials.json:ro" \
  -v "${WINPATH}/google-token.json:/app/google-token.json" \
  --env-file .env.local \
  -p 5000:5000 \
  --name dentflow-dev \
  --rm \
  dentflow-claude
```

- [ ] **Step 2: Verificar sintaxe**

```bash
bash -n docker-run.sh && echo "Sintaxe OK"
```
Expected: `Sintaxe OK`

- [ ] **Step 3: Commit**

```bash
git add docker-run.sh
git commit -m "chore: add docker-run script"
```

---

## Task 6: Build e validação final

- [ ] **Step 1: Rodar o build**

```bash
bash docker-build.sh
```
Expected:
```
==> Preparando build context do .claude...
==> Construindo imagem dentflow-claude...
...
✓ Imagem dentflow-claude construída com sucesso!
```
⚠️ O build vai demorar na primeira vez (~5-10 min) — está baixando Node.js, Python, Claude Code, MCPs e browsers do Playwright.

- [ ] **Step 2: Verificar que a imagem foi criada**

```bash
docker image inspect dentflow-claude --format '{{.Id}} {{.Created}}'
```
Expected: hash da imagem + timestamp recente

- [ ] **Step 3: Rodar o container**

```bash
bash docker-run.sh
```
Expected:
```
==> Iniciando container DentFlow...
==> Iniciando Next.js em background...
==> Aguardando Next.js ficar disponível na porta 5000...
==> Next.js disponível. Iniciando Claude Code...
```
Seguido do prompt do Claude Code.

- [ ] **Step 4: Verificar Next.js no browser**

Abrir no browser do Windows: `http://localhost:5000`
Expected: Dashboard do DentFlow carrega normalmente

- [ ] **Step 5: Testar Claude Code dentro do container**

No prompt do Claude Code dentro do container, digitar:
```
liste os arquivos do projeto
```
Expected: Claude lista os arquivos sem pedir permissão

- [ ] **Step 6: Commit final**

```bash
git add .
git commit -m "chore: complete Docker container setup for Claude Code"
```
