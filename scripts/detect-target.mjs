#!/usr/bin/env node
/**
 * Detecta o tipo de alvo (jogo ou app) a partir dos arquivos em
 * targets/<slug>/analysis/artifacts e recomenda a rota no REA.
 *
 * Uso:
 *   node scripts/detect-target.mjs <diretório> [--json]
 *   ./scripts/detect-target.sh <slug> [--json]
 *
 * Não abre nem executa o alvo: lê nomes, extensões e alguns bytes de cabeçalho.
 * Tudo local, nada é enviado a lugar nenhum.
 */
import { closeSync, openSync, readSync, readdirSync, statSync, lstatSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const MAX_FILES = 20000;
const MAX_DEPTH = 8;

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const dirArg = args.find((a) => !a.startsWith("-"));

if (!dirArg || args.includes("-h") || args.includes("--help")) {
  console.error("uso: node scripts/detect-target.mjs <diretório-de-artefatos> [--json]");
  process.exit(2);
}

const root = resolve(dirArg);
let rootStat;
try {
  rootStat = statSync(root);
} catch {
  console.error(`erro: diretório não encontrado: ${root}`);
  process.exit(2);
}
if (!rootStat.isDirectory()) {
  console.error(`erro: ${root} não é um diretório`);
  process.exit(2);
}

// ------------------------------------------------------------------ inventário
const files = [];
let truncated = false;
const stack = [{ dir: root, depth: 0 }];

while (stack.length) {
  const { dir, depth } = stack.pop();
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH) stack.push({ dir: full, depth: depth + 1 });
      continue;
    }
    if (!entry.isFile()) continue;
    let size = 0;
    try {
      size = lstatSync(full).size;
    } catch {
      continue;
    }
    files.push({ path: full, rel: relative(root, full), name: entry.name, ext: extname(entry.name).toLowerCase(), size });
    if (files.length >= MAX_FILES) {
      truncated = true;
      break;
    }
  }
  if (truncated) break;
}

if (files.length === 0) {
  console.log(
    jsonOut
      ? JSON.stringify(
          { schema: "cleanroom-target-detection/v1", root, scanned: { files: 0, truncated: false }, detections: [] },
          null,
          2
        )
      : `Nenhum arquivo em ${root}.`
  );
  process.exit(0);
}

files.sort((a, b) => a.rel.localeCompare(b.rel));

// --------------------------------------------------------------------- leitura
const headCache = new Map();
/** Lê só o necessário: começa com poucos bytes e cresce se um detector pedir. */
function head(file, bytes = 16) {
  let buf = headCache.get(file.path);
  const need = Math.min(bytes, file.size || bytes);
  if (!buf || buf.length < need) {
    const len = need;
    buf = Buffer.alloc(len);
    let fd;
    try {
      fd = openSync(file.path, "r");
      readSync(fd, buf, 0, len, 0);
    } catch {
      /* arquivo ilegível: trata como vazio */
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
    headCache.set(file.path, buf);
  }
  return buf.subarray(0, Math.min(bytes, buf.length));
}

const startsWith = (buf, ascii) => buf.length >= ascii.length && buf.subarray(0, ascii.length).toString("latin1") === ascii;
const magic = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

function peKind(file) {
  const first = head(file, 2);
  if (!magic(first, [0x4d, 0x5a])) return null; // MZ
  const b = head(file, 4096);
  if (b.length < 0x40) return null;
  const peOff = b.readUInt32LE(0x3c);
  if (peOff + 26 > b.length || b.subarray(peOff, peOff + 4).toString("latin1") !== "PE\0\0") return null;
  const magicOpt = b.readUInt16LE(peOff + 24);
  const pe32plus = magicOpt === 0x20b;
  if (magicOpt !== 0x10b && !pe32plus) return { kind: "pe" };
  const opt = peOff + 24;
  const numDirsOff = opt + (pe32plus ? 108 : 92);
  const numDirs = numDirsOff + 4 <= b.length ? b.readUInt32LE(numDirsOff) : 0;
  const dirOff = opt + (pe32plus ? 112 : 96);
  if (numDirs > 14) {
    const cli = dirOff + 14 * 8;
    if (cli + 8 <= b.length) {
      const rva = b.readUInt32LE(cli);
      if (rva !== 0) return { kind: "dotnet" };
    }
  }
  return { kind: "pe" };
}

function isZip(file) {
  return magic(head(file, 8), [0x50, 0x4b, 0x03, 0x04]) || magic(head(file, 8), [0x50, 0x4b, 0x05, 0x06]);
}

function elf(file) {
  return magic(head(file, 8), [0x7f, 0x45, 0x4c, 0x46]);
}

function macho(file) {
  const b = head(file, 8);
  return (
    magic(b, [0xfe, 0xed, 0xfa, 0xce]) ||
    magic(b, [0xce, 0xfa, 0xed, 0xfe]) ||
    magic(b, [0xfe, 0xed, 0xfa, 0xcf]) ||
    magic(b, [0xcf, 0xfa, 0xed, 0xfe]) ||
    magic(b, [0xca, 0xfe, 0xba, 0xbe])
  );
}

function pyinstaller(file) {
  if (!file || (!peKind(file) && !elf(file))) return false;
  const b = head(file, 1024 * 1024);
  return b.includes("MEI\f\v\n\v\0") || b.includes("PyInstaller") || b.includes("pyi-");
}

// ------------------------------------------------------------------- detecções
const names = new Set(files.map((f) => f.name));
const rels = files.map((f) => f.rel);
const find = (re) => files.find((f) => re.test(f.rel) || re.test(f.name));

const hasIl2cppBinary = files.some((f) => /^(GameAssembly\.(dll|so|dylib)|libil2cpp\.so)$/i.test(f.name));
const hasIl2cppMeta = files.some((f) => /global-metadata\.dat$/i.test(f.rel));
const hasUnityMono = files.some((f) => /Assembly-CSharp\.dll$/i.test(f.rel)) || files.some((f) => /(^|\/)Managed\/[^/]+\.dll$/i.test(f.rel));
const pck = files.find((f) => startsWith(head(f, 8), "GDPC") || f.ext === ".pck");
const unityfs = files.find((f) => startsWith(head(f, 16), "UnityFS") || f.ext === ".unity3d" || f.ext === ".bundle");
const asar = files.find((f) => f.ext === ".asar" || /(^|\/)app\.asar$/i.test(f.rel));
const apk = files.find((f) => [".apk", ".aab", ".xapk", ".apkm"].includes(f.ext));
const apple = files.find((f) => [".ipa", ".dmg", ".pkg"].includes(f.ext) || f.name === "Info.plist" || /\.app\//.test(f.rel));
const har = files.find((f) => f.ext === ".har");
const wasm = files.find((f) => f.ext === ".wasm" || magic(head(f, 4), [0x00, 0x61, 0x73, 0x6d]));
const sqlite = files.find((f) => startsWith(head(f, 16), "SQLite format 3\0") || [".db", ".sqlite", ".sqlite3"].includes(f.ext));
const pcap = files.find(
  (f) => f.ext === ".pcap" || f.ext === ".pcapng" || magic(head(f, 4), [0xd4, 0xc3, 0xb2, 0xa1]) || magic(head(f, 4), [0xa1, 0xb2, 0xc3, 0xd4])
);
const nes = files.find((f) => f.ext === ".nes" || startsWith(head(f, 4), "NES\u001a"));
const rom = files.find((f) => [".dol", ".gba", ".gb", ".nds", ".n64", ".z64", ".iso", ".cso", ".sfc", ".smc"].includes(f.ext));
const firmware = files.find((f) => [".uf2", ".dfu", ".hex", ".trx", ".img", ".bin"].includes(f.ext));
const nativeFile = files.find((f) => elf(f) || macho(f) || (peKind(f) && peKind(f).kind === "pe"));
const dotnetFile = files.find((f) => peKind(f)?.kind === "dotnet");
const zipFile = files.find((f) => isZip(f));
const html = files.find((f) => /\.html?$/i.test(f.ext));
const js = files.find((f) => [".js", ".mjs", ".cjs"].includes(f.ext));

const detections = [];
const add = (d) => detections.push(d);

if (hasIl2cppBinary && hasIl2cppMeta) {
  add({
    id: "unity-il2cpp",
    label: "Unity IL2CPP",
    confidence: "alta",
    evidence: [files.find((f) => /^(GameAssembly|libil2cpp)/i.test(f.name)).rel, files.find((f) => /global-metadata\.dat$/i.test(f.rel)).rel],
    first_tool: "inspect_il2cpp_metadata",
    next_steps: [
      "inspect_il2cpp_metadata com path do global-metadata.dat e binary_path do GameAssembly/libil2cpp",
      "open_binary no binário nativo + provedor para os métodos que interessam",
      "descreva só o comportamento observável; nada de nomes internos na spec",
    ],
    provider: "obrigatório",
    provider_options: ["ghidra", "hopper", "ida", "kuna"],
    tool_families: ["native", "artifact", "session"],
    guide: "docs/03-alvos-jogos.md",
  });
} else if (hasIl2cppBinary || hasIl2cppMeta) {
  add({
    id: "unity-il2cpp-incompleto",
    label: "Unity IL2CPP (incompleto)",
    confidence: "média",
    evidence: [hasIl2cppMeta ? "global-metadata.dat" : "binário il2cpp sem metadados"],
    first_tool: "inspect_il2cpp_metadata",
    next_steps: [
      "Confirme se o build está completo: precisa do global-metadata.dat E do binário il2cpp",
      "Verifique se o jogo usa proteção/criptografia de metadados",
    ],
    provider: "obrigatório",
    tool_families: ["native", "artifact", "session"],
    guide: "docs/03-alvos-jogos.md",
  });
}

if (unityfs) {
  add({
    id: "unity-assetbundle",
    label: "Unity AssetBundle (UnityFS)",
    confidence: "alta",
    evidence: [unityfs.rel],
    first_tool: "inspect_artifact",
    next_steps: ["inspect-artifact para inventário", "extract-artifact para membros (sem reutilizar assets)"],
    provider: "não",
    tool_families: ["artifact", "session"],
    guide: "docs/03-alvos-jogos.md",
    notes: ["headers 6–8; v9 e LZMA não suportados", "bundle criptografado: diretório desconhecido, o REA não descriptografa"],
  });
}

if (pck) {
  add({
    id: "godot-pck",
    label: "Godot PCK",
    confidence: startsWith(head(pck, 8), "GDPC") ? "alta" : "média",
    evidence: [pck.rel],
    first_tool: "inspect_artifact",
    next_steps: ["inspect-artifact no .pck", "extract-artifact para ver a estrutura (sem reutilizar assets)"],
    provider: "não",
    tool_families: ["artifact", "session"],
    guide: "docs/03-alvos-jogos.md",
    notes: ["formatos 1–4", "PCK embutido no executável é localizado pelo trailer"],
  });
}

if (hasUnityMono) {
  add({
    id: "unity-mono",
    label: "Unity Mono (assemblies gerenciados)",
    confidence: "alta",
    evidence: [files.find((f) => /Assembly-CSharp\.dll$/i.test(f.rel) || /(^|\/)Managed\//i.test(f.rel)).rel],
    first_tool: "inspect_managed_artifact",
    next_steps: ["inspect_managed_artifact", "project_managed_application_graph", "compare_managed_members entre builds"],
    provider: "não",
    tool_families: ["managed", "session"],
    guide: "docs/03-alvos-jogos.md",
  });
}

if (asar) {
  add({
    id: "electron-asar",
    label: "Electron / aplicação JavaScript",
    confidence: "alta",
    evidence: [asar.rel],
    first_tool: "analyze_javascript_application",
    next_steps: [
      "analyze_javascript_application no ASAR ou na árvore extraída",
      "trace_application_feature para seguir UI → IPC → main",
    ],
    provider: "não",
    tool_families: ["browser", "electron", "application", "javascript-runtime", "session"],
    guide: "docs/04-alvos-apps.md",
    notes: ["bundle minificado é expressão do original: descreva comportamento, não cole código"],
  });
}

if (apk) {
  add({
    id: "android",
    label: "Aplicativo Android",
    confidence: "alta",
    evidence: [apk.rel],
    first_tool: "inspect_android_package",
    next_steps: ["inspect_android_package", "project_android_application_graph", "JADX para código Java/Kotlin"],
    provider: "opcional (JADX)",
    provider_options: ["jadx"],
    tool_families: ["android", "adb", "apktool", "session"],
    guide: "docs/04-alvos-apps.md",
  });
}

if (apple) {
  add({
    id: "apple",
    label: "Aplicativo Apple (macOS/iOS)",
    confidence: "média",
    evidence: [apple.rel],
    first_tool: "open_bundle_resources",
    next_steps: ["open_bundle_resources para plists/assets", "open_binary no Mach-O com provedor"],
    provider: "opcional (Mach-O)",
    tool_families: ["native", "artifact", "session"],
    guide: "docs/04-alvos-apps.md",
  });
}

if (dotnetFile) {
  add({
    id: "dotnet",
    label: ".NET gerenciado",
    confidence: "alta",
    evidence: [dotnetFile.rel],
    first_tool: "inspect_managed_artifact",
    next_steps: ["inspect_managed_artifact", "compare_managed_members", "project_managed_application_graph"],
    provider: "não",
    tool_families: ["managed", "session"],
    guide: "docs/04-alvos-apps.md",
    notes: [".NET NativeAOT é binário nativo: exige Ghidra e o workflow NativeAOT"],
  });
}

const pyFile = files.find((f) => (peKind(f)?.kind === "pe" || elf(f)) && pyinstaller(f));
if (pyFile) {
  const py = pyFile;
  add({
    id: "python-packaged",
    label: "Aplicativo Python empacotado (PyInstaller)",
    confidence: "média",
    evidence: [py.rel],
    first_tool: "open_binary",
    next_steps: ["open_binary no executável", "inspect_artifact com detail summary para o inventário", "o CArchive é a aplicação; o bootloader é só o prefixo"],
    provider: "não",
    tool_families: ["artifact", "session"],
    guide: "docs/04-alvos-apps.md",
  });
}

const isIl2cppBinary = (f) => /^(GameAssembly\.(dll|so|dylib)|libil2cpp\.so)$/i.test(f.name);
if (nativeFile && !dotnetFile && !pyFile && !(hasIl2cppBinary && isIl2cppBinary(nativeFile))) {
  add({
    id: "native",
    label: "Binário nativo",
    confidence: "alta",
    evidence: [nativeFile.rel],
    first_tool: "open_binary",
    next_steps: ["open_binary + binary_session", "pseudocódigo/assembly só para entender; spec descreve comportamento", "snapshot para reuso"],
    provider: "obrigatório",
    provider_options: ["ghidra", "hopper", "ida", "kuna"],
    tool_families: ["native", "artifact", "session"],
    guide: "docs/03-alvos-jogos.md",
  });
}

if (wasm) {
  add({
    id: "wasm",
    label: "WebAssembly",
    confidence: "alta",
    evidence: [wasm.rel],
    first_tool: "inspect_artifact",
    next_steps: ["inspeção do artefato WASM", "compare_wasm_interfaces entre builds"],
    provider: "não",
    tool_families: ["artifact", "session"],
    guide: "docs/03-alvos-jogos.md",
  });
}

if (nes || rom) {
  const f = nes ?? rom;
  add({
    id: "rom",
    label: "Imagem de jogo / console",
    confidence: "média",
    evidence: [f.rel],
    first_tool: "open_binary",
    next_steps: ["open_binary na imagem", "Ghidra com o loader da plataforma (DOS/DOL/PSP/PPC/MIPS)", "analise apenas dumps que você mesmo fez"],
    provider: "obrigatório",
    tool_families: ["native", "artifact", "session"],
    guide: "docs/03-alvos-jogos.md",
    notes: ["nunca distribua ROMs, BIOS ou assets extraídos"],
  });
}

if (sqlite) {
  add({
    id: "sqlite",
    label: "Banco SQLite",
    confidence: "alta",
    evidence: [sqlite.rel],
    first_tool: "inspect_artifact",
    next_steps: ["inspeção do banco (somente leitura)", "não copie dados de usuários para a spec"],
    provider: "não",
    tool_families: ["artifact", "session"],
    guide: "docs/04-alvos-apps.md",
  });
}

if (pcap) {
  add({
    id: "pcap",
    label: "Captura de rede",
    confidence: "alta",
    evidence: [pcap.rel],
    first_tool: "pcap analysis",
    next_steps: ["analise a captura da SUA sessão", "nada de tráfego de terceiros"],
    provider: "não",
    tool_families: ["pcap", "session"],
    guide: "docs/04-alvos-apps.md",
  });
}

if (har || (html && js && !asar)) {
  add({
    id: "web",
    label: "Aplicação web",
    confidence: har ? "alta" : "média",
    evidence: [har ? har.rel : html.rel],
    first_tool: "browser observation",
    next_steps: ["observe páginas/bundles", "capture sua própria sessão (HAR)", "documente o contrato de rede"],
    provider: "não",
    tool_families: ["browser", "pcap", "session", "javascript-runtime"],
    guide: "docs/04-alvos-apps.md",
  });
}

if (firmware && detections.length === 0) {
  add({
    id: "firmware",
    label: "Possível firmware/imagem",
    confidence: "baixa",
    evidence: [firmware.rel],
    first_tool: "inspect_firmware_regions",
    next_steps: ["inspect_firmware_regions", "extract_firmware (Binwalk/Unblob no Linux)"],
    provider: "não",
    tool_families: ["firmware", "session", "direct"],
    guide: "docs/04-alvos-apps.md",
    notes: ["só em hardware que você possui", "chaves/credenciais são achado de segurança, não material de spec"],
  });
}

if (zipFile && !apk && detections.length === 0) {
  add({
    id: "archive",
    label: "Arquivo compactado / container",
    confidence: "média",
    evidence: [zipFile.rel],
    first_tool: "inspect_artifact",
    next_steps: ["inspect_artifact para inventário", "identifique o membro que é a aplicação e rode a detecção nele"],
    provider: "não",
    tool_families: ["artifact", "session"],
    guide: "docs/04-alvos-apps.md",
  });
}

if (detections.length === 0) {
  add({
    id: "desconhecido",
    label: "Tipo não reconhecido",
    confidence: "baixa",
    evidence: files.slice(0, 5).map((f) => f.rel),
    first_tool: "inspect_artifact",
    next_steps: [
      "inspect_artifact para inventariar o conteúdo",
      "procure o executável/arquivo principal e rode a detecção de novo nele",
    ],
    provider: "desconhecido",
    tool_families: ["artifact", "session"],
    guide: "docs/00-metodo-clean-room.md",
  });
}

// ---------------------------------------------------------------------- saída
const result = {
  schema: "cleanroom-target-detection/v1",
  root,
  scanned: { files: files.length, truncated },
  primary: detections[0].id,
  detections,
};

if (jsonOut) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(`Alvo: ${root}`);
console.log(`Arquivos examinados: ${files.length}${truncated ? " (limite atingido)" : ""}`);
console.log("");
const d = detections[0];
console.log(`Detectado: ${d.label}  [confiança: ${d.confidence}]`);
for (const e of d.evidence.filter(Boolean).slice(0, 5)) console.log(`  evidência: ${e}`);
console.log(`  primeiro passo: ${d.first_tool}`);
console.log(`  provedor nativo: ${d.provider}`);
if (d.tool_families?.length) console.log(`  famílias MCP: ${d.tool_families.join(",")}`);
console.log(`  guia: ${d.guide}`);
for (const s of d.next_steps ?? []) console.log(`  - ${s}`);
for (const n of d.notes ?? []) console.log(`  ! ${n}`);

if (detections.length > 1) {
  console.log("");
  console.log("Outros componentes detectados:");
  for (const other of detections.slice(1)) console.log(`  - ${other.label} (${other.confidence}): ${other.first_tool}`);
}

console.log("");
console.log("Próximo passo sugerido:");
console.log(`  rea setup --client <claude_code|codex> --tool-families ${d.tool_families.join(",")}`);
