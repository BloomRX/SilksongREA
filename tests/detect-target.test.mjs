import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detector = join(root, "scripts", "detect-target.mjs");

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "detect-"));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function detect(dir) {
  const r = spawnSync(process.execPath, [detector, dir, "--json"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}

function peWithCli(isDotnet) {
  const b = Buffer.alloc(1024);
  b.write("MZ", 0, "latin1");
  b.writeUInt32LE(0x80, 0x3c);
  b.write("PE\0\0", 0x80, "latin1");
  const opt = 0x80 + 24 + 4; // após assinatura PE + COFF (20 bytes)
  const optStart = 0x80 + 4 + 20;
  b.writeUInt16LE(0x10b, optStart); // PE32
  b.writeUInt32LE(16, optStart + 92); // NumberOfRvaAndSizes
  if (isDotnet) b.writeUInt32LE(0x2000, optStart + 96 + 14 * 8); // diretório CLI
  return b;
}

test("detecta binário nativo ELF", () => {
  const dir = fixture({ "bin/game": Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]) });
  const out = detect(dir);
  assert.equal(out.primary, "native");
  assert.equal(out.detections[0].provider, "obrigatório");
});

test("detecta .NET pelo diretório CLI do PE", () => {
  const dir = fixture({ "app.dll": peWithCli(true) });
  const out = detect(dir);
  assert.equal(out.primary, "dotnet");
});

test("não confunde PE nativo com .NET", () => {
  const dir = fixture({ "app.exe": peWithCli(false) });
  const out = detect(dir);
  assert.equal(out.primary, "native");
});

test("detecta Unity IL2CPP por binário + metadados", () => {
  const dir = fixture({
    "GameAssembly.dll": peWithCli(false),
    "Game_Data/il2cpp_data/Metadata/global-metadata.dat": "fake",
  });
  const out = detect(dir);
  assert.equal(out.primary, "unity-il2cpp");
  assert.equal(out.detections[0].first_tool, "inspect_il2cpp_metadata");
});

test("detecta Unity Mono por Assembly-CSharp.dll", () => {
  const dir = fixture({ "Game_Data/Managed/Assembly-CSharp.dll": peWithCli(true) });
  const out = detect(dir);
  assert.equal(out.primary, "unity-mono");
});

test("detecta UnityFS, Godot PCK e ASAR", () => {
  const unity = detect(fixture({ "bundle.bundle": "UnityFS\0resto" }));
  assert.equal(unity.primary, "unity-assetbundle");

  const godot = detect(fixture({ "game.pck": "GDPCresto" }));
  assert.equal(godot.primary, "godot-pck");

  const electron = detect(fixture({ "resources/app.asar": "qualquer" }));
  assert.equal(electron.primary, "electron-asar");
});

test("detecta APK, WASM e SQLite", () => {
  const apk = detect(fixture({ "game.apk": Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]) }));
  assert.equal(apk.primary, "android");

  const wasm = detect(fixture({ "game.wasm": Buffer.from([0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0]) }));
  assert.equal(wasm.primary, "wasm");

  const db = detect(fixture({ "save.db": "SQLite format 3\0resto" }));
  assert.equal(db.primary, "sqlite");
});

test("tipo desconhecido não inventa rota", () => {
  const out = detect(fixture({ "leiame.txt": "nada aqui" }));
  assert.equal(out.primary, "desconhecido");
  assert.equal(out.detections[0].confidence, "baixa");
});

test("diretório vazio responde sem erro", () => {
  const out = detect(mkdtempSync(join(tmpdir(), "detect-empty-")));
  assert.equal(out.scanned.files, 0);
  assert.deepEqual(out.detections, []);
});
