/**
 * The Julemarked case's furniture in 3D (`JULEMARKED_PIECES` in core/src/case-julemarked-furniture.ts), the same
 * pieces as `furniture-julemarked.ts` draws in 2D: a paper-heart garland, a calendar candle, a bowl of pepper
 * nuts, an advent stand, a crawling paper nisse and a Danish Christmas tree. Built like `norse3d.ts`: bottom
 * centre at the origin, front along +z; the garland hangs on a wall, so it is built against y = 0 facing +z.
 * Wool, paper and candlelight: matte reds, cream, forest green and gold. Brief: docs/cases/julemarked.md.
 */
import { glow, Model, seeded, ticks, tint } from "../kit/kit.ts";
import { light } from "./furniture.ts";

export const JUL_RED = "#b8302c";
export const JUL_CREAM = "#f4ecd8";
export const JUL_GREEN = "#2f5d3a";
export const JUL_GOLD = "#f2c14e";
const WOOD = "#a06a3c";
const WOOD_D = "#6e4526";
const NUT = "#6b3f22";
const WHITE = "#ffffff";
const DANNE = "#c8102e";
const WOOL = "#8a8f98";
const SKIN = "#e8b8a0";

/**
 * A paper heart facing +z, centred on (x, y, z), `s` across: a square turned on its corner and two round lobes, in two
 * tones (the woven look) with a smaller inner heart. Flat discs and a thin box, so it reads smooth or blocky.
 */
export function paperHeart(
  parent: Model,
  x: number,
  y: number,
  z: number,
  s: number,
  a: string,
  b: string,
): void {
  const side = s * 0.6;
  const lobe = side / 2;
  const o = side / (2 * Math.SQRT2);
  const layer = (k: number, col: string, dz: number) => {
    const sd = side * k;
    const lr = lobe * k;
    const off = o * k;
    const pivot = parent.part([x, y, z + dz]);
    pivot.rotation.z = Math.PI / 4;
    pivot.box([sd, sd, 0.02], col, [0, -sd / 2, 0], 0.002);
    for (const sx of [-1, 1]) {
      const d = parent.cyl(lr, 0.02, col, [x + sx * off, y + off, z + dz - 0.01], lr, 12);
      d.rotation.x = Math.PI / 2;
    }
  };
  layer(1, a, 0);
  layer(0.55, b, 0.012);
}

/** A flame: a small glowing teardrop, with a soft flicker on `phase`. */
function flame(m: Model, x: number, y: number, z: number, r: number, phase: number): void {
  const f = m.box([r * 1.6, r * 2, r * 1.6], glow(JUL_GOLD), [x, y - r * 0.3, z], 0.002);
  m.box([r * 0.8, r * 1.2, r * 0.8], glow("#fff6d0"), [x, y - r * 0.1, z], 0.001);
  ticks.push((t) => {
    f.scale.set(1, 1.5 + 0.25 * Math.sin(t * 9 + phase), 1);
  });
}

/** A taper candle with a wick, its bottom centre at (x, y, z). */
function candle(m: Model, x: number, y: number, z: number, h: number, r: number, col: string, ph: number): void {
  m.box([r * 2, h, r * 2], col, [x, y, z], 0.002);
  m.box([0.008, 0.03, 0.008], "#2a2220", [x, y + h, z], 0.001);
  flame(m, x, y + h + 0.03, z, r * 0.8, ph);
}

// MARK: Heart garland

const heartGarland = (): Model => {
  const m = new Model();
  const top = 2.1;
  const sag = 0.28;
  const W = 1.8;
  const pts: [number, number][] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    pts.push([(u - 0.5) * W, top - sag * (1 - (2 * u - 1) ** 2)]);
  }
  // Two nails and the string between them.
  for (const s of [-1, 1]) {
    m.ball(0.035, JUL_GOLD, [s * 0.92, top + 0.01, 0.01], [1, 1, 0.6], 6);
    m.box([0.02, 0.02, 0.05], "#5a4a3a", [s * 0.92, top + 0.01, -0.02], 0.003);
  }
  for (let i = 0; i < N; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const seg = m.box([len + 0.01, 0.014, 0.014], "#d8c9a6", [(x0 + x1) / 2, (y0 + y1) / 2 - 0.007, 0.01], 0.002);
    seg.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  }
  // Hearts hang from the string, alternating red-and-cream and cream-and-red, with a green sprig between.
  const hearts = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];
  hearts.forEach((x, i) => {
    const u = x / W + 0.5;
    const y = top - sag * (1 - (2 * u - 1) ** 2);
    const drop = 0.1 + (i % 2) * 0.04;
    m.box([0.008, drop, 0.008], "#d8c9a6", [x, y - drop, 0.012], 0.001);
    if (i % 2) paperHeart(m, x, y - drop - 0.13, 0.02, 0.3, JUL_CREAM, JUL_RED);
    else paperHeart(m, x, y - drop - 0.13, 0.02, 0.3, JUL_RED, JUL_CREAM);
  });
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const u = x / W + 0.5;
    const y = top - sag * (1 - (2 * u - 1) ** 2);
    m.ball(0.035, JUL_GREEN, [x, y - 0.01, 0.025], [1.3, 0.8, 0.8], 6);
  }
  return m;
};

// MARK: Calendar candle

const calendarCandle = (): Model => {
  const m = new Model();
  // A small wooden dish and the tall cream candle with a red mark for each day; the top is burnt down to today.
  m.box([0.5, 0.04, 0.5], WOOD_D, [0, 0, 0], 0.003);
  m.box([0.42, 0.03, 0.42], WOOD, [0, 0.04, 0], 0.003);
  const H = 0.72;
  m.box([0.17, H, 0.17], JUL_CREAM, [0, 0.07, 0], 0.003);
  for (let i = 0; i < 12; i++) {
    const y = 0.1 + i * 0.05;
    m.box([0.176, 0.012, 0.176], i % 4 === 3 ? JUL_RED : tint(JUL_RED, 0.08), [0, y, 0], 0.001);
  }
  // A few drips and a little dish of wax at the burnt end.
  m.box([0.156, 0.014, 0.156], "#fff8e8", [0, 0.07 + H, 0], 0.001);
  m.box([0.03, 0.12, 0.03], "#fff8e8", [0.07, 0.07 + H - 0.12, 0.03], 0.008);
  m.box([0.02, 0.07, 0.02], "#fff8e8", [-0.05, 0.07 + H - 0.07, 0.07], 0.006);
  m.box([0.009, 0.045, 0.009], "#2a2220", [0, 0.07 + H + 0.014, 0], 0.001);
  flame(m, 0, 0.07 + H + 0.05, 0, 0.032, 0);
  // A pine sprig and a berry or two at the foot.
  for (const a of [0.4, 1.7, 3.0, 4.4]) {
    const s = m.part([Math.cos(a) * 0.17, 0.065, Math.sin(a) * 0.17], -a);
    s.ball(0.04, JUL_GREEN, [0, 0.01, 0], [1.6, 0.5, 0.7], 6);
  }
  m.ball(0.02, JUL_RED, [0.14, 0.08, 0.12], [1, 1, 1], 6);
  m.ball(0.02, JUL_RED, [-0.12, 0.08, 0.15], [1, 1, 1], 6);
  light(m, [0, 0.95, 0.1], "#ffcf7a", 0.6, 3);
  return m;
};

// MARK: Pepper-nut bowl

const pebernodBowl = (): Model => {
  const m = new Model();
  const rnd = seeded(7);
  // A cream bowl with a red band on a small foot, filled to a heap with pepper nuts.
  m.box([0.28, 0.05, 0.28], JUL_CREAM, [0, 0, 0], 0.002);
  m.box([0.4, 0.04, 0.4], JUL_CREAM, [0, 0.05, 0], 0.002);
  m.box([0.48, 0.04, 0.48], JUL_CREAM, [0, 0.09, 0], 0.002);
  m.box([0.54, 0.05, 0.54], JUL_RED, [0, 0.13, 0], 0.002);
  m.box([0.6, 0.02, 0.6], JUL_CREAM, [0, 0.18, 0], 0.002);
  m.box([0.54, 0.04, 0.54], "#2a1a10", [0, 0.2, 0], 0.002);
  for (let i = 0; i < 70; i++) {
    const x = (rnd() * 2 - 1) * 0.23;
    const z = (rnd() * 2 - 1) * 0.23;
    const hgt = 0.2 + (1 - Math.max(Math.abs(x), Math.abs(z)) / 0.23) * 0.1 + rnd() * 0.02;
    m.box([0.07, 0.06, 0.07], i % 5 === 0 ? tint(NUT, 0.15) : NUT, [x, hgt, z], 0.004);
  }
  // A few spilled on the table, and a tiny heart-shaped cookie on the rim.
  for (const [x, z] of [
    [0.4, 0.2],
    [0.42, 0.09],
    [-0.4, 0.27],
  ] as const)
    m.box([0.056, 0.05, 0.056], NUT, [x, 0, z], 0.004);
  paperHeart(m, 0.0, 0.34, 0.31, 0.12, JUL_RED, JUL_CREAM);
  return m;
};

// MARK: Advent stand

const adventStand = (): Model => {
  const m = new Model();
  // A wooden tray with a ring of fir, four red candles of different heights (three lit, one still to go) and a bow.
  m.box([0.8, 0.04, 0.8], WOOD_D, [0, 0, 0], 0.003);
  m.box([0.72, 0.035, 0.72], WOOD, [0, 0.04, 0], 0.003);
  // The fir ring is a square of blocks, four to a side, so it reads as one chunky wreath.
  const ring = m.part([0, 0.075, 0]);
  const rnd = seeded(11);
  const H = 0.25;
  for (let i = 0; i < 16; i++) {
    const side = Math.floor(i / 4);
    const k = (i % 4) - 1.5;
    const [px, pz] = [[k * 0.16, -H], [H, k * 0.16], [-k * 0.16, H], [-H, -k * 0.16]][side]! as [number, number];
    ring.box([0.16, 0.07 + rnd() * 0.03, 0.16], i % 3 ? JUL_GREEN : tint(JUL_GREEN, 0.12), [px, 0, pz], 0.004);
  }
  const heights = [0.5, 0.42, 0.34, 0.26];
  [0, 1, 2, 3].forEach((i) => {
    const x = (i % 2 ? 1 : -1) * 0.25;
    const z = (i < 2 ? -1 : 1) * 0.25;
    m.box([0.12, 0.05, 0.12], JUL_GOLD, [x, 0.1, z], 0.003);
    if (i < 3) candle(m, x, 0.15, z, heights[i]! - 0.05, 0.036, JUL_RED, i * 1.7);
    else {
      m.box([0.072, 0.16, 0.072], JUL_RED, [x, 0.15, z], 0.002);
      m.box([0.008, 0.03, 0.008], "#2a2220", [x, 0.31, z], 0.001);
    }
  });
  // Red berries and a bow on the front of the ring.
  for (const [x, z] of [
    [-0.1, 0.34],
    [0.14, 0.33],
    [0.3, 0.2],
  ] as const)
    m.box([0.045, 0.045, 0.045], JUL_RED, [x, 0.12, z], 0.003);
  const bow = m.part([0, 0.14, 0.4]);
  for (const s of [-1, 1]) bow.box([0.1, 0.07, 0.05], JUL_RED, [s * 0.06, -0.035, 0], 0.004);
  bow.box([0.05, 0.05, 0.06], tint(JUL_RED, -0.15), [0, -0.025, 0.01], 0.003);
  light(m, [0, 0.8, 0.1], "#ffcf7a", 0.9, 3.5);
  return m;
};

// MARK: Kravlenisse

const kravlenisse = (): Model => {
  const m = new Model();
  // The edge of a shelf (a timber block) with a tiny paper nisse crawling up over it, face first.
  m.box([0.84, 0.36, 0.5], WOOD, [0, 0, 0], 0.025);
  m.box([0.88, 0.05, 0.54], WOOD_D, [0, 0.36, 0], 0.02);
  const n = m.part([0, 0.41, 0.05]);
  // Little grey body behind the edge, arms stretched out over it, mittens red.
  n.ball(0.14, WOOL, [0, 0.1, -0.12], [1, 0.9, 1.1], 10);
  for (const s of [-1, 1]) {
    const arm = n.box([0.05, 0.05, 0.22], WOOL, [s * 0.13, 0.04, 0.0], 0.015);
    arm.rotation.y = s * -0.15;
    n.ball(0.04, JUL_RED, [s * 0.15, 0.05, 0.14], [1, 0.9, 1], 8);
  }
  // The head: skin face with a big cream beard hanging down the front of the edge, a round nose, and eyes.
  n.ball(0.12, SKIN, [0, 0.22, 0.04], [1, 1, 1], 12);
  n.ball(0.115, JUL_CREAM, [0, 0.12, 0.09], [1.05, 1.0, 0.8], 12);
  n.ball(0.05, JUL_CREAM, [0, 0.03, 0.12], [1, 1.3, 0.7], 8);
  n.ball(0.036, tint(SKIN, -0.05), [0, 0.22, 0.15], [1, 1, 1], 8);
  for (const s of [-1, 1]) n.ball(0.014, "#2a2220", [s * 0.05, 0.27, 0.13], [1, 1, 0.6], 5);
  // The long red hat, slumped to one side, with a cream band and a pompom.
  n.cyl(0.14, 0.04, JUL_CREAM, [0, 0.29, 0.03], 0.13, 14);
  n.cyl(0.125, 0.2, JUL_RED, [0, 0.32, 0.03], 0.06, 12);
  const tipH = n.part([0.03, 0.5, 0.03]);
  tipH.rotation.z = -0.8;
  tipH.cyl(0.06, 0.16, JUL_RED, [0, 0, 0], 0.025, 10);
  n.ball(0.035, JUL_CREAM, [0.16, 0.5, 0.03], [1, 1, 1], 8);
  // Two clogs hanging down the back, and a tiny paper heart on the wood.
  for (const s of [-1, 1]) n.box([0.07, 0.04, 0.1], WOOD_D, [s * 0.07, 0.0, -0.3], 0.015);
  paperHeart(m, -0.28, 0.2, 0.26, 0.14, JUL_RED, JUL_CREAM);
  return m;
};

// MARK: Christmas tree

const juleTree = (): Model => {
  const m = new Model();
  const rnd = seeded(23);
  // A wooden tub with a red band, a trunk and five tiers of spruce that narrow to a gold star.
  m.cyl(0.3, 0.3, WOOD_D, [0, 0, 0], 0.26, 16);
  m.cyl(0.285, 0.05, JUL_RED, [0, 0.12, 0], 0.282, 16);
  m.cyl(0.06, 0.3, "#4a2f1b", [0, 0.28, 0], 0.05, 8);
  const tiers: [number, number, number][] = [
    [0.68, 0.34, 0.32],
    [0.58, 0.34, 0.66],
    [0.47, 0.32, 0.98],
    [0.36, 0.3, 1.28],
    [0.24, 0.28, 1.54],
  ];
  tiers.forEach(([r, h, y], i) => {
    m.cyl(r, h, i % 2 ? tint(JUL_GREEN, 0.06) : JUL_GREEN, [0, y, 0], r * 0.12, 12);
  });
  m.cyl(0.05, 0.12, "#4a2f1b", [0, 1.82, 0], 0.04, 6);
  const star = m.ball(0.09, glow(JUL_GOLD), [0, 1.98, 0], [1, 1, 0.4], 5);
  star.rotation.z = Math.PI / 5;
  for (const s of [0, 1, 2, 3, 4]) {
    const r = m.box([0.04, 0.12, 0.03], glow(JUL_GOLD), [0, 1.98, 0], 0.005);
    r.rotation.z = (s / 5) * Math.PI * 2;
    r.position.y = 1.98 - 0.0;
  }
  // Woven hearts hung on the tiers, a string of Dannebrog flags and real candles.
  const hang: [number, number, number, number][] = [
    [-0.3, 0.52, 0.34, 0],
    [0.3, 0.55, 0.32, 1],
    [-0.19, 0.88, 0.3, 1],
    [0.22, 0.92, 0.3, 0],
    [0.0, 1.2, 0.28, 0],
    [-0.12, 1.48, 0.25, 1],
    [0.13, 1.5, 0.24, 0],
  ];
  for (const [x, y, z, k] of hang) {
    const s = 0.2;
    // Pushed out so the heart sits on the front of its tier.
    const out = z + 0.04;
    m.box([0.006, 0.07, 0.006], "#d8c9a6", [x, y + 0.02, out], 0.001);
    if (k) paperHeart(m, x, y - 0.03, out + 0.01, s, JUL_CREAM, JUL_RED);
    else paperHeart(m, x, y - 0.03, out + 0.01, s, JUL_RED, JUL_CREAM);
  }
  // Paper flags on a swag of string: small red-and-white pennants, with the cross showing as a white stripe.
  const swag = (x0: number, y0: number, x1: number, y1: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u - 0.05 * Math.sin(u * Math.PI);
      m.box([0.048, 0.04, 0.012], i % 2 ? DANNE : WHITE, [x, y - 0.045, z], 0.002);
      m.box([0.048, 0.01, 0.014], i % 2 ? WHITE : DANNE, [x, y - 0.03, z], 0.001);
    }
    const len = Math.hypot(x1 - x0, y1 - y0);
    const s = m.box([len, 0.01, 0.01], "#d8c9a6", [(x0 + x1) / 2, (y0 + y1) / 2 - 0.01, z - 0.004], 0.001);
    s.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  };
  swag(-0.38, 0.7, 0.34, 0.76, 0.45, 8);
  swag(-0.3, 1.1, 0.26, 1.12, 0.38, 6);
  // Candles clipped to the tiers' tips, lit.
  [
    [-0.52, 0.64, 0.14],
    [0.5, 0.66, 0.16],
    [-0.4, 0.98, 0.12],
    [0.38, 1.0, 0.18],
    [-0.28, 1.3, 0.12],
    [0.27, 1.3, 0.16],
  ].forEach(([x, y, z], i) => {
    m.box([0.04, 0.012, 0.04], JUL_GOLD, [x!, y! - 0.01, z!], 0.002);
    candle(m, x!, y!, z!, 0.1, 0.014, JUL_CREAM, i * 1.3);
  });
  // Gold baubles dotted about.
  for (let i = 0; i < 7; i++) {
    const t = tiers[i % 5]!;
    const a = rnd() * Math.PI * 2;
    const rr = t[0] * 0.5;
    m.ball(0.026, i % 2 ? glow(JUL_GOLD) : JUL_RED, [Math.cos(a) * rr, t[2] + 0.05, Math.abs(Math.sin(a)) * rr], [1, 1, 1], 6);
  }
  // Presents under the tree and to the sides, wrapped in red, cream and green paper with ribbon.
  const gift = (x: number, z: number, w: number, h: number, d: number, paper: string, rib: string, turn = 0) => {
    const g = m.part([x, 0, z], turn);
    g.box([w, h, d], paper, [0, 0, 0], 0.01);
    g.box([w + 0.01, h + 0.01, 0.045], rib, [0, 0, 0], 0.003);
    g.box([0.045, h + 0.01, d + 0.01], rib, [0, 0, 0], 0.003);
    g.ball(0.035, rib, [0, h + 0.02, 0], [1.5, 0.7, 0.8], 6);
  };
  gift(-0.95, 0.1, 0.34, 0.26, 0.3, JUL_RED, JUL_CREAM, 0.3);
  gift(-0.55, 0.45, 0.22, 0.2, 0.22, JUL_GREEN, JUL_GOLD, -0.2);
  gift(0.6, 0.42, 0.28, 0.22, 0.26, JUL_CREAM, JUL_RED, 0.2);
  gift(1.0, 0.0, 0.36, 0.3, 0.32, JUL_GREEN, JUL_CREAM, -0.3);
  gift(-1.2, -0.25, 0.26, 0.24, 0.26, JUL_CREAM, JUL_GREEN, 0.1);
  light(m, [0, 1.3, 0.8], "#ffcf7a", 1.2, 5);
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
