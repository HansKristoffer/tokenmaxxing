import type { Art } from "./editions.ts";
import { C } from "./palette.ts";
import type { Pen } from "./pixels.ts";
import type { TrackArt } from "./prestige-types.ts";
import type { Back, BackView, Outfit } from "./wardrobe.ts";

/**
 * Prestige track 3's wearables in 2D (`core/src/prestige.ts`): Voidwalker, obsidian plate and magenta light bent round
 * the dark. The Event-horizon visor, Voidwalker armour, Rift mantle and Event-horizon ring aura. Filed by
 * `prestige.ts` under hat id `hat.702` and look index 702.
 */

const o = C.ink;

// MARK: Hat

// Event-horizon visor: a black helm with a fin of light on top and one wide lens across the brow, a bright magenta ring
// round it with a white hot spot in the dark. From behind the lens is a crack of magenta where the helm's shell split.
// Pixel art reads as a grid.
// prettier-ignore
const HAT: Art = {
  down: [
    "......oPPo......",
    "....ooKhhKoo....",
    "..oKkMMMMMMkKo..",
    "..oKMPkkkkkMKo..",
    "..oKMkkkkWkMKo..",
    "..okKMMMMMMKko..",
  ],
  side: [
    "......oPPo......",
    "....ooKhhKoo....",
    "...oKkkkkkMMo...",
    "...oKkkkkMPkMo..",
    "...oKkkkkMkWMo..",
    "...okKkkkkMMo...",
  ],
  up: [
    "......oPPo......",
    "....ooKhhKoo....",
    "..oKKkkkMkkKKo..",
    "..oKkkkMPMkkKo..",
    "..oKkkkkMkkkKo..",
    "..okKkkkkkkKko..",
  ],
  pal: { o, K: "#352649", k: "#1d1428", h: "#5a4580", M: "#d946ef", P: "#ff7cf5", W: "#ffeafd" },
};

// MARK: Outfit

// Voidwalker armour: obsidian plate, a glowing fault running down the chest and out along one pauldron, magenta
// light bleeding out of the seams, and a belt clasp with a white-hot dot.
// Pixel art reads as a grid.
// prettier-ignore
const OUTFIT: Outfit = {
  c: "#2a1d3d", C: "#1a1127", p: "#120c1b",
  marks: {
    down: ["...gKKkkkkMKg...", "...gkmkkMmkkg...", "...gkkkMmkkkg...", "....kkMWMkkk...."],
    side: ["....gKkkkMg.....", "....gkkkMmg.....", "....gkkMmkg.....", ".....kMWkkk....."],
    up: ["...gKKkkkkKKg...", "...gkkkMkkkkg...", "...gkkMmkkMkg...", "....kkkkMkkk...."],
  },
  pal: { g: "#6b54a0", K: "#4b3870", k: "#201530", M: "#d946ef", m: "#8f2fa8", W: "#ffeafd" },
};

// MARK: Back

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
const view = (front: string[]): BackView => ({ front });

// Rift mantle: a torn mantle of black, its edges crackling magenta, a rift of light split down it.
const MANTLE_UP = frameAt(
  [
    "..oKggggggggKo..",
    "..oKkkkkMkkkKo..",
    "..oKkkkMPkkkKo..",
    "..oKkkkkMMkkKo..",
    "..oKkkkMPkkkKo..",
    "..oKkkkkMkkkKo..",
    "..oKkMkkkkMkKo..",
    "..oKo.kooko.Ko..",
    "...M.o.MM.o.M...",
  ],
  7,
);
const MANTLE_UP_B = frameAt(
  [
    "..oKggggggggKo..",
    "..oKkkkkMkkkKo..",
    "..oKkkkkMMkkKo..",
    "..oKkkkMPkkkKo..",
    "..oKkkkkMMkkKo..",
    "..oKkkkkMkkkKo..",
    "..oKkkMkkkMkKo..",
    "..oKo.okook.Ko..",
    "....oM.o.M.oM...",
  ],
  7,
);
const MANTLE_DOWN = frameAt(
  [
    "................",
    "..oo........oo..",
    ".oKko......okKo.",
    ".oKkM......Mkko.",
    ".oKkk......kkKo.",
    ".oKkM......MkKo.",
    ".oko.k....k.oko.",
    ".M.o..o..o..o.M.",
  ],
  8,
);
const MANTLE_SIDE = frameAt(
  [
    "......oo........",
    ".....oKk........",
    "....oKkM........",
    "...oKkkM........",
    "...oKkMP........",
    "...oKkkM........",
    "..oKoMkk........",
    "..M.o.ok........",
  ],
  8,
);
const MANTLE_SIDE_B = frameAt(
  [
    "......oo........",
    ".....oKk........",
    "...ooKkM........",
    "..oKkkkM........",
    ".oKkkMkP........",
    ".oKkkkkM........",
    "oKoM.ookk.......",
    "M.o...o.k.......",
  ],
  8,
);

// Pixel art reads as a grid.
// prettier-ignore
const BACK: Back = {
  views: {
    down: { behind: MANTLE_DOWN, front: frameAt([".....g....g....."], 9) },
    side: { behind: MANTLE_SIDE },
    up: view(MANTLE_UP),
  },
  walk: { up: view(MANTLE_UP_B), side: { behind: MANTLE_SIDE_B } },
  pal: { o, g: "#6b54a0", K: "#352649", k: "#1d1428", M: "#d946ef", P: "#ff7cf5" },
};

// MARK: Aura

const CX = 14;
const CY = 14;
const TAU = Math.PI * 2;
const FRAMES = 8;

/** One ring pixel by how bright it is (0 to 1): a faint magenta haze up to a white-hot core. */
const ember = (k: number): string =>
  k > 0.88
    ? "#ffeafd"
    : k > 0.66
      ? "#ff7cf5"
      : k > 0.4
        ? "#d946ef"
        : k > 0.2
          ? "rgba(217, 70, 239, 0.55)"
          : "rgba(217, 70, 239, 0.28)";

/** Brightness of a spot at angle `a` when the bright side of the ring has turned to `lead`: a lobe that is nearly dark opposite. */
const beam = (a: number, lead: number): number => 0.18 + 0.82 * Math.max(0, Math.cos(a - lead)) ** 3;

// Event-horizon ring: a dark well where the wearer stands, a ring of bent light round it with a hot side that swings
// slowly round, a tilted disc of fire across the waist, and motes of light spiralling in and going out.
const horizon = (p: Pen, f: number): void => {
  const turn = (f / FRAMES) * TAU;
  // The well, a soft dark disc, and a faint glow lapping at its edge.
  p.disc(CX, CY, 11, "rgba(18, 10, 30, 0.42)");
  p.disc(CX, CY, 9, "rgba(10, 5, 20, 0.35)");
  // The bent light: a thin ring all the way round, brightest on the side that leads.
  const R = 12;
  const seen = new Set<number>();
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * TAU;
    const x = Math.round(CX + Math.cos(a) * R);
    const y = Math.round(CY + Math.sin(a) * R);
    if (seen.has(y * 40 + x)) continue;
    seen.add(y * 40 + x);
    p.px(x, y, ember(beam(a, turn)));
  }
  // The disc: a flat ellipse of fire across the waist; the near and far halves are brightest at opposite ends.
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const x = Math.round(CX + Math.cos(a) * 12.4);
    const y = Math.round(CY + 3 + Math.sin(a) * 3.2);
    p.px(x, y, ember(beam(a, turn * 2 + 1) * 0.85));
  }
  // Motes spiral in toward the dark, going from faint to hot as they fall and gone at the middle.
  for (let i = 0; i < 6; i++) {
    const k = (f / FRAMES + i / 6) % 1;
    const a = i * 1.7 + k * 3.2;
    const r = 12 - k * 8;
    p.px(Math.round(CX + Math.cos(a) * r), Math.round(CY + Math.sin(a) * r * 0.9), ember(0.45 + k * 0.5));
  }
};

export const TRACK: TrackArt = { hat: HAT, outfit: OUTFIT, back: BACK, aura: horizon };
