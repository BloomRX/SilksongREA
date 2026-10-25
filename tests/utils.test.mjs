import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import {
  containsSensitiveContent,
  parseJsonOutput,
  runProcess,
  sanitizeText,
  writeJsonAtomic,
  readJson,
} from '../scripts/lib/utils.mjs';

test('sanitizeText remove caminhos conhecidos e credenciais', () => {
  const input = 'C:\\Users\\Pessoa\\jogo falhou; token github_pat_abcdefghijklmnopqrstuvwxyz_123456; https://usuario:senha@github.com/exemplo; Bearer abcdefghijklmnopqrstuvwxyz; pessoa@example.com; 76561191234567890; D:\\Steam\\Silksong';
  const output = sanitizeText(input, { '<JOGO>': 'D:\\Steam\\Silksong' });
  assert.match(output, /<USUARIO>/);
  assert.match(output, /<SEGREDO_REMOVIDO>/);
  assert.match(output, /<JOGO>/);
  assert.doesNotMatch(output, /pessoa@example\.com|76561191234567890|abcdefghijklmnopqrstuvwxyz/);
  assert.equal(containsSensitiveContent(output), false);
  assert.equal(containsSensitiveContent('AKIAABCDEFGHIJKLMNOP'), true);
});

test('parseJsonOutput aceita JSON puro e JSON com prefixo de log', () => {
  assert.deepEqual(parseJsonOutput('{"ok":true}'), { ok: true });
  assert.deepEqual(parseJsonOutput('prefixo\n{"ok":2}\n'), { ok: 2 });
  assert.equal(parseJsonOutput('sem json'), undefined);
});

test('runProcess captura saída e preserva arquivos brutos', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'silksong-utils-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const stdoutPath = path.join(directory, 'out.txt');
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', 'console.log("saida-ok")'],
    stdoutPath,
    timeoutMs: 10000,
  });
  assert.equal(result.ok, true);
  assert.match(result.stdout, /saida-ok/);
  assert.match(await readFile(stdoutPath, 'utf8'), /saida-ok/);
});

test('writeJsonAtomic e readJson preservam dados', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'silksong-json-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'nested', 'data.json');
  await writeJsonAtomic(target, { valor: 42 });
  assert.deepEqual(await readJson(target), { valor: 42 });
});
