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
