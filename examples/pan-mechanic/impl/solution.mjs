/**
 * Implementação independente da spec em ../spec.md (mecânica fictícia).
 * Nenhuma linha do original foi vista; tudo abaixo segue as seções 3 e 4.
 */

const normalize = (deg) => ((deg % 360) + 360) % 360;

/** Menor diferença angular em (−180, 180], com empate em +180 (spec §4.2). */
export function shortestDelta(current, target) {
  let d = normalize(target - current);
  if (d > 180) d -= 360;
  if (d === -180) d = 180;
  return d;
}

/**
 * Um passo de mira assistida.
 * @param {{current_angle:number,target_angle:number,max_turn_rate:number,dt_ms:number,dead_zone_deg:number}} input
 * @returns {number} ângulo resultante em [0, 360)
 */
export function stepAim({ current_angle, target_angle, max_turn_rate, dt_ms, dead_zone_deg }) {
  const current = normalize(current_angle); // spec §4.1
  const rate = Math.min(Math.max(max_turn_rate, 0), 720); // spec §3 + §5
  const dt = Math.min(Math.max(dt_ms, 0), 1000); // spec §3 + §5
  const dead = Math.min(Math.max(dead_zone_deg, 0), 180);

  const delta = shortestDelta(current, target_angle); // spec §4.2

  if (Math.abs(delta) <= dead) return current; // spec §4.3

  const maxStep = (rate * dt) / 1000; // spec §4.4
  const step = Math.min(maxStep, Math.abs(delta)); // spec §4.5
  return normalize(current + Math.sign(delta) * step); // spec §4.6
}
