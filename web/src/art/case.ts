import { RAGNAROK_GLASSES, RAGNAROK_HATS } from "./case-ragnarok.ts";
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
  "hat.300": {
    down: ["......oooo......", "....oossssoo....", "...osSsSsSsSso..", "..osSsSsSsSsSso.", ".oSsSsSsSsSsSsSo", "o.c..........c.o"],
    pal: { o, s: "#e8cd7e", S: "#c29a46", c: "#8a5a2b" },
  },
  // Hachimaki: a white twisted headband with the red sun, knotted at the side, tails hanging.
  "hat.301": {
    down: ["................", "...owwwwwwwwo...", "...owwwrrwwwo...", "....ooooooooRw..", "..............Rw"],
    side: ["................", "...owwwwwwwwo...", "...owwwwrrwwo...", "....ooooooooo...", "..Rw............"],
    pal: { o, w: "#fbf7ef", r: "#d9323a", R: "#d9323a" },
  },
  // Paper fan visor: a folding fan opened into a half-circle of red and white pleats, gold rim and pivot, over a headband.
  "hat.302": {
    down: ["....oyyyyyyo....", "..oyrwrwrwrwyo..", ".oywrwrwrwrwryo.", "...orwryywrwo...", "...kkkkkkkkkk..."],
    side: ["......oyyo......", ".....oyrwro.....", "....oyrwrwro....", "....oorwyyrwoo..", "....kkkkkkkk...."],
    pal: { o, r: "#d9323a", w: "#fbf7ef", y: "#f0c45a", k: "#2f2a3a" },
  },
  // Fox half-mask: a white kitsune mask pushed up on the brow, pointed ears with red insides, red cheek stripes,
  // black eye slits and nose tip, tied on with a red cord.
  "hat.303": {
    down: ["..oo........oo..", "..orro....orro..", "..orwoooooowro..", ".rrowkwwwwkwor..", "..owrwwwwwwrwo..", "...owrwkkwrwo..."],
    side: [".....oo..oo.....", "....orro.orro...", "....orwoooowro..", "..rrowwwwwkwwo..", "....owwwwwwrwo..", ".....owwwrwkko.."],
    pal: { o, w: "#fbf7ef", r: "#d9323a", k: "#14121a" },
  },
};

// Pixel art reads as a grid.
// prettier-ignore
export const CASE_GLASSES: Record<string, Art> = {
  // LED mask: a black visor with a little pixel grin scrolling across a glowing screen.
  "glasses.300": {
    down: ["..oooooooooooo..", "..okpkkkkkkpko..", "..okcpcpcpcpko.."],
    side: ["........ooooo...", "...kkkkkokpkko..", "........okcpco.."],
    pal: { o, k: "#1b1826", p: "#ff4fd8", c: "#4ff3ff" },
  },
  // Steam goggles: two round brass rims with amber lenses, riveted, on a leather strap.
  "glasses.301": {
    down: ["...yyyy..yyyy...", "...yaAyyyyaAy...", "...yyyy..yyyy..."],
    side: ["........yyyy....", "...bbbbbbyaAy...", "........yyyy...."],
    pal: { y: "#c98a3a", a: "#ffd36b", A: "#f0a030", b: "#5a3b22" },
  },
  // Holo shades: sharp wedge lenses that shift from cyan to magenta, with a white glint.
  "glasses.302": {
    down: ["..oooooooooooo..", "..owcmmoowcmmo..", "...occmo..occmo."],
    side: ["........ooooo...", "......oowcmmo...", ".......occmo...."],
    pal: { o, w: "#ffffff", c: "#58f0ff", m: "#c45cff" },
  },
};

// Ragnarok Eve (`case-ragnarok.ts`) is filed beside the Night Market's; item ids never overlap.
Object.assign(CASE_HATS, RAGNAROK_HATS);
Object.assign(CASE_GLASSES, RAGNAROK_GLASSES);
