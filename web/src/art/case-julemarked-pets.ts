import { C } from "./palette.ts";
import type { Pet } from "./pet-base.ts";

/**
 * The Julemarked case's pets (core/src/case-julemarked.ts, pet.800 to pet.805), 12×10 facing right with two
 * frames, like the other cases'. `pet-base.ts` files them at `JULEMARKED_BASE + n` in `PETS`. Wool, felt and
 * straw: matte reds, no gloss. Frame 0 stands; frame 1 is the same drawing hopped one pixel up (`hop`), with
 * the feet and tail redone where the animal has them.
 */

const BLANK = "............";

/** Paints `art` only where `base` is empty (`.`): glows and ground light that sit behind the animal. */
function under(base: string[], x0: number, y0: number, art: string[]): string[] {
  const rows = base.map((r) => [...r]);
  for (const [dy, r] of art.entries())
    for (const [dx, c] of [...r].entries())
      if (c !== "." && rows[y0 + dy]?.[x0 + dx] === ".") rows[y0 + dy]![x0 + dx] = c;
  return rows.map((r) => r.join(""));
}

/** A halo: every empty cell touching the animal (8 neighbours) becomes `ch`. */
function halo(base: string[], ch: string): string[] {
  return base.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (c !== ".") return c;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if ((base[y + dy]?.[x + dx] ?? ".") !== ".") return ch;
        return c;
      })
      .join(""),
  );
}

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
    for (const [dx, c] of [...r].entries())
      if (c !== "." && rows[y0 + dy]?.[x0 + dx] !== undefined) rows[y0 + dy]![x0 + dx] = c;
  return rows.map((r) => r.join(""));
}

// Rødkælk: a robin puffed round, a glowing orange-red breast, snow on its back and a holly berry in its beak.
// Frame 0 stands tall; frame 1 hops with its head cocked, the berry tipped up.
// prettier-ignore
const ROBIN_0: string[] = [
  "..........g.",
  "....oooo.gg.",
  "...obbbbo...",
  "..obbbbebyyB",
  "..obwbbbbbB.",
  ".obwbbrrrro.",
  ".obbbrRRRrro",
  ".obbbrRRRrro",
  "..obbbrrrro.",
  "...oooooo...",
];
// prettier-ignore
const ROBIN_1: string[] = [
  "...........g",
  "....oooo.gB.",
  "...obbbbobyB",
  "..obbbbeby..",
  "..obwbbbbbo.",
  ".obwbbrrrro.",
  ".obbbrRRRrro",
  ".obbbrRRRrro",
  "..obbbrrrro.",
  "...l.oooo.l.",
];
const ROBIN_PAL = {
  o: C.ink,
  b: "#8a6440",
  w: "#f6f2ea",
  r: "#e0642c",
  R: "#f08a44",
  e: C.ink,
  y: "#f2c14e",
  l: "#5a3d24",
  B: "#c8102e",
  g: "#3f8a4a",
};

// Marcipangris: a glossy pink marzipan pig, a red bow with a sheen, a curly tail that wiggles, a wink on frame 1.
// prettier-ignore
const PIG_0: string[] = [
  "S....r.r....",
  ".....rRr....",
  "....oppo....",
  "noooopppppo.",
  "nHHpppppeppo",
  "oHppppppppnn",
  "opppppppppNn",
  ".oppppppppoo",
  "..oooooooo..",
  "..hh.hh.hh..",
];
// prettier-ignore
const PIG_1: string[] = [
  ".....r.r..S.",
  ".....rRr....",
  "n...oppo....",
  "noooopppppo.",
  "opHHppppeeoo",
  "oHppppppppnn",
  "opppppppppNn",
  ".oppppppppoo",
  "..oooooooo..",
  "..oo.oo.oo..",
];
const PIG_PAL = {
  o: C.ink,
  p: "#f0c0b0",
  H: "#fff4ee",
  S: "#ffffff",
  n: "#d99a84",
  N: "#b46a5c",
  e: C.ink,
  r: "#e0182e",
  R: "#ff6a78",
  h: C.ink,
};

// Nissekat: a grey tabby with a red nisse cap (a cream bobble), a gold bell on a red collar, and a flicking tail.
// prettier-ignore
const CAT_0: string[] = [
  ".......rrW..",
  ".......rrro.",
  "......orrro.",
  "o.....owwwwo",
  "bo...oebebbo",
  ".bo..obbnbbo",
  "..ooookccco.",
  ".obkbkbyboo.",
  ".obobbbobo..",
  ".o.o..o.o...",
];
// prettier-ignore
const CAT_1: string[] = [
  "..........W.",
  ".......rrw..",
  "o.....orrro.",
  "bo....owwwwo",
  ".bo..oebebbo",
  "..o..obbnbbo",
  "..ooookccco.",
  ".obkbkbbYboo",
  ".obobbbobo..",
  "o.o....o.o..",
];
const CAT_PAL = {
  o: C.ink,
  b: "#9aa0aa",
  k: "#6a707c",
  w: "#f4ecd8",
  W: "#ffffff",
  r: "#d0302c",
  c: "#c8102e",
  y: "#f2c14e",
  Y: "#fff3c0",
  e: C.ink,
  n: "#d98a8a",
};

// Julesvaneand: the plain duck in a red nisse hat with a cream rim and bobble. The hat wobbles as it waddles.
// prettier-ignore
const DUCK_0: string[] = [
  "......w.....",
  ".....rrr....",
  "....orrro...",
  "....owwwwo..",
  ".....oyeyoo.",
  ".oo..oyyynno",
  "oyyooyyyyyo.",
  ".oyyyyyyyo..",
  "..ooooooo...",
  "...n...n....",
];
// prettier-ignore
const DUCK_1: string[] = [
  "...wrr......",
  "....orrro...",
  "....owwwwo..",
  ".....oyeyoo.",
  ".oo..oyyynno",
  "oyyooyyyyyo.",
  ".oyyyyyyyo..",
  "..ooooooo...",
  "..n.....n...",
  "............",
];
const DUCK_PAL = { o: C.ink, y: "#f5d14a", e: C.ink, n: "#f08a3c", r: "#d0302c", w: "#f8f0dc" };

// Julebuk: the straw Yule goat in gold, red ribbons on its horn, neck and tail, glinting horns and a faint glow.
// prettier-ignore
const GOAT_0: string[] = [
  "........WhW.",
  "........hrh.",
  ".......ohGho",
  "......oGGGGo",
  "......oGGeGo",
  "rooooooogGno",
  "ogggGgrrGGdo",
  "oggGgGrrgGdo",
  ".og.ogg.og..",
  ".rr.rrr.rr..",
];
// prettier-ignore
const GOAT_1: string[] = [
  "..........W.",
  "........hrh.",
  ".......ohGho",
  "......oGGGGo",
  "......oGGeGo",
  "rrooooooogNo",
  "ogggGgrrGGdo",
  "oggGgGrrgGdo",
  ".og..ogg.og.",
  ".rr..rrr.rr.",
];
const GOAT_PAL = {
  o: C.ink,
  g: "#e0b44c",
  G: "#f6d97e",
  h: "#d9a83a",
  d: "#b0822c",
  e: C.ink,
  n: "#6b3f22",
  N: "#8a5a32",
  r: "#d0302c",
  W: "#fffbe0",
  q: "rgba(255, 214, 110, 0.22)",
  Q: "rgba(255, 224, 130, 0.38)",
};

// Lygtenisse: a tiny nisse with a lantern that flickers, a pool of warm light on the ground and a trail of sparks.
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
/** The nisse with the lantern hung at (x, y): round light (`big` = flare), ground pool, a hand and sparks. */
function nisse(body: string[], x: number, y: number, big: boolean, sparks: [number, number][]): string[] {
  let rows = body;
  for (const [sx, sy] of sparks) rows = put(rows, sx, sy, ["Y"]);
  rows = put(rows, 7, y + 1, ["fo"]);
  const cx = x + 1.5;
  const cy = y + 1.5;
  const r = big ? 4.2 : 3.4;
  const glow = Array.from({ length: 10 }, (_, gy) =>
    Array.from({ length: 12 }, (_, gx) => {
      const d = Math.hypot(gx - cx, (gy - cy) * 1.1);
      return d < 2.2 ? "Q" : d < r ? "q" : ".";
    }).join(""),
  );
  rows = under(rows, 0, 0, glow);
  // The pool of light on the ground: a flat ellipse round the nisse's feet.
  rows = under(rows, 0, 0, ["", "", "", "", "", "", "", "", "..qqqqqqqq..", ".qqqqqqqqqq."]);
  return put(
    rows,
    x,
    y,
    LANTERN.map((r) => (big ? r.replace("y", "Y") : r)),
  );
}

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_PETS: Pet[] = [
  { frames: [ROBIN_0, ROBIN_1], pal: ROBIN_PAL },
  { frames: [PIG_0, PIG_1], pal: PIG_PAL },
  { frames: [CAT_0, CAT_1], pal: CAT_PAL },
  { frames: [DUCK_0, DUCK_1], pal: DUCK_PAL },
  { frames: [halo(GOAT_0, "q"), halo(GOAT_1, "Q")], pal: GOAT_PAL },
  {
    frames: [
      nisse(NISSE, 8, 5, false, [[0, 6], [1, 4]]),
      nisse(hop(NISSE, "...kk.kk...."), 9, 4, true, [[1, 7], [0, 4]]),
    ],
    pal: { o: C.ink, r: "#c8302c", w: "#f4ecd8", g: "#8a8f98", f: "#f0c8a0", e: C.ink, k: "#6b3f22", y: "#f2c14e", Y: "#fff3c0", q: "rgba(255, 200, 90, 0.22)", Q: "rgba(255, 214, 120, 0.42)" },
  },
];
