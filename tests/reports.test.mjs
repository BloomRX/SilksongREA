import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import {
  projectPublicRun,
  validateReportDirectory,
  writeReports,
} from '../scripts/lib/reports.mjs';

function sampleRun() {
  return {
    runId: '20261025T000000Z',
    startedAt: '2026-10-25T00:00:00.000Z',
    status: 'warning',
    game: { runtime: 'Unity Mono', root: 'C:\\Users\\Pessoa\\Silksong' },
    environment: { nodeVersion: 'v22.22.0' },
    stages: [{ id: 'inventory', title: 'Inventário', status: 'warning', message: 'C:\\Users\\Pessoa\\Silksong falhou', durationMs: 10 }],
    inventory: { fileCount: 1, totalBytes: 10, hashes: [{ path: 'Assembly-CSharp.dll', bytes: 10, sha256: 'abc' }] },
    managed: { commands: [{ command: 'inspect-managed-artifact', status: 'success', data: { segredo: 'não publicar' } }] },
    decompilation: { status: 'skipped' },
    playerLogs: [{
      path: 'C:\\Users\\Pessoa\\AppData\\Player.log',
      groups: Array.from({ length: 80 }, (_, index) => ({ count: 1, message: `erro ${index}` })),
      excerpt: ['NullReferenceException'],
    }],
    publication: { status: 'pending' },
  };
}

test('projeção pública remove caminhos/dados brutos e limita logs', () => {
  const projected = projectPublicRun(sampleRun(), { '<JOGO>': 'C:\\Users\\Pessoa\\Silksong' });
  assert.equal(projected.game.root, undefined);
  assert.equal(projected.managed.commands[0].data, undefined);
  assert.equal(projected.playerLogs[0].path, undefined);
  assert.equal(projected.playerLogs[0].groups.length, 50);
  assert.doesNotMatch(JSON.stringify(projected), /não publicar/);
});

test('writeReports produz documentos que passam na validação', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'silksong-reports-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'stale.md'), 'relatório antigo');
  await writeReports({
    reportDirectory: directory,
    run: sampleRun(),
    replacements: { '<JOGO>': 'C:\\Users\\Pessoa\\Silksong' },
  });
  await assert.rejects(readFile(path.join(directory, 'stale.md'), 'utf8'));
  const validation = await validateReportDirectory(directory);
  assert.equal(validation.ok, true, validation.problems.join('\n'));
  assert.match(await readFile(path.join(directory, 'README.md'), 'utf8'), /Relatório SilksongREA/);
  assert.match(await readFile(path.join(directory, 'coverage.md'), 'utf8'), /PlayMaker/);
});

test('validação bloqueia segredo em relatório', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'silksong-secret-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'bad.md'), 'ghp_abcdefghijklmnopqrstuvwxyz123456');
  const validation = await validateReportDirectory(directory);
  assert.equal(validation.ok, false);
});
