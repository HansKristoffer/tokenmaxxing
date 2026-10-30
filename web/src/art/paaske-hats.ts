import type { Art } from "./editions.ts";
import { C } from "./palette.ts";

/** Påske's three costumes (`core/src/costumes.ts`, indices 60-62), merged into `HATS` in `editions.ts`. */
const INK = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
export const PAASKE_HATS: Record<string, Art> = {
  // Bunny ears: two tall white ears, pink inside, on a pink band.
  "hat.260": {
    down: ["..ww......ww....", ".wppw....wppw...", ".wppw....wppw...", ".wppw....wppw...", "..ww......ww....", "..bbbbbbbbbbbb.."],
    side: ["....ww..ww......", "...wppwwppw.....", "...wppwwppw.....", "....wppppw......", "....wwwwww......", "...bbbbbbbbb...."],
    up: ["..ww......ww....", ".wwww....wwww...", ".wwww....wwww...", ".wwww....wwww...", "..ww......ww....", "..bbbbbbbbbbbb.."],
    pal: { w: "#f6f1e7", p: "#f2a6b8", b: "#e87ca4" },
  },
  // Chick hat: a fluffy yellow chick on the crown, an orange beak, two black eyes.
  "hat.261": {
    down: ["................", ".....yyyyyy.....", "....yyKyyKyy....", "....yyyOOyyy....", "...yyyyyyyyyy...", "....oo....oo...."],
    side: ["................", "....yyyyy.......", "...yyyKyyy......", "...yyyyyOO......", "..yyyyyyyyy.....", "....oo..oo......"],
    up: ["................", ".....yyyyyy.....", "....yyyyyyyy....", "....yyYYYYyy....", "...yyyyyyyyyy...", "....oo....oo...."],
    pal: { y: "#ffe36a", Y: "#f2c230", O: "#f08a2a", o: "#f08a2a", K: INK },
  },
  // Påskelilje crown: yellow narcissi with orange trumpets on a green vine.
  "hat.262": {
    down: ["................", "....Y.....Y.....", "...YOY..Y.YOY...", "..gYgYgYOYgYgg..", "..gggggggggggg.."],
    side: ["................", "......Y.........", ".....YOY..Y.....", "...gggYgggYOYg..", "...ggggggggggg.."],
    up: ["................", "....Y.....Y.....", "...YOY..Y.YOY...", "..gYgYgYYYgYgg..", "..gggggggggggg.."],
    pal: { Y: "#f7d23a", O: "#e8902a", g: "#4f9b3d" },
  },
};
