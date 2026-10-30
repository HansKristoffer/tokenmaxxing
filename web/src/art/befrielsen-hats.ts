import type { Art } from "./editions.ts";
import { C } from "./palette.ts";

/**
 * Befrielsen's two hats (`core/src/costumes.ts`, `hat.265` and `hat.266`), in `editions.ts`'s grid form. Kept apart
 * from `befrielsen.ts` (which draws characters) so `editions.ts` can import them without a cycle.
 */
const o = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
/** The veteran's flat cap: grey tweed, a short brim to the front. */
export const FLAT_CAP: Art = {
  down: ["................", "....oooooooo....", "...otcctcctco...", "..octcctcctcco..", ".oCCCCCCCCCCCCo.", "..oBBBBBBBBBBo.."],
  side: ["................", "....oooooooo....", "...otcctcctcco..", "..octcctcctccco.", "..oCCCCCCCCCCBBo", "...oBBBBBBBBBBo."],
  up: ["................", "....oooooooo....", "...otcctcctco...", "..octcctcctcco..", ".oCCCCCCCCCCCCo.", "..oCCCCCCCCCCo.."],
  pal: { o, c: "#7b7f88", t: "#9a9ea6", C: "#5d616a", B: "#3f4249" },
};

// Pixel art reads as a grid.
// prettier-ignore
/** The window candle: a lit candle on a china saucer. */
export const CANDLE_HAT: Art = {
  down: [".......y........", ".......Y........", "......owwo......", "......owwo......", "...oBBBBBBBBo...", "....oooooooo...."],
  pal: { o, y: "#fff3b0", Y: "#ffd45a", w: "#f4efe4", B: "#cfd9ee" },
};
