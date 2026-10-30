import type { Art } from "./editions.ts";
import { C } from "./palette.ts";

/**
 * Halloween's hats in 2D (`core/src/costumes.ts`, hat.230 to hat.233), keyed by item id and spread into the costume table
 * in `editions.ts`. Same grids as the rest: 16 wide, drawn over the head from row 0. The 3D ones are
 * `render3d/people/halloween-hats.ts`.
 */
const o = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
export const HALLOWEEN_HATS: Record<string, Art> = {
  // Witch hat: a purple cone with an orange band and a gold buckle, on a wide brim.
  "hat.230": {
    down: [".......oo.......", "......oPPo......", ".....oPPPPo.....", ".....oPpPPo.....", "...oPbbbbbbPo...", ".oPPPPPPPPPPPPo.", ".oooooooooooooo."],
    pal: { o, P: "#4b2a78", p: "#6e45a3", b: "#e8772a" },
  },
  // Ghost sheet: white over the whole head, two black eye holes and an "oooh", a wavy hem.
  "hat.231": {
    down: [".....oooooo.....", "...ooWWWWWWoo...", "..oWWWWWWWWWWo..", "..oWWWWWWWWWWo..", "..oWWWWWWWWSWo..", "..oWWkkWWkkWWo..", "..oWWkkWWkkWWo..", "..oWWWWWWWWSWo..", "..oWWWWkkWWWWo..", ".oWWWWWWWWWWWWo.", ".oWSSWWWWWWSSWo.", ".oo.oo.oo.oo.oo."],
    pal: { o: "#5a5f8c", W: "#eef2ff", S: "#b9c0e6", k: "#1b1f2a" },
  },
  // Bat ears: two black ears with a purple inside, on a headband.
  "hat.232": {
    down: ["...oo......oo...", "...oBo....oBo...", "...oBBo..oBBo...", "...oBBooooBBo..."],
    pal: { o: "#14091f", B: "#7a4aa8" },
  },
  // Candy bucket (the sugar king's, never sold): an orange pumpkin pail with a grin and a handle, heaped with sweets.
  "hat.233": {
    down: ["......oooo......", ".....o....o.....", "...oRYBGRYBGo...", "...oppppppppo...", "...opkppppkpo...", "...oppppppppo...", "...opkkkkkkpo...", "...oPPPPPPPPo..."],
    pal: { o, p: "#e8772a", P: "#c25a1c", k: "#14091f", R: "#ff4fa3", Y: "#ffe14a", B: "#4fd1ff", G: "#8a3b12" },
  },
};
