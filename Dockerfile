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
