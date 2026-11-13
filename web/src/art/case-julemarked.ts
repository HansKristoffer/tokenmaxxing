import type { Art } from "./editions.ts";
import { C } from "./palette.ts";

/**
 * The Julemarked case's hats and glasses (`core/src/case-julemarked.ts`, indices 800 up), drawn like the Ragnarok
 * Eve's (`case-ragnarok.ts`, which `case.ts` merges in beside these): hats over the head from row 0, glasses over
 * the eyes from row 5. A grid per view; a missing side or back view is the front one. Keyed by item id.
 * Design and palette: `docs/cases/julemarked.md`.
 *
 * Rarity shows in the work: the commons carry one signature detail, the uncommons more silhouette, the epic a
 * moving glow. Wearing has two frames (standing and the first walking one is the base art; `walkB` lays
 * `JULEMARKED_WEAR_WALK` over it, which `wardrobe.ts` does): bells glint, lights blink, flames flicker, bulbs cycle.
 */

const o = C.ink;
// Nisse red, shade, cream, cream shade, forest green, lighter needle, candle gold.
const jul = {
  R: "#b8302c",
  r: "#8e2220",
  w: "#f4ecd8",
  W: "#d8cdb0",
  G: "#2f5d3a",
  g: "#487f52",
  y: "#f2c14e",
};

/** A 16-wide frame of `h` rows with single pixels set: for laying a second walking frame over the first. */
const patch = (h: number, ...px: [x: number, y: number, c: string][]): string[] => {
  const g = Array.from({ length: h }, () => Array<string>(16).fill("."));
  for (const [x, y, c] of px) g[y]![x] = c;
  return g.map((r) => r.join(""));
};

const mirror = (rows: string[]): string[] => rows.map((row) => [...row].reverse().join(""));

const NISSE = [
  "......oooo......",
  ".....oRRRRoo....",
  "....oRRRRRRRoo..",
  "...oRRRRRRrRRRo.",
  "..oRRRRRRRrRRRRo",
  "..owwwwwwwwwwRRo",
  ".............oRo",
  ".............oyo",
  ".............yYy",
  "..............o.",
];
const POMPON = [
  "....owwwwwwo....",
  "...owwWwwwWwo...",
  "...oRRRRRRRRo...",
  "..oRRRRRrRRRRo..",
  "..owwRwwwwRwwo..",
  "..owRwRwwRwRwo..",
];
const KRANS = [
  "..o.ooo.ooo.oo..",
  "..ooGgGGgyGgGoo.",
  "..oGGBGdGGgBGGRo",
  "..oGgGyGGBBGGRRo",
  "..ooGGgGGgdGoRRo",
  "...ooooooooo.oRo",
];
const LUCIA = [
  "..hOh..h.h..hOh.",
  "..hyh.hhyhh.hyh.",
  "..owWo.owWo.owWo",
  "..oWWo.oWWo.oWWo",
  "..ooGgGGgGGgGoo.",
  "..oGBGgGGgGGBGo.",
  "...oooooooooooo.",
];

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_HATS: Record<string, Art> = {
  // Nissehue (common): a tall red cone that slumps over and hangs down the cheek, a cream fold, a gold bell on the tip.
  "hat.800": { down: NISSE, side: mirror(NISSE), up: NISSE, pal: { o, ...jul, Y: "#c9971f" } },
  // Pomponhue (common): a cream and red knitted beanie, a fat fluffy pompom, a band of red snowflakes.
  "hat.801": { down: POMPON, pal: { o, ...jul } },
  // Grankrans (common): a spiky ring of pine needles, red berries, a red bow and fairy lights that blink.
  "hat.802": { down: KRANS, pal: { o, ...jul, B: "#d4413a", d: "#7a6a3a" } },
  // Lucia-krone (uncommon): a leaf ring with three candles, red berries, and flames that flicker in a warm halo.
  "hat.803": { down: LUCIA, pal: { o, ...jul, B: "#d4413a", h: "#f2c14e44", O: "#f08a3c", W: "#cbbf9f" } },
};
for (const id of ["hat.801", "hat.802", "hat.803"]) {
  const art = JULEMARKED_HATS[id]!;
  art.side = art.down;
  art.up = art.down;
}

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_GLASSES: Record<string, Art> = {
  // Kolde kinder (common): rosy cheeks, a red nose and a little cloud of cold breath.
  "glasses.800": {
    down: [
      "................",
      "................",
      "....pP.NN.Pp....",
      "......bbb.......",
      ".....bBBBb......",
    ],
    side: [
      "................",
      "................",
      "........pPPpN...",
      "............bbb.",
      "..............b.",
    ],
    pal: { p: "#e8918f", P: "#f2b3ae", N: "#d4413a", b: "#e8f2fa", B: "#bcd8e8" },
  },
  // Julelys-briller (uncommon): round frames of fairy-light bulbs in red, gold, green and white, cycling as you walk.
  "glasses.801": {
    down: ["....RYG..WRY....", "...kG.RkkW.Yk...", "....YWG..GRW...."],
    side: [".........RYG....", "..kkkkkkkG.R....", ".........WYG...."],
    pal: { R: "#d4413a", Y: "#f2c14e", G: "#4f9a5c", W: "#fdf3d8", k: "#5a4a3a" },
  },
  // Nissebriller (uncommon): thin round gold rims under a pair of huge fluffy white brows, a glint on the lens.
  "glasses.802": {
    down: ["..wwWww..wwWww..", "..wky.yyyy.ykw..", "....xyy..yyy...."],
    side: [".......wwWwww...", "..kkkkkkky.y....", ".........yyy...."],
    pal: { w: "#ffffff", W: "#e6e2d6", y: "#f2c14e", k: "#a8842a", x: "#fffbe0" },
  },
};

const NEXT: Record<string, string> = { R: "Y", Y: "G", G: "W", W: "R" };
/** The bulbs one step on round the ring. */
const cycle = (rows: string[]): string[] => rows.map((r) => [...r].map((c) => NEXT[c] ?? ".").join(""));

/** The second walking frame of a hat (from row 0) or glasses (from row 5): drawn over the base art. */
export interface WearWalk {
  down?: string[];
  side?: string[];
  up?: string[];
  pal: Art["pal"];
}

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_WEAR_WALK: Record<string, WearWalk> = {
  // The bell on the nisse's tip swings and rings.
  "hat.800": {
    down: patch(10, [14, 7, "Y"], [13, 8, "Y"], [14, 8, "y"], [15, 8, "Y"], [14, 9, "w"]),
    up: patch(10, [14, 7, "Y"], [13, 8, "Y"], [14, 8, "y"], [15, 8, "Y"], [14, 9, "w"]),
    side: patch(10, [1, 7, "Y"], [2, 8, "Y"], [1, 8, "y"], [0, 8, "Y"], [1, 9, "w"]),
    pal: { y: "#f2c14e", Y: "#c9971f", w: "#ffffff" },
  },
  // The pompom shivers.
  "hat.801": {
    down: patch(3, [6, 0, "W"], [9, 0, "w"], [6, 1, "w"], [7, 1, "W"], [10, 1, "w"], [9, 1, "W"]),
    up: patch(3, [6, 0, "W"], [9, 0, "w"], [6, 1, "w"], [7, 1, "W"], [10, 1, "w"], [9, 1, "W"]),
    side: patch(3, [6, 0, "W"], [9, 0, "w"], [6, 1, "w"], [7, 1, "W"], [10, 1, "w"], [9, 1, "W"]),
    pal: { w: "#f4ecd8", W: "#d8cdb0" },
  },
  // The fairy lights swap: the two that were lit go dark and the other two come on.
  "hat.802": {
    down: patch(6, [9, 1, "d"], [6, 3, "d"], [7, 2, "y"], [10, 4, "y"]),
    pal: { y: "#fff0a0", d: "#7a6a3a" },
  },
  // The flames flicker: tips change colour and the middle candle's flame leaps.
  "hat.803": {
    down: patch(2, [3, 0, "y"], [13, 0, "y"], [8, 0, "O"]),
    pal: { y: "#fff0a0", O: "#f08a3c" },
  },
  // The cold breath swells and drifts.
  "glasses.800": {
    down: ["", "", "", ".....bbbbb......", ".....bBBBBb.....", "......bBBb......", ".......b........"],
    side: ["", "", "", "............bBBb", "...............b"],
    pal: { b: "#e8f2fa", B: "#bcd8e8" },
  },
  // The bulbs chase round the frames.
  "glasses.801": {
    down: cycle(["....RYG..WRY....", "....G.R..W.Y....", "....YWG..GRW...."]),
    side: cycle([".........RYG....", ".........G.R....", ".........WYG...."]),
    pal: { R: "#d4413a", Y: "#f2c14e", G: "#4f9a5c", W: "#fdf3d8" },
  },
  // The glint slides from one lens to the other.
  "glasses.802": {
    down: patch(3, [4, 2, "y"], [11, 2, "x"]),
    side: patch(3, [9, 2, "x"], [10, 2, "y"]),
    pal: { y: "#f2c14e", x: "#fffbe0" },
  },
};

for (const id of ["hat.802", "hat.803"]) {
  const w = JULEMARKED_WEAR_WALK[id]!;
  w.side = w.down;
  w.up = w.down;
}
