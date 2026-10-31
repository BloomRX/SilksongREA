import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRIPT = join(ROOT, "scripts", "preflight.mjs");

function run(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", timeout: 60000 });
}

test("preflight --json devolve relatório válido e consistente", () => {
  const r = run(["--json"]);
  assert.ok([0, 1].includes(r.status), `código inesperado: ${r.status} (${r.stderr})`);
  const data = JSON.parse(r.stdout);

  assert.equal(data.schema, "cleanroom-preflight/v1");
  assert.equal(typeof data.ok, "boolean");
  assert.ok(Array.isArray(data.checks) && data.checks.length >= 8);
  assert.ok(Array.isArray(data.nextActions));

  const ids = new Set();
  for (const c of data.checks) {
    assert.equal(typeof c.id, "string");
    assert.equal(typeof c.label, "string");
    assert.ok(["ok", "warn", "fail"].includes(c.status), `status inválido em ${c.id}: ${c.status}`);
    assert.equal(typeof c.detail, "string");
    assert.ok(c.fix === null || typeof c.fix === "string");
    assert.ok(!ids.has(c.id), `id duplicado: ${c.id}`);
    ids.add(c.id);
  }

  for (const required of ["node", "repo", "kit-files", "rea", "clients", "skills", "hooks", "java"]) {
    assert.ok(ids.has(required), `check obrigatório ausente: ${required}`);
  }

  const count = (s) => data.checks.filter((c) => c.status === s).length;
  assert.deepEqual(data.summary, { ok: count("ok"), warn: count("warn"), fail: count("fail") });
  assert.equal(data.ok, data.summary.fail === 0, "ok deve refletir ausência de falhas");
  assert.equal(r.status, data.ok ? 0 : 1, "código de saída deve acompanhar o veredito");
  assert.equal(data.root, ROOT);

  if (!data.ok) {
    assert.ok(data.nextActions.length > 0, "com falhas deve haver correções sugeridas");
  }
});

test("preflight legível lista cada verificação e o resumo", () => {
  const r = run([]);
  assert.ok([0, 1].includes(r.status));
  assert.match(r.stdout, /Pré-voo do kit/);
  assert.match(r.stdout, /Resumo: \d+ ok · \d+ aviso\(s\) · \d+ falha\(s\)/);
  for (const label of ["Node.js", "Repositório", "Arquivos do kit", "REA", "Agentes"]) {
    assert.ok(r.stdout.includes(label), `linha ausente: ${label}`);
  }
  if (r.status === 1) {
    assert.match(r.stdout, /Correções sugeridas/);
    assert.match(r.stdout, /docs\/09-reparo-com-codex\.md/);
  }
});

test("preflight --help explica o uso sem tocar no ambiente", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /uso: node scripts\/preflight\.mjs/);
  assert.match(r.stdout, /--deep/);
});

test("preflight --deep mantém o relatório válido", () => {
  const r = run(["--deep", "--json"]);
  assert.ok([0, 1].includes(r.status), `código inesperado: ${r.status} (${r.stderr})`);
  const data = JSON.parse(r.stdout);
  assert.equal(data.schema, "cleanroom-preflight/v1");
  assert.equal(data.ok, data.summary.fail === 0);
  for (const c of data.checks) {
    assert.ok(["ok", "warn", "fail"].includes(c.status));
  }
});
