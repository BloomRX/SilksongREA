import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runRea } from '../scripts/lib/tools.mjs';

async function withFakeRea(source, run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'silksong-rea-tools-'));
  try {
    const cliPath = path.join(directory, 'fake-rea.mjs');
    await writeFile(cliPath, source, 'utf8');
    return await run({
      reaInfo: { version: '6.7.0', cliPath },
      capabilities: { commands: new Set(['inspect-managed-artifact']) },
      command: 'inspect-managed-artifact',
      rawDirectory: directory,
      outputName: 'result',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('REA com JSON válido e diagnóstico em stderr produz warning', async () => {
  const result = await withFakeRea(
    "console.error('dependência ausente'); console.log(JSON.stringify({ normalized_result: { types: [] } }));\n",
    (options) => runRea(options),
  );
  assert.equal(result.status, 'warning');
  assert.match(result.message, /dependência ausente/);
  assert.deepEqual(result.data.normalized_result.types, []);
});

test('REA com saída inválida e exit zero não é tratado como sucesso', async () => {
  const result = await withFakeRea(
    "console.log('comando desconhecido');\n",
    (options) => runRea(options),
  );
  assert.equal(result.status, 'warning');
  assert.match(result.parseError, /JSON/);
});
