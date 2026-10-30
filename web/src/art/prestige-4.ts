import type { Art } from "./editions.ts";
import { C } from "./palette.ts";
import type { Pen } from "./pixels.ts";
import type { TrackArt } from "./prestige-types.ts";
import type { Back, BackView, Outfit } from "./wardrobe.ts";

/**
 * Prestige track 4, Architect, in 2D (`core/src/prestige.ts`): ivory and gold, blueprints, clockwork, drafting lines.
 * A hat, an outfit, a back item and an aura, filed by `prestige.ts` under hat.703 and look index 703. Ivory
 * (`#f5e6b8`) is the cloth, gold (`#d4a017`) the metal, a pale blueprint blue the ink drawn on both.
 */

const o = C.ink;
const TAU = Math.PI * 2;

/** The right half of a symmetric sprite, mirrored out of its left half (8 columns each). */
const sym = (half: string[]): string[] => half.map((r) => r + [...r].reverse().join(""));
/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
const view = (front: string[]): BackView => ({ front });

// MARK: Hat

// Architect's diadem: a slim ivory band across the brow with gold measuring ticks along it, and over the middle a
// drafting compass standing on its point: a gold hinge on top, two legs spread down into the band, a glow stone at
// the hinge. A pair of small gold finials stand either side.
// Pixel art reads as a grid.
// prettier-ignore
const HAT: Art = {
  down: [
    ".......oo.......",
    "......ogGo......",
    "..o...oyYo...o..",
    "..oyooiyyioooyo.",
    "..oiYiIiiIiYIio.",
  ],
  side: [
    "........oo......",
    ".......ogGo.....",
    "....o..oyYo.o...",
    "....oyoiyyiooyo.",
    "....oiYiIiiIYio.",
  ],
  up: [
    ".......oo.......",
    "......ogGo......",
    "..o...oyYo...o..",
    "..oyooiyyioooyo.",
    "..oiYiIiiIiYIio.",
  ],
  pal: { o, i: "#f5e6b8", I: "#cdb98a", y: "#d4a017", Y: "#9c710e", g: "#fff3b0", G: "#ffe38a" },
};

// MARK: Outfit

// Worldbuilder regalia: an ivory coat drawn on like a blueprint (pale blue plan lines and a gold gear over the
// chest), gold shoulder trim and cuffs, a gold belt with a rolled plan tucked at the hip, deep umber trousers.
// Pixel art reads as a grid.
// prettier-ignore
const OUTFIT: Outfit = {
  c: "#f5e6b8", C: "#cdb98a", p: "#4a3a1c",
  marks: {
    down: ["....gG.kk.Gg....", "....g.k.Gk.g....", "....g..kk..g....", "....GgyyyyygG.wb"],
    side: ["......gG.kg.....", "......g.Gkg.....", "......g.kk......", ".....GyyyygG.wb."],
    up: ["....gG....Gg....", "....g.kkkk.g....", "....g......g....", "....GgyyyyyGg..."],
  },
  pal: { g: "#d4a017", G: "#9c710e", k: "#6f98d0", y: "#ffe38a", w: "#fffaf0", b: "#5b86c9" },
};

// MARK: Back

// Lattice wings: gold struts with ivory cross-bracing and dimension ticks, spread out behind the shoulders like an
// engineer's drawing of wings. The tips lift on the walking frame.
// Pixel art reads as a grid.
// prettier-ignore
const WING_UP = frameAt(sym([
  "Yy......",
  "yIyy....",
  "yiIiyy..",
  "y.iIiIyy",
  "yIiIiIiy",
  "y.IiIiIy",
  ".yIiIiIy",
  "..yIiIyy",
  "...yyyy.",
  "....yy..",
]), 3);
const WING_UP_B = frameAt(
  sym([
    "Yy......",
    "yIyy....",
    "yiIiyy..",
    "y.iIiIyy",
    "yIiIiIiy",
    "y.IiIiIy",
    ".yIiIiIy",
    "..yIiIyy",
    "...yyyy.",
    "....yy..",
  ]),
  2,
);
// prettier-ignore
const WING_DOWN = frameAt(sym([
  "Yy......",
  "yIy.....",
  "yiIy....",
  "y.iIy...",
  "yIiIy...",
  "y.IiIy..",
  ".yIiIy..",
  "..yyyy..",
]), 5);
// prettier-ignore
const WING_SIDE = frameAt([
  "....Yy..........",
  "...yIy..........",
  "..yiIy..........",
  "..y.iIy.........",
  "..yIiIy.........",
  "...y.Iy.........",
  "...yIiy.........",
  "....yyy.........",
], 4);

const BACK: Back = {
  views: {
    down: { behind: WING_DOWN },
    side: { behind: WING_SIDE },
    up: view(WING_UP),
  },
  walk: { up: view(WING_UP_B) },
  pal: { o, y: "#d4a017", Y: "#9c710e", i: "#f5e6b8", I: "#e9d596" },
};

// MARK: Aura

const CX = 14;
const CY = 14;
const FRAMES = 8;
const RX = 9.5;
const RY = 4.5;
const GOLD = "#d4a017";
const GLOW = "#ffe38a";
const IVORY = "#f5e6b8";

type V3 = [number, number, number];
type Edge = [number, number];
interface Solid {
  v: V3[];
  e: Edge[];
}

const CUBE: Solid = {
  v: [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ],
  e: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
};
const OCTA: Solid = {
  v: [
    [1.3, 0, 0],
    [-1.3, 0, 0],
    [0, 1.3, 0],
    [0, -1.3, 0],
    [0, 0, 1.3],
    [0, 0, -1.3],
  ],
  e: [
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [2, 4],
    [4, 3],
    [3, 5],
    [5, 2],
  ],
};
const TETRA: Solid = {
  v: [
    [1.2, 1.2, 1.2],
    [1.2, -1.2, -1.2],
    [-1.2, 1.2, -1.2],
    [-1.2, -1.2, 1.2],
  ],
  e: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [2, 3],
    [3, 1],
  ],
};

/** A pixel on the 28×28 frame, if it is on it. */
const put = (p: Pen, x: number, y: number, color: string): void => {
  if (x >= 0 && y >= 0 && x < 28 && y < 28) p.px(x, y, color);
};

/** A pixel line from (`x0`, `y0`) to (`x1`, `y1`), the first `part` (0..1) of it. */
function line(p: Pen, x0: number, y0: number, x1: number, y1: number, color: string, part = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const upto = Math.round(n * part);
  for (let i = 0; i <= upto; i++)
    put(p, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), color);
}

/** One solid, turned by `yaw` and tipped by `pitch`, `size` pixels to the unit, centred on (`cx`, `cy`). One edge is being drawn. */
function wire(
  p: Pen,
  s: Solid,
  cx: number,
  cy: number,
  size: number,
  yaw: number,
  pitch: number,
  drawing: number,
): void {
  const pts = s.v.map(([x, y, z]) => {
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    return [cx + x1 * size, cy + y2 * size] as const;
  });
  p.disc(Math.round(cx), Math.round(cy), Math.round(size) + 1, "rgba(255, 227, 138, 0.14)");
  const at = Math.floor(drawing * s.e.length);
  const part = drawing * s.e.length - at;
  s.e.forEach(([a, b], i) => {
    const [x0, y0] = pts[a]!;
    const [x1, y1] = pts[b]!;
    // The edge the pen is on is ivory up to its tip, a white dot; the rest are gold.
    if (i === at) {
      line(p, x0, y0, x1, y1, IVORY, part);
      put(p, Math.round(x0 + (x1 - x0) * part), Math.round(y0 + (y1 - y0) * part), "#ffffff");
    } else line(p, x0, y0, x1, y1, GOLD);
  });
  for (const [x, y] of pts) put(p, Math.round(x), Math.round(y), GLOW);
}

// Orbiting wireframe: a cube, an octahedron and a tetrahedron of gold lines circle on a drafted ellipse, turning as
// they go; each one is being redrawn edge by edge, a white pen tip running along the line it is on.
const wireframe = (p: Pen, f: number): void => {
  // The path they follow, in faint gold dashes with a tick every eighth of the way round.
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    if (i % 2 === 0)
      p.px(
        Math.round(CX + Math.cos(a) * RX),
        Math.round(CY + 1 + Math.sin(a) * RY),
        "rgba(255, 227, 138, 0.35)",
      );
  }
  const solids = [CUBE, OCTA, TETRA];
  const sizes = [2.3, 2.7, 2.4];
  const order = solids
    .map((_, i) => i)
    .sort((a, b) => Math.sin((f / FRAMES + a / 3) * TAU) - Math.sin((f / FRAMES + b / 3) * TAU));
  for (const i of order) {
    const k = f / FRAMES + i / 3;
    const a = k * TAU;
    wire(
      p,
      solids[i]!,
      Math.round(CX + Math.cos(a) * RX),
      Math.round(CY + 1 + Math.sin(a) * RY),
      sizes[i]!,
      k * TAU + i,
      0.55,
      k % 1,
    );
  }
  // Measuring ticks sparkle on the path.
  for (const j of [0, 4])
    p.px(
      Math.round(CX + Math.cos(((f + j) / FRAMES) * TAU) * RX),
      Math.round(CY + 1 + Math.sin(((f + j) / FRAMES) * TAU) * RY) - 1,
      IVORY,
    );
};

export const TRACK: TrackArt = { hat: HAT, outfit: OUTFIT, back: BACK, aura: wireframe };
