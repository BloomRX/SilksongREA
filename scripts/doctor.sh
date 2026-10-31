#!/usr/bin/env bash
# Diagnóstico do kit: ambiente, REA, skills, hooks, handoffs e higiene.
#
# Uso:
#   ./scripts/doctor.sh [--deep]
#
# --deep também roda o doctor completo do REA (mais lento).

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

DEEP=0
while (($# > 0)); do
  case "$1" in
    --deep) DEEP=1; shift ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "opção desconhecida: $1" ;;
  esac
done

fails=0; warns=0
pass() { printf '%s  ok %s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
fail() { printf '%sFALHA%s %s\n' "$C_RED" "$C_RESET" "$*"; fails=$((fails + 1)); }
note() { printf '%saviso%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; warns=$((warns + 1)); }
section() { printf '\n%s%s%s\n' "$C_BOLD" "$*" "$C_RESET"; }

section "Ambiente"
if command -v node >/dev/null 2>&1; then
  if node_version_ok; then
    pass "Node.js $(node -v)"
  else
    fail "Node.js $(node -v) fora da faixa do REA (22.23.4+/24.22.1+/26.12.1+)"
  fi
else
  fail "Node.js não encontrado"
fi
command -v git >/dev/null 2>&1 && pass "git $(git --version | awk '{print $3}')" || note "git não encontrado (auditoria fica mais fraca)"
if [[ "$(uname -s)" == "Linux" ]]; then
  command -v ps >/dev/null 2>&1 && pass "ps disponível (exigido por Ghidra/JADX no Linux)" || fail "ps ausente: instale procps"
fi
if command -v docker >/dev/null 2>&1; then
  if docker image inspect cleanroom-impl >/dev/null 2>&1; then
    pass "imagem cleanroom-impl presente"
  else
    note "docker disponível, imagem cleanroom-impl ainda não construída (opcional)"
  fi
else
  note "docker ausente: isolamento L3 indisponível (use usuário/VM separado)"
fi

section "REA"
if command -v rea >/dev/null 2>&1; then
  pass "rea $(rea --version 2>/dev/null | head -1)"
  if [[ $DEEP -eq 1 ]]; then
    echo
    rea doctor || note "rea doctor reportou problemas (veja acima)"
  else
    dim "  use --deep para rodar o doctor completo do REA"
  fi
else
  fail "rea não está no PATH (npm install --global rea-agents@latest)"
fi

section "Skills do kit"
skill_ok=0
for f in \
  "$ROOT/.claude/skills/clean-room-orchestrator/SKILL.md" \
  "$ROOT/rooms/analysis/.claude/skills/clean-room-spec/SKILL.md" \
  "$ROOT/rooms/impl/.claude/skills/clean-room-impl/SKILL.md"; do
  if [[ -f "$f" ]] && grep -q '^name:' "$f"; then
    pass "${f#"$ROOT/"}"
    skill_ok=$((skill_ok + 1))
  else
    fail "skill ausente ou inválida: ${f#"$ROOT/"}"
  fi
done

section "Hooks das salas"
hook_files=(
  "$ROOT/.claude/settings.local.json"
  "$ROOT/rooms/analysis/.claude/settings.local.json"
  "$ROOT/rooms/impl/.claude/settings.local.json"
  "$ROOT/.claude/settings.json"
  "$ROOT/rooms/analysis/.claude/settings.json"
  "$ROOT/rooms/impl/.claude/settings.json"
)
found_hook=0
for f in "${hook_files[@]}"; do
  [[ -f "$f" ]] || continue
  if ! node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"))' "$f" 2>/dev/null; then
    fail "JSON inválido: ${f#"$ROOT/"}"
    continue
  fi
  if grep -q "guard-impl.mjs" "$f"; then
    found_hook=1
    # O comando pode usar $CLAUDE_PROJECT_DIR (settings versionado) ou caminho
    # absoluto (settings.local.json gerado). Resolve os dois e confere o arquivo.
    node -e '
      const fs = require("node:fs");
      const path = require("node:path");
      const [file] = process.argv.slice(1);
      const d = JSON.parse(fs.readFileSync(file, "utf8"));
      const cmd = d.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command || "";
      const m = cmd.match(/node "([^"]+)"/);
      if (!m) process.exit(2);
      const projectDir = path.dirname(path.dirname(file));
      const target = path.resolve(m[1].replace("$CLAUDE_PROJECT_DIR", projectDir));
      if (!fs.existsSync(target)) {
        console.error(target);
        process.exit(1);
      }
    ' "$f" || {
      rc=$?
      if (( rc == 1 )); then
        fail "hook aponta para caminho inexistente em ${f#"$ROOT/"} (rode ./scripts/bootstrap.sh --skip-rea --yes)"
      fi
    }
  fi
done
(( found_hook == 1 )) && pass "guard referenciado em pelo menos um settings" || fail "nenhum settings com o guard (rode ./scripts/bootstrap.sh)"

section "Alvos e handoffs"
if [[ -d "$ROOT/targets" ]]; then
  targets=$(find "$ROOT/targets" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
  (( targets == 0 )) && note "nenhum alvo criado ainda" || pass "$targets alvo(s) em targets/"
  shopt -s nullglob
  for m in "$ROOT"/targets/*/handoff/v*/manifest.json; do
    if out="$(node "$ROOT/scripts/verify-handoff.mjs" "$m")"; then
      pass "handoff íntegro: ${m#"$ROOT/targets/"}"
    else
      fail "handoff adulterado/incompleto: ${m#"$ROOT/targets/"}"
      printf '%s\n' "$out" | sed 's/^/      /'
    fi
  done
  shopt -u nullglob
else
  note "pasta targets/ não existe (rode ./scripts/bootstrap.sh --skip-rea)"
fi

section "Higiene"
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked="$(git -C "$ROOT" ls-files 'targets/*/analysis/artifacts/*' 'targets/*/analysis/evidence/*' 'targets/*/handoff/*' 2>/dev/null || true)"
  [[ -z "$tracked" ]] && pass "nenhum artefato/evidência/handoff versionado" || fail "material sensível no Git (git rm --cached)"
  links="$(find "$ROOT/rooms/impl" -type l -print 2>/dev/null || true)"
  [[ -z "$links" ]] && pass "nenhum symlink em rooms/impl" || fail "symlink em rooms/impl fura o isolamento"
else
  note "não é um repositório Git: auditoria de higiene limitada"
fi

echo
if (( fails == 0 )); then
  if (( warns == 0 )); then ok "tudo certo"; else ok "tudo certo, com $warns aviso(s)"; fi
  exit 0
else
  printf '%s%d falha(s), %d aviso(s).%s Veja docs/07-solucao-de-problemas.md.\n' "$C_RED" "$fails" "$warns" "$C_RESET"
  exit 1
fi
