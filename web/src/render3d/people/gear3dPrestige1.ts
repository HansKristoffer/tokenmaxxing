/**
 * Prestige track 1's hat, outfit, back item and aura in 3D (`core/src/prestige.ts`): Ascendant, violet and silver,
 * runes and rising light. Loaded by `gear3dPrestige.ts`, it adds the visor to `HAT_BUILDERS` by name and pulls in the
 * body (`gear3dPrestige1Body.ts`: the robes and the runic cape) and aura (`gear3dPrestige1Aura.ts`) halves. Same
 * frames as `gear3dHead.ts`: the head frame has its origin at the skull's centre, +z is the face and +y up; a voxel
 * head draws every ball as a cube and snaps every turn to a quarter, so its wings are steps, not slanted blades.
 */
import type * as THREE from "three";
import type { Model } from "../kit/kit.ts";
import "./gear3dPrestige1Aura.ts";
import "./gear3dPrestige1Body.ts";
import { band, COVERS_HAIR, type Ctx, dome, HAT_BUILDERS, lit, see } from "./gear3dHead.ts";
import { isVox } from "./voxgear.ts";

const VIOLET = "#8b5cf6";
const VIOLET_DEEP = "#5b34c4";
const VIOLET_DARK = "#3b2478";
const SILVER = "#d6dbe6";
const SILVER_DARK = "#9aa3b8";
const GLOW = "#c4a8ff";
const WHITE = "#ffffff";

/** One swept-back wing of light off a temple: three feathers fanning up and back, the outer ones violet. */
function wing(m: Model, s: -1 | 1): THREE.Object3D[] {
  const feathers: THREE.Object3D[] = [];
  if (isVox(m)) {
    // Steps climbing outward and back: silver in front, the light behind it.
    const steps: [number, number, number, string][] = [
      [0.27, 0.12, 0.02, SILVER],
      [0.3, 0.17, -0.01, SILVER],
      [0.33, 0.23, -0.04, SILVER_DARK],
      [0.35, 0.3, -0.07, SILVER],
      [0.37, 0.37, -0.1, WHITE],
      [0.29, 0.2, -0.06, GLOW],
      [0.32, 0.27, -0.09, GLOW],
      [0.34, 0.34, -0.12, VIOLET],
    ];
    for (const [x, y, z, c] of steps) {
      const b = m.box([0.055, 0.06, 0.06], c === WHITE || c === GLOW ? lit(c) : c, [s * x, y - 0.025, z]);
      feathers.push(b);
    }
    return feathers;
  }
  const root = m.part([s * 0.265, 0.1, -0.02]);
  root.rotation.set(-0.45, 0, -s * 0.28);
  // Each feather is a slim blade standing off the pivot, fanned wider and shorter outwards.
  const blades: [number, number, number, string][] = [
    [0.27, 0.036, 0.0, SILVER],
    [0.22, 0.03, -0.42, GLOW],
    [0.17, 0.026, -0.82, VIOLET],
  ];
  for (const [len, w, a, c] of blades) {
    const f = root.part([0, 0, 0]);
    f.rotation.z = s * a;
    f.box([w, len, 0.012], c === SILVER ? c : lit(c), [0, 0, 0], 0.004);
    f.cyl(w * 0.5, 0.05, lit(WHITE), [0, len, 0], 0.001, 6);
    feathers.push(f);
  }
  return feathers;
}

/**
 * A violet crown with a silver band round the brow, a dark violet lens set in under it and a rune stone that
 * pulses at its middle. A wing of light rises off each temple and lifts a little on the breath.
 */
function visor(m: Model, c: Ctx): void {
  const vox = isVox(m);
  if (vox) {
    // Stepped slabs, each a little narrower, standing clear of the blocky head's own corners.
    m.box([0.6, 0.09, 0.6], VIOLET, [0, 0.1, 0]);
    m.box([0.54, 0.09, 0.54], VIOLET, [0, 0.19, 0]);
    m.box([0.44, 0.07, 0.44], VIOLET, [0, 0.28, 0]);
    m.box([0.26, 0.03, 0.26], GLOW, [0, 0.35, 0]);
  } else dome(m, VIOLET, 0.285, 0.035, 0.46);
  // A darker seam where the crown meets the band, and the band itself.
  band(m, VIOLET_DEEP, 0.288, 0.03, 0.11);
  band(m, SILVER, 0.296, 0.05, 0.065);
  band(m, SILVER_DARK, 0.298, 0.012, 0.062);
  // The lens: a dark violet pane across the brow, bent round the face in three pieces.
  const lens = see(VIOLET_DARK, 0.88, true);
  const glass = see(GLOW, 0.5, true);
  m.box([0.2, 0.05, 0.03], lens, [0, 0.015, 0.262], 0.008);
  m.box([0.2, 0.012, 0.03], glass, [0, 0.053, 0.265], 0.003);
  for (const s of [-1, 1] as const) {
    const side = m.box([0.1, 0.05, 0.026], lens, [s * 0.15, 0.015, vox ? 0.22 : 0.21], 0.008);
    if (!vox) side.rotation.y = s * 0.7;
    m.box([0.026, 0.05, 0.026], SILVER, [s * (vox ? 0.255 : 0.235), 0.015, vox ? 0.1 : 0.12], 0.006);
  }
  // The rune stone: a bright diamond on the band, with a small silver setting.
  m.box([0.07, 0.07, 0.02], SILVER, [0, 0.062, 0.292], 0.01).rotation.z = vox ? 0 : Math.PI / 4;
  const stone = m.box([0.044, 0.044, 0.03], lit(GLOW), [0, 0.075, 0.296], 0.006);
  if (!vox) stone.rotation.z = Math.PI / 4;
  // A crest of light up the middle of the crown.
  const crest = m.box([0.03, 0.09, 0.07], lit(WHITE), [0, vox ? 0.38 : 0.28, 0.0], 0.008);
  m.box([0.04, 0.03, 0.09], SILVER, [0, vox ? 0.365 : 0.265, 0.0], 0.008);

  const wings = ([-1, 1] as const).map((s) => wing(m, s));
  c.tick((t) => {
    const k = 0.5 + 0.5 * Math.sin(t * 2.4);
    stone.scale.setScalar(0.9 + k * 0.25);
    crest.scale.set(1, 0.85 + k * 0.3, 1);
    if (vox) return;
    wings.forEach((w, i) => {
      for (const [j, f] of w.entries()) f.rotation.x = Math.sin(t * 1.5 + j * 0.5 + i * 0.4) * 0.05;
    });
  });
}

Object.assign(HAT_BUILDERS, {
  "Ascendant visor": (m: Model, c: Ctx) => visor(m, c),
});
COVERS_HAIR.add("Ascendant visor");
