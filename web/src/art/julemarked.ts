import { JULE_GATE, type StallId } from "@tokenmaxxing/core/julemarked.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { C } from "./palette.ts";
import { bake, cached, hash, once, type Pen } from "./pixels.ts";

/**
 * The Julemarked's 2D art (`core/src/julemarked.ts`): the festive gate in the town (7x3 tiles: two red-brick gate
 * huts under snow roofs, a timber beam with the sign, a wreath, red-and-white bunting and fairy lights, and a
 * warm glow between them), and the courtyard's four stalls (5x3 tiles each, snow-white roofs with red stripes), its
 * Christmas tree (2x2 tiles) and its brick wall. Warm and woolly: nisse red, cream, forest green, candle gold.
 */

const RED = "#b8302c";
const RED_D = "#8c2420";
const DANNEBROG = "#c8102e";
const CREAM = "#f4ecd8";
const SNOW = "#ffffff";
const SNOW_SHADE = "#d9e6f2";
const GREEN = "#2f5d3a";
const GREEN_L = "#437a4d";
const GOLD = "#f2c14e";
const WOOD = "#a06a3c";
const WOOD_D = "#6e4526";
const WOOD_L = "#c08850";
const BRICK = "#9a4335";
const BRICK_D = "#7c3428";
const BRICK_L = "#b4574a";
const MORTAR = "#cdb9a2";
const FROST = "#bcd8e8";

// MARK: Pieces

/** A string of fairy lights from (x0, y0) to (x1, y1), sagging `sag` pixels in the middle: a dark wire and warm bulbs. */
function fairyLights(p: Pen, x0: number, y0: number, x1: number, y1: number, sag: number, every = 4): void {
  const n = Math.abs(x1 - x0);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = Math.round(x0 + (x1 - x0) * u);
    const y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    p.px(x, y, C.ink);
    if (i % every === 2) {
      const k = Math.floor(i / every) % 3;
      p.px(x, y + 1, k === 0 ? GOLD : k === 1 ? "#ff8a6b" : "#fff2b0");
    }
  }
}

/** Red-and-white bunting: a drooping line with a flag every few pixels, from (x0, y0) to (x1, y1). */
function bunting(p: Pen, x0: number, y0: number, x1: number, y1: number, sag: number): void {
  const n = Math.abs(x1 - x0);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = Math.round(x0 + (x1 - x0) * u);
    const y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    p.px(x, y, C.ink);
    // A 3-wide, 3-deep pennant every 4 pixels, alternating red and white.
    if (i % 4 === 1) {
      const red = Math.floor(i / 4) % 2 === 0;
      const c = red ? DANNEBROG : SNOW;
      p.rect(x - 1, y + 1, 3, 1, c);
      p.rect(x - 1, y + 2, 2, 1, c);
      p.px(x - 1, y + 3, c);
      if (!red) {
        p.px(x - 2, y + 1, C.ink);
        p.px(x + 2, y + 1, C.ink);
      }
    }
  }
}

/** A round wreath of spruce with a red bow, centred on (cx, cy). */
function wreath(p: Pen, cx: number, cy: number, r: number): void {
  p.disc(cx, cy, r + 1, C.ink);
  p.disc(cx, cy, r, GREEN);
  p.disc(cx, cy, r - 3, "#3a2f3c");
  for (let a = 0; a < 14; a++) {
    const t = (a / 14) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * (r - 1.5));
    const y = Math.round(cy + Math.sin(t) * (r - 1.5));
    p.px(x, y, a % 3 === 0 ? GREEN_L : "#24472d");
    if (a % 5 === 2) p.px(x, y, GOLD);
  }
  // The bow: two loops and a knot, at the bottom.
  p.rect(cx - 3, cy + r - 2, 2, 2, DANNEBROG);
  p.rect(cx + 1, cy + r - 2, 2, 2, DANNEBROG);
  p.px(cx - 1, cy + r - 1, RED_D);
  p.px(cx, cy + r - 1, RED_D);
  p.px(cx - 1, cy + r, DANNEBROG);
  p.px(cx, cy + r, DANNEBROG);
}

/** A snow cap along the top of something `w` wide, with a soft lower edge. */
function snowCap(p: Pen, x: number, y: number, w: number, deep = 2): void {
  p.rect(x, y, w, deep, SNOW);
  for (let i = 0; i < w; i++) {
    const h = hash(x + i, y, 3);
    if (h < 0.4) p.px(x + i, y + deep, SNOW);
    else if (h < 0.55) p.px(x + i, y + deep, SNOW_SHADE);
  }
}

// MARK: The gate

const W = JULE_GATE.w * TILE;
const H = JULE_GATE.h * TILE;

/** One gate hut: red brick under a snow-white pitched roof with red stripe, a lit window and fairy lights. */
function hut(p: Pen, x: number): void {
  // Brick body.
  p.rect(x, 17, 30, 31, C.ink);
  p.rect(x + 1, 18, 28, 30, BRICK);
  for (let y = 18; y < 47; y += 3) {
    p.rect(x + 1, y + 2, 28, 1, BRICK_D);
    for (let i = y % 6 === 0 ? 0 : 3; i < 28; i += 6) p.rect(x + 1 + i, y, 1, 2, BRICK_D);
  }
  for (let k = 0; k < 14; k++) p.px(x + 2 + Math.floor(hash(x, k, 8) * 26), 19 + Math.floor(hash(k, x, 9) * 27), BRICK_L);
  // A stone plinth.
  p.rect(x, 43, 30, 5, C.ink);
  p.rect(x + 1, 44, 28, 3, C.stoneDark);
  p.rect(x + 1, 44, 28, 1, C.stone);
  // The lit window with a cream frame and a little wreath.
  p.rect(x + 8, 24, 14, 14, C.ink);
  p.rect(x + 9, 25, 12, 12, CREAM);
  p.rect(x + 10, 26, 10, 10, "#ffd98a");
  p.rect(x + 14, 26, 2, 10, CREAM);
  p.rect(x + 10, 30, 10, 2, CREAM);
  p.px(x + 11, 27, "#fff2c8");
  // The pitched roof: three tapering courses, snow on top, a red stripe along the eave.
  p.rect(x - 2, 9, 34, 9, C.ink);
  p.rect(x - 1, 10, 32, 7, SNOW);
  p.rect(x - 1, 14, 32, 2, DANNEBROG);
  p.rect(x - 1, 16, 32, 1, SNOW_SHADE);
  p.rect(x + 2, 5, 26, 5, C.ink);
  p.rect(x + 3, 6, 24, 4, SNOW);
  p.rect(x + 7, 2, 16, 4, C.ink);
  p.rect(x + 8, 3, 14, 3, SNOW);
  for (let i = 0; i < 30; i += 4) p.px(x + i, 17, SNOW);
  // The finial with a gold star.
  p.rect(x + 14, 0, 2, 3, C.ink);
  p.px(x + 14, 0, GOLD);
  p.px(x + 15, 0, GOLD);
  // Fairy lights down the corner and along the eave.
  fairyLights(p, x - 1, 17, x + 30, 17, 3, 3);
}

/** The gate, from its top-left tile: two huts, a beam with the sign, a wreath, bunting and the glow between. */
export const julemarkedGate = once(() =>
  bake(W, H, (p) => {
    p.rect(2, H - 2, W - 4, 2, C.shadow);
    const left = 2;
    const right = W - 32;
    // The passage between the huts: a warm dusk with a blur of fairy lights, over paving at the bottom.
    const x0 = left + 30;
    const x1 = right;
    for (let y = 18; y < H - 3; y++) {
      const u = (y - 18) / (H - 21);
      p.rect(x0, y, x1 - x0, 1, u < 0.5 ? (u < 0.25 ? "#2b2a4a" : "#3d3556") : u < 0.8 ? "#5a4560" : "#8a5a58");
    }
    for (let i = 0; i < 26; i++) {
      const bx = x0 + 3 + Math.floor(hash(i, 4, 21) * (x1 - x0 - 6));
      const by = 22 + Math.floor(hash(4, i, 22) * 18);
      p.px(bx, by, i % 3 === 0 ? "#fff2b0" : GOLD);
      if (i % 4 === 0) p.px(bx + 1, by, "rgba(255,226,138,0.5)");
    }
    // A far Christmas tree in the glow.
    const tx = Math.floor((x0 + x1) / 2);
    for (let r = 0; r < 4; r++) p.rect(tx - 1 - r, 30 + r * 3, 3 + r * 2, 3, "#244a2c");
    p.px(tx, 28, GOLD);
    for (let k = 0; k < 4; k++) p.px(tx - 3 + ((k * 3) % 7), 33 + k, k % 2 ? GOLD : "#ff8a6b");
    // The paving at the passage's foot.
    p.rect(x0, H - 6, x1 - x0, 3, C.plazaDark);
    for (let x = x0; x < x1; x += 5) p.rect(x, H - 6, 1, 3, C.plaza);
    p.rect(x0, H - 6, x1 - x0, 1, C.plazaLight);
    hut(p, left);
    hut(p, right);
    // The beam across the top of the passage, with a snow cap and posts' brackets.
    p.rect(x0 - 2, 13, x1 - x0 + 4, 8, C.ink);
    p.rect(x0 - 1, 14, x1 - x0 + 2, 6, WOOD);
    p.rect(x0 - 1, 14, x1 - x0 + 2, 1, WOOD_L);
    p.rect(x0 - 1, 19, x1 - x0 + 2, 1, WOOD_D);
    snowCap(p, x0 - 2, 11, x1 - x0 + 4, 3);
    // The sign: a red board with the name in cream, gold studs.
    const sw = 46;
    const sx = Math.round((W - sw) / 2);
    p.rect(sx, 12, sw, 11, C.ink);
    p.rect(sx + 1, 13, sw - 2, 9, RED);
    p.rect(sx + 1, 13, sw - 2, 1, "#d24a44");
    const textW = "JULEMARKED".length * 4 - 1;
    p.text("JULEMARKED", Math.round((W - textW) / 2), 15, CREAM);
    for (const dx of [2, sw - 3]) p.px(sx + dx, 14, GOLD);
    for (const dx of [2, sw - 3]) p.px(sx + dx, 20, GOLD);
    // The wreath below the sign, and the lights along the beam.
    wreath(p, Math.round(W / 2), 31, 5);
    fairyLights(p, x0 - 1, 21, Math.round(W / 2) - 8, 22, 3, 3);
    fairyLights(p, Math.round(W / 2) + 8, 22, x1, 21, 3, 3);
    // Bunting from hut to hut across the roofs.
    bunting(p, left + 15, 8, right + 15, 8, 5);
  }),
);

// MARK: Stalls

const SW = 5 * TILE;
const SH = 3 * TILE;

/** A hanging knitted item or paper heart, for the stalls' fronts. */
function paperHeart(p: Pen, x: number, y: number, c: string, c2: string): void {
  p.rect(x, y, 2, 2, c);
  p.rect(x + 3, y, 2, 2, c2);
  p.rect(x, y + 1, 5, 2, c);
  p.rect(x + 1, y + 3, 3, 1, c2);
  p.px(x + 2, y + 4, c);
}

function mug(p: Pen, x: number, y: number, c = CREAM): void {
  p.rect(x, y, 4, 4, C.ink);
  p.rect(x + 1, y + 1, 2, 2, c);
  p.px(x + 4, y + 1, C.ink);
  p.px(x + 4, y + 2, C.ink);
  p.px(x + 1, y + 1, "#7a2a35");
}

function steam(p: Pen, x: number, y: number): void {
  for (const [dx, dy] of [
    [0, 0],
    [1, -2],
    [0, -4],
    [-1, -6],
  ] as const) {
    p.px(x + dx, y + dy, "#f4f0ea");
    p.px(x + dx + 1, y + dy, "rgba(244,240,234,0.5)");
  }
}

/** What each stall has out on its counter and behind it. */
const WARES: Record<StallId, (p: Pen) => void> = {
  nissen: (p) => {
    // Case boxes: red wrapped chests with gold ribbons, and a nisse on the counter keeping an eye on them.
    for (const [x, y, c] of [
      [8, 25, RED],
      [20, 27, "#2f5d3a"],
      [56, 26, RED],
    ] as const) {
      p.rect(x, y, 12, 9, C.ink);
      p.rect(x + 1, y + 1, 10, 7, c);
      p.rect(x + 5, y + 1, 2, 7, GOLD);
      p.rect(x + 1, y + 4, 10, 1, GOLD);
      p.rect(x + 4, y - 2, 4, 2, GOLD);
    }
    // The nisse: a tall red hat, a cream beard, round nose.
    const nx = 40;
    p.rect(nx - 1, 22, 10, 13, C.ink);
    p.rect(nx, 23, 8, 11, "#6d7a8a");
    p.rect(nx + 1, 14, 6, 9, C.ink);
    p.rect(nx + 2, 15, 4, 8, RED);
    p.px(nx + 5, 13, RED);
    p.px(nx + 6, 12, CREAM);
    p.rect(nx + 1, 26, 6, 6, CREAM);
    p.px(nx + 3, 24, "#e9a98a");
    p.px(nx + 4, 24, "#e9a98a");
  },
  godter: (p) => {
    // A big pot of gløgg with steam, cups, and a plate of æbleskiver under powdered sugar.
    p.rect(8, 24, 16, 11, C.ink);
    p.rect(9, 25, 14, 9, C.metal);
    p.rect(9, 25, 14, 2, C.metalLight);
    p.rect(10, 27, 12, 3, "#7a2a35");
    steam(p, 14, 22);
    steam(p, 19, 20);
    for (const x of [30, 36, 42]) mug(p, x, 31);
    p.rect(52, 31, 16, 3, C.ink);
    p.rect(53, 31, 14, 2, CREAM);
    for (const x of [54, 58, 62]) {
      p.disc(x + 1, 29, 2, "#c28a4a");
      p.px(x, 28, SNOW);
      p.px(x + 1, 27, SNOW);
    }
    // Strings of dried apples and a paper bag of almonds.
    p.rect(70, 27, 6, 8, C.ink);
    p.rect(71, 28, 4, 7, "#d8b684");
  },
  pynt: (p) => {
    // Paper hearts, straw stars and little nisser hanging along the back wall; a wreath on the counter.
    for (let i = 0; i < 6; i++) {
      p.rect(8 + i * 12, 16, 1, 5, C.ink);
      paperHeart(p, 6 + i * 12, 20, i % 2 ? DANNEBROG : SNOW, i % 2 ? SNOW : DANNEBROG);
    }
    for (const x of [14, 38, 62]) {
      p.rect(x, 27, 1, 3, C.ink);
      p.px(x, 31, GOLD);
      p.px(x - 1, 32, GOLD);
      p.px(x + 1, 32, GOLD);
      p.px(x, 33, GOLD);
      p.px(x - 2, 31, GOLD);
      p.px(x + 2, 31, GOLD);
    }
    wreath(p, 20, 32, 4);
    // A little row of nisser.
    for (const x of [44, 52, 60]) {
      p.rect(x, 29, 5, 5, "#6d7a8a");
      p.rect(x, 25, 5, 4, RED);
      p.rect(x + 1, 22, 3, 3, RED);
      p.px(x + 2, 31, CREAM);
    }
  },
  varme: (p) => {
    // Knitted hats and mittens on a line, scarves over the counter, a mug of cocoa.
    p.rect(6, 20, 68, 1, C.ink);
    for (let i = 0; i < 5; i++) {
      const x = 8 + i * 13;
      p.rect(x + 3, 18, 1, 3, C.ink);
      const a = i % 2 ? RED : CREAM;
      const b = i % 2 ? CREAM : RED;
      p.rect(x, 21, 7, 7, C.ink);
      p.rect(x + 1, 22, 5, 5, a);
      for (let y = 23; y < 27; y += 2) p.rect(x + 1, y, 5, 1, b);
      p.px(x + 3, 20, b);
    }
    for (let i = 0; i < 4; i++) {
      const x = 12 + i * 15;
      p.rect(x, 32, 12, 3, i % 2 ? RED : GREEN);
      for (let k = 0; k < 12; k += 3) p.rect(x + k, 32, 1, 3, CREAM);
    }
    mug(p, 70, 31, "#7a4a2a");
    steam(p, 71, 29);
  },
};

/** One stall from its top-left tile: a snow roof with red stripes and a scalloped edge, posts, wares and fairy lights. */
export const julemarkedStall = cached(
  (id: StallId, _name: string) => id,
  (id: StallId, name: string) =>
    bake(SW, SH, (p) => {
      p.rect(2, SH - 2, SW - 4, 2, C.shadow);
      // The back wall and the counter.
      p.rect(2, 14, SW - 4, SH - 16, C.ink);
      p.rect(3, 15, SW - 6, 18, WOOD_D);
      for (let x = 5; x < SW - 3; x += 5) p.rect(x, 15, 1, 18, "#5a3a20");
      p.rect(3, 33, SW - 6, 13, WOOD);
      p.rect(3, 33, SW - 6, 2, WOOD_L);
      for (let x = 7; x < SW - 3; x += 8) p.rect(x, 36, 1, 9, WOOD_D);
      p.rect(3, 44, SW - 6, 2, WOOD_D);
      // A cloth along the counter's front, red and white checks.
      for (let x = 4; x < SW - 4; x += 4) {
        const red = (x / 4) % 2 === 0;
        p.rect(x, 38, 4, 5, red ? DANNEBROG : SNOW);
      }
      p.rect(4, 37, SW - 8, 1, C.ink);
      p.rect(4, 43, SW - 8, 1, C.ink);
      WARES[id](p);
      // Posts.
      for (const x of [1, SW - 4]) {
        p.rect(x, 12, 3, SH - 14, C.ink);
        p.rect(x + 1, 13, 1, SH - 16, WOOD);
      }
      // The roof: a snow-white slope with red stripes, a thick snow cap and a scalloped front edge.
      p.rect(0, 0, SW, 15, C.ink);
      p.rect(1, 1, SW - 2, 12, SNOW);
      for (let x = 1; x < SW - 1; x += 10) p.rect(x, 1, 5, 12, DANNEBROG);
      for (let x = 1; x < SW - 1; x += 10) p.rect(x, 1, 1, 12, "#d24a44");
      p.rect(1, 1, SW - 2, 2, SNOW);
      for (let i = 0; i < SW - 2; i++) if (hash(i, id.length, 33) < 0.35) p.px(1 + i, 3, SNOW_SHADE);
      p.rect(1, 11, SW - 2, 2, SNOW_SHADE);
      for (let x = 1; x < SW - 1; x += 5) {
        const red = (x - 1) % 10 < 5;
        p.rect(x, 13, 5, 2, C.ink);
        p.rect(x, 13, 5, 1, red ? DANNEBROG : SNOW);
        p.px(x + 2, 14, red ? DANNEBROG : SNOW);
      }
      // The name on a small board hung at the eave.
      const label = name.toUpperCase();
      const tw = label.length * 4 - 1;
      const bw = tw + 8;
      const bx = Math.round((SW - bw) / 2);
      p.rect(bx, 15, bw, 9, C.ink);
      p.rect(bx + 1, 16, bw - 2, 7, "#4a2c1a");
      p.rect(bx + 1, 16, bw - 2, 1, WOOD_D);
      p.text(label, bx + 4, 18, CREAM);
      // Fairy lights along the eave.
      fairyLights(p, 2, 15, bx - 1, 15, 2, 3);
      fairyLights(p, bx + bw, 15, SW - 3, 15, 2, 3);
    }),
);

// MARK: The tree

/** The market's Christmas tree for its 2x2 tiles: tiers of snowy spruce, fairy lights, red baubles, a gold star and gifts. */
export const julemarkedTree = once(() =>
  bake(2 * TILE, 56, (p) => {
    const cx = TILE;
    p.rect(3, 52, 26, 3, C.shadow);
    // The trunk and the tub.
    p.rect(cx - 2, 46, 4, 6, C.ink);
    p.rect(cx - 1, 46, 2, 6, WOOD_D);
    p.rect(cx - 6, 48, 12, 6, C.ink);
    p.rect(cx - 5, 49, 10, 4, RED);
    p.rect(cx - 5, 49, 10, 1, "#d24a44");
    // Four tiers of boughs, widest at the bottom.
    const tiers: [number, number, number][] = [
      [10, 16, 12],
      [20, 22, 12],
      [31, 28, 12],
      [41, 32, 8],
    ];
    for (const [top, w, h] of tiers.reverse()) {
      for (let r = 0; r < h; r++) {
        const half = Math.round((w / 2) * ((r + 1) / h));
        p.rect(cx - half - 1, top + r, half * 2 + 2, 1, C.ink);
      }
      for (let r = 0; r < h; r++) {
        const half = Math.round((w / 2) * ((r + 1) / h));
        p.rect(cx - half, top + r, half * 2, 1, r % 3 === 0 ? GREEN_L : GREEN);
        // Snow settles on the left edge of each bough.
        if (r % 4 === 3 && half > 2) p.rect(cx - half, top + r, Math.min(half, 4), 1, SNOW);
      }
    }
    // The star.
    p.rect(cx - 1, 2, 2, 7, GOLD);
    p.rect(cx - 3, 4, 6, 2, GOLD);
    p.px(cx - 2, 3, GOLD);
    p.px(cx + 1, 3, GOLD);
    p.px(cx - 2, 6, "#fff2b0");
    // A string of lights and baubles on the tiers.
    fairyLights(p, cx - 5, 20, cx + 5, 22, 2, 3);
    fairyLights(p, cx - 9, 30, cx + 8, 32, 3, 3);
    fairyLights(p, cx - 12, 41, cx + 12, 42, 3, 3);
    for (const [x, y, c] of [
      [cx - 6, 36, RED],
      [cx + 5, 33, GOLD],
      [cx - 2, 28, DANNEBROG],
      [cx + 8, 44, RED],
      [cx - 10, 45, GOLD],
      [cx + 1, 17, GOLD],
    ] as const)
      p.rect(x, y, 2, 2, c);
    // Gifts under it.
    p.rect(cx + 7, 50, 6, 5, C.ink);
    p.rect(cx + 8, 51, 4, 3, GOLD);
    p.rect(cx - 13, 51, 5, 4, C.ink);
    p.rect(cx - 12, 52, 3, 2, FROST);
    p.rect(cx - 11, 51, 1, 3, RED);
  }),
);

// MARK: The wall

/**
 * The courtyard's wall, a Danish brick wall capped with snow, for every `W` tile of the market: the top row of
 * the back wall is the cap, the face below it brick.
 */
export function julemarkedWall(p: Pen, ox: number, oy: number, x: number, y: number, face: boolean): void {
  if (!face) {
    // The top of the wall, seen from above: snow over the coping.
    p.rect(ox, oy, TILE, TILE, SNOW);
    p.rect(ox, oy + TILE - 3, TILE, 3, SNOW_SHADE);
    for (let k = 0; k < 4; k++) p.px(ox + Math.floor(hash(x, y, 40 + k) * TILE), oy + Math.floor(hash(y, x, 44 + k) * 12), FROST);
    return;
  }
  p.rect(ox, oy, TILE, TILE, BRICK);
  for (let j = 0; j < TILE; j += 4) {
    p.rect(ox, oy + j + 3, TILE, 1, MORTAR);
    for (let i = (j / 4) % 2 ? 4 : 0; i < TILE; i += 8) p.rect(ox + i, oy + j, 1, 3, MORTAR);
  }
  for (let k = 0; k < 6; k++)
    p.px(ox + Math.floor(hash(x, y, 50 + k) * TILE), oy + Math.floor(hash(y, x, 56 + k) * TILE), k % 2 ? BRICK_L : BRICK_D);
  // The snow cap's lip and fairy-light bulbs along the wall.
  p.rect(ox, oy, TILE, 3, SNOW);
  p.rect(ox, oy + 3, TILE, 1, SNOW_SHADE);
  if (x % 3 === 0) {
    p.px(ox + 7, oy + 5, GOLD);
    p.px(ox + 8, oy + 5, "#fff2b0");
  }
  p.rect(ox, oy + TILE - 3, TILE, 3, BRICK_D);
}
