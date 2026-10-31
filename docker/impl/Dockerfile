# Sala limpa em container: só o handoff entra, nada do alvo ou do REA.
#
# Build:  docker build -t cleanroom-impl docker/impl
# Run:    ./docker/impl/run.sh <slug> [claude|codex|bash]
#
# A imagem NÃO instala REA, Ghidra, Hopper, JADX ou Frida — de propósito.

FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git ca-certificates curl ripgrep less jq \
 && rm -rf /var/lib/apt/lists/*

# Agentes (versões fixadas para builds reproduzíveis; atualize quando quiser)
ARG CLAUDE_CODE_VERSION=2.1.316
ARG CODEX_VERSION=0.166.0
RUN npm install --global \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      "@openai/codex@${CODEX_VERSION}" \
 && npm cache clean --force

# Usuário sem privilégios
RUN useradd --create-home --shell /bin/bash dev \
 && mkdir -p /work /handoff \
 && chown -R dev:dev /work
USER dev
WORKDIR /work

ENV HOME=/home/dev \
    NODE_ENV=development

CMD ["bash"]
