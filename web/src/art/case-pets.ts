import { C } from "./palette.ts";
import type { Pet } from "./pet-base.ts";

/**
 * The Night Market case's pets (core/src/case.ts, pet.200 to pet.205), 12×10 facing right with two hop frames,
 * like the shop's. `pet-base.ts` files them at `CASE_BASE + n` in `PETS`.
 */

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_PETS: Pet[] = [
  // Koi: white, orange and black, swimming through the air.
  {
    frames: [
      ["............", "....ooo.....", "o..orrkwo...", "oro.rrwwwoo.", "orrowwwwwewo", "oro.wrrwwwo.", "o..owwkwwo..", "....oooooo..", "............", "............"],
      ["....ooo.....", "oo.orrkwo...", "orrorrwwwoo.", "orowwwwwewo.", "oo.wrrwwwo..", "...owwkwwo..", "....oooooo..", "............", "............", "............"],
    ],
    pal: { o: C.ink, w: "#fbf6ee", r: "#ff7a2a", k: "#241f2b", e: C.ink },
  },
  // Paper crane: folded white, a red beak and tail tip, wings up and down.
  {
    frames: [
      ["........oo..", ".o.....owro.", "owo...owwo..", "owwo..owo...", ".owwoowwo...", "..owwwwwoo..", "...owswwwwo.", "....owwso.r.", ".....ooo.oro", "............"],
      ["............", "........oo..", ".......owro.", "o.....owwo..", "ooo..owwo...", "owwwoowwo...", ".owswwwwwoo.", "..oowwwswwoR", "....owwwo.r.", ".....ooo...."],
    ],
    pal: { o: C.ink, w: "#fbf8f2", s: "#c9cfdc", r: "#e0405a", R: "#e0405a" },
  },
  // Tanuki pup: a round brown pup, a leaf on its head, a dark mask over its eyes.
  {
    frames: [
      ["......gg....", ".....gGgg...", "....odbbbdo.", "....obbbbbo.", "...oobddbddo", ".oobbbbcnco.", "dobbccbbbbo.", "dobbccbbbbo.", ".oobbbbbboo.", "..dd..dd...."],
      [".....gg.....", "....gGgg....", "....odbbbdo.", "....obbbbbo.", "...oobddbddo", ".oobbbbcnco.", "dobbccbbbbo.", "dobbccbbbbo.", ".oobbbbbboo.", ".dd....dd..."],
    ],
    pal: { o: C.ink, b: "#8d7a68", d: "#3b2f2a", c: "#e6d5b5", n: C.ink, g: "#5cc16a", G: "#34843f" },
  },
  // Maneki cat: white, a red collar and gold bell, one paw up and waving, a coin in the other.
  {
    frames: [
      ["ww....p..p..", "ww...owwwwo.", "owo..owewewo", "owwo..owpwo.", ".owoorrrroo.", "..owwwwygwo.", "..owwwwwgwo.", "..owwwwwwwo.", "...owwwwwo..", "...oo...oo.."],
      ["......p..p..", "ww...owwwwo.", "ww...owewewo", "owo...owpwo.", "owwoorrrroo.", "..owwwwygwo.", "..owwwwwgwo.", "..owwwwwwwo.", "...owwwwwo..", "...oo...oo.."],
    ],
    pal: { o: C.ink, w: "#fbf8f2", p: "#f2a0b0", e: C.ink, r: "#d6303a", y: "#f5c842", g: "#e8b030" },
  },
  // Kitsune: an orange fox, a fan of tails each ending in a glowing lantern.
  {
    frames: [
      ["L.L.L.L....o", "t.t.t.t..o.o", "tt.tt.tt.ooo", ".ttttttooxxo", "..tttooxxxxn", "..otooxxexo.", "..otoxxxxxo.", "..otttxxxxo.", "...o.o.o.o..", "............"],
      [".L.L.L.L...o", "t.t.t.t..o.o", ".tt.tt.t.ooo", ".ttttttooxxo", "..tttooxxxxn", "..otooxxexo.", "..otoxxxxxo.", "..otttxxxxo.", "...o.o.o.o..", "............"],
    ],
    pal: { o: C.ink, x: "#ff9a3c", t: "#f08a30", L: "#ffd766", e: C.ink, n: C.ink },
  },
  // Tengu: red face, a long nose, black wings and a little hat, hovering at the shoulder.
  {
    frames: [
      ["....kk..hh..", "...kkk.hhhh.", "..kkkkoRRRRo", ".kkkkkoReRnn", ".kkkkkoRRRRo", "..kkkkkddo..", "...kkkddddk.", "....kkddddk.", ".....kyokyo.", "............"],
      ["............", "....kk.hh...", "..kkkkhhhhRo", "...kkkoReRnn", "..kkkkoRRRRo", ".kkkkkkddo..", ".kkkkkddddk.", "..kkkkddddk.", "....kkyokyo.", "............"],
    ],
    pal: { o: C.ink, k: "#2a2b3d", h: "#1a1822", R: "#d8362f", e: C.white, n: "#a82a24", d: "#4a4a63", y: "#f5c842" },
  },
];
