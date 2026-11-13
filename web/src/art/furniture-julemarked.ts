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
  [0, 0], [1, 0], [3, 0], [4, 0],
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
  [1, 2], [2, 2], [3, 2],
  [2, 3],
];

/** Ink halos of all `list` first, then fills, so neighbours share an outline. */
function hearts(p: Pen, list: readonly (readonly [number, number, boolean])[], outline = true): void {
  if (outline)
    for (const [x, y] of list)
      for (const [dx, dy] of HEART_PX) p.rect(x + dx - 1, y + dy - 1, 3, 3, C.ink);
  for (const [x, y, white] of list) {
    for (const [dx, dy] of HEART_PX) p.px(x + dx, y + dy, white ? J.cream : J.red);
    // The weave: a cross-stripe of the other colour.
    const weave = white ? J.red : J.cream;
    p.px(x + 1, y + 1, weave);
    p.px(x + 3, y + 1, weave);
    p.px(x + 2, y + 2, weave);
  }
}

/** A cartoon flame, 3x4, its top-left at (x - 1, y); the second frame leans. */
function flame(p: Pen, x: number, y: number, frame: number): void {
  p.grid(
    [frame === 1 ? "..g" : ".g.", "gyg", "gyg", ".k."],
    { k: C.ink, g: "#e8962a", y: J.flame },
    x - 1,
    y,
  );
}

// MARK: Julehjerte garland

function heartGarland(p: Pen, frame: number): void {
  const sag = (x: number) => 2 + Math.round(4 * Math.sin((Math.PI * (x - 2)) / 27));
  // The string, pinned at both ends.
  for (let x = 2; x <= 29; x++) p.px(x, sag(x) + (frame === 1 && x > 8 && x < 24 ? 1 : 0), J.creamDark);
  for (const x of [1, 29]) {
    p.rect(x, 0, 2, 3, C.ink);
    p.px(x, 1, J.gold);
  }
  const list: [number, number, boolean][] = [];
  [4, 10, 16, 22, 28].forEach((cx, i) => {
    const swing = frame === 1 ? (i % 2 === 0 ? 1 : -1) * (i === 0 || i === 4 ? 0 : 1) : 0;
    const dip = frame === 1 && cx > 8 && cx < 24 ? 1 : 0;
    list.push([cx - 2 + swing, sag(cx) + 2 + dip, i % 2 === 1]);
  });
  hearts(p, list);
}

// MARK: Kalenderlys

function kalenderlys(p: Pen, frame: number): void {
  shadow(p, 3, 22, 10);
  // A small brass holder with a ring handle.
  p.rect(3, 19, 10, 3, C.ink);
  p.rect(4, 19, 8, 1, J.gold);
  p.rect(4, 20, 8, 1, J.goldDark);
  p.rect(12, 20, 2, 2, C.ink);
  p.px(13, 21, J.goldDark);
  // The candle, with a day mark every two rows, and a burnt-down top.
  box(p, 5, 8, 6, 12, J.cream);
  for (let y = 9; y < 19; y++) p.px(9, y, J.creamDark);
  p.rect(6, 9, 2, 1, "#fffaf0");
  for (const [y, long] of [
    [11, true],
    [13, false],
    [15, true],
    [17, false],
  ] as const) {
    p.rect(6, y, long ? 3 : 2, 1, J.red);
  }
  p.px(8, 7, C.ink);
  flame(p, 8, 3, frame);
}

// MARK: Pebernødskål

function pebernodBowl(p: Pen): void {
  shadow(p, 2, 14, 12);
  // The heap: little pepper nuts.
  blob(p, 8, 6, 6, 3, J.nutLight);
  for (const [x, y, c] of [
    [4, 6, J.nutDark],
    [6, 4, J.nut],
    [8, 6, J.nutDark],
    [10, 4, J.nut],
    [11, 7, J.nutDark],
    [3, 8, J.nut],
    [7, 8, J.nutDark],
    [9, 3, J.nutDark],
    [13, 6, J.nut],
    [5, 3, J.nutDark],
    [12, 5, J.nutDark],
  ] as const)
    p.px(x, y, c);
  // The bowl: cream, with a red band and a little heart.
  box(p, 1, 8, 14, 6, J.cream);
  p.rect(2, 10, 12, 1, J.red);
  p.rect(2, 12, 12, 1, J.creamDark);
  p.rect(2, 9, 12, 1, "#fffaf0");
  p.px(7, 11, J.red);
  p.px(9, 11, J.red);
  p.rect(7, 12, 3, 0, J.red);
  p.rect(4, 14, 8, 1, C.ink);
}

// MARK: Adventsstage

function advent(p: Pen, frame: number): void {
  shadow(p, 2, 22, 12);
  // The wooden foot.
  box(p, 4, 19, 8, 3, J.wood);
  p.rect(5, 20, 6, 1, J.woodLight);
  // Four candles (the last waiting), then the wreath in front of them.
  const xs = [2, 5, 9, 12];
  const tops = [10, 8, 9, 11];
  xs.forEach((x, i) => {
    p.rect(x - 1, tops[i]! - 1, 4, 9 + (11 - tops[i]!) - 3 + 4, C.ink);
  });
  xs.forEach((x, i) => {
    p.rect(x, tops[i]!, 2, 10, J.cream);
    p.px(x + 1, tops[i]! + 3, J.creamDark);
    p.rect(x + 1, tops[i]!, 1, 10, J.creamDark);
    p.px(x, tops[i]!, "#fffaf0");
  });
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
  ] as const)
    p.px(x, y, c);
  p.px(11, 17, J.red);
  p.px(4, 15, J.red);
  // The red ribbon bow at the front.
  p.rect(5, 19, 6, 1, C.ink);
  p.rect(6, 18, 2, 2, J.red);
  p.rect(9, 18, 2, 2, J.red);
  p.rect(8, 18, 1, 2, J.redDark);
  p.px(7, 20, J.red);
  p.px(9, 20, J.red);
  // Three lit.
  [0, 1, 2].forEach((i) => {
    flame(p, xs[i]! + 1, tops[i]! - 5, (frame + i) % 2);
  });
  p.px(xs[3]! + 1, tops[3]! - 1, C.ink);
}

// MARK: Kravlenisse

// The nisse behind the ledge: head, hat and beard. 12x11, drawn at (2, 0).
// prettier-ignore
const NISSE = [
  "........kwwk....",
  "........krrk....",
  ".......krrrrk...",
  "......krrrrrdk..",
  ".....krrrrrrrdk.",
  "....krrrrrrrrdk.",
  "...kwwwwwwwwwwk.",
  "....ksssssssk...",
  "....ksesssesk...",
  "....kcepppeck...",
  "....kwwwwwwwk...",
  ".....kwwwwwk....",
];

function kravlenisse(p: Pen, frame: number): void {
  // The ledge he is crawling over: a plank edge.
  p.rect(0, 12, 16, 4, C.ink);
  p.rect(1, 13, 14, 2, J.wood);
  p.rect(1, 13, 14, 1, J.woodLight);
  p.px(4, 14, J.woodDark);
  p.px(11, 14, J.woodDark);
  p.grid(
    NISSE,
    { k: C.ink, r: J.red, d: J.redDark, w: J.cream, s: J.skin, e: C.ink, c: J.pink, p: J.pink },
    0,
    0,
  );
  // Eyes: big and dark with a gleam, shut on the second frame.
  for (const x of [6, 10]) p.px(x, 8, frame === 1 ? J.skin : C.white);
  p.px(7, 9, "#f4b4ac");
  // Two small hands gripping the edge.
  for (const x of [0, 12]) {
    p.rect(x, 9, 4, 4, C.ink);
    p.rect(x + 1, 10, 2, 2, J.skin);
    p.px(x + 1, 10, J.cream);
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

function juletrae(p: Pen, frame: number): void {
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
  // The star.
  const star = [
    "....x....",
    "...xxx...",
    "xxxxxxxxx",
    ".xxxxxxx.",
    "..xxxxx..",
    "..xx.xx..",
    ".xx...xx.",
  ];
  star.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++)
      if (row[dx] === "x") p.rect(20 + dx - 1, 5 + dy - 1, 3, 3, C.ink);
  });
  star.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === "x") p.px(20 + dx, 5 + dy, J.gold);
  });
  p.px(24, 6, J.flame);
  p.px(24, 7, J.flame);
  p.px(23, 8, J.flame);
  // Flag strings with little Danish paper flags.
  const garland = (x0: number, x1: number, y: number, depth: number) => {
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
  };
  garland(16, 32, 34, 3);
  garland(11, 37, 45, 4);
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
  // Candles on the branch tips, flames flickering.
  for (const [x, y, ph] of [
    [14, 29, 0],
    [35, 29, 1],
    [8, 41, 1],
    [40, 41, 0],
    [4, 53, 0],
    [44, 53, 1],
  ] as const) {
    p.rect(x - 1, y - 4, 4, 6, C.ink);
    p.rect(x, y - 3, 2, 4, J.cream);
    p.px(x + 1, y - 3, J.creamDark);
    flame(p, x + 0, y - 8, (frame + ph) % 2);
  }
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
    frames: 2,
    frameMs: 700,
    placement: "wall",
    rarity: "common",
  }),
  piece("jul-kalenderlys", "Kalenderlys", 1, 24, kalenderlys, {
    frames: 2,
    frameMs: 350,
    rarity: "common",
  }),
  piece("jul-pebernod-bowl", "Pebernødskål", 1, 16, pebernodBowl, { rarity: "common" }),
  piece("jul-advent", "Adventsstage", 1, 24, advent, { frames: 2, frameMs: 400, rarity: "uncommon" }),
  piece("jul-kravlenisse", "Kravlenisse", 1, 16, kravlenisse, {
    frames: 2,
    frameMs: 1400,
    rarity: "uncommon",
  }),
  piece("jul-tree", "Juletræ", 3, 64, juletrae, { frames: 2, frameMs: 400, rarity: "rare" }),
];
