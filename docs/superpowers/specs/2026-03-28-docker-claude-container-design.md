# Design Spec — DentFlow Claude Container

**Data:** 2026-03-28
**Status:** Aprovado

---

## Objetivo

Containerizar o projeto DentFlow com Claude Code Pro rodando em modo `--dangerously-skip-permissions`, isolando completamente o ambiente do sistema Windows do usuário. O Next.js também roda dentro do container, acessível pelo browser do host na porta 5000.

---

## Contexto

- Claude Code Pro (OAuth via claude.ai — credenciais em `~/.claude/.credentials.json`)
- Plugins: Superpowers v5.0.5, GSD v1.30.0, context7, playwright, github, commit-commands, feature-dev, code-review, frontend-design, security-guidance, pr-review-toolkit
- Stack: Next.js 15 + TypeScript + Python 3 (pandas)
- Windows 11 + Docker Desktop + Git Bash

---

## Problema: COPY de ~/.claude/ no Dockerfile

O Dockerfile não consegue referenciar `~/.claude/` do host diretamente (fora do build context). Solução: `docker-build.sh` copia o diretório para `.claude-build/` dentro do projeto antes do build e limpa depois.

---

## Arquitetura

```
[docker-build.sh]
  1. Copia ~/.claude/ → .claude-build/ (sem .credentials.json)
  2. docker build -t dentflow-claude .
  3. Remove .claude-build/

[docker-run.sh]
docker run -it \
  -v "/c/Users/lolil/.claude/.credentials.json:/root/.claude/.credentials.json:ro" \
  -v "/c/Users/lolil/Downloads/Projeto Dentist Management/google-token.json:/app/google-token.json" \
  --env-file .env.local \
  -p 5000:5000 \
  dentflow-claude

         ▼
  ┌─────────────────────────────────────────┐
  │  Container (isolado do Windows)         │
  │                                         │
  │  /root/.claude/  (baked no image)       │
  │    settings.json, plugins/, commands/   │
  │    agents/, hooks/                      │
  │    .credentials.json  ← volume :ro      │
  │                                         │
  │  /app/  (cópia do projeto)              │
  │    google-token.json  ← volume          │
  │    next dev :5000  (background)         │
  │    claude --dangerously-skip-permissions│
  └─────────────────────────────────────────┘
         │ porta 5000
  Browser Windows → localhost:5000
```

---

## Arquivos a criar

### `Dockerfile`
- Base: `node:20-bullseye`
- Instala: Python 3, pip, pandas, openpyxl, git, curl
- `npm install -g @anthropic-ai/claude-code wait-on`
- Pré-instala MCPs globalmente: `npm install -g @upstash/context7-mcp @playwright/mcp`
- Instala browsers: `npx playwright install --with-deps chromium`
- `COPY .claude-build/ /root/.claude/`
- `COPY . /app/` + `RUN npm install`
- `EXPOSE 5000`
- `ENTRYPOINT ["/entrypoint.sh"]`

### `docker-entrypoint.sh`
```bash
#!/bin/bash
# 1. Sobe Next.js em background
npm run dev &

# 2. Aguarda servidor (sem depender de download externo)
npx wait-on http://localhost:5000 --timeout 60000

# 3. Abre Claude Code
exec claude --dangerously-skip-permissions
```

### `docker-build.sh` (Git Bash)
```bash
#!/bin/bash
# Copia ~/.claude sem .credentials.json para o build context
cp -r ~/.claude .claude-build
rm -f .claude-build/.credentials.json

docker build -t dentflow-claude .

# Limpa
rm -rf .claude-build
```

### `docker-run.sh` (Git Bash — paths no formato Unix)
```bash
#!/bin/bash
docker run -it \
  -v "/c/Users/lolil/.claude/.credentials.json:/root/.claude/.credentials.json:ro" \
  -v "$(pwd)/google-token.json:/app/google-token.json" \
  --env-file .env.local \
  -p 5000:5000 \
  dentflow-claude
```

### `.dockerignore`
```
node_modules/
.next/
.env.local
google-token.json
.claude-build/
backups/
*.xlsx
.git/
```

---

## Fluxo de uso

```bash
# 1. Build (uma vez ou ao atualizar plugins)
bash docker-build.sh

# 2. Rodar (requer Git Bash no Windows)
bash docker-run.sh

# Dentro do container:
# - Next.js rodando em localhost:5000 (acessível no browser Windows)
# - Claude Code ativo com --dangerously-skip-permissions
```

---

## Segurança

| Risco | Mitigação |
|---|---|
| Claude danifica arquivos do Windows | Projeto copiado — host intocável |
| Credenciais Pro expostas na imagem | Montadas `:ro` em runtime, nunca no build |
| `.env.local` no image | Excluído via `.dockerignore`, passado via `--env-file` |
| `google-token.json` no image | Excluído via `.dockerignore`, montado como volume |
| `.claude-build/` no image com credenciais | `.credentials.json` removido antes do COPY |

---

## Variáveis de ambiente (runtime via --env-file .env.local)

```
GROQ_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_SPREADSHEET_ID=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/callback
```

---

## Fora de escopo

- Push da imagem para registry público
- Multi-stage build
- Autenticação multi-usuário
