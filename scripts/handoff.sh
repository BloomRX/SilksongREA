#!/usr/bin/env bash
# Fecha o portão e empacota o handoff da sala de análise para a sala limpa.
#
# Uso:
#   ./scripts/handoff.sh <slug> <versão> [--strict] [--force]
#
# Só entram no pacote: spec.md, golden.json e manifest.json.
# Nada de código, evidência bruta, artefatos ou assets.
# Os arquivos ficam somente-leitura e o manifesto guarda os hashes.

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

SLUG=""; VERSION=""; STRICT=0; FORCE=0
while (($# > 0)); do
  case "$1" in
    --strict) STRICT=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "opção desconhecida: $1" ;;
    *) if [[ -z "$SLUG" ]]; then SLUG="$1"; elif [[ -z "$VERSION" ]]; then VERSION="$1"; else die "argumentos demais: $1"; fi; shift ;;
  esac
done

[[ -n "$SLUG" && -n "$VERSION" ]] || die "uso: ./scripts/handoff.sh <slug> <versão>  ex.: ./scripts/handoff.sh meu-jogo 0.1.0"
slug_ok "$SLUG" || die "slug inválido: $SLUG"
[[ "$VERSION" =~ ^[0-9A-Za-z][0-9A-Za-z._-]{0,20}$ ]] || die "versão inválida: use algo como 0.1.0"

base="$ROOT/targets/$SLUG"
spec="$base/analysis/spec/spec.md"
golden="$base/analysis/golden/golden.json"
artifacts_hash="$base/analysis/artifacts.sha256"
out="$base/handoff/v$VERSION"

[[ -d "$base" ]] || die "alvo '$SLUG' não existe (use ./scripts/new-target.sh)"
[[ -s "$spec" ]] || die "spec vazia ou ausente: $spec"
[[ -s "$golden" ]] || die "golden.json ausente: $golden"

info "Rodando o portão da spec"
gate_args=(--json --kind spec)
[[ $STRICT -eq 1 ]] && gate_args+=(--strict)
gate_json="$(node "$ROOT/scripts/check-spec.mjs" "$spec" "${gate_args[@]}")" || true
if ! gate_ok="$(node -e 'const d=JSON.parse(process.argv[1]);process.stdout.write(String(d.ok))' "$gate_json" 2>/dev/null)"; then
  node "$ROOT/scripts/check-spec.mjs" "$spec" --kind spec || true
  die "não consegui avaliar o portão da spec (veja a saída acima)."
fi
if [[ "$gate_ok" != "true" ]]; then
  node "$ROOT/scripts/check-spec.mjs" "$spec" --kind spec || true
  die "a spec não passou no portão. Corrija os BLOQUEIOS antes do handoff."
fi
node "$ROOT/scripts/check-spec.mjs" "$spec" --kind spec

info "Validando vetores de teste"
node - "$golden" <<'NODE' || die "golden.json inválido: precisa de {\"cases\": [...]} com ao menos 1 caso"
const fs = require("node:fs");
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!Array.isArray(d.cases) || d.cases.length === 0) process.exit(1);
for (const [i, c] of d.cases.entries()) {
  if (!c || typeof c !== "object" || !c.id || !c.input) {
    console.error(`caso ${i} sem "id" ou "input"`);
    process.exit(1);
  }
}
NODE
ok "$(node -e 'const d=require(process.argv[1]);process.stdout.write(d.cases.length+" vetor(es)")' "$(abspath "$golden")")"

if [[ -e "$out" ]]; then
  if [[ $FORCE -eq 1 ]]; then
    warn "sobrescrevendo $out"
    chmod -R u+w "$out" 2>/dev/null || true
    rm -rf "$out"
  else
    die "$out já existe. Handoffs são imutáveis: use outra versão (ex.: $VERSION-2) ou --force."
  fi
fi

mkdir -p "$out"
cp "$spec" "$out/spec.md"
cp "$golden" "$out/golden.json"

info "Gerando manifesto"
node - "$SLUG" "$VERSION" "$out" "$gate_json" "$artifacts_hash" "$ROOT" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const [slug, version, out, gateJson, artifactsHashPath, root] = process.argv.slice(2);
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const gateParsed = JSON.parse(gateJson);
const specPath = path.join(out, "spec.md");
const specText = fs.readFileSync(specPath, "utf8");

const declaration = (() => {
  const idx = specText.search(/^##\s*9/m);
  if (idx < 0) return "";
  const rest = specText.slice(idx).replace(/^##[^\n]*\n/, "");
  return rest.split(/^##\s/m)[0].trim();
})();

const git = (args) => {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

let artifacts = null;
if (fs.existsSync(artifactsHashPath)) {
  artifacts = fs
    .readFileSync(artifactsHashPath, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const [hash, ...rest] = l.trim().split(/\s+/);
      return { path: rest.join(" "), sha256: hash };
    });
}

const files = ["spec.md", "golden.json"].map((f) => {
  const p = path.join(out, f);
  return { path: f, sha256: sha(p), bytes: fs.statSync(p).size };
});

const targetReadme = path.join(root, "targets", slug, "README.md");
const readme = fs.existsSync(targetReadme) ? fs.readFileSync(targetReadme, "utf8") : "";
const meta = readme.match(/Nome:\s*(.+)/)?.[1]?.trim() ?? slug;
const analyzedVersion = readme.match(/Versão analisada:\s*(.+)/)?.[1]?.trim() ?? version;

const manifest = {
  schema: "cleanroom-handoff/v1",
  target: { slug, display_name: meta, analyzed_version: analyzedVersion },
  handoff_version: `v${version}`,
  created_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  created_by: git(["config", "user.name"]) || "desconhecido",
  git: { branch: git(["rev-parse", "--abbrev-ref", "HEAD"]), commit: git(["rev-parse", "HEAD"]) },
  gate: {
    tool: "check-spec",
    kind: gateParsed.kind,
    ok: gateParsed.ok,
    errors: gateParsed.errors.length,
    warnings: gateParsed.warnings.length,
    warnings_detail: gateParsed.warnings,
  },
  artifacts_sha256: artifacts,
  files,
  independence_declaration: declaration,
  included: ["spec.md", "golden.json", "manifest.json"],
  excluded: ["binários e artefatos do alvo", "evidências do REA", "código-fonte", "assets de qualquer tipo"],
};

fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
NODE

chmod 0444 "$out/spec.md" "$out/golden.json" "$out/manifest.json"
chmod 0555 "$out"

cat >>"$base/analysis/audit/log.jsonl" <<EOF
{"at":"$(today_utc)","event":"handoff","version":"v$VERSION","dir":"handoff/v$VERSION","spec_sha256":"$(sha256_file "$out/spec.md")","golden_sha256":"$(sha256_file "$out/golden.json")"}
EOF

ok "Handoff pronto e selado: targets/$SLUG/handoff/v$VERSION"
dim "  spec.md · golden.json · manifest.json (somente leitura)"
cat <<EOF

Entregue apenas esta pasta para a sala limpa. Exemplos de prompt
(em rooms/impl, sessão nova e de preferência outro agente):

  "Leia AGENTS.md. Implemente ../../targets/$SLUG/handoff/v$VERSION.
   Use só spec.md e golden.json; comece pelos testes dos vetores.
   Se a spec for ambígua, escreva um pedido de esclarecimento em
   ../../targets/$SLUG/analysis/requests/ — não invente comportamento."

Antes de começar a implementar, confirme o isolamento:

  ./scripts/verify-isolation.sh $SLUG
EOF
