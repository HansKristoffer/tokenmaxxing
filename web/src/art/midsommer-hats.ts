import type { Art } from "./editions.ts";
import { C } from "./palette.ts";

/** Sankt Hans's three hats in 2D. Kept apart from `midsommer.ts` so `editions.ts` can spread them in without a cycle. */
export const DANNEBROG = "#c8102e";
const o = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
/** The three hats (`costumes.ts` 50 to 52), 2D art keyed by item id (`editions.ts` spreads them in). */
export const MIDSOMMER_HAT_ART: Record<string, Art> = {
  // Midsommerkrans: birch leaves round the head with cornflowers, daisies and poppies, a red ribbon behind.
  "hat.250": {
    down: ["................", "....y..r..b.y...", "...lLlrLlLybLl..", "..lLlLllLlLllLl.", "...R..........R."],
    side: ["................", "......y..r.b....", "....lLlLrLyLl...", "...lLlLllLlLlLl.", "..R.............."],
    up: ["................", "....y..r..b.y...", "...lLlrLlLybLl..", "..lLlLllLlLllLl.", "...R.RRRRRR.R..."],
    pal: { l: "#72bf52", L: "#3a7b2f", y: "#f5d14a", r: "#e8584f", b: "#6d9cf0", R: DANNEBROG },
  },
  // Heksehat: a black witch's cone with a straw band and a brass buckle.
  "hat.251": {
    down: [".......oo.......", "......okko......", ".....okkkko.....", "....okSSyySko...", "..okkkkkkkkkkko."],
    side: [".......oo.......", "......okko......", ".....okkkko.....", "....okSSSSSko...", "..okkkkkkkkkkko."],
    pal: { o, k: "#2a2433", S: "#e3c35a", y: "#f5c842" },
  },
  // Strå-hat: a wide straw hat with a Dannebrog ribbon.
  "hat.252": {
    down: ["................", ".....oooooo.....", "....oSSssSSo....", "....orrwrrro....", "..oSSSSSSSSSSSo."],
    side: ["................", ".....oooooo.....", "....oSSssSSSo...", "....orrwrrrro...", "..oSSSSSSSSSSSo."],
    pal: { o, S: "#e8c964", s: "#cfa84a", r: DANNEBROG, w: C.white },
  },
};
