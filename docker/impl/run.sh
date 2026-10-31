#!/usr/bin/env bash
# Abre a sala limpa em container, com APENAS o handoff montado (somente leitura).
#
# Uso:
#   ./docker/impl/run.sh <slug> [claude|codex|bash]
#
# O que é montado:
#   targets/<slug>/handoff  -> /handoff   (somente leitura)
#   targets/<slug>/impl-src -> /work      (seu projeto, mesma árvore de antes)
#   ~/.claude-impl          -> /home/dev/.claude  (login do Claude Code)
#   ~/.codex-impl           -> /home/dev/.codex   (login do Codex)
#
# O que NÃO é montado: artifacts, evidence, spec de trabalho, snapshots, REA.
#
# Rede: o agente precisa de rede para falar com a API do modelo. Se você usa um
# modelo local/hospedado na própria máquina, veja --network=none no README.

source "$(cd "$(dirname "$0")/../.." && pwd)/scripts/lib/common.sh"

SLUG="${1:-}"
CMD="${2:-claude}"
[[ -n "$SLUG" ]] || die "uso: ./docker/impl/run.sh <slug> [claude|codex|bash]"
slug_ok "$SLUG" || die "slug inválido: $SLUG"

HANDOFF="$ROOT/targets/$SLUG/handoff"
[[ -d "$HANDOFF" ]] || die "não existe $HANDOFF (rode ./scripts/handoff.sh $SLUG <versão>)"
WORK="$ROOT/targets/$SLUG/impl-src"
mkdir -p "$WORK" "$HOME/.claude-impl" "$HOME/.codex-impl"

if ! docker image inspect cleanroom-impl >/dev/null 2>&1; then
  info "Construindo a imagem cleanroom-impl (uma vez)"
  docker build -t cleanroom-impl "$ROOT/docker/impl"
fi

case "$CMD" in
  claude|codex|bash) ;;
  *) die "comando inválido: $CMD (use claude, codex ou bash)" ;;
esac

info "Sala limpa: $SLUG · comando: $CMD"
dim "  /handoff = targets/$SLUG/handoff (ro) · /work = targets/$SLUG/impl-src"

exec docker run --rm -it \
  --name "cleanroom-impl-$SLUG" \
  -v "$HANDOFF:/handoff:ro" \
  -v "$WORK:/work" \
  -v "$HOME/.claude-impl:/home/dev/.claude" \
  -v "$HOME/.codex-impl:/home/dev/.codex" \
  cleanroom-impl "$CMD"
