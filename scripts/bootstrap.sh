#!/usr/bin/env bash
# Prepara a máquina para o fluxo de clean room:
#   1. confere Node.js;
#   2. instala/atualiza o REA (pacote global durável);
#   3. registra o MCP do REA no Claude Code e/ou Codex (com dry-run antes);
#   4. cria as pastas de trabalho e instala o guard da sala limpa;
#   5. roda um doctor e mostra os próximos passos.
#
# Uso:
#   ./scripts/bootstrap.sh                          # pergunta os clientes
#   ./scripts/bootstrap.sh --clients claude_code,codex
#   ./scripts/bootstrap.sh --claude                 # só Claude Code
#   ./scripts/bootstrap.sh --codex --yes            # só Codex, sem prompts
#   ./scripts/bootstrap.sh --skip-rea               # só as pastas/guards
#   ./scripts/bootstrap.sh --provider ghidra        # provedor de binário nativo
#   ./scripts/bootstrap.sh --dry-run                # mostra o plano, não escreve

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

CLIENTS=""
ASSUME_YES=0
SKIP_REA=0
DRY_RUN=0
PROVIDER=""
TOOL_FAMILIES=""

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Opções extras:
  --provider <ghidra|hopper|ida|kuna|none>   só diagnostica o provedor nativo (doctor)
  --tool-families <a,b,c>                    limita famílias de ferramentas do MCP
  --no-global                                não instala global; usa npx
EOF
}

add_client() {
  local c="$1"
  case ",$CLIENTS," in
    *",$c,"*) ;;
    *) CLIENTS="${CLIENTS:+$CLIENTS,}$c" ;;
  esac
}

while (($# > 0)); do
  case "$1" in
    --clients) [[ $# -ge 2 ]] || die "--clients exige uma lista"; IFS=',' read -r -a _cs <<<"$2"; for c in "${_cs[@]}"; do add_client "$c"; done; shift 2 ;;
    --claude) add_client claude_code; shift ;;
    --codex) add_client codex; shift ;;
    --provider) [[ $# -ge 2 ]] || die "--provider exige um valor"; PROVIDER="$2"; shift 2 ;;
    --tool-families) [[ $# -ge 2 ]] || die "--tool-families exige um valor"; TOOL_FAMILIES="$2"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --skip-rea) SKIP_REA=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-global) REA_NO_GLOBAL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "opção desconhecida: $1 (use --help)" ;;
  esac
done

require_cmd node
if node_version_ok; then
  ok "Node.js $(node -v) compatível com o REA."
elif [[ $SKIP_REA -eq 0 ]]; then
  print_node_help
  exit 1
else
  warn "Node.js $(node -v) está abaixo do exigido pelo REA; seguindo porque --skip-rea foi usado."
fi

echo
legal_banner
echo

if [[ -z "$CLIENTS" && $SKIP_REA -eq 0 ]]; then
  if [[ $ASSUME_YES -eq 1 || ! -t 0 ]]; then
    CLIENTS="claude_code,codex"
    warn "Nenhum cliente informado; assumindo: $CLIENTS"
  else
    echo "Quais agentes você vai usar? (Enter = ambos)"
    echo "  1) Claude Code"
    echo "  2) Codex CLI"
    echo "  3) Ambos"
    read -r -p "Escolha [3]: " choice
    case "${choice:-3}" in
      1) CLIENTS="claude_code" ;;
      2) CLIENTS="codex" ;;
      3|"") CLIENTS="claude_code,codex" ;;
      *) die "opção inválida: $choice" ;;
    esac
  fi
fi

# ---------------------------------------------------------------- REA install
if [[ $SKIP_REA -eq 0 ]]; then
  info "Instalando/atualizando o REA"
  if [[ "${REA_NO_GLOBAL:-0}" -eq 1 ]]; then
    dim "  modo npx: os registros vão apontar para o cache do npm (menos durável)."
    REA_CMD=(npx -y rea-agents@latest)
  elif [[ $DRY_RUN -eq 1 ]]; then
    dim "  [dry-run] npm install --global rea-agents@latest"
    REA_CMD=(npx -y rea-agents@latest)
  else
    npm install --global rea-agents@latest || die "falha ao instalar globalmente. Use --no-global (npx) ou configure o prefix do npm (docs/07-solucao-de-problemas.md)."
    hash -r
    REA_CMD=(rea)
    ok "REA instalado: $(rea --version 2>/dev/null || echo 'versão desconhecida')"
  fi

  IFS=',' read -r -a client_list <<<"$CLIENTS"
  for c in "${client_list[@]}"; do
    [[ -n "$c" ]] || continue
    info "Plano de setup para: $c"
    setup_args=(setup --client "$c" --dry-run)
    [[ -n "$TOOL_FAMILIES" ]] && setup_args+=(--tool-families "$TOOL_FAMILIES")
    "${REA_CMD[@]}" "${setup_args[@]}" || die "dry-run falhou para $c. Nada foi alterado."

    if [[ $DRY_RUN -eq 1 ]]; then
      dim "  [dry-run] ${REA_CMD[*]} setup --client $c"
      continue
    fi

    if [[ $ASSUME_YES -eq 0 ]]; then
      read -r -p "Aplicar esse plano em $c? [s/N] " ans
      [[ "$ans" =~ ^[sSyY]$ ]] || { warn "pulado: $c"; continue; }
    fi
    apply_args=(setup --client "$c" --yes)
    [[ -n "$TOOL_FAMILIES" ]] && apply_args+=(--tool-families "$TOOL_FAMILIES")
    "${REA_CMD[@]}" "${apply_args[@]}" || die "setup falhou para $c (veja docs/07-solucao-de-problemas.md)"
    ok "REA registrado em $c"
  done
fi

# ------------------------------------------------------------------ workspace
if [[ $DRY_RUN -eq 1 ]]; then
  info "[dry-run] criaria targets/ e settings locais das salas"
else
  info "Preparando salas e pastas de trabalho"
  mkdir -p "$ROOT/targets"
  : >"$ROOT/targets/.gitkeep"

  GUARD="$ROOT/scripts/guard-impl.mjs"

  write_hook_settings() {
    local dest="$1" command="$2"
    node -e '
      const fs = require("node:fs");
      const [dest, command] = process.argv.slice(1);
      const matcher = "Bash|Read|Grep|Glob|Edit|Write|MultiEdit|NotebookEdit|WebFetch|WebSearch";
      const data = { hooks: { PreToolUse: [{ matcher, hooks: [{ type: "command", command }] }] } };
      fs.writeFileSync(dest, JSON.stringify(data, null, 2) + "\n");
    ' "$dest" "$command"
    jq -e . "$dest" >/dev/null 2>&1 || node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"))' "$dest" \
      || die "falha ao gerar JSON válido em $dest"
  }

  # Hook na raiz também: se o cliente tratar o repo como projeto, ele carrega este.
  mkdir -p "$ROOT/.claude"
  write_hook_settings "$ROOT/.claude/settings.local.json" "node \"$GUARD\""
  ok "guard instalado em .claude/settings.local.json (raiz)"

  for room in analysis impl; do
    mkdir -p "$ROOT/rooms/$room/.claude"
    write_hook_settings "$ROOT/rooms/$room/.claude/settings.local.json" "CLEANROOM_ROOM=$room node \"$GUARD\""
    ok "guard instalado em rooms/$room/.claude/settings.local.json"
  done
fi

# ---------------------------------------------------------------------- doctor
if [[ $SKIP_REA -eq 0 && $DRY_RUN -eq 0 ]]; then
  echo
  info "Diagnóstico"
  IFS=',' read -r -a client_list <<<"$CLIENTS"
  for c in "${client_list[@]}"; do
    [[ -n "$c" ]] || continue
    echo
    printf '%s--- doctor: %s ---%s\n' "$C_BOLD" "$c" "$C_RESET"
    "${REA_CMD[@]}" doctor --client "$c" || warn "doctor reportou problemas em $c"
  done

  if [[ -n "$PROVIDER" && "$PROVIDER" != "none" ]]; then
    echo
    printf '%s--- provedor: %s ---%s\n' "$C_BOLD" "$PROVIDER" "$C_RESET"
    "${REA_CMD[@]}" doctor --provider "$PROVIDER" --json || warn "provedor '$PROVIDER' indisponível; veja docs/01-instalacao-rea.md"
  fi
fi

cat <<EOF

${C_BOLD}Pronto.${C_RESET} Próximos passos:

  1) Crie um alvo (uma coisa que você quer entender e reimplementar):
       ./scripts/new-target.sh meu-jogo --name "Meu Jogo" --version "1.2.3"

  2) Coloque sua cópia do alvo em:
       targets/meu-jogo/analysis/artifacts/

  3) Abra a ${C_BOLD}sala de análise${C_RESET}:
       cd rooms/analysis && claude      # ou: codex
     Prompt inicial: "Leia AGENTS.md e analyze o alvo em ../../targets/meu-jogo.
     Quero entender o comportamento X. Produza a spec comportamental em
     ../../targets/meu-jogo/analysis/spec/spec.md."

  4) Feche o portão e gere o handoff:
       ./scripts/handoff.sh meu-jogo 0.1.0

  5) Abra a ${C_BOLD}sala de implementação${C_RESET} (sessão nova, de preferência outro agente):
       cd rooms/impl && claude          # ou: codex
     Prompt: "Leia AGENTS.md e implemente ../../targets/meu-jogo/handoff/v0.1.0.
     Use apenas a spec e os vetores; rode os testes."

  6) Audite:
       ./scripts/verify-isolation.sh meu-jogo

  Documentação: docs/00-metodo-clean-room.md (comece por aqui).
EOF

if [[ $DRY_RUN -eq 0 ]]; then
  "$ROOT/scripts/verify-isolation.sh" --quick || true
fi
