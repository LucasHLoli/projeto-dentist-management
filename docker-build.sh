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
