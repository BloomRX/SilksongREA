#!/usr/bin/env bash
# Registra hashes SHA-256 dos artefatos que serão analisados (proveniência).
#
# Uso:
#   ./scripts/hash-artifacts.sh <slug>
#
# Grava targets/<slug>/analysis/artifacts.sha256 e uma linha no log de auditoria.
# Limite: 2 GiB por arquivo (mude com MAX_BYTES=...), para não travar em disco cheio.

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

SLUG="${1:-}"
[[ -n "$SLUG" ]] || die "uso: ./scripts/hash-artifacts.sh <slug>"
dir="$ROOT/targets/$SLUG/analysis/artifacts"
[[ -d "$dir" ]] || die "não existe $dir (rode new-target.sh primeiro)"
MAX_BYTES="${MAX_BYTES:-2147483648}"

out="$ROOT/targets/$SLUG/analysis/artifacts.sha256"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

count=0; skipped=0
while IFS= read -r -d '' f; do
  size=$(wc -c <"$f" | tr -d ' ')
  if (( size > MAX_BYTES )); then
    warn "pulado (> $MAX_BYTES bytes): ${f#"$dir"/}"
    skipped=$((skipped + 1))
    continue
  fi
  printf '%s  %s\n' "$(sha256_file "$f")" "${f#"$dir"/}" >>"$tmp"
  count=$((count + 1))
done < <(find "$dir" -type f ! -name '.gitkeep' ! -name 'artifacts.sha256' -print0 | sort -z)

if (( count == 0 )); then
  rm -f "$tmp"
  warn "nenhum artefato encontrado em $dir"
  exit 1
fi

{
  echo "# gerado em $(today_utc) por hash-artifacts.sh"
  sort -k2 "$tmp"
} >"$out"

cat >>"$ROOT/targets/$SLUG/analysis/audit/log.jsonl" <<EOF
{"at":"$(today_utc)","event":"artifacts-hashed","count":$count,"skipped":$skipped,"file":"analysis/artifacts.sha256"}
EOF

ok "$count arquivo(s) hasheado(s) em targets/$SLUG/analysis/artifacts.sha256"
(( skipped == 0 )) || warn "$skipped arquivo(s) grande(s) ficaram de fora"
