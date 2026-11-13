import { JULEMARKED_BASE } from "@tokenmaxxing/core/case-julemarked.ts";
import type { Pen } from "./pixels.ts";

/**
 * The Julemarked case's four legendary auras in 2D (`core/src/case-julemarked.ts`, slot "aura"): the draws
 * `case-aura.ts` files under `JULEMARKED_BASE + n`, on the same 28×28 frame with the 16×16 character at (6, 6),
 * eight frames to a loop (every motion below is periodic in 8 frames). They use the whole canvas, edge to edge,
 * in several layers (glow, body, trails, sparkle) and out-shine the coin stalls' plain items.
 */

const CX = 14;
const CY = 14;
const TAU = Math.PI * 2;
const FRAMES = 8;
const SIZE = 28;

type Draw = (p: Pen, f: number) => void;

/** A pen wrapper that drops anything off the canvas, so the layers can overshoot their edges safely. */
const safe = (p: Pen) => ({
  px: (x: number, y: number, c: string) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) p.px(x, y, c);
  },
  /** A filled disc, clipped. */
  disc: (cx: number, cy: number, radius: number, c: string) => {
    const r = Math.round(radius);
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y + 0.5));
      const ccy = Math.round(cy);
      for (let x = -half; x <= half; x++) {
        const px = Math.round(cx) + x;
        const py = ccy + y;
        if (px >= 0 && py >= 0 && px < SIZE && py < SIZE) p.px(px, py, c);
      }
    }
  },
});

const rgba = (r: number, g: number, b: number, a: number) =>
  `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a)).toFixed(2)})`;

// ---------------------------------------------------------------------------------------------------------------
// Julestjerne: nine woven paper stars (red, white, gold) on three orbits at three heights, each with a fading
// sparkle trail, a gold halo and a twinkle that flashes its tips; loose glints drift between them.
// prettier-ignore
const STAR_7 = ["...a...", "..aba..", ".abbba.", "abbcbba", ".abbba.", "..aba..", "...a..."];
// prettier-ignore
const STAR_5 = ["..a..", ".aba.", "abcba", ".aba.", "..a.."];
// prettier-ignore
const STAR_3 = [".a.", "aba", ".a."];
const STAR_COLS: [string, string, string][] = [
  ["#c8102e", "#f4ecd8", "#fff3c0"],
  ["#f4ecd8", "#c8102e", "#f2c14e"],
  ["#f2c14e", "#fff3c0", "#ffffff"],
];
const stars: Draw = (raw, f) => {
  const p = safe(raw);
  // Nine stars: sizes 7, 5, 3 cycling, three orbits (radius, height, direction, tilt).
  const orbits = [
    { r: 10, y: -7, dir: 1, ry: 2.6 },
    { r: 11, y: 1, dir: -1, ry: 3.2 },
    { r: 9.5, y: 8, dir: 1, ry: 2.4 },
  ];
  type Star = { x: number; y: number; i: number; a: number; k: number; back: boolean };
  const list: Star[] = [];
  for (let i = 0; i < 9; i++) {
    const o = orbits[i % 3]!;
    const k = Math.floor(i / 3);
    const a = o.dir * (f / FRAMES) * TAU + (k * TAU) / 3 + i * 0.55;
    list.push({
      x: CX + Math.cos(a) * o.r,
      y: CY + o.y + Math.sin(a) * o.ry,
      i,
      a,
      k,
      back: Math.sin(a) < -0.3,
    });
  }
  // A warm golden dusk behind it all.
  p.disc(CX, CY - 1, 12, rgba(255, 200, 90, 0.04));
  for (const s of list.sort((u, v) => Number(v.back) - Number(u.back))) {
    const o = orbits[s.i % 3]!;
    const grid = s.i % 3 === 0 ? STAR_7 : s.i % 3 === 1 ? STAR_5 : STAR_3;
    const h = (grid.length - 1) / 2;
    const [c1, c2, c3] = STAR_COLS[s.i % 3]!;
    const dim = s.back ? 0.55 : 1;
    // The sparkle trail: five points back along the orbit, fading.
    for (let t = 1; t <= 6; t++) {
      const a = s.a - o.dir * t * 0.15;
      const x = CX + Math.cos(a) * o.r;
      const y = CY + o.y + Math.sin(a) * o.ry;
      p.px(
        x,
        y,
        t % 2 ? rgba(255, 236, 160, (0.75 - t * 0.1) * dim) : rgba(255, 255, 255, (0.55 - t * 0.07) * dim),
      );
    }
    p.disc(s.x, s.y, h + 2, rgba(255, 214, 110, 0.09 * dim));
    const tw = (f + s.i * 3) % 4;
    const x0 = Math.round(s.x) - h;
    const y0 = Math.round(s.y) - h;
    for (const [dy, row] of grid.entries())
      for (const [dx, c] of [...row].entries()) {
        if (c === ".") continue;
        const col = c === "a" ? (tw === 0 ? c3 : c1) : c === "b" ? c2 : c3;
        p.px(x0 + dx, y0 + dy, s.back ? rgba(255, 244, 220, 0.5) : col);
      }
    // The twinkle: for one frame in four the star throws a bright cross past its tips.
    if (tw === 0 && !s.back) {
      p.px(s.x - h - 2, s.y, "#ffffff");
      p.px(s.x + h + 2, s.y, "#ffffff");
      p.px(s.x, s.y - h - 2, "#ffffff");
      p.px(s.x, s.y + h + 2, "#ffffff");
    }
  }
  // Loose glints in the gaps, each a little cross that blinks on its own beat.
  for (let i = 0; i < 9; i++) {
    const x = 2 + ((i * 11 + 5) % 25);
    const y = 1 + ((i * 7 + 3) % 25);
    const ph = (f + i * 2) % 8;
    if (ph < 3) {
      p.px(x, y, "#ffffff");
      if (ph === 1) {
        p.px(x - 1, y, rgba(255, 236, 160, 0.8));
        p.px(x + 1, y, rgba(255, 236, 160, 0.8));
        p.px(x, y - 1, rgba(255, 236, 160, 0.8));
        p.px(x, y + 1, rgba(255, 236, 160, 0.8));
      }
    }
  }
};

// ---------------------------------------------------------------------------------------------------------------
// Adventskrans: a thick fir wreath ringing the hips with a red bow and berries; four candles light up one after
// another (one more every two frames), each with a flame, a warm halo and rising embers, and a glow on the floor.
const wreath: Draw = (raw, f) => {
  const p = safe(raw);
  const cy = CY + 6;
  const rx = 12.6;
  const ry = 4.4;
  const lit = Math.min(4, Math.floor(f / 2) + 1);
  const pos = (a: number, dr = 0) =>
    [CX + Math.cos(a) * (rx + dr), cy + Math.sin(a) * (ry + dr * 0.4)] as const;
  // Warm light thrown on the ground and the air, stronger with every candle.
  for (let k = 0; k < lit; k++) p.disc(CX, cy, 13 - k, rgba(255, 170, 70, 0.045 + 0.01 * k));
  // The candles stand at fixed points: left, back, right, front, lit in that order.
  const slots = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
  const drawWreath = (front: boolean) => {
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * TAU;
      if (Math.sin(a) >= 0 !== front) continue;
      for (const dr of [-1, 0, 1]) {
        const [x, y] = pos(a, dr * 0.9);
        const j = (i * 7 + dr * 3 + 99) % 5;
        p.px(x, y, j === 0 ? "#5aa064" : j < 3 ? "#2f6a3e" : "#24532f");
      }
      if (i % 9 === 0) p.px(...pos(a, 1.6), "#4d8a58");
      // Red berries and a few gold ones.
      if (i % 13 === 4) p.px(...pos(a, 0.2), "#d4262e");
      if (i % 17 === 9) p.px(...pos(a, -0.3), "#f2c14e");
    }
  };
  drawWreath(false);
  slots.forEach((a, i) => {
    const [bx, by] = pos(a);
    const x = Math.round(bx);
    const y = Math.round(by);
    const front = Math.sin(a) >= 0.5;
    if (front) drawWreath(true);
    const on = i < lit;
    const fresh = on && i === lit - 1 && f % 2 === 0;
    // The wax with a red band and a shaded side.
    for (let dy = 0; dy < 5; dy++) {
      p.px(x, y - 1 - dy, dy === 2 ? "#c8102e" : "#fbf4e2");
      p.px(x + 1, y - 1 - dy, dy === 2 ? "#a40e26" : "#e3d3b4");
    }
    p.px(x, y, "#8a6a2a");
    p.px(x + 1, y, "#8a6a2a");
    p.px(x, y - 6, "#3a2a24");
    if (on) {
      const fl = (f + i * 3) % 4;
      p.disc(x + 0.5, y - 8, 5, rgba(255, 190, 80, 0.13));
      p.disc(x + 0.5, y - 8, 3, rgba(255, 200, 90, 0.17));
      p.px(x, y - 7, fl === 2 ? "#ffb84a" : "#f2a233");
      p.px(x, y - 8, fl === 1 ? "#ffd36a" : "#ffe08a");
      p.px(x, y - 9, fl === 3 ? "#fff3c0" : "#ffe9a8");
      if (fl !== 0) p.px(x + (fl === 1 ? 1 : fl === 3 ? -1 : 0), y - 10, "#fff3c0");
      p.px(x - 1, y - 8, rgba(255, 190, 80, 0.55));
      p.px(x + 1, y - 8, rgba(255, 190, 80, 0.55));
      if (fresh)
        for (const [dx, dy] of [
          [-2, -9],
          [2, -9],
          [0, -12],
          [-2, -7],
          [2, -7],
        ] as const)
          p.px(x + dx, y + dy, "#fff3c0");
      // Embers: three per candle, rising and drifting, fading out as they climb.
      for (let e = 0; e < 3; e++) {
        const k = ((f + e * 3 + i * 2) % 8) / 8;
        const ex = x + 0.5 + Math.sin(k * TAU + e * 2 + i) * (1 + k * 2);
        const ey = y - 10 - k * 11;
        if (ey >= 0) p.px(ex, ey, k < 0.55 ? "#ffb84a" : rgba(255, 150, 60, 1 - k));
      }
    }
  });
  drawWreath(true);
  // The red bow at the front, ribbon tails hanging.
  const bx = CX;
  const by = Math.round(cy + ry + 1);
  for (const [dx, dy, c] of [
    [-3, -1, "#b8302c"],
    [-2, -1, "#d4262e"],
    [-2, 0, "#d4262e"],
    [-1, 0, "#d4262e"],
    [1, 0, "#d4262e"],
    [2, 0, "#d4262e"],
    [2, -1, "#d4262e"],
    [3, -1, "#b8302c"],
    [0, 0, "#f06a6a"],
    [0, -1, "#9a2024"],
    [-1, 1, "#b8302c"],
    [1, 1, "#b8302c"],
    [-1, 2, "#9a2024"],
    [1, 2, "#9a2024"],
  ] as const)
    p.px(bx + dx, by + dy, c);
};

// ---------------------------------------------------------------------------------------------------------------
// Snefnug: three layers of snowfall: a faint far layer of dust, a middle layer swirling round the body, and big
// near crystals (5×5 and 3×3 flakes) turning slowly in the front, sparkling; a frost mist pools at the hem.
// prettier-ignore
const FLAKE_5 = ["a.b.a", ".aba.", "bbcbb", ".aba.", "a.b.a"];
// prettier-ignore
const FLAKE_3 = [".a.", "aba", ".a."];
const snow: Draw = (raw, f) => {
  const p = safe(raw);
  // Frost mist, a cold pale haze at the foot.
  for (let y = 18; y < 28; y++)
    p.disc(CX, y, 12 - (y - 18) * 0.4, rgba(200, 228, 246, 0.03 + (y - 18) * 0.006));
  // Far layer: tiny, dim, slow (14 px a loop, two copies), drifting side to side.
  for (let i = 0; i < 16; i++) {
    const y = ((i * 11 + (f * 14) / FRAMES) % 14) + (i % 2) * 14;
    const x = 1 + ((i * 17) % 26) + Math.sin(((f / FRAMES) * 1 + i * 0.13) * TAU) * 0.9;
    p.px(x, y, rgba(190, 220, 240, 0.5));
  }
  // Middle layer: bright dots swirling in a loose spiral round the figure, one fall per loop.
  for (let i = 0; i < 22; i++) {
    const y = (i * 9 + (f * 28) / FRAMES) % 28;
    const a = i * 2.1 + (f / FRAMES) * TAU + y * 0.16;
    const r = 7 + (i % 5) * 1.7;
    const x = CX + Math.cos(a) * r;
    p.px(x, y, i % 3 === 0 ? "#bcd8e8" : "#ffffff");
    if (i % 4 === 0) {
      p.px(x - 1, y - 1, rgba(255, 255, 255, 0.45));
      p.px(x - 1, y - 2, rgba(255, 255, 255, 0.2));
    }
  }
  // Near layer: big crystals, three of each size, turning (the arms swap colours) and twinkling.
  for (let i = 0; i < 6; i++) {
    const big = i < 3;
    const y = (i * 13 + 4 + (f * 28) / FRAMES) % 28;
    const a = i * 1.37 + (f / FRAMES) * TAU * (i % 2 ? -1 : 1) + y * 0.1;
    const x = CX + Math.cos(a) * (10 - (i % 3) * 0.6);
    const grid = big ? FLAKE_5 : FLAKE_3;
    const h = big ? 2 : 1;
    const spark = (f + i * 2) % 4 === 0;
    p.disc(x, y, h + 1, rgba(190, 224, 246, 0.1));
    for (const [dy, row] of grid.entries())
      for (const [dx, c] of [...row].entries()) {
        if (c === ".") continue;
        const swap = (f + i) % 2 === 0;
        const col = c === "c" ? "#ffffff" : (c === "a") !== swap ? "#e8f6ff" : "#a8d0ea";
        p.px(x - h + dx, y - h + dy, col);
      }
    if (spark) {
      p.px(x, y - h - 2, "#ffffff");
      p.px(x, y + h + 2, rgba(255, 255, 255, 0.7));
      p.px(x - h - 2, y, rgba(255, 255, 255, 0.7));
      p.px(x + h + 2, y, "#ffffff");
    }
  }
};

// ---------------------------------------------------------------------------------------------------------------
// Nordlys: four overlapping ribbon curtains the full width of the frame, green into teal into violet, each wave
// travelling on its own beat, with vertical rays shimmering through them, bright folds at the hem and a few stars.
const nordlys: Draw = (raw, f) => {
  const p = safe(raw);
  const t = (f / FRAMES) * TAU;
  // Each curtain: a base height, a wave phase, and its hue from the top (violet) to the hem (green).
  const curtains = [
    { top: 2, len: 19, ph: 0, dir: 1, k: 1.0 },
    { top: 5, len: 17, ph: 2.1, dir: -1, k: 0.8 },
    { top: 1, len: 15, ph: 4.0, dir: 1, k: 0.65 },
    { top: 7, len: 18, ph: 5.3, dir: -1, k: 0.55 },
  ];
  // A deep teal sky tint at the top.
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < SIZE; x++) if ((x + y) % 2 === 0) p.px(x, y, rgba(60, 40, 120, 0.06));
  for (const [ci, c] of curtains.entries()) {
    for (let x = 0; x < SIZE; x++) {
      const wave =
        Math.sin(x * 0.42 + c.dir * t + c.ph) * 2.6 + Math.sin(x * 0.17 - c.dir * 2 * t + c.ph) * 1.7;
      const top = Math.round(c.top + wave);
      const bottom = Math.round(top + c.len + Math.sin(x * 0.3 + t + c.ph) * 2.2);
      // Rays: the curtain is brighter on narrow vertical streaks that slide along it.
      const ray = 0.6 + 0.4 * Math.sin(x * 1.9 + c.dir * t * 2 + ci);
      for (let y = top; y < bottom; y++) {
        const k = (y - top) / (bottom - top);
        const a = c.k * ray * (0.1 + 0.4 * Math.sin(k * Math.PI * 0.92 + 0.1)) * (k < 0.08 ? k * 12 : 1);
        // Violet crown, teal waist, green hem.
        const col =
          k < 0.32 ? rgba(150, 100, 255, a) : k < 0.62 ? rgba(70, 220, 210, a) : rgba(90, 245, 150, a);
        p.px(x, y, col);
      }
      // The folds: a bright thread at the hem, with a pale glow beneath.
      p.px(x, bottom, rgba(190, 255, 215, 0.85 * c.k * ray));
      p.px(x, bottom + 1, rgba(120, 250, 190, 0.3 * c.k * ray));
    }
  }
  // Shimmer: bright specks that appear in the curtain and fade out, out of step with each other.
  for (let i = 0; i < 14; i++) {
    const ph = (f + i * 3) % 8;
    if (ph > 3) continue;
    const x = (i * 13 + 2) % 28;
    const y = 4 + ((i * 7) % 16);
    p.px(x, y, ph === 1 ? "#ffffff" : rgba(210, 255, 235, 0.8));
  }
  // Stars between the curtains.
  for (let i = 0; i < 5; i++) if ((f + i) % 3 !== 0) p.px(1 + ((i * 7) % 26), (i * 11) % 6, "#ffffff");
};

/** The draws by look index, for `case-aura.ts` to file with the other cases'. */
export const JULEMARKED_AURAS: Record<number, Draw> = {
  [JULEMARKED_BASE + 0]: stars,
  [JULEMARKED_BASE + 1]: wreath,
  [JULEMARKED_BASE + 2]: snow,
  [JULEMARKED_BASE + 3]: nordlys,
};
