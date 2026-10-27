import { CASE_BASE } from "@tokenmaxxing/core/case.ts";
import type { Back, BackView, Held, Outfit } from "./wardrobe.ts";

/**
 * The Night Market case's outfits, held things and back items in 2D (`core/src/case.ts`). Same shapes as the
 * shop's in `wardrobe.ts`, which merges these in under their look indices (`CASE_BASE + n`): the table is
 * sparse, so nothing the shop numbers can land on them.
 */

const at = (n: number) => CASE_BASE + n;

// MARK: Outfits

// Marks sit over the body from row 9; a fourth row lands on the trousers' row (a hem, an apron).
// Pixel art reads as a grid.
// prettier-ignore
export const CASE_OUTFITS: Record<number, Outfit> = {
  // Noodle apron: a white bib over a charcoal tee, a red bowl on the chest and a bow at the back.
  [at(0)]: {
    c: "#3a3f4b", C: "#2a2e38", p: "#2f3444",
    marks: {
      down: ["......a..a......", ".....aayyaa.....", ".....aarraa.....", ".....aaAaaa....."],
      side: ["................", ".......aa.......", ".......aaa......", ".......aaa......"],
      up: ["................", "................", "......aaaa......", ".......aa......."],
    },
    pal: { a: "#f4efe4", A: "#d9d2c0", y: "#f2c94c", r: "#d83a2e" },
  },
  // Happi coat: indigo, white lapels down the front, a rope belt and a ring crest on the back.
  [at(1)]: {
    c: "#2f4a8a", C: "#1f3366", p: "#2a2f45",
    marks: {
      down: ["......w..w......", "......w..w......", "......w..w......", ".....rrrrrr....."],
      side: ["................", ".......w........", ".......w........", ".....rrrrr......"],
      up: ["......wwww......", ".....wwrrww.....", "......wwww......", ".....rrrrrr....."],
    },
    pal: { w: "#f4efe4", r: "#d83a2e" },
  },
  // Cargo bomber: olive, an orange lining at the collar, a zip, flap pockets and a ribbed hem.
  [at(2)]: {
    c: "#6b7a3f", C: "#4d5a2a", p: "#4a4a3a",
    marks: {
      down: [".....O.zz.O.....", "....kk.zz..kk...", ".....hhhhhh.....", "................"],
      side: [".......O........", ".......z.kk.....", "......hhhh......", "................"],
      up: [".....OOOOOO.....", "................", ".....hhhhhh.....", "................"],
    },
    pal: { O: "#f08a3c", z: "#c9c2a6", k: "#3f4a24", h: "#39421f" },
  },
  // Techwear coat: long, black, a neon cyan zip, magenta buckles, a reflective stripe up the back.
  [at(3)]: {
    c: "#23252f", C: "#15161c", p: "#15161c",
    marks: {
      down: ["......n..n......", ".....gmnn.mg....", "......n..n......", ".....cncncc....."],
      side: ["................", ".......n........", ".......g........", "......ccc......."],
      up: ["......nnnn......", "................", "......nnnn......", ".....cccccc....."],
    },
    pal: { n: "#3ff0ff", m: "#ff3fb0", g: "#4a4d5c", c: "#23252f" },
  },
  // Dragon satin jacket: teal-black satin, gold cuffs and collar, a dragon coiled up the back.
  [at(4)]: {
    c: "#18353f", C: "#0f232b", p: "#222a35",
    marks: {
      down: ["....gggggggg....", ".....rg..g......", ".......g........", ".....gggggg....."],
      side: ["................", ".......g........", ".......gG.......", "......gggg......"],
      up: ["....g.gg..g.....", ".....ggGgg......", "......gGgrg.....", ".....gggggg....."],
    },
    pal: { g: "#f2c230", G: "#b8860b", r: "#d83a2e" },
  },
  // Festival parade: red happi, gold sash, a lantern hanging from each shoulder.
  [at(5)]: {
    c: "#d6343a", C: "#9a2128", p: "#f2eadb",
    marks: {
      down: [
        "..k..wwwwww..k..",
        ".lLl.gg..gg.lLl.",
        ".lyl.gggggg.lyl.",
        ".lLl........lLl.",
        "..y..........y..",
      ],
      side: ["..k...ww........", ".lLl..gg........", ".lyl..gg........", ".lLl............", "..y............."],
      up: [
        "..k..wwwwww..k..",
        ".lLl.grrrrg.lLl.",
        ".lyl..gyyg..lyl.",
        ".lLl........lLl.",
        "..y..........y..",
      ],
    },
    pal: { w: "#fbf7ef", g: "#f2c230", y: "#ffe27a", l: "#ff6a3c", L: "#c4261f", k: "#2b2433", r: "#d6343a" },
  },
};

// MARK: In the hand

// `h` is the hand: the item is placed so that it lands on the character's hand (and, past it, within 16 columns).
// Pixel art reads as a grid.
// prettier-ignore
export const CASE_HELD: Record<number, Held> = {
  // Ramen bowl: steam, noodles and an egg over a red-rimmed bowl.
  [at(0)]: {
    rows: ["..s.s..", "..yeey.", ".hrrrrr", "..wbbbw", "...www."],
    pal: { s: "#d8dde3", y: "#f2c94c", e: "#f4efe4", r: "#d83a2e", w: "#f4efe4", b: "#3a6fb8" },
  },
  // Paper umbrella: an open oil-paper wagasa, red with cream stripes narrowing to the tip, a scalloped rim, a long bamboo pole.
  [at(1)]: {
    rows: ["...g...", ".oRwRo.", "owRwRwo", "RwRwRwR", "R.Rb.R.", "...b...", "...h...", "...b...", "..bb..."],
    pal: { R: "#d83a2e", o: "#8f1f18", w: "#f4efe4", b: "#a8743a", g: "#f2c230" },
  },
  // Boombox: a handle to carry it by, two speakers and a neon display.
  [at(2)]: {
    rows: [".mmmhmmm.", "kkkkkkkkk", "gGgkpkgGg", "gGgkrkgGg", "kkkkkkkkk"],
    pal: { m: "#aab3bf", k: "#2b2433", g: "#6a6f7c", G: "#14121a", p: "#ff4fa3", r: "#3ff0ff" },
  },
  // Skateboard: stood on its tail, deck to the front, trucks and wheels at each end.
  [at(3)]: {
    rows: ["y.y", "ddd", "dnd", "hnd", "dnd", "ddd", "y.y"],
    pal: { d: "#ff4fa3", n: "#3ff0ff", y: "#f2c94c" },
  },
};

// MARK: On the back

/** `rows` moved down `dy` rows (or up, if negative), keeping the frame 16 tall. */
const down = (rows: string[], dy: number): string[] => {
  const out = dy >= 0 ? [...Array<string>(dy).fill(""), ...rows] : rows.slice(-dy);
  return out.slice(0, 16);
};

// Rows are full 16×16 frames, top row first; `.` is nothing.
/** A small picture dropped into an empty 16×16 frame at column `x`, row `y`. */
const frame = (art: string[], x: number, y: number): string[] => {
  const out = Array<string>(16).fill("");
  art.forEach((r, i) => {
    out[y + i] = ".".repeat(x) + r;
  });
  return out;
};
// A chunky quad-drone: four lit rotors round a dark body with a pink eye, a pink and cyan underlight. Five wide.
const DRONE_ART = ["cc.cc", "ckkkc", "kkLkk", "ckkkc", "cc.cc", ".pnp."];
const DRONE_ART_B = ["Cc.cC", "CkkkC", "kkLkk", "CkkkC", "Cc.cC", ".npn."];
const DRONE = frame(DRONE_ART, 11, 3);
const DRONE_SIDE = frame(DRONE_ART, 0, 3);
const DRONE_B = frame(DRONE_ART_B, 11, 4);
const DRONE_SIDE_B = frame(DRONE_ART_B, 0, 4);
const LANTERN_BACK: string[] = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  ".......kk.......",
  "....kkkkkkkk....",
  "....oLllllLo....",
  "....oLlyylLo....",
  "....oLlyylLo....",
  "....oLllllLo....",
  "....kkkkkkkk....",
  ".......yy.......",
];
const LANTERN_SIDE: string[] = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "..kk............",
  ".kkkkk..........",
  ".oLlLo..........",
  ".oLyLo..........",
  ".oLyLo..........",
  ".oLlLo..........",
  ".kkkkk..........",
  "..yy............",
];
// A storm cloud over the head (rows 0-2, in front), and neon streaks falling down both sides of it that dim out
// before the shoulders (behind). `shift` slides the streaks down a row for the second frame.
const CLOUD = [".....wwwwww.....", "..vvvvvvvvvvvv..", ".VVpVVVVVVVVpVV."];
const rainBehind = (shift: number): string[] => {
  const rows = Array.from({ length: 16 }, () => Array<string>(16).fill("."));
  for (const x of [1, 14]) for (const y of [2, 3]) rows[y]![x] = y === 2 ? "v" : "V";
  const cols: [number, string, string][] = [
    [1, "n", "N"],
    [2, "p", "P"],
    [13, "n", "N"],
    [14, "p", "P"],
  ];
  cols.forEach(([x, bright, dim], i) => {
    for (let y = 4; y <= 10; y++) {
      if ((y + shift + i * 2) % 3 === 2) continue;
      rows[y]![x] = y <= 7 ? bright : y <= 9 ? dim : ".";
    }
  });
  return rows.map((r) => r.join(""));
};
const rain = (shift: number): BackView => ({
  behind: rainBehind(shift),
  front: [...CLOUD, ...Array<string>(13).fill("")],
});
const view = (front: string[]): BackView => ({ front });

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_BACKS: Record<number, Back> = {
  // Neon drone: hovers over the shoulder, rotors blurring, bobbing a row when they walk.
  [at(0)]: {
    views: { down: view(DRONE), side: view(DRONE_SIDE), up: view(DRONE) },
    walk: { down: view(DRONE_B), side: view(DRONE_SIDE_B), up: view(DRONE_B) },
    pal: { c: "#9fe9ff", C: "#4fb8d8", k: "#2b2f3a", L: "#ff3fb0", p: "#ff3fb0", n: "#3ff0ff" },
  },
  // Paper lantern pack: a glowing lantern on the back, its pole tips showing at the neck.
  [at(1)]: {
    views: {
      down: view(["", "", "", "", "", "", "", "", "....k......k....", ".....s....s....."]),
      side: { behind: LANTERN_SIDE },
      up: view(LANTERN_BACK),
    },
    walk: { side: { behind: LANTERN_SIDE.map((r) => (r ? "." + r.slice(0, 15) : r)) }, up: view(down(LANTERN_BACK, -1)) },
    pal: { k: "#2b2433", o: "#8a2a1c", L: "#c4261f", l: "#ff6a3c", y: "#ffd35c", s: "#a8743a" },
  },
  // Neon rain: a violet storm cloud over the head, neon pink and cyan streaks falling beside it and dimming out.
  [at(2)]: {
    views: { down: rain(0), side: rain(0), up: rain(0) },
    walk: { down: rain(1), side: rain(1), up: rain(1) },
    pal: { w: "#b9a8ff", v: "#7d6bc4", V: "#5a4b86", n: "#3ff0ff", N: "#1f8fa0", p: "#ff4fa3", P: "#a03a78" },
  },
};
