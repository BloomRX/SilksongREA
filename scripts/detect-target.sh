#!/usr/bin/env bash
# Detecta o tipo do alvo a partir dos artefatos e recomenda a rota no REA.
#
# Uso:
#   ./scripts/detect-target.sh <slug> [--json]
#
# Examina targets/<slug>/analysis/artifacts sem executar nada.

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "uso: ./scripts/detect-target.sh <slug> [--json]"
[[ "$SLUG" == "--json" ]] && die "informe o slug: ./scripts/detect-target.sh <slug> [--json]"
shift || true

slug_ok "$SLUG" || die "slug inválido: $SLUG"

DIR="$ROOT/targets/$SLUG/analysis/artifacts"
[[ -d "$DIR" ]] || die "não existe $DIR (rode ./scripts/new-target.sh $SLUG e copie o alvo)"

exec node "$ROOT/scripts/detect-target.mjs" "$DIR" "$@"
