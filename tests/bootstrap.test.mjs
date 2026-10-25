import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('bootstrap Windows preserva UTF-8 no PowerShell 5.1 e no console', async () => {
  const script = await readFile(path.join(root, 'scripts', 'bootstrap.ps1'));
  assert.equal(script.subarray(0, 3).toString('hex'), 'efbbbf');
  const text = script.toString('utf8');
  assert.match(text, /\[Console\]::OutputEncoding = \$utf8NoBom/);
  assert.match(text, /\$OutputEncoding = \$utf8NoBom/);

  const batch = await readFile(path.join(root, 'ANALISAR_SILKSONG.bat'));
  const batchText = batch.toString('utf8');
  assert.match(batchText, /chcp 65001 >nul/);
  assert.equal(batchText.replaceAll('\r\n', '').includes('\n'), false);
});
