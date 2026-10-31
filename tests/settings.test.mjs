import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  ".claude/settings.json",
  "rooms/analysis/.claude/settings.json",
  "rooms/impl/.claude/settings.json",
];

for (const rel of files) {
  test(`settings válido: ${rel}`, () => {
    const p = join(root, rel);
    assert.ok(existsSync(p), `faltou ${rel}`);
    const data = JSON.parse(readFileSync(p, "utf8"));
    assert.equal(typeof data, "object");
    const hooks = data.hooks?.PreToolUse;
    if (!hooks) return;
    assert.ok(Array.isArray(hooks));
    for (const h of hooks) {
      for (const c of h.hooks ?? []) assert.equal(typeof c.command, "string");
    }
    const cmds = hooks.flatMap((h) => h.hooks ?? []).map((h) => h.command ?? "");
    for (const c of cmds) {
      if (c.trim()) assert.match(c, /guard-impl\.mjs/);
    }
  });
}

test("hooks vêm desativados por padrão", () => {
  for (const rel of files) {
    const data = JSON.parse(readFileSync(join(root, rel), "utf8"));
    assert.deepEqual(data.hooks?.PreToolUse ?? [], [], `${rel} deveria vir sem hooks`);
  }
});

test("bootstrap sabe ativar e desativar hooks", () => {
  const s = readFileSync(join(root, "scripts/bootstrap.sh"), "utf8");
  assert.match(s, /--hooks/);
  assert.match(s, /--no-hooks/);
  assert.match(s, /INSTALL_HOOKS/);
});
