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
    const hooks = data.hooks?.PreToolUse;
    assert.ok(Array.isArray(hooks) && hooks.length > 0, "sem PreToolUse");
    const cmds = hooks.flatMap((h) => h.hooks ?? []).map((h) => h.command ?? "");
    assert.ok(
      cmds.some((c) => c.includes("guard-impl.mjs")),
      "hook não aponta para guard-impl.mjs"
    );
    for (const c of cmds) assert.equal(typeof c, "string");
  });
}

test("os dois templates de settings de sala usam caminhos coerentes", () => {
  const impl = JSON.parse(readFileSync(join(root, "rooms/impl/.claude/settings.json"), "utf8"));
  const cmd = impl.hooks.PreToolUse[0].hooks[0].command;
  assert.match(cmd, /\$CLAUDE_PROJECT_DIR/);
  assert.match(cmd, /guard-impl\.mjs/);
});
