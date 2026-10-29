/**
 * Prestige track 2's hat, outfit, back item and aura in 3D (`core/src/prestige.ts`): Cosmic, cyan over midnight blue.
 * Loaded by `gear3dPrestige.ts`: it adds its hat to the shop's `HAT_BUILDERS` by item name and pulls in the body
 * (`gear3dPrestige2Body.ts`: the Nebula suit and the Orbital backpack) and aura (`gear3dPrestige2Aura.ts`) halves. Same
 * frames as `gear3dHead.ts`: the head frame has its origin at the skull's centre, +z is the face and +y up; a voxel
 * head draws every ball as a cube.
 */
import type { Model } from "../kit/kit.ts";
import "./gear3dPrestige2Aura.ts";
import "./gear3dPrestige2Body.ts";
import { band, type Ctx, HAT_BUILDERS, lit, shaped, star } from "./gear3dHead.ts";
import { isVox } from "./voxgear.ts";

const MID = "#1b2a6b";
const MID_L = "#3550c0";
const CYAN = "#22d3ee";
const GLOW = "#8cf0ff";
const PALE = "#ffffff";
const VIOLET = "#7a5cff";

/** A point at angle `a` round a head: on a circle for smooth models, on the square band for blocky ones. */
function roundAt(m: Model, a: number, r: number): [number, number] {
  const x = Math.sin(a);
  const z = Math.cos(a);
  if (!isVox(m)) return [x * r, z * r];
  const k = (r * 0.92) / Math.max(Math.abs(x), Math.abs(z));
  return [x * k, z * k];
}

/**
 * A midnight-blue crown with five points, each tipped with a glowing star, a cyan gem and a big four-point star over
 * the front, tiny white stars sewn across the band, and three small lights that orbit it (cyan, white and violet).
 */
function starfieldCrown(m: Model, c: Ctx): void {
  // Clear the voxel character's taller hair, as with the cases' crowns.
  const up = isVox(m) ? 0.1 : 0;
  const y = 0.16 + up;
  band(m, MID, 0.245, 0.07, y, 0.25);
  band(m, lit(CYAN), 0.252, 0.012, y);
  band(m, lit(CYAN), 0.252, 0.012, y + 0.06);
  // Five points, the front one tallest, each with a star on its tip.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const [x, z] = roundAt(m, a, 0.235);
    const h = i === 0 ? 0.15 : 0.1;
    m.cyl(0.045, h, i === 0 ? MID_L : MID, [x, y + 0.06, z], 0.006, 5);
    m.ball(0.02, lit(i === 0 ? PALE : GLOW), [x, y + 0.06 + h + 0.008, z], [1, 1, 1], 6);
  }
  // The star over the front point, and the gem under it.
  const crest = m.part([0, y + 0.3, 0.25]);
  shaped(crest, "cosmic-star", star(0.07, 4, 0.33), 0.022, lit(GLOW), [0, 0, 0]);
  shaped(crest, "cosmic-core", star(0.032, 4, 0.35), 0.026, lit(PALE), [0, 0, 0.012]);
  m.ball(0.026, lit(CYAN), [0, y + 0.035, 0.262], [1, 1.2, 0.6], 8);
  // Stars sewn on the band.
  for (let i = 0; i < 11; i++) {
    const a = ((i + 0.5) / 11) * Math.PI * 2 + 0.2;
    const [x, z] = roundAt(m, a, 0.256);
    m.box([0.014, 0.014, 0.014], lit(PALE), [x, y + 0.02 + (i % 3) * 0.014, z], 0);
  }
  // Three lights going round above it.
  const orbit = m.part([0, y + 0.19, 0]);
  const lights = [GLOW, PALE, VIOLET].map((col, i) => {
    const p = orbit.part([0, 0, 0]);
    p.box([0.03, 0.03, 0.03], lit(col), [0, -0.015, 0], 0);
    p.box([0.012, 0.07, 0.012], lit(col), [0, -0.035, 0], 0);
    p.box([0.07, 0.012, 0.012], lit(col), [-0.035, -0.0, 0], 0);
    p.userData.noBlock = true;
    return { p, a: (i / 3) * Math.PI * 2 };
  });
  c.tick((t) => {
    for (const [i, l] of lights.entries()) {
      const a = l.a + t * 0.9;
      l.p.position.set(Math.cos(a) * 0.3, Math.sin(t * 1.4 + i * 2) * 0.02, Math.sin(a) * 0.3);
      l.p.rotation.y = t * 2;
    }
    crest.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08);
    crest.rotation.y = Math.sin(t * 0.8) * 0.25;
  });
}

Object.assign(HAT_BUILDERS, {
  "Starfield crown": (m: Model, c: Ctx) => starfieldCrown(m, c),
});
