import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateGolden, unresolvedCases } from "../scripts/lib/golden.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "scripts", "lib", "golden.mjs");

const base = (cases, extra = {}) => ({
  schema: "cleanroom-golden/v1",
  target: "demo",
  target_version: "1.0.0",
  captured_at: "2026-10-31",
  cases,
  ...extra,
});

const caso = (over = {}) => ({
  id: "mov-parado-anda",
  input: { dir: 1, steps: 10 },
  expected: { v: 6, x: 3 },
  tolerance: 0.01,
  ...over,
});

test("golden com saídas preenchidas é válido", () => {
  const r = validateGolden(base([caso()]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.unresolved, []);
});

test("expected null é vetor não resolvido", () => {
  const r = validateGolden(base([caso({ expected: null })]));
  assert.equal(r.ok, false);
  assert.deepEqual(r.unresolved, ["mov-parado-anda"]);
  assert.ok(r.errors.some((e) => /sem saída esperada/.test(e)));
});

test("objeto de saída todo nulo também conta como não resolvido", () => {
  const r = validateGolden(base([caso({ expected: { v: null, x: null } })]));
  assert.deepEqual(r.unresolved, ["mov-parado-anda"]);
  assert.equal(r.ok, false);
});

test("saída zero é válida (não confundir com ausência)", () => {
  const r = validateGolden(base([caso({ expected: 0 })]));
  assert.equal(r.ok, true);
  assert.deepEqual(unresolvedCases([{ id: "x", expected: 0 }]), []);
});

test("allow-partial aceita, mas continua listando os pendentes", () => {
  const r = validateGolden(base([caso({ expected: null })]), { allowPartial: true });
  assert.equal(r.ok, true);
  assert.deepEqual(r.unresolved, ["mov-parado-anda"]);
});

test("estrutura inválida é rejeitada", () => {
  assert.equal(validateGolden({ cases: [] }).ok, false);
  assert.equal(validateGolden({}).ok, false);
  assert.equal(validateGolden(null).ok, false);
  assert.equal(validateGolden(base([caso({ id: "" })])).ok, false);
  assert.equal(validateGolden(base([caso({ input: undefined })])).ok, false);
  assert.equal(validateGolden(base([caso(), caso()])).ok, false, "id duplicado");
  assert.equal(validateGolden(base([caso()], { schema: "outro/v9" })).ok, false);
});

test("CLI devolve códigos distintos para estrutura inválida e vetor pendente", () => {
  const dir = mkdtempSync(join(tmpdir(), "golden-"));
  const write = (name, data) => {
    const p = join(dir, name);
    writeFileSync(p, JSON.stringify(data));
    return p;
  };

  const ok = spawnSync(process.execPath, [cli, write("ok.json", base([caso()])), "--json"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).ok, true);

  const pendente = spawnSync(process.execPath, [cli, write("null.json", base([caso({ expected: null })])), "--json"], {
    encoding: "utf8",
  });
  assert.equal(pendente.status, 2);
  assert.deepEqual(JSON.parse(pendente.stdout).unresolved, ["mov-parado-anda"]);

  const parcial = spawnSync(
    process.execPath,
    [cli, join(dir, "null.json"), "--json", "--allow-partial"],
    { encoding: "utf8" }
  );
  assert.equal(parcial.status, 0);

  const invalido = spawnSync(process.execPath, [cli, write("vazio.json", base([])), "--json"], { encoding: "utf8" });
  assert.equal(invalido.status, 1);
});
