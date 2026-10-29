/**
 * The five home trophies of the prestige tracks (`PRESTIGE_TRACKS[n].trophy` in core/src/prestige.ts), drawn like the
 * Ragnarok pieces (`furniture-ragnarok.ts`: three-quarter view, ink outlines, `FancyPiece`) and each in its track's
 * colours: an Ascendant obelisk, a Cosmic orrery, a contained Voidwalker black hole, an Architect holographic
 * town and a Prismatic token monument. They are standalone art for now: `prestigeTrophy(rank)` finds one, and
 * the furniture registry is what makes them placeable.
 */
import { PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import type { FancyPiece } from "./furniture-fancy.ts";
import { C } from "./palette.ts";
import type { Pen } from "./pixels.ts";

/** A filled rectangle with a one-pixel ink outline. */
function box(p: Pen, x: number, y: number, w: number, h: number, fill: string): void {
  p.rect(x, y, w, h, C.ink);
  p.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

/** A filled ellipse, pixel-exact. */
function oval(p: Pen, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)) + 0.3);
    p.rect(cx - half, cy + y, half * 2 + 1, 1, color);
  }
}

/** An ink-outlined ellipse. */
function blob(p: Pen, cx: number, cy: number, rx: number, ry: number, fill: string): void {
  oval(p, cx, cy, rx + 1, ry + 1, C.ink);
  oval(p, cx, cy, rx, ry, fill);
}

/** A tapering column from row `y0` to `y1` (inclusive), `w0` wide at the top and `w1` at the bottom, centred on `cx`. */
function column(p: Pen, cx: number, y0: number, y1: number, w0: number, w1: number, fill: string): void {
  const half = (y: number) => (w0 + ((w1 - w0) * (y - y0)) / Math.max(1, y1 - y0)) / 2;
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    const h = half(Math.min(y1, Math.max(y0, y))) + 1;
    p.rect(Math.round(cx - h), y, Math.round(h * 2), 1, C.ink);
  }
  for (let y = y0; y <= y1; y++) {
    const h = half(y);
    p.rect(Math.round(cx - h), y, Math.round(h * 2), 1, fill);
  }
}

const shadow = (p: Pen, x: number, y: number, w: number) => p.rect(x, y, w, 2, C.shadow);

/** Eight 90-degree steps round a circle of radius `r`: the sparkles' four points. */
const sparkle = (p: Pen, x: number, y: number, color: string, big = false) => {
  p.px(x, y, color);
  p.px(x - 1, y, color);
  p.px(x + 1, y, color);
  p.px(x, y - 1, color);
  p.px(x, y + 1, color);
  if (big) {
    p.px(x - 2, y, color);
    p.px(x + 2, y, color);
    p.px(x, y - 2, color);
    p.px(x, y + 2, color);
  }
};

// MARK: Ascendant obelisk

const V = {
  stone: "#2b2347",
  stoneMid: "#3d3163",
  stoneLight: "#54448a",
  deep: "#5b34b8",
  violet: "#8b5cf6",
  glow: "#c4a8ff",
  silver: "#d6dbe6",
  silverDark: "#8f97ab",
  silverLight: "#f4f6fb",
} as const;

/** The vein down the obelisk's face, from the foot to the tip, as (x, y) pixels. */
// prettier-ignore
const VEIN: readonly (readonly [number, number])[] = [
  [8, 30], [8, 29], [7, 28], [7, 27], [7, 26], [8, 25], [8, 24], [9, 23], [9, 22], [9, 21], [8, 20],
  [8, 19], [7, 18], [7, 17], [8, 16], [8, 15], [8, 14], [8, 13], [8, 12], [8, 11], [8, 10],
];
/** The side veins that branch off it. */
// prettier-ignore
const VEIN_BRANCH: readonly (readonly [number, number])[] = [
  [6, 27], [5, 26], [5, 25], [10, 22], [10, 21], [11, 20], [6, 17], [5, 16], [9, 15], [10, 14],
];

/** Violet-veined stone that hums: light climbs the veins to a silver cap, a feather of light rises and fades. */
function obelisk(p: Pen, frame: number): void {
  shadow(p, 1, 38, 14);
  // The silver plinth, two steps.
  box(p, 1, 34, 14, 5, V.silver);
  p.rect(2, 35, 12, 1, V.silverLight);
  p.rect(2, 37, 12, 1, V.silverDark);
  box(p, 3, 31, 10, 4, V.silver);
  p.rect(4, 32, 8, 1, V.silverLight);
  // The shaft: dark violet stone, lit on its left.
  column(p, 8, 12, 31, 7, 9, V.stoneMid);
  p.rect(4, 20, 1, 11, V.stoneLight);
  p.rect(5, 12, 1, 8, V.stoneLight);
  p.rect(11, 20, 1, 11, V.stone);
  p.rect(10, 12, 1, 8, V.stone);
  // Carved courses.
  for (const y of [18, 24, 29]) p.rect(5, y, 6, 1, V.stone);
  // The pyramidion in silver.
  column(p, 8, 4, 11, 2, 6, V.silver);
  p.rect(7, 6, 1, 5, V.silverLight);
  p.rect(9, 8, 1, 3, V.silverDark);
  // The veins glow, and light runs up them: three bright beads a frame apart.
  const beat = [V.deep, V.violet, V.glow, V.violet][frame % 4]!;
  for (const [x, y] of VEIN) p.px(x, y, V.deep);
  for (const [x, y] of VEIN_BRANCH) p.px(x, y, V.deep);
  VEIN.forEach(([x, y], i) => {
    const d = (i - frame * 5 + 20) % 20;
    if (d < 4) p.px(x, y, d < 2 ? V.glow : beat);
  });
  VEIN_BRANCH.forEach(([x, y], i) => {
    if ((i + frame) % 4 === 0) p.px(x, y, V.violet);
  });
  // The tip catches the hum.
  p.px(8, 5, frame % 2 ? V.glow : V.silverLight);
  // A feather of light rising off the tip, bobbing and fading.
  const lift = (frame * 2) % 8;
  const fy = 3 - Math.min(lift, 3);
  p.px(8, fy, V.glow);
  if (lift < 6) {
    p.px(8, fy + 1, V.violet);
    p.px(7 + (frame % 2) * 2, fy, V.violet);
  }
  sparkle(p, 3 + (frame % 2) * 9, 9 - frame, V.glow);
  p.px(13 - (frame % 3), 14 + frame, V.violet);
  p.px(2 + (frame % 3), 26 - frame * 2, V.glow);
}

// MARK: Cosmic orrery

const O = {
  brass: "#e9b73d",
  brassDark: "#b98a1f",
  brassLight: "#f7dc7a",
  night: "#14214d",
  nightMid: "#1f3070",
  cyan: "#22d3ee",
  glow: "#8cf0ff",
  white: "#f2fdff",
} as const;

/** Each world: orbit radius, colour, size (a 2×2 or a 3×3 with a highlight), and how many eighths it moves a frame. */
// prettier-ignore
const WORLDS: readonly { r: number; color: string; lit: string; big: boolean; step: number; start: number }[] = [
  { r: 3, color: "#9aa7c7", lit: "#d9e0f2", big: false, step: 3, start: 0 },
  { r: 5, color: "#f2a65a", lit: "#ffd9a8", big: false, step: 2, start: 3 },
  { r: 6.5, color: "#3b8cf0", lit: "#9fd0ff", big: true, step: 1, start: 5 },
  { r: 8, color: "#e8584f", lit: "#ffa59c", big: false, step: 1, start: 1 },
  { r: 10, color: "#e9c46a", lit: "#fff0b3", big: true, step: 1, start: 6 },
  { r: 12, color: "#8cf0ff", lit: "#ffffff", big: false, step: 2, start: 2 },
];

/** Six worlds on a midnight plate round a lit star, a frame an eighth of the way round for the nearest. */
function orrery(p: Pen, frame: number): void {
  const cx = 16;
  const cy = 18;
  shadow(p, 6, 30, 20);
  // The brass pedestal and foot.
  column(p, cx, 24, 28, 8, 11, O.brass);
  p.rect(cx - 3, 25, 1, 4, O.brassLight);
  box(p, 8, 28, 16, 3, O.brassDark);
  p.rect(9, 29, 14, 1, O.brass);
  // The plate: a brass rim round midnight with a few fixed stars.
  blob(p, cx, cy, 14, 6, O.brass);
  oval(p, cx, cy + 1, 13, 5, O.brassDark);
  oval(p, cx, cy, 13, 5, O.night);
  oval(p, cx - 2, cy - 1, 9, 3, O.nightMid);
  for (const [x, y] of [
    [5, 17],
    [9, 22],
    [24, 21],
    [27, 16],
    [20, 13],
    [12, 14],
  ] as const)
    p.px(x, y, (x + y + frame) % 3 === 0 ? O.white : O.glow);
  // The orbits, as dotted ellipses.
  for (const w of WORLDS)
    for (let i = 0; i < 40; i += 2) {
      const a = (i / 40) * Math.PI * 2;
      p.px(Math.round(cx + Math.cos(a) * w.r), Math.round(cy + Math.sin(a) * w.r * 0.4), O.nightMid);
    }
  const at = (w: (typeof WORLDS)[number]) => {
    const a = ((w.start + frame * w.step) / 8) * Math.PI * 2;
    return {
      x: Math.round(cx + Math.cos(a) * w.r),
      y: Math.round(cy + Math.sin(a) * w.r * 0.4),
      back: Math.sin(a) < 0,
    };
  };
  const world = (w: (typeof WORLDS)[number]) => {
    const { x, y } = at(w);
    if (w.big) {
      p.rect(x - 2, y - 1, 5, 3, C.ink);
      p.rect(x - 1, y - 2, 3, 5, C.ink);
      p.rect(x - 1, y - 1, 3, 3, w.color);
      p.px(x - 1, y - 1, w.lit);
    } else {
      p.rect(x - 1, y - 1, 3, 3, C.ink);
      p.rect(x, y, 2, 2, w.color);
      p.px(x, y, w.lit);
    }
  };
  // Worlds behind the star first, then the post and the star, then the ones in front.
  for (const w of WORLDS) if (at(w).back) world(w);
  box(p, cx - 1, 11, 3, 8, O.brass);
  p.rect(cx - 1, 12, 1, 6, O.brassLight);
  // The star pulses.
  const pulse = frame % 2;
  oval(p, cx, 9, 5 + pulse, 5 + pulse, "#1c5f80");
  blob(p, cx, 9, 3, 3, O.cyan);
  oval(p, cx, 9, 2, 2, O.glow);
  p.px(cx - 1, 8, O.white);
  p.px(cx, 8, O.white);
  sparkle(p, cx, 9, O.white, pulse === 1);
  for (const w of WORLDS) if (!at(w).back) world(w);
  // Saturn's ring, on the big gold world: a band of ink and gold.
  const gold = at(WORLDS[4]!);
  p.rect(gold.x - 3, gold.y, 7, 1, O.brassLight);
  p.px(gold.x - 4, gold.y, C.ink);
  p.px(gold.x + 4, gold.y, C.ink);
}

// MARK: Contained black hole

const B = {
  void: "#0a0610",
  voidMid: "#17101f",
  voidLight: "#2a1a3a",
  magenta: "#d946ef",
  magentaDark: "#7a1f8f",
  glow: "#ff7cf5",
  hot: "#ffe0fb",
  glass: "#b9c4f2",
  glassLight: "#eef0ff",
  steel: "#4a4660",
  steelLight: "#7a7694",
} as const;

/** Where the hole's ring is at angle step `i` of 24. */
const ringAt = (i: number, rx: number, ry: number, cx = 8, cy = 14) => {
  const a = (i / 24) * Math.PI * 2;
  return {
    x: Math.round(cx + Math.cos(a) * rx),
    y: Math.round(cy + Math.sin(a) * ry),
    front: Math.sin(a) > 0,
  };
};

/** A glass cell on a black plinth round a hole: a ring of magenta fire turning, stray light spiralling in. */
function blackHole(p: Pen, frame: number): void {
  shadow(p, 1, 30, 14);
  // The plinth with its hazard stripe.
  box(p, 1, 25, 14, 6, B.voidMid);
  p.rect(2, 26, 12, 1, B.steel);
  for (let x = 2; x < 14; x += 2) p.rect(x, 28, 1, 2, B.magenta);
  for (let x = 3; x < 14; x += 2) p.rect(x, 28, 1, 2, B.voidLight);
  // The cell: a dark void behind glass, with a steel cap and foot.
  box(p, 2, 3, 12, 22, B.void);
  p.rect(3, 4, 10, 20, B.void);
  oval(p, 8, 14, 5, 8, B.voidMid);
  box(p, 1, 1, 14, 3, B.steel);
  p.rect(2, 2, 12, 1, B.steelLight);
  box(p, 1, 22, 14, 3, B.steel);
  p.rect(2, 23, 12, 1, B.steelLight);
  // Stars in the void.
  for (const [x, y] of [
    [4, 7],
    [12, 9],
    [4, 19],
    [12, 18],
    [11, 5],
  ] as const)
    p.px(x, y, (x + y + frame) % 4 === 0 ? B.hot : B.magentaDark);
  // Lensed light from behind the hole, bent over its top and under its bottom.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    p.px(Math.round(8 + Math.cos(a) * 3.6), Math.round(14 - Math.abs(Math.sin(a)) * 4.4), B.magentaDark);
  }
  // The back half of the ring, then the hole, then the front half: the ring turns one place a frame.
  const shade = (i: number) => {
    const k = (i + frame * 3) % 24;
    return k < 3 ? B.hot : k < 8 ? B.glow : k < 16 ? B.magenta : B.magentaDark;
  };
  for (let i = 0; i < 24; i++) {
    const r = ringAt(i, 5, 2);
    if (!r.front) p.px(r.x, r.y, shade(i));
  }
  p.disc(8, 14, 3, B.magentaDark);
  p.disc(8, 14, 2, C.ink);
  p.px(8, 14, B.void);
  for (let i = 0; i < 24; i++) {
    const r = ringAt(i, 5, 2);
    if (r.front) {
      p.px(r.x, r.y, shade(i));
      p.px(r.x, r.y + 1, shade(i + 8) === B.magentaDark ? B.magentaDark : B.magenta);
    }
  }
  // Three motes falling in along spirals, each a third of the cycle behind the last.
  for (let k = 0; k < 3; k++) {
    const t = ((frame + k * 2.67) % 8) / 8;
    const r = 6.5 * (1 - t);
    const a = k * 2.1 + t * 5;
    if (r > 2.5) p.px(Math.round(8 + Math.cos(a) * r), Math.round(14 + Math.sin(a) * r * 0.9), B.hot);
  }
  // The glass: edge highlights down both sides and a glint that slides.
  p.rect(2, 4, 1, 18, B.glass);
  p.rect(13, 4, 1, 18, B.glass);
  p.rect(3, 5, 1, 6, B.glassLight);
  p.rect(4, 6 + (frame % 4) * 3, 1, 3, B.glassLight);
}

// MARK: Holographic town

const H = {
  slab: "#2a2210",
  slabLight: "#4a3c1a",
  deep: "#5c4512",
  gold: "#d4a017",
  cream: "#f5e6b8",
  glow: "#ffe38a",
  dim: "#8a6a14",
} as const;

/** A hologram building: a dark-gold body with bright edges and a lit cap, windows blinking by `phase`. */
function holoBlock(
  p: Pen,
  x: number,
  base: number,
  w: number,
  h: number,
  frame: number,
  phase: number,
): void {
  const top = base - h;
  p.rect(x, top, w, h, H.gold);
  p.rect(x + 1, top + 1, w - 2, h - 1, H.deep);
  p.rect(x, top - 1, w, 1, H.cream);
  p.rect(x + w - 1, top, 1, h, H.dim);
  for (let wy = top + 2; wy < base - 1; wy += 2)
    for (let wx = x + 1; wx < x + w - 1; wx += 2)
      if ((wx + wy + frame + phase) % 3 !== 0) p.px(wx, wy, H.glow);
}

/** The town in blueprint gold over a projector: citizens blink along the streets, a scan line sweeps up it. */
function holoTown(p: Pen, frame: number): void {
  shadow(p, 2, 30, 28);
  // The projector slab and its gold light strip.
  box(p, 2, 25, 28, 6, H.slab);
  p.rect(3, 26, 26, 1, H.slabLight);
  for (let x = 4; x < 28; x += 2) p.px(x, 29, (x / 2 + frame) % 4 === 0 ? H.cream : H.gold);
  // The emitter ring and the town's plate: a diamond of lit ground.
  blob(p, 16, 23, 13, 4, H.slab);
  oval(p, 16, 23, 12, 3, H.deep);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    p.px(Math.round(16 + Math.cos(a) * 12), Math.round(23 + Math.sin(a) * 3), H.gold);
  }
  // The streets, in gold lines on the plate.
  p.rect(6, 23, 20, 1, H.dim);
  p.rect(16, 21, 1, 5, H.dim);
  // The town, back to front: a dome, a tower, two houses, a block, a spire.
  holoBlock(p, 6, 22, 4, 5, frame, 1);
  holoBlock(p, 21, 21, 5, 7, frame, 2);
  // A dome.
  oval(p, 13, 20, 3, 2, H.gold);
  oval(p, 13, 20, 2, 1, H.deep);
  p.rect(10, 20, 7, 1, H.deep);
  p.px(13, 17, H.cream);
  // The tall tower with a spire and a lit crown.
  holoBlock(p, 15, 22, 5, 13, frame, 0);
  p.rect(17, 6, 1, 3, H.cream);
  p.px(17, 5, frame % 2 ? H.glow : H.cream);
  // Front houses with pitched roofs.
  holoBlock(p, 8, 25, 5, 4, frame, 1);
  p.rect(9, 20, 3, 1, H.cream);
  holoBlock(p, 22, 26, 6, 5, frame, 2);
  p.rect(23, 20, 4, 1, H.cream);
  p.rect(24, 19, 2, 1, H.cream);
  // A tree or two, as lit dots.
  for (const [x, y] of [
    [5, 25],
    [14, 25],
    [20, 26],
  ] as const) {
    p.px(x, y, H.glow);
    p.px(x, y + 1, H.gold);
  }
  // Citizens: single lit pixels pacing the streets, blinking in time.
  const walk = frame % 4;
  const citizens: [number, number][] = [
    [8 + walk * 2, 23],
    [26 - walk * 2, 23],
    [16 + (walk % 2), 21 + walk],
    [12 - (walk % 2), 24],
  ];
  citizens.forEach(([x, y], i) => {
    if ((i + frame) % 4 !== 3) p.px(x, y, H.cream);
  });
  // The scan line, sweeping up through the whole town and starting again.
  const sy = 24 - ((frame * 4) % 20);
  p.rect(6, sy, 20, 1, H.cream);
  p.rect(7, sy + 1, 18, 1, H.glow);
}

// MARK: Prismatic token monument

const R = {
  pearl: "#f4f0ff",
  pearlLight: "#ffffff",
  pearlDark: "#c9c2e6",
  pearlShade: "#a69fcc",
  pink: "#ff7ad9",
  ice: "#9fe8ff",
  night: "#231c47",
  nightMid: "#352c66",
} as const;

const RAINBOW = ["#ff5d6c", "#ffa94d", "#ffe66b", "#7bed9f", "#6ec6ff", "#b18cff"] as const;

/** A pearl token the height of a person on a pearl plinth: light enters a prism and leaves as every colour. */
function monument(p: Pen, frame: number): void {
  const cx = 16;
  const cy = 19;
  shadow(p, 4, 45, 24);
  // The plinth: two pearl steps, a pink inlay line, and the cradle the token stands in.
  box(p, 4, 41, 24, 5, R.pearl);
  p.rect(5, 42, 22, 1, R.pearlLight);
  p.rect(5, 44, 22, 1, R.pearlDark);
  box(p, 8, 37, 16, 5, R.pearl);
  p.rect(9, 38, 14, 1, R.pearlLight);
  p.rect(9, 40, 14, 1, R.pink);
  box(p, 12, 33, 8, 5, R.pearlDark);
  p.rect(13, 34, 6, 1, R.pearl);
  // The token: a pearl rim, a groove of colour that travels round, a midnight face.
  blob(p, cx, cy, 13, 13, R.pearl);
  oval(p, cx, cy, 12, 12, R.pearl);
  // Shading on the lower right of the rim.
  for (let a = 0.2; a < 1.5; a += 0.04) {
    p.px(Math.round(cx + Math.cos(a) * 12), Math.round(cy + Math.sin(a) * 12), R.pearlDark);
    p.px(Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 11), R.pearlDark);
  }
  for (let a = 3.4; a < 4.6; a += 0.04)
    p.px(Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 11), R.pearlLight);
  // The groove: rainbow hues sliding round it, 60 steps, eight frames to a full turn.
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const hue = RAINBOW[(Math.floor(i / 3) + frame) % 6]!;
    p.px(Math.round(cx + Math.cos(a) * 9.5), Math.round(cy + Math.sin(a) * 9.5), hue);
  }
  blob(p, cx, cy, 8, 8, R.night);
  oval(p, cx - 2, cy - 2, 5, 5, R.nightMid);
  // Stars in the face.
  for (const [x, y] of [
    [11, 14],
    [21, 13],
    [12, 26],
    [22, 25],
    [19, 27],
  ] as const)
    p.px(x, y, (x + y + frame) % 3 === 0 ? R.pearlLight : R.pearlShade);
  // The prism: a white triangle, with the white beam in and a fan of colour out.
  const rows = ["..#..", ".###.", ".###.", "#####"];
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++)
      if (row[dx] === "#") p.px(cx - 2 + dx, cy - 4 + dy, dy === 3 || dx === 0 ? R.pearlDark : R.pearlLight);
  });
  p.px(cx, cy - 4, R.pearlLight);
  for (let x = cx - 8; x < cx - 2; x++) p.px(x, cy + 2 - Math.floor((x - cx + 8) / 3), R.pearlLight);
  RAINBOW.forEach((c, i) => {
    // Each band leaves the prism's right side and fans out and down across the face.
    for (let x = cx + 2; x < cx + 8; x++) {
      const y = cy - 1 + Math.round(((x - cx - 2) * (i - 2.5)) / 5);
      p.px(x, y, c);
    }
  });
  // Light thrown beyond the token on both sides, in coloured streaks that shimmer.
  RAINBOW.forEach((c, i) => {
    const on = (i + frame) % 3;
    if (on === 0) return;
    p.rect(0, 12 + i * 3, 2, 1, c);
    p.rect(30, 12 + i * 3, 2, 1, c);
    if (on === 2) {
      p.px(2, 12 + i * 3, c);
      p.px(29, 12 + i * 3, c);
    }
  });
  // Sparkles that come and go round the crown.
  sparkle(p, 4 + ((frame * 5) % 24), 2 + ((frame * 3) % 5), R.pearlLight, frame % 2 === 0);
  sparkle(p, 27 - ((frame * 3) % 12), 4 + ((frame * 2) % 6), R.ice);
  p.px(2, 30 - frame, R.pink);
  p.px(29, 8 + frame, R.pink);
}

// MARK: Catalog

const piece = (
  rank: number,
  height: number,
  draw: FancyPiece["draw"],
  extra: Pick<FancyPiece, "frames" | "frameMs">,
): FancyPiece => {
  const track = PRESTIGE_TRACKS[rank - 1]!;
  return {
    id: `prestige-trophy-${rank}`,
    name: track.trophy.name,
    w: track.trophy.w,
    h: 1,
    height,
    price: 0,
    rarity: "legendary",
    tint: null,
    placement: "floor",
    draw,
    ...extra,
  };
};

/** The five trophies, in rank order (Ascendant first). */
export const PRESTIGE_TROPHIES: readonly FancyPiece[] = [
  piece(1, 40, (p, f) => obelisk(p, f), { frames: 4, frameMs: 350 }),
  piece(2, 32, (p, f) => orrery(p, f), { frames: 8, frameMs: 260 }),
  piece(3, 32, (p, f) => blackHole(p, f), { frames: 8, frameMs: 120 }),
  piece(4, 32, (p, f) => holoTown(p, f), { frames: 4, frameMs: 400 }),
  piece(5, 48, (p, f) => monument(p, f), { frames: 8, frameMs: 200 }),
];

/** The trophy of a prestige rank (1 is the first), if it exists. */
export const prestigeTrophy = (rank: number): FancyPiece | undefined => PRESTIGE_TROPHIES[rank - 1];
