/**
 * The Julemarked case's six pieces (`JULEMARKED_PIECES` in core/src/case-julemarked-furniture.ts), drawn like the
 * other cases' (same three-quarter view, ink outlines): `furniture-fancy.ts` looks these up through `fancyPiece`.
 * Wool, paper and candlelight; reds are matte (see `docs/cases/julemarked.md`).
 */
import type { FancyPiece } from "./furniture-fancy.ts";
import { C } from "./palette.ts";
import type { Pen } from "./pixels.ts";

const J = {
  red: "#b8302c",
  redDark: "#8c2220",
  redLight: "#d0504a",
  cream: "#f4ecd8",
  creamDark: "#d8cbaa",
  green: "#2f5d3a",
  greenDark: "#234a2d",
  greenLight: "#4a7c55",
  gold: "#f2c14e",
  goldDark: "#c8932a",
  flame: "#ffe9a0",
  wood: "#a06a3c",
  woodDark: "#7a4e2a",
  woodLight: "#c08a56",
  nut: "#6b3f22",
  nutDark: "#4a2a15",
  nutLight: "#8c5a34",
  dane: "#c8102e",
  skin: "#f0c8a0",
  pink: "#e8908a",
  frost: "#bcd8e8",
} as const;

const shadow = (p: Pen, x: number, y: number, w: number) => p.rect(x, y, w, 2, C.shadow);

/** A filled rectangle with a one-pixel ink outline. */
function box(p: Pen, x: number, y: number, w: number, h: number, fill: string): void {
  p.rect(x, y, w, h, C.ink);
  p.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

function oval(p: Pen, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)) + 0.3);
    p.rect(cx - half, cy + y, half * 2 + 1, 1, color);
  }
}

function blob(p: Pen, cx: number, cy: number, rx: number, ry: number, fill: string): void {
  oval(p, cx, cy, rx + 1, ry + 1, C.ink);
  oval(p, cx, cy, rx, ry, fill);
}

// A woven paper heart, 5x4: its filled pixels.
const HEART_PX: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [3, 0],
  [4, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [2, 2],
  [3, 2],
  [2, 3],
];

/** Ink halos of all `list` first, then fills, so neighbours share an outline. */
function hearts(p: Pen, list: readonly (readonly [number, number, boolean])[], outline = true): void {
  if (outline)
    for (const [x, y] of list) for (const [dx, dy] of HEART_PX) p.rect(x + dx - 1, y + dy - 1, 3, 3, C.ink);
  for (const [x, y, white] of list) {
    for (const [dx, dy] of HEART_PX) p.px(x + dx, y + dy, white ? J.cream : J.red);
    // The weave: a cross-stripe of the other colour.
    const weave = white ? J.red : J.cream;
    p.px(x + 1, y + 1, weave);
    p.px(x + 3, y + 1, weave);
    p.px(x + 2, y + 2, weave);
  }
}

const rgba = (rgb: string, a: number) => `rgba(${rgb}, ${Math.round(a * 100) / 100})`;
const WARM = "255, 205, 110";

/** A soft round glow (translucent pixels fading outward), clipped to the `W`x`H` sprite. */
function halo(
  p: Pen,
  W: number,
  H: number,
  cx: number,
  cy: number,
  r: number,
  alpha: number,
  rgb = WARM,
): void {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
      const a = alpha * (1 - Math.hypot(x - cx, y - cy) / r) ** 1.5;
      if (a >= 0.04 && Math.hypot(x - cx, y - cy) <= r) p.px(x, y, rgba(rgb, a));
    }
}

// A candle flame, 3x5: tall, leaning right, leaning left, short and fat.
// prettier-ignore
const FLAMES: readonly (readonly string[])[] = [
  [".o.", "oyo", "oyo", "owo", ".b."],
  ["..o", ".oy", "oyo", "owo", ".b."],
  ["o..", "yo.", "oyo", "owo", ".b."],
  ["...", ".o.", "oyo", "owo", ".b."],
];
const FLAME_PAL = { o: "#f08a24", y: "#ffd55a", w: "#fffbe0", b: "#7ab0ff" };

/** A flame whose centre column is `x` and whose top row is `y`. */
function flame(p: Pen, x: number, y: number, shape: number): void {
  p.grid(FLAMES[((shape % 4) + 4) % 4]!, FLAME_PAL, x - 1, y);
}

/** A small plus-shaped gold star, ink-outlined, centred on (x, y); `lit` makes it flash white with a glow. */
function plusStar(p: Pen, x: number, y: number, lit: boolean): void {
  p.rect(x - 2, y - 1, 5, 3, C.ink);
  p.rect(x - 1, y - 2, 3, 5, C.ink);
  p.rect(x - 1, y, 3, 1, J.gold);
  p.rect(x, y - 1, 1, 3, J.gold);
  p.px(x, y, lit ? "#ffffff" : J.flame);
  if (lit) {
    p.px(x, y - 1, J.flame);
    p.px(x, y + 1, J.flame);
  }
}

// MARK: Julehjerte garland

function heartGarland(p: Pen, f: number): void {
  const W = 32;
  const H = 16;
  const sag = (x: number) => 2 + Math.round(4 * Math.sin((Math.PI * (x - 2)) / 27));
  const wob = (x: number) => (x > 6 && x < 26 ? Math.round(0.7 * Math.sin((f * Math.PI) / 2 + x / 4)) : 0);
  // The twine (with a dark edge under it so it reads on a pale wall), pinned at both ends with gold knobs.
  for (let x = 2; x <= 29; x++) p.px(x, sag(x) + wob(x) + 1, C.ink);
  for (let x = 2; x <= 29; x++) p.px(x, sag(x) + wob(x), "#d6a85c");
  for (const x of [1, 29]) {
    p.rect(x, 0, 2, 3, C.ink);
    p.px(x, 1, J.gold);
    p.px(x + (x === 1 ? 1 : 0), 0, J.goldDark);
  }
  const cxs = [4, 10, 16, 22, 28];
  const list: [number, number, boolean][] = [];
  cxs.forEach((cx, i) => {
    const end = i === 0 || i === 4;
    const swing = end ? 0 : Math.round(1.2 * Math.sin((f * Math.PI) / 2 + i * 1.3));
    list.push([cx - 2 + swing, sag(cx) + wob(cx) + 2, i % 2 === 1]);
  });
  hearts(p, list);
  // A gold star dangling under each heart; they take turns to flash.
  cxs.forEach((_, i) => {
    const [hx, hy] = list[i]!;
    const sx = hx + 2;
    const sy = i === 1 || i === 3 ? 13 : hy + 6 <= 12 ? hy + 6 : 12;
    p.px(sx, hy + 4, J.goldDark);
    if (i === 1 || i === 3) p.px(sx, 11, J.goldDark);
    const lit = (f + i) % 4 === 0;
    if (lit) halo(p, W, H, sx, sy, 5, 0.55);
    plusStar(p, sx, sy, lit);
  });
}

// MARK: Kalenderlys

function kalenderlys(p: Pen, f: number): void {
  const W = 16;
  const H = 24;
  const flick = [0.34, 0.42, 0.3, 0.4][f % 4]!;
  shadow(p, 3, 22, 10);
  // Candlelight pooled on the floor and the holder.
  p.rect(2, 22, 12, 1, rgba(WARM, flick * 0.7));
  p.rect(4, 23, 8, 1, rgba(WARM, flick * 0.45));
  // A brass holder with a ring handle.
  p.rect(3, 19, 10, 3, C.ink);
  p.rect(4, 19, 8, 1, J.gold);
  p.rect(4, 20, 8, 1, J.goldDark);
  p.rect(12, 20, 2, 2, C.ink);
  p.px(13, 21, J.goldDark);
  p.px(5, 19, J.flame);
  // The candle, with a day mark every two rows and the burnt-down pool of wax on top.
  box(p, 5, 8, 6, 12, J.cream);
  for (let y = 9; y < 19; y++) p.px(9, y, J.creamDark);
  for (const [y, long] of [
    [11, true],
    [13, false],
    [15, true],
    [17, false],
  ] as const)
    p.rect(6, y, long ? 3 : 2, 1, J.red);
  p.px(10, 11, J.red);
  p.px(10, 15, J.red);
  p.rect(6, 9, 4, 1, "#fff6d0");
  p.rect(6, 8, 4, 1, J.flame);
  // Melted wax drips: the right one creeps down and lets a bead fall, the left one is a short old one.
  const len = [2, 3, 5, 6][f % 4]!;
  for (let y = 9; y < 9 + len; y++) p.px(9, y, "#fffaf0");
  p.px(9, 9 + len, f % 4 === 3 ? "#fff6d0" : "#fffaf0");
  p.px(9, 10 + len, f % 4 === 3 ? "#fffaf0" : J.creamDark);
  p.px(6, 9, "#fffaf0");
  p.px(6, 10, "#fffaf0");
  p.px(6, 11, J.creamDark);
  // The flame's glow washes the top of the candle and the air round it.
  halo(p, W, H, 8, 5, 8, flick);
  p.px(7, 8, "#ffffff");
  // The flame, then the odd spark rising.
  p.px(8, 7, C.ink);
  flame(p, 8, 2, f);
  const spark: [number, number][] = [
    [11, 3],
    [12, 1],
    [4, 2],
    [5, 0],
  ];
  const [sx, sy] = spark[f % 4]!;
  p.px(sx, sy, J.flame);
  p.px(spark[(f + 2) % 4]![0], spark[(f + 2) % 4]![1], "rgba(255, 213, 90, 0.6)");
}

// MARK: Pebernødskål

function pebernodBowl(p: Pen, f: number): void {
  shadow(p, 2, 14, 12);
  // A wisp of spice steam, curling up from the heap in three drifting frames.
  [0.7, 0.55, 0.4, 0.25].forEach((a, y) => {
    for (const [base, ph] of [
      [5, 0],
      [8, 2],
    ] as const) {
      const x = base + Math.round(1.2 * Math.sin((f * Math.PI) / 2 + y * 1.4 + ph));
      p.px(x, 3 - y, rgba("255, 238, 214", a));
      p.px(x + 1, 3 - y, rgba("255, 238, 214", a * 0.5));
    }
  });
  // The heap: little pepper nuts, each two pixels, packed over a dark core.
  blob(p, 8, 8, 6, 3, J.nutDark);
  for (let y = 5; y <= 10; y += 2)
    for (let x = 3; x <= 12; x += 2) {
      const xx = x + (y % 4 === 1 ? 1 : 0);
      if (((xx - 8) / 6) ** 2 + ((y + 0.5 - 8) / 3) ** 2 > 1.05) continue;
      const pick = (xx * 7 + y * 3) % 3;
      p.rect(xx, y, 2, 2, pick === 0 ? J.nut : pick === 1 ? J.nutLight : J.nutDark);
      p.px(xx, y, pick === 1 ? "#a8744a" : J.nutLight);
      if (pick === 2) p.px(xx + 1, y + 1, J.creamDark);
    }
  // A woven paper heart tucked in at the right, and a glint that hops over the nuts.
  hearts(p, [[10, 3, false]]);
  const glints: [number, number][] = [
    [4, 7],
    [7, 5],
    [9, 9],
    [12, 8],
  ];
  const [gx, gy] = glints[f % 4]!;
  p.px(gx, gy, "#ffffff");
  p.px(gx - 1, gy, rgba("255, 255, 255", 0.5));
  p.px(gx + 1, gy, rgba("255, 255, 255", 0.5));
  // The bowl: cream, gold-rimmed, a red zigzag band and a stamped heart.
  box(p, 1, 9, 14, 5, J.cream);
  p.rect(2, 10, 12, 1, J.gold);
  p.rect(2, 9, 12, 1, J.goldDark);
  p.rect(2, 12, 12, 1, J.creamDark);
  for (let x = 2; x < 14; x++) p.px(x, 11, x % 2 ? J.red : J.cream);
  p.rect(4, 14, 8, 1, C.ink);
  p.px(2, 10, J.flame);
}

// MARK: Adventsstage

function advent(p: Pen, f: number): void {
  const W = 16;
  const H = 24;
  // The candles are lit one at a time, then all four burn for a while before it begins again.
  const lit = [1, 2, 3, 4, 4, 4, 4, 4][f % 8]!;
  const fresh = [0, 1, 2, 3].includes(f % 8) ? f % 8 : -1;
  shadow(p, 2, 22, 12);
  // The wooden foot.
  box(p, 4, 19, 8, 3, J.wood);
  p.rect(5, 20, 6, 1, J.woodLight);
  const xs = [1, 5, 9, 13];
  const tops = [10, 8, 9, 11];
  xs.forEach((x, i) => {
    p.rect(x - 1, tops[i]! - 1, 4, 19 - tops[i]!, C.ink);
  });
  xs.forEach((x, i) => {
    p.rect(x, tops[i]!, 2, 9, J.cream);
    p.rect(x + 1, tops[i]!, 1, 9, J.creamDark);
    p.rect(x, tops[i]! + 3, 2, 1, J.red);
    p.rect(x, tops[i]! + 6, 2, 1, J.red);
    if (i < lit) {
      p.rect(x, tops[i]!, 2, 1, "#fff6d0");
      p.px(x + 1, tops[i]! + 1, "#fffaf0");
      p.px(x + 1, tops[i]! + 2 + ((f + i) % 2), "#fffaf0");
    }
  });
  // The wreath, which brightens as the flames join in.
  blob(p, 8, 16, 6, 3, J.green);
  oval(p, 8, 16, 3, 1, J.greenDark);
  for (const [x, y, c] of [
    [2, 16, J.greenLight],
    [4, 18, J.greenLight],
    [12, 18, J.greenLight],
    [13, 16, J.greenLight],
    [6, 14, J.greenDark],
    [10, 14, J.greenLight],
    [3, 14, J.greenDark],
    [8, 18, J.greenLight],
  ] as const)
    p.px(x, y, c);
  // Berries and two gold baubles that catch the light.
  p.px(11, 17, J.red);
  p.px(4, 15, J.red);
  p.px(12, 15, J.red);
  p.px(7, 18, J.red);
  p.px(2, 17, J.gold);
  p.px(13, 17, f % 2 ? J.flame : J.gold);
  // The red ribbon bow at the front, with two tails.
  p.rect(5, 19, 6, 1, C.ink);
  p.rect(6, 18, 2, 2, J.red);
  p.rect(9, 18, 2, 2, J.red);
  p.rect(8, 18, 1, 2, J.redDark);
  p.px(6, 18, J.redLight);
  p.px(9, 18, J.redLight);
  p.px(7, 20, J.red);
  p.px(9, 20, J.red);
  p.px(7, 21, J.redDark);
  p.px(10, 21, J.redDark);
  // Light: a halo per flame and a warm wash over the wreath.
  halo(p, W, H, 8, 16, 9, 0.07 * lit);
  xs.slice(0, lit).forEach((x, i) => {
    halo(p, W, H, x, tops[i]! - 3, 5, i === fresh ? 0.55 : 0.4);
  });
  xs.forEach((x, i) => {
    const y = tops[i]! - 5;
    if (i < lit) {
      p.px(x, tops[i]! - 1, C.ink);
      flame(p, x, y, f + i * 2);
      if (i === fresh) {
        // The newest flame throws a few sparks.
        p.px(x + 2, y + 1, J.flame);
        p.px(Math.max(0, x - 2), y + 2, J.flame);
        p.px(x + 1, y - 1, "#ffffff");
      }
    } else {
      // Not yet lit: a bare, dark wick.
      p.px(x, tops[i]! - 1, C.ink);
      p.px(x + 1, tops[i]! - 1, J.creamDark);
    }
  });
}

// MARK: Kravlenisse

// The nisse behind the ledge: hat, brim, face and beard. 16x12; the pom-pom and the face are painted separately.
// prettier-ignore
const NISSE = [
  "................",
  "................",
  "................",
  "......krrk......",
  ".....krrrrk.....",
  "....krhrrrdk....",
  "...krrrrrrrdk...",
  "..kwwwwwwwwwwk..",
  "...kssssssssk...",
  "...kssssssssk...",
  "...kssssssssk...",
  "...kwwwwwwwwk...",
];
const NISSE_PAL = { k: C.ink, r: J.red, d: J.redDark, h: J.redLight, w: J.cream, s: J.skin };

// What the nisse does, one entry per frame: how far he has dropped behind the ledge, which way he looks, and a pose.
type NisseMove = {
  dy: number;
  look: -1 | 0 | 1;
  pose: "peek" | "blink" | "wave" | "wave2" | "smile" | "gasp";
  pom: -1 | 0 | 1;
};
// prettier-ignore
const NISSE_MOVES: readonly NisseMove[] = [
  { dy: 0, look: 0, pose: "peek", pom: 0 },
  { dy: 0, look: -1, pose: "peek", pom: -1 },
  { dy: 0, look: 1, pose: "peek", pom: 1 },
  { dy: 0, look: 0, pose: "blink", pom: 0 },
  { dy: 0, look: 0, pose: "peek", pom: -1 },
  { dy: 0, look: 0, pose: "wave", pom: 1 },
  { dy: 0, look: 0, pose: "wave2", pom: 0 },
  { dy: 0, look: 0, pose: "wave", pom: -1 },
  { dy: 0, look: 0, pose: "wave2", pom: 1 },
  { dy: 0, look: 0, pose: "smile", pom: 0 },
  { dy: 3, look: 0, pose: "gasp", pom: 0 },
  { dy: 8, look: 0, pose: "peek", pom: 1 },
  { dy: 9, look: 0, pose: "peek", pom: -1 },
  { dy: 4, look: 0, pose: "gasp", pom: 0 },
  { dy: 1, look: 1, pose: "smile", pom: 0 },
];

function kravlenisse(p: Pen, f: number): void {
  const m = NISSE_MOVES[f % NISSE_MOVES.length]!;
  const LEDGE = 12;
  const put = (x: number, y: number, c: string) => {
    if (y >= 0 && y < LEDGE) p.px(x, y, c);
  };
  const putRect = (x: number, y: number, w: number, h: number, c: string) => {
    const y1 = Math.min(y + h, LEDGE);
    if (y1 > y) p.rect(x, y, w, y1 - y, c);
  };
  // A soft lamp-lit glow behind him.
  if (m.dy < 6) halo(p, 16, 16, 8, 6 + m.dy, 9, 0.2);
  // Head, hat and beard, clipped at the ledge.
  NISSE.forEach((row, y) => {
    if (y + m.dy < LEDGE) p.grid([row], NISSE_PAL, 0, y + m.dy);
  });
  // The pom-pom, bobbing.
  const px0 = 6 + m.pom;
  put(px0 + 1, m.dy, C.ink);
  put(px0 + 2, m.dy, C.ink);
  putRect(px0, m.dy + 1, 4, 2, C.ink);
  putRect(px0 + 1, m.dy + 1, 2, 2, J.cream);
  put(px0 + 1, m.dy + 1, "#ffffff");
  // Face: big eyes with gleams, a button nose, rosy cheeks.
  const ey = 8 + m.dy;
  const ex = [5, 9].map((x) => x + m.look);
  for (const x of ex) {
    if (m.pose === "blink") {
      put(x, ey + 1, C.ink);
      put(x + 1, ey + 1, C.ink);
    } else if (m.pose === "wave" || m.pose === "wave2" || m.pose === "smile") {
      // Happy shut eyes, an upturned arc.
      put(x, ey + 1, C.ink);
      put(x + 1, ey, C.ink);
      put(x + 2 - 1, ey + 1, C.ink);
      if (x === ex[0]) put(x + 1, ey + 1, J.skin);
      else put(x + 1, ey + 1, J.skin);
      put(x, ey + 1, C.ink);
    } else {
      putRect(x, ey, 2, m.pose === "gasp" ? 3 : 2, C.ink);
      put(x, ey, "#ffffff");
      if (m.pose === "gasp") put(x + 1, ey + 2, "#ffffff");
    }
  }
  put(4, 10 + m.dy, J.pink);
  put(11, 10 + m.dy, J.pink);
  put(5, 10 + m.dy, "#f4b4ac");
  put(10, 10 + m.dy, "#f4b4ac");
  put(7, 10 + m.dy, "#d6504a");
  put(8, 10 + m.dy, "#d6504a");
  // The mouth in the beard: a smile, wide when waving, a round O when startled.
  if (m.pose === "gasp") {
    put(7, 11 + m.dy, J.pink);
    put(8, 11 + m.dy, J.pink);
  } else if (m.pose === "smile" || m.pose === "wave" || m.pose === "wave2") {
    put(6, 11 + m.dy, "#d6504a");
    put(7, 11 + m.dy, "#8c2220");
    put(8, 11 + m.dy, "#8c2220");
    put(9, 11 + m.dy, "#d6504a");
  }
  // The ledge: a plank edge, dusted with snow.
  p.rect(0, LEDGE, 16, 4, C.ink);
  p.rect(1, LEDGE, 14, 1, J.woodLight);
  p.rect(1, LEDGE + 1, 14, 2, J.wood);
  p.px(4, LEDGE + 2, J.woodDark);
  p.px(5, LEDGE + 2, J.woodDark);
  p.px(11, LEDGE + 2, J.woodDark);
  for (const x of [1, 2, 6, 7, 8, 13, 14]) p.px(x, LEDGE, "#ffffff");
  p.px(3, LEDGE, J.frost);
  p.px(9, LEDGE, J.frost);
  // The hands: the left grips the edge; the right grips too, or waves above his head.
  const grip = (x: number) => {
    p.rect(x, 9, 4, 4, C.ink);
    p.rect(x + 1, 10, 2, 2, J.skin);
    p.px(x + 1, 10, J.cream);
  };
  grip(0);
  if (m.pose === "wave" || m.pose === "wave2") {
    const hy = m.pose === "wave" ? 3 : 5;
    p.rect(12, hy + 3, 4, LEDGE - hy - 3, C.ink);
    p.rect(13, hy + 3, 2, LEDGE - hy - 3, J.red);
    p.rect(12, hy + 3, 4, 1, C.ink);
    p.rect(13, hy + 4, 2, 1, J.cream);
    p.rect(12, hy, 4, 4, C.ink);
    p.rect(13, hy + 1, 2, 2, J.skin);
    // Fingers spread, wiggling.
    p.px(m.pose === "wave" ? 12 : 15, hy - 1, C.ink);
    p.px(m.pose === "wave" ? 13 : 14, hy - 1, J.skin);
    // A little heart floats up for him.
    hearts(p, [[0, m.pose === "wave" ? 2 : 3, false]], false);
  } else if (m.dy < 7) {
    grip(12);
  } else {
    // Ducked: just two fingertips over the edge.
    p.rect(1, LEDGE - 1, 2, 1, J.skin);
    p.rect(13, LEDGE - 1, 2, 1, J.skin);
  }
}

// MARK: Juletræ

function tier(p: Pen, cx: number, top: number, bot: number, halfBot: number): void {
  for (let y = top; y <= bot; y++) {
    const half = Math.round((halfBot * (y - top)) / (bot - top));
    p.rect(cx - half - 1, y, 2 * half + 3, 1, C.ink);
    if (y === bot) continue;
    p.rect(cx - half, y, 2 * half + 1, 1, J.green);
    p.rect(cx + Math.floor(half / 2), y, half - Math.floor(half / 2) + 1, 1, J.greenDark);
    p.px(cx - half, y, J.greenLight);
  }
  // Scalloped hem.
  for (let x = cx - halfBot; x <= cx + halfBot; x += 4) p.px(x, bot - 1, J.greenDark);
}

/** A wrapped gift: a ribbon down the middle and a bow. */
function gift(p: Pen, x: number, y: number, w: number, h: number, paper: string, ribbon: string): void {
  box(p, x, y, w, h, paper);
  const mx = x + Math.floor(w / 2);
  p.rect(mx, y + 1, 1, h - 2, ribbon);
  p.rect(x + 1, y + 2, w - 2, 1, ribbon);
  p.px(mx - 1, y - 1, ribbon);
  p.px(mx + 1, y - 1, ribbon);
  p.px(mx, y - 1, C.ink);
  p.px(x + 1, y + 1, "rgba(255, 255, 255, 0.5)");
}

function juletrae(p: Pen, f: number): void {
  const W = 48;
  const H = 64;
  shadow(p, 8, 62, 32);
  // The trunk and a little red pot.
  box(p, 21, 54, 6, 5, J.wood);
  p.rect(22, 55, 1, 3, J.woodLight);
  box(p, 17, 57, 14, 6, J.red);
  p.rect(18, 58, 12, 1, J.redLight);
  p.rect(18, 61, 12, 1, J.redDark);
  tier(p, 24, 14, 32, 10);
  tier(p, 24, 24, 44, 15);
  tier(p, 24, 36, 56, 21);
  // Pot drawn again over the lowest hem.
  box(p, 17, 57, 14, 6, J.red);
  p.rect(18, 58, 12, 1, J.redLight);
  p.rect(18, 61, 12, 1, J.redDark);
  // The star, with a pulsing glow and four rays that grow and shrink.
  const star = ["....x....", "...xxx...", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", "..xx.xx..", ".xx...xx."];
  const pulse = [0, 1, 2, 3, 2, 1][f % 6]!;
  halo(p, W, H, 24, 8, 8 + pulse, 0.42 + pulse * 0.08);
  star.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === "x") p.rect(20 + dx - 1, 5 + dy - 1, 3, 3, C.ink);
  });
  star.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === "x") p.px(20 + dx, 5 + dy, J.gold);
  });
  p.px(24, 6, J.flame);
  p.px(24, 7, J.flame);
  p.px(23, 8, J.flame);
  p.px(22, 7, J.goldDark);
  p.px(26, 7, J.goldDark);
  if (pulse > 0) {
    for (let k = 0; k < pulse; k++) {
      p.px(24, 3 - k - 1, k ? rgba("255, 233, 160", 0.6) : "#ffffff");
      p.px(18 - k, 8, k ? rgba("255, 233, 160", 0.6) : "#ffffff");
      p.px(30 + k, 8, k ? rgba("255, 233, 160", 0.6) : "#ffffff");
    }
  }
  // Flag strings with little Danish paper flags, and tiny lights that chase along them.
  const garland = (x0: number, x1: number, y: number, depth: number, phase: number) => {
    const mid = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    const at = (x: number) => y + Math.round(depth * (1 - ((x - mid) / half) ** 2));
    for (let x = x0; x <= x1; x++) p.px(x, at(x), J.cream);
    for (let x = x0 + 3; x < x1 - 1; x += 5) {
      const fy = at(x) + 1;
      p.rect(x, fy, 4, 3, C.ink);
      p.rect(x + 1, fy, 2, 2, J.dane);
      p.px(x + 1, fy, J.cream);
      p.px(x + 1, fy + 1, J.cream);
      p.px(x + 2, fy + 1, J.dane);
    }
    for (let x = x0 + 2, k = 0; x < x1; x += 5, k++) {
      const on = (k + f + phase) % 3 === 0;
      if (on) halo(p, W, H, x, at(x), 3, 0.5);
      p.px(x, at(x), on ? "#ffffff" : J.gold);
    }
  };
  garland(16, 32, 34, 3, 0);
  garland(11, 37, 45, 4, 1);
  // Woven hearts.
  hearts(
    p,
    [
      [20, 20, false],
      [26, 28, true],
      [14, 32, true],
      [32, 38, false],
      [21, 37, true],
      [9, 51, false],
      [35, 52, true],
      [21, 52, false],
    ],
    false,
  );
  // Gold baubles that glint in turn.
  [
    [24, 18],
    [18, 40],
    [30, 41],
    [12, 50],
    [38, 49],
  ].forEach(([x, y], i) => {
    p.rect(x! - 1, y! - 1, 3, 3, C.ink);
    p.px(x!, y!, J.gold);
    p.px(x! + 1, y!, J.goldDark);
    p.px(x!, y! + 1, J.goldDark);
    if ((f + i) % 6 === 0) {
      p.px(x! - 1, y! - 1, "#ffffff");
      p.px(x!, y! - 2, "#ffffff");
      p.px(x! + 2, y!, "#ffffff");
    }
  });
  // Real candles on the branch tips: each flame flickers on its own beat and the lit one glows brightest.
  [
    [14, 29, 0],
    [35, 29, 3],
    [8, 41, 2],
    [40, 41, 5],
    [4, 53, 4],
    [44, 53, 1],
  ].forEach(([x, y, ph]) => {
    const peak = (f + ph!) % 6 < 2;
    p.rect(x! - 1, y! - 4, 4, 6, C.ink);
    p.rect(x!, y! - 3, 2, 4, J.cream);
    p.px(x! + 1, y! - 3, J.creamDark);
    p.px(x!, y! - 3, "#fffaf0");
    halo(p, W, H, x! + 0.5, y! - 6, peak ? 7 : 5, peak ? 0.5 : 0.32);
    flame(p, x!, y! - 8, f + ph!);
  });
  // Gifts at the foot.
  gift(p, 2, 56, 10, 7, J.red, J.cream);
  gift(p, 11, 59, 6, 4, J.cream, J.red);
  gift(p, 38, 56, 9, 7, J.green, J.gold);
  gift(p, 32, 59, 6, 4, "#3b6fb8", J.cream);
  if (f % 3 === 0) p.px(40, 55, "#ffffff");
  if (f % 3 === 1) p.px(5, 54, "#ffffff");
}

// MARK: Catalog

const piece = (
  id: string,
  name: string,
  w: number,
  height: number,
  draw: FancyPiece["draw"],
  extra: Partial<Pick<FancyPiece, "frames" | "frameMs" | "placement" | "rarity">>,
): FancyPiece => ({
  id,
  name,
  w,
  h: 1,
  height,
  price: 0,
  rarity: "common",
  frames: 1,
  frameMs: 500,
  tint: null,
  placement: "floor",
  draw,
  ...extra,
});

/** The Julemarked case's pieces (`JULEMARKED_PIECES` in core/src/case-julemarked-furniture.ts). */
export const JULEMARKED_FURNITURE: readonly FancyPiece[] = [
  piece("jul-heart-garland", "Julehjerte-guirlande", 2, 16, heartGarland, {
    frames: 4,
    frameMs: 380,
    placement: "wall",
    rarity: "common",
  }),
  piece("jul-kalenderlys", "Kalenderlys", 1, 24, kalenderlys, {
    frames: 4,
    frameMs: 170,
    rarity: "common",
  }),
  piece("jul-pebernod-bowl", "Pebernødskål", 1, 16, pebernodBowl, {
    frames: 4,
    frameMs: 330,
    rarity: "common",
  }),
  piece("jul-advent", "Adventsstage", 1, 24, advent, { frames: 8, frameMs: 450, rarity: "uncommon" }),
  piece("jul-kravlenisse", "Kravlenisse", 1, 16, kravlenisse, {
    frames: 15,
    frameMs: 300,
    rarity: "uncommon",
  }),
  piece("jul-tree", "Juletræ", 3, 64, juletrae, { frames: 6, frameMs: 220, rarity: "rare" }),
];
