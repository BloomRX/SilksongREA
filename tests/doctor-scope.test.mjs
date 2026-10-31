import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDoctorScope } from "../scripts/lib/doctor-scope.mjs";

const scopeOkEnvPending = {
  healthy: true,
  environment_healthy: false,
  scope: { mode: "explicit", clients: ["codex"], providers: [], skill: true, target: null },
  scope_checks: [
    { name: "node", ok: true, classification: "healthy", detail: "24.22.2" },
    { name: "registration:codex", ok: true, classification: "healthy", detail: "C:\\Users\\x\\.codex\\config.toml" },
    { name: "skill:identity", ok: true, classification: "healthy" },
  ],
  checks: [
    { name: "node", ok: true },
    { name: "ghidra", ok: true },
    { name: "hopper", ok: false, classification: "missing_analysis_engine" },
    { name: "ida-registration", ok: false, classification: "missing_analysis_engine" },
    { name: "registration:cursor", ok: false, classification: "config_drift" },
    { name: "registration:vscode", ok: false, classification: "config_drift" },
    { name: "registration:gemini_cli", ok: false, classification: "config_drift" },
    { name: "registration:trae", ok: false, classification: "config_drift" },
  ],
};

test("escopo saudável passa mesmo com exit 1 e environment_healthy false", () => {
  const verdict = summarizeDoctorScope(JSON.stringify(scopeOkEnvPending), 1);
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail, /escopo ok/);
  assert.match(verdict.detail, /6 pendência\(s\) fora do escopo/);
  assert.match(verdict.detail, /hopper/);
  assert.ok(verdict.detail.length <= 300);
});

test("falha de escopo reprova e nomeia o check", () => {
  const failing = {
    healthy: false,
    environment_healthy: false,
    scope_checks: [
      { name: "node", ok: true },
      { name: "registration:codex", ok: false, detail: "config ausente" },
      { name: "skill:identity", ok: true },
    ],
    checks: [],
  };
  const verdict = summarizeDoctorScope(JSON.stringify(failing), 1);
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /registration:codex/);
  assert.match(verdict.detail, /config ausente/);
  assert.ok(!verdict.detail.includes("\n"));
});

test("healthy false sem scope_checks reprova", () => {
  const verdict = summarizeDoctorScope(JSON.stringify({ healthy: false, checks: [] }), 1);
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /healthy=false/);
});

test("saída não-JSON cai no código de saída e é truncada", () => {
  const longLine = `erro qualquer ${"x".repeat(600)}`;
  const bad = summarizeDoctorScope(longLine, 1);
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /^sem JSON: erro qualquer/);
  assert.ok(bad.detail.length <= 300);

  const good = summarizeDoctorScope("ok", 0);
  assert.equal(good.ok, true);
});

test("saída vazia não inventa sucesso", () => {
  assert.equal(summarizeDoctorScope("", 0).ok, true);
  assert.equal(summarizeDoctorScope("", 1).ok, false);
  assert.match(summarizeDoctorScope("", 1).detail, /saída vazia/);
});
