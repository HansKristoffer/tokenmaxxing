import { C } from "./palette.ts";
import type { Pet } from "./pet-base.ts";

/**
 * The Julemarked coin stalls' five pets (core/src/julemarked-shop.ts, pet.900 Gråspurv, 901 Snehare, 902 Pindsvin, 903 Rødt egern, 904 Sælunge), 12×10
 * facing right with two hop frames, like the case's (`case-julemarked-pets.ts`). `pet-base.ts` files them at
 * `STALL_BASE + n`. Frame 1 is the same drawing one pixel up with the feet redone.
 */

const BLANK = "............";

/** Frame 1: everything one row up (the top row must be empty), the feet row replaced by `feet`. */
function hop(f0: string[], feet: string): string[] {
  const rows = [...f0.slice(1), BLANK];
  rows[8] = feet;
  return rows;
}

// Gråspurv: a house sparrow, grey cap, black bib, a chestnut back and a little red scarf with a tail.
// prettier-ignore
const SPARROW: string[] = [
  "............",
  ".....oooo...",
  "....ogggGo..",
  "...oggGewwyy",
  "...oBgwwwoy.",
  "..oBBrrrrro.",
  ".oBBbbRwwbo.",
  "oBBbbbwwwbo.",
  ".ooobbbbboo.",
  "....l..l....",
];

// Snehare: a white winter hare, long ears with pink insides, a cotton tail, a pink nose, soft blue shadows.
// prettier-ignore
const HARE: string[] = [
  ".....ooo.oo.",
  ".....owoowo.",
  ".....opoopo.",
  ".....owwwwo.",
  "....owwwewwo",
  "...owwwwwwnn",
  "owoowwswwwo.",
  "owwowwwswwo.",
  ".ooowwwwwoo.",
  "..oo.oo.oo..",
];

// Pindsvin: a hedgehog, brown spines in two tones over the back, a pale snout with a dark nose, a bright eye.
// prettier-ignore
const HEDGEHOG: string[] = [
  "............",
  "...oooooo...",
  "..oSsSsSso..",
  ".oSsSsSsSsoo",
  ".oSsSsSsSffo",
  "oSsSsSsSsfew",
  "oSsSsSsSffwn",
  "oSsSsSsSsfoo",
  ".ossssssso..",
  "..l.l..l.l..",
];

// Rødt egern: a red squirrel, a big bushy tail curled up behind, ear tufts, a cream chest, a nut-brown nose.
// prettier-ignore
const SQUIRREL: string[] = [
  ".ooo....o.o.",
  "oRRRo...oRoo",
  "oRrRRo.oRRRo",
  "oRrRRoRRRRRo",
  "oRRrRoRRewwn",
  ".oRRRoRRwwwo",
  ".oRRRoRwwwo.",
  "..ooRRoRRwo.",
  "...ooRRRRoo.",
  "....oo.oo...",
];

// Sælunge: a grey seal pup, round and chubby, big dark eyes with a highlight, pale muzzle with whiskers.
// prettier-ignore
const SEAL: string[] = [
  "............",
  ".....oooo...",
  "...ooggggo..",
  "..oggggggggo",
  ".ogGggggehgo",
  ".oggggggeewn",
  "ogggggggwwwo",
  "ogGwwwwwwwo.",
  ".oowwwwwwo..",
  "..ooo..oo.oo",
];

// Pixel art reads as a grid.
// prettier-ignore
export const STALL_PETS: Pet[] = [
  {
    frames: [SPARROW, hop(SPARROW, "....l..l....")],
    pal: { o: C.ink, g: "#9aa0aa", G: "#b8bcc4", B: "#6b4426", b: "#a8703c", w: "#f4ecd8", k: "#3a3036", e: C.ink, y: "#e8a83c", r: "#c8302c", R: "#9a2024", l: "#6b4a30" },
  },
  {
    frames: [HARE, hop(HARE, "..oo.oooo...")],
    pal: { o: C.ink, w: "#f8f6f0", s: "#cfdce8", p: "#e8a0a8", n: "#d98a94", e: C.ink },
  },
  {
    frames: [HEDGEHOG, hop(HEDGEHOG, "..l.l..l.l..")],
    pal: { o: C.ink, S: "#8a5a32", s: "#5e3c22", f: "#f0d8b0", w: "#f8ecd0", e: C.ink, n: "#3a3036", l: "#6b4a30" },
  },
  {
    frames: [SQUIRREL, hop(SQUIRREL, "....oo.oo...")],
    pal: { o: C.ink, R: "#c8602c", r: "#e08a48", w: "#f4e4c8", e: C.ink, n: "#5a3020" },
  },
  {
    frames: [SEAL, hop(SEAL, "..ooo..oo.oo")],
    pal: { o: C.ink, g: "#9aa4b0", G: "#b8c2cc", w: "#eef0f2", h: "#ffffff", e: C.ink, n: "#2a2430" },
  },
];
