import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
} from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { finished } from 'node:stream/promises';

export const TOOL_VERSION = '1.0.0';

export async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function isFile(target) {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

export async function isDirectory(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

export async function ensureDir(target) {
  await mkdir(target, { recursive: true });
  return target;
}

export async function readJson(target, fallback = undefined) {
  try {
    return JSON.parse(await readFile(target, 'utf8'));
  } catch (error) {
    if (fallback !== undefined && (error?.code === 'ENOENT' || error instanceof SyntaxError)) {
      return fallback;
    }
    throw error;
  }
}

export async function writeFileAtomic(target, contents) {
  await ensureDir(path.dirname(target));
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, 'wx');
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, target);
  } catch (error) {
    if (process.platform === 'win32' && (error?.code === 'EEXIST' || error?.code === 'EPERM')) {
      await rm(target, { force: true });
      await rename(temporary, target);
    } else {
      await rm(temporary, { force: true });
      throw error;
    }
  }
}

export async function writeJsonAtomic(target, value) {
  await writeFileAtomic(target, `${JSON.stringify(value, null, 2)}\n`);
}

export function toPosix(value) {
  return value.split(path.sep).join('/');
}

export function relativePosix(from, target) {
  return toPosix(path.relative(from, target));
}

export function safeFileName(value) {
  const sanitized = String(value)
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return sanitized || 'item';
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'desconhecido';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const index = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '—';
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

export async function sha256File(target) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const input = createReadStream(target);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function* walkFiles(root, { maxDepth = Number.POSITIVE_INFINITY } = {}) {
  async function* visit(directory, depth) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const synthetic = {
        path: directory,
        relativePath: relativePosix(root, directory),
        error: error?.message || String(error),
      };
      yield synthetic;
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relativePath = relativePosix(root, absolute);
      if (entry.isSymbolicLink()) {
        yield { path: absolute, relativePath, symlink: true };
        continue;
      }
      if (entry.isDirectory()) {
        if (depth < maxDepth) yield* visit(absolute, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const information = await stat(absolute);
        yield { path: absolute, relativePath, size: information.size, mtime: information.mtime };
      } catch (error) {
        yield { path: absolute, relativePath, error: error?.message || String(error) };
      }
    }
  }
  yield* visit(root, 0);
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SECRET_PATTERNS = [
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\b(?:sk|rk)-[A-Za-z0-9_-]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /https?:\/\/[^/\s@]+@/gi,
  /[?&](?:access_token|token|sig|signature)=[^&\s]+/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b7656119\d{10}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function sanitizeText(input, replacements = {}) {
  let text = String(input ?? '');
  const entries = Object.entries(replacements)
    .filter(([, source]) => typeof source === 'string' && source.length > 0)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [label, source] of entries) {
    const variants = new Set([source, source.replaceAll('\\', '/'), source.replaceAll('/', '\\')]);
    for (const variant of variants) {
      if (!variant) continue;
      text = text.replace(new RegExp(escapeRegExp(variant), 'gi'), label);
    }
  }
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, '<SEGREDO_REMOVIDO>');
  text = text
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, '<USUARIO>')
    .replace(/\/home\/[^/\s]+/g, '<USUARIO>')
    .replace(/\/Users\/[^/\s]+/g, '<USUARIO>');
  return text;
}

export function containsSensitiveContent(text) {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) return true;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    const found = pattern.test(text);
    pattern.lastIndex = 0;
    if (found) return true;
  }
  return /[A-Za-z]:\\Users\\[^\\\s]+|\/home\/[^/\s]+|\/Users\/[^/\s]+/.test(text);
}

function captureChunk(current, chunk, maximum) {
  if (current.length >= maximum) return current;
  return current + chunk.toString('utf8', 0, Math.min(chunk.length, maximum - current.length));
}

async function stopProcess(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.on('error', () => child.kill('SIGTERM'));
    return;
  }
  child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
}

export async function runProcess({
  command,
  args = [],
  cwd,
  env = {},
  timeoutMs = 120000,
  stdoutPath,
  stderrPath,
  maxCaptureBytes = 1024 * 1024,
}) {
  const started = Date.now();
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let outputStreams = [];

  if (stdoutPath) {
    await ensureDir(path.dirname(stdoutPath));
    outputStreams.push(createWriteStream(stdoutPath, { flags: 'w' }));
  }
  if (stderrPath) {
    await ensureDir(path.dirname(stderrPath));
    outputStreams.push(createWriteStream(stderrPath, { flags: 'w' }));
  }

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        ok: false,
        code: null,
        signal: null,
        error,
        timedOut,
        durationMs: Date.now() - started,
        stdout,
        stderr: String(error),
      });
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      void stopProcess(child);
    }, timeoutMs);
    timer.unref();

    const stdoutStream = stdoutPath ? outputStreams[0] : null;
    const stderrStream = stderrPath ? outputStreams[stdoutPath ? 1 : 0] : null;
    if (stdoutStream) child.stdout.pipe(stdoutStream);
    if (stderrStream) child.stderr.pipe(stderrStream);
    child.stdout.on('data', (chunk) => {
      stdout = captureChunk(stdout, chunk, maxCaptureBytes);
    });
    child.stderr.on('data', (chunk) => {
      stderr = captureChunk(stderr, chunk, maxCaptureBytes);
    });

    let spawnError;
    child.on('error', (error) => {
      spawnError = error;
    });
    child.on('close', (code, signal) => {
      void (async () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        for (const stream of outputStreams) stream.end();
        try {
          await Promise.all(outputStreams.map((stream) => finished(stream)));
        } catch {
          // The process result remains useful even if a diagnostic stream failed.
        }
        resolve({
          ok: code === 0 && !timedOut && !spawnError,
          code,
          signal,
          error: spawnError,
          timedOut,
          durationMs: Date.now() - started,
          stdout,
          stderr: spawnError ? `${stderr}${stderr ? '\n' : ''}${spawnError.message}` : stderr,
          stdoutPath,
          stderrPath,
        });
      })();
    });
  });
}

export function errorMessage(error) {
  if (!error) return 'Erro desconhecido';
  if (typeof error === 'string') return error;
  return error.message || String(error);
}

export function tail(text, maximum = 4000) {
  const value = String(text ?? '').trim();
  if (value.length <= maximum) return value;
  return `… [trecho anterior omitido]\n${value.slice(-maximum)}`;
}

export function parseJsonOutput(text) {
  const value = String(text ?? '').trim();
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    const firstObject = value.indexOf('{');
    const lastObject = value.lastIndexOf('}');
    if (firstObject >= 0 && lastObject > firstObject) {
      try {
        return JSON.parse(value.slice(firstObject, lastObject + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

export function clampInteger(value, minimum, maximum, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

export async function removeDirectoryContents(directory) {
  if (!(await pathExists(directory))) return;
  const entries = await readdir(directory);
  await Promise.all(entries.map((entry) => rm(path.join(directory, entry), {
    recursive: true,
    force: true,
  })));
}
