import { C } from "./palette.ts";
import type { Pet } from "./pet-base.ts";

/**
 * The Julemarked case's pets (core/src/case-julemarked.ts, pet.800 to pet.805), 12×10 facing right with two
 * frames, like the other cases'. `pet-base.ts` files them at `JULEMARKED_BASE + n` in `PETS`. Wool, felt and
 * straw: matte reds, no gloss. Frame 0 stands; frame 1 is the same drawing hopped one pixel up (`hop`), with
 * the feet and tail redone where the animal has them.
 */

const BLANK = "............";

/** Frame 1: everything one row up (the top row must be empty), the feet row replaced by `feet`. */
function hop(f0: string[], feet: string): string[] {
  const rows = [...f0.slice(1), BLANK];
  rows[8] = feet;
  return rows;
}

/** Overlays `art` on `base` at (x0, y0); `.` leaves what is there. */
function put(base: string[], x0: number, y0: number, art: string[]): string[] {
  const rows = base.map((r) => [...r]);
  for (const [dy, r] of art.entries())
    for (const [dx, c] of [...r].entries()) if (c !== "." && rows[y0 + dy]?.[x0 + dx] !== undefined) rows[y0 + dy]![x0 + dx] = c;
  return rows.map((r) => r.join(""));
}

// Rødkælk: a robin puffed up round, an orange-red breast, a dusting of snow on its back.
// prettier-ignore
const ROBIN: string[] = [
  "............",
  "....oooo....",
  "...obwwbo...",
  "..obbbbbeoo.",
  "..obbbbrroyy",
  "..obbbrrrro.",
  "..obbbrrrro.",
  "...obbrrro..",
  "....ooooo...",
  "....l..l....",
];

// Marcipangris: a pale pink-beige marzipan pig, a red bow on its ear, a curly tail.
// prettier-ignore
const PIG: string[] = [
  "............",
  ".....rRr....",
  "....oppo....",
  "qoooopppppo.",
  "opppppppeppo",
  "opppppppppnn",
  "opppppppppNn",
  ".oppppppppoo",
  "..oooooooo..",
  "..hh.hh.hh..",
];

// Nissekat: a grey tabby, a little red cap with a cream rim and a bobble tilted over one ear.
// prettier-ignore
const CAT_0: string[] = [
  "............",
  ".......rrw..",
  "......orrro.",
  "o.....owwwwo",
  "bo...oebebbo",
  ".bo..obbnbbo",
  "..oooobbbbo.",
  ".obkbkbbbo..",
  ".obobbbobo..",
  ".o.o..o.o...",
];
// prettier-ignore
const CAT_1: string[] = [
  ".......rrw..",
  "o.....orrro.",
  "bo....owwwwo",
  ".bo..oebebbo",
  "..o..obbnbbo",
  "..oooobbbbo.",
  ".obkbkbbbo..",
  ".obobbbobo..",
  "o.o....o.o..",
  "............",
];

// Julesvaneand: the plain duck with a red nisse hat and a cream rim. A joke, played straight.
// prettier-ignore
const DUCK: string[] = [
  "............",
  "......rr....",
  ".....orrro..",
  ".....owwwo..",
  ".....oyeyoo.",
  ".oo..oyyynno",
  "oyyooyyyyyo.",
  ".oyyyyyyyo..",
  "..ooooooo...",
  "...n...n....",
];

// Julebuk: the straw Yule goat, a red ribbon round the neck, stiff straw horns and a beard, red-tied hooves.
// prettier-ignore
const GOAT: string[] = [
  "........h.h.",
  "........hhh.",
  ".......ohGho",
  "......oGGGGo",
  "......oGGeGo",
  "ooooooogGGno",
  "ogggGgrrGGdo",
  "oggGgGrrgGdo",
  ".og.ogg.og..",
  ".rr.rrr.rr..",
];

// Lygtenisse: a tiny nisse, grey jacket, red cap, white beard, and a lantern that swings between the frames.
// prettier-ignore
const NISSE: string[] = [
  "............",
  ".....r......",
  "....rrr.....",
  "...orrro....",
  "...oefeo....",
  "..owwwwwo...",
  "..owwwwwo...",
  "..ogggggo...",
  "...ogoogo...",
  "...kk.kk....",
];
// prettier-ignore
const LANTERN = [
  ".oo.",
  "oyYo",
  "oyyo",
  ".oo.",
];
/** The nisse with the lantern hung at (x, y), a soft pool of light round it, and a hand holding it up. */
function nisse(body: string[], x: number, y: number): string[] {
  const glow = [".qqqq.", "qqqqqq", "qqqqqq", "qqqqqq", "qqqqqq", ".qqqq."];
  let rows = put(body, x - 1, y - 1, glow);
  rows = put(rows, x, y, LANTERN);
  return put(rows, 7, 6, ["fo"]);
}

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_PETS: Pet[] = [
  { frames: [ROBIN, hop(ROBIN, "....l..l....")], pal: { o: C.ink, b: "#8a6440", w: "#f6f2ea", r: "#e0642c", e: C.ink, y: "#f2c14e", l: "#5a3d24" } },
  { frames: [PIG, hop(PIG, ".oo.oo..oo..")], pal: { o: C.ink, p: "#ecc0aa", n: "#d99a84", N: "#b46a5c", e: C.ink, r: "#c8102e", R: "#9a2024", q: "#d99a84", h: C.ink } },
  { frames: [CAT_0, CAT_1], pal: { o: C.ink, b: "#9aa0aa", k: "#6a707c", w: "#f4ecd8", r: "#b8302c", e: C.ink, n: "#d98a8a" } },
  { frames: [DUCK, hop(DUCK, "..n.....n...")], pal: { o: C.ink, y: "#f5d14a", e: C.ink, n: "#f08a3c", r: "#b8302c", w: "#f4ecd8" } },
  { frames: [GOAT, hop(GOAT, ".og..ogg.og.")], pal: { o: C.ink, g: "#e0b44c", G: "#f2d27a", h: "#c99a3a", d: "#b0822c", e: C.ink, n: "#6b3f22", r: "#b8302c" } },
  {
    frames: [nisse(NISSE, 8, 5), nisse(hop(NISSE, "...kk.kk...."), 9, 4)],
    pal: { o: C.ink, r: "#b8302c", w: "#f4ecd8", g: "#8a8f98", f: "#f0c8a0", e: C.ink, k: "#6b3f22", y: "#f2c14e", Y: "#fff3c0", q: "rgba(242, 193, 78, 0.3)" },
  },
];
