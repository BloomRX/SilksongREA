#!/usr/bin/env node
/**
 * Guard de sala para hooks do Claude Code (PreToolUse).
 *
 * Instalado pelo bootstrap em rooms/<sala>/.claude/settings.local.json (e na
 * raiz). A sala é detectada por CLEANROOM_ROOM, pelo diretório da sessão ou
 * pelo caminho acessado — por isso abrir o agente na raiz também respeita as
 * regras ao escrever dentro de targets/<slug>/analysis. As regras:
 *
 *   analysis: pode ler o alvo e o REA; NÃO pode escrever código de produto
 *             nem entrar na sala de implementação.
 *   impl:     só pode trabalhar no handoff e no código; NÃO pode tocar no REA,
 *             no alvo, em evidências ou na sala de análise.
 *
 * Falha aberta (exit 0) se não entender a entrada: um hook quebrado não deve
 * travar o agente. As regras valem para Bash, Read/Write/Edit, Grep/Glob e web.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_ROOM = process.env.CLEANROOM_ROOM || "";

const HARNESS = /(^|\/)analysis\/(tools|harness)(\/|$)/;
const CODE_EXT = /\.(cs|gd|gdscript|cpp|cc|cxx|c|h|hpp|js|mjs|cjs|jsx|ts|tsx|py|rs|go|java|kt|kts|lua|swift|m|mm|asm|s|shader|hlsl|glsl|wgsl|sol)$/i;

const IMPL_BASH_DENY = [
  [/(^|[;&|(\s])rea(\s|$)/, "o comando `rea` não existe na sala limpa"],
  [/\bnpx\s+(-y\s+)?rea-agents/i, "instalar/rodar REA na sala limpa quebra o clean room"],
  [/\bnpm\s+(i|install|add)\s+(-g\s+)?rea-agents/i, "instalar REA na sala limpa quebra o clean room"],
  [/\b(ghidra\w*|hopper|ida64|ida32|jadx|il2cppdumper|dnspy|frida)\b/i, "ferramenta de engenharia reversa proibida na sala limpa"],
  [/\b(targets\/[^/\s]+\/analysis|rooms\/analysis)\b/, "caminho da sala de análise proibido na sala limpa"],
  [/\b(artifacts|evidence)\//, "artefatos/evidências do alvo não entram na sala limpa"],
  [/\bgit\s+clone\b.*\b(morluto\/rea|rea\.tools)\b/i, "não clone o REA na sala limpa"],
];

const IMPL_WEB_DENY = [/\brea\.tools\b/i, /github\.com\/morluto\/rea/i, /morluto\/rea/i];
const IMPL_PATH_DENY = [
  [/(^|\/)rooms\/analysis(\/|$)/, "sala de análise"],
  [/(^|\/)targets\/[^/]+\/analysis(\/|$)/, "pasta de análise do alvo"],
  [/(^|\/)analysis\/(artifacts|evidence|spec)(\/|$)/, "material da sala de análise"],
];

const ANALYSIS_PATH_DENY = [
  [/(^|\/)rooms\/impl(\/|$)/, "sala de implementação"],
  [/(^|\/)targets\/[^/]+\/handoff\/[^/]+\/impl(\/|$)/, "implementação existente"],
];

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function decision(allow, reason) {
  if (allow) {
    process.exit(0);
  }
  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Clean room (${ROOM || "?"}): ${reason}`,
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const raw = readStdin();
if (!raw.trim()) decision(true);

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  decision(true);
}

const tool = String(payload.tool_name || payload.toolName || "");
const input = payload.tool_input || payload.toolInput || {};
const cwd = payload.cwd || process.cwd();

const ANALYSIS_SCOPE = /(^|\/)targets\/[^/]+\/analysis($|\/)/;
const IMPL_SCOPE = /(^|\/)(rooms\/impl|targets\/[^/]+\/impl-src)($|\/)/;

/**
 * Sala: env > diretório da sessão > diretório do processo > escopo do caminho.
 * O último caso cobre o agente aberto na raiz do kit: escrever código dentro de
 * targets/<slug>/analysis continua bloqueado mesmo fora da pasta da sala.
 */
function detectRoom(base, absPaths) {
  if (ENV_ROOM === "analysis" || ENV_ROOM === "impl") return ENV_ROOM;
  for (const candidate of [base, process.cwd()]) {
    const abs = resolve(candidate);
    if (IMPL_SCOPE.test(abs)) return "impl";
    if (ANALYSIS_SCOPE.test(abs)) return "analysis";
  }
  if (absPaths.some((p) => IMPL_SCOPE.test(p))) return "impl";
  if (absPaths.some((p) => ANALYSIS_SCOPE.test(p))) return "analysis";
  return "";
}

const fields = ["command", "path", "file_path", "notebook_path", "pattern", "url", "query", "glob"];
const values = fields.map((f) => input[f]).filter((v) => typeof v === "string");
const joined = values.join("\n");
const paths = values.filter((v) => v === input.path || v === input.file_path || v === input.notebook_path || v === input.glob);
const absPaths = paths.map((p) => resolve(cwd, p));
const ROOM = detectRoom(cwd, absPaths);

if (ROOM === "impl") {
  for (const [re, why] of IMPL_BASH_DENY) {
    if (re.test(joined)) decision(false, `${why}. Trabalhe apenas com a spec e os vetores do handoff.`);
  }
  if (tool === "WebFetch" || tool === "WebSearch") {
    for (const re of IMPL_WEB_DENY) {
      if (re.test(joined)) decision(false, "buscar o REA ou material de engenharia reversa na web.");
    }
  }
  for (const p of paths) {
    const abs = resolve(cwd, p);
    for (const [re, why] of IMPL_PATH_DENY) {
      if (re.test(abs) || re.test(p)) decision(false, `acessar ${why} (${p}).`);
    }
  }
  // Evidência solta (não o manifest do handoff).
  if (tool === "Read" || tool === "Edit" || tool === "Write") {
    for (const p of paths) {
      if (/\.(bundle|evidence)\.json$/i.test(p)) decision(false, "abrir bundle de evidência do REA.");
    }
  }
}

if (ROOM === "analysis") {
  for (const p of paths) {
    const abs = resolve(cwd, p);
    for (const [re, why] of ANALYSIS_PATH_DENY) {
      if (re.test(abs) || re.test(p)) decision(false, `acessar ${why} (${p}).`);
    }
  }
  const writing = ["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool);
  if (writing) {
    for (const p of paths) {
      const abs = resolve(cwd, p);
      if (CODE_EXT.test(p) && !HARNESS.test(abs) && !HARNESS.test(p)) {
        decision(
          false,
          `escrever código de produto (${p}). Nesta sala você produz comportamento observável e vetores; a implementação acontece na sala limpa.`
        );
      }
    }
  }
}

decision(true);
