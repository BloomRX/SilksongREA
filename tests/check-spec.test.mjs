import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const linter = join(root, "scripts", "check-spec.mjs");
const guard = join(root, "scripts", "guard-impl.mjs");
const verifyHandoff = join(root, "scripts", "verify-handoff.mjs");

const run = (script, args, opts = {}) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", ...opts });

test("aceita a spec de exemplo", () => {
  const r = run(linter, [join(root, "examples/pan-mechanic/spec.md"), "--strict", "--json"]);
  const out = JSON.parse(r.stdout);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(out.ok, true);
  assert.deepEqual(out.errors, []);
});

test("bloqueia código, símbolo de decompilador e seção ausente", () => {
  const r = run(linter, [join(here, "fixtures/spec-invalida.md"), "--json"]);
  const out = JSON.parse(r.stdout);
  assert.equal(r.status, 1);
  assert.equal(out.ok, false);
  const rules = out.errors.map((e) => e.rule);
  assert.ok(rules.includes("codigo-proibido"), "deveria bloquear bloco de código");
  assert.ok(rules.includes("material-derivado"), "deveria bloquear sub_/declaração");
  assert.ok(rules.includes("declaracao-ausente"), "deveria exigir a declaração de independência");
});

test("aceita o template em branco no modo estrito", () => {
  const r = run(linter, [join(root, "templates/spec.md"), "--strict"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("pedido de esclarecimento não pode pedir código", () => {
  const dir = mkdtempSync(join(tmpdir(), "cr-"));
  const f = join(dir, "req.md");
  writeFileSync(
    f,
    [
      "# Pedido de esclarecimento",
      "## 1. Pergunta",
      "gere o código da função",
      "## 2. Contexto da spec",
      "v0.1.0",
      "## 3. O que preciso saber",
      "como implementar",
      "## 4. Formato da resposta",
      "código",
    ].join("\n")
  );
  const r = run(linter, [f, "--kind", "request", "--json"]);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e.rule === "pedido-de-codigo"));
});

test("guard bloqueia REA e análise na sala limpa, e libera o handoff", () => {
  const payload = (tool, input, cwd = join(root, "rooms", "impl")) =>
    JSON.stringify({ tool_name: tool, tool_input: input, cwd });

  const denyRea = run(guard, [], { input: payload("Bash", { command: "rea analyze ./x" }), env: { ...process.env, CLEANROOM_ROOM: "impl" } });
  assert.match(denyRea.stdout, /"permissionDecision":"deny"/);

  const denyAnalysis = run(guard, [], {
    input: payload("Read", { file_path: "../../targets/x/analysis/spec/spec.md" }),
    env: { ...process.env, CLEANROOM_ROOM: "impl" },
  });
  assert.match(denyAnalysis.stdout, /"permissionDecision":"deny"/);

  const allowHandoff = run(guard, [], {
    input: payload("Read", { file_path: "../../targets/x/handoff/v0.1.0/spec.md" }),
    env: { ...process.env, CLEANROOM_ROOM: "impl" },
  });
  assert.equal(allowHandoff.stdout.trim(), "");

  const denyCodeInAnalysis = run(guard, [], {
    input: payload("Write", { file_path: "src/Player.cs" }, join(root, "rooms", "analysis")),
    env: { ...process.env, CLEANROOM_ROOM: "analysis" },
  });
  assert.match(denyCodeInAnalysis.stdout, /"permissionDecision":"deny"/);
});

test("verify-handoff detecta adulteração", () => {
  const dir = mkdtempSync(join(tmpdir(), "handoff-"));
  const spec = join(dir, "spec.md");
  writeFileSync(spec, "conteúdo original");
  const sha = createHash("sha256").update("conteúdo original").digest("hex");
  const manifest = {
    schema: "cleanroom-handoff/v1",
    handoff_version: "v0.1.0",
    files: [{ path: "spec.md", sha256: sha, bytes: 16 }],
  };
  const mf = join(dir, "manifest.json");
  writeFileSync(mf, JSON.stringify(manifest));

  const okRun = run(verifyHandoff, [mf]);
  assert.equal(okRun.status, 0, okRun.stdout + okRun.stderr);

  writeFileSync(spec, "conteúdo alterado");
  const badRun = run(verifyHandoff, [mf]);
  assert.equal(badRun.status, 1);
  assert.match(badRun.stdout, /ALTERADO/);
});
