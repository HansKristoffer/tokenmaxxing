/**
 * The Julemarked case's furniture in 3D (`JULEMARKED_PIECES` in core/src/case-julemarked-furniture.ts), the same
 * pieces as `furniture-julemarked.ts` draws in 2D: a paper-heart garland, a calendar candle, a bowl of pepper
 * nuts, an advent stand, a peeking paper nisse and a Danish Christmas tree. Built like `norse3d.ts`: bottom
 * centre at the origin, front along +z; the garland hangs on a wall, so it is built against y = 0 facing +z.
 * Wool, paper and candlelight: matte reds, cream, forest green and gold. Brief: docs/cases/julemarked.md.
 *
 * Everything is sharp and blocky: boxes and stepped boxes only (hearts, stars, flames and snow are little pixel
 * pictures). The case pieces are the showy ones, so they move: flames dance, candles light one by one, the garland
 * and the tree sway, the nisse blinks, waves and ducks. Glints and glows are shared colour-cycling materials (free
 * once batched); only what really moves stays a live mesh.
 */
import * as THREE from "three";
import { glow, Model, type Paint, seeded, ticks, tint } from "../kit/kit.ts";
import { light } from "./furniture.ts";

export const JUL_RED = "#b8302c";
export const JUL_CREAM = "#f4ecd8";
export const JUL_GREEN = "#2f5d3a";
export const JUL_GOLD = "#f2c14e";
const RED_D = "#8c2220";
const GOLD_L = "#ffe28a";
const GOLD_D = "#b88a1f";
const GREEN_L = "#4a8a52";
const WOOD = "#a06a3c";
const WOOD_D = "#6e4526";
const NUT = "#6b3f22";
const WHITE = "#ffffff";
const DANNE = "#c8102e";
const WOOL = "#8a8f98";
const SKIN = "#efbfa6";
const INK = "#2a2220";
const STRING = "#d8c9a6";

// MARK: Helpers

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
/** Ease-out with a little overshoot, for things that pop up. */
const back = (x: number) => {
  const u = clamp01(x) - 1;
  return 1 + 2.4 * u * u * u + 1.4 * u * u;
};

/** A glow material that is cached by colour: flames and glints share, so the batching can merge them. */
const glows = new Map<string, THREE.MeshBasicMaterial>();
function gl(color: string): THREE.MeshBasicMaterial {
  let g = glows.get(color);
  if (!g) {
    g = glow(color);
    g.userData.shared = true;
    glows.set(color, g);
  }
  return g;
}

/** A see-through glow (a pool of light, a puff of steam). */
function haze(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** A set of glow materials that cycle between two colours, so a string of lights twinkles without moving a mesh. */
function twinkleSet(
  n: number,
  dim: string,
  lit: string,
): { mats: THREE.MeshBasicMaterial[]; run: (t: number, speed: number, step: number) => void } {
  const mats = Array.from({ length: n }, () => glow(dim));
  const a = new THREE.Color(dim);
  const b = new THREE.Color(lit);
  return {
    mats,
    run: (t, speed, step) =>
      mats.forEach((mm, i) => {
        const g = Math.max(0, Math.sin(t * speed - i * step)) ** 3;
        mm.color.copy(a).lerp(b, g);
      }),
  };
}

/**
 * A little picture made of boxes, rows from the top, each letter a colour in `pal` ("." is empty). Runs of one colour
 * are one box and identical rows are stacked into one. Centred on `cx`, its bottom at `y0`, in the plane `z`.
 */
function pix(
  m: Model,
  rows: string[],
  pal: Record<string, Paint>,
  cell: number,
  cx: number,
  y0: number,
  z: number,
  depth: number,
): void {
  const H = rows.length;
  let r = 0;
  while (r < H) {
    let n = 1;
    while (r + n < H && rows[r + n] === rows[r]) n++;
    const row = rows[r]!;
    let c = 0;
    while (c < row.length) {
      const ch = row[c]!;
      let e = c;
      while (e < row.length && row[e] === ch) e++;
      const p = pal[ch];
      if (ch !== "." && p)
        m.box(
          [(e - c) * cell, n * cell, depth],
          p,
          [cx + ((c + e) / 2 - row.length / 2) * cell, y0 + (H - r - n) * cell, z],
          0.001,
        );
      c = e;
    }
    r += n;
  }
}

/**
 * A woven paper heart facing +z, centred on (x, y, z), `s` across: a stepped pixel heart in two tones, with the
 * woven bands crossing over it (`lean` leaves the weave out, for hearts that hang in dozens).
 */
export function paperHeart(
  parent: Model,
  x: number,
  y: number,
  z: number,
  s: number,
  a: string,
  b: string,
  lean = false,
): void {
  const cell = s / 7;
  const d = s * 0.13;
  if (lean) {
    pix(
      parent,
      [".aa.aa.", "aaaaaaa", "bbbbbbb", ".aaaaa.", "..aaa..", "...a..."],
      { a, b },
      cell,
      x,
      y - 3 * cell,
      z,
      d,
    );
    return;
  }
  // A gold outline behind (one step bigger), then the woven checker: the two papers cross over and under each other.
  const k = 1.3;
  pix(
    parent,
    [".aa.aa.", "aaaaaaa", "aaaaaaa", ".aaaaa.", "..aaa..", "...a..."],
    { a: GOLD_D },
    cell * k,
    x,
    y - 3 * cell * k,
    z - d * 0.4,
    d * 0.9,
  );
  pix(
    parent,
    [".ab.ba.", "abababa", "bababab", ".ababa.", "..bab..", "...a..."],
    { a, b },
    cell,
    x,
    y - 3 * cell,
    z,
    d,
  );
}

/** A flame: three stacked blocks (gold, amber, white-hot) that dance. `holder` is free for the caller to scale. */
function flame(m: Model, x: number, y: number, z: number, r: number, phase: number): Model {
  const holder = m.part([x, y, z]);
  const body = holder.part([0, 0, 0]);
  body.box([r * 1.7, r * 2.2, r * 1.7], gl("#f2a93a"), [0, -r * 0.2, 0], 0.001);
  body.box([r * 1.2, r * 2.8, r * 1.2], gl(JUL_GOLD), [0, -r * 0.1, 0], 0.001);
  body.box([r * 0.6, r * 1.5, r * 0.6], gl("#fff6d0"), [0, -r * 0.05, 0], 0.001);
  const tip = body.box([r * 0.5, r * 0.9, r * 0.5], gl("#f7c95a"), [0, r * 2.3, 0], 0.001);
  ticks.push((t) => {
    const w = Math.sin(t * 9 + phase) + 0.6 * Math.sin(t * 15.7 + phase * 2.1);
    body.scale.set(1 - 0.06 * w, 1.0 + 0.16 * w, 1 - 0.06 * w);
    body.rotation.z = 0.12 * Math.sin(t * 6.3 + phase) + 0.05 * w;
    tip.position.x = r * 0.22 * Math.sin(t * 11 + phase);
  });
  return holder;
}

/** A fir sprig: three stepped slabs, a berry. */
function sprig(m: Model, x: number, y: number, z: number, s: number, turn = 0): void {
  const p = m.part([x, y, z], turn);
  p.box([0.1 * s, 0.025 * s, 0.05 * s], JUL_GREEN, [0, 0, 0], 0.001);
  p.box([0.07 * s, 0.025 * s, 0.07 * s], GREEN_L, [0.01 * s, 0.02 * s, 0], 0.001);
  p.box([0.05 * s, 0.02 * s, 0.03 * s], JUL_GREEN, [-0.02 * s, 0.04 * s, 0.01 * s], 0.001);
  p.box([0.022 * s, 0.022 * s, 0.022 * s], JUL_RED, [0.03 * s, 0.025 * s, 0.03 * s], 0.001);
}

/** A little gold star: a plus of two bars and a bright core, glowing. */
function star(m: Model, x: number, y: number, z: number, s: number, mat: Paint): void {
  m.box([s, s * 0.3, s * 0.3], mat, [x, y - s * 0.15, z], 0.001);
  m.box([s * 0.3, s, s * 0.3], mat, [x, y - s * 0.5, z], 0.001);
  for (const k of [-1, 1]) {
    const d = m.box([s * 0.22, s * 0.7, s * 0.22], mat, [x, y - s * 0.35, z], 0.001);
    d.rotation.z = (k * Math.PI) / 4;
  }
}

/** A ribbon bow facing +z, centred at (x, y, z): two loops, a knot and two tails. */
function ribbonBow(m: Model, x: number, y: number, z: number, s: number, col = JUL_RED): void {
  const dark = tint(col, -0.22);
  for (const sx of [-1, 1]) {
    m.box([0.1 * s, 0.07 * s, 0.05 * s], col, [x + sx * 0.07 * s, y, z], 0.002);
    m.box([0.06 * s, 0.1 * s, 0.045 * s], dark, [x + sx * 0.1 * s, y - 0.015 * s, z - 0.004 * s], 0.002);
    const tail = m.box([0.045 * s, 0.14 * s, 0.025 * s], col, [x + sx * 0.04 * s, y - 0.15 * s, z], 0.002);
    tail.rotation.z = sx * 0.3;
  }
  m.box([0.05 * s, 0.06 * s, 0.06 * s], dark, [x, y - 0.01 * s, z + 0.005 * s], 0.002);
}

// MARK: Heart garland

const heartGarland = (): Model => {
  const m = new Model();
  const top = 2.1;
  const sag = 0.3;
  const W = 1.84;
  const at = (u: number): number => top - sag * (1 - (2 * u - 1) ** 2);
  const N = 18;
  // Two nails with a gold rosette and a bow, and the string between them.
  for (const s of [-1, 1]) {
    m.box([0.07, 0.07, 0.025], JUL_GOLD, [s * 0.93, top - 0.035, 0.012], 0.002);
    m.box([0.035, 0.035, 0.03], GOLD_L, [s * 0.93, top - 0.017, 0.02], 0.001);
    ribbonBow(m, s * 0.93, top - 0.07, 0.03, 0.9);
  }
  for (let i = 0; i < N; i++) {
    const x0 = (i / N - 0.5) * W;
    const x1 = ((i + 1) / N - 0.5) * W;
    const y0 = at(i / N);
    const y1 = at((i + 1) / N);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const seg = m.box(
      [len + 0.01, 0.018, 0.018],
      STRING,
      [(x0 + x1) / 2, (y0 + y1) / 2 - 0.009, 0.01],
      0.001,
    );
    seg.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  }
  const fairy = twinkleSet(4, "#a8782a", "#fff2b0");
  const starGlow = twinkleSet(3, "#d9a63a", "#fff6c8");
  // Big hearts hang on swinging strings, alternating red-on-cream and cream-on-red; between them hang gold stars
  // and tiny hearts, and fir sprigs sit on the string.
  const swing: { p: Model; ph: number }[] = [];
  const bigs = [-0.76, -0.46, -0.16, 0.16, 0.46, 0.76];
  bigs.forEach((hx, i) => {
    const y = at(hx / W + 0.5);
    const p = m.part([hx, y - 0.008, 0.02]);
    const drop = 0.1 + (i % 2) * 0.05;
    p.box([0.008, drop, 0.008], STRING, [0, -drop, 0], 0.001);
    if (i % 2) paperHeart(p, 0, -drop - 0.17, 0, 0.36, JUL_CREAM, JUL_RED, true);
    else paperHeart(p, 0, -drop - 0.17, 0, 0.36, JUL_RED, JUL_CREAM, true);
    // A gold bead where each heart hangs.
    p.box([0.03, 0.03, 0.03], JUL_GOLD, [0, -drop - 0.012, 0.002], 0.001);
    swing.push({ p, ph: i * 1.1 });
  });
  const mids = [-0.61, -0.31, 0, 0.31, 0.61];
  mids.forEach((x, i) => {
    const y = at(x / W + 0.5) - 0.008;
    m.box([0.008, 0.09 + (i % 2) * 0.1, 0.008], STRING, [x, y - 0.09 - (i % 2) * 0.1, 0.014], 0.001);
    if (i % 2 === 0) star(m, x, y - 0.1, 0.02, 0.17, starGlow.mats[i % 3]!);
    else paperHeart(m, x, y - 0.2 - 0.07, 0.02, 0.16, JUL_RED, JUL_CREAM, true);
    sprig(m, x, y + 0.004, 0.026, 1.5, i * 0.7);
  });
  // Fairy bulbs hang from the string between everything, taking turns to glow.
  for (let i = 0; i < 9; i++) {
    const x = -0.84 + i * 0.21;
    const y = at(x / W + 0.5) - 0.008;
    m.box([0.006, 0.03, 0.006], STRING, [x, y - 0.03, 0.012], 0.001);
    m.box([0.04, 0.05, 0.04], fairy.mats[i % 4]!, [x, y - 0.075, 0.014], 0.001);
  }
  ticks.push((t) => {
    for (const s of swing) {
      s.p.rotation.z = 0.1 * Math.sin(t * 1.5 + s.ph) + 0.04 * Math.sin(t * 2.9 + s.ph * 2);
    }
    fairy.run(t, 3.2, 0.9);
    starGlow.run(t, 2.4, 1.6);
  });
  light(m, [0, top - 0.3, 0.45], "#ffcf7a", 0.7, 3);
  return m;
};

// MARK: Calendar candle

const calendarCandle = (): Model => {
  const m = new Model();
  // A wooden saucer with a gold rim and a red felt mat, the tall cream candle with a mark for each day.
  m.box([0.56, 0.035, 0.56], WOOD_D, [0, 0, 0], 0.003);
  m.box([0.5, 0.025, 0.5], WOOD, [0, 0.035, 0], 0.003);
  m.box([0.52, 0.012, 0.52], JUL_GOLD, [0, 0.05, 0], 0.001);
  m.box([0.44, 0.014, 0.44], JUL_RED, [0, 0.058, 0], 0.001);
  m.box([0.3, 0.016, 0.3], WOOD, [0, 0.07, 0], 0.001);
  const base = 0.08;
  const H = 0.82;
  const w = 0.17;
  m.box([w, H, w], JUL_CREAM, [0, base, 0], 0.002);
  // 24 day marks: a red band for each, a gold week band, and a pixel star at the front.
  for (let i = 0; i < 24; i++) {
    const y = base + 0.04 + i * 0.03;
    const week = i % 7 === 6;
    m.box([w + 0.008, 0.01, w + 0.008], week ? JUL_GOLD : JUL_RED, [0, y, 0], 0.0005);
    if (i % 3 === 1) m.box([0.016, 0.012, w + 0.014], i % 2 ? GOLD_D : RED_D, [0.03, y + 0.012, 0], 0.0005);
  }
  pix(m, [".x.", "xxx", ".x."], { x: JUL_GOLD }, 0.022, 0, base + 0.5, w / 2 + 0.006, 0.01);
  // The burning end: a cup of melted wax, the wick, and three drips of different lengths.
  const topY = base + H;
  m.box([w - 0.03, 0.018, w - 0.03], "#fff8e8", [0, topY, 0], 0.001);
  m.box([w - 0.07, 0.012, w - 0.07], "#ffe9b0", [0, topY + 0.016, 0], 0.001);
  for (const [dx, dz, len] of [
    [0.085, 0.03, 0.15],
    [-0.04, 0.085, 0.09],
    [0.04, -0.085, 0.2],
    [-0.085, -0.03, 0.06],
  ] as const) {
    m.box([0.026, len, 0.026], "#fff8e8", [dx, topY - len + 0.02, dz], 0.001);
    m.box([0.034, 0.03, 0.034], "#fff8e8", [dx, topY - len - 0.006, dz], 0.001);
  }
  m.box([0.009, 0.05, 0.009], INK, [0, topY + 0.026, 0], 0.001);
  const fl = flame(m, 0, topY + 0.11, 0, 0.046, 0);
  // A bead of wax that slides down one drip and starts again.
  const bead = m.box([0.024, 0.032, 0.024], "#fff8e8", [0.096, topY, -0.085], 0.001);
  // A pool of light on the saucer, and a sprig and berries at the foot.
  const pool = haze("#ffd36a", 0.26);
  for (const [s, y] of [
    [0.4, 0.074],
    [0.26, 0.078],
  ] as const) {
    const p = m.box([s, 0.004, s], pool, [0, y, 0], 0);
    p.castShadow = p.receiveShadow = false;
  }
  for (const a of [0.4, 1.7, 3.0, 4.4]) {
    sprig(m, Math.cos(a) * 0.2, 0.062, Math.sin(a) * 0.2, 2, -a);
  }
  for (const [x, z] of [
    [0.18, 0.13],
    [-0.15, 0.18],
    [-0.2, -0.08],
  ] as const) {
    m.box([0.032, 0.032, 0.032], JUL_RED, [x, 0.062, z], 0.001);
    m.box([0.012, 0.012, 0.012], WHITE, [x - 0.006, 0.09, z + 0.008], 0.0005);
  }
  ticks.push((t) => {
    const g = 0.5 + 0.5 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1);
    pool.opacity = 0.2 + 0.1 * g;
    fl.scale.setScalar(1 + 0.04 * g);
    const u = (t * 0.28) % 1;
    bead.position.y = topY - 0.17 * smooth(u);
    bead.scale.setScalar(u < 0.8 ? 1 : 1 - (u - 0.8) * 4);
  });
  light(m, [0, 1.0, 0.1], "#ffcf7a", 0.8, 3);
  return m;
};

// MARK: Pepper-nut bowl

const pebernodBowl = (): Model => {
  const m = new Model();
  const rnd = seeded(7);
  // A cream doily, then a bowl in steps on a small foot, with a red-and-cream zigzag band round it.
  m.box([0.94, 0.012, 0.94], JUL_CREAM, [0, 0, 0], 0.001);
  m.box([0.84, 0.014, 0.84], JUL_RED, [0, 0.008, 0], 0.001);
  m.box([0.78, 0.016, 0.78], JUL_CREAM, [0, 0.014, 0], 0.001);
  m.box([0.26, 0.05, 0.26], WOOD_D, [0, 0.028, 0], 0.002);
  m.box([0.38, 0.04, 0.38], JUL_CREAM, [0, 0.078, 0], 0.002);
  m.box([0.48, 0.04, 0.48], JUL_CREAM, [0, 0.118, 0], 0.002);
  m.box([0.56, 0.06, 0.56], JUL_RED, [0, 0.158, 0], 0.002);
  m.box([0.62, 0.05, 0.62], JUL_CREAM, [0, 0.218, 0], 0.002);
  m.box([0.64, 0.016, 0.64], JUL_GOLD, [0, 0.268, 0], 0.001);
  // Zigzag: little cream and gold diamonds along the red band on all four faces.
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.09;
    const c = i % 2 ? JUL_CREAM : GOLD_L;
    m.box([0.05, 0.03, 0.012], c, [x, 0.17, 0.286], 0.001);
    m.box([0.012, 0.03, 0.05], c, [0.286, 0.17, x], 0.001);
    m.box([0.012, 0.03, 0.05], c, [-0.286, 0.17, x], 0.001);
    m.box([0.05, 0.03, 0.012], c, [x, 0.17, -0.286], 0.001);
  }
  m.box([0.54, 0.04, 0.54], "#2a1a10", [0, 0.26, 0], 0.002);
  // The heap: stepped layers of nut cubes, each a little turned and tinted.
  const browns = [NUT, tint(NUT, 0.14), tint(NUT, -0.12), "#7d4a28"];
  const layers: [number, number, number][] = [
    [5, 0.09, 0.28],
    [4, 0.085, 0.335],
    [3, 0.08, 0.39],
    [2, 0.07, 0.44],
    [1, 0.06, 0.49],
  ];
  for (const [n, pitch, y] of layers)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const nut = m.box(
          [0.065, 0.055, 0.065],
          rnd() < 0.12 ? "#d9b48a" : browns[Math.floor(rnd() * browns.length)]!,
          [
            (i - (n - 1) / 2) * pitch + (rnd() - 0.5) * 0.015,
            y + rnd() * 0.012,
            (j - (n - 1) / 2) * pitch + (rnd() - 0.5) * 0.015,
          ],
          0.004,
        );
        nut.rotation.y = rnd() * 1.5;
      }
  // A frosted-white heart cookie leaning at the top, with a toothpick.
  m.box([0.01, 0.12, 0.01], WOOD, [0, 0.5, 0], 0.001);
  paperHeart(m, 0, 0.67, 0.01, 0.2, JUL_RED, JUL_CREAM);
  // Spilled nuts, cinnamon sticks, star anise and cloves around the bowl.
  for (const [x, z, a] of [
    [0.4, 0.2, 0.3],
    [0.43, 0.1, 1.1],
    [-0.4, 0.27, 0.7],
    [0.34, -0.3, 0.2],
    [-0.38, -0.2, 1.4],
  ] as const)
    m.box([0.056, 0.05, 0.056], NUT, [x, 0.02, z], 0.004).rotation.y = a;
  for (const [x, z, a] of [
    [-0.35, 0.36, 0.5],
    [-0.28, 0.4, 0.62],
  ] as const) {
    const c = m.box([0.2, 0.034, 0.034], "#a5552a", [x, 0.03, z], 0.004);
    c.rotation.y = a;
  }
  for (const [x, z] of [
    [0.3, 0.38],
    [0.36, -0.12],
  ] as const) {
    m.box([0.07, 0.025, 0.026], "#5a2f18", [x, 0.03, z], 0.002);
    m.box([0.026, 0.025, 0.07], "#5a2f18", [x, 0.03, z], 0.002);
    m.box([0.03, 0.03, 0.03], "#3a1d0e", [x, 0.045, z], 0.002);
  }
  // Glints on the sugar and a wisp of spice steam rising from the nuts.
  const glint = twinkleSet(4, "#a8825a", "#ffffff");
  for (const [x, y, z] of [
    [-0.12, 0.46, 0.1],
    [0.14, 0.41, 0.14],
    [0.08, 0.45, -0.12],
    [-0.16, 0.35, -0.1],
  ] as const)
    m.box([0.022, 0.022, 0.022], glint.mats[((x * 10) | 0) & 3]!, [x, y, z], 0.001);
  const puffs = [0, 1, 2, 3, 4].map((i) => {
    const b = m.box([0.05, 0.05, 0.05], gl(i % 2 ? "#fff4dc" : "#ffe0a8"), [0, 0.55, 0], 0.001);
    b.castShadow = b.receiveShadow = false;
    return { b, i };
  });
  ticks.push((t) => {
    glint.run(t, 2.6, 1.3);
    for (const { b, i } of puffs) {
      const u = (t * 0.26 + i * 0.2) % 1;
      b.position.set(Math.sin(u * 7 + i * 1.7) * 0.06 + 0.02, 0.52 + u * 0.38, Math.cos(u * 6 + i) * 0.04);
      b.scale.setScalar(Math.max(0.01, Math.sin(u * Math.PI) ** 0.6) * (0.7 + u * 0.8));
      b.rotation.y = u * 4 + i;
    }
  });
  return m;
};

// MARK: Advent stand

const adventStand = (): Model => {
  const m = new Model();
  // A wooden tray with a gold rim, and a wreath of chunky fir blocks round a ring of twelve.
  m.box([0.9, 0.04, 0.9], WOOD_D, [0, 0, 0], 0.003);
  m.box([0.84, 0.03, 0.84], WOOD, [0, 0.04, 0], 0.003);
  m.box([0.88, 0.012, 0.88], JUL_GOLD, [0, 0.036, 0], 0.001);
  m.box([0.8, 0.012, 0.8], JUL_CREAM, [0, 0.07, 0], 0.001);
  const rnd = seeded(11);
  const R = 0.31;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    const high = i % 2;
    const piece = m.box(
      [0.17, 0.08 + (i % 3) * 0.02, 0.17],
      i % 3 ? JUL_GREEN : GREEN_L,
      [x, 0.08 + high * 0.04, z],
      0.004,
    );
    piece.rotation.y = -a + rnd() * 0.4;
  }
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    const s = m.box(
      [0.13, 0.07, 0.13],
      tint(JUL_GREEN, i % 2 ? 0.14 : -0.08),
      [Math.cos(a) * (R - 0.04), 0.17, Math.sin(a) * (R - 0.04)],
      0.003,
    );
    s.rotation.y = -a;
  }
  // Red berries, gold baubles and pinecones among the fir.
  const sparkle = twinkleSet(3, "#d9a63a", "#fff3b8");
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * (R + 0.06);
    const z = Math.sin(a) * (R + 0.06);
    if (i % 3 === 0) m.box([0.05, 0.05, 0.05], sparkle.mats[i % 3]!, [x, 0.2, z], 0.002);
    else if (i % 3 === 1) {
      m.box([0.04, 0.04, 0.04], JUL_RED, [x, 0.2, z], 0.002);
      m.box([0.04, 0.04, 0.04], JUL_RED, [x * 1.07 + 0.03, 0.18, z * 1.07], 0.002);
    } else {
      m.box([0.05, 0.08, 0.05], "#7a4a28", [x, 0.17, z], 0.002);
      m.box([0.06, 0.02, 0.06], "#9a6a42", [x, 0.2, z], 0.002);
    }
  }
  // Four candles in gold cups, different heights, lighting one by one; red with a cream spiral.
  const heights = [0.46, 0.4, 0.34, 0.27];
  const slots: [number, number][] = [
    [-0.22, -0.22],
    [0.22, -0.22],
    [0.22, 0.22],
    [-0.22, 0.22],
  ];
  const flames: Model[] = [];
  const pools: THREE.MeshBasicMaterial[] = [];
  slots.forEach(([x, z], i) => {
    m.box([0.13, 0.06, 0.13], JUL_GOLD, [x, 0.17, z], 0.003);
    m.box([0.15, 0.015, 0.15], GOLD_L, [x, 0.225, z], 0.002);
    const h = heights[i]!;
    m.box([0.075, h, 0.075], JUL_RED, [x, 0.23, z], 0.002);
    for (let k = 0; k < 4; k++)
      m.box([0.08, 0.016, 0.08], JUL_CREAM, [x, 0.27 + k * 0.1 + (i % 2) * 0.02, z], 0.0005);
    m.box([0.008, 0.03, 0.008], INK, [x, 0.23 + h, z], 0.001);
    flames.push(flame(m, x, 0.23 + h + 0.065, z, 0.034, i * 1.7));
    // A square of candlelight on the tray under each one.
    const pm = haze("#ffd36a", 0);
    pools.push(pm);
    const p = m.box([0.34, 0.004, 0.34], pm, [x * 0.8, 0.072, z * 0.8], 0);
    p.castShadow = p.receiveShadow = false;
  });
  const wreathGlow = haze("#ffcf7a", 0);
  const wg = m.box([0.9, 0.004, 0.9], wreathGlow, [0, 0.073, 0], 0);
  wg.castShadow = wg.receiveShadow = false;
  // The red ribbon: a bow at the front with long tails down the tray, and a ribbon round the ring.
  ribbonBow(m, 0, 0.17, 0.44, 1.5);
  m.box([0.07, 0.012, 0.3], JUL_RED, [0, 0.07, 0.62 - 0.12], 0.001).rotation.y = 0.12;
  const cycle = 16;
  ticks.push((t) => {
    sparkle.run(t, 2.6, 1.5);
    const c = t % cycle;
    // One more candle every three seconds; all four glow for a while, then out they go together and it begins again.
    let lit = 0;
    flames.forEach((f, i) => {
      const on = c > 1 + i * 3 ? smooth((c - (1 + i * 3)) / 0.8) : 0;
      const off = c > 13.6 ? 1 - smooth((c - 13.6) / 0.6) : 1;
      const s = on * off;
      f.visible = s > 0.02;
      f.scale.setScalar(Math.max(0.01, s) * (0.9 + 0.25 * back(on)));
      pools[i]!.opacity = 0.2 * s * (0.8 + 0.2 * Math.sin(t * 7 + i));
      lit += s;
    });
    wreathGlow.opacity = 0.05 * lit;
  });
  light(m, [0, 0.9, 0.1], "#ffcf7a", 1, 3.5);
  return m;
};

// MARK: Kravlenisse

const kravlenisse = (): Model => {
  const m = new Model();
  // A little wooden stage: a plank floor, a low back wall, and a front board the nisse peeks over, studded with gold,
  // carrying a plaque that says HEJ and a string of paper hearts.
  const BOARD = 0.46;
  m.box([0.96, 0.06, 0.9], WOOD_D, [0, 0, 0], 0.005);
  m.box([0.96, 0.22, 0.06], WOOD, [0, 0.06, -0.37], 0.004);
  for (const s of [-1, 1]) m.box([0.06, 0.2, 0.7], WOOD, [s * 0.45, 0.06, 0], 0.004);
  m.box([0.96, BOARD - 0.06, 0.1], WOOD, [0, 0.06, 0.33], 0.004);
  m.box([1.0, 0.04, 0.14], WOOD_D, [0, BOARD, 0.33], 0.004);
  m.box([0.9, 0.018, 0.02], JUL_GOLD, [0, BOARD - 0.03, 0.385], 0.001);
  for (const x of [-0.42, -0.14, 0.14, 0.42]) m.box([0.03, 0.03, 0.02], GOLD_L, [x, 0.1, 0.385], 0.001);
  m.box([0.34, 0.2, 0.014], JUL_RED, [0, 0.14, 0.384], 0.001);
  pix(
    m,
    ["X.X.XXX...X", "X.X.X.....X", "XXX.XX....X", "X.X.X...X.X", "X.X.XXX.XXX"],
    { X: JUL_CREAM },
    0.026,
    0,
    0.17,
    0.395,
    0.012,
  );
  paperHeart(m, -0.37, 0.24, 0.39, 0.12, JUL_RED, JUL_CREAM, true);
  paperHeart(m, 0.37, 0.24, 0.39, 0.12, JUL_CREAM, JUL_RED, true);
  // A paper-heart pennant string over the back wall, a candle stub and a sleeping mitten.
  for (let i = 0; i < 5; i++)
    m.box(
      [0.07, 0.06, 0.012],
      i % 2 ? JUL_RED : JUL_CREAM,
      [-0.32 + i * 0.16, 0.3 - 0.03 * Math.sin((i / 4) * Math.PI), -0.34],
      0.001,
    );
  m.box([0.04, 0.07, 0.04], JUL_CREAM, [0.36, 0.06, -0.2], 0.001);
  const stubFlame = flame(m, 0.36, 0.17, -0.2, 0.014, 2);
  stubFlame.scale.setScalar(1);
  // Crumbs of gingerbread on the floor.
  for (const [x, z] of [
    [-0.3, 0.1],
    [0.25, 0.2],
    [-0.1, -0.2],
  ] as const)
    m.box([0.04, 0.03, 0.04], "#a5552a", [x, 0.06, z], 0.003);

  // The nisse himself, on a pivot at the floor: grey jacket, red scarf, a big round-cheeked face under a cream beard,
  // a long red hat with a floppy tip and a pompom.
  const n = m.part([0, 0.06, 0.08]);
  n.box([0.28, 0.3, 0.22], WOOL, [0, 0, 0], 0.01);
  n.box([0.3, 0.06, 0.24], JUL_RED, [0, 0.26, 0], 0.005);
  n.box([0.06, 0.12, 0.05], JUL_RED, [0.08, 0.15, 0.115], 0.003);
  n.box([0.32, 0.27, 0.27], SKIN, [0, 0.31, 0.03], 0.012);
  for (const s of [-1, 1]) n.box([0.04, 0.07, 0.05], tint(SKIN, -0.05), [s * 0.18, 0.4, 0.03], 0.004);
  // The beard: stepped, falling down over the front, with a moustache and a round pink nose.
  n.box([0.32, 0.1, 0.06], JUL_CREAM, [0, 0.31, 0.15], 0.008);
  n.box([0.26, 0.09, 0.06], JUL_CREAM, [0, 0.22, 0.15], 0.008);
  n.box([0.16, 0.08, 0.06], WHITE, [0, 0.14, 0.15], 0.008);
  n.box([0.2, 0.05, 0.05], WHITE, [0, 0.4, 0.17], 0.004);
  n.box([0.08, 0.07, 0.06], "#ec8b78", [0, 0.44, 0.185], 0.008);
  for (const s of [-1, 1]) n.box([0.07, 0.04, 0.01], "#f08a8a", [s * 0.11, 0.42, 0.165], 0.002);
  // Eyes (they blink and look about) with a tiny glint, and fluffy brows.
  const eyes = n.part([0, 0.5, 0.168]);
  const eyeL = eyes.box([0.05, 0.06, 0.02], INK, [-0.075, 0, 0], 0.003);
  const eyeR = eyes.box([0.05, 0.06, 0.02], INK, [0.075, 0, 0], 0.003);
  const gl1 = eyes.box([0.016, 0.016, 0.01], WHITE, [-0.068, 0.034, 0.012], 0.001);
  const gl2 = eyes.box([0.016, 0.016, 0.01], WHITE, [0.082, 0.034, 0.012], 0.001);
  const brows = n.part([0, 0.57, 0.17]);
  for (const s of [-1, 1]) brows.box([0.09, 0.025, 0.03], WHITE, [s * 0.075, 0, 0], 0.003);
  // A happy open mouth, seen when he waves.
  const mouth = n.box([0.06, 0.03, 0.02], "#7a1e24", [0, 0.375, 0.185], 0.002);
  mouth.visible = false;
  // The hat: a cream band, a red cone in steps that leans, a floppy tip and a pompom.
  n.box([0.35, 0.05, 0.3], JUL_CREAM, [0, 0.59, 0.03], 0.006);
  const hat = n.part([0, 0.64, 0.03]);
  hat.box([0.3, 0.1, 0.26], JUL_RED, [0, 0, 0], 0.006);
  hat.box([0.24, 0.1, 0.2], JUL_RED, [0, 0.1, -0.005], 0.006);
  hat.box([0.17, 0.1, 0.15], RED_D, [0, 0.2, -0.015], 0.006);
  const tip = hat.part([0, 0.3, -0.02]);
  tip.box([0.1, 0.1, 0.1], JUL_RED, [0, 0, 0], 0.005);
  const tip2 = tip.part([0, 0.1, 0]);
  tip2.box([0.07, 0.09, 0.07], RED_D, [0, 0, 0], 0.004);
  const pom = tip2.box([0.1, 0.1, 0.1], JUL_CREAM, [0, 0.07, 0], 0.01);
  // Arms: the left grips the board, the right waves; red mittens.
  const lArm = n.part([-0.17, 0.25, 0.04]);
  lArm.box([0.07, 0.07, 0.2], WOOL, [0, -0.02, 0], 0.004);
  lArm.box([0.1, 0.09, 0.09], JUL_RED, [0, -0.025, 0.2], 0.006);
  const rArm = n.part([0.17, 0.25, 0.04]);
  const rSwing = rArm.part([0, 0, 0]);
  rSwing.box([0.07, 0.2, 0.07], WOOL, [0, 0, 0], 0.004);
  rSwing.box([0.1, 0.1, 0.1], JUL_RED, [0, 0.2, 0], 0.006);
  rSwing.box([0.03, 0.05, 0.03], JUL_RED, [0.055, 0.22, 0], 0.003);
  // A heart that pops up when he is pleased.
  const pop = new Model();
  paperHeart(pop, 0, 0, 0, 0.16, JUL_RED, JUL_CREAM, true);
  pop.visible = false;
  m.add(pop);
  // Sparkles for the wave.
  const sp = twinkleSet(3, "#d9a63a", "#fff6c8");
  const dots = [0, 1, 2].map((i) => {
    const b = m.box([0.03, 0.03, 0.03], sp.mats[i]!, [0, 0, 0], 0.001);
    b.visible = false;
    return b;
  });

  const T = 11;
  ticks.push((t) => {
    sp.run(t, 5, 1.1);
    const c = t % T;
    // Phases: rise (0-1.1), idle with a look about (to 3.2), wave (to 6.4), surprise and duck (to 7.2),
    // hidden with the pompom wiggling (to 9.6), peek with just the hat (to 10.2), then up again.
    let up = 1;
    if (c < 1.1) up = back(c / 1.1);
    else if (c > 6.5 && c < 7.2) up = 1 - smooth((c - 6.5) / 0.7);
    else if (c >= 7.2 && c < 9.8) up = 0;
    else if (c >= 9.8) up = smooth((c - 9.8) / 0.5) * 0.18;
    const peek = c >= 9.8 && c < 10.4 ? 1 : 0;
    n.position.y = 0.06 + 0.14 * up - 0.46 * (1 - Math.min(1, up));
    n.position.y += 0.012 * Math.sin(t * 2.2) * clamp01(up);
    // Eyes: blink at two moments, look left and right while idle, go wide before the duck.
    const blinkAt = (b: number) => Math.max(0, 1 - Math.abs(c - b) / 0.09);
    const blink = Math.max(blinkAt(2.0), blinkAt(4.6), blinkAt(8.8), c < 1.4 ? blinkAt(1.3) : 0);
    const wide = c > 6.1 && c < 7 ? 1.35 : 1;
    const happy = c > 3.2 && c < 6.2;
    const eyeScaleY = happy ? 0.5 + 0.0 * blink : Math.max(0.08, 1 - blink * 0.95) * wide;
    for (const e of [eyeL, eyeR]) e.scale.set(wide, eyeScaleY, 1);
    const look = c < 3.2 ? Math.sin((c - 1.1) * 2.4) * 0.018 : c < 6.5 ? 0.012 : 0;
    eyes.position.x = look;
    for (const g of [gl1, gl2]) g.visible = !happy && blink < 0.5;
    brows.position.y = 0.57 + (wide > 1 ? 0.012 : 0) + (happy ? 0.008 : 0);
    // The wave: the right arm swings up and rocks side to side, the whole nisse nods, the tip of the hat bounces.
    const w = smooth((c - 3.2) / 0.5) * (1 - smooth((c - 6.0) / 0.4));
    rSwing.rotation.x = (1 - w) * 1.45;
    rSwing.rotation.z = -0.2 * w + 0.5 * w * Math.sin((c - 3.2) * 9);
    n.rotation.z = 0.05 * w * Math.sin((c - 3.2) * 4.5);
    n.rotation.y = 0.12 * w * Math.sin((c - 3.2) * 2.2) + 0.05 * Math.sin(t * 0.8);
    mouth.visible = w > 0.4;
    // Hat tip and pompom always swing a little, more with every nod.
    tip.rotation.z = -0.5 + 0.18 * Math.sin(t * 2.6) + 0.25 * w * Math.sin((c - 3.2) * 4.5 + 1);
    tip2.rotation.z = -0.5 + 0.2 * Math.sin(t * 3.4 + 1);
    pom.scale.setScalar(1 + 0.08 * Math.sin(t * 6.1));
    hat.rotation.x = peek * 0.0 + 0.04 * Math.sin(t * 1.7);
    // The heart pops up over his head at the height of the wave, and the sparkles fly.
    const hp = (c - 3.9) / 1.6;
    pop.visible = hp > 0 && hp < 1;
    if (pop.visible) {
      pop.position.set(0.3 + 0.05 * Math.sin(hp * 6), 0.95 + hp * 0.35, 0.3);
      pop.scale.setScalar(Math.sin(hp * Math.PI) * 1.1 + 0.01);
      pop.rotation.z = Math.sin(hp * 7) * 0.3;
    }
    dots.forEach((d, i) => {
      const k = (c - 3.6 - i * 0.2) / 1.3;
      d.visible = k > 0 && k < 1 && w > 0.2;
      if (d.visible) {
        d.position.set(
          0.32 + Math.cos(i * 2.1 + k * 4) * 0.16 * k,
          0.78 + 0.1 * i + k * 0.3,
          0.26 + Math.sin(i * 2.1) * 0.05,
        );
        d.scale.setScalar(Math.sin(k * Math.PI) * 1.5 + 0.01);
        d.rotation.y = k * 8;
      }
    });
  });
  light(m, [0, 0.6, 0.35], "#ffcf7a", 0.7, 2.6);
  return m;
};

// MARK: Christmas tree

const juleTree = (): Model => {
  const m = new Model();
  const rnd = seeded(23);
  // A wooden tub with a red band and a ring of snow, and a red-bordered woven mat under it all.
  m.box([2.9, 0.016, 0.92], JUL_CREAM, [0, 0, 0], 0.001);
  m.box([2.8, 0.02, 0.82], JUL_RED, [0, 0.014, 0], 0.001);
  m.box([2.68, 0.02, 0.7], JUL_CREAM, [0, 0.026, 0], 0.001);
  for (let i = 0; i < 14; i++)
    m.box([0.12, 0.014, 0.12], i % 2 ? JUL_RED : JUL_GREEN, [(i - 6.5) * 0.19, 0.044, 0.31], 0.001);
  m.box([0.62, 0.3, 0.62], WOOD_D, [0, 0.04, 0], 0.01);
  m.box([0.64, 0.06, 0.64], JUL_RED, [0, 0.13, 0], 0.004);
  m.box([0.68, 0.03, 0.68], JUL_GOLD, [0, 0.19, 0], 0.003);
  m.box([0.5, 0.04, 0.5], WHITE, [0, 0.34, 0], 0.004);
  m.box([0.14, 0.2, 0.14], "#4a2f1b", [0, 0.36, 0], 0.005);
  // Six tiers, each three stepped slabs, wide and shallow like a footprint three tiles across and one deep.
  const tiers: [number, number, number][] = [
    [1.6, 1.0, 0.44],
    [1.36, 0.88, 0.76],
    [1.12, 0.76, 1.06],
    [0.9, 0.64, 1.34],
    [0.68, 0.52, 1.6],
    [0.44, 0.38, 1.84],
  ];
  const tip = m.part([0, 1.3, 0]);
  const tierGroup = (i: number): Model => (i >= 3 ? tip : m);
  const yOff = (i: number) => (i >= 3 ? -1.3 : 0);
  tiers.forEach(([wx, wz, y], i) => {
    const g = tierGroup(i);
    const y0 = y + yOff(i);
    const dark = i % 2 ? tint(JUL_GREEN, 0.08) : JUL_GREEN;
    g.box([wx, 0.1, wz], tint(dark, -0.08), [0, y0, 0], 0.006);
    g.box([wx * 0.84, 0.1, wz * 0.84], dark, [0, y0 + 0.1, 0], 0.006);
    g.box([wx * 0.64, 0.12, wz * 0.64], tint(dark, 0.1), [0, y0 + 0.2, 0], 0.006);
    // Snow-dust tufts on the edges and the tier's drooping fir tips.
    for (let k = 0; k < 4; k++) {
      const sx = (rnd() * 2 - 1) * wx * 0.4;
      g.box([0.1, 0.03, 0.08], WHITE, [sx, y0 + 0.1, wz * 0.42 * (rnd() < 0.5 ? 1 : -1)], 0.004);
    }
    for (let k = 0; k < 5; k++) {
      const sx = (k - 2) * (wx / 5.2);
      g.box(
        [wx / 6, 0.07, 0.07],
        tint(JUL_GREEN, k % 2 ? 0.1 : -0.1),
        [sx, y0 - 0.04, wz / 2 + 0.005],
        0.004,
      );
    }
  });
  // The star: a glowing gold plus-and-diagonals star, turning rays behind it.
  const starGlow = twinkleSet(2, JUL_GOLD, "#fff6c8");
  const topStar = tip.part([0, 2.2 - 1.3, 0]);
  topStar.box([0.14, 0.14, 0.09], starGlow.mats[0]!, [0, -0.07, 0], 0.002);
  topStar.box([0.4, 0.09, 0.07], starGlow.mats[1]!, [0, -0.045, 0], 0.002);
  topStar.box([0.09, 0.4, 0.07], starGlow.mats[1]!, [0, -0.2, 0], 0.002);
  for (const k of [-1, 1]) {
    const d = topStar.box([0.08, 0.34, 0.06], starGlow.mats[0]!, [0, 0, 0], 0.002);
    d.position.y = 0;
    d.rotation.z = (k * Math.PI) / 4;
    d.position.set(k * 0, 0, 0);
    // The bar is built from its bottom: turn it about its middle.
    d.geometry = d.geometry.clone();
    d.geometry.translate(0, -0.17, 0);
  }
  const rays = tip.part([0, 2.2 - 1.3 - 0.045, -0.05]);
  for (const k of [0, 1, 2, 3]) {
    const r = rays.box([0.05, 0.3, 0.015], gl(GOLD_L), [0, 0, 0], 0);
    r.geometry = r.geometry.clone();
    r.geometry.translate(0, 0.1, 0);
    r.rotation.z = (k * Math.PI) / 2 + Math.PI / 4;
    r.castShadow = false;
  }
  // Woven paper hearts hang from the tiers; flags on swags of string; paper cones in cream and red.
  const hang: [number, number, number][] = [
    [-0.5, 0.52, 0],
    [0.5, 0.52, 1],
    [0.0, 0.62, 1],
    [-0.38, 0.86, 1],
    [0.38, 0.86, 0],
    [-0.2, 1.17, 0],
    [0.22, 1.18, 1],
    [0.0, 1.44, 1],
    [-0.14, 1.66, 0],
  ];
  for (const [x, y, k] of hang) {
    const ti = y > 1.3 ? tip : m;
    const ty = y > 1.3 ? y - 1.3 : y;
    const wz = y < 0.7 ? 1.0 : y < 1 ? 0.88 : y < 1.3 ? 0.76 : y < 1.55 ? 0.62 : 0.5;
    const out = wz / 2 + 0.03;
    ti.box([0.006, 0.1, 0.006], STRING, [x, ty + 0.0, out], 0.001);
    if (k) paperHeart(ti, x, ty - 0.02, out + 0.012, 0.22, JUL_CREAM, JUL_RED);
    else paperHeart(ti, x, ty - 0.02, out + 0.012, 0.22, JUL_RED, JUL_CREAM);
  }
  const swag = (x0: number, y0: number, x1: number, y1: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u - 0.06 * Math.sin(u * Math.PI);
      m.box([0.07, 0.055, 0.012], DANNE, [x, y - 0.065, z], 0.001);
      m.box([0.07, 0.012, 0.014], WHITE, [x, y - 0.046, z], 0.001);
      m.box([0.012, 0.055, 0.014], WHITE, [x - 0.012, y - 0.065, z], 0.001);
    }
    const len = Math.hypot(x1 - x0, y1 - y0);
    const s = m.box([len, 0.01, 0.01], STRING, [(x0 + x1) / 2, (y0 + y1) / 2 - 0.01, z - 0.004], 0.001);
    s.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  };
  swag(-0.64, 0.74, 0.62, 0.78, 0.5, 9);
  swag(-0.5, 1.04, 0.5, 1.06, 0.43, 7);
  swag(-0.36, 1.32, 0.34, 1.34, 0.36, 5);
  // Gold glints dotted about, twinkling in turn.
  const glint = twinkleSet(4, "#d9a63a", "#fff6c8");
  for (let i = 0; i < 14; i++) {
    const t = tiers[i % 6]!;
    const gx = (rnd() * 2 - 1) * t[0] * 0.42;
    const gz = (rnd() * 0.5 + 0.3) * t[1] * 0.5;
    const gy = t[2] + 0.12 + rnd() * 0.1;
    const g = i >= 8 ? tip : m;
    g.box([0.04, 0.04, 0.04], glint.mats[i % 4]!, [gx, i >= 8 ? gy - 1.3 : gy, gz], 0.001);
    if (i % 2)
      g.box([0.04, 0.04, 0.04], JUL_RED, [gx + 0.07, i >= 8 ? gy - 1.32 : gy - 0.02, gz + 0.03], 0.001);
  }
  // Real candles clipped to the front tips of the tiers, twinkling in sequence round the tree.
  const spots: [number, number, number, number][] = [
    [-0.7, 0.66, 0.4, 0],
    [0.7, 0.66, 0.4, 3],
    [-0.5, 0.97, 0.33, 1],
    [0.5, 0.97, 0.33, 4],
    [-0.38, 1.28, 0.28, 2],
    [0.38, 1.28, 0.28, 5],
    [-0.26, 1.54, 0.22, 6],
    [0.26, 1.54, 0.22, 7],
  ];
  const cflames: { f: Model; k: number }[] = [];
  for (const [x, y, z, k] of spots) {
    const g = y > 1.3 ? tip : m;
    const yy = y > 1.3 ? y - 1.3 : y;
    g.box([0.07, 0.012, 0.05], JUL_GOLD, [x, yy - 0.01, z], 0.001);
    g.box([0.03, 0.03, 0.03], GOLD_D, [x, yy + 0.002, z], 0.001);
    g.box([0.05, 0.14, 0.05], JUL_CREAM, [x, yy, z], 0.001);
    g.box([0.008, 0.025, 0.008], INK, [x, yy + 0.14, z], 0.001);
    cflames.push({ f: flame(g, x, yy + 0.2, z, 0.03, k * 1.1), k });
  }
  // Presents under the tree and to the sides, wrapped in red, cream, green and gold paper with ribbon and bows.
  const gift = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    paper: string,
    rib: string,
    turn = 0,
  ) => {
    const g = m.part([x, 0.03, z], turn);
    g.box([w, h, d], paper, [0, 0, 0], 0.006);
    g.box([w * 1.02, h * 1.02, 0.05], rib, [0, 0, 0], 0.001);
    g.box([0.05, h * 1.02, d * 1.02], rib, [0, 0, 0], 0.001);
    g.box([0.08, 0.05, 0.05], tint(rib, -0.12), [-0.04, h + 0.01, 0], 0.001).rotation.z = 0.5;
    g.box([0.08, 0.05, 0.05], tint(rib, -0.12), [0.04, h + 0.01, 0], 0.001).rotation.z = -0.5;
    g.box([0.04, 0.04, 0.04], rib, [0, h + 0.01, 0], 0.001);
  };
  gift(-0.98, 0.12, 0.34, 0.26, 0.3, JUL_RED, JUL_CREAM, 0.3);
  gift(-0.62, 0.32, 0.22, 0.2, 0.22, JUL_GREEN, JUL_GOLD, -0.2);
  gift(0.62, 0.3, 0.28, 0.22, 0.26, JUL_CREAM, JUL_RED, 0.2);
  gift(1.0, 0.04, 0.36, 0.32, 0.32, JUL_GREEN, JUL_CREAM, -0.3);
  gift(-1.3, -0.12, 0.28, 0.24, 0.26, JUL_CREAM, JUL_GREEN, 0.1);
  gift(1.3, 0.26, 0.24, 0.18, 0.24, JUL_RED, GOLD_L, 0.4);
  gift(-0.12, 0.4, 0.18, 0.14, 0.18, JUL_GOLD, JUL_RED, 0.2);
  gift(0.3, 0.38, 0.16, 0.2, 0.16, JUL_RED, WHITE, -0.4);
  // A stack: a small gift on a big one.
  const stackTop = m.part([-0.98, 0.29, 0.12], 0.3);
  stackTop.box([0.2, 0.16, 0.2], JUL_GOLD, [0, 0, 0], 0.005);
  stackTop.box([0.21, 0.17, 0.04], JUL_RED, [0, 0, 0], 0.001);
  // Sway: the top of the tree rocks gently, the star pulses, the candles take turns to flare.
  ticks.push((t) => {
    tip.rotation.z = 0.018 * Math.sin(t * 1.3) + 0.006 * Math.sin(t * 3.1);
    tip.rotation.x = 0.006 * Math.sin(t * 1.1 + 1);
    rays.rotation.z = t * 0.4;
    starGlow.run(t, 2.2, 1.2);
    glint.run(t, 3.1, 1.1);
    for (const { f, k } of cflames) {
      const u = ((t * 0.9 - k * 0.55) % 4.4) / 4.4;
      f.scale.setScalar(0.8 + 0.5 * Math.max(0, Math.sin(u * Math.PI * 2)) ** 2);
    }
  });
  light(m, [0, 1.3, 0.8], "#ffcf7a", 1.3, 5);
  return m;
};

export const JUL_ASSETS: readonly { id: string; name: string; w: number; d: number; build: () => Model }[] = [
  { id: "jul-heart-garland", name: "Julehjerte-guirlande", w: 2, d: 1, build: heartGarland },
  { id: "jul-kalenderlys", name: "Kalenderlys", w: 1, d: 1, build: calendarCandle },
  { id: "jul-pebernod-bowl", name: "Pebernødskål", w: 1, d: 1, build: pebernodBowl },
  { id: "jul-advent", name: "Adventsstage", w: 1, d: 1, build: adventStand },
  { id: "jul-kravlenisse", name: "Kravlenisse", w: 1, d: 1, build: kravlenisse },
  { id: "jul-tree", name: "Juletræ", w: 3, d: 1, build: juleTree },
];
