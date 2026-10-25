import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import {
  analyzePlayerLogs,
  createInventory,
  inspectGameLayout,
  parseVdf,
} from '../scripts/lib/game.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'silksong-game-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const managed = path.join(root, 'Hollow Knight Silksong_Data', 'Managed');
  await mkdir(managed, { recursive: true });
  await writeFile(path.join(managed, 'Assembly-CSharp.dll'), 'conteudo-controlado');
  await writeFile(path.join(managed, 'UnityEngine.CoreModule.dll'), 'unity');
  await writeFile(path.join(root, 'Hollow Knight Silksong.exe'), 'MZ');
  await writeFile(path.join(root, 'UnityPlayer.dll'), 'MZ2');
  return root;
}

test('parseVdf lê bibliotecas e manifest da Steam', () => {
  const parsed = parseVdf(`
    "libraryfolders" {
      "0" { "path" "C:\\\\Program Files (x86)\\\\Steam" "apps" { "1030300" "123" } }
      "1" { "path" "D:\\\\SteamLibrary" }
    }
  `);
  assert.equal(parsed.libraryfolders['0'].path, 'C:\\Program Files (x86)\\Steam');
  assert.equal(parsed.libraryfolders['1'].path, 'D:\\SteamLibrary');
  assert.equal(parsed.libraryfolders['0'].apps['1030300'], '123');
});

test('inspectGameLayout identifica Mono e arquivos principais', async (t) => {
  const root = await fixture(t);
  const layout = await inspectGameLayout(root);
  assert.equal(layout.runtime, 'Unity Mono');
  assert.equal(layout.managedAssemblies.length, 2);
  assert.equal(path.basename(layout.managedAssembly), 'Assembly-CSharp.dll');
  assert.equal(path.basename(layout.mainExecutable), 'Hollow Knight Silksong.exe');
});

test('createInventory gera CSV local e hashes sem caminhos absolutos no resumo', async (t) => {
  const root = await fixture(t);
  const layout = await inspectGameLayout(root);
  const local = path.join(root, 'resultado-local');
  const inventory = await createInventory(layout, local);
  assert.equal(inventory.summary.fileCount, 4);
  assert.equal(inventory.summary.hashes.length, 3);
  assert.ok(inventory.summary.hashes.every((entry) => !path.isAbsolute(entry.path)));
  const csv = await readFile(inventory.inventoryPath, 'utf8');
  assert.match(csv, /Assembly-CSharp\.dll/);
  assert.doesNotMatch(csv, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('analyzePlayerLogs agrupa erros e limita evidência', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'silksong-log-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = path.join(root, 'Player.log');
  await writeFile(log, 'inicio\nNullReferenceException: exemplo\nNullReferenceException: exemplo\nstack\n');
  const [result] = await analyzePlayerLogs([log], path.join(root, 'saida'));
  assert.equal(result.matchCount, 2);
  assert.equal(result.groups[0].count, 2);
  assert.equal(result.error, undefined);
});
