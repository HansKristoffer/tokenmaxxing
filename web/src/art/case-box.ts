/**
 * The Night Market case and its key in 2D pixel art (a lacquered plum-to-crimson crate with a lantern emblem,
 * gold straps and a hanging tag; and a gold market coin with a square hole on a red tassel).
 *
 *   caseBoxSprite("closed")    // 24x28 canvas: the case, lid down
 *   caseBoxSprite("open", f)   // 24x28 canvas: lid up, warm light spilling out; f = 0 | 1 (sparkles shift)
 *   caseBoxSprite("key")       // 16x24 canvas: the market token
 *   CASE_BOX_SIZE[kind]        // { w, h } of each, in art pixels (draw scaled with imageSmoothingEnabled = false)
 *
 * Canvases are baked once and cached: draw them, do not mutate them. `closed`/`open` share one frame and
 * baseline, so swapping them in place makes the lid pop open. `CASE_BOX_FRAMES` is how many frames animate.
 */

import { C } from "./palette.ts";
import { bake } from "./pixels.ts";

export type CaseBoxKind = "closed" | "open" | "key";

export const CASE_BOX_SIZE: Record<CaseBoxKind, { w: number; h: number }> = {
  closed: { w: 24, h: 28 },
  open: { w: 24, h: 28 },
  key: { w: 16, h: 24 },
};

/** Frames per kind: the open case's sparkles and glow shift between two. */
export const CASE_BOX_FRAMES: Record<CaseBoxKind, number> = { closed: 1, open: 2, key: 1 };

const P = {
  plum: "#3d1a52",
  plumDark: "#2a1139",
  plumLight: "#5a2a6e",
  wine: "#6e2260",
  crimson: "#a82840",
  crimsonLight: "#d8402f",
  lacquer: "#23202b",
  gold: "#e9b73d",
  goldDark: "#b8860b",
  goldLight: "#ffd36a",
  paper: "#fff1c9",
  glow: "#ffd36a",
  orange: "#f08a3c",
  red: "#d8402f",
  redDark: "#a42a22",
} as const;

// A 6x8 lantern: gold caps, orange ribs, a lit paper belly and a red tassel.
// prettier-ignore
const LANTERN = [
  "..gg..",
  ".gGGg.",
  "RyWWyR",
  "RyWWyR",
  "RyyyyR",
  ".gGGg.",
  "..rr..",
  "..rr..",
];
const LANTERN_PAL = { g: P.gold, G: P.goldDark, R: P.red, y: P.glow, W: P.paper, r: P.redDark };

// Lantern stamped on the coin: 4x5, darker gold.
// prettier-ignore
const STAMP = [
  ".dd.",
  "dLLd",
  "dLLd",
  "dLLd",
  ".dd.",
];

/** The case body, lower part, lid not included. `y0` is the top of the body's ink outline. */
function body(p: import("./pixels.ts").Pen, y0: number, lit: boolean): void {
  // Outline and fill, plum at the foot to crimson under the lid.
  p.rect(1, y0, 22, 11, C.ink);
  p.rect(2, y0 + 1, 20, 9, P.plum);
  p.rect(2, y0 + 1, 20, 3, P.crimson);
  p.rect(2, y0 + 4, 20, 2, P.wine);
  p.rect(2, y0 + 1, 20, 1, P.plumDark); // the shadow under the lid
  p.rect(2, y0 + 2, 20, 1, P.crimson);
  p.rect(2, y0 + 9, 20, 1, P.plumDark);
  // Lacquer highlight.
  p.rect(3, y0 + 3, 2, 1, P.crimsonLight);
  // Gold straps and their rivets.
  for (const x of [3, 19]) {
    p.rect(x, y0 + 1, 2, 9, P.gold);
    p.rect(x, y0 + 1, 1, 9, P.goldLight);
    p.px(x + 1, y0 + 3, P.goldDark);
    p.px(x + 1, y0 + 7, P.goldDark);
  }
  // The lantern plate and the lantern.
  p.rect(7, y0 + 1, 10, 9, P.lacquer);
  p.rect(7, y0 + 1, 10, 1, P.gold);
  p.grid(LANTERN, LANTERN_PAL, 9, y0 + 2);
  if (lit) p.px(8, y0 + 4, P.orange);
  // The hanging tag: a cord from the strap, a paper tag with a red seal.
  p.px(18, y0 + 5, P.goldDark);
  p.rect(16, y0 + 6, 4, 4, C.ink);
  p.rect(17, y0 + 7, 2, 2, P.paper);
  p.px(17, y0 + 7, P.red);
}

function drawClosed(p: import("./pixels.ts").Pen): void {
  // Shadow on the floor.
  p.rect(2, 25, 20, 2, C.shadow);
  body(p, 14, false);
  // The lid: a domed crimson top over the body, a gold band along its edge.
  p.rect(0, 8, 24, 7, C.ink);
  p.rect(1, 9, 22, 5, P.wine);
  p.rect(1, 9, 22, 2, P.crimson);
  p.rect(1, 9, 22, 1, P.crimsonLight);
  p.rect(1, 13, 22, 1, P.gold);
  p.rect(1, 13, 22, 1, P.goldDark);
  p.rect(1, 12, 22, 1, P.gold);
  for (const x of [3, 19]) {
    p.rect(x, 9, 2, 5, P.gold);
    p.rect(x, 9, 1, 5, P.goldLight);
  }
  // Clasp: a gold plate over the seam with a lantern-red bead.
  p.rect(10, 11, 4, 4, C.ink);
  p.rect(11, 11, 2, 3, P.gold);
  p.px(11, 12, P.red);
  p.px(12, 12, P.goldDark);
  // Top edge rim highlight.
  p.rect(2, 8, 20, 1, C.ink);
  p.px(0, 8, "rgba(0,0,0,0)");
}

function drawOpen(p: import("./pixels.ts").Pen, frame: number): void {
  // Warm light on the floor.
  p.rect(2, 25, 20, 2, C.shadow);
  p.rect(5, 26, 14, 1, "rgba(255, 211, 106, 0.45)");
  // The lid, standing up behind: its inside lit from below.
  p.rect(1, 0, 22, 12, C.ink);
  p.rect(2, 1, 20, 10, P.wine);
  p.rect(2, 1, 20, 2, P.crimson);
  p.rect(2, 3, 20, 3, P.wine);
  p.rect(2, 6, 20, 2, "#a85a4a");
  p.rect(2, 8, 20, 2, "#e08a4a");
  p.rect(2, 10, 20, 1, P.goldLight);
  p.rect(2, 1, 20, 1, P.gold);
  p.rect(2, 1, 20, 1, P.goldDark);
  for (const x of [3, 19]) {
    p.rect(x, 2, 2, 9, P.gold);
    p.rect(x, 2, 1, 9, P.goldLight);
  }
  p.rect(7, 5, 10, 4, "#d8662f");
  p.rect(9, 7, 6, 2, "#f6b24a");
  // The body, its mouth full of light.
  body(p, 14, true);
  p.rect(0, 11, 24, 3, C.ink);
  p.rect(1, 12, 22, 2, P.glow);
  p.rect(4, 12, 16, 1, P.paper);
  p.rect(1, 11, 22, 1, P.gold);
  p.rect(1, 11, 22, 1, P.goldDark);
  p.rect(1, 11, 22, 1, P.gold);
  // The beam rising out of the mouth and the motes in it.
  p.rect(5, 9, 14, 2, "rgba(255, 233, 160, 0.75)");
  p.rect(8, 8, 8, 1, "rgba(255, 233, 160, 0.6)");
  const motes: [number, number][] =
    frame === 0
      ? [
          [6, 5],
          [12, 4],
          [17, 6],
          [9, 9],
        ]
      : [
          [7, 4],
          [11, 5],
          [16, 4],
          [14, 9],
        ];
  for (const [x, y] of motes) p.px(x, y, P.paper);
  p.px(frame === 0 ? 20 : 3, 8, P.glow);
}

function drawKey(p: import("./pixels.ts").Pen): void {
  // The cord loop through the hole, up top.
  p.rect(6, 0, 4, 1, C.ink);
  p.rect(5, 1, 1, 3, C.ink);
  p.rect(10, 1, 1, 3, C.ink);
  p.rect(6, 1, 1, 3, P.red);
  p.rect(9, 1, 1, 3, P.red);
  // The coin: ink ring, gold face, a darker inner ring, a highlight and a shaded edge.
  p.disc(8, 9, 7, C.ink);
  p.disc(8, 9, 6, P.gold);
  p.disc(8, 9, 5, P.goldDark);
  p.disc(8, 9, 4, P.gold);
  p.px(4, 6, P.goldLight);
  p.px(5, 5, P.goldLight);
  p.px(6, 4, P.goldLight);
  p.px(3, 8, P.goldLight);
  p.px(12, 13, P.goldDark);
  p.px(11, 14, P.goldDark);
  // The square hole.
  p.rect(7, 5, 2, 2, C.ink);
  p.px(7, 5, P.plumDark);
  // The lantern stamp below it.
  p.grid(STAMP, { d: P.goldDark, L: P.red }, 6, 8);
  // The tassel: a gold bead on the cord, a red skirt.
  p.rect(7, 16, 2, 1, C.ink);
  p.rect(6, 17, 4, 3, C.ink);
  p.rect(7, 17, 2, 2, P.gold);
  p.px(7, 17, P.goldLight);
  p.rect(5, 19, 6, 5, C.ink);
  p.rect(6, 20, 4, 4, P.red);
  p.rect(6, 19, 4, 1, P.redDark);
  p.px(7, 21, P.redDark);
  p.px(9, 22, P.redDark);
  p.px(8, 20, "#f06a4a");
  p.px(6, 23, P.redDark);
  p.px(9, 23, P.redDark);
}

const cache = new Map<string, HTMLCanvasElement>();

/** The sprite for `kind` (frame 0 or 1; only the open case animates). Cached: do not draw into it. */
export function caseBoxSprite(kind: CaseBoxKind, frame = 0): HTMLCanvasElement {
  const f = kind === "open" ? frame % 2 : 0;
  const k = `${kind}${f}`;
  let c = cache.get(k);
  if (!c) {
    const { w, h } = CASE_BOX_SIZE[kind];
    c = bake(w, h, (p) =>
      kind === "closed" ? drawClosed(p) : kind === "open" ? drawOpen(p, f) : drawKey(p),
    );
    cache.set(k, c);
  }
  return c;
}
