/**
 * The Night Market case and its key in 3D (voxel/low-poly, built with the furniture kit like `night3d.ts`).
 *
 *   buildCaseBox(false)  // Model: the case, lid down, bottom centre at the origin, front along +z (~0.9 x 0.8 x 0.6)
 *   buildCaseBox(true)   // the same case, lid up, warm light spilling out
 *   buildCaseKey()       // Model: the market token on its tassel, hanging with its lowest point at y = 0
 *
 * Each model animates itself: the lantern glow pulses (the case), the token spins slowly (the key), the tag
 * swings. The animation is registered in the kit's `ticks` (so the world's loop and a scene that runs
 * `ticks` drive it), and is also exposed as `animateCaseModel(model, seconds)` for a UI that has its own loop.
 * Either is idempotent in absolute time; calling both is harmless.
 *
 * Icons: `caseBoxIcon("closed" | "open" | "key", 64 | 128)` returns { promise, cancel } like `requestIcon`
 * (it asks `render3d/icons.ts` for `{ kind: "case", what }`; use it only on the 3D tiers, after
 * `iconsAvailable()`). Remember to dispose a model you build and keep (`disposeObject` from engine/dispose.ts).
 */
import * as THREE from "three";
import { C } from "../art/palette.ts";
import type { IconSize } from "./icons.ts";
import { glow, Model, ticks, tint } from "./kit/kit.ts";

export type CaseIcon = "closed" | "open" | "key";

const PLUM = "#3d1a52";
const PLUM_DARK = "#2a1139";
const WINE = "#6e2260";
const CRIMSON = "#a82840";
const CRIMSON_LIGHT = "#d8402f";
const LACQUER = "#23202b";
const GOLD = "#e9b73d";
const GOLD_DARK = "#b8860b";
const GOLD_LIGHT = "#ffd36a";
const PAPER = "#fff1c9";
const ORANGE = "#f08a3c";
const RED = "#d8402f";
const RED_DARK = "#a42a22";

const W = 0.9;
const D = 0.6;
const BODY_H = 0.46;
const LID_H = 0.2;

type Animator = (t: number) => void;
const animators = new WeakMap<THREE.Object3D, Animator>();

/** Runs a case or key model's own animation at absolute time `t` (seconds). Safe to call every frame. */
export function animateCaseModel(model: THREE.Object3D, t: number): void {
  animators.get(model)?.(t);
}

const register = (m: Model, fn: Animator): void => {
  animators.set(m, fn);
  ticks.push(fn);
};

/** A lit paper lantern emblem on the front, facing +z, centred at (0, y, z). Returns the pieces that pulse. */
function lanternEmblem(m: Model, y: number, z: number, lit: THREE.MeshBasicMaterial): void {
  m.box([0.34, 0.34, 0.02], LACQUER, [0, y - 0.17, z], 0.01);
  m.box([0.34, 0.02, 0.026], GOLD, [0, y + 0.15, z], 0.004);
  const cy = y;
  m.cyl(0.05, 0.03, GOLD, [0, cy - 0.04, z + 0.03], 0.04, 8);
  m.ball(0.1, lit, [0, cy - 0.15, z + 0.045], [1, 1.15, 0.45], 14);
  for (const dy of [-0.06, 0.06])
    m.box([0.2, 0.012, 0.012], ORANGE, [0, cy - 0.15 + dy * 1.15, z + 0.082], 0.002);
  m.cyl(0.05, 0.022, GOLD, [0, cy - 0.285, z + 0.03], 0.05, 8);
  m.cyl(0.01, 0.045, RED, [0, cy - 0.33, z + 0.03], 0.01, 5);
}

/** Gold corner caps and two straps round a box of `w`x`h`x`d` whose bottom is at y0. */
function straps(m: Model, w: number, h: number, d: number, y0: number): void {
  for (const x of [-1, 1]) {
    m.box([0.07, h + 0.02, d + 0.02], GOLD, [x * (w / 2 - 0.1), y0 - 0.01, 0], 0.012);
    m.box([0.02, h + 0.02, d + 0.03], GOLD_LIGHT, [x * (w / 2 - 0.1) - 0.025, y0 - 0.01, 0], 0.004);
  }
}

export function buildCaseBox(open: boolean): Model {
  const m = new Model();
  const lit = glow("#ffd36a");
  // A foot and the two-tone lacquer: plum below, crimson under the lid, a wine band between.
  m.box([W + 0.04, 0.05, D + 0.04], PLUM_DARK, [0, 0, 0], 0.012);
  m.box([W, BODY_H - 0.05, D], PLUM, [0, 0.05, 0], 0.03);
  m.box([W + 0.004, 0.14, D + 0.004], WINE, [0, 0.05 + 0.13, 0], 0.03);
  m.box([W + 0.008, 0.12, D + 0.008], CRIMSON, [0, BODY_H - 0.12, 0], 0.03);
  m.box([0.2, 0.025, 0.01], CRIMSON_LIGHT, [-0.28, BODY_H - 0.06, D / 2 + 0.006], 0.004);
  straps(m, W, BODY_H - 0.02, D, 0.02);
  lanternEmblem(m, BODY_H - 0.1, D / 2 + 0.002, lit);
  // Gold lip round the mouth.
  m.box([W + 0.05, 0.03, D + 0.05], GOLD, [0, BODY_H, 0], 0.01);
  // The hanging tag, from the right strap: swings a little.
  const tag = m.part([W / 2 - 0.1, BODY_H - 0.12, D / 2 + 0.03]);
  tag.cyl(0.006, 0.07, GOLD_DARK, [0, -0.07, 0], 0.006, 4);
  tag.box([0.1, 0.14, 0.015], PAPER, [0, -0.21, 0.004], 0.004);
  tag.ball(0.022, RED, [0, -0.17, 0.016], [1, 1, 0.3], 8);
  tag.box([0.05, 0.012, 0.004], C.ink, [0, -0.23, 0.014], 0.001);

  // The lid, hinged along the back top edge.
  const hinge = m.part([0, BODY_H + 0.03, -D / 2]);
  const lid = hinge.part([0, 0, D / 2]);
  lid.box([W + 0.06, LID_H, D + 0.06], WINE, [0, 0, 0], 0.04);
  lid.box([W + 0.062, LID_H * 0.5, D + 0.062], "#8a2450", [0, LID_H * 0.5, 0], 0.04);
  lid.box([W - 0.06, 0.03, D - 0.06], CRIMSON, [0, LID_H, 0], 0.02);
  lid.box([0.5, 0.012, 0.03], CRIMSON_LIGHT, [-0.1, LID_H + 0.03, D / 2 - 0.1], 0.004);
  lid.box([W + 0.07, 0.03, D + 0.07], GOLD, [0, 0, 0], 0.01);
  for (const x of [-1, 1]) lid.box([0.07, LID_H + 0.03, D + 0.08], GOLD, [x * (W / 2 - 0.1), 0, 0], 0.012);
  // Clasp.
  lid.box([0.1, 0.1, 0.02], GOLD, [0, 0.03, D / 2 + 0.04], 0.008);
  lid.ball(0.022, RED, [0, 0.07, D / 2 + 0.056], [1, 1, 0.5], 8);

  const pulse: Animator[] = [];
  if (open) {
    hinge.rotation.x = -1.95;
    // The mouth full of light, a beam rising out of it and motes drifting up.
    m.box([W - 0.08, 0.02, D - 0.08], lit, [0, BODY_H - 0.005, 0], 0.004);
    const beamMat = new THREE.MeshBasicMaterial({
      color: "#ffe29a",
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const beam = m.cyl(0.3, 0.7, beamMat, [0, BODY_H + 0.01, 0], 0.18, 4);
    beam.rotation.y = Math.PI / 4;
    beam.scale.set(1.35, 1, 0.95);
    const motes: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) motes.push(m.ball(0.018, PAPER, [0, BODY_H, 0], [1, 1, 1], 6));
    // The inside of the lid, lit warm from below.
    lid.box([W - 0.06, 0.012, D - 0.06], "#e08a4a", [0, -0.006, 0], 0.004);
    pulse.push((t) => {
      beamMat.opacity = 0.24 + 0.07 * Math.sin(t * 2.4);
      motes.forEach((s, i) => {
        const u = (t * 0.28 + i / motes.length) % 1;
        const a = i * 2.4 + t * 0.6;
        s.position.set(
          Math.sin(a) * 0.28 * (0.3 + u),
          BODY_H + 0.02 + u * 0.75,
          Math.cos(a) * 0.17 * (0.3 + u),
        );
        s.scale.setScalar(Math.max(0.01, 1 - u) * 1.2);
      });
    });
  }
  register(m, (t) => {
    const g = 0.5 + 0.5 * Math.sin(t * 2.6);
    lit.color.set(tint("#ffcf5c", -0.08 + 0.2 * g));
    tag.rotation.z = 0.14 * Math.sin(t * 1.7);
    for (const fn of pulse) fn(t);
  });
  animators.get(m)?.(0);
  return m;
}

export function buildCaseKey(): Model {
  const m = new Model();
  const R = 0.3;
  const CENTRE = 0.69;
  const spin = m.part([0, CENTRE, 0]);
  /** A flat disc lying along z: `h` thick from `z`. */
  const disc = (r: number, h: number, z: number, color: string) => {
    const d = spin.cyl(r, h, color, [0, 0, z], r, 28);
    d.rotation.x = Math.PI / 2;
  };
  disc(R, 0.1, -0.05, GOLD);
  // Each face: a raised rim, a darker ring and the field, the lantern stamped below the hole.
  for (const turn of [0, Math.PI]) {
    const f = spin.part([0, 0, 0], turn);
    const fdisc = (r: number, h: number, z: number, color: string) => {
      const d = f.cyl(r, h, color, [0, 0, z], r, 28);
      d.rotation.x = Math.PI / 2;
    };
    fdisc(R, 0.02, 0.05, GOLD_LIGHT);
    fdisc(R * 0.82, 0.024, 0.05, GOLD_DARK);
    fdisc(R * 0.76, 0.028, 0.05, GOLD);
    const z = 0.082;
    f.box([0.12, 0.012, 0.012], GOLD_DARK, [0, -0.215, z - 0.006], 0.002);
    f.box([0.07, 0.02, 0.012], GOLD_DARK, [0, -0.2, z - 0.006], 0.002);
    f.ball(0.06, RED, [0, -0.12, z], [0.9, 1.2, 0.25], 10);
    f.box([0.13, 0.014, 0.014], GOLD_DARK, [0, -0.09, z], 0.003);
    f.box([0.13, 0.014, 0.014], GOLD_DARK, [0, -0.155, z], 0.003);
    f.box([0.05, 0.03, 0.014], GOLD_DARK, [0, -0.06, z - 0.002], 0.003);
  }
  // The square hole through the middle, up top, and the red cord looped through it.
  spin.box([0.1, 0.1, 0.19], PLUM_DARK, [0, 0.07, 0], 0.003);
  for (const x of [-0.035, 0.035]) spin.cyl(0.012, 0.22, RED, [x, 0.12, 0], 0.012, 6);
  spin.box([0.082, 0.026, 0.026], RED, [0, 0.34, 0], 0.01);
  // The tassel under the coin: a cord, a gold bead, a knot and a skirt of red strands.
  const t = m.part([0, 0.15, 0]);
  t.cyl(0.012, 0.12, RED, [0, 0.12, 0], 0.012, 6);
  t.ball(0.035, GOLD, [0, 0.1, 0], [1, 1.2, 1], 8);
  t.cyl(0.05, 0.03, GOLD_DARK, [0, 0.03, 0], 0.035, 8);
  t.cyl(0.078, 0.18, RED, [0, -0.15, 0], 0.045, 10);
  t.cyl(0.07, 0.02, RED_DARK, [0, -0.05, 0], 0.07, 10);
  t.cyl(0.078, 0.02, RED_DARK, [0, -0.15, 0], 0.078, 10);
  t.box([0.016, 0.14, 0.016], "#f06a4a", [0.035, -0.14, 0.05], 0.004);
  register(m, (time) => {
    spin.rotation.y = time * 0.9;
    spin.position.y = CENTRE + 0.012 * Math.sin(time * 1.6);
    t.rotation.z = 0.05 * Math.sin(time * 1.6 + 1);
  });
  return m;
}

/** A picture of the case (closed or open) or the key, through the shared icon renderer (3D tiers only). */
export function caseBoxIcon(
  what: CaseIcon,
  size: IconSize,
): { promise: Promise<HTMLCanvasElement>; cancel: () => void } {
  let cancel = () => {};
  let dead = false;
  const promise = import("./icons.ts").then((m) => {
    if (dead) throw new Error("cancelled");
    const r = m.requestIcon({ kind: "case", what }, size);
    cancel = r.cancel;
    return r.promise;
  });
  return {
    promise,
    cancel: () => {
      dead = true;
      cancel();
    },
  };
}
