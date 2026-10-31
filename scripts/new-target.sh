#!/usr/bin/env bash
# Cria a estrutura de um alvo (jogo ou app) a ser analisado e reimplementado.
#
# Uso:
#   ./scripts/new-target.sh <slug> [--name "Nome do app"] [--version "1.2.3"]
#
# Exemplo:
#   ./scripts/new-target.sh meu-jogo --name "Meu Jogo" --version "1.0.0"
#   ./scripts/new-target.sh meu-app  --name "Meu App"  --version "2.1.0"
#
# O slug é o identificador usado por todos os outros comandos.

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

SLUG=""; NAME=""; VERSION="desconhecida"
while (($# > 0)); do
  case "$1" in
    --name) [[ $# -ge 2 ]] || die "--name exige um valor"; NAME="$2"; shift 2 ;;
    --version) [[ $# -ge 2 ]] || die "--version exige um valor"; VERSION="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "opção desconhecida: $1" ;;
    *) [[ -z "$SLUG" ]] || die "informe apenas um slug"; SLUG="$1"; shift ;;
  esac
done

[[ -n "$SLUG" ]] || die "uso: ./scripts/new-target.sh <slug> [--name ...] [--version ...]"
slug_ok "$SLUG" || die "slug inválido: use minúsculas, números e hífen (2 a 41 chars), ex.: meu-jogo"
[[ -n "$NAME" ]] || NAME="$SLUG"

dest="$ROOT/targets/$SLUG"
[[ -e "$dest" ]] && die "o alvo '$SLUG' já existe em targets/$SLUG"

info "Criando targets/$SLUG"
mkdir -p \
  "$dest/analysis/artifacts" \
  "$dest/analysis/evidence" \
  "$dest/analysis/spec/notes" \
  "$dest/analysis/golden" \
  "$dest/analysis/audit" \
  "$dest/analysis/requests" \
  "$dest/handoff"

subst() {
  sed -e "s|{{SLUG}}|$SLUG|g" \
      -e "s|{{NAME}}|$NAME|g" \
      -e "s|{{VERSION}}|$VERSION|g" \
      -e "s|{{DATE}}|$(date -u +%Y-%m-%d)|g" "$1"
}

subst "$ROOT/templates/target-README.md" >"$dest/README.md"
subst "$ROOT/templates/spec.md" >"$dest/analysis/spec/spec.md"
subst "$ROOT/templates/request.md" >"$dest/analysis/requests/000-exemplo.md"
subst "$ROOT/templates/golden.json" >"$dest/analysis/golden/golden.json"

cat >"$dest/analysis/audit/log.jsonl" <<EOF
{"at":"$(today_utc)","event":"target-created","slug":"$SLUG","name":"$NAME","version":"$VERSION","by":"$(git -C "$ROOT" config user.name 2>/dev/null || echo desconhecido)"}
EOF

# Marca arquivos grandes/pesados como ignorados localmente.
cat >"$dest/.gitignore" <<'EOF'
# Nada aqui deve ir para o Git: binários, evidências e handoffs são locais.
artifacts/
evidence/
handoff/
*.bundle.json
*.evidence.json
EOF

ok "Alvo criado: targets/$SLUG"
cat <<EOF

Próximos passos:
  1. Copie sua cópia legal do app/jogo para:
       targets/$SLUG/analysis/artifacts/
     (uma subpasta por build/versão ajuda: artifacts/$VERSION/)

  2. Registre os hashes do que você vai analisar:
       ./scripts/hash-artifacts.sh $SLUG

  3. Descubra o tipo do alvo (Unity, Godot, Electron, .NET, Android, nativo...):
       ./scripts/detect-target.sh $SLUG

  4. Abra a sala de análise e peça a investigação:
       cd rooms/analysis && claude
     ou:  cd rooms/analysis && codex

  5. Quando a spec estiver boa, feche o portão:
       node scripts/check-spec.mjs targets/$SLUG/analysis/spec/spec.md --strict
       ./scripts/handoff.sh $SLUG 0.1.0
EOF
