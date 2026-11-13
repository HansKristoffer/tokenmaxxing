import type { Art } from "./editions.ts";
import { C } from "./palette.ts";

/**
 * The Julemarked case's hats and glasses (`core/src/case-julemarked.ts`, indices 800 up), drawn like the Ragnarok
 * Eve's (`case-ragnarok.ts`, which `case.ts` merges in beside these): hats over the head from row 0, glasses over
 * the eyes from row 5. A grid per view; a missing side or back view is the front one. Keyed by item id.
 * Design and palette: `docs/cases/julemarked.md`.
 */

const o = C.ink;
// Nisse red, shade, cream, cream shade, forest green, lighter needle, candle gold.
const jul = { R: "#b8302c", r: "#8e2220", w: "#f4ecd8", W: "#d8cdb0", G: "#2f5d3a", g: "#487f52", y: "#f2c14e" };

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_HATS: Record<string, Art> = {
  // Nissehue: a tall red cone that slumps over to one side, a cream fold at the brim.
  "hat.800": {
    down: [
      ".........oo.....",
      "........oRRoo...",
      ".......oRRRRRo..",
      "....oooRRRRrRo..",
      "...oRRRRRRRRRro.",
      "...owwwwwwwwwwo.",
    ],
    side: [
      "......ooo.......",
      ".....oRRRoo.....",
      "....oRRRRRRoo...",
      "..ooRRRRRRRRRo..",
      ".oRRRRRRRRRRro..",
      ".owwwwwwwwwwwo..",
    ],
    up: [
      ".........oo.....",
      "........oRRoo...",
      ".......oRRRRRo..",
      "....oooRRRRrRo..",
      "...oRRRRRRRRRro.",
      "...owwwwwwwwwwo.",
    ],
    pal: { o, ...jul },
  },
  // Pomponhue: a cream and red knitted beanie, ribbed band, a big pompom.
  "hat.801": {
    down: [
      "......oooo......",
      ".....owwwwo.....",
      ".....owwWwo.....",
      "....ooRRRRoo....",
      "...oRrRrRrRro...",
      "...owWwWwWwWwo..",
    ],
    side: [
      ".....oooo.......",
      "....owwwwo......",
      "....owwWwo......",
      "...ooRRRRRoo....",
      "..oRrRrRrRrRo...",
      "..owWwWwWwWwo...",
    ],
    up: [
      "......oooo......",
      ".....owwwwo.....",
      ".....owwWwo.....",
      "....ooRRRRoo....",
      "...oRrRrRrRro...",
      "...owWwWwWwWwo..",
    ],
    pal: { o, ...jul },
  },
  // Grankrans: a ring of pine needles with a few gold berries and a red bow at one side.
  "hat.802": {
    down: [
      "....oooooooo....",
      "..ooGgGGgGGgoo..",
      "..oGgyGGgGyGGRo.",
      "..oGGgGoooGGRRRo",
      "..ooGGo....oRoRo",
      "...oo.......oo..",
    ],
    side: [
      "....ooooooo.....",
      "..ooGgGGgGGoo...",
      "..oGgyGGgGyGGRo.",
      "..oGGgGGgGGRRRRo",
      "...ooGGGGoooRoRo",
      "....ooooo....oo.",
    ],
    up: [
      "....oooooooo....",
      "..ooGgGGgGGgoo..",
      "..oGgyGGgGyGGGo.",
      "..oGGgGGgGGgGGo.",
      "..ooGGgGGgGGgoo.",
      "...oooooooooo...",
    ],
    pal: { o, ...jul },
  },
  // Lucia-krone: a leaf ring with three candles, each with a gold flame. Cartoon flames.
  "hat.803": {
    down: [
      "....y...y...y...",
      "....y...y...y...",
      "...owo.owo.owo..",
      "...owo.owo.owo..",
      "..ooGgGGgGGgGoo.",
      "..oGGgGGgGgGGGo.",
      "...oooooooooooo.",
    ],
    side: [
      "......y...y.....",
      "......y...y.....",
      ".....owo.owo....",
      ".....owo.owo....",
      "...ooGgGGgGGoo..",
      "...oGGgGGgGGGo..",
      "....ooooooooo...",
    ],
    up: [
      "....y...y...y...",
      "....y...y...y...",
      "...owo.owo.owo..",
      "...owo.owo.owo..",
      "..ooGgGGgGGgGoo.",
      "..oGGgGGgGgGGGo.",
      "...oooooooooooo.",
    ],
    pal: { o, ...jul },
  },
};

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_GLASSES: Record<string, Art> = {
  // Kolde kinder: two soft rose stripes of cold cheek, no frame.
  "glasses.800": {
    down: ["................", "...pP......Pp...", "..pPp......pPp.."],
    side: ["................", "........pPp.....", ".......pPpP....."],
    pal: { p: "#e8918f", P: "#f2b3ae" },
  },
  // Julelys-briller: round frames of tiny fairy-light bulbs in red, gold and green.
  "glasses.801": {
    down: ["....RY....GR....", "...G..RooY..G...", "....GY....RG...."],
    side: ["..........RY....", "...ooooo.G..R...", "..........GY...."],
    pal: { R: "#d4413a", Y: "#f2c14e", G: "#4f9a5c", o },
  },
  // Nissebriller: thin round gold lenses under two tufts of fluffy white brow.
  "glasses.802": {
    down: [".wWw......wWw..", "..yyy....yyy...", ".y...y..y...y..", "..yyy.yy.yyy..."],
    side: ["........wWw.....", ".........yyy....", "...kkkkky...y...", ".........yyy...."],
    pal: { w: "#ffffff", W: "#e6e2d6", y: "#f2c14e", k: "#a8842a" },
  },
};
