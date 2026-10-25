import path from 'node:path';
import { readFile, readdir, rm, stat } from 'node:fs/promises';
import {
  ensureDir,
  errorMessage,
  isFile,
  parseJsonOutput,
  pathExists,
  readJson,
  runProcess,
  safeFileName,
  tail,
  walkFiles,
  writeFileAtomic,
  writeJsonAtomic,
} from './utils.mjs';

export const REA_VERSION = '6.7.0';
export const ILSPY_VERSION = '11.1.0.9782';

export async function getReaInfo(repositoryRoot) {
  const packagePath = path.join(repositoryRoot, 'node_modules', 'rea-agents', 'package.json');
  const cliPath = path.join(repositoryRoot, 'node_modules', 'rea-agents', 'scripts', 'rea.mjs');
  if (!(await isFile(packagePath)) || !(await isFile(cliPath))) {
    throw new Error('REA não instalado. Execute ANALISAR_SILKSONG.bat ou npm ci --ignore-scripts --omit=optional.');
  }
  const packageData = await readJson(packagePath);
  if (packageData.version !== REA_VERSION) {
    throw new Error(`REA ${REA_VERSION} esperado, mas ${packageData.version} está instalado. Execute npm ci novamente.`);
  }
  return { version: packageData.version, cliPath, packagePath };
}

export async function getReaCapabilities(reaInfo) {
  const result = await runProcess({
    command: process.execPath,
    args: [reaInfo.cliPath, '--help'],
    timeoutMs: 30000,
  });
  if (!result.ok) throw new Error(`Falha ao consultar o REA: ${tail(result.stderr || result.stdout)}`);
  const commands = new Set();
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^ {2}([a-z0-9-]+)\s{2,}\S/);
    if (match) commands.add(match[1]);
  }
  return { commands, help: result.stdout };
}

export async function runRea({
  reaInfo,
  capabilities,
  command,
  args = [],
  rawDirectory,
  outputName,
  timeoutMs = 10 * 60 * 1000,
  maxParseBytes = 8 * 1024 * 1024,
}) {
  const name = safeFileName(outputName || command);
  const stdoutPath = path.join(rawDirectory, `${name}.json`);
  const stderrPath = path.join(rawDirectory, `${name}.stderr.log`);
  if (capabilities && !capabilities.commands.has(command)) {
    return {
      command,
      status: 'skipped',
      reason: `O REA ${reaInfo.version} não publicou o comando ${command}.`,
      stdoutPath,
      stderrPath,
    };
  }
  const result = await runProcess({
    command: process.execPath,
    args: [reaInfo.cliPath, command, ...args, '--json'],
    timeoutMs,
    stdoutPath,
    stderrPath,
    maxCaptureBytes: maxParseBytes,
  });

  let data;
  let parseError;
  if (await isFile(stdoutPath)) {
    try {
      const information = await stat(stdoutPath);
      if (information.size <= maxParseBytes) {
        data = parseJsonOutput(await readFile(stdoutPath, 'utf8'));
        if (!data) parseError = information.size > 0
          ? 'A saída não contém JSON reconhecível.'
          : 'O comando não produziu JSON.';
      }
    } catch (error) {
      parseError = errorMessage(error);
    }
  }

  let message;
  const stderrDiagnostic = result.stderr?.trim();
  const coverage = data?.normalized_result?.coverage;
  const coverageState = typeof coverage?.state === 'string' ? coverage.state : undefined;
  const incompleteCoverage = ['partial', 'unavailable'].includes(coverageState);
  const coverageIssue = incompleteCoverage && Array.isArray(coverage?.issues) ? coverage.issues[0] : undefined;
  const coverageMessage = incompleteCoverage
    ? `Cobertura REA ${coverageState}${coverageIssue ? `: ${coverageIssue.detail || coverageIssue.code || 'problema não detalhado'}` : '.'}`
    : undefined;
  if (!result.ok) {
    message = data?.error?.message || data?.message || tail(result.stderr || result.stdout, 1500) || errorMessage(result.error);
    if (result.timedOut) message = `Tempo limite excedido após ${Math.round(timeoutMs / 1000)} s.`;
  } else {
    message = [coverageMessage, stderrDiagnostic && tail(stderrDiagnostic, 1200)].filter(Boolean).join(' | ') || undefined;
  }
  return {
    command,
    status: result.ok ? ((parseError || stderrDiagnostic || incompleteCoverage) ? 'warning' : 'success') : 'failed',
    exitCode: result.code,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    message,
    parseError,
    data,
    stdoutPath,
    stderrPath,
    outputBytes: (await isFile(stdoutPath)) ? (await stat(stdoutPath)).size : 0,
  };
}

async function findExecutable(names, knownPaths = []) {
  for (const candidate of knownPaths) {
    if (candidate && await isFile(candidate)) return candidate;
  }
  const [command, args] = process.platform === 'win32'
    ? ['where.exe', names]
    : ['which', [names[0]]];
  const result = await runProcess({ command, args, timeoutMs: 10000 });
  if (!result.ok) return undefined;
  const first = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return first && await isFile(first) ? first : undefined;
}

function dotnetEnvironment(dotnet) {
  return {
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_NOLOGO: '1',
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
    ...(dotnet?.executable ? { DOTNET_ROOT: path.dirname(dotnet.executable) } : {}),
  };
}

async function inspectDotnet(executable) {
  const result = await runProcess({ command: executable, args: ['--list-sdks'], timeoutMs: 20000 });
  const sdks = result.ok ? result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  return {
    executable,
    sdks,
    suitable: sdks.some((line) => {
      const match = line.match(/^(\d+)\.(\d+)\.(\d+)/);
      return match && (Number(match[1]) > 10 || (Number(match[1]) === 10 && (Number(match[2]) > 0 || Number(match[3]) >= 100)));
    }),
  };
}

async function findDotnet(repositoryRoot) {
  const executableName = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
  const candidates = [
    process.env.DOTNET_EXE,
    repositoryRoot ? path.join(repositoryRoot, '.tools', 'dotnet', executableName) : undefined,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'dotnet', 'dotnet.exe') : undefined,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'dotnet', 'dotnet.exe') : undefined,
    await findExecutable(['dotnet']),
  ];
  const seen = new Set();
  let first;
  for (const candidate of candidates) {
    if (!candidate || !(await isFile(candidate))) continue;
    const normalized = path.resolve(candidate);
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    const detected = await inspectDotnet(candidate);
    first ||= detected;
    if (detected.suitable) return detected;
  }
  return first;
}

async function installDotnet(repositoryRoot, rawDirectory) {
  if (process.platform !== 'win32') {
    throw new Error('.NET SDK 10.0.100+ não encontrado. Instale-o para habilitar o ILSpy.');
  }
  if (process.env.SILKSONG_REA_SKIP_INSTALL === '1') {
    throw new Error('.NET SDK 10.0.100+ ausente e a instalação automática está desativada.');
  }

  const scriptPath = path.join(rawDirectory, 'dotnet-install.ps1');
  const installDirectory = path.join(repositoryRoot, '.tools', 'dotnet');
  let response;
  try {
    response = await fetch('https://dot.net/v1/dotnet-install.ps1', {
      redirect: 'follow',
      signal: AbortSignal.timeout(60000),
      headers: { 'User-Agent': 'SilksongREA/1.0' },
    });
  } catch (error) {
    throw new Error(`Falha ao baixar o script oficial do .NET: ${errorMessage(error)}`);
  }
  if (!response.ok) throw new Error(`Download do script do .NET retornou HTTP ${response.status}.`);
  const script = await response.text();
  if (script.length < 1000 || script.length > 4 * 1024 * 1024 || !/dotnet-install/i.test(script) || !/param\s*\(/i.test(script)) {
    throw new Error('O download do instalador do .NET não contém um script PowerShell reconhecível.');
  }
  await writeFileAtomic(scriptPath, script);

  const result = await runProcess({
    command: 'powershell.exe',
    args: [
      '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-Channel', '10.0',
      '-InstallDir', installDirectory,
      '-NoPath',
    ],
    env: dotnetEnvironment(),
    timeoutMs: 20 * 60 * 1000,
    stdoutPath: path.join(rawDirectory, 'dotnet-install.log'),
    stderrPath: path.join(rawDirectory, 'dotnet-install.stderr.log'),
  });
  const executable = path.join(installDirectory, 'dotnet.exe');
  if (!result.ok || !(await isFile(executable))) {
    throw new Error(`Falha ao instalar o .NET SDK 10 localmente: ${tail(result.stderr || result.stdout, 1500)}`);
  }
}

export async function ensureIlspyCmd(repositoryRoot, rawDirectory) {
  const toolDirectory = path.join(repositoryRoot, '.tools', 'ilspycmd');
  const executableName = process.platform === 'win32' ? 'ilspycmd.exe' : 'ilspycmd';
  const localExecutable = path.join(toolDirectory, executableName);
  const override = process.env.SILKSONG_REA_ILSPYCMD;
  const markerPath = path.join(toolDirectory, 'version.json');

  if (override && await isFile(override)) {
    return { executable: override, version: ILSPY_VERSION, overridden: true };
  }

  let dotnet = await findDotnet(repositoryRoot);
  const detectExisting = async () => {
    if (!dotnet?.suitable || !(await isFile(localExecutable))) return undefined;
    const marker = await readJson(markerPath, {});
    if (marker.version === ILSPY_VERSION) {
      return { executable: localExecutable, version: ILSPY_VERSION, dotnetRoot: path.dirname(dotnet.executable) };
    }
    const versionResult = await runProcess({
      command: localExecutable,
      args: ['--version'],
      env: dotnetEnvironment(dotnet),
      timeoutMs: 20000,
    });
    if (versionResult.ok && versionResult.stdout.includes(ILSPY_VERSION)) {
      await writeJsonAtomic(markerPath, { version: ILSPY_VERSION });
      return { executable: localExecutable, version: ILSPY_VERSION, dotnetRoot: path.dirname(dotnet.executable) };
    }
    return undefined;
  };

  let existing = await detectExisting();
  if (existing) return existing;
  if (!dotnet?.suitable) {
    await installDotnet(repositoryRoot, rawDirectory);
    dotnet = await findDotnet(repositoryRoot);
  }
  if (!dotnet?.suitable) {
    throw new Error(`.NET SDK 10.0.100+ continua indisponível. SDKs detectados: ${dotnet?.sdks?.join(', ') || 'nenhum'}`);
  }
  existing = await detectExisting();
  if (existing) return existing;

  await ensureDir(toolDirectory);
  const alreadyInstalled = await isFile(localExecutable);
  const args = [
    'tool', alreadyInstalled ? 'update' : 'install', '--tool-path', toolDirectory,
    'ilspycmd', '--version', ILSPY_VERSION,
  ];
  const result = await runProcess({
    command: dotnet.executable,
    args,
    env: dotnetEnvironment(dotnet),
    timeoutMs: 15 * 60 * 1000,
    stdoutPath: path.join(rawDirectory, 'ilspy-install.log'),
    stderrPath: path.join(rawDirectory, 'ilspy-install.stderr.log'),
  });
  if (!result.ok || !(await isFile(localExecutable))) {
    throw new Error(`Falha ao instalar ilspycmd ${ILSPY_VERSION}: ${tail(result.stderr || result.stdout, 1500)}`);
  }
  await writeJsonAtomic(markerPath, { version: ILSPY_VERSION });
  return { executable: localExecutable, version: ILSPY_VERSION, dotnetRoot: path.dirname(dotnet.executable) };
}

export async function decompileWithIlspy({ ilspy, assembly, referencePath, outputDirectory, rawDirectory }) {
  await rm(outputDirectory, { recursive: true, force: true });
  await ensureDir(outputDirectory);
  const result = await runProcess({
    command: ilspy.executable,
    env: {
      DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      DOTNET_NOLOGO: '1',
      ...(ilspy.dotnetRoot ? { DOTNET_ROOT: ilspy.dotnetRoot } : {}),
    },
    args: [
      assembly,
      '--project',
      '--outputdir', outputDirectory,
      '--referencepath', referencePath,
      '--nested-directories',
      '--disable-updatecheck',
      '--ignore-decompilation-errors',
    ],
    timeoutMs: 30 * 60 * 1000,
    stdoutPath: path.join(rawDirectory, 'ilspy-decompile.log'),
    stderrPath: path.join(rawDirectory, 'ilspy-decompile.stderr.log'),
  });

  let fileCount = 0;
  let sourceFileCount = 0;
  let totalBytes = 0;
  let totalLines = 0;
  const sourceFiles = [];
  if (await pathExists(outputDirectory)) {
    for await (const entry of walkFiles(outputDirectory)) {
      if (entry.error || entry.symlink) continue;
      fileCount += 1;
      totalBytes += entry.size;
      if (entry.path.toLowerCase().endsWith('.cs')) {
        sourceFileCount += 1;
        sourceFiles.push(entry.path);
      }
    }
  }
  for (const sourceFile of sourceFiles) {
    try {
      const text = await readFile(sourceFile, 'utf8');
      totalLines += text.split(/\r?\n/).length;
    } catch {
      // File and byte totals above still describe the recovered output.
    }
  }

  const hasDiagnostics = Boolean(result.stderr?.trim());
  return {
    status: result.ok ? (hasDiagnostics ? 'warning' : 'success') : 'failed',
    exitCode: result.code,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    message: result.ok
      ? (hasDiagnostics ? tail(result.stderr, 1800) : undefined)
      : tail(result.stderr || result.stdout, 1800),
    fileCount,
    sourceFileCount,
    totalBytes,
    totalLines,
    sourceFiles,
    outputDirectory,
  };
}

export async function getNpmVersion() {
  if (process.env.npm_config_user_agent) {
    const match = process.env.npm_config_user_agent.match(/npm\/(\S+)/);
    if (match) return match[1];
  }
  const npmCli = process.env.npm_execpath;
  if (npmCli && await isFile(npmCli)) {
    const result = await runProcess({ command: process.execPath, args: [npmCli, '--version'], timeoutMs: 10000 });
    if (result.ok) return result.stdout.trim();
  }
  return undefined;
}

export async function getGitExecutable() {
  return findExecutable(['git'], [
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe') : undefined,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Git', 'cmd', 'git.exe') : undefined,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'cmd', 'git.exe') : undefined,
  ]);
}

export async function listDirectoryFiles(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}
