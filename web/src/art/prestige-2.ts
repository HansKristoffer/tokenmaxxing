import type { Art } from "./editions.ts";
import { C } from "./palette.ts";
import type { Pen } from "./pixels.ts";
import type { TrackArt } from "./prestige-types.ts";
import type { Back, BackView, Outfit } from "./wardrobe.ts";

/**
 * Prestige track 2's wearables in 2D (`core/src/prestige.ts`): Cosmic, cyan over midnight blue, starfields, orbits and
 * small planets. The hat, outfit, back item and aura, same shapes as the cases' (`case-ragnarok-body.ts`,
 * `fishing-loot-aura.ts`); `prestige.ts` files them under their look index (`PRESTIGE_BASE + 1`).
 */

const o = C.ink;

// MARK: Hat

// Starfield crown: a lit midnight band with three points, each tipped by a cyan star, tiny white stars sewn across
// the band and a cyan gem in the middle of it.
// prettier-ignore
const HAT: Art = {
  down: [
    ".......gg.......",
    "...g...cc...g...",
    "..oco.oNNo.oco..",
    "..oNoooNNoooNo..",
    "..oNnNnNNnNnNo..",
    "..oNwNnccnNwNo..",
    "...oooooooooo...",
  ],
  side: [
    "........gg......",
    "....g...cc..g...",
    "...oco.oNNo.oco.",
    "...oNoooNNoooNo.",
    "...oNnNnNNnNnNo.",
    "...oNwNnNNcNwNo.",
    "....oooooooooo..",
  ],
  up: [
    ".......gg.......",
    "...g...cc...g...",
    "..oco.oNNo.oco..",
    "..oNoooNNoooNo..",
    "..oNnNnNNnNnNo..",
    "..oNnNwnnwNnNo..",
    "...oooooooooo...",
  ],
  pal: { o, n: "#1b2a6b", N: "#3550c0", c: "#22d3ee", g: "#8cf0ff", w: "#ffffff" },
};

// MARK: Outfit

// Nebula suit: a midnight suit, a nebula swirling across the chest (cyan through violet to pink) pricked with stars,
// and a belt of starlight. The back carries the same cloud.
// prettier-ignore
const OUTFIT: Outfit = {
  c: "#16245a", C: "#0d1740", p: "#0a1130",
  marks: {
    down: ["....wNvvVvkN....", "....NvmmmVvw....", "....kVvmwmvN....", "....kBkBkBkB...."],
    side: [".....NvvVvk.....", ".....vmmmVw.....", ".....VvmwmN.....", ".....kBkBkB....."],
    up: ["....NvVwvvVN....", "....kNvmmvNk....", "....wVvmmVvw....", "....kBkBkBkB...."],
  },
  pal: { k: "#22d3ee", N: "#2a3f8f", v: "#7a5cff", V: "#5a3fd0", m: "#e060ff", w: "#ffffff", B: "#0d1740" },
};

// MARK: Back

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
const view = (front: string[]): BackView => ({ front });

// Orbital backpack: a midnight pack with a ringed planet on it and a thin cyan orbit round the shoulders, a pale
// moon and a sand moon riding it. The moons swap sides on the walking frame.
// prettier-ignore
const PACK_UP = frameAt(
  [
    "......oooo......",
    "....oonNNnoo....",
    "..r.onNnnNno.r..",
    ".rmMonpPPpnosSr.",
    ".rmmoNRRRRNossr.",
    "..r.onpPPpno.r..",
    "...ronNnnNnor...",
    "....oooooooo....",
  ],
  7,
);
// prettier-ignore
const PACK_UP_B = frameAt(
  [
    "......oooo......",
    "....oonNNnoo....",
    "..r.onNnnNno.r..",
    ".rsSonpPPpnomMr.",
    ".rssoNRRRRNommr.",
    "..r.onpPPpno.r..",
    "...ronNnnNnor...",
    "....oooooooo....",
  ],
  7,
);
// prettier-ignore
const PACK_SIDE = frameAt(
  [
    ".r..............",
    "mMm.ooo.........",
    ".mronNno........",
    "..roppPo........",
    "..roRRRo........",
    "..roppPo........",
    ".sronNno........",
    "sSs.ooo.........",
  ],
  7,
);
// prettier-ignore
const PACK_SIDE_B = frameAt(
  [
    "..r.............",
    "sSs.ooo.........",
    ".sronNno........",
    "..roppPo........",
    "..roRRRo........",
    "..roppPo........",
    ".mronNno........",
    "mMm.ooo.........",
  ],
  7,
);
// prettier-ignore
const PACK_DOWN = frameAt(
  [
    ".mM..........sS.",
    "rmm..........ss.",
    ".r............r.",
  ],
  8,
);

// Pixel art reads as a grid.
// prettier-ignore
const BACK: Back = {
  views: {
    down: { behind: PACK_DOWN },
    side: { behind: PACK_SIDE },
    up: view(PACK_UP),
  },
  walk: { side: { behind: PACK_SIDE_B }, up: view(PACK_UP_B) },
  pal: {
    o, n: "#14214d", N: "#2a3f8f", r: "#1fb6d4", R: "#22d3ee", p: "#6f7cf5", P: "#aab4ff",
    m: "#e8f2ff", M: "#ffffff", s: "#e8c58a", S: "#fff0c8",
  },
};

// MARK: Aura

const CX = 14;
const CY = 14;
const TAU = Math.PI * 2;
const FRAMES = 8;

const CYAN = "#22d3ee";
const GLOW = "#8cf0ff";
const DIM = "rgba(34, 211, 238, 0.55)";
const FAINT = "rgba(140, 240, 255, 0.28)";
const TOKEN = "#d8fbff";

/** A token: four pixels across when it is near (a bright rim, a pale face, a glint), a dim two-pixel speck when far. */
function coin(p: Pen, x: number, y: number, near: boolean): void {
  if (!near) {
    p.rect(x - 1, y - 1, 2, 2, DIM);
    return;
  }
  p.rect(x - 1, y - 2, 2, 1, CYAN);
  p.rect(x - 2, y - 1, 4, 2, CYAN);
  p.rect(x - 1, y + 1, 2, 1, CYAN);
  p.rect(x - 1, y - 1, 2, 2, TOKEN);
  p.px(x - 1, y - 1, "#ffffff");
  p.px(x + 2, y - 2, FAINT);
  p.px(x - 3, y + 1, FAINT);
}

/** A four-point twinkle at (`x`, `y`) of `s` 0..2. */
function twinkle(p: Pen, x: number, y: number, s: number): void {
  if (s <= 0) return;
  p.px(x, y, "#ffffff");
  if (s > 1) {
    p.px(x - 1, y, GLOW);
    p.px(x + 1, y, GLOW);
    p.px(x, y - 1, GLOW);
    p.px(x, y + 1, GLOW);
  }
}

// Orbiting token sigil: a ring of cyan dashes turns slowly round the wearer with a few rune ticks inside it, a tilted
// orbit with three tokens riding it crosses it (the far side of it fainter), and stars twinkle in the corners. Each
// loop brings every part back to where it began: the sigil turns one dash, the tokens one third of a lap.
const sigil = (p: Pen, f: number): void => {
  const k = f / FRAMES;
  const turn = k * (TAU / 8);
  for (let d = 0; d < 8; d++) {
    const a0 = (d / 8) * TAU + turn;
    for (let s = 0; s < 4; s++) {
      const a = a0 + s * 0.17;
      p.px(
        Math.round(CX + Math.cos(a) * 12.6),
        Math.round(CY + Math.sin(a) * 12.6),
        s === 1 || s === 2 ? GLOW : DIM,
      );
    }
  }
  for (let d = 0; d < 4; d++) {
    const a = (d / 4) * TAU - turn * 2 + 0.4;
    p.px(Math.round(CX + Math.cos(a) * 10), Math.round(CY + Math.sin(a) * 10), FAINT);
  }
  // The orbit: a thin tilted ellipse, and the tokens on it.
  const tilt = -0.42;
  const at = (a: number): [number, number, number] => {
    const x = Math.cos(a) * 11;
    const y = Math.sin(a) * 4.4;
    return [
      Math.round(CX + x * Math.cos(tilt) - y * Math.sin(tilt)),
      Math.round(CY + x * Math.sin(tilt) + y * Math.cos(tilt)),
      Math.sin(a),
    ];
  };
  for (let i = 0; i < 48; i++) {
    const [x, y, z] = at((i / 48) * TAU);
    if (i % 2 === 0) p.px(x, y, z < 0 ? "rgba(34, 211, 238, 0.3)" : "rgba(140, 240, 255, 0.6)");
  }
  const tokens = [0, 1, 2].map((i) => at((k / 3 + i / 3) * TAU));
  // Far tokens first, near ones over them.
  for (const [x, y] of tokens.filter((t) => t[2] < 0)) coin(p, x, y, false);
  for (const [x, y] of tokens.filter((t) => t[2] >= 0)) coin(p, x, y, true);
  // Starlight in the corners.
  const spots: [number, number][] = [
    [3, 4],
    [24, 3],
    [2, 22],
    [25, 24],
    [13, 1],
    [14, 26],
  ];
  spots.forEach(([x, y], i) => {
    twinkle(p, x, y, [0, 1, 2, 1, 0, 0, 0, 0][(f + i * 3) % FRAMES]!);
  });
};

export const TRACK: TrackArt = {
  hat: HAT,
  outfit: OUTFIT,
  back: BACK,
  aura: sigil,
};
