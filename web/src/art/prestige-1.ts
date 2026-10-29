import { C } from "./palette.ts";
import type { Art } from "./editions.ts";
import type { Pen } from "./pixels.ts";
import type { TrackArt } from "./prestige-types.ts";
import type { Back, BackView, Outfit } from "./wardrobe.ts";

/**
 * Prestige track 1, Ascendant, in 2D (`core/src/prestige.ts`): violet and silver, runes and rising light. The visor,
 * the robes, the runic cape and the Ascending sparks aura; the 3D versions are in `gear3dPrestige1.ts`.
 */

const o = C.ink;
const VIOLET = "#8b5cf6";
const SILVER = "#d6dbe6";
const GLOW = "#c4a8ff";

// MARK: Hat

// Ascendant visor: a violet crown with a silver band round the brow and a dark violet lens set in under it, a bright
// rune stone at the top, and two swept-back wings of light rising off the temples. It stops above the eyes.
// Pixel art reads as a grid.
// prettier-ignore
const HAT: Art = {
  down: [
    "..w....gg....w..",
    "..Sw..oVVo..wS..",
    "...oSoVVVVoSo...",
    "...oSVVLVVVSo...",
    "...oSSSSSSSSo...",
    "....oLvvvvLo....",
  ],
  side: [
    ".....w..gg......",
    "....Sw.oVo......",
    "....oSoVVVo.....",
    "....oSVVLVVo....",
    "....oSSSSSSo....",
    ".....oLvvvVo....",
  ],
  up: [
    "..w..........w..",
    "..Sw..oooo..wS..",
    "...oSoVVVVoSo...",
    "...oSVVVVVVSo...",
    "...oSSSSSSSSo...",
    "....oSSSSSSo....",
  ],
  pal: { o, S: SILVER, w: "#ffffff", g: GLOW, V: VIOLET, v: "#5b34c4", L: "#e4d6ff" },
};

// MARK: Outfit

// Ascendant robes: long violet robes with a silver collar, a silver sash and hem, and runes picked out in light.
// Marks sit over the body from row 9; the fourth row lands on the trousers' row, so the robe hangs to the knee.
// Pixel art reads as a grid.
// prettier-ignore
const OUTFIT: Outfit = {
  c: "#6d3fd0", C: "#4c2a9c", p: "#3b2478",
  marks: {
    down: ["....SvvSSvvS....", "....vvgSSgvv....", "....DDDSSDDD....", "....SvvSSvvS...."],
    side: ["....Svvgv.......", "....vvgSv.......", "....DDDSD.......", "....SvvSS......."],
    up: ["....SvvSSvvS....", "....vvvgSvvv....", "....DDDDDDDD....", "....SvgvvgvS...."],
  },
  pal: { S: SILVER, g: GLOW, v: "#6d3fd0", D: "#34206b" },
};

// MARK: Back

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
const view = (front: string[]): BackView => ({ front });

// Runic cape: a violet cape with a silver lining at the edge and a rune on each hem that lights as they walk (`r`
// dim, `g` lit). The walking frame also lifts the hem.
const CAPE_DOWN = frameAt(
  [
    "................",
    "...oo......oo...",
    "..oSvo....ovSo..",
    "..oSVo....oVSo..",
    "..oSVo....oVSo..",
    "..oSvo....ovSo..",
    "...oSvVvvVvSo...",
    "....oooooooo....",
  ],
  8,
);
const CAPE_SIDE = frameAt(
  [
    "................",
    ".....o..........",
    "....oS..........",
    "...oSV..........",
    "..oSvV..........",
    "..oSvV..........",
    ".oSvVV..........",
    ".ooooo..........",
  ],
  8,
);
const CAPE_SIDE_B = frameAt(
  [
    "................",
    ".....o..........",
    "....oS..........",
    "...oSV..........",
    "..oSvV..........",
    ".oSvVV..........",
    "oSvVVg..........",
    "oooooo..........",
  ],
  8,
);
const capeUp = (rune: string): string[] =>
  frameAt(
    [
      "....oooooooo....",
      "....oSSSSSSo....",
      "...oSvvVVvvSo...",
      `...oSVV${rune}${rune}VVSo...`,
      `...oSV${rune}VV${rune}VSo...`,
      `...oS${rune}VVVV${rune}So...`,
      "..oSSvVVVVvSSo..",
      "..oooooooooooo..",
    ],
    8,
  );

// Pixel art reads as a grid.
// prettier-ignore
const BACK: Back = {
  views: {
    down: { behind: CAPE_DOWN, front: frameAt(["....S......S...."], 9) },
    side: { behind: CAPE_SIDE, front: frameAt(["......S........."], 9) },
    up: view(capeUp("r")),
  },
  walk: { side: { behind: CAPE_SIDE_B }, up: view(capeUp("g")) },
  pal: { o, S: SILVER, V: VIOLET, v: "#6d3fd0", r: "#7f66c9", g: "#f0e6ff" },
};

// MARK: Aura

const TAU = Math.PI * 2;
const SPARKS = 16;
/** Feathers of light climbing alongside the sparks, each a short leaning silver diagonal on a violet quill. */
const FEATHERS = 3;

/**
 * Ascending sparks: a faint column of violet light stands behind the wearer, a halo of it beats above the head, and
 * sparks and feathers of light lift off and never come down, brightening to silver as they climb.
 */
const sparks = (p: Pen, f: number): void => {
  // A pool of light at the feet, and a faint violet bloom behind the body.
  p.disc(14, 15, 9, "rgba(139, 92, 246, 0.07)");
  p.disc(14, 15, 7, "rgba(139, 92, 246, 0.07)");
  p.rect(9, 23, 10, 1, "rgba(160, 120, 255, 0.45)");
  p.rect(7, 24, 14, 1, "rgba(139, 92, 246, 0.3)");
  p.rect(10, 25, 8, 1, "rgba(139, 92, 246, 0.18)");
  // The halo: a thin ring over the head, swelling and fading on the beat.
  const beat = 0.5 + 0.5 * Math.sin((f / 8) * TAU);
  const ring = `rgba(214, 200, 255, ${0.45 + beat * 0.4})`;
  p.rect(11, 3, 6, 1, ring);
  p.px(10, 4, ring);
  p.px(17, 4, ring);
  p.rect(11, 5, 6, 1, `rgba(139, 92, 246, ${0.3 + beat * 0.3})`);
  for (let i = 0; i < SPARKS; i++) {
    const k = (f / 8 + i / SPARKS) % 1;
    const side = i % 2 ? 1 : -1;
    const x = Math.round(14 + side * (5 + ((i * 5) % 7)) + Math.sin(k * TAU + i * 1.7) * 1.2);
    const y = Math.round(25 - k * 24);
    // Born dim, brightest in the middle of the climb, gone at the top.
    const a = Math.min(1, 0.25 + k * 5, (1 - k) * 2.2);
    p.px(x, y, k > 0.55 ? `rgba(228, 232, 242, ${a})` : `rgba(196, 168, 255, ${a})`);
    if (k > 0.08 && k < 0.85) p.px(x, y + 1, `rgba(150, 100, 250, ${a * 0.8})`);
    if (k > 0.15 && k < 0.7 && i % 2 === 0) p.px(x, y + 2, `rgba(139, 92, 246, ${a * 0.5})`);
    // Every fourth is a little cross of light.
    if (i % 4 === 0 && k > 0.2 && k < 0.85) {
      const c = `rgba(255, 255, 255, ${a * 0.85})`;
      p.px(x - 1, y, c);
      p.px(x + 1, y, c);
      p.px(x, y - 1, c);
    }
  }
  for (let i = 0; i < FEATHERS; i++) {
    const k = (f / 8 + i / FEATHERS + 0.15) % 1;
    const side = i % 2 ? 1 : -1;
    const x = Math.round(14 + side * (9 - i) + Math.sin(k * TAU + i * 2.3) * 1.5);
    const y = Math.round(23 - k * 21);
    const a = Math.min(1, k * 4, (1 - k) * 3);
    const lean = side;
    p.px(x, y, `rgba(255, 255, 255, ${a})`);
    p.px(x + lean, y - 1, `rgba(228, 232, 242, ${a})`);
    p.px(x - lean, y + 1, `rgba(196, 168, 255, ${a})`);
    p.px(x, y + 1, `rgba(139, 92, 246, ${a * 0.8})`);
  }
};

export const TRACK: TrackArt = {
  hat: HAT,
  outfit: OUTFIT,
  back: BACK,
  aura: sparks,
};
