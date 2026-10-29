import { PET_W } from "./pet-base.ts";
import { petTop } from "./pets.ts";
import { bake, cached, type Palette } from "./pixels.ts";

/**
 * The five prestige pet accessories (`petwear` in `core/src/prestige.ts`), worn like the Lv50 crown
 * (`petCrown` in `aura.ts`): shown from the owner's prestige, never a Look slot. One a rank: the circlet's
 * stone glints, the collar's star twinkles, the eclipse burns, the halo's gears turn, and the crown throws
 * a different colour with each step. Every grid in one wear has the same size.
 */

export interface Petwear {
  /** The frames of the loop, each a grid of `pal`'s characters (`.` is see-through). */
  frames: readonly (readonly string[])[];
  /** The colours at frame `f`; most are one palette for every frame. */
  pal: (f: number) => Palette;
  /** Milliseconds a frame lasts. */
  ms: number;
  /** Rows from the top of the pet's head to the sprite's top row; negative is above the head. */
  dy: number;
  /** Floats: it bobs a pixel up and down instead of sitting still. */
  float?: boolean;
}

const fixed = (pal: Palette) => () => pal;

// Rank I: a thin silver band with one violet stone; a glint runs round it.
// prettier-ignore
const CIRCLET: string[][] = [
  ["...V...", ".sSvSs.", "sS...Ss"],
  ["...V...", ".wSvSs.", "sS...Ss"],
  ["...w...", ".sSvSs.", "sS...Ss"],
  ["...V...", ".sSvSw.", "sS...Ss"],
];

// Rank II: a midnight collar studded with cyan, and a tag that is a real star.
// prettier-ignore
const COLLAR: string[][] = [
  ["cbcbcbc", ".bbbbb.", "...s..."],
  ["bcbcbcb", ".bbbbb.", "..wSw.."],
  ["cbcbcbc", ".bbbbb.", "...S..."],
];

// Rank III: a black disc ringed in magenta fire, floating over the head.
// prettier-ignore
const ECLIPSE: string[][] = [
  ["..fmmmf..", ".mmkkkmm.", "fmkkKkkmf", ".mmkkkmm.", "..fmmmf.."],
  [".Ffmmmf..", ".mmkkkmm.", "fmkkKkkmF", ".mmkkkmm.", "..Fmmmf.F"],
  ["..fmmmF.F", ".Fmkkkmm.", "fmkkKkkmf", ".mmkkkmm.", ".Ffmmmf.."],
];

// Rank IV: a gold ring of tiny gears, their teeth lighting in turn.
// prettier-ignore
const HALO: string[][] = [
  ["..gTgTgTg..", ".T.......T.", "..gTgTgTg.."],
  ["..TgTgTgT..", ".g.......g.", "..TgTgTgT.."],
];

// Rank V: pearl points over a band that runs through the colours of the rainbow.
// prettier-ignore
const PRISM: string[][] = [["P..W..P", "PPsPPsP", "abcdefg"]];

const HUES = ["#ff5d73", "#ffb44d", "#fff06a", "#6dffa1", "#6fd8ff", "#8f8bff", "#ff7ad9"];

/** The five wears, rank I first. */
// prettier-ignore
export const PETWEAR: readonly Petwear[] = [
  {
    frames: [CIRCLET[0]!, CIRCLET[1]!, CIRCLET[0]!, CIRCLET[2]!, CIRCLET[0]!, CIRCLET[3]!],
    pal: fixed({ s: "#aeb6c6", S: "#d6dbe6", w: "#ffffff", v: "#8b5cf6", V: "#c4a8ff" }),
    ms: 220, dy: -2,
  },
  {
    frames: COLLAR,
    pal: fixed({ b: "#14214d", c: "#22d3ee", s: "#8cf0ff", S: "#ffffff", w: "#c8f8ff" }),
    ms: 280, dy: 3,
  },
  {
    frames: ECLIPSE,
    pal: fixed({ k: "#17101f", K: "#3a2352", m: "#d946ef", f: "#ff7cf5", F: "#ffd6fb" }),
    ms: 130, dy: -6, float: true,
  },
  {
    frames: HALO,
    pal: fixed({ g: "#d4a017", T: "#ffe38a" }),
    ms: 360, dy: -4, float: true,
  },
  {
    frames: Array.from({ length: HUES.length }, () => PRISM[0]!),
    pal: (f) => ({
      P: "#f4f0ff", W: "#ffffff", s: "#c9c2e8",
      ...Object.fromEntries([..."abcdefg"].map((k, i) => [k, HUES[(i + f) % HUES.length]!])),
    }),
    ms: 150, dy: -2,
  },
];

/** How many rows a wear reaches above the top of a pet's head (0 for none), for the frame to leave room. */
export const petwearRise = (rank: number): number => {
  const w = PETWEAR[rank - 1];
  return w ? Math.max(0, -w.dy + (w.float ? 1 : 0)) : 0;
};

const sprite = cached(
  (rank: number, f: number) => `${rank}:${f}`,
  (rank: number, f: number) => {
    const w = PETWEAR[rank - 1]!;
    const rows = w.frames[f]!;
    return bake(rows[0]!.length, rows.length, (p) => p.grid(rows, w.pal(f)));
  },
);

/**
 * Prestige `rank`'s pet accessory at time `now` and where it sits on the pet's frame, like `petCrown`; null
 * for no rank or a pet with no head to wear it. The floating ones bob a pixel.
 */
export function prestigePetwear(
  rank: number,
  pet: number,
  left: boolean,
  hop: boolean,
  now = 0,
): [HTMLCanvasElement, number, number] | null {
  const w = PETWEAR[rank - 1];
  const top = w && petTop(pet, hop);
  if (!w || !top) return null;
  const art = sprite(rank, Math.floor(now / w.ms) % w.frames.length);
  const x = Math.round(left ? PET_W - 1 - top.x : top.x) - Math.floor(art.width / 2);
  const bob = w.float ? Math.round((Math.sin(now / 420) + 1) / 2) : 0;
  return [art, x, top.y + w.dy - bob];
}
