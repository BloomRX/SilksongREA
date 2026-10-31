#!/usr/bin/env node
/**
 * Verifica se um handoff continua idêntico ao manifesto.
 * Uso: node scripts/verify-handoff.mjs <caminho/para/manifest.json>
 * Sai 0 se tudo bate, 1 se falta arquivo/foi alterado, 2 se o manifesto é inválido.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error("uso: node scripts/verify-handoff.mjs <manifest.json>");
  process.exit(2);
}

const dir = dirname(resolve(manifestPath));
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`manifesto inválido: ${e.message}`);
  process.exit(2);
}

if (manifest.schema !== "cleanroom-handoff/v1") {
  console.error(`schema inesperado: ${manifest.schema}`);
  process.exit(2);
}

let bad = 0;
for (const f of manifest.files ?? []) {
  const p = join(dir, f.path);
  if (!existsSync(p)) {
    console.log(`FALTA      ${f.path}`);
    bad++;
    continue;
  }
  const h = createHash("sha256").update(readFileSync(p)).digest("hex");
  if (h !== f.sha256) {
    console.log(`ALTERADO   ${f.path}`);
    bad++;
  }
}

if (bad) process.exit(1);
console.log(`íntegro    ${manifest.handoff_version} (${(manifest.files ?? []).length} arquivo(s))`);
process.exit(0);
