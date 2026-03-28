#!/bin/bash
set -e

# Restaura .claude.json do backup se não existir
if [ ! -f "$HOME/.claude.json" ]; then
  BACKUP=$(ls "$HOME/.claude/backups/.claude.json.backup."* 2>/dev/null | sort | tail -1)
  if [ -n "$BACKUP" ]; then
    echo "==> Restaurando configuração Claude do backup..."
    cp "$BACKUP" "$HOME/.claude.json"
  fi
fi

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
