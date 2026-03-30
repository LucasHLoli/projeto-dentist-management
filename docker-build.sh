#!/bin/bash
set -e

echo "==> Construindo imagem dentflow-claude..."
docker build -t dentflow-claude .

echo ""
echo "✓ Imagem dentflow-claude construída com sucesso!"
echo "  Para rodar: bash docker-run.sh"
