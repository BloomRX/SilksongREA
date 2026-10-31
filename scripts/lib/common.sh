#!/usr/bin/env bash
# Funções compartilhadas pelos scripts do kit.
# Uso: source "$(dirname "$0")/lib/common.sh"

set -euo pipefail

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""
fi

info()  { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()    { printf '%s ok %s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%saviso%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()   { printf '%serro%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
dim()   { printf '%s%s%s\n' "$C_DIM" "$*" "$C_RESET"; }

repo_root() {
  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  printf '%s\n' "$dir"
}

ROOT="$(repo_root)"
export ROOT

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "comando '$1' não encontrado no PATH."
}

# sha256 de arquivo, portátil entre macOS (shasum) e Linux (sha256sum).
sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    node -e 'const c=require("node:crypto"),f=require("node:fs");process.stdout.write(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$1"
  fi
}

# Verifica se a versão do Node atende ao exigido pelo REA:
# ^22.23.4 || ^24.22.1 || >=26.12.1
node_version_ok() {
  node -e '
    const [maj, min, pat] = process.versions.node.split(".").map(Number);
    const ok =
      (maj === 22 && (min > 23 || (min === 23 && pat >= 4))) ||
      (maj === 24 && (min > 22 || (min === 22 && pat >= 1))) ||
      (maj >= 26 && (maj > 26 || min > 12 || (min === 12 && pat >= 1)));
    process.exit(ok ? 0 : 1);
  ' >/dev/null 2>&1
}

print_node_help() {
  cat >&2 <<'EOF'
O REA exige Node.js 22.x (>= 22.23.4), 24.x (>= 24.22.1) ou >= 26.12.1.
Instale uma versão suportada e rode de novo:

  nvm install 24 && nvm use 24
  fnm install 24 && fnm use 24
  # ou baixe direto de https://nodejs.org/dist/latest-v24.x/

Node 23 e 25 NÃO são suportados pelo REA.
EOF
}

abspath() {
  node -e 'const p=require("node:path");process.stdout.write(p.resolve(process.argv[1]))' "$1"
}

slug_ok() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9-]{1,40}$ ]]
}

today_utc() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

# Aviso de escopo legal, mostrado uma vez por comando relevante.
legal_banner() {
  cat <<'EOF'
Lembrete de escopo (não é aconselhamento jurídico):
  - Analise apenas software que você possui ou está autorizado a examinar.
  - Clean room reduz risco de cópia de *expressão*; não autoriza clonar arte,
    áudio, personagens, mapas, nomes ou marcas.
  - Não contorne DRM, anti-cheat ou verificação de licença.
  - A spec é o único canal entre as salas: nada de código, dump ou asset.
EOF
}
