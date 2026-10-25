import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { runProcess } from '../scripts/lib/utils.mjs';
import { validateReportDirectory } from '../scripts/lib/reports.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('integração: falha do REA vira relatório e não impede as demais etapas', { timeout: 120000 }, async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'silksong-integration-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const work = path.join(temporary, 'repo');
  const game = path.join(temporary, 'game');
  await mkdir(work, { recursive: true });
  await mkdir(path.join(game, 'Hollow Knight Silksong_Data', 'Managed'), { recursive: true });
  await cp(path.join(repositoryRoot, 'scripts'), path.join(work, 'scripts'), { recursive: true });
  await symlink(path.join(repositoryRoot, 'node_modules'), path.join(work, 'node_modules'), 'dir');
  await writeFile(path.join(game, 'Hollow Knight Silksong_Data', 'Managed', 'Assembly-CSharp.dll'), 'não é um assembly real');
  await writeFile(path.join(game, 'Hollow Knight Silksong.exe'), 'não é um PE real');

  const result = await runProcess({
    command: process.execPath,
    args: [
      path.join(work, 'scripts', 'run-analysis.mjs'),
      '--game-path', game,
      '--no-publish',
      '--no-decompile',
      '--no-player-log',
    ],
    timeoutMs: 110000,
    maxCaptureBytes: 200000,
  });
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Inventário completo/);
  assert.match(result.stdout, /Relatório gerado/);
  const summary = JSON.parse(await readFile(path.join(work, 'reports', 'latest', 'summary.json'), 'utf8'));
  assert.equal(summary.status, 'failed');
  assert.equal(summary.inventory.fileCount, 2);
  assert.ok(summary.managed.commands.length >= 4);
  assert.equal(summary.publication.status, 'pending');
  const validation = await validateReportDirectory(path.join(work, 'reports', 'latest'));
  assert.equal(validation.ok, true, validation.problems.join('\n'));
});

test('integração: fixture PE/CLI válida percorre todas as inspeções estáticas', { timeout: 120000 }, async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'silksong-valid-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const work = path.join(temporary, 'repo');
  const game = path.join(temporary, 'game');
  await mkdir(work, { recursive: true });
  await mkdir(path.join(game, 'Hollow Knight Silksong_Data', 'Managed'), { recursive: true });
  await cp(path.join(repositoryRoot, 'scripts'), path.join(work, 'scripts'), { recursive: true });
  await symlink(path.join(repositoryRoot, 'node_modules'), path.join(work, 'node_modules'), 'dir');
  const fixture = Buffer.from(await readFile(path.join(repositoryRoot, 'tests', 'fixtures', 'managed-global-fixture.b64'), 'utf8'), 'base64');
  await writeFile(path.join(game, 'Hollow Knight Silksong_Data', 'Managed', 'Assembly-CSharp.dll'), fixture);
  await writeFile(path.join(game, 'Hollow Knight Silksong.exe'), fixture);

  const result = await runProcess({
    command: process.execPath,
    args: [
      path.join(work, 'scripts', 'run-analysis.mjs'),
      '--game-path', game,
      '--no-publish',
      '--no-decompile',
      '--no-player-log',
    ],
    timeoutMs: 110000,
    maxCaptureBytes: 200000,
  });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const summary = JSON.parse(await readFile(path.join(work, 'reports', 'latest', 'summary.json'), 'utf8'));
  assert.equal(summary.status, 'success');
  assert.ok(summary.stages.every((stage) => stage.status !== 'running'));
  assert.equal(summary.inventory.fileCount, 2);
  assert.ok(summary.managed.commands.length >= 5);
  assert.ok(summary.managed.commands.every((command) => command.status === 'success'));
  const complete = summary.managed.commands.find((command) => command.command === 'inspect-managed-members');
  assert.equal(complete.coverage.state, 'complete');
  const focused = summary.managed.commands.find((command) => command.target?.includes('HeroControllerStates'));
  assert.equal(focused.collections.types, 1);
  const validation = await validateReportDirectory(path.join(work, 'reports', 'latest'));
  assert.equal(validation.ok, true, validation.problems.join('\n'));
});
