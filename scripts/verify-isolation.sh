#!/usr/bin/env bash
# Confere se a separação entre as salas está de pé e se o handoff não foi alterado.
#
# Uso:
#   ./scripts/verify-isolation.sh [slug] [--quick]
#
# Verifica:
#   1. REA não está instalado/registrado no ambiente da sala limpa;
#   2. os hooks das duas salas existem e apontam para o guard;
#   3. hashes do handoff batem com o manifesto (nada foi editado depois);
#   4. não há atalho (symlink) ligando a sala limpa ao material de análise;
#   5. artefatos e handoffs não estão versionados no Git.
#
# Sai com código 1 se algo bloqueante falhar.

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

SLUG=""; QUICK=0
while (($# > 0)); do
  case "$1" in
    --quick) QUICK=1; shift ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "opção desconhecida: $1" ;;
    *) SLUG="$1"; shift ;;
  esac
done

fails=0; warns_n=0
fail() { printf '%sFALHA%s %s\n' "$C_RED" "$C_RESET" "$*"; fails=$((fails + 1)); }
pass() { printf '%s  ok %s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
note() { printf '%saviso%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; warns_n=$((warns_n + 1)); }

echo "${C_BOLD}Isolamento das salas${C_RESET}"
echo

# 1 ------------------------------------------------------------------- REA
if [[ $QUICK -eq 0 ]]; then
  if command -v rea >/dev/null 2>&1; then
    fail "o comando 'rea' está no PATH. Se esta é a máquina da sala limpa, remova-o (npm uninstall -g rea-agents) ou use um container/usuário separado."
  else
    pass "REA não está no PATH (bom para a sala limpa)"
  fi
  if command -v ghidra >/dev/null 2>&1 || command -v ghidraRun >/dev/null 2>&1; then
    note "há Ghidra no PATH; o isolamento real exige container/usuário separado (docs/00-metodo-clean-room.md)."
  fi
  if [[ -n "${CLAUDE_CONFIG_DIR:-}" || -n "${CODEX_HOME:-}" ]]; then
    pass "perfil de agente isolado em uso (CLAUDE_CONFIG_DIR/CODEX_HOME definido)"
  else
    note "sem CLAUDE_CONFIG_DIR/CODEX_HOME: as duas salas compartilham o perfil padrão do agente."
  fi
fi

# 2 ----------------------------------------------------------------- hooks
guard_present() {
  local f
  for f in "$ROOT/rooms/$1/.claude/settings.local.json" \
           "$ROOT/rooms/$1/.claude/settings.json" \
           "$ROOT/.claude/settings.local.json" \
           "$ROOT/.claude/settings.json"; do
    [[ -f "$f" ]] && grep -q "guard-impl.mjs" "$f" && return 0
  done
  return 1
}

for room in analysis impl; do
  if guard_present "$room"; then
    pass "guard ativo para a sala '$room'"
  else
    fail "sala '$room' sem hook do guard (rode ./scripts/bootstrap.sh)"
  fi
done

# 3 -------------------------------------------------------------- handoffs
shopt -s nullglob
handoffs=("$ROOT"/targets/${SLUG:-*}/handoff/v*/manifest.json)
if (( ${#handoffs[@]} == 0 )); then
  [[ -n "$SLUG" ]] && note "nenhum handoff encontrado para '$SLUG'"
else
  for m in "${handoffs[@]}"; do
    dir="$(dirname "$m")"
    slug_name="$(basename "$(dirname "$(dirname "$dir")")")"
    if out="$(node "$ROOT/scripts/verify-handoff.mjs" "$m")"; then
      pass "handoff íntegro: $slug_name/$(basename "$dir")"
    else
      fail "handoff adulterado ou incompleto: $slug_name/$(basename "$dir")"
      printf '%s\n' "$out" | sed 's/^/      /'
    fi
  done
fi
shopt -u nullglob

# 4 --------------------------------------------------------------- symlinks
bad_links="$(find "$ROOT/rooms/impl" -type l -print 2>/dev/null || true)"
if [[ -n "$bad_links" ]]; then
  fail "symlink dentro de rooms/impl (pode furar o isolamento):"; printf '%s\n' "$bad_links" | sed 's/^/      /'
else
  pass "nenhum symlink em rooms/impl"
fi

# 5 ------------------------------------------------------------------- git
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked="$(git -C "$ROOT" ls-files 'targets/*/analysis/artifacts/*' 'targets/*/analysis/evidence/*' 'targets/*/handoff/*' 2>/dev/null || true)"
  if [[ -n "$tracked" ]]; then
    fail "material sensível versionado no Git:"; printf '%s\n' "$tracked" | sed 's/^/      /'
  else
    pass "nenhum artefato/evidência/handoff versionado"
  fi
fi

echo
if (( fails == 0 )); then
  if (( warns_n == 0 )); then
    ok "isolamento OK"
  else
    ok "isolamento OK, com $warns_n aviso(s)"
  fi
  echo
  dim "Lembre: hooks e pastas são dissuasão organizacional. Para qualquer coisa"
  dim "comercial, use container/VM/usuário separado (docs/00-metodo-clean-room.md)."
  exit 0
else
  printf '%s%d problema(s) bloqueante(s).%s Veja docs/00-metodo-clean-room.md.\n' "$C_RED" "$fails" "$C_RESET"
  exit 1
fi
