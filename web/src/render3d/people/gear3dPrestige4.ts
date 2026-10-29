/**
 * Prestige track 4's hat, outfit, back item and aura in 3D (`core/src/prestige.ts`): the Architect's diadem, the
 * Worldbuilder regalia, the Lattice wings and the Orbiting wireframe, ivory and gold. Loaded by `gear3dPrestige.ts`:
 * it adds its builder to `HAT_BUILDERS` by item name and pulls in the body (`gear3dPrestige4Body.ts`: the regalia by
 * look index, the wings by name) and aura (`gear3dPrestige4Aura.ts`) halves. Same frames as `gear3dHead.ts`: the
 * head frame has its origin at the skull's centre, +z is the face and +y up; a voxel head draws every ball as a cube.
 */
import type { Model } from "../kit/kit.ts";
import "./gear3dPrestige4Aura.ts";
import "./gear3dPrestige4Body.ts";
import { band, COVERS_HAIR, type Ctx, HAT_BUILDERS, lit, ring } from "./gear3dHead.ts";
import { isVox } from "./voxgear.ts";

const IVORY = "#f5e6b8";
const IVORY_DARK = "#cdb98a";
const GOLD = "#d4a017";
const GOLD_LIGHT = "#f0c94a";
const GOLD_DARK = "#9c710e";
const GLOW = "#ffe38a";
const STEEL = "#dfe6ee";
const LEAD = "#3a3340";

/** A point at angle `a` round a head: on a circle for smooth models, on the square band for blocky ones. */
function roundAt(m: Model, a: number, r: number): [number, number] {
  const x = Math.sin(a);
  const z = Math.cos(a);
  if (!isVox(m)) return [x * r, z * r];
  const k = (r * 0.92) / Math.max(Math.abs(x), Math.abs(z));
  return [x * k, z * k];
}

/**
 * A slim ivory band with gold edges and ruler ticks all along its front, a gold drafting compass standing on the brow
 * (a glowing hinge, two legs that open and close a little, a steel needle and a pencil lead), a small gold finial
 * either side and a spire behind, and a thin gold ring of ticks turning above the band like a dimension circle.
 */
function diadem(m: Model, c: Ctx): void {
  const vox = isVox(m);
  // The blocky head's hair stands higher than the round head these are drawn for.
  const y = 0.15 + (vox ? 0.04 : 0);

  band(m, IVORY, 0.245, 0.06, y, 0.25);
  band(m, GOLD, 0.254, 0.012, y - 0.004);
  band(m, GOLD, 0.254, 0.012, y + 0.052);

  // Ruler ticks across the front half: a long one every fifth, a short one between.
  for (let i = -6; i <= 6; i++) {
    const [x, z] = roundAt(m, i * 0.19, 0.256);
    const long = i % 3 === 0;
    const tick = m.box(
      [0.009, long ? 0.044 : 0.026, 0.01],
      long ? GOLD_DARK : GOLD,
      [x, y + (long ? 0.008 : 0.017), z],
      0.002,
    );
    if (!vox) tick.rotation.y = i * 0.19;
  }

  // The compass: its hinge on the brow, the legs hanging from it to the band.
  const hy = y + 0.31;
  const hz = 0.245;
  m.ball(0.03, GOLD, [0, hy, hz]);
  m.ball(0.017, lit(GLOW), [0, hy + 0.002, hz + 0.022]);
  m.cyl(0.008, 0.045, GOLD_DARK, [0, hy + 0.025, hz], 0.003, 6);
  const legs = ([-1, 1] as const).map((s) => {
    const leg = m.part([0, hy, hz]);
    leg.box([0.017, 0.25, 0.017], GOLD_LIGHT, [0, -0.25, 0], 0.004);
    leg.box([0.022, 0.03, 0.022], GOLD_DARK, [0, -0.07, 0], 0.004);
    // One leg ends in a steel needle, the other in a pencil lead.
    leg.cyl(0.011, 0.045, s < 0 ? STEEL : IVORY_DARK, [0, -0.295, 0], 0.003, 6);
    if (s > 0) leg.cyl(0.006, 0.012, LEAD, [0, -0.305, 0], 0.003, 6);
    return leg;
  });

  // A finial either side and a spire behind, pointing up from the band.
  for (const a of [-Math.PI / 2, Math.PI / 2, Math.PI]) {
    const [x, z] = roundAt(m, a, 0.252);
    m.cyl(0.026, a === Math.PI ? 0.14 : 0.1, GOLD, [x, y + 0.05, z], 0.004, 5);
    m.ball(0.013, lit(GLOW), [x, y + (a === Math.PI ? 0.2 : 0.16), z]);
  }

  // The dimension circle: a thin gold ring with a tick every twelfth of the way round, turning slowly above the band.
  const dim = m.part([0, y + 0.115, 0]);
  ring(dim, lit(GOLD_LIGHT), 0.265, 0.006);
  for (let i = 0; i < 12; i++) {
    const [x, z] = roundAt(m, (i / 12) * Math.PI * 2, 0.265);
    dim.box(
      [0.012, 0.014, i % 3 === 0 ? 0.045 : 0.026],
      i % 3 === 0 ? lit(GLOW) : GOLD,
      [x, -0.007, z],
      0.002,
    ).rotation.y = isVox(m) ? 0 : (i / 12) * Math.PI * 2;
  }

  c.tick((t) => {
    const open = 0.2 + Math.sin(t * 0.9) * 0.06;
    if (!vox) {
      legs[0]!.rotation.z = -open;
      legs[1]!.rotation.z = open;
    }
    dim.rotation.y = t * 0.5;
    dim.position.y = y + 0.115 + Math.sin(t * 1.4) * 0.008;
  });
}

Object.assign(HAT_BUILDERS, {
  "Architect's diadem": (m: Model, c: Ctx) => diadem(m, c),
});
COVERS_HAIR.add("Architect's diadem");
