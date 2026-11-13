import { STALL_BASE } from "@tokenmaxxing/core/julemarked-shop.ts";
import type { Art } from "./editions.ts";
import { C } from "./palette.ts";
import type { Back, Held, Outfit } from "./wardrobe.ts";

/**
 * The Julemarked coin stalls' wearables in 2D (`core/src/julemarked-shop.ts`, look indices from `STALL_BASE`): the
 * Øreværmere hat, the Strikket sæt and Uldfrakke outfits, and the five treats held in the hand. Same shapes as
 * the case's (`case-julemarked.ts`, `case-julemarked-body.ts`); `case.ts` and `wardrobe.ts` merge them in.
 * Hygge and wool: the palette is the case's (`docs/cases/julemarked.md`).
 */

const at = (n: number) => STALL_BASE + n;
const o = C.ink;
const ink = "#2b2433";

// MARK: Hat

// Pixel art reads as a grid.
// prettier-ignore
export const STALL_HATS: Record<string, Art> = {
  // Øreværmere: a thin dark band over the crown and a fluffy cream wool muff on each ear.
  [`hat.${at(0)}`]: {
    down: [
      "....oooooooo....",
      "...oKKKKKKKKo...",
      "..oKo......oKo..",
      "..oKo......oKo..",
      ".owwwo....owwwo.",
      ".owWwo....owWwo.",
      ".owwwo....owwwo.",
      "..ooo......ooo..",
    ],
    side: [
      "....oooooooo....",
      "...oKKKKKKKKo...",
      "...oKo..........",
      "...owwo.........",
      "...owWwo........",
      "...owwwo........",
      "....ooo.........",
      "................",
    ],
    up: [
      "....oooooooo....",
      "...oKKKKKKKKo...",
      "..oKo......oKo..",
      "..oKo......oKo..",
      ".owwwo....owwwo.",
      ".owWwo....owWwo.",
      ".owwwo....owwwo.",
      "..ooo......ooo..",
    ],
    pal: { o, K: "#6b3f22", w: "#f4ecd8", W: "#d8cdb0" },
  },
  // Pelshue: a grey-brown fur trapper hat, a pale fur band over the brow, the flaps down over the ears.
  [`hat.${at(1)}`]: {
    down: [
      "....oooooooo....",
      "...oFfFFfFFFo...",
      "..oFFfFFFfFFFo..",
      "..oTTTTTTTTTTo..",
      ".oFFFo....oFFFo.",
      ".oFfFo....oFfFo.",
      ".oTTTo....oTTTo.",
      "..ooo......ooo..",
    ],
    side: [
      "....oooooooo....",
      "...oFfFFfFFFo...",
      "..oFFfFFFfFFFTo.",
      "..oFFFFFFFFTTTo.",
      "...oFFFo..oTTo..",
      "...oFFFo........",
      "...oFfFo........",
      "....ooo.........",
    ],
    up: [
      "....oooooooo....",
      "...oFfFFfFFFo...",
      "..oFFfFFFfFFFo..",
      "..oFFFfFFFfFFo..",
      ".oFFFo....oFFFo.",
      ".oFfFo....oFfFo.",
      ".oTTTo....oTTTo.",
      "..ooo......ooo..",
    ],
    pal: { o, F: "#7a6552", f: "#5e4c3c", T: "#e8dcc4" },
  },
  // Sixpence: a flat wool tweed cap, puffed over a short stiff brim, a dark band.
  [`hat.${at(2)}`]: {
    down: [
      "....oooooooo....",
      "...oGGgGGgGGo...",
      "..oGgGGgGGgGGo..",
      "..oGGgGGgGGgGo..",
      "..oKKKKKKKKKKo..",
      "...oooooooooo...",
    ],
    side: [
      "....oooooooo....",
      "...oGGgGGgGGo...",
      "..oGgGGgGGgGGoo.",
      "..oGGgGGgGGgGKKo",
      "..oKKKKKKKKKKKo.",
      "...ooooooooooo..",
    ],
    up: [
      "....oooooooo....",
      "...oGGgGGgGGo...",
      "..oGgGGgGGgGGo..",
      "..oGGgGGgGGgGo..",
      "..oKKKKKKKKKKo..",
      "...oooooooooo...",
    ],
    pal: { o, G: "#7d766a", g: "#5c564d", K: "#3a342e" },
  },
};

// MARK: Outfits

// Marks sit over the body from row 9; a fourth row lands on the trousers' row (a hem).
// Pixel art reads as a grid.
// prettier-ignore
export const STALL_OUTFITS: Record<number, Outfit> = {
  // Strikket sæt: a forest green knit jumper with a cream stripe, a chunky red and cream scarf, red mittens with cream cuffs.
  [at(0)]: {
    c: "#2f5d3a", C: "#234a2d", p: "#4a4a52",
    marks: {
      down: ["...RwRwRwRwR....", "....RwRR.wRR....", "....w......w....", "....R......R...."],
      side: ["....RwRwRwR.....", ".....RwRR.......", "........w.......", "........R......."],
      up: ["....RwRwRwRw....", "....wRwRwRwR....", "....w......w....", "....R......R...."],
    },
    pal: { R: "#b8302c", w: "#f4ecd8" },
  },
  // Uldfrakke: a long camel wool coat, wide dark lapels, a cream shirt collar, two rows of horn buttons, a hem past the hip.
  [at(1)]: {
    c: "#a8896a", C: "#86694d", p: "#3a3a44",
    marks: {
      down: ["....DwwDDwwD....", "....DDbDDbDD....", "....CDbDDbDC....", "....CCCCCCCC...."],
      side: ["....DwwDD.......", "....DDbDD.......", "....CDbDC.......", "....CCCCC......."],
      up: ["....DDDDDDDD....", "................", "................", "....CCCCCCCC...."],
    },
    pal: { D: "#5e4630", C: "#86694d", w: "#f4ecd8", b: "#3a2a1e" },
  },
  // Gul regnjakke: a yellow Danish raincoat, the hood bunched at the neck on cream cords, two pocket flaps, snaps, a dark hem.
  [at(2)]: {
    c: "#f2c230", C: "#c8961a", p: "#3a3a44",
    marks: {
      down: ["...HhHHHHHHhH...", "....Hh.ww.hH....", "....CC.bb.CC....", "....CCCCCCCC...."],
      side: ["....HHHHH.......", "....HhHH........", "....CCb.........", "....CCCCC......."],
      up: ["...HhHHHHHHhH...", "....HHHHHHHH....", "................", "....CCCCCCCC...."],
    },
    pal: { H: "#d9a41c", h: "#a87a10", C: "#c8961a", w: "#f4ecd8", b: "#3a3a44" },
  },
  // Flonelsskjorte: a red and black buffalo plaid flannel, a dark collar, cream buttons down the placket.
  [at(3)]: {
    c: "#b8302c", C: "#8e2220", p: "#3a3a44",
    marks: {
      down: ["....kkRRkkRR....", "....kkRwkkRR....", "....RRkkRRkk....", "....RRkwRRkk...."],
      side: ["....kkRRk.......", "....kkRRk.......", "....RRkkR.......", "....RRkkR......."],
      up: ["....kkRRkkRR....", "....kkRRkkRR....", "....RRkkRRkk....", "....RRkkRRkk...."],
    },
    pal: { k: "#1f1a1e", R: "#8e2220", w: "#f4ecd8" },
  },
};

// MARK: In the hand

// `h` is the hand: the item is placed so that it lands on the character's hand (and, past it, within 16 columns).
// Pixel art reads as a grid.
// prettier-ignore
export const STALL_HELD: Record<number, Held> = {
  // Varm kakao: a green mug, dark cocoa under a swirl of cream, a pinch of cinnamon, two wisps of steam.
  [at(0)]: {
    rows: ["..s.s.", ".owWwo", ".ocCco", "hoGGGo", ".oGwGo", ".oGGGo", ".ooooo"],
    pal: { o: ink, w: "#f4ecd8", W: "#ffffff", c: "#6b3f22", C: "#8a5a32", G: "#2f5d3a", s: "#e6e9ee" },
  },
  // Klejner: three twisted fried pastries with a slit and a knot, golden, sugar dusted, on a paper napkin.
  [at(1)]: {
    rows: ["..oo.oo..", ".ogGoGgo.", "ogxgGgxgo", ".ogGoGgo.", "hoooooooo", ".orwrwro."],
    pal: { o: ink, g: "#d49a3a", G: "#a8702a", x: "#ffffff", w: "#f4ecd8", r: "#b8302c" },
  },
  // Risengrød med smør: a cream bowl with a red band, white porridge, a butter eye, cinnamon and steam.
  [at(2)]: {
    rows: ["..s.s....", ".ooooooo.", "owwyywwwo", "owcywcwwo", "howwwwwwo", ".orrrrro.", "..ooooo.."],
    pal: { o: ink, w: "#f4ecd8", y: "#f2c14e", c: "#8a5a32", r: "#b8302c", s: "#e6e9ee" },
  },
  // Marcipanbrød: a loaf, dark chocolate over marzipan, a thin slice cut off and leaning on it.
  [at(3)]: {
    rows: [".ooooooo.", "obbbbbbbo", "obBbbBbbo", "hoMMMMMMo", "oMMmMMmMo", ".ooooooo."],
    pal: { o: ink, b: "#6b3f22", B: "#8a5a32", M: "#e0cf9a", m: "#c9b57a" },
  },
  // Sukkerstang: a red and white striped stick with a crook at the top, a red bow.
  [at(4)]: {
    rows: [".oooooo..", "oRwRwRRo.", "owRoooowo", "oRwo...oo", "owRo.....", "hRwo.....", "oRwo.....", "owRo.....", ".ooo....."],
    pal: { o: ink, R: "#c8102e", w: "#ffffff" },
  },
};

// MARK: Glasses

// Over the eyes from row 5; the first row of a grid is row 5.
// Pixel art reads as a grid.
// prettier-ignore
export const STALL_GLASSES: Record<string, Art> = {
  // Skibriller: mirrored blue lenses in a bright orange frame, on a dark strap round the head.
  [`glasses.${at(0)}`]: {
    down: ["...OOOOOOOOOO...", "..kOWMMOOWMMOk..", "...OOOOOOOOOO..."],
    side: [".........OOOO...", "...kkkkkkOWMO...", ".........OOOO..."],
    pal: { O: "#e8702a", W: "#ffffff", M: "#6fb6e0", k: "#2b2433" },
  },
  // Hyggebriller: big round tortoiseshell specs, a pale lens with a glint.
  [`glasses.${at(1)}`]: {
    down: ["..tTtTt..tTtTt..", "..tLLLtkktLLLt..", "..tLWLt..tLWLt..", "..tTtTt..tTtTt.."],
    side: ["........tTtTt...", ".....tttttLLLt..", "........tLWLt...", "........tTtTt..."],
    pal: { t: "#6b3a1c", T: "#c98a3a", L: "#e4f1f4", W: "#ffffff", k: "#6b3a1c" },
  },
};

// MARK: On the back

/** An empty 16x16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];

// Pixel art reads as a grid.
// prettier-ignore
const SKIS_UP = [
  "", "", "", "", "",
  ".oRRo......oBBo.",
  "..oRRo....oBBo..",
  "...oRRo..oBBo...",
  "....oRRooBBo....",
  ".....oRRBBo.....",
  "......oBBo......",
  ".....oBBRRo.....",
  "....oBBooRRo....",
  "...oBBo..oRRo...",
  "..oBBo....oRRo..",
  ".oBBo......oRRo.",
];
// prettier-ignore
const SKIS_SIDE = [
  "", "", "", "", "",
  "oBBoRRo.........",
  "oBBoRRo.........",
  ".oBBRRo.........",
  ".oBBRo..........",
  ".oBBRo..........",
  "..oBBo..........",
  "..oBBo..........",
  "..oBBo..........",
  ".oRBBo..........",
  ".oRRBBo.........",
  ".oRRBBo.........",
];
// prettier-ignore
const BLANKET = (rows: string[]) => frameAt(rows, 8);

// Pixel art reads as a grid.
// prettier-ignore
export const STALL_BACKS: Record<number, Back> = {
  // Hyggetæppe: a red, green and cream plaid blanket knotted at the neck, hanging as a cape with a fringe.
  [at(0)]: {
    views: {
      down: {
        behind: BLANKET([
          "................",
          "...oo......oo...",
          "..oRG......GRo..",
          "..oGG......GGo..",
          "..owR......Rwo..",
          "..oGG......GGo..",
          "...oRGwRRwGRo...",
          "....fofofofof...",
        ]),
        front: frameAt(["..oRwRo....oRwRo"], 9),
      },
      side: {
        behind: BLANKET([
          "................",
          ".....o..........",
          "....oR..........",
          "...oRG..........",
          "..oRwG..........",
          "..oGGR..........",
          ".oGwRR..........",
          ".fofofo.........",
        ]),
        front: frameAt(["......wR"], 9),
      },
      up: {
        front: BLANKET([
          "....oooooooo....",
          "...oRRGRRGRRo...",
          "...oGGGGGGGGo...",
          "...owRwRwRwRo...",
          "...oGGGGGGGGo...",
          "...oRRGRRGRRo...",
          "...oGGGGGGGGo...",
          "...fofofofofof..",
        ]),
      },
    },
    walk: {
      side: {
        behind: BLANKET([
          "................",
          ".....o..........",
          "...ooR..........",
          "..oRRG..........",
          ".oRwwG..........",
          "oGGGR...........",
          "oGwRR...........",
          "fofofo..........",
        ]),
        front: frameAt(["......wR"], 9),
      },
    },
    pal: { o, R: "#b8302c", G: "#2f5d3a", w: "#f4ecd8", f: "#e6dcc0" },
  },
  // Ski: a red and a blue ski crossed over the back on a brown strap, the tips up over the shoulders.
  [at(1)]: {
    views: {
      down: { behind: SKIS_UP, front: frameAt(["...s............", "....s...........", ".....s..........", "......ss........", ".......ss.......", ".........s......"], 9) },
      side: { behind: SKIS_SIDE },
      up: { front: SKIS_UP },
    },
    pal: { o, R: "#c8352f", B: "#2f6fb0", s: "#6b3f22" },
  },
};

// MARK: In the hand (second batch)

// Pixel art reads as a grid.
// prettier-ignore
export const STALL_HELD_MORE: Record<number, Held> = {
  // Termokande: a steel flask, a red cup on top, a dent and a dark band.
  [at(5)]: {
    rows: ["..ooo..", ".oRRRo.", ".oSwso.", "hoSwSso", ".oSSsso", ".okkkko", ".ooooo."],
    pal: { o: ink, R: "#c8352f", S: "#b8c2cc", s: "#8a96a3", w: "#ffffff", k: "#3a4452" },
  },
  // Fyrfadslys: a tea light in a little glass, a tiny flame.
  [at(6)]: {
    rows: ["...Y...", "..yYy..", "..yYy..", "..owo..", ".oWwWo.", "hoWwWo.", ".oWWWo.", "..ooo.."],
    pal: { o: ink, Y: "#fff2a0", y: "#f2a83a", w: "#f4ecd8", W: "#bcd9e6" },
  },
};
Object.assign(STALL_HELD, STALL_HELD_MORE);
