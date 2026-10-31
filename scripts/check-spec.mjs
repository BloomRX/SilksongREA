#!/usr/bin/env node
/**
 * Portão da spec de clean room.
 *
 * Garante que o único artefato que atravessa da sala de análise para a sala de
 * implementação não carrega código, pseudocódigo de decompilador, dumps ou
 * assets — apenas comportamento observável, em linguagem natural, rastreável.
 *
 * Uso:
 *   node scripts/check-spec.mjs <arquivo.md> [--kind spec|request] [--json] [--strict]
 *
 * Saída: 0 = passou (avisos não bloqueiam), 1 = bloqueado, 2 = erro de uso.
 */
import { readFileSync, statSync } from "node:fs";

const ALLOWED_FENCES = new Set(["", "text", "txt", "json", "jsonc", "csv", "md", "markdown", "diff"]);

/** Padrões que denunciam material derivado de decompilação. */
const FORBIDDEN = [
  [/\bsub_[0-9A-Fa-f]{4,}\b/, "símbolo de decompilador (sub_XXXX)"],
  [/\bFUN_[0-9a-f]{6,}\b/, "símbolo de decompilador (FUN_XXXX)"],
  [/\bLAB_[0-9A-Fa-f]{4,}\b/, "rótulo de decompilador (LAB_XXXX)"],
  [/\bDAT_[0-9a-f]{6,}\b/, "símbolo de dados do decompilador (DAT_XXXX)"],
  [/\b(?:undefined[1248]|__int64|__int128)\b/, "tipo interno de decompilador"],
  [/\bvtable\b/i, "detalhe de layout de binário (vtable)"],
  [/\bGameAssembly\.dll\b/i, "artefato de binário IL2CPP"],
  [/\bglobal-metadata\.dat\b/i, "artefato de metadados IL2CPP"],
  [/\b(?:decompil\w*|disassembl\w*|pseudo-?c[oó]digo)\b/i, "referência a decompilação/pseudocódigo"],
  [/\b(?:ghidra|hopper|ida pro|ida64|il2cppdumper|jadx|dnspy)\b/i, "nome de ferramenta de engenharia reversa"],
  [/[0-9A-Fa-f]{80,}/, "blob hexadecimal (dump de bytes)"],
  [/[A-Za-z0-9+/]{180,}={0,2}/, "blob base64 (dump de bytes)"],
  [/data:(?:image|audio|video)\/[a-z0-9.+-]+;base64,/i, "asset embutido (data URI)"],
];

const WARNINGS = [
  [/\b0x[0-9A-Fa-f]{4,}\b/, "offset/endereço bruto: confirme que é observável (ex.: campo de formato)"],
  [/\b(?:TODO|FIXME|XXX)\b/, "marcador pendente na spec"],
  [/artifacts\//, "referência a caminho da sala de análise (não deve ir no handoff)"],
  [/\.(?:cs|gd|cpp|cc|c|h|hpp|js|mjs|ts|py|rs|java|kt|lua|asm|s)\b/, "extensão de código-fonte citada"],
];

const REQUIRED_SPEC = [
  [1, "Identificação"],
  [2, "Escopo"],
  [3, "Contrato observável"],
  [4, "Comportamento"],
  [5, "Constantes e tabelas"],
  [6, "Vetores de teste"],
  [7, "Incertezas"],
  [8, "Rastreabilidade"],
  [9, "Declaração de independência"],
];

const REQUIRED_REQUEST = [
  [1, "Pergunta"],
  [2, "Contexto da spec"],
  [3, "O que preciso saber"],
  [4, "Formato da resposta"],
];

function usage(msg) {
  if (msg) console.error(`erro: ${msg}`);
  console.error("uso: node scripts/check-spec.mjs <arquivo.md> [--kind spec|request] [--json] [--strict]");
  process.exit(2);
}

const args = process.argv.slice(2);
let file = null;
let kind = "spec";
let json = false;
let strict = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--json") json = true;
  else if (a === "--strict") strict = true;
  else if (a === "--kind") kind = args[++i] ?? usage("--kind exige spec ou request");
  else if (a === "-h" || a === "--help") usage();
  else if (a.startsWith("-")) usage(`opção desconhecida: ${a}`);
  else if (file) usage("apenas um arquivo por vez");
  else file = a;
}

if (!file) usage("informe o arquivo da spec");
if (!["spec", "request"].includes(kind)) usage(`--kind inválido: ${kind}`);

let text;
try {
  if (!statSync(file).isFile()) usage(`${file} não é um arquivo`);
  text = readFileSync(file, "utf8");
} catch (e) {
  usage(`não consegui ler ${file}: ${e.message}`);
}

const lines = text.split(/\r?\n/);
const errors = [];
const warnings = [];
const add = (list, line, rule, message) => list.push({ line, rule, message });

const headings = new Map(); // número -> {line, title}
let inFence = false;
let fenceLang = "";
let fenceStart = 0;
let fenceCount = 0;
const disallowedFences = [];

for (let i = 0; i < lines.length; i++) {
  const lineNo = i + 1;
  const line = lines[i];

  const fence = line.match(/^\s*```+\s*([A-Za-z0-9_+#.-]*)/);
  if (fence) {
    if (!inFence) {
      inFence = true;
      fenceLang = fence[1].toLowerCase();
      fenceStart = lineNo;
      fenceCount++;
      if (!ALLOWED_FENCES.has(fenceLang)) {
        disallowedFences.push({ line: lineNo, lang: fenceLang });
      }
    } else {
      inFence = false;
      fenceLang = "";
    }
    continue;
  }

  if (!inFence) {
    const h = line.match(/^##\s*(\d+)\s*[.)-]?\s*(.+?)\s*$/);
    if (h) {
      const num = Number(h[1]);
      if (!headings.has(num)) headings.set(num, { line: lineNo, title: h[2] });
    }
  }

  // Padrões valem inclusive dentro de blocos permitidos (json/text também podem
  // carregar dump). Blocos de código nem chegam aqui como problema separado.
  for (const [re, label] of FORBIDDEN) {
    if (re.test(line)) add(errors, lineNo, "material-derivado", `${label}: "${trim(line)}"`);
  }
  for (const [re, label] of WARNINGS) {
    if (re.test(line)) add(warnings, lineNo, "revisar", `${label}: "${trim(line)}"`);
  }
  if (line.length > 400) add(warnings, lineNo, "linha-longa", `linha com ${line.length} caracteres`);
}

if (inFence) {
  add(errors, fenceStart, "bloco-aberto", "bloco ``` sem fechamento");
}

for (const f of disallowedFences) {
  add(
    errors,
    f.line,
    "codigo-proibido",
    `bloco de código "${f.lang}" é proibido na spec; descreva o comportamento em linguagem natural e use vetores de teste em JSON`
  );
}

const required = kind === "spec" ? REQUIRED_SPEC : REQUIRED_REQUEST;
for (const [num, title] of required) {
  const found = headings.get(num);
  if (!found) {
    add(errors, 0, "secao-faltando", `falta a seção "## ${num}. ${title}"`);
  } else if (!normalize(found.title).includes(normalize(title))) {
    add(warnings, found.line, "secao-renomeada", `seção ${num} deveria tratar de "${title}" (achei "${found.title}")`);
  }
}

if (kind === "spec") {
  const sec = sectionBody(lines, headings, 9);
  const needs = ["declaro", "não", "código"];
  for (const n of needs) {
    if (!normalize(sec).includes(normalize(n))) {
      add(errors, headings.get(9)?.line ?? 0, "declaracao-ausente", `a seção 9 deve conter a declaração ("${n}" não encontrado)`);
    }
  }
  const trace = sectionBody(lines, headings, 8);
  if (!/\bEV[-_][A-Za-z0-9]/.test(trace) && !/\bev_[0-9a-f]{8,}/i.test(trace)) {
    add(warnings, headings.get(8)?.line ?? 0, "sem-evidencia", "seção 8 sem referência de evidência (EV-.../ev_...)");
  }
  if (!/sha256/i.test(trace)) {
    add(warnings, headings.get(8)?.line ?? 0, "sem-hash", "seção 8 sem digest sha256 do alvo/evidência");
  }
  if (!/\bgolden\b|vetor/i.test(text)) {
    add(warnings, 0, "sem-vetores", "a spec não menciona vetores de teste (golden)");
  }
}

if (kind === "request") {
  if (/\b(?:implemente|escreva o código|gere o código|me dê o código)\b/i.test(text)) {
    add(errors, 0, "pedido-de-codigo", "pedido de esclarecimento não pode pedir código; peça critério ou comportamento observável");
  }
}

const ok = errors.length === 0 && (!strict || warnings.length === 0);

if (json) {
  console.log(
    JSON.stringify(
      {
        file,
        kind,
        ok,
        strict,
        stats: { lines: lines.length, sections: headings.size, fences: fenceCount },
        errors,
        warnings,
      },
      null,
      2
    )
  );
} else {
  console.log(`spec: ${file}`);
  console.log(`tipo: ${kind} · linhas: ${lines.length} · seções: ${headings.size} · blocos: ${fenceCount}`);
  for (const e of errors) console.log(`  BLOQUEIO  ${loc(e.line)} ${e.message}  [${e.rule}]`);
  for (const w of warnings) console.log(`  aviso     ${loc(w.line)} ${w.message}  [${w.rule}]`);
  if (ok) {
    console.log(errors.length === 0 ? "resultado: PASSOU" : "resultado: PASSOU (strict)");
  } else {
    console.log(`resultado: BLOQUEADO (${errors.length} bloqueio(s), ${warnings.length} aviso(s))`);
  }
}

process.exit(ok ? 0 : 1);

function trim(s) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > 90 ? `${t.slice(0, 90)}…` : t;
}
function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function loc(n) {
  return n > 0 ? `linha ${n}:`.padEnd(12) : "documento: ".padEnd(12);
}
function sectionBody(allLines, map, num) {
  const start = map.get(num)?.line;
  if (!start) return "";
  const out = [];
  for (let i = start; i < allLines.length; i++) {
    if (/^##\s*\d+/.test(allLines[i])) break;
    out.push(allLines[i]);
  }
  return out.join("\n");
}
