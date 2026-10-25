import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { runProcess } from '../scripts/lib/utils.mjs';
import { prepareRepository, publishReports } from '../scripts/lib/publish.mjs';

async function git(root, args, bare = false) {
  const prefix = bare ? ['--git-dir', root] : ['-C', root];
  const result = await runProcess({ command: 'git', args: [...prefix, ...args], timeoutMs: 20000 });
  assert.equal(result.ok, true, `${args.join(' ')}\n${result.stderr}`);
  return result.stdout.trim();
}

test('publicação usa branch atual, envia somente relatórios e protege staged alheio', async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'silksong-git-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const remote = path.join(temporary, 'remote.git');
  const work = path.join(temporary, 'work');
  await mkdir(work, { recursive: true });
  await git(remote, ['init', '--bare'], true);
  await git(work, ['init']);
  await git(work, ['config', 'user.name', 'Teste SilksongREA']);
  await git(work, ['config', 'user.email', 'teste@example.invalid']);
  await writeFile(path.join(work, 'README.md'), 'inicial\n');
  await git(work, ['add', 'README.md']);
  await git(work, ['commit', '-m', 'inicial']);
  await git(work, ['branch', '-M', 'main']);
  await git(work, ['remote', 'add', 'origin', remote]);
  await git(work, ['push', '-u', 'origin', 'main']);

  const reports = path.join(work, 'reports', 'latest');
  await mkdir(reports, { recursive: true });
  await writeFile(path.join(reports, 'README.md'), '# relatório\n');
  await writeFile(path.join(work, 'other.txt'), 'não commitar\n');
  await git(work, ['add', 'other.txt']);

  const blocked = await publishReports({
    executable: 'git', repositoryRoot: work, reportDirectory: reports, runId: 'teste-1', enabled: true,
  });
  assert.equal(blocked.status, 'failed');
  assert.match(blocked.message, /staged fora/);
  assert.equal(await git(work, ['log', '-1', '--pretty=%s']), 'inicial');

  await git(work, ['restore', '--staged', 'other.txt']);
  const published = await publishReports({
    executable: 'git', repositoryRoot: work, reportDirectory: reports, runId: 'teste-2', enabled: true,
  });
  assert.equal(published.status, 'success', published.message);
  assert.equal(published.pushed, true);
  assert.match(await git(work, ['log', '-1', '--pretty=%s']), /relatório SilksongREA teste-2/);
  assert.equal(await readFile(path.join(work, 'other.txt'), 'utf8'), 'não commitar\n');
  await git(remote, ['cat-file', '-e', 'main:reports/latest/README.md'], true);
  const remoteFiles = await git(remote, ['ls-tree', '-r', '--name-only', 'main'], true);
  assert.doesNotMatch(remoteFiles, /other\.txt/);
});

test('publicação é bloqueada durante uma operação Git em andamento', async (t) => {
  const work = await mkdtemp(path.join(os.tmpdir(), 'silksong-merge-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  await git(work, ['init']);
  await git(work, ['config', 'user.name', 'Teste']);
  await git(work, ['config', 'user.email', 'teste@example.invalid']);
  await writeFile(path.join(work, 'README.md'), 'base\n');
  await git(work, ['add', 'README.md']);
  await git(work, ['commit', '-m', 'base']);
  const reports = path.join(work, 'reports', 'latest');
  await mkdir(reports, { recursive: true });
  await writeFile(path.join(reports, 'README.md'), '# relatório\n');
  const head = await git(work, ['rev-parse', 'HEAD']);
  await writeFile(path.join(work, '.git', 'MERGE_HEAD'), `${head}\n`);

  const result = await publishReports({
    executable: 'git', repositoryRoot: work, reportDirectory: reports, runId: 'merge', enabled: true,
  });
  assert.equal(result.status, 'failed');
  assert.match(result.message, /MERGE_HEAD/);
  assert.equal(await git(work, ['log', '-1', '--pretty=%s']), 'base');
});

test('pull inicial não sobrescreve árvore suja', async (t) => {
  const work = await mkdtemp(path.join(os.tmpdir(), 'silksong-dirty-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  await git(work, ['init']);
  await git(work, ['config', 'user.name', 'Teste']);
  await git(work, ['config', 'user.email', 'teste@example.invalid']);
  await writeFile(path.join(work, 'README.md'), 'base\n');
  await git(work, ['add', 'README.md']);
  await git(work, ['commit', '-m', 'base']);
  await writeFile(path.join(work, 'README.md'), 'mudança local\n');
  const result = await prepareRepository({ executable: 'git', repositoryRoot: work, enabled: true });
  assert.equal(result.status, 'warning');
  assert.equal(await readFile(path.join(work, 'README.md'), 'utf8'), 'mudança local\n');
});
