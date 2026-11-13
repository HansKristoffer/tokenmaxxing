import { JULEMARKED_BASE } from "@tokenmaxxing/core/case-julemarked.ts";
import type { Back, BackView, Held, Outfit } from "./wardrobe.ts";

/**
 * The Julemarked case's outfits, held things and back items in 2D (`core/src/case-julemarked.ts`). Same shapes as
 * the Ragnarok Eve's in `case-ragnarok-body.ts`; `wardrobe.ts` merges these in under their look indices
 * (`JULEMARKED_BASE + n`). Design and palette: `docs/cases/julemarked.md`.
 */

const at = (n: number) => JULEMARKED_BASE + n;
const ink = "#2b2433";

// MARK: Outfits

// Marks sit over the body from row 9; a fourth row lands on the trousers' row (a hem, an apron).
// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_OUTFITS: Record<number, Outfit> = {
  // Islandsk sweater: cream wool, a red and green diamond yoke across the shoulders, a ribbed hem.
  [at(0)]: {
    c: "#f4ecd8", C: "#d8cdb0", p: "#4a4a52",
    marks: {
      down: ["....wRRwwRRw....", "....RGGRRGGR....", "....wRRwwRRw....", "....CwCwCwCw...."],
      side: ["....wRRwR.......", "....RGGRG.......", "....wRRwR.......", "....CwCwC......."],
      up: ["....wRRwwRRw....", "....RGGRRGGR....", "....wRRwwRRw....", "....CwCwCwCw...."],
    },
    pal: { w: "#f4ecd8", R: "#b8302c", G: "#2f5d3a", C: "#d8cdb0" },
  },
  // Bagerforklæde: a cream apron over a red shirt, flour smudges, a cinnamon stain, a neck loop and a rope tie.
  [at(1)]: {
    c: "#b8302c", C: "#8e2220", p: "#5a4a3a",
    marks: {
      down: [".....a....a.....", ".....aafaan.....", ".....rrrrrr.....", ".....aaanaa....."],
      side: ["........a.......", ".......aaf......", ".......rrr......", ".......aan......"],
      up: [".....a....a.....", "......a..a......", ".....rrrrrr.....", "................"],
    },
    pal: { a: "#f4ecd8", f: "#ffffff", n: "#8a5a32", r: "#b89a5a" },
  },
  // Nissedragt: grey wool, a red scarf at the collar, cream stripes at the cuffs.
  [at(2)]: {
    c: "#8a8f98", C: "#6c7078", p: "#6c7078",
    marks: {
      down: ["....RRRRRRRR....", ".....RRr........", "....w......w....", "....W......W...."],
      side: ["....RRRRRR......", ".....RRr........", "................", "................"],
      up: ["....RRRRRRRR....", "................", "....w......w....", "....W......W...."],
    },
    pal: { R: "#b8302c", r: "#8e2220", w: "#f4ecd8", W: "#d8cdb0" },
  },
  // Dannebrog-trøje: a red knit with the white Nordic cross on the chest, the long arm to the right.
  [at(3)]: {
    c: "#c8102e", C: "#9c0c24", p: "#4a4a52",
    marks: {
      down: ["......w.........", ".....wwwwww.....", "......w.........", "......w........."],
      side: ["........w.......", "....wwwwww......", "........w.......", "........w......."],
      up: ["................", "................", "................", "....CCCCCCCC...."],
    },
    pal: { w: "#ffffff", C: "#9c0c24" },
  },
  // Julemandsdragt: a plain red coat with a cream fur collar, centre trim and hem, a black belt with a gold buckle.
  [at(4)]: {
    c: "#b8302c", C: "#8e2220", p: "#a82a28",
    marks: {
      down: ["....wwwwwwww....", "....RRRwwRRR....", "....kkkyykkk....", "....wwwwwwww...."],
      side: ["....wwwwwww.....", "....RRRRwR......", "....kkkkyk......", "....wwwwwww....."],
      up: ["....wwwwwwww....", "................", "....kkkkkkkk....", "....wwwwwwww...."],
    },
    pal: { w: "#f4ecd8", R: "#b8302c", k: "#2b2433", y: "#f2c14e" },
  },
  // Lucia-tog: a long white gown, a red sash from shoulder to hip, a little candle in each hand.
  [at(5)]: {
    c: "#f6f2ea", C: "#d8d2c4", p: "#e6e0d2",
    marks: {
      down: ["...y.RR....y....", "...W..RR...W....", "...W...RR..W....", "........RR......"],
      side: ["..........y.....", "....RR....W.....", "......RR..W.....", "........RR......"],
      up: ["...y....RR.y....", "...W...RR..W....", "...W..RR...W....", ".......RR......."],
    },
    pal: { R: "#b8302c", W: "#cbbf9f", y: "#f2c14e" },
  },
};

// MARK: In the hand

// `h` is the hand: the item is placed so that it lands on the character's hand (and, past it, within 16 columns).
// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_HELD: Record<number, Held> = {
  // Gløgg mug: a cream mug with a red band, dark wine with an almond and a raisin on top, two wisps of steam.
  [at(0)]: {
    rows: ["..s.s.", ".ooooo", ".oMaMo", "howwwo", ".orrro", ".owwwo", ".ooooo"],
    pal: { o: ink, w: "#f4ecd8", r: "#b8302c", M: "#5a1f2e", a: "#d9b98a", s: "#e6e9ee" },
  },
  // Brændte mandler: a cream paper cone with a red stripe, glazed brown almonds poking out, a sparkle of sugar.
  [at(1)]: {
    rows: ["..bBbBx", ".obBbBo", "owwwwwo", "orrrrro", "howwwo.", ".orrro.", "..owo..", "...o..."],
    pal: { o: ink, w: "#f4ecd8", r: "#b8302c", b: "#8a5a32", B: "#6b3f22", x: "#ffffff" },
  },
  // Æbleskiver: a plate of five golden puffs dusted with sugar, a dollop of red jam.
  [at(2)]: {
    rows: ["..xg.xg..", ".ggGggGg.", ".gGgjgGg.", "hoooooooo", ".owwwwwo."],
    pal: { o: ink, w: "#f4ecd8", g: "#d49a3a", G: "#a8702a", x: "#ffffff", j: "#b8302c" },
  },
  // Pebernød tin: a round red tin with a white lid and a hearts and stars band, a few pepper nuts spilling.
  [at(3)]: {
    rows: ["..oooo..", ".owwwwo.", ".oRRRRo.", "hoRwRwoN", ".oRRRRoN", ".oRRRRo.", "..oooo.."],
    pal: { o: ink, w: "#f4ecd8", R: "#b8302c", N: "#6b3f22" },
  },
  // Flæskestegssandwich: a bun half out of its paper, pink pork, amber crackling, a dot of red cabbage.
  [at(4)]: {
    rows: ["..oBBBo.", ".oBBBBBo", ".opppyyo", "hopmppyo", ".oBBBBBo", ".owwwwwo", ".owRwwwo", "..ooooo."],
    pal: { o: ink, B: "#c98a4a", p: "#e8a6a0", y: "#d9a031", m: "#7a2f5a", w: "#f4ecd8", R: "#b8302c" },
  },
};

// MARK: On the back

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
const view = (front: string[]): BackView => ({ front });

// Gavesæk: a round wood-brown sack tied with a red cord, a gift corner peeking out the top.
const SACK_UP = frameAt(
  [
    ".....oGGRo......",
    "....oGRGRGo.....",
    "....ooRRRoo.....",
    "...obbbRbbbo....",
    "..obBbbbbbbbo...",
    "..obbbBbbbBbo...",
    "..obbbbbbbbbo...",
    "...obBbbbbbo....",
    "....ooooooo.....",
  ],
  6,
);
const SACK_SIDE = frameAt(
  [
    "...oGGRo........",
    "..oGRGRGo.......",
    "..ooRRRoo.......",
    ".obbbRbbbo......",
    "obBbbbbbbbo.....",
    "obbbBbbbbbo.....",
    "obbbbbbbbbo.....",
    ".obBbbbbbo......",
    "..ooooooo.......",
  ],
  6,
);
const SACK_DOWN = frameAt([".....o....o.....", "....oRo..oRo....", ".....o....o....."], 8);

// Julehjerte-vinger: two wings of woven paper hearts, red and white, three to a wing; they flutter as you walk.
const WING_L = [".owRwo", ".oRwRo", "..oRo.", "owRwo.", "oRwRo.", ".oRo..", ".owRwo", ".oRwRo", "..oRo."];
/** The right wing is the left one mirrored. */
const flip = (r: string) => [...r].reverse().join("");
const WINGS = (up: boolean): string[] =>
  frameAt(
    WING_L.map((l) => `${l}....${flip(l)}`.padEnd(16, ".")),
    up ? 4 : 5,
  );
const WINGS_SIDE = (up: boolean): string[] => frameAt(WING_L.map((l) => `..${l}`.padEnd(16, ".")), up ? 4 : 5);

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_BACKS: Record<number, Back> = {
  // Gavesæk: the sack over one shoulder, its cord showing from the front.
  [at(0)]: {
    views: {
      down: { front: SACK_DOWN },
      side: { behind: SACK_SIDE },
      up: view(SACK_UP),
    },
    pal: { o: ink, b: "#a06a3c", B: "#7e4f2a", R: "#b8302c", G: "#2f5d3a" },
  },
  // Julehjerte-vinger: woven paper hearts folded into wings, fluttering.
  [at(1)]: {
    views: {
      down: { behind: WINGS(false) },
      side: { behind: WINGS_SIDE(false) },
      up: view(WINGS(false)),
    },
    walk: { down: { behind: WINGS(true) }, side: { behind: WINGS_SIDE(true) }, up: view(WINGS(true)) },
    pal: { o: ink, R: "#b8302c", w: "#f4ecd8" },
  },
};
