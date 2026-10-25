#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { open, readFile, readdir, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import {
  ensureDir,
  errorMessage,
  formatDuration,
  isFile,
  pathExists,
  readJson,
  relativePosix,
  sanitizeText,
  TOOL_VERSION,
  writeJsonAtomic,
} from './lib/utils.mjs';
import {
  analyzePlayerLogs,
  createInventory,
  findPlayerLogs,
  resolveGame,
} from './lib/game.mjs';
import {
  decompileWithIlspy,
  ensureIlspyCmd,
  getGitExecutable,
  getNpmVersion,
  getReaCapabilities,
  getReaInfo,
  REA_VERSION,
  runRea,
} from './lib/tools.mjs';
import { writeReports } from './lib/reports.mjs';
import { prepareRepository, publishReports } from './lib/publish.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const FOCUS_TYPES = [
  'HeroController',
  'HeroControllerStates',
  'HeroActions',
  'InputHandler',
  'GameManager',
  'PlayerData',
];

function usage() {
  return `SilksongREA ${TOOL_VERSION}\n\n` +
    `Uso: ANALISAR_SILKSONG.bat [opções]\n\n` +
    `Opções:\n` +
    `  --game-path "PASTA"  Usa uma instalação específica do jogo\n` +
    `  --no-publish         Não faz pull, commit nem push\n` +
    `  --no-push            Alias de --no-publish\n` +
    `  --no-decompile       Ignora a instalação/execução do ILSpy\n` +
    `  --no-player-log      Não lê Player.log/Player-prev.log\n` +
    `  --note "TEXTO"       Anota uma observação no relatório\n` +
    `  --help               Mostra esta ajuda\n` +
    `  --version            Mostra a versão do executor\n\n` +
    `Os resultados completos ficam em .local; somente reports/latest é publicado.\n`;
}

function parseArguments(argv) {
  const options = {
    publish: true,
    decompile: true,
    playerLog: true,
    gamePath: undefined,
    note: undefined,
    help: false,
    version: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--game-path':
        if (!argv[index + 1]) throw new Error('--game-path precisa de uma pasta.');
        options.gamePath = path.resolve(argv[++index]);
        break;
      case '--no-publish':
      case '--no-push':
        options.publish = false;
        break;
      case '--no-decompile':
        options.decompile = false;
        break;
      case '--no-player-log':
        options.playerLog = false;
        break;
      case '--note':
        if (!argv[index + 1]) throw new Error('--note precisa de um texto.');
        options.note = argv[++index].slice(0, 4000);
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
        options.version = true;
        break;
      default:
        throw new Error(`Opção desconhecida: ${argument}`);
    }
  }
  return options;
}

async function acquireLock(lockPath) {
  await ensureDir(path.dirname(lockPath));
  async function tryAcquire() {
    const handle = await open(lockPath, 'wx');
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
    await handle.close();
    return handle;
  }
  try {
    return await tryAcquire();
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const lock = await readJson(lockPath, {});
    let running = false;
    if (lock.pid && Number.isInteger(lock.pid)) {
      try {
        process.kill(lock.pid, 0);
        running = true;
      } catch (probeError) {
        running = probeError?.code === 'EPERM';
      }
    }
    if (running) {
      throw new Error(`Já existe uma análise em execução (PID ${lock.pid}). Aguarde ela terminar.`);
    }
    await rm(lockPath, { force: true });
    return tryAcquire();
  }
}

async function askForGameDirectory() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return undefined;
  console.log('\nO Silksong não foi encontrado automaticamente.');
  console.log('Na Steam: botão direito no jogo → Gerenciar → Explorar arquivos locais.');
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question('Cole a pasta do jogo (ou deixe vazio para cancelar): ');
    const cleaned = answer.trim().replace(/^"|"$/g, '');
    return cleaned ? path.resolve(cleaned) : undefined;
  } finally {
    readline.close();
  }
}

function compactReaResult(result, target, gameRoot) {
  const collections = {};
  const normalized = result.data?.normalized_result;
  if (normalized && typeof normalized === 'object') {
    for (const [key, value] of Object.entries(normalized)) {
      if (Array.isArray(value)) collections[key] = value.length;
    }
  }
  const unmatchedTypes = normalized?.selection?.unmatched_type_names;
  return {
    command: result.command,
    target: target && gameRoot ? relativePosix(gameRoot, target) : target,
    status: result.status,
    reason: result.reason,
    message: result.message,
    parseError: result.parseError,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    outputBytes: result.outputBytes,
    collections,
    unmatchedTypes: Array.isArray(unmatchedTypes) ? unmatchedTypes : undefined,
    stdoutPath: result.stdoutPath,
    stderrPath: result.stderrPath,
  };
}

function publicManifest(manifest) {
  const allowed = ['buildid', 'LastUpdated', 'StateFlags'];
  return Object.fromEntries(allowed.filter((key) => manifest?.[key] !== undefined).map((key) => [key, manifest[key]]));
}

async function cleanOldRuns(runsRoot, currentRun, retain = 2) {
  try {
    const entries = (await readdir(runsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name !== currentRun)
      .map((entry) => entry.name)
      .sort()
      .reverse();
    await Promise.all(entries.slice(Math.max(0, retain - 1)).map((name) => rm(path.join(runsRoot, name), {
      recursive: true,
      force: true,
    })));
  } catch {
    // Cleanup is best-effort and must never hide the analysis result.
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return 0;
  }
  if (options.version) {
    console.log(TOOL_VERSION);
    return 0;
  }

  const runId = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const localRoot = path.join(REPOSITORY_ROOT, '.local');
  const runsRoot = path.join(localRoot, 'runs');
  const localRunDirectory = path.join(runsRoot, runId);
  const rawDirectory = path.join(localRunDirectory, 'raw');
  const rawReaDirectory = path.join(rawDirectory, 'rea');
  const reportDirectory = path.join(REPOSITORY_ROOT, 'reports', 'latest');
  const decompileRoot = path.join(localRoot, 'decompiled', 'Assembly-CSharp');
  const lockPath = path.join(localRoot, 'analysis.lock');
  const localConfigPath = path.join(localRoot, 'config.json');
  const previousPublicationPath = path.join(localRoot, 'last-publication.json');
  await ensureDir(rawReaDirectory);
  await acquireLock(lockPath);

  const startedAt = new Date().toISOString();
  const replacements = {
    '<REPOSITORIO>': REPOSITORY_ROOT,
    '<LOCAL>': localRoot,
    '<USUARIO>': os.homedir(),
  };
  const run = {
    schemaVersion: 1,
    toolVersion: TOOL_VERSION,
    runId,
    startedAt,
    finishedAt: undefined,
    status: 'running',
    note: options.note,
    options: {
      publish: options.publish,
      decompile: options.decompile,
      playerLog: options.playerLog,
    },
    environment: {
      platform: process.platform,
      osRelease: os.release(),
      architecture: process.arch,
      nodeVersion: process.version,
      npmVersion: await getNpmVersion(),
      reaVersion: undefined,
      ilspyVersion: undefined,
    },
    game: {},
    stages: [],
    inventory: {},
    managed: { commands: [] },
    decompilation: { status: options.decompile ? 'skipped' : 'skipped', reason: options.decompile ? undefined : 'Desativada por --no-decompile.' },
    playerLogs: [],
    previousPublication: await readJson(previousPublicationPath, {}),
    publication: { status: 'pending', reason: 'Commit/push acontece depois da geração deste arquivo; o resultado fica registrado para a próxima execução.' },
  };

  let reaInfo;
  let capabilities;
  let layout;
  let gitExecutable;
  let currentStage;

  async function stage(id, title, operation) {
    const entry = { id, title, status: 'running', startedAt: new Date().toISOString() };
    currentStage = entry;
    run.stages.push(entry);
    const started = Date.now();
    console.log(`\n[${run.stages.length}] ${title}...`);
    try {
      const outcome = await operation(entry) || {};
      entry.status = 'success';
      Object.assign(entry, outcome);
    } catch (error) {
      entry.status = 'failed';
      entry.message = errorMessage(error);
      if (error?.candidates) entry.candidates = error.candidates;
      console.error(`  FALHOU: ${sanitizeText(entry.message, replacements)}`);
    } finally {
      entry.durationMs = Date.now() - started;
      delete entry.startedAt;
      currentStage = undefined;
      console.log(`  ${entry.status.toUpperCase()} (${formatDuration(entry.durationMs)})${entry.reason ? ` — ${entry.reason}` : ''}`);
    }
    return entry;
  }

  try {
    gitExecutable = await getGitExecutable();
    await stage('git-sync', 'Sincronização inicial do repositório', async () => {
      const result = await prepareRepository({
        executable: gitExecutable,
        repositoryRoot: REPOSITORY_ROOT,
        enabled: options.publish,
      });
      return result;
    });

    await stage('tools', 'Verificação das ferramentas', async () => {
      const detectedRea = await getReaInfo(REPOSITORY_ROOT);
      const detectedCapabilities = await getReaCapabilities(detectedRea);
      reaInfo = detectedRea;
      capabilities = detectedCapabilities;
      run.environment.reaVersion = reaInfo.version;
      return { message: `REA ${reaInfo.version}; ${capabilities.commands.size} comandos detectados.` };
    });

    await stage('game', 'Localização e identificação do jogo', async () => {
      const localConfig = await readJson(localConfigPath, {});
      try {
        layout = await resolveGame({ explicitPath: options.gamePath, savedPath: localConfig.gamePath });
      } catch (error) {
        if (options.gamePath) throw error;
        const answer = await askForGameDirectory();
        if (!answer) throw error;
        layout = await resolveGame({ explicitPath: answer });
      }
      replacements['<JOGO>'] = layout.root;
      await writeJsonAtomic(localConfigPath, { schemaVersion: 1, gamePath: layout.root });
      run.game = {
        runtime: layout.runtime,
        source: layout.source,
        manifest: publicManifest(layout.manifest),
        dataDirectoryCount: layout.dataDirectories.length,
        hasMainExecutable: Boolean(layout.mainExecutable),
        hasManagedAssembly: Boolean(layout.managedAssembly),
        hasIl2cppMetadata: Boolean(layout.il2cppMetadata),
      };
      run.managed.assemblyCount = layout.managedAssemblies.length;
      return { message: `${layout.runtime}; ${layout.managedAssemblies.length} assemblies gerenciados.` };
    });

    if (layout) {
      await stage('inventory', 'Inventário completo e hashes da build', async () => {
        const inventory = await createInventory(layout, localRunDirectory);
        run.inventory = inventory.summary;
        await writeJsonAtomic(path.join(rawDirectory, 'inventory-unreadable.json'), inventory.unreadable);
        return {
          status: inventory.unreadable.length ? 'warning' : 'success',
          message: `${inventory.summary.fileCount} arquivos; ${inventory.unreadable.length} entradas ilegíveis.`,
        };
      });

      await stage('managed-artifacts', 'Identidade de todos os assemblies .NET', async () => {
        if (!reaInfo || !capabilities?.commands.has('inspect-managed-artifact') || !layout.managedAssemblies.length) {
          return { status: 'skipped', reason: 'REA, comando de inspeção ou assemblies .NET indisponíveis.' };
        }
        let completed = 0;
        for (const assembly of layout.managedAssemblies) {
          const baseName = path.basename(assembly, path.extname(assembly));
          const result = await runRea({
            reaInfo,
            capabilities,
            command: 'inspect-managed-artifact',
            args: [assembly],
            rawDirectory: rawReaDirectory,
            outputName: `artifact-${String(completed + 1).padStart(3, '0')}-${baseName}`,
            timeoutMs: 3 * 60 * 1000,
            maxParseBytes: 2 * 1024 * 1024,
          });
          run.managed.commands.push(compactReaResult(result, assembly, layout.root));
          completed += 1;
          if (completed % 10 === 0 || completed === layout.managedAssemblies.length) {
            console.log(`  ${completed}/${layout.managedAssemblies.length} assemblies examinados`);
          }
        }
        const relevant = run.managed.commands.filter((result) => result.command === 'inspect-managed-artifact');
        const failures = relevant.filter((result) => result.status === 'failed').length;
        const warnings = relevant.filter((result) => result.status === 'warning').length;
        return {
          status: failures === relevant.length ? 'failed' : (failures || warnings) ? 'warning' : 'success',
          message: `${relevant.length - failures}/${relevant.length} assemblies identificados; ${warnings} com aviso.`,
        };
      });

      await stage('managed-members', 'Membros e CIL do Assembly-CSharp', async () => {
        if (!reaInfo || !layout.managedAssembly) {
          return { status: 'skipped', reason: 'Assembly-CSharp.dll ou REA indisponível (possível IL2CPP).' };
        }
        const result = await runRea({
          reaInfo,
          capabilities,
          command: 'inspect-managed-members',
          args: [layout.managedAssembly],
          rawDirectory: rawReaDirectory,
          outputName: 'assembly-csharp-members-complete',
          timeoutMs: 30 * 60 * 1000,
          maxParseBytes: 1024 * 1024,
        });
        run.managed.commands.push(compactReaResult(result, layout.managedAssembly, layout.root));
        return { status: result.status, message: result.message || result.parseError };
      });

      await stage('managed-focus', 'Tipos prioritários para mecânicas', async () => {
        if (!reaInfo || !layout.managedAssembly) {
          return { status: 'skipped', reason: 'Assembly-CSharp.dll ou REA indisponível.' };
        }
        const result = await runRea({
          reaInfo,
          capabilities,
          command: 'inspect-managed-members',
          args: [layout.managedAssembly, ...FOCUS_TYPES.flatMap((type) => ['--type', type])],
          rawDirectory: rawReaDirectory,
          outputName: 'assembly-csharp-members-focused',
          timeoutMs: 20 * 60 * 1000,
          maxParseBytes: 8 * 1024 * 1024,
        });
        run.managed.commands.push(compactReaResult(result, FOCUS_TYPES.join(', ')));
        return { status: result.status, message: result.message || result.parseError };
      });

      await stage('managed-native', 'Fronteiras nativas do código gerenciado', async () => {
        if (!reaInfo || !layout.managedAssembly) {
          return { status: 'skipped', reason: 'Assembly-CSharp.dll ou REA indisponível.' };
        }
        const result = await runRea({
          reaInfo,
          capabilities,
          command: 'inspect-managed-native-boundaries',
          args: [layout.managedAssembly],
          rawDirectory: rawReaDirectory,
          outputName: 'assembly-csharp-native-boundaries',
          timeoutMs: 15 * 60 * 1000,
          maxParseBytes: 2 * 1024 * 1024,
        });
        run.managed.commands.push(compactReaResult(result, layout.managedAssembly, layout.root));
        return { status: result.status, message: result.message || result.parseError };
      });

      await stage('native-pe', 'Recursos dos executáveis PE', async () => {
        const targets = [...new Set([layout.mainExecutable, layout.unityPlayer, layout.gameAssembly].filter(Boolean))];
        if (!reaInfo || !capabilities || !targets.length || !capabilities.commands.has('inspect-pe-resources')) {
          return { status: 'skipped', reason: 'Nenhum PE compatível ou comando inspect-pe-resources indisponível.' };
        }
        const results = [];
        for (let index = 0; index < targets.length; index += 1) {
          const target = targets[index];
          const result = await runRea({
            reaInfo,
            capabilities,
            command: 'inspect-pe-resources',
            args: [target],
            rawDirectory: rawReaDirectory,
            outputName: `pe-resources-${index + 1}-${path.basename(target)}`,
            timeoutMs: 10 * 60 * 1000,
            maxParseBytes: 2 * 1024 * 1024,
          });
          const compact = compactReaResult(result, target, layout.root);
          results.push(compact);
          run.managed.commands.push(compact);
        }
        const failures = results.filter((result) => result.status === 'failed').length;
        const warnings = results.filter((result) => result.status === 'warning').length;
        return {
          status: failures === results.length ? 'failed' : (failures || warnings) ? 'warning' : 'success',
          message: `${results.length - failures}/${results.length} imagens PE examinadas; ${warnings} com aviso.`,
        };
      });

      await stage('il2cpp', 'Metadados IL2CPP (fallback)', async () => {
        if (!reaInfo || !layout.il2cppMetadata) {
          return { status: 'skipped', reason: 'Nenhum global-metadata.dat encontrado; normal em uma instalação Mono.' };
        }
        const args = [layout.il2cppMetadata];
        if (layout.gameAssembly) args.push('--binary', layout.gameAssembly);
        const result = await runRea({
          reaInfo,
          capabilities,
          command: 'inspect-il2cpp-metadata',
          args,
          rawDirectory: rawReaDirectory,
          outputName: 'il2cpp-global-metadata',
          timeoutMs: 30 * 60 * 1000,
          maxParseBytes: 1024 * 1024,
        });
        run.managed.commands.push(compactReaResult(result, layout.il2cppMetadata, layout.root));
        return { status: result.status, message: result.message || result.parseError };
      });

      await stage('decompile', 'Decompilação completa do Assembly-CSharp com ILSpy', async () => {
        if (!options.decompile) return { status: 'skipped', reason: 'Desativada por --no-decompile.' };
        if (!layout.managedAssembly) return { status: 'skipped', reason: 'Nenhum Assembly-CSharp.dll; IL2CPP não é decompilado pelo ILSpy diretamente.' };
        const ilspy = await ensureIlspyCmd(REPOSITORY_ROOT, rawDirectory);
        run.environment.ilspyVersion = ilspy.version;
        const decompilation = await decompileWithIlspy({
          ilspy,
          assembly: layout.managedAssembly,
          referencePath: layout.managedDirectory,
          outputDirectory: decompileRoot,
          rawDirectory,
        });
        const focusTypes = FOCUS_TYPES.map((name) => {
          const sourceFile = decompilation.sourceFiles.find((candidate) => {
            const base = path.basename(candidate, '.cs').toLowerCase();
            return base === name.toLowerCase() || base.endsWith(`.${name.toLowerCase()}`);
          });
          return {
            name,
            found: Boolean(sourceFile),
            source: sourceFile ? relativePosix(decompileRoot, sourceFile) : undefined,
          };
        });
        run.decompilation = {
          status: decompilation.status,
          message: decompilation.message,
          fileCount: decompilation.fileCount,
          sourceFileCount: decompilation.sourceFileCount,
          totalBytes: decompilation.totalBytes,
          totalLines: decompilation.totalLines,
          focusTypes,
        };
        return { status: decompilation.status, message: decompilation.message || `${decompilation.sourceFileCount} arquivos C# locais.` };
      });

      await stage('player-logs', 'Análise de Player.log', async () => {
        if (!options.playerLog) return { status: 'skipped', reason: 'Desativada por --no-player-log.' };
        const logs = await findPlayerLogs();
        if (!logs.length) return { status: 'skipped', reason: 'Nenhum Player.log convencional encontrado.' };
        run.playerLogs = await analyzePlayerLogs(logs, path.join(localRunDirectory, 'player-logs'));
        const failures = run.playerLogs.filter((log) => log.error).length;
        return {
          status: failures ? 'warning' : 'success',
          message: `${run.playerLogs.length} log(s); ${run.playerLogs.reduce((sum, log) => sum + (log.matchCount || 0), 0)} linhas relevantes.`,
        };
      });
    }
  } catch (error) {
    run.stages.push({
      id: 'fatal', title: 'Falha não recuperável', status: 'failed', message: errorMessage(error), durationMs: 0,
    });
    console.error(`\nFalha não recuperável: ${sanitizeText(errorMessage(error), replacements)}`);
  } finally {
    run.finishedAt = new Date().toISOString();
    run.status = run.stages.some((entry) => entry.status === 'failed')
      ? 'failed'
      : run.stages.some((entry) => entry.status === 'warning') ? 'warning' : 'success';

    let reportsReady = false;
    try {
      await writeJsonAtomic(path.join(localRunDirectory, 'run-local.json'), run);
      await writeReports({ reportDirectory, run, replacements });
      reportsReady = true;
      console.log(`\nRelatório gerado em ${path.relative(REPOSITORY_ROOT, reportDirectory)}.`);
    } catch (error) {
      run.status = 'failed';
      console.error(`Falha ao gerar relatório: ${errorMessage(error)}`);
    }

    try {
      const publication = options.publish && !reportsReady
        ? { status: 'failed', message: 'Publicação cancelada porque o relatório não foi gerado completamente.' }
        : await publishReports({
          executable: gitExecutable,
          repositoryRoot: REPOSITORY_ROOT,
          reportDirectory,
          runId,
          enabled: options.publish,
        });
      run.publication = publication;
      await writeJsonAtomic(previousPublicationPath, {
        runId,
        finishedAt: new Date().toISOString(),
        ...publication,
      });
      await writeJsonAtomic(path.join(localRunDirectory, 'run-local.json'), run);
      if (publication.message || publication.reason) {
        console.log(`Publicação: ${sanitizeText(publication.message || publication.reason, replacements)}`);
      }
    } catch (error) {
      run.publication = { status: 'failed', message: errorMessage(error) };
      console.error(`Falha ao finalizar publicação: ${sanitizeText(errorMessage(error), replacements)}`);
    } finally {
      await rm(lockPath, { force: true });
      await cleanOldRuns(runsRoot, runId, 2);
    }
  }

  const failed = run.status === 'failed' || run.publication?.status === 'failed';
  console.log(`\nResultado: ${run.status.toUpperCase()}`);
  console.log(`Artefatos completos locais: ${path.relative(REPOSITORY_ROOT, localRunDirectory)}`);
  return failed ? 1 : 0;
}

try {
  const exitCode = await main();
  process.exitCode = exitCode;
} catch (error) {
  console.error(`Erro fatal: ${errorMessage(error)}`);
  process.exitCode = 1;
}
