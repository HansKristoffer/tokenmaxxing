/**
 * The Julemarked coin stalls' five Julepynt pieces (`JULEPYNT_PIECES` in core/src/julemarked-shop.ts), drawn
 * like the other pieces for a personal office (`furniture-home.ts` adds them to `HOME_FURNITURE`): the same
 * three-quarter view and ink outlines, in the market's wool-and-paper reds. Three hang on the wall (one tile
 * tall), two stand on the floor.
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
  glow: "#fff0a8",
  wood: "#a06a3c",
  woodDark: "#7a4e2a",
  woodLight: "#c08a56",
  stone: "#c9c2b4",
  stoneDark: "#a8a090",
} as const;

/** A filled rectangle with a one-pixel ink outline. */
function box(p: Pen, x: number, y: number, w: number, h: number, fill: string): void {
  p.rect(x, y, w, h, C.ink);
  p.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

// MARK: Adventsstjerne (wall, two frames)

// A five-pointed paper star, 15 wide; "Y" is the lit centre ridge.
// prettier-ignore
const STAR = [
  ".......k.......",
  "......kYk......",
  "......kYk......",
  ".kkkkkkYkkkkkk.",
  ".kyyyyyYyyyyyk.",
  "..kyyyyYyyyyk..",
  "...kyyyYyyyk...",
  "...kyyyYyyyk...",
  "....kyyYyyk....",
  "...kyyykyyyk...",
  "...kyykkkyyk...",
  "..kyyk...kyyk..",
  "..kkk.....kkk..",
];

function star(p: Pen, frame: number): void {
  // The glow it throws on the wall, breathing between the frames.
  const r = frame === 0 ? 6 : 7;
  p.disc(7, 8, r, frame === 0 ? "rgba(255, 214, 120, 0.22)" : "rgba(255, 214, 120, 0.34)");
  p.disc(7, 8, r - 3, "rgba(255, 226, 150, 0.22)");
  // The cord it hangs from.
  p.px(7, 0, J.creamDark);
  p.grid(STAR, { k: C.ink, y: frame === 0 ? J.gold : "#f8d466", Y: J.glow }, 0, 1);
  // A hot spot that flickers.
  p.px(7, frame === 0 ? 6 : 7, "#ffffff");
}

// MARK: Julekalender (wall)

function kalender(p: Pen): void {
  // A nail, a red wooden board, and 24 little doors (2 px dashes) in 4 columns by 6 rows, a few open.
  p.px(8, 0, C.ink);
  box(p, 1, 1, 14, 15, J.red);
  p.rect(2, 2, 12, 13, "#5e1a18");
  const open = new Set([0, 1, 2, 4, 7, 9, 12]);
  const tone = [J.cream, J.green, J.gold, J.redLight];
  for (let i = 0; i < 24; i++) {
    const x = 2 + (i % 4) * 3;
    const y = 2 + Math.floor(i / 4) * 2;
    if (open.has(i)) {
      p.rect(x, y, 2, 1, "#2a0c0c");
      p.px(x, y, J.glow);
    } else p.rect(x, y, 2, 1, tone[(i + Math.floor(i / 4)) % 4]!);
  }
  // The odd one is a little off: tomorrow's, already open.
  p.rect(11, 12, 2, 1, J.glow);
}

// MARK: Nissedør (wall)

// A tiny arched door with a red and white curtain in its window, and a step at the foot of the wall.
// prettier-ignore
const DOOR = [
  "................",
  "................",
  "......kkkk......",
  ".....kddddk.....",
  "....kddddddk....",
  "...kdkkkkkkdk...",
  "...kdkrwrwkdk...",
  "...kdkwrwrkdk...",
  "...kdkkkkkkdk...",
  "...kddddddddk...",
  "...kddddddhdk...",
  "...kddddddddk...",
  "...kddddddddk...",
  "...kkkkkkkkkk...",
  "..kssssssssssk..",
  "..kkkkkkkkkkkk..",
];

function nissedoer(p: Pen): void {
  p.grid(DOOR, { k: C.ink, d: J.wood, r: J.red, w: J.cream, h: J.gold, s: J.stone }, 0, 0);
  // Planks, a lit pane glow under the curtain, and a shaded step.
  for (let y = 9; y <= 12; y++) p.px(7, y, J.woodDark);
  p.px(5, 9, J.woodLight);
  p.px(5, 10, J.woodLight);
  p.px(4, 5, J.woodLight);
  p.rect(4, 14, 3, 1, J.stoneDark);
  p.rect(11, 14, 1, 1, J.stoneDark);
}

// MARK: Bordjuletræ (floor, two frames)

function tier(p: Pen, cx: number, top: number, h: number, half: number, fill: string, edge: string): void {
  for (let i = 0; i < h; i++) {
    const w = Math.max(1, Math.round((half * (i + 1)) / h));
    p.rect(cx - w - 1, top + i, w * 2 + 3, 1, C.ink);
  }
  for (let i = 0; i < h; i++) {
    const w = Math.max(1, Math.round((half * (i + 1)) / h));
    p.rect(cx - w, top + i, w * 2 + 1, 1, fill);
    p.px(cx - w, top + i, edge);
  }
}

/** A woven paper heart, 3x3: top bumps, a row, a point. */
function heart(p: Pen, x: number, y: number, color: string): void {
  p.px(x, y, color);
  p.px(x + 2, y, color);
  p.rect(x, y + 1, 3, 1, color);
  p.px(x + 1, y + 2, color);
}

function bordtree(p: Pen, frame: number): void {
  p.rect(2, 22, 12, 2, C.shadow);
  tier(p, 8, 11, 8, 6, J.green, J.greenDark);
  tier(p, 8, 6, 7, 5, J.greenLight, J.green);
  tier(p, 8, 2, 6, 3, J.green, J.greenDark);
  // A pot with a cream rim.
  box(p, 4, 19, 8, 4, J.red);
  p.rect(5, 19, 6, 1, J.cream);
  p.rect(5, 21, 2, 1, J.redLight);
  // The star on top.
  p.px(8, 0, J.gold);
  p.rect(7, 1, 3, 1, J.gold);
  p.px(8, 2, J.gold);
  // Woven hearts.
  heart(p, 4, 14, J.cream);
  heart(p, 10, 13, J.red);
  heart(p, 6, 9, J.red);
  heart(p, 9, 8, J.cream);
  // A string of lights, twinkling.
  const lights: [number, number][] = [
    [3, 17],
    [6, 12],
    [11, 17],
    [8, 11],
    [8, 5],
    [10, 7],
    [6, 5],
  ];
  for (const [i, [x, y]] of lights.entries()) p.px(x, y, (i + frame) % 2 === 0 ? J.glow : J.gold);
}

// MARK: Gavestabel (floor)

function gaver(p: Pen): void {
  p.rect(0, 14, 16, 2, C.shadow);
  // The big red one, a cream ribbon.
  box(p, 0, 7, 9, 8, J.red);
  p.rect(4, 8, 2, 6, J.cream);
  p.rect(1, 10, 7, 2, J.cream);
  p.px(1, 8, J.redLight);
  // The green one beside it, red ribbon.
  box(p, 8, 9, 8, 6, J.green);
  p.rect(11, 10, 2, 4, J.red);
  p.rect(9, 11, 6, 1, J.red);
  // A small cream one on top with a bow.
  box(p, 1, 3, 7, 5, J.cream);
  p.rect(4, 4, 1, 3, J.red);
  p.rect(2, 5, 5, 1, J.red);
  p.px(3, 2, J.red);
  p.px(5, 2, J.red);
  p.px(4, 3, J.redDark);
  p.px(3, 1, C.ink);
  p.px(5, 1, C.ink);
  // And a gold one on the green, green ribbon.
  box(p, 9, 5, 5, 5, J.gold);
  p.rect(11, 6, 1, 3, J.green);
  p.rect(10, 7, 3, 1, J.green);
}

// MARK: Catalog

const piece = (
  id: string,
  name: string,
  height: number,
  price: number,
  draw: FancyPiece["draw"],
  extra: Partial<Pick<FancyPiece, "frames" | "frameMs" | "placement">> = {},
): FancyPiece => ({
  id,
  name,
  w: 1,
  h: 1,
  height,
  price,
  rarity: "common",
  frames: 1,
  frameMs: 500,
  tint: null,
  placement: "floor",
  draw,
  ...extra,
});

/** The five Julepynt pieces (ids and footprints as in `JULEPYNT_PIECES`). */
export const JULEPYNT_FURNITURE: readonly FancyPiece[] = [
  piece("jst-star", "Adventsstjerne", 16, 120, star, { frames: 2, frameMs: 650, placement: "wall" }),
  piece("jst-kalender", "Julekalender", 16, 180, kalender, { placement: "wall" }),
  piece("jst-nissedoer", "Nissedør", 16, 140, nissedoer, { placement: "wall" }),
  piece("jst-bordtree", "Bordjuletræ", 24, 240, bordtree, { frames: 2, frameMs: 600 }),
  piece("jst-gaver", "Gavestabel", 16, 160, gaver),
];
