import { C } from "./palette.ts";
import type { Pen } from "./pixels.ts";
import type { TrackArt } from "./prestige-types.ts";
import type { BackView } from "./wardrobe.ts";

/**
 * Prestige track 5, Prismatic, in 2D (`core/src/prestige.ts`): pearl over every colour of the spectrum. The hat is a
 * pearl crown with a gem of a different colour on each point, the regalia a pearl robe with a rainbow yoke and hem,
 * the back item a pair of aurora wings (green through blue and violet to pink), the aura a column of light that
 * rises round you and splits to a rainbow over your head. Three of its colours are the catalogue's own: pearl
 * `#f4f0ff`, pink `#ff7ad9` and ice `#9fe8ff`.
 */

const o = C.ink;
/** The spectrum, red to pink, as the palettes below spell it. */
const SPECTRUM = {
  r: "#ff5d73",
  O: "#ff9a4d",
  y: "#ffe066",
  G: "#5df0a0",
  c: "#5fe0ff",
  b: "#6f9bff",
  v: "#a78bfa",
  p: "#ff7ad9",
};

// MARK: Hat

// Prismatic crown: a pearl crown of five points, a gem of another colour on each, a band of pearl with the whole
// spectrum set along it and a pink stone at the front. Seen from behind the spectrum runs the other way.
// Pixel art reads as a grid.
// prettier-ignore
const HAT = {
  down: [
    ".......pp.......",
    ".....G.ww.v.....",
    "...y.w.ww.w.c...",
    "..owwwwhhwwwwo..",
    "..oWWWWppWWWWo..",
    "..orOyyGcbvppo..",
    "...oooooooooo...",
  ],
  side: [
    ".......pp.......",
    ".....G.ww.v.....",
    "...y.w.ww.w.c...",
    "..owwwwwwwwwwo..",
    "..oWWWWWWWWWWo..",
    "..orOyGcbbvppo..",
    "...oooooooooo...",
  ],
  up: [
    ".......vv.......",
    ".....c.ww.G.....",
    "...b.w.ww.w.y...",
    "..owwwwhhwwwwo..",
    "..oWWWWppWWWWo..",
    "..oppvbcGyyOro..",
    "...oooooooooo...",
  ],
  pal: { o, w: "#f4f0ff", W: "#cfc6ea", h: "#ffffff", ...SPECTRUM },
};

// MARK: Outfit

// Prismatic regalia: pearl robes, a rainbow yoke across the shoulders and the same spectrum round the hem, a pale prism
// brooch with a pink heart at the breast; from behind a pearl panel and a ribbon of the spectrum.
// Marks sit over the body from row 9; a fourth row lands on the trousers' row (a hem).
// Pixel art reads as a grid.
// prettier-ignore
const OUTFIT = {
  c: "#f1ecff", C: "#c9c0ea", p: "#8a7fc0",
  marks: {
    down: ["....rOyGcbvp....", ".....wWppWw.....", "......WppW......", "....rOyGcbvp...."],
    side: ["....rOyGcb......", "....wWppw.......", ".....Wpw........", "....rOyGcb......"],
    up: ["....rOyGcbvp....", ".....hWWWWh.....", "......hWWh......", "....rOyGcbvp...."],
  },
  pal: { ...SPECTRUM, w: "#fbf9ff", W: "#c9c0ea", h: "#ffffff" },
};

// MARK: Back

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
/** The same rows one row higher, the wings lifted for the second step. */
const lifted = (rows: string[]): string[] => [...rows.slice(1), ""];
/** A left half mirrored into the whole: the wings are the same either side. */
const both = (half: string[]): string[] =>
  half.map((r) => r + [...r].reverse().join("").replaceAll("(", ")"));

// Aurora wings: wings of folded light, a feather to a colour, green at the top then cyan, blue, violet and pink at the
// tips, edged in ink and pearl where they join the spine. Seen from the front only the tips show beside the body.
const WINGS_LEFT = [
  ".oG.....",
  "oGcG....",
  "ocbcGG..",
  "obvbccGw",
  "opvvbbcw",
  "oppvvbbw",
  ".oppvvbw",
  "..oppvvw",
  "...oppvw",
  "....oppw",
  ".....opw",
  "......ow",
];
const WINGS = both(WINGS_LEFT);
const WINGS_SIDE = [
  ".........oG.....",
  "........oGcGo...",
  "........ocbcGo..",
  "........obvbcGo.",
  "........opvvbco.",
  "........oppvvbo.",
  ".........oppvbo.",
  "..........oppvo.",
  "...........oppo.",
  "............oo..",
];
const wings = (rows: string[], y: number): BackView => ({ front: frameAt(rows, y) });

// Pixel art reads as a grid.
// prettier-ignore
const BACK = {
  views: {
    down: { behind: frameAt(WINGS, 3) },
    side: { behind: frameAt(WINGS_SIDE, 3) },
    up: wings(WINGS, 3),
  },
  walk: { up: wings(lifted(WINGS), 3), down: { behind: frameAt(lifted(WINGS), 3) } },
  pal: { o, ...SPECTRUM, w: "#f4f0ff" },
};

// MARK: Aura

const CX = 14;
const TAU = Math.PI * 2;
const FRAMES = 8;
const HUES = Object.values(SPECTRUM);

/** The spectrum at `k` (any number): a colour, with `a` for its alpha. */
const hue = (k: number, a = 1): string => {
  const c = HUES[((Math.floor(k) % HUES.length) + HUES.length) % HUES.length]!;
  const n = Number.parseInt(c.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// Prismatic ascension: a funnel of pale light stands round the wearer, bands of every colour climb it, and over the
// head it splits into seven rays that fan out and pulse upward in the spectrum. Pearl sparks drift up its edges.
const ascension = (p: Pen, f: number): void => {
  // The funnel: a faint pearl body that narrows toward the head, brighter edges, a pool of light at the feet.
  const half = (y: number) => (y >= 15 ? 9 : 9 - Math.round((15 - y) * 0.3));
  for (let y = 8; y < 27; y++) {
    const h = half(y);
    p.rect(CX - h, y, h * 2, 1, `rgba(244, 240, 255, ${0.08 + (y - 8) * 0.004})`);
    const edge = (y + f) % 4 < 2 ? 0.75 : 0.45;
    p.px(CX - h, y, `rgba(244, 240, 255, ${edge})`);
    p.px(CX + h - 1, y, `rgba(244, 240, 255, ${edge})`);
  }
  p.rect(CX - 8, 26, 16, 1, "rgba(244, 240, 255, 0.55)");
  p.rect(CX - 5, 27, 10, 1, "rgba(159, 232, 255, 0.45)");
  // Bands of the spectrum climbing it, one colour to a band, rippling.
  for (let i = 0; i < 4; i++) {
    const k = (f / FRAMES + i / 4) % 1;
    const y = 25 - Math.floor(k * 17);
    const h = half(y);
    for (let x = CX - h + 1; x < CX + h - 1; x++) {
      const wave = Math.round(Math.sin((x / 16) * TAU + f * 0.8));
      p.px(x, y + wave, hue(x / 2.3 + i * 2 + f / 2, 0.8 * (1 - k * 0.5)));
    }
  }
  // The rays over the head: seven colours from the top of the column, each pulsing outward a pixel at a time.
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.36;
    const reach = i === 3 ? 8 : 7;
    for (let r = 1; r <= reach; r++) {
      const lit = (r + f * 2) % 8 < 4;
      const x = Math.round(CX - 0.5 + Math.cos(a) * r * 1.5);
      const y = Math.round(8 + Math.sin(a) * r);
      p.px(x, y, hue(i, lit ? 1 : 0.6));
      if (r > 3 && lit) p.px(x, y + 1, hue(i, 0.35));
    }
  }
  p.rect(CX - 1, 7, 2, 2, "#ffffff");
  p.px(CX - 2, 7, "rgba(255, 255, 255, 0.6)");
  p.px(CX + 1, 7, "rgba(255, 255, 255, 0.6)");
  // Sparks of pearl and ice lifting off the edges, each on its own lap.
  for (let i = 0; i < 8; i++) {
    const k = (f / FRAMES + i / 8) % 1;
    const x = i % 2 ? 23 + (i % 3) : 4 - (i % 3);
    const y = Math.round(26 - k * 23);
    p.px(x, y, i % 3 ? "#ffffff" : "#9fe8ff");
    if (i % 4 === 0) p.px(x, y + 1, "rgba(159, 232, 255, 0.5)");
  }
};

export const TRACK: TrackArt = { hat: HAT, outfit: OUTFIT, back: BACK, aura: ascension };
