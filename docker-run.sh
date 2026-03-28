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
  -v "/c/Users/lolil/.claude/.credentials.json:/home/dentflow/.claude/.credentials.json:ro" \
  -v "${WINPATH}/google-token.json:/app/google-token.json" \
  --env-file .env.local \
  -p 5000:5000 \
  --name dentflow-dev \
  --rm \
  dentflow-claude
