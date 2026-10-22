import { C } from "./palette.ts";
import { bake, cached, once, type Palette } from "./pixels.ts";

/**
 * The Tavern's furniture (`inn`): the bar and its tap, a stool, the hearth and its flames, a barrel, the
 * quest board, the Hall of Fame wall, the regulars' plaque and a table. Each is baked once; `objects.ts`
 * places them and `game/tavern.ts` lights the hearth.
 */

const BRASS = "#c98e22";
const BRASS_LIGHT = "#fff4b8";
const BRASS_DARK = "#8a5f14";
const PAPER = "#f1e6d2";

/** The bar counter, one tile: a polished top over a planked front. With `tap`, a brass tap and a mug on it. */
export const bar = cached(
  (tap: boolean) => `${tap}`,
  (tap: boolean) =>
    bake(16, 22, (p) => {
      p.rect(0, 20, 16, 2, C.shadow);
      // Front: planks under the overhang.
      p.rect(0, 9, 16, 11, C.ink);
      p.rect(0, 10, 16, 9, C.woodDark);
      for (const x of [3, 8, 13]) p.rect(x, 11, 1, 7, C.trunkDark);
      p.rect(0, 18, 16, 1, C.trunkDark);
      // Top.
      p.rect(0, 4, 16, 6, C.ink);
      p.rect(0, 5, 16, 4, C.woodLight);
      p.rect(0, 5, 16, 1, C.white);
      p.rect(0, 8, 16, 1, C.wood);
      if (!tap) return;
      // The tap: a brass spout over a drip tray, and a full mug beside it.
      p.rect(5, 0, 4, 2, C.ink);
      p.rect(6, 0, 2, 1, BRASS_LIGHT);
      p.rect(6, 2, 2, 4, BRASS);
      p.rect(5, 6, 4, 1, BRASS_DARK);
      p.rect(10, 1, 4, 5, C.ink);
      p.rect(11, 2, 2, 3, "#f5d14a");
      p.rect(11, 2, 2, 1, C.white);
    }),
);

const STOOL: { rows: string[]; pal: Palette } = {
  rows: [
    "..oooo..",
    ".orrrro.",
    "orRrrrro",
    "oddddddo",
    ".oooooo.",
    "..m..m..",
    "..mmmm..",
    "..m..m..",
    ".m....m.",
    ".m....m.",
    "ss....ss",
  ],
  pal: { o: C.ink, r: C.rug, R: C.rugLight, d: C.rugDark, m: C.metal, s: C.shadow },
};
export const stool = once(() => bake(8, 11, (p) => p.grid(STOOL.rows, STOOL.pal)));

const BARREL: { rows: string[]; pal: Palette } = {
  rows: [
    "..oooooo..",
    ".olwwwwdo.",
    "ommmmmmmmo",
    "olwwwwwwdo",
    "olwlwwwwdo",
    "olwwwwwwdo",
    "olwwwwlwdo",
    "olwwwwwwdo",
    "ommmmmmmmo",
    ".olwwwwdo.",
    "..oooooo..",
    "..ssssss..",
  ],
  pal: { o: C.ink, w: C.wood, d: C.woodDark, l: C.woodLight, m: C.metal, s: C.shadow },
};
export const barrel = once(() => bake(10, 12, (p) => p.grid(BARREL.rows, BARREL.pal)));

/** The hearth, two tiles wide: a stone surround, the dark opening, and logs. Its flames are `hearthFlame`. */
export const HEARTH_W = 32;
export const HEARTH_H = 24;
/** Where the flames sit in it. */
export const FLAME_AT = { x: 8, y: 9, w: 16, h: 11 } as const;
export const hearth = once(() =>
  bake(HEARTH_W, HEARTH_H, (p) => {
    p.rect(1, 22, 30, 2, C.shadow);
    // Chimney breast and mantel.
    p.rect(2, 0, 28, 22, C.ink);
    p.rect(3, 1, 26, 20, C.stone);
    p.rect(3, 1, 26, 2, C.stoneLight);
    for (let y = 4; y < 21; y += 4) p.rect(3, y, 26, 1, C.stoneDark);
    for (let y = 4; y < 21; y += 4)
      for (let x = ((y / 4) % 2) * 4 + 5; x < 29; x += 8) p.rect(x, y + 1, 1, 3, C.stoneDark);
    p.rect(0, 5, 32, 3, C.ink);
    p.rect(1, 6, 30, 1, C.woodLight);
    p.rect(1, 7, 30, 1, C.woodDark);
    // The opening and its logs.
    p.rect(FLAME_AT.x - 1, FLAME_AT.y - 1, FLAME_AT.w + 2, FLAME_AT.h + 2, C.ink);
    p.rect(FLAME_AT.x, FLAME_AT.y, FLAME_AT.w, FLAME_AT.h, "#1c1620");
    p.rect(10, 18, 12, 3, C.trunkDark);
    p.rect(10, 18, 12, 1, C.trunk);
    p.rect(12, 17, 8, 1, C.trunkDark);
    p.rect(2, 21, 28, 1, C.stoneDark);
  }),
);

// biome-ignore format: pixel art reads as a grid
const FLAMES = [
  [
    ".......o........",
    "......oyo.......",
    "..o...oyo..o....",
    ".oro..oyyo.oro..",
    ".orro.oyyo.orro.",
    "oorryyoyyyorrryo",
    "orryyyyyyyyyyrro",
    "orrryyyYYyyyrrro",
    ".orrryyYYyyrrro.",
  ],
  [
    "........o.......",
    ".......oyo..o...",
    "..o....oyo.oro..",
    ".oro..oyyo.orro.",
    ".orro.oyyyoorro.",
    "oorrryoyyyyrrryo",
    "orryyyyyyyyyyrro",
    "orrryyYYYyyyrrro",
    ".orrryyYYyyrrro.",
  ],
];
const FLAME_PAL: Palette = { o: "#c0412f", r: "#ee7a2c", y: "#f8c43a", Y: "#fff0a8" };

/** The fire in the hearth's opening, two frames of flicker. */
export const hearthFlame = cached(
  (frame: number) => `${frame % 2}`,
  (frame: number) => bake(16, 9, (p) => p.grid(FLAMES[frame % 2]!, FLAME_PAL)),
);

/** A wall sconce: a bracket and a candle flame. */
export const sconce = cached(
  (frame: number) => `${frame % 2}`,
  (frame: number) =>
    bake(6, 12, (p) => {
      p.rect(2, 5, 2, 5, C.ink);
      p.rect(1, 9, 4, 2, C.ink);
      p.rect(2, 5, 2, 4, BRASS);
      p.rect(2, 5, 1, 4, BRASS_LIGHT);
      p.rect(2, 3 - (frame % 2 ? 1 : 0), 2, 2 + (frame % 2 ? 1 : 0), "#f8c43a");
      p.px(2, 4, "#fff0a8");
    }),
);

/** The quest board, two tiles wide: a cork board in a wooden frame, pinned with notes. */
export const questBoard = once(() =>
  bake(32, 22, (p) => {
    p.rect(2, 20, 28, 2, C.shadow);
    p.rect(0, 0, 32, 20, C.ink);
    p.rect(1, 1, 30, 18, C.woodDark);
    p.rect(2, 2, 28, 16, "#c89460");
    for (let i = 0; i < 24; i++) p.px(3 + ((i * 7) % 26), 3 + ((i * 5) % 14), "#a8764a");
    // Notes: paper, a pin, and a few scribbled lines each.
    const notes: [number, number, number, string][] = [
      [4, 4, 7, PAPER],
      [13, 3, 6, "#f8e3a3"],
      [21, 5, 7, PAPER],
      [8, 11, 7, "#f8e3a3"],
      [18, 11, 6, PAPER],
      [25, 11, 4, "#f2a0b8"],
    ];
    for (const [x, y, w, color] of notes) {
      p.rect(x, y, w, 6, color);
      p.px(x + Math.floor(w / 2), y, C.rug);
      for (let k = 2; k < 5; k += 2) p.rect(x + 1, y + k, w - 2, 1, C.stoneDark);
    }
    p.rect(2, 2, 28, 1, "#dcab76");
  }),
);

/** One tile of the Hall of Fame wall: dark panelling and a gold frame; every other tile has a crest. */
export const hallWall = cached(
  (crest: boolean) => `${crest}`,
  (crest: boolean) =>
    bake(16, 22, (p) => {
      p.rect(0, 20, 16, 2, C.shadow);
      p.rect(0, 0, 16, 20, C.ink);
      p.rect(1, 1, 14, 18, BRASS);
      p.rect(1, 1, 14, 1, BRASS_LIGHT);
      p.rect(2, 2, 12, 16, "#3d2c3a");
      p.rect(2, 2, 12, 1, "#4d3a4a");
      if (crest) {
        // A shield with a star.
        p.rect(4, 4, 8, 9, C.ink);
        p.rect(5, 5, 6, 7, C.rug);
        p.rect(6, 12, 4, 1, C.rug);
        p.rect(7, 13, 2, 1, C.ink);
        p.rect(7, 7, 2, 3, BRASS_LIGHT);
        p.rect(6, 8, 4, 1, BRASS_LIGHT);
      } else {
        // A scroll of names.
        p.rect(4, 4, 8, 12, PAPER);
        p.rect(4, 4, 8, 1, C.stoneLight);
        for (let y = 6; y < 15; y += 2) p.rect(5, y, 4 + ((y * 3) % 3), 1, C.stoneDark);
      }
    }),
);

const PLAQUE: { rows: string[]; pal: Palette } = {
  rows: [
    "oooooooooooo",
    "owaaaaaaaabo",
    "oaddddddddbo",
    "oaaaaaaaaabo",
    "oaddddaaabbo",
    "obbbbbbbbbbo",
    "oooooooooooo",
  ],
  pal: { o: C.ink, a: C.flowerYellow, b: BRASS, w: BRASS_LIGHT, d: BRASS_DARK },
};

/** A regular's plaque: a brass nameplate on a wooden post. */
export const plaque = once(() =>
  bake(16, 20, (p) => {
    p.rect(3, 18, 10, 2, C.shadow);
    p.rect(6, 8, 4, 11, C.ink);
    p.rect(7, 8, 2, 10, C.woodDark);
    p.rect(7, 8, 1, 10, C.wood);
    p.rect(1, 0, 14, 10, C.ink);
    p.rect(2, 1, 12, 8, C.woodDark);
    p.grid(PLAQUE.rows, PLAQUE.pal, 2, 1);
  }),
);

/**
 * The face of a regular's plaque: a brass board one tile wide with a 3-letter name a row (the 3×5 font
 * is 4 pixels a letter), the best first. `names` is one string per row; an empty one is a dash.
 */
export const NAMEBOARD_ROW = 6;
export const nameboard = cached(
  (names: string[]) => names.join("|"),
  (names: string[]) => {
    const h = 3 + NAMEBOARD_ROW * names.length;
    return bake(16, h, (p) => {
      p.rect(0, 0, 16, h, C.ink);
      p.rect(1, 1, 14, h - 2, BRASS);
      p.rect(1, 1, 14, 1, BRASS_LIGHT);
      for (const [i, n] of names.entries()) p.text(n || "---", 2, 2 + i * NAMEBOARD_ROW, BRASS_DARK);
    });
  },
);

const CHALK = "#f1ede0";
const CHALK_DIM = "#a9b0b4";
/** Tiles the bar tab runs along the wall. */
export const TAB_TILES = 4;
const TAB_ROW = 6;

/**
 * The bar tab: a slate in a wood frame, `TAB_TILES` wide. `rows` are `[name, hours]` best first (fewer than
 * five leaves dashes); `crown` is the row of last week's winner, who gets a small chalk crown.
 */
export const barTab = cached(
  (rows: [string, string][], crown: number) => `${rows.map((r) => r.join(":")).join("|")}#${crown}`,
  (rows: [string, string][], crown: number) => {
    const w = TAB_TILES * 16;
    const h = 14 + TAB_ROW * 5;
    return bake(w, h, (p) => {
      p.rect(0, 0, w, h, C.ink);
      p.rect(1, 1, w - 2, h - 2, C.woodDark);
      p.rect(2, 2, w - 4, h - 4, "#2f3b3a");
      p.rect(2, 2, w - 4, 1, "#3d4b49");
      p.text("BAR TAB", 4, 4, CHALK);
      p.rect(4, 10, w - 8, 1, CHALK_DIM);
      for (let i = 0; i < 5; i++) {
        const y = 12 + i * TAB_ROW;
        const [name, hours] = rows[i] ?? ["---", ""];
        if (i === crown) {
          // A chalk crown: three points on a band.
          for (const x of [4, 6, 8]) p.px(x, y, CHALK);
          p.rect(4, y + 1, 5, 2, CHALK);
        }
        p.text(name, 11, y, rows[i] ? CHALK : CHALK_DIM);
        p.text(hours, w - 4 - hours.length * 4, y, CHALK_DIM);
      }
    });
  },
);

/** A table top, one tile of a run: `left` and `right` say which ends are the table's own. */
export const table = cached(
  (left: boolean, right: boolean) => `${left}${right}`,
  (left: boolean, right: boolean) =>
    bake(16, 16, (p) => {
      const from = left ? 1 : 0;
      const w = (right ? 15 : 16) - from;
      p.rect(0, 14, 16, 2, C.shadow);
      if (left) p.rect(2, 11, 2, 4, C.woodDark);
      if (right) p.rect(12, 11, 2, 4, C.woodDark);
      p.rect(0, 3, 16, 9, C.ink);
      p.rect(from, 4, w, 6, C.woodLight);
      p.rect(from, 4, w, 1, C.white);
      p.rect(from, 10, w, 1, C.wood);
      p.rect(from, 11, w, 1, C.woodDark);
    }),
);

/** The jukebox on the west wall: a rounded cabinet, a lit window with a record in it, a speaker grille. */
export const jukebox = once(() =>
  bake(16, 22, (p) => {
    p.rect(1, 20, 14, 2, C.shadow);
    // Cabinet and its rounded top.
    p.rect(2, 0, 12, 1, C.ink);
    p.rect(1, 1, 14, 19, C.ink);
    p.rect(2, 1, 12, 18, C.rug);
    p.rect(2, 1, 12, 1, C.rugLight);
    p.rect(2, 18, 12, 1, C.rugDark);
    // The lit window with a record in it.
    p.rect(3, 3, 10, 7, C.ink);
    p.rect(4, 4, 8, 5, "#3a2a5a");
    p.rect(6, 5, 4, 3, C.ink);
    p.rect(7, 6, 2, 1, "#f8c43a");
    p.px(4, 4, "#f2a0b8");
    p.px(11, 4, "#72bf52");
    p.px(4, 8, "#72bf52");
    p.px(11, 8, "#f2a0b8");
    // Speaker grille and a brass coin slot.
    p.rect(3, 11, 10, 5, C.ink);
    for (let x = 4; x < 12; x += 2) p.rect(x, 12, 1, 3, BRASS_DARK);
    p.rect(7, 17, 2, 1, BRASS_LIGHT);
  }),
);
