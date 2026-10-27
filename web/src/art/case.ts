import type { Art } from "./editions.ts";
import { C } from "./palette.ts";

/**
 * The Night Market case's hats and glasses (`core/src/case.ts`), drawn like the merchant's editions
 * (`editions.ts`, which looks these up): hats over the head from row 0, glasses over the eyes from row 5.
 * A grid per view; a missing side or back view is the front one. Keyed by item id.
 */

const o = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_HATS: Record<string, Art> = {
  // Straw kasa: a wide woven cone, ribbed, with a chin cord.
  "hat.200": {
    down: ["......oooo......", "....oossssoo....", "...osSsSsSsSso..", "..osSsSsSsSsSso.", ".oSsSsSsSsSsSsSo", "o.c..........c.o"],
    pal: { o, s: "#e8cd7e", S: "#c29a46", c: "#8a5a2b" },
  },
  // Hachimaki: a white twisted headband with the red sun, knotted at the side, tails hanging.
  "hat.201": {
    down: ["................", "...owwwwwwwwo...", "...owwwrrwwwo...", "....ooooooooRw..", "..............Rw"],
    side: ["................", "...owwwwwwwwo...", "...owwwwrrwwo...", "....ooooooooo...", "..Rw............"],
    pal: { o, w: "#fbf7ef", r: "#d9323a", R: "#d9323a" },
  },
  // Paper fan visor: a headband with a pleated paper fan opened over the brow, red and gold.
  "hat.202": {
    down: [".yrwrwrwrwrwrwy.", "..orwrwrwrwrwo..", "....orwrwrwo....", "...kkkkkkkkkk..."],
    pal: { o, r: "#d9323a", w: "#fbf7ef", y: "#f0c45a", k: "#2f2a3a" },
  },
  // Fox half-mask: a white kitsune mask pushed up on the head, red markings, pointed ears, a pink nose.
  "hat.203": {
    down: ["..oo........oo..", "..orro.oooo.orro", "..orwooooooowro.", "...owrwwwwrwo...", "....owwnnwwo....", ".....ooowwoo...."],
    pal: { o, w: "#fbf7ef", r: "#d9323a", n: "#e8584f" },
  },
};

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_GLASSES: Record<string, Art> = {
  // LED mask: a black visor with a little pixel grin scrolling across a glowing screen.
  "glasses.200": {
    down: ["..oooooooooooo..", "..okpkkkkkkpko..", "..okcpcpcpcpko.."],
    side: ["........ooooo...", "...kkkkkokpkko..", "........okcpco.."],
    pal: { o, k: "#1b1826", p: "#ff4fd8", c: "#4ff3ff" },
  },
  // Steam goggles: two round brass rims with amber lenses, riveted, on a leather strap.
  "glasses.201": {
    down: ["...yyyy..yyyy...", "...yaAyyyyaAy...", "...yyyy..yyyy..."],
    side: ["........yyyy....", "...bbbbbbyaAy...", "........yyyy...."],
    pal: { y: "#c98a3a", a: "#ffd36b", A: "#f0a030", b: "#5a3b22" },
  },
  // Holo shades: sharp wedge lenses that shift from cyan to magenta, with a white glint.
  "glasses.202": {
    down: ["..oooooooooooo..", "..owcmmoowcmmo..", "...occmo..occmo."],
    side: ["........ooooo...", "......oowcmmo...", ".......occmo...."],
    pal: { o, w: "#ffffff", c: "#58f0ff", m: "#c45cff" },
  },
};
