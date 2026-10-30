/**
 * Prestige track 3's body gear in 3D (`core/src/prestige.ts`): the Voidwalker armour and the Rift mantle, in the same
 * cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dPrestige3.ts`, it adds the armour to
 * `OUTFIT_BUILDERS` under its look index (700 + 2) and the mantle to `BACK_BUILDERS` under its name.
 */
import { PRESTIGE_BASE } from "@tokenmaxxing/core/prestige.ts";
import type * as THREE from "three";
import { seeded } from "../kit/kit.ts";
import { BACK_BUILDERS, type BackBuilder, type BodyCtx, OUTFIT_BUILDERS, roll } from "./gear3dBody.ts";
import { lit, see } from "./gear3dHead.ts";
import { U, type VoxModel, Vx, vpart } from "./voxgear.ts";

const PLATE = "#2c2040";
const PLATE_LIGHT = "#4b3870";
const PLATE_DARK = "#150e20";
const EDGE = "#6b54a0";
const MAGENTA = "#d946ef";
const PINK = "#ff7cf5";
const WHITE = "#ffeafd";
const MANTLE = ["#1d1428", "#241a33", "#170f21", "#2a1d3d"];

// MARK: Outfit

/** A glowing fault down a plate: stairs of light through `pts` (cube coordinates), a halo behind each and a white spot in the middle. */
function fault(v: Vx, z: number, dir: 1 | -1, pts: readonly (readonly [number, number])[]): void {
  for (const [x, y] of pts) {
    v.b(x - 0.2, y - 0.2, dir > 0 ? z : z - 0.3, 1.1, 1.1, 0.3, see(MAGENTA, 0.3, true));
    v.b(x, y, dir > 0 ? z + 0.1 : z - 0.5, 0.7, 0.7, 0.4, lit(MAGENTA));
  }
  const [hx, hy] = pts[Math.floor(pts.length / 2)]!;
  v.b(hx + 0.15, hy + 0.15, dir > 0 ? z + 0.3 : z - 0.6, 0.4, 0.4, 0.3, lit(WHITE));
}

// Voidwalker armour: black obsidian plate with a fault of magenta light running from the collar down across the
// breastplate (front and back), a gorget, pauldrons rimmed in light, vambraces, a belt with a glowing clasp, and faulds
// hanging front and back that swing as they walk.
OUTFIT_BUILDERS[PRESTIGE_BASE + 2] = (c: BodyCtx) => {
  c.sleeves(PLATE_DARK);
  const v = new Vx(c.body);
  // Black under the plates, whatever the torso is dressed in.
  v.b(-3.6, 0, -2.1, 7.2, 8, 4.2, PLATE_DARK);
  // The breastplate and the backplate, a ridge along the top and a flared lower edge.
  for (const s of [1, -1]) {
    const z = s > 0 ? 1.95 : -2.65;
    v.b(-3.6, 2.4, z, 7.2, 5.0, 0.7, PLATE);
    v.b(-3.6, 6.7, s > 0 ? 2.4 : -2.8, 7.2, 0.4, 0.4, PLATE_LIGHT);
    v.b(-3.3, 2.1, s > 0 ? 1.9 : -2.7, 6.6, 0.4, 0.8, PLATE_DARK);
    // Plate lines either side of the fault.
    for (const x of [-3.0, 2.2]) v.b(x, 3.0, s > 0 ? 2.6 : -2.8, 0.8, 3.4, 0.15, PLATE_LIGHT);
  }
  // The faults: jagged stairs of light from the top right, down and across, with a branch.
  const stairs = [
    [1.6, 6.5],
    [1.1, 5.8],
    [0.3, 5.3],
    [0.4, 4.5],
    [-0.4, 3.9],
    [-1.0, 3.3],
    [-1.6, 2.7],
  ] as const;
  fault(v, 2.5, 1, stairs);
  fault(
    v,
    -2.5,
    -1,
    stairs.map(([x, y]) => [-x, y] as const),
  );
  for (const [x, y] of [
    [0.9, 4.4],
    [1.5, 3.8],
  ] as const)
    v.b(x, y, 2.6, 0.45, 0.45, 0.3, lit(PINK));
  // The gorget at the neck, with a thin line of light round it.
  roll(c, PLATE, 1.4, 0.55);
  const rim = 4.12;
  v.b(-rim, 7.4, 2.5, 2 * rim, 0.25, 0.25, lit(MAGENTA));
  v.b(-rim, 7.4, -2.75, 2 * rim, 0.25, 0.25, lit(MAGENTA));
  for (const x of [-rim, rim - 0.25]) v.b(x, 7.4, -2.75, 0.25, 0.25, 5.5, lit(MAGENTA));
  // The belt, and the clasp: a hexagon of pink with a white heart.
  v.b(-3.9, 0.3, -2.3, 7.8, 1.2, 4.6, PLATE_DARK);
  v.b(-1.1, 0.2, 2.3, 2.2, 1.4, 0.35, EDGE);
  v.b(-0.7, 0.5, 2.6, 1.4, 0.8, 0.3, lit(PINK));
  v.b(-0.25, 0.7, 2.85, 0.5, 0.4, 0.2, lit(WHITE));
  // Pauldrons: three stepped plates with a spike, the rim of each in light; a vambrace on the forearm.
  c.arms.forEach((arm, i) => {
    const a = new Vx(vpart(arm));
    const s = i ? 1 : -1;
    a.b(-1.2, -5.8, -1.2, 2.4, 5.8, 2.4, PLATE_DARK);
    a.b(-1.8, -0.5, -1.8, 3.6, 1.3, 3.6, PLATE);
    a.b(-1.5, 0.8, -1.5, 3.0, 0.8, 3.0, PLATE_LIGHT);
    a.b(s > 0 ? 0.3 : -2.5, -2.0, -1.6, 2.2, 1.6, 3.2, PLATE);
    a.b(-0.45, 1.6, -0.45, 0.9, 1.3, 0.9, PLATE_LIGHT);
    a.b(-1.85, -0.6, -1.85, 3.7, 0.25, 3.7, lit(MAGENTA));
    a.b(s > 0 ? 0.35 : -2.55, -2.1, -1.65, 2.3, 0.2, 3.3, lit(MAGENTA));
    a.b(-1.3, -6.6, -1.3, 2.6, 1.8, 2.6, PLATE);
    a.b(-1.35, -5.0, -1.35, 2.7, 0.25, 2.7, lit(PINK));
  });
  // Faulds, hanging from the belt front and back: five plates each, fanning out, swinging as they walk.
  const skirts = [2, -2].map((z) => vpart(c.body, [0, 0.4 * U, z * U]));
  skirts.forEach((p, k) => {
    const f = new Vx(p);
    const s = k ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const x = -3.6 + i * 1.85;
      f.b(
        x,
        -2.8 + (i % 2) * 0.3,
        s > 0 ? -0.1 : -0.5,
        1.7,
        2.8 - (i % 2) * 0.3,
        0.6,
        i % 2 ? PLATE : PLATE_LIGHT,
      );
      f.b(x, -2.85 + (i % 2) * 0.3, s > 0 ? 0.35 : -0.55, 1.7, 0.18, 0.2, lit(MAGENTA));
    }
  });
  c.tick((t, walking) => {
    skirts.forEach((p, k) => {
      const s = k ? -1 : 1;
      p.rotation.x =
        s * (walking ? 0.1 + Math.abs(Math.sin(t * 11)) * 0.16 : 0.03 + Math.sin(t * 1.5) * 0.02);
    });
  });
};

// MARK: Back

// Rift mantle: a mantle of black torn from a rift. Rows of plates hang from the shoulders, each from the one above, so
// the lower rows swing out later; the hem is ragged, and its tears and both edges crackle with magenta light. A fault of
// light runs down the middle, a pink clasp holds it at the throat, and motes of light fly off it.
const MANTLE_BUILDER: BackBuilder = (b, tick) => {
  const rnd = seeded(7003);
  const rows = 6;
  const steps: VoxModel[] = [];
  const crackle: { o: THREE.Object3D; k: number }[] = [];
  let at = vpart(b, [0, -0.25 * U, -0.05 * U]);
  for (let i = 0; i < rows; i++) {
    const w = 7.8 + i * 0.5;
    const cols = 6;
    const last = i === rows - 1;
    const hang: number[] = [];
    for (let k = 0; k < cols; k++) {
      const cw = w / cols;
      const drop = last ? 0.6 + rnd() * 2.2 : 0;
      hang.push(drop);
      const h = 1.5 + drop;
      const x = -w / 2 + cw * (k + 0.5);
      at.box([cw * U * 1.02, h * U, 0.9 * U], MANTLE[Math.floor(rnd() * MANTLE.length)]!, [
        x * U,
        -h * U,
        -0.45 * U,
      ]);
      // The torn hem: a stitch of light at the foot of each strip.
      if (last)
        crackle.push({
          o: at.box([cw * U * 0.8, 0.22 * U, 0.2 * U], lit(MAGENTA), [x * U, -h * U, -0.98 * U]),
          k: k + i,
        });
    }
    // The edges, crackling.
    for (const s of [-1, 1]) {
      const e = at.box([0.28 * U, 1.3 * U, 0.2 * U], lit(i % 2 ? MAGENTA : PINK), [
        s * (w / 2) * U,
        -1.4 * U,
        -0.98 * U,
      ]);
      crackle.push({ o: e, k: i * 3 + (s > 0 ? 1 : 0) });
    }
    // The fault down the middle, in stairs.
    const fx = Math.sin(i * 1.9) * 0.9;
    at.box([0.9 * U, 1.45 * U, 0.2 * U], lit(MAGENTA), [fx * U, -1.5 * U, -0.98 * U]);
    at.box([1.9 * U, 1.5 * U, 0.1 * U], see(MAGENTA, 0.28, true), [fx * U, -1.5 * U, -1.05 * U]);
    if (i % 2) at.box([0.4 * U, 0.6 * U, 0.2 * U], lit(WHITE), [(fx + 0.1) * U, -0.9 * U, -1.05 * U]);
    const next = vpart(at, [0, -1.5 * U, 0]);
    steps.push(at);
    at = next;
  }
  // The shoulders: a pad over each, black with a rim of light, and the pink clasp at the throat.
  const v = new Vx(b);
  for (const s of [-1, 1]) {
    v.b(s > 0 ? 3.0 : -4.8, -1.4, -0.9, 1.8, 1.7, 5.4, MANTLE[1]!);
    v.b(s > 0 ? 3.2 : -4.6, -0.3, -0.7, 1.4, 0.5, 5.0, PLATE_LIGHT);
    v.b(s > 0 ? 3.0 : -4.8, -1.5, 4.3, 1.8, 0.2, 0.2, lit(MAGENTA));
  }
  v.b(-3.6, -1.6, 3.8, 7.2, 1.5, 1.0, MANTLE[3]!);
  v.b(-1.0, -2.2, 4.7, 2.0, 2.0, 0.5, EDGE);
  v.b(-0.6, -1.8, 5.1, 1.2, 1.2, 0.3, lit(PINK));
  v.b(-0.2, -1.4, 5.35, 0.4, 0.4, 0.2, lit(WHITE));
  // Motes of light shed off the rift, drifting out and up and thinning away.
  const motes = Array.from({ length: 7 }, (_, i) => ({
    o: v.b(-0.2, 0, -0.2, 0.4, 0.4, 0.4, lit(i % 2 ? PINK : MAGENTA)),
    p: i / 7,
    x: (rnd() - 0.5) * 6,
    y: -2 - rnd() * 6,
    s: 0.7 + rnd() * 0.6,
  }));
  for (const mote of motes) mote.o.userData.noBlock = true;
  tick((t, walking) => {
    steps.forEach((s, i) => {
      s.rotation.x = walking
        ? 0.1 + Math.abs(Math.sin(t * 11)) * 0.09 * (i ? 0.7 : 1.3) + Math.sin(t * 11 - i * 0.8) * 0.05 * i
        : 0.03 + (Math.sin(t * 1.6 - i * 0.6) + 1) * 0.016 * (i + 1);
    });
    for (const c of crackle) c.o.visible = Math.sin(t * 9 + c.k * 2.7) > -0.55;
    for (const m of motes) {
      const k = (t * 0.22 * m.s + m.p) % 1;
      m.o.position.set(m.x * k * U * 1.3, (m.y * k - 0.5) * U, (-2.2 - k * 2.5) * U);
      m.o.scale.setScalar(Math.max(0.001, Math.sin(k * Math.PI)));
    }
  });
};
BACK_BUILDERS["Rift mantle"] = MANTLE_BUILDER;
