import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const skillDirs = [
  ".claude/skills",
  "rooms/analysis/.claude/skills",
  "rooms/impl/.claude/skills",
].flatMap((base) => {
  const abs = join(root, base);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((name) => statSync(join(abs, name)).isDirectory())
    .map((name) => ({ base, name, dir: join(abs, name) }));
});

test("há pelo menos as três skills do kit", () => {
  const names = skillDirs.map((s) => s.name);
  for (const expected of ["clean-room-orchestrator", "clean-room-spec", "clean-room-impl"]) {
    assert.ok(names.includes(expected), `faltou a skill ${expected}`);
  }
});

for (const skill of skillDirs) {
  test(`skill válida: ${skill.base}/${skill.name}`, () => {
    const file = join(skill.dir, "SKILL.md");
    assert.ok(existsSync(file), `faltou SKILL.md em ${skill.name}`);

    const text = readFileSync(file, "utf8");
    assert.match(text, /^---\n/, "frontmatter ausente");
    const end = text.indexOf("\n---", 3);
    assert.ok(end > 0, "frontmatter sem fechamento");
    const fm = text.slice(4, end);

    const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    assert.equal(name, skill.name, "name deve ser igual ao diretório");

    const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
    assert.ok(description.length > 40, "description curta demais para acionar a skill");
    assert.match(description, /use quando|use quando estiver|use quando o/i, "description deve dizer quando usar");

    assert.match(fm, /metadata:\s*\n\s+version:/, "metadata.version ausente");

    const body = text.slice(end + 4);
    assert.ok(body.trim().length > 200, "corpo da skill muito curto");

    // Referências citadas devem existir.
    const refs = [...body.matchAll(/`(references\/[^`]+)`/g)].map((m) => m[1]);
    for (const ref of refs) {
      assert.ok(existsSync(join(skill.dir, ref)), `referência ausente: ${ref} em ${skill.name}`);
    }
  });
}

test("nenhuma skill contém caminho absoluto da máquina", () => {
  for (const skill of skillDirs) {
    const text = readFileSync(join(skill.dir, "SKILL.md"), "utf8");
    assert.ok(!/\/home\/|\/Users\/|[A-Z]:\\\\/.test(text), `caminho absoluto em ${skill.name}`);
  }
});
