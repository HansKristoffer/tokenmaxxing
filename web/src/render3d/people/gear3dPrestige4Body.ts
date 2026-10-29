/**
 * Prestige track 4's body gear in 3D (`core/src/prestige.ts`): the Worldbuilder regalia and the Lattice wings, in the
 * same cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dPrestige4.ts`, it adds its builders to the
 * shop's tables: the outfit under its look index (`PRESTIGE_BASE + 3`), the back item under its name.
 */
import { PRESTIGE_BASE } from "@tokenmaxxing/core/prestige.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  BACK_BUILDERS,
  type BackBuilder,
  type BodyCtx,
  grid,
  marks,
  OUTFIT_BUILDERS,
  px,
  roll,
  tails,
} from "./gear3dBody.ts";
import { lit, see } from "./gear3dHead.ts";
import { place, U, Vx, vpart } from "./voxgear.ts";

const IVORY = "#f5e6b8";
const IVORY_DARK = "#cdb98a";
const PAPER = "#fffaf0";
const GOLD = "#d4a017";
const GOLD_LIGHT = "#f0c94a";
const GOLD_DARK = "#9c710e";
const GLOW = "#ffe38a";
const BLUE = "#6f98d0";
const BLUE_DARK = "#3f68a8";

// MARK: Outfit

/** A blueprint drawn in cells (three canvas pixels each) on the 19×14 chest. */
const cell = (g: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) =>
  px(g, color, x * 3, y * 3, w * 3, h * 3);

/** A gold drawing-sheet border and the blueprint's four corner dots. */
function sheet(g: CanvasRenderingContext2D): void {
  cell(g, GOLD, 0, 0, 19);
  cell(g, GOLD, 0, 13, 19);
  cell(g, GOLD, 0, 0, 1, 14);
  cell(g, GOLD, 18, 0, 1, 14);
  for (const [x, y] of [
    [2, 2],
    [16, 2],
    [2, 11],
    [16, 11],
  ] as const)
    cell(g, BLUE, x, y);
}

/** The front: the gear's drafted circle with centre lines, and a dimension line with end caps under it. */
function plan(g: CanvasRenderingContext2D): void {
  sheet(g);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    cell(g, BLUE, Math.round(9 + Math.cos(a) * 5), Math.round(5.5 + Math.sin(a) * 3.6));
  }
  for (let x = 3; x <= 15; x += 2) cell(g, BLUE, x, 5);
  for (let y = 2; y <= 9; y += 2) cell(g, BLUE, 9, y);
  cell(g, BLUE, 4, 11, 11);
  cell(g, BLUE_DARK, 4, 10, 1, 3);
  cell(g, BLUE_DARK, 14, 10, 1, 3);
  cell(g, GOLD, 8, 11, 3);
}

/** The back: a floor plan, walls in blue with a doorway or two, a gold compass mark in the corner. */
function floorPlan(g: CanvasRenderingContext2D): void {
  sheet(g);
  cell(g, BLUE, 3, 3, 13);
  cell(g, BLUE, 3, 10, 13);
  cell(g, BLUE, 3, 3, 1, 8);
  cell(g, BLUE, 15, 3, 1, 8);
  cell(g, BLUE, 9, 3, 1, 4);
  cell(g, BLUE, 9, 7, 7);
  cell(g, BLUE, 5, 6, 3);
  cell(g, GOLD, 5, 5);
  cell(g, GOLD, 12, 9);
  cell(g, GOLD_DARK, 12, 5, 2, 1);
}

/** A bar of gold, as a cuff or a pauldron, round each arm. */
const arms = (c: BodyCtx, build: (v: Vx, side: 1 | -1) => void) =>
  c.arms.forEach((arm, i) => {
    build(new Vx(vpart(arm)), i ? 1 : -1);
  });

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Worldbuilder regalia: an ivory coat with a blueprint drawn over it (a drafted circle and dimension line on the
  // chest, a floor plan on the back), a gold gear turning over the heart, gold collar, pauldrons with fringe, cuffs
  // and belt, a long ivory tabard, long coat tails and a rolled plan hanging from the belt.
  [PRESTIGE_BASE + 3]: (c) => {
    marks(c, plan, floorPlan);
    roll(c, GOLD, 0.9, 0.35);
    const v = grid(c);
    // The belt, with a gear for a buckle, and the tabard hanging from it with a blue line down the middle.
    v.b(-3.8, 0.4, -2.3, 7.6, 1.1, 4.6, GOLD_DARK);
    v.b(-3.85, 0.9, -2.35, 7.7, 0.35, 4.7, GOLD);
    v.b(-0.9, 0.3, 2.3, 1.8, 1.3, 0.4, GOLD_LIGHT);
    v.b(-0.35, 0.7, 2.7, 0.7, 0.5, 0.2, GOLD_DARK);
    v.b(-2.4, -3.4, 2.0, 4.8, 3.8, 0.4, IVORY);
    v.b(-0.15, -3.1, 2.4, 0.3, 3.3, 0.12, BLUE);
    for (const x of [-2.55, 2.2]) v.b(x, -3.4, 2.0, 0.35, 3.8, 0.5, GOLD);
    v.b(-2.55, -3.65, 2.0, 5.1, 0.4, 0.5, GOLD);
    for (const x of [-1.8, -0.6, 0.6, 1.8]) v.b(x - 0.15, -3.9, 2.0, 0.3, 0.3, 0.4, GOLD_DARK);
    tails(c, IVORY, 4.2, GOLD);
    // Pauldrons with a gold fringe, and a cuff on each sleeve.
    arms(c, (a) => {
      a.b(-1.9, -1.2, -1.9, 3.8, 1.8, 3.8, GOLD);
      a.b(-1.55, 0.6, -1.55, 3.1, 0.5, 3.1, GOLD_LIGHT);
      a.b(-1.95, -1.2, -1.95, 3.9, 0.4, 3.9, GOLD_DARK);
      for (let i = 0; i < 4; i++) a.b(-1.7 + i * 0.95, -2.3, 1.55, 0.5, 1.1, 0.35, GOLD);
      a.b(-1.4, -6.5, -1.4, 2.8, 1.2, 2.8, GOLD);
      a.b(-1.45, -5.4, -1.45, 2.9, 0.35, 2.9, IVORY_DARK);
    });

    // The rolled plan on the right hip: a paper tube with gold caps and a blue tie, swinging as they walk.
    const rolled = vpart(c.body, [3.9 * U, 1.0 * U, 0.6 * U]);
    const r = new Vx(rolled);
    r.b(-0.6, -3.6, -0.6, 1.2, 3.8, 1.2, PAPER);
    r.b(-0.7, -3.8, -0.7, 1.4, 0.45, 1.4, GOLD);
    r.b(-0.7, -0.45, -0.7, 1.4, 0.45, 1.4, GOLD);
    r.b(-0.68, -2.0, -0.68, 1.36, 0.5, 1.36, BLUE);
    r.b(-0.35, -3.9, -0.35, 0.7, 0.3, 0.7, BLUE_DARK);
    c.tick((t, walking) => {
      rolled.rotation.z = walking ? 0.1 + Math.sin(t * 9) * 0.14 : 0.04 + Math.sin(t * 1.4) * 0.015;
      rolled.rotation.x = walking ? Math.sin(t * 9 + 1) * 0.08 : 0;
    });

    // The gear over the heart: a gold wheel with eight teeth and a glowing hub, turning slowly.
    const gear = vpart(c.body, [0, 4.4 * U, 2.45 * U]);
    const gv = new Vx(gear);
    gv.b(-1.3, -1.3, 0, 2.6, 2.6, 0.5, GOLD);
    for (const [x, y] of [
      [0, 1.7],
      [0, -1.7],
      [1.7, 0],
      [-1.7, 0],
    ] as const)
      gv.b(x - 0.4, y - 0.4, 0, 0.8, 0.8, 0.5, GOLD_LIGHT);
    for (const [x, y] of [
      [1.25, 1.25],
      [-1.25, 1.25],
      [1.25, -1.25],
      [-1.25, -1.25],
    ] as const)
      gv.b(x - 0.35, y - 0.35, 0, 0.7, 0.7, 0.5, GOLD_LIGHT);
    gv.b(-0.75, -0.75, 0.5, 1.5, 1.5, 0.15, GOLD_DARK);
    gv.b(-0.35, -0.35, 0.6, 0.7, 0.7, 0.2, lit(GLOW));
    // And a glint that crosses the coat, drawn like a pen stroke.
    const glint = v.b(-3, 6.8, 2.1, 0.7, 0.7, 0.2, lit("#ffffff"));
    c.tick((t, walking) => {
      gear.rotation.z = -t * (walking ? 1.4 : 0.5);
      const k = (t * 0.3) % 1;
      glint.position.set((-3 + k * 6) * U, (6.8 - k * 4.5) * U, 2.3 * U);
      glint.scale.setScalar(Math.sin(k * Math.PI) ** 2 * 1.3);
    });
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[Number(n)] = build;

// MARK: Back

type Cell = [number, number];

/** The pixels of a line from `a` to `b`. */
function trace(a: Cell, b: Cell, into: Map<string, Cell>): void {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(a[0] + ((b[0] - a[0]) * i) / n);
    const y = Math.round(a[1] + ((b[1] - a[1]) * i) / n);
    into.set(`${x},${y}`, [x, y]);
  }
}

// The wing, in cubes: a root at the shoulder, six spars fanned from just under the horizontal to nearly upright,
// and struts across them at three distances, like an engineer's drawing of a wing.
const SPARS: readonly (readonly [deg: number, len: number])[] = [
  [-42, 5],
  [-18, 7],
  [8, 10],
  [32, 10],
  [56, 9],
  [80, 6],
];
const RINGS = [3, 6, 9];
const at = (deg: number, r: number): Cell => [
  Math.round(r * Math.cos((deg * Math.PI) / 180)),
  Math.round(r * Math.sin((deg * Math.PI) / 180)),
];

/** One wing's geometries. */
interface Wing {
  spars: THREE.BufferGeometry;
  struts: THREE.BufferGeometry;
  accents: THREE.BufferGeometry;
  panel: THREE.BufferGeometry;
}
const wings = new Map<number, Wing>();

/** One wing's geometries, mirrored for `side` -1, built once and shared by every wearer. */
function wing(side: 1 | -1): Wing {
  const have = wings.get(side);
  if (have) return have;
  const spars = new Map<string, Cell>();
  const struts = new Map<string, Cell>();
  const joints = new Map<string, Cell>();
  for (const [deg, len] of SPARS) trace([0, 0], at(deg, len), spars);
  SPARS.forEach(([d0, l0], i) => {
    const next = SPARS[i + 1];
    if (!next) return;
    for (const r of RINGS) {
      if (r > l0 || r > next[1]) continue;
      trace(at(d0, r), at(next[0], r), struts);
      for (const cell of [at(d0, r), at(next[0], r)]) joints.set(String(cell), cell);
    }
  });
  // Ruler ticks standing off the two outer spars, every other cube.
  const ticks = new Map<string, Cell>();
  for (const [deg, len] of [SPARS[0]!, SPARS[5]!]) {
    const out = deg < 0 ? -1 : 1;
    for (let r = 2; r <= len; r += 2) {
      const [x, y] = at(deg, r);
      const cell: Cell = [
        x - Math.round(Math.sin((deg * Math.PI) / 180)) * out,
        y + Math.round(Math.cos((deg * Math.PI) / 180)) * out,
      ];
      ticks.set(String(cell), cell);
    }
  }
  const cubes = (cells: Map<string, Cell>, size: number, depth: number, z = 0) =>
    [...cells.values()].map(([x, y]) =>
      new THREE.BoxGeometry(size * U, size * U, depth * U).translate(x * side * U, y * U, z * U),
    );
  const merge = (parts: THREE.BufferGeometry[]) => {
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
    g.userData.shared = true;
    for (const p of parts) p.dispose();
    return g;
  };
  // The membrane: a flat fan from the root out to each spar's tip, a hair behind the lattice.
  const fan = new THREE.Shape();
  fan.moveTo(0, 0);
  for (const [deg, len] of SPARS) {
    const [x, y] = at(deg, len);
    fan.lineTo(x * side * U, y * U);
  }
  const panel = new THREE.ShapeGeometry(fan).translate(0, 0, -0.2 * U);
  panel.userData.shared = true;
  const made: Wing = {
    spars: merge(cubes(spars, 0.9, 0.6)),
    struts: merge(cubes(struts, 0.65, 0.45, 0.05)),
    accents: merge([...cubes(joints, 1.1, 0.7, 0.1), ...cubes(ticks, 0.55, 0.5)]),
    panel,
  };
  wings.set(side, made);
  return made;
}

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Lattice wings: two wings of gold spars and ivory struts with glowing joints and ruler ticks, a pale membrane
  // behind the lattice, a gold harness over the shoulder blades. They beat slowly when still and quicker as they
  // walk, and a spark runs out along one spar now and then.
  "Lattice wings": (b, tick) => {
    const v = new Vx(b);
    // The harness: a gold plate between the shoulder blades and a hub for each wing.
    v.b(-2.4, -4.4, -0.7, 4.8, 3.4, 0.8, GOLD);
    v.b(-2.0, -4.0, -0.9, 4.0, 2.6, 0.3, IVORY);
    v.b(-0.7, -3.3, -1.2, 1.4, 1.4, 0.3, lit(GLOW));
    const pivots = ([-1, 1] as const).map((side) => {
      const w = vpart(b, [side * 1.8 * U, -2.6 * U, -1.0 * U]);
      w.rotation.y = side * 0.45;
      const g = wing(side);
      place(w, g.spars, GOLD);
      place(w, g.struts, IVORY);
      place(w, g.accents, lit(GLOW));
      const membrane = place(w, g.panel, see(IVORY, 0.28, true));
      (membrane.material as THREE.Material).side = THREE.DoubleSide;
      const spark = new Vx(w).b(-0.4, -0.4, -0.3, 0.8, 0.8, 0.8, lit("#ffffff"));
      return { w, side, spark };
    });
    tick((t, walking) => {
      for (const { w, side, spark } of pivots) {
        const beat = walking ? Math.sin(t * 9) * 0.16 : Math.sin(t * 1.3) * 0.07;
        w.rotation.z = side * (0.1 + beat);
        // The spark runs out along the third spar and fades at the tip.
        const k = (t * 0.4) % 1;
        const [x, y] = at(32, k * 10);
        spark.position.set(x * side * U, y * U, 0);
        spark.scale.setScalar(Math.sin(k * Math.PI) ** 0.7 * 1.2 + 0.001);
      }
    });
  },
};
Object.assign(BACK_BUILDERS, BACKS);
