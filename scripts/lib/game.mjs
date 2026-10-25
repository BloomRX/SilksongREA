import os from 'node:os';
import path from 'node:path';
import { open, readFile, readdir } from 'node:fs/promises';
import {
  ensureDir,
  isDirectory,
  isFile,
  pathExists,
  relativePosix,
  runProcess,
  sha256File,
  walkFiles,
  writeFileAtomic,
} from './utils.mjs';

export const STEAM_APP_ID = '1030300';
export const DEFAULT_GAME_DIRECTORY = 'Hollow Knight Silksong';

function decodeVdfToken(token) {
  const inner = token.slice(1, -1);
  let result = '';
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index] === '\\' && index + 1 < inner.length && ['\\', '"'].includes(inner[index + 1])) {
      result += inner[index + 1];
      index += 1;
    } else {
      result += inner[index];
    }
  }
  return result;
}

export function parseVdf(text) {
  const withoutComments = String(text).replace(/^\s*\/\/.*$/gm, '');
  const tokens = withoutComments.match(/"(?:\\.|[^"\\])*"|[{}]/g) || [];
  let cursor = 0;

  function parseObject() {
    const result = {};
    while (cursor < tokens.length) {
      const token = tokens[cursor];
      if (token === '}') {
        cursor += 1;
        return result;
      }
      if (token === '{' || !token.startsWith('"')) {
        cursor += 1;
        continue;
      }
      const key = decodeVdfToken(token);
      cursor += 1;
      if (tokens[cursor] === '{') {
        cursor += 1;
        result[key] = parseObject();
      } else if (tokens[cursor]?.startsWith('"')) {
        result[key] = decodeVdfToken(tokens[cursor]);
        cursor += 1;
      }
    }
    return result;
  }

  return parseObject();
}

async function queryRegistry(key, valueName) {
  if (process.platform !== 'win32') return undefined;
  const result = await runProcess({
    command: 'reg.exe',
    args: ['query', key, '/v', valueName],
    timeoutMs: 10000,
  });
  if (!result.ok) return undefined;
  const lines = result.stdout.split(/\r?\n/);
  for (const line of lines) {
    const match = line.trim().match(new RegExp(`^${valueName}\\s+REG_(?:SZ|EXPAND_SZ)\\s+(.+)$`, 'i'));
    if (match) return match[1].trim();
  }
  return undefined;
}

function uniqueDirectories(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!value) continue;
    const normalized = path.resolve(value);
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

export async function discoverSteamLibraries() {
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(
      await queryRegistry('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
      await queryRegistry('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
      process.env.STEAM_PATH,
      process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Steam') : undefined,
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Steam') : undefined,
    );
  }

  const libraries = [];
  for (const steamRoot of uniqueDirectories(candidates)) {
    const libraryFile = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
    if (await isFile(libraryFile)) {
      try {
        const parsed = parseVdf(await readFile(libraryFile, 'utf8'));
        const entries = parsed.libraryfolders || parsed.LibraryFolders || {};
        for (const [key, value] of Object.entries(entries)) {
          if (!/^\d+$/.test(key)) continue;
          if (typeof value === 'string') libraries.push(value);
          else if (value && typeof value === 'object' && value.path) libraries.push(value.path);
        }
      } catch {
        // The explicit Steam root remains a candidate even if the VDF is malformed.
      }
    }
    libraries.push(steamRoot);
  }

  if (process.platform === 'win32') {
    for (let code = 65; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`;
      if (await isDirectory(drive)) {
        libraries.push(path.join(drive, 'SteamLibrary'), path.join(drive, 'Steam'));
      }
    }
  }
  return uniqueDirectories(libraries);
}

export async function findSteamGame() {
  const matches = [];
  for (const library of await discoverSteamLibraries()) {
    const steamapps = path.join(library, 'steamapps');
    const manifestPath = path.join(steamapps, `appmanifest_${STEAM_APP_ID}.acf`);
    if (await isFile(manifestPath)) {
      try {
        const manifest = parseVdf(await readFile(manifestPath, 'utf8'));
        const state = manifest.AppState || manifest.appstate || {};
        const installDirectory = state.installdir || state.InstallDir || DEFAULT_GAME_DIRECTORY;
        matches.push({
          root: path.resolve(steamapps, 'common', installDirectory),
          manifestPath,
          manifest: state,
          source: 'steam-manifest',
        });
      } catch {
        matches.push({
          root: path.resolve(steamapps, 'common', DEFAULT_GAME_DIRECTORY),
          manifestPath,
          manifest: {},
          source: 'steam-manifest',
        });
      }
    } else {
      const conventional = path.join(steamapps, 'common', DEFAULT_GAME_DIRECTORY);
      if (await isDirectory(conventional)) {
        matches.push({ root: conventional, manifestPath: undefined, manifest: {}, source: 'steam-convention' });
      }
    }
  }
  return matches;
}

async function findFirstFile(root, name, maxDepth = 5) {
  const lowerName = name.toLowerCase();
  for await (const entry of walkFiles(root, { maxDepth })) {
    if (!entry.error && !entry.symlink && path.basename(entry.path).toLowerCase() === lowerName) {
      return entry.path;
    }
  }
  return undefined;
}

export async function inspectGameLayout(gameRoot) {
  const root = path.resolve(gameRoot);
  if (!(await isDirectory(root))) {
    throw new Error(`A pasta do jogo não existe: ${root}`);
  }

  const dataDirectories = [];
  const searchRoots = [root];
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.isSymbolicLink() && ['content', 'contents'].includes(entry.name.toLowerCase())) {
        searchRoots.push(path.join(root, entry.name));
      }
    }
  } catch {
    // The directory check above provides the actionable failure.
  }

  for (const searchRoot of searchRoots) {
    let entries = [];
    try {
      entries = await readdir(searchRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink() && entry.name.toLowerCase().endsWith('_data')) {
        dataDirectories.push(path.join(searchRoot, entry.name));
      }
    }
  }

  let managedAssembly;
  let managedDirectory;
  const managedAssemblies = [];
  for (const dataDirectory of dataDirectories) {
    const candidateDirectory = path.join(dataDirectory, 'Managed');
    if (!(await isDirectory(candidateDirectory))) continue;
    managedDirectory ||= candidateDirectory;
    const entries = await readdir(candidateDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.dll')) continue;
      const absolute = path.join(candidateDirectory, entry.name);
      managedAssemblies.push(absolute);
      if (entry.name.toLowerCase() === 'assembly-csharp.dll') managedAssembly ||= absolute;
    }
  }

  let mainExecutable;
  const rootEntries = await readdir(root, { withFileTypes: true });
  const executables = rootEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
    .map((entry) => path.join(root, entry.name));
  mainExecutable = executables.find((candidate) => path.basename(candidate).toLowerCase() === 'hollow knight silksong.exe');
  mainExecutable ||= executables.find((candidate) => /silksong/i.test(path.basename(candidate)));
  mainExecutable ||= executables.find((candidate) => !/(unins|crash|handler|setup|redist)/i.test(path.basename(candidate)));

  const nativeCandidates = [
    path.join(root, 'GameAssembly.dll'),
    path.join(root, 'UnityPlayer.dll'),
  ];
  const gameAssembly = (await isFile(nativeCandidates[0])) ? nativeCandidates[0] : undefined;
  const unityPlayer = (await isFile(nativeCandidates[1])) ? nativeCandidates[1] : undefined;

  let il2cppMetadata;
  for (const dataDirectory of dataDirectories) {
    const conventional = path.join(dataDirectory, 'il2cpp_data', 'Metadata', 'global-metadata.dat');
    if (await isFile(conventional)) {
      il2cppMetadata = conventional;
      break;
    }
  }
  if (!il2cppMetadata && dataDirectories.length > 0) {
    il2cppMetadata = await findFirstFile(dataDirectories[0], 'global-metadata.dat', 5);
  }

  const runtime = managedAssembly ? 'Unity Mono' : (il2cppMetadata || gameAssembly ? 'Unity IL2CPP' : 'desconhecido');
  return {
    root,
    dataDirectories,
    managedDirectory,
    managedAssembly,
    managedAssemblies: managedAssemblies.sort(),
    mainExecutable,
    gameAssembly,
    unityPlayer,
    il2cppMetadata,
    runtime,
  };
}

export async function resolveGame({ explicitPath, savedPath } = {}) {
  const candidates = [];
  if (explicitPath) candidates.push({ root: explicitPath, source: 'argumento', manifest: {} });
  if (process.env.SILKSONG_GAME_PATH) {
    candidates.push({ root: process.env.SILKSONG_GAME_PATH, source: 'ambiente', manifest: {} });
  }
  if (savedPath) candidates.push({ root: savedPath, source: 'config-local', manifest: {} });
  candidates.push(...await findSteamGame());

  const failures = [];
  for (const candidate of candidates) {
    try {
      const layout = await inspectGameLayout(candidate.root);
      if (layout.runtime !== 'desconhecido' || layout.dataDirectories.length > 0) {
        return { ...layout, source: candidate.source, manifest: candidate.manifest || {}, manifestPath: candidate.manifestPath };
      }
      failures.push(`${candidate.root}: nenhuma pasta *_Data reconhecida`);
    } catch (error) {
      failures.push(`${candidate.root}: ${error.message}`);
    }
  }
  const error = new Error('Não foi possível localizar uma instalação compatível do Silksong.');
  error.candidates = failures;
  return Promise.reject(error);
}

function extensionOf(file) {
  const extension = path.extname(file).toLowerCase();
  return extension || '[sem extensão]';
}

export async function createInventory(layout, localRunDirectory) {
  const records = [];
  const byExtension = new Map();
  const byTopLevel = new Map();
  const unreadable = [];
  let totalBytes = 0;
  let symlinkCount = 0;

  for await (const entry of walkFiles(layout.root)) {
    if (entry.error) {
      unreadable.push({ path: entry.relativePath, error: entry.error });
      continue;
    }
    if (entry.symlink) {
      symlinkCount += 1;
      continue;
    }
    const record = { path: entry.relativePath, bytes: entry.size };
    records.push(record);
    totalBytes += entry.size;
    const extension = extensionOf(entry.path);
    const extensionData = byExtension.get(extension) || { count: 0, bytes: 0 };
    extensionData.count += 1;
    extensionData.bytes += entry.size;
    byExtension.set(extension, extensionData);
    const topLevel = entry.relativePath.split('/')[0] || '[raiz]';
    const topData = byTopLevel.get(topLevel) || { count: 0, bytes: 0 };
    topData.count += 1;
    topData.bytes += entry.size;
    byTopLevel.set(topLevel, topData);
  }

  records.sort((a, b) => a.path.localeCompare(b.path));
  const csv = ['caminho_relativo,bytes'];
  for (const record of records) {
    csv.push(`"${record.path.replaceAll('"', '""')}",${record.bytes}`);
  }
  const inventoryPath = path.join(localRunDirectory, 'inventory-files.csv');
  await writeFileAtomic(inventoryPath, `${csv.join('\r\n')}\r\n`);

  const keyFiles = uniqueDirectories([
    layout.mainExecutable,
    layout.managedAssembly,
    layout.unityPlayer,
    layout.gameAssembly,
    layout.il2cppMetadata,
  ]);
  const hashes = [];
  for (const file of keyFiles) {
    try {
      const information = await readFileInformation(file);
      hashes.push({
        path: relativePosix(layout.root, file),
        bytes: information.bytes,
        sha256: await sha256File(file),
      });
    } catch (error) {
      hashes.push({ path: relativePosix(layout.root, file), error: error.message });
    }
  }

  return {
    summary: {
      fileCount: records.length,
      totalBytes,
      symlinkCount,
      unreadableCount: unreadable.length,
      byExtension: [...byExtension.entries()]
        .map(([extension, value]) => ({ extension, ...value }))
        .sort((a, b) => b.bytes - a.bytes),
      byTopLevel: [...byTopLevel.entries()]
        .map(([name, value]) => ({ name, ...value }))
        .sort((a, b) => b.bytes - a.bytes),
      hashes,
    },
    records,
    unreadable,
    inventoryPath,
  };
}

async function readFileInformation(target) {
  const handle = await open(target, 'r');
  try {
    const information = await handle.stat();
    return { bytes: information.size };
  } finally {
    await handle.close();
  }
}

export async function findPlayerLogs() {
  if (process.platform !== 'win32') return [];
  const localLow = path.join(os.homedir(), 'AppData', 'LocalLow');
  const candidates = [
    path.join(localLow, 'Team Cherry', 'Hollow Knight Silksong', 'Player.log'),
    path.join(localLow, 'Team Cherry', 'Hollow Knight Silksong', 'Player-prev.log'),
    path.join(localLow, 'unity.Team-Cherry.Silksong', 'Player.log'),
  ];
  const logs = [];
  for (const candidate of candidates) {
    if (await isFile(candidate)) logs.push(candidate);
  }
  return uniqueDirectories(logs);
}

async function readTail(target, maximumBytes = 4 * 1024 * 1024) {
  const handle = await open(target, 'r');
  try {
    const information = await handle.stat();
    const length = Math.min(maximumBytes, information.size);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, Math.max(0, information.size - length));
    return {
      text: buffer.toString('utf8'),
      bytes: information.size,
      truncated: information.size > length,
    };
  } finally {
    await handle.close();
  }
}

function normalizeLogGroup(line) {
  return line
    .replace(/0x[0-9a-f]+/gi, '0x…')
    .replace(/\b\d{2,}\b/g, 'N')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export async function analyzePlayerLogs(logPaths, localRunDirectory) {
  const results = [];
  await ensureDir(localRunDirectory);
  for (let index = 0; index < logPaths.length; index += 1) {
    const logPath = logPaths[index];
    try {
      const raw = await readTail(logPath);
      const lines = raw.text.split(/\r?\n/);
      if (raw.truncated && lines.length > 0) lines.shift();
      const interesting = lines.filter((line) => /(?:\b(?:error|failed|failure|fatal|crash|assert|warning|warn|unhandled)\b|exception|nullreference|missingreference)/i.test(line));
      const groups = new Map();
      for (const line of interesting) {
        const key = normalizeLogGroup(line);
        const group = groups.get(key) || { message: line.trim().slice(0, 500), count: 0 };
        group.count += 1;
        groups.set(key, group);
      }
      const localCopy = path.join(localRunDirectory, `player-${index + 1}.log`);
      await writeFileAtomic(localCopy, raw.text);
      results.push({
        path: logPath,
        bytes: raw.bytes,
        truncated: raw.truncated,
        lineCount: lines.length,
        matchCount: interesting.length,
        groups: [...groups.values()].sort((a, b) => b.count - a.count),
        excerpt: interesting.slice(-120),
        localCopy,
      });
    } catch (error) {
      results.push({ path: logPath, error: error.message });
    }
  }
  return results;
}
