import { JULEMARKED_BASE } from "@tokenmaxxing/core/case-julemarked.ts";
import type { Pen } from "./pixels.ts";

/**
 * The Julemarked case's four legendary auras in 2D (`core/src/case-julemarked.ts`, slot "aura"): the draws
 * `case-aura.ts` files under `JULEMARKED_BASE + n`, on the same 28×28 frame with the 16×16 character at (6, 6),
 * eight frames to a loop. Warm and calm: paper, candles, snow, and the one soft green of the northern lights.
 */

const CX = 14;
const CY = 14;
const TAU = Math.PI * 2;
const FRAMES = 8;

type Draw = (p: Pen, f: number) => void;

// Julestjerne: woven paper stars in red, white and gold orbiting at their own heights, a slow ring.
// prettier-ignore
const STAR_4 = [".a.", "aba", ".a."];
// prettier-ignore
const STAR_8 = ["a.a.a", ".aba.", "abbba", ".aba.", "a.a.a"];
const STAR_COLS: [string, string][] = [
  ["#c8102e", "#f4ecd8"],
  ["#f4ecd8", "#c8102e"],
  ["#f2c14e", "#fff3c0"],
  ["#c8102e", "#f2c14e"],
  ["#f4ecd8", "#d8b070"],
  ["#f2c14e", "#c8102e"],
];
const stars: Draw = (p, f) => {
  for (let i = 0; i < 6; i++) {
    const a = (f / FRAMES) * TAU + (i * TAU) / 6;
    const big = i % 3 === 0;
    const x = Math.round(CX + Math.cos(a) * 11) - (big ? 2 : 1);
    const y = Math.round(CY + Math.sin(a) * 2.5 + [-6, 1, -2, 5, -4, 3][i]!) - (big ? 2 : 1);
    const [a1, b1] = STAR_COLS[i]!;
    p.grid(big ? STAR_8 : STAR_4, { a: a1, b: b1 }, x, y);
  }
};

// Adventskrans: a thin green wreath ring at hip height, four cream candles with gold flames that flicker out of phase.
const wreath: Draw = (p, f) => {
  const ry = 3.6;
  const cy = CY + 5;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    p.px(Math.round(CX + Math.cos(a) * 11.5), Math.round(cy + Math.sin(a) * ry), i % 3 ? "#2f5d3a" : "#4d8a58");
  }
  // The red ribbon bow at the front.
  p.px(CX - 1, Math.round(cy + ry), "#b8302c");
  p.px(CX + 1, Math.round(cy + ry), "#b8302c");
  p.px(CX, Math.round(cy + ry), "#e0605a");
  for (let i = 0; i < 4; i++) {
    const a = (f / FRAMES) * TAU * 0.25 + (i * TAU) / 4 + 0.6;
    const x = Math.round(CX + Math.cos(a) * 11.5);
    const y = Math.round(cy + Math.sin(a) * ry);
    // The wax, a red band, and the flame.
    p.rect(x, y - 3, 2, 3, "#f4ecd8");
    p.px(x, y - 2, "#c8102e");
    const flick = (f + i * 3) % 4;
    p.px(x, y - 4, flick === 1 ? "#ffd36a" : "#f2c14e");
    if (flick !== 2) p.px(x, y - 5, "#fff3c0");
    p.px(x + 1, y - 4 - (flick === 3 ? 1 : 0), "rgba(242, 193, 78, 0.5)");
    p.px(x - 1, y - 4, "rgba(242, 193, 78, 0.3)");
  }
};

// Snefnug: fresh snow spiralling down a wide column; single pixels and a few plus-shaped flakes, never fast.
const snow: Draw = (p, f) => {
  for (let i = 0; i < 18; i++) {
    const fall = (i * 7 + f * 3) % 26;
    const a = i * 2.3 + fall * 0.22;
    const x = Math.round(CX + Math.cos(a) * (6 + (i % 4) * 2));
    const y = 1 + fall;
    const col = i % 3 === 0 ? "#bcd8e8" : "#ffffff";
    p.px(x, y, col);
    if (i % 5 === 0) {
      p.px(x - 1, y, "#bcd8e8");
      p.px(x + 1, y, "#bcd8e8");
      p.px(x, y - 1, "#bcd8e8");
      p.px(x, y + 1, "#bcd8e8");
    }
  }
};

// Nordlys: three soft curtains of pale green, a hint of frost blue at the hem, rippling slowly behind and around.
const nordlys: Draw = (p, f) => {
  const t = (f / FRAMES) * TAU;
  for (const [c0, ph] of [[6, 0], [14, 2.1], [22, 4.2]] as const) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = c0 + dx;
      const wave = Math.round(Math.sin(t + ph + dx * 0.6) * 1.5);
      const top = 3 + wave + (c0 === 14 ? 0 : 2);
      const bottom = 20 + Math.round(Math.sin(t * 2 + ph + dx) * 1.2);
      const edge = Math.abs(dx) === 2 ? 0.55 : 1;
      for (let y = top; y < bottom; y++) {
        const k = (y - top) / (bottom - top);
        const a = (0.1 + 0.3 * Math.sin(k * Math.PI)) * edge;
        const col = k > 0.7 ? `rgba(188, 216, 232, ${(a + 0.1).toFixed(2)})` : `rgba(170, 232, 190, ${a.toFixed(2)})`;
        p.px(x, y, col);
      }
      p.px(x, bottom, `rgba(200, 236, 244, ${(0.55 * edge).toFixed(2)})`);
    }
  }
  for (let i = 0; i < 3; i++) p.px(3 + ((i * 9 + f * 2) % 22), 2 + ((i * 5) % 9), "#ffffff");
};

/** The draws by look index, for `case-aura.ts` to file with the other cases'. */
export const JULEMARKED_AURAS: Record<number, Draw> = {
  [JULEMARKED_BASE + 0]: stars,
  [JULEMARKED_BASE + 1]: wreath,
  [JULEMARKED_BASE + 2]: snow,
  [JULEMARKED_BASE + 3]: nordlys,
};
