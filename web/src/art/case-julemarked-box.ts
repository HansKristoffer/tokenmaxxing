import { C } from "./palette.ts";
import { bake, once, type Pen } from "./pixels.ts";

/**
 * The Julemarked case and its key in 2D pixel art (`case-box.ts` picks these by case id): a warm wooden market-stall
 * chest with cream panels and woven paper hearts, a red-and-cream striped awning lid dusted with snow, a green
 * ribbon and bow with a spruce sprig, and a small candle on the lid; a gold coin on a red-and-white twisted cord
 * with a woven heart stamped on it. Same canvases as the others: 24x28 closed/open (open has two frames), 16x24 key.
 */

const J = {
  wood: "#a06a3c",
  woodDark: "#7a4e2a",
  woodLight: "#bd8250",
  red: "#b8302c",
  redDark: "#8a2220",
  redLight: "#d4524c",
  cream: "#f4ecd8",
  creamDark: "#d8caa8",
  green: "#2f5d3a",
  greenLight: "#4d8a58",
  greenDark: "#1f3f27",
  gold: "#f2c14e",
  goldDark: "#c8932c",
  goldLight: "#fff3c0",
  snow: "#ffffff",
  frost: "#bcd8e8",
  berry: "#c8102e",
} as const;

// A woven paper heart, 5x4: red with a white weave.
// prettier-ignore
const HEART = [
  ".r.r.",
  "rwrwr",
  ".rwr.",
  "..r..",
];
const HEART_PAL = { r: J.red, w: J.cream };

/** The chest body: planks, cream panels with woven hearts, the green ribbon. `y0` is the top of its ink outline. */
function body(p: Pen, y0: number): void {
  p.rect(1, y0, 22, 11, C.ink);
  p.rect(2, y0 + 1, 20, 9, J.wood);
  p.rect(2, y0 + 1, 20, 1, J.woodDark);
  p.rect(2, y0 + 2, 20, 1, J.woodLight);
  p.rect(2, y0 + 9, 20, 1, J.woodDark);
  // Two cream panels, each with a woven heart.
  for (const x of [3, 15]) {
    p.rect(x, y0 + 3, 6, 6, C.ink);
    p.rect(x + 1, y0 + 4, 4, 4, J.cream);
    p.rect(x + 1, y0 + 7, 4, 1, J.creamDark);
  }
  p.grid(HEART, HEART_PAL, 3, y0 + 4);
  p.grid(HEART, HEART_PAL, 15, y0 + 4);
  // Clip the hearts back into their panels: a 5x4 heart on a 4x4 panel would spill, so redraw the edge.
  p.rect(2, y0 + 4, 1, 4, J.wood);
  p.rect(20, y0 + 4, 1, 4, J.wood);
  // The green ribbon straight down the middle.
  p.rect(10, y0 + 1, 4, 9, J.green);
  p.rect(10, y0 + 1, 1, 9, J.greenLight);
  p.rect(13, y0 + 1, 1, 9, J.greenDark);
  p.px(11, y0 + 4, J.greenLight);
  p.px(12, y0 + 7, J.greenDark);
}

/** The bow on top of the lid, with a spruce sprig tucked in on the left. `y` is the lid's top ink row. */
function bow(p: Pen, y: number): void {
  // Two loops and a knot.
  p.rect(6, y - 3, 5, 4, C.ink);
  p.rect(13, y - 3, 5, 4, C.ink);
  p.rect(7, y - 2, 3, 2, J.green);
  p.rect(14, y - 2, 3, 2, J.green);
  p.px(8, y - 2, J.greenLight);
  p.px(15, y - 2, J.greenLight);
  p.rect(10, y - 2, 4, 3, C.ink);
  p.rect(11, y - 1, 2, 1, J.greenLight);
  // The spruce sprig, over the lid's left of the bow, with two red berries.
  p.rect(4, y + 1, 5, 1, J.greenDark);
  p.rect(3, y + 2, 5, 1, J.green);
  p.rect(5, y + 3, 4, 1, J.greenDark);
  p.px(2, y + 2, J.greenLight);
  p.px(4, y + 3, J.greenLight);
  p.px(7, y + 1, J.berry);
  p.px(5, y + 2, J.berry);
}

/** The little candle on the lid's right, its flame a cartoon dab with a soft glow. */
function candle(p: Pen, x: number, y: number, flick: boolean): void {
  p.px(x - 2, y - 5, "rgba(255, 224, 140, 0.55)");
  p.px(x + 2, y - 5, "rgba(255, 224, 140, 0.55)");
  p.px(x - 1, y - 6, "rgba(255, 224, 140, 0.4)");
  p.px(x + 1, y - 6, "rgba(255, 224, 140, 0.4)");
  p.rect(x - 1, y - 3, 3, 4, C.ink);
  p.rect(x, y - 2, 1, 3, J.cream);
  p.px(x, y - 1, J.red);
  p.px(x, y - 4, J.goldLight);
  p.px(x - 1, y - 5, "rgba(255, 224, 140, 0.0)");
  p.px(x, y - 5, flick ? J.goldLight : J.gold);
  p.px(x, y - 6, J.gold);
}

function drawClosed(p: Pen): void {
  p.rect(2, 25, 20, 2, C.shadow);
  body(p, 14);
  // The lid: a striped awning, red and cream in threes.
  p.rect(2, 7, 20, 1, C.ink);
  p.rect(0, 8, 24, 7, C.ink);
  p.px(0, 8, "rgba(0,0,0,0)");
  p.px(23, 8, "rgba(0,0,0,0)");
  for (let x = 1; x < 23; x++) {
    const red = Math.floor((x - 1) / 3) % 2 === 0;
    p.rect(x, 8, 1, 6, red ? J.red : J.cream);
    p.px(x, 13, red ? J.redDark : J.creamDark);
  }
  // The ribbon over the lid, and snow along its top edge and in drifts.
  p.rect(10, 8, 4, 6, J.green);
  p.rect(10, 8, 1, 6, J.greenLight);
  p.rect(13, 8, 1, 6, J.greenDark);
  for (const x of [2, 3, 4, 7, 8, 9, 14, 15, 16, 19, 20, 21]) p.px(x, 8, J.snow);
  for (const x of [3, 8, 15, 20]) p.px(x, 9, J.frost);
  p.px(1, 9, J.snow);
  p.px(22, 9, J.snow);
  bow(p, 7);
  candle(p, 20, 7, false);
}

function drawOpen(p: Pen, frame: number): void {
  p.rect(2, 25, 20, 2, C.shadow);
  p.rect(3, 26, 18, 1, "rgba(242, 193, 78, 0.45)");
  // The lid, stood up behind: the awning stripes seen from below, the ribbon down its middle.
  p.rect(1, 0, 22, 12, C.ink);
  for (let x = 2; x < 22; x++) {
    const red = Math.floor((x - 2) / 3) % 2 === 0;
    p.rect(x, 1, 1, 10, red ? J.redDark : J.creamDark);
    p.rect(x, 1, 1, 3, red ? J.red : J.cream);
  }
  p.rect(10, 1, 4, 10, J.green);
  p.rect(10, 1, 1, 10, J.greenLight);
  p.rect(13, 1, 1, 10, J.greenDark);
  for (const x of [2, 3, 6, 7, 16, 17, 20, 21]) p.px(x, 1, J.snow);
  // The body, its mouth full of candlelight.
  body(p, 14);
  p.rect(0, 11, 24, 3, C.ink);
  p.rect(1, 12, 22, 2, J.gold);
  p.rect(4, 12, 16, 1, J.goldLight);
  p.rect(1, 11, 22, 1, J.wood);
  p.px(1, 12, J.goldDark);
  p.px(22, 12, J.goldDark);
  // The warm beam rising out.
  p.rect(5, 9, 14, 2, "rgba(255, 220, 130, 0.65)");
  p.rect(8, 8, 8, 1, "rgba(255, 240, 190, 0.5)");
  p.rect(10, 9, 4, 2, "rgba(255, 250, 225, 0.85)");
  if (frame === 0) {
    // A puff of flour-fine snow.
    p.rect(9, 5, 6, 2, "rgba(255, 255, 255, 0.85)");
    p.rect(7, 6, 10, 1, "rgba(255, 255, 255, 0.7)");
    p.rect(10, 3, 4, 1, "rgba(255, 255, 255, 0.6)");
    p.px(5, 4, J.frost);
    p.px(18, 3, J.frost);
    p.px(20, 8, J.frost);
  } else {
    // A few paper stars drifting up.
    const stars: [number, number, string][] = [
      [12, 3, J.gold],
      [7, 5, J.red],
      [17, 6, J.cream],
      [14, 7, J.red],
      [9, 7, J.gold],
    ];
    for (const [x, y, c] of stars) {
      p.px(x, y, c);
      p.px(x - 1, y, c);
      p.px(x + 1, y, c);
      p.px(x, y - 1, c);
      p.px(x, y + 1, c);
    }
    p.px(12, 3, J.goldLight);
  }
}

function drawKey(p: Pen): void {
  // The twisted cord through the hole, up top: red and white, a stripe a pixel.
  p.rect(6, 0, 4, 1, C.ink);
  p.rect(5, 1, 1, 3, C.ink);
  p.rect(10, 1, 1, 3, C.ink);
  for (const x of [6, 9]) for (let y = 1; y < 4; y++) p.px(x, y, (y + x) % 2 ? J.red : J.cream);
  // The coin: ink ring, gold face, a darker inner ring, a highlight and a shaded edge.
  p.disc(8, 9, 7, C.ink);
  p.disc(8, 9, 6, J.gold);
  p.disc(8, 9, 5, J.goldDark);
  p.disc(8, 9, 4, J.gold);
  p.px(4, 6, J.goldLight);
  p.px(5, 5, J.goldLight);
  p.px(6, 4, J.goldLight);
  p.px(3, 8, J.goldLight);
  p.px(12, 13, J.goldDark);
  p.px(11, 14, J.goldDark);
  // The hole it hangs by.
  p.rect(7, 5, 2, 2, C.ink);
  // The woven heart stamp.
  p.grid(HEART, { r: J.red, w: J.goldLight }, 6, 8);
  // The cord's end below: a knot, then two twisted tails.
  p.rect(7, 16, 2, 1, C.ink);
  p.rect(6, 17, 4, 2, C.ink);
  p.rect(7, 17, 2, 1, J.cream);
  p.rect(4, 19, 8, 5, C.ink);
  for (let y = 19; y < 24; y++) {
    p.px(5, y, y % 2 ? J.red : J.cream);
    p.px(6, y, y % 2 ? J.cream : J.red);
    p.px(9, y, y % 2 ? J.cream : J.red);
    p.px(10, y, y % 2 ? J.red : J.cream);
  }
  p.rect(7, 19, 2, 5, C.ink);
}

/** Draws the Julemarked case's `kind` into `p` (the same canvas sizes as the other cases'). */
export function drawJulemarkedBox(p: Pen, kind: "closed" | "open" | "key", frame: number): void {
  if (kind === "closed") drawClosed(p);
  else if (kind === "open") drawOpen(p, frame);
  else drawKey(p);
}

// The opening screen's pointer: a tiny nisse in a red cap, white beard, facing right. 6x6.
// prettier-ignore
const POINTER = [
  "..rr..",
  ".rrrr.",
  ".ofeo.",
  ".wwwwo",
  ".gggg.",
  ".k..k.",
];

/** The nisse that perches on the Julemarked opening strip's marker (`CaseOpening.tsx`). Cached: do not draw into it. */
export const nissePointer = once(() =>
  bake(6, 6, (p) =>
    p.grid(POINTER, { r: J.red, o: C.ink, f: "#f0c8a0", e: C.ink, w: J.cream, g: "#8a8f98", k: "#6b3f22" }),
  ),
);
