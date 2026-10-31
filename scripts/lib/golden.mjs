#!/usr/bin/env node
/**
 * Validação dos vetores (golden.json) antes do handoff.
 *
 * Regra do kit: um vetor sem saída esperada não é vetor — é placeholder. Selar
 * um handoff com `expected: null` produz um pacote que a sala limpa não
 * consegue testar, então o padrão é recusar. `--allow-partial` existe apenas
 * para handoffs deliberadamente parciais, que ficam marcados como tal.
 *
 * Uso:
 *   node scripts/lib/golden.mjs <golden.json> [--json] [--allow-partial]
 *
 * Saída: 0 ok · 1 estrutura inválida · 2 vetor sem saída esperada
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const isNullish = (v) => v === null || v === undefined;

function allNullish(value) {
  if (isNullish(value)) return true;
  if (Array.isArray(value)) return value.length === 0 || value.every(allNullish);
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return keys.length === 0 || keys.every((k) => allNullish(value[k]));
  }
  return false;
}

export function unresolvedCases(cases, { alsoEmpty = true } = {}) {
  const out = [];
  for (const c of cases ?? []) {
    const expected = c?.expected ?? c?.expect ?? c?.output ?? c?.outputs;
    if (isNullish(expected) || (alsoEmpty && typeof expected === "object" && allNullish(expected))) {
      out.push(String(c?.id ?? "?"));
    }
  }
  return out;
}

export function validateGolden(data, { allowPartial = false } = {}) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: ["golden.json precisa ser um objeto"], unresolved: [] };
  }
  if (data.schema && data.schema !== "cleanroom-golden/v1") {
    errors.push(`schema inesperado: ${data.schema} (esperado cleanroom-golden/v1)`);
  }
  if (!Array.isArray(data.cases) || data.cases.length === 0) {
    errors.push('precisa de "cases" com ao menos 1 caso');
    return { ok: false, errors, unresolved: [] };
  }

  const ids = new Set();
  data.cases.forEach((c, i) => {
    if (!c || typeof c !== "object") {
      errors.push(`caso ${i}: precisa ser um objeto`);
      return;
    }
    if (!c.id) errors.push(`caso ${i}: falta "id"`);
    else if (ids.has(String(c.id))) errors.push(`caso ${i}: id duplicado "${c.id}"`);
    else ids.add(String(c.id));
    if (!c.input || typeof c.input !== "object") errors.push(`caso ${c.id ?? i}: falta "input"`);
  });

  const unresolved = unresolvedCases(data.cases);
  if (unresolved.length && !allowPartial) {
    errors.push(
      `${unresolved.length} vetor(es) sem saída esperada: ${unresolved.join(", ")}`
    );
  }

  return { ok: errors.length === 0, errors, unresolved };
}

const isDirect = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirect) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const json = args.includes("--json");
  const allowPartial = args.includes("--allow-partial");

  if (!file) {
    console.error("uso: node scripts/lib/golden.mjs <golden.json> [--json] [--allow-partial]");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    const msg = `não consegui ler ${file}: ${err.message}`;
    if (json) console.log(JSON.stringify({ ok: false, errors: [msg], unresolved: [] }, null, 2));
    else console.error(`erro: ${msg}`);
    process.exit(1);
  }

  const report = validateGolden(data, { allowPartial });
  const code = report.ok ? 0 : report.errors.some((e) => /sem saída esperada/.test(e)) ? 2 : 1;

  if (json) {
    console.log(JSON.stringify({ ...report, allowPartial, cases: data.cases.length }, null, 2));
  } else if (report.ok) {
    console.log(`ok  ${data.cases.length} vetor(es) válido(s)`);
    if (report.unresolved.length) {
      console.log(`aviso  ${report.unresolved.length} sem saída esperada (handoff parcial): ${report.unresolved.join(", ")}`);
    }
  } else {
    for (const e of report.errors) console.error(`erro: ${e}`);
    if (report.unresolved.length && !allowPartial) {
      console.error("Dica: complete as saídas antes de selar, ou use --allow-partial para marcar o handoff como parcial.");
    }
  }

  process.exit(code);
}
