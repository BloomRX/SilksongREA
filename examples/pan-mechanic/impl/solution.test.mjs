import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stepAim, shortestDelta } from "./solution.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(here, "..", "golden.json"), "utf8"));

test("golden: cada vetor da spec passa", async (t) => {
  for (const c of golden.cases) {
    await t.test(c.id, () => {
      const got = stepAim(c.input);
      assert.ok(
        Math.abs(got - c.expected) <= (c.tolerance ?? 1e-6),
        `${c.id}: esperado ${c.expected}, obtido ${got}`
      );
    });
  }
});

test("invariantes da spec", () => {
  assert.equal(shortestDelta(0, 180), 180, "empate em +180");
  assert.equal(shortestDelta(180, 0), 180, "empate em +180 pelo outro lado");
  for (const current of [0, 90, 359.5]) {
    for (const target of [0, 12, 200, 359]) {
      const out = stepAim({
        current_angle: current,
        target_angle: target,
        max_turn_rate: 720,
        dt_ms: 1000,
        dead_zone_deg: 0,
      });
      assert.ok(out >= 0 && out < 360, `saída fora de [0,360): ${out}`);
    }
  }
});

test("nunca passa do alvo", () => {
  const out = stepAim({
    current_angle: 10,
    target_angle: 30,
    max_turn_rate: 3600,
    dt_ms: 1000,
    dead_zone_deg: 0,
  });
  assert.equal(out, 30);
});
