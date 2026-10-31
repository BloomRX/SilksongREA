#!/usr/bin/env node
/**
 * Pré-voo do kit: verifica ambiente, branch, Node, REA, agentes e registros e
 * diz exatamente o que corrigir. Roda em Windows, macOS, Linux e WSL, sem
 * dependências e sem alterar nada.
 *
 * Uso:
 *   node scripts/preflight.mjs            # relatório legível
 *   node scripts/preflight.mjs --json     # relatório para agente/CI
 *
 * Código de saída: 0 = nada bloqueante, 1 = há FALHA, 2 = erro de uso.
 */
import { existsSync, readFileSync, statfsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, release, arch, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_BRANCH = "arena/caee944a-silksongrea";
const JSON_OUT = process.argv.includes("--json");
const DEEP = process.argv.includes("--deep");

if (process.argv.includes("-h") || process.argv.includes("--help")) {
  console.log("uso: node scripts/preflight.mjs [--json] [--deep]");
  console.log("  --json   relatório legível por agente/CI");
  console.log("  --deep   também roda `rea doctor --client <id> --skill` de cada agente presente");
  process.exit(0);
}

const isWin = platform() === "win32";
const isWsl = platform() === "linux" && release().toLowerCase().includes("microsoft");
const isGitBash = isWin && Boolean(process.env.MSYSTEM);
const HOME = homedir();

const checks = [];
function add(id, label, status, detail, fix = null) {
  checks.push({ id, label, status, detail, fix: fix || null });
}
function cmd(command, args = []) {
  try {
    const r = spawnSync(command, args, {
      encoding: "utf8",
      shell: isWin,
      timeout: 20000,
      windowsHide: true,
    });
    return {
      ok: r.status === 0,
      out: String(r.stdout || "").trim().split("\n")[0],
      err: String(r.stderr || "").trim().split("\n")[0],
      missing: r.error && r.error.code === "ENOENT",
    };
  } catch {
    return { ok: false, out: "", err: "", missing: true };
  }
}
function nodeSupported(version) {
  const [a, b, c] = version.replace(/^v/, "").split(".").map(Number);
  return (
    (a === 22 && (b > 23 || (b === 23 && c >= 4))) ||
    (a === 24 && (b > 22 || (b === 22 && c >= 1))) ||
    (a >= 26 && (a > 26 || b > 12 || (b === 12 && c >= 1)))
  );
}
function nodeFix() {
  if (isWin && !isWsl) {
    return "instale WSL2 (wsl --install), entre nele e rode: nvm install 24 && nvm use 24";
  }
  return "nvm install 24 && nvm use 24   (ou: fnm install 24 && fnm use 24)";
}

// ------------------------------------------------------------------ plataforma
add(
  "platform",
  "Sistema",
  "ok",
  `${platform()} ${arch()}${isWsl ? " (WSL)" : ""}${isGitBash ? " (Git Bash)" : ""}`,
  isWin && !isWsl && !isGitBash
    ? "os scripts são bash: use WSL2 (wsl --install) ou abra o Git Bash"
    : null
);

// ------------------------------------------------------------------------ node
const nodeOk = nodeSupported(process.version);
add(
  "node",
  "Node.js",
  nodeOk ? "ok" : "fail",
  `${process.version}${nodeOk ? "" : " — fora da faixa do REA (22.23.4+, 24.22.1+ ou 26.12.1+)"}`,
  nodeOk ? null : nodeFix()
);

// ------------------------------------------------------------------------- npm
const npm = cmd("npm", ["--version"]);
add(
  "npm",
  "npm",
  npm.ok ? "ok" : "fail",
  npm.ok ? npm.out : "não encontrado",
  npm.ok ? null : "reinstale o Node 24 (o npm vem junto)"
);

// ------------------------------------------------------------------------- git
const git = cmd("git", ["--version"]);
add("git", "git", git.ok ? "ok" : "fail", git.ok ? git.out : "não encontrado", git.ok ? null : "instale o Git");

// --------------------------------------------------------------------- bash
const bash = cmd("bash", ["--version"]);
add(
  "bash",
  "bash",
  bash.ok ? "ok" : "fail",
  bash.ok ? bash.out : "bash não encontrado",
  bash.ok
    ? null
    : isWin && !isWsl
      ? "instale WSL2 (wsl --install) ou use o Git Bash para rodar ./scripts/*.sh"
      : "instale bash (apt install bash / brew install bash)"
);

// ------------------------------------------------------------------- repositório
const gitRoot = cmd("git", ["-C", ROOT, "rev-parse", "--is-inside-work-tree"]);
if (gitRoot.ok) {
  const branch = cmd("git", ["-C", ROOT, "rev-parse", "--abbrev-ref", "HEAD"]);
  const commit = cmd("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"]);
  const hasKit = existsSync(join(ROOT, "scripts", "bootstrap.sh"));
  if (!hasKit) {
    add(
      "repo",
      "Repositório",
      "fail",
      `branch "${branch.out}" não tem o kit (só README) — você clonou o main`,
      `git fetch origin && git checkout ${EXPECTED_BRANCH}   (ou: git clone -b ${EXPECTED_BRANCH} ...)`
    );
  } else {
    add(
      "repo",
      "Repositório",
      branch.out === EXPECTED_BRANCH ? "ok" : "warn",
      `${branch.out} @ ${commit.out}`,
      branch.out === EXPECTED_BRANCH ? null : `git checkout ${EXPECTED_BRANCH}`
    );
  }
} else {
  add("repo", "Repositório", "warn", "não é um repositório Git", null);
}

// ------------------------------------------------------------------- arquivos do kit
const kitFiles = [
  "scripts/bootstrap.sh",
  "scripts/check-spec.mjs",
  "scripts/doctor.sh",
  "scripts/guard-impl.mjs",
  "rooms/analysis/AGENTS.md",
  "rooms/impl/AGENTS.md",
];
const missingKit = kitFiles.filter((f) => !existsSync(join(ROOT, f)));
add(
  "kit-files",
  "Arquivos do kit",
  missingKit.length === 0 ? "ok" : "fail",
  missingKit.length === 0 ? "completos" : `faltando: ${missingKit.join(", ")}`,
  missingKit.length === 0 ? null : `git fetch origin && git checkout ${EXPECTED_BRANCH}`
);

// ------------------------------------------------------------------------- REA
const rea = cmd("rea", ["--version"]);
add(
  "rea",
  "REA",
  rea.ok ? "ok" : "fail",
  rea.ok ? rea.out : "não está no PATH",
  rea.ok ? null : "npm install --global rea-agents@latest && hash -r"
);

// ---------------------------------------------------------------------- agentes
const codex = cmd("codex", ["--version"]);
const claude = cmd("claude", ["--version"]);
const clientCount = [codex.ok, claude.ok].filter(Boolean).length;
add(
  "clients",
  "Agentes",
  clientCount > 0 ? "ok" : "fail",
  [codex.ok ? `codex ${codex.out.split(" ").pop()}` : null, claude.ok ? `claude ${claude.out.split(" ").pop()}` : null]
    .filter(Boolean)
    .join(" · ") || "nem Codex nem Claude Code encontrados",
  clientCount > 0 ? null : "npm install --global @openai/codex  (e/ou @anthropic-ai/claude-code)"
);

// ------------------------------------------------------------------- registro MCP
function hasRegistration(file, needles) {
  if (!existsSync(file)) return false;
  try {
    const text = readFileSync(file, "utf8");
    return needles.some((n) => text.includes(n));
  } catch {
    return false;
  }
}
if (codex.ok) {
  const cfg = join(process.env.CODEX_HOME || join(HOME, ".codex"), "config.toml");
  const registered = hasRegistration(cfg, ["mcp_servers.rea", "[mcp_servers.rea]"]);
  add(
    "rea-codex",
    "REA no Codex",
    registered ? "ok" : "fail",
    registered ? `registrado em ${cfg}` : `sem registro em ${cfg}`,
    registered ? null : "rea setup --client codex --dry-run   (depois, sem --dry-run)"
  );
}
if (claude.ok) {
  const cfg = join(process.env.CLAUDE_CONFIG_DIR || HOME, ".claude.json");
  const registered = hasRegistration(cfg, ['"rea"']);
  add(
    "rea-claude",
    "REA no Claude Code",
    registered ? "ok" : "fail",
    registered ? `registrado em ${cfg}` : `sem registro em ${cfg}`,
    registered ? null : "rea setup --client claude_code --dry-run"
  );
}

// --------------------------------------------------- doctor com escopo (opcional)
// O `rea doctor` sem filtro reprova clientes que você não usa e provedores
// ausentes; aqui o gate é por cliente, que é o que o kit realmente exige.
if (DEEP && rea.ok) {
  const targets = [];
  if (codex.ok) targets.push(["codex", "codex"]);
  if (claude.ok) targets.push(["claude_code", "Claude Code"]);
  for (const [id, label] of targets) {
    const r = cmd("rea", ["doctor", "--client", id, "--skill", "--json"]);
    const healthy = r.ok && !/"(healthy|ok)"\s*:\s*false/.test(r.out);
    add(
      `rea-doctor-${id}`,
      `Doctor ${label}`,
      healthy ? "ok" : "fail",
      healthy ? "registro e skill saudáveis" : `saiu ${r.status ?? "erro"}: ${r.err || r.out || "sem saída"}`,
      healthy ? null : `rea doctor --client ${id} --skill   (veja docs/07-solucao-de-problemas.md)`
    );
  }
  if (targets.length === 0) {
    add("rea-doctor", "Doctor do REA", "warn", "nenhum agente presente para escopar o doctor", null);
  }
}

// ------------------------------------------------------------------ hooks/skills
const hookFiles = [
  join(ROOT, ".claude", "settings.json"),
  join(ROOT, "rooms", "analysis", ".claude", "settings.json"),
  join(ROOT, "rooms", "impl", ".claude", "settings.json"),
  join(ROOT, "rooms", "analysis", ".claude", "settings.local.json"),
  join(ROOT, "rooms", "impl", ".claude", "settings.local.json"),
];
const hooksOk = hookFiles.some((f) => existsSync(f) && readFileSync(f, "utf8").includes("guard-impl.mjs"));
add(
  "hooks",
  "Guards das salas",
  hooksOk ? "ok" : "warn",
  hooksOk ? "hook do guard presente" : "nenhum hook encontrado",
  hooksOk ? null : existsSync(join(ROOT, "scripts", "bootstrap.sh"))
    ? "./scripts/bootstrap.sh --skip-rea --yes"
    : `git checkout ${EXPECTED_BRANCH}`
);

const skills = [
  join(".claude", "skills", "clean-room-orchestrator", "SKILL.md"),
  join("rooms", "analysis", ".claude", "skills", "clean-room-spec", "SKILL.md"),
  join("rooms", "impl", ".claude", "skills", "clean-room-impl", "SKILL.md"),
].filter((p) => existsSync(join(ROOT, p)));
add(
  "skills",
  "Skills",
  skills.length === 3 ? "ok" : "warn",
  `${skills.length}/3 presentes`,
  skills.length === 3 ? null : `git checkout ${EXPECTED_BRANCH}`
);

// ----------------------------------------------------------------------- Ghidra
const ghidraEnv = process.env.GHIDRA_INSTALL_DIR;
const ghidraCmd = cmd("ghidraRun", ["--help"]);
const ghidraOk = Boolean(ghidraEnv && existsSync(ghidraEnv)) || ghidraCmd.ok;
add(
  "ghidra",
  "Ghidra",
  ghidraOk ? "ok" : "warn",
  ghidraOk ? ghidraEnv || "no PATH" : "não detectado (necessário para Unity IL2CPP e binários nativos)",
  ghidraOk ? null : "instale o Ghidra, exporte GHIDRA_INSTALL_DIR e rode rea setup novamente"
);

// ------------------------------------------------------------------------ disco
try {
  const st = statfsSync(ROOT);
  const freeGb = (st.bavail * st.bsize) / 1024 ** 3;
  add(
    "disk",
    "Espaço livre",
    freeGb >= 10 ? "ok" : freeGb >= 4 ? "warn" : "fail",
    `${freeGb.toFixed(1)} GiB livres no volume do kit`,
    freeGb >= 10 ? null : "libere espaço: a cópia do alvo pode ter vários GB"
  );
} catch {
  add("disk", "Espaço livre", "warn", "não foi possível medir", null);
}

// ---------------------------------------------------------------------- resumo
const summary = {
  ok: checks.filter((c) => c.status === "ok").length,
  warn: checks.filter((c) => c.status === "warn").length,
  fail: checks.filter((c) => c.status === "fail").length,
};
const fixes = [...new Set(checks.filter((c) => c.fix && c.status !== "ok").map((c) => c.fix))];
const ok = summary.fail === 0;

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        schema: "cleanroom-preflight/v1",
        generatedAt: new Date().toISOString(),
        root: ROOT,
        platform: { os: platform(), arch: arch(), release: release(), wsl: isWsl, gitBash: isGitBash },
        summary,
        ok,
        checks,
        nextActions: fixes,
      },
      null,
      2
    )
  );
  process.exit(ok ? 0 : 1);
}

const mark = { ok: "ok  ", warn: "aviso", fail: "FALHA" };
console.log("Pré-voo do kit de clean room");
console.log(`  ${platform()} ${arch()}${isWsl ? " (WSL)" : ""} · ${ROOT}`);
console.log("");
for (const c of checks) console.log(`  ${mark[c.status].padEnd(6)} ${c.label.padEnd(18)} ${c.detail}`);
console.log("");
console.log(`Resumo: ${summary.ok} ok · ${summary.warn} aviso(s) · ${summary.fail} falha(s)`);

if (fixes.length) {
  console.log("");
  console.log("Correções sugeridas (na ordem):");
  fixes.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log("");
  console.log("Depois de corrigir, rode de novo: node scripts/preflight.mjs");
}

if (!ok) {
  console.log("");
  console.log("Há falhas bloqueantes. No Codex, use o prompt de docs/09-reparo-com-codex.md.");
}
process.exit(ok ? 0 : 1);
