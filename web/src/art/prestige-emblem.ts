import { PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import { bake, cached, type Palette } from "./pixels.ts";

/**
 * The prestige tags' crests (`core/src/prestige.ts`, `PrestigeTrack.emblem`): one 16x16 sprite a rank, each its own
 * shape in the track's colours. `emblemSprite` bakes the crest at a whole-number scale; `emblemFrames` adds a
 * four-frame glint (a bright diagonal sweeping over the lit pixels) for the top track's shimmer. The Roman numeral is
 * not painted in: the tag writes it as text next to the crest.
 *
 * Keys: `o` outline, `m` main, `a` accent, `g` glow, `w` white highlight, `d` deep shade.
 */

export const EMBLEM_SIZE = 16;

// Pixel art reads as a grid. The symmetric crests are drawn as their left half and mirrored.
// prettier-ignore
const HALVES: Record<number, string[]> = {
  // Ascendant: a silver-spined arrowhead of light rising between two runic wings.
  1: [
    ".......o",
    "......og",
    ".....ogw",
    "....ogww",
    "...omgww",
    "..omgmww",
    ".omamgww",
    "omam.omw",
    "oma..omw",
    "om...omm",
    ".o...oma",
    ".....oma",
    "......om",
    ".......o",
    "........",
    "........",
  ],
  // Voidwalker: a black disc ringed in magenta fire, a bright sliver of light bent round its rim.
  3: [
    "........",
    ".....ooo",
    "...oogmm",
    "..ogmddd",
    ".ogmddoo",
    ".ogdodoo",
    "ogmdooo.",
    "omdoo...",
    "omdoo...",
    "ogmdooo.",
    ".ogdodoo",
    ".ogmddoo",
    "..ogmddd",
    "...oogmm",
    ".....ooo",
    "........",
  ],
  // Architect: a drafting compass over a gear, gold on ivory.
  4: [
    ".......o",
    "......oa",
    ".....oaw",
    "....oaww",
    "..oooawm",
    ".oaamoom",
    ".oamawmg",
    "oamwoomg",
    "oawmo.og",
    ".oammoom",
    ".oaamoaw",
    "..oooaam",
    "....oaaw",
    ".....oaw",
    "......oa",
    ".......o",
  ],
  // Prismatic: a cut gem whose facets throw every colour, over a pearl rim.
  5: [
    "........",
    "...ooooo",
    "..opwwww",
    ".opmgwpw",
    "opwgmwgp",
    "ogmwwpwg",
    "opgpwmwa",
    ".ogwgmpa",
    "..opgwma",
    "...ogpwa",
    "....opga",
    ".....opa",
    "......oa",
    ".......o",
    "........",
    "........",
  ],
};

// Cosmic is not symmetric (a ringed planet with a star), so it is the whole grid.
// prettier-ignore
const FULL: Record<number, string[]> = {
  2: [
    "..............w.",
    "......ooooo..wgw",
    "....ooggcmmo..w.",
    "...ogcmmmmmmo...",
    "..ogcmmmmmmddo..",
    ".oaaaaaaaaaaaao.",
    "oawwaommmmddoaao",
    "oaooaaaaaaaaaoao",
    ".ooaaaaaaaaaaoo.",
    "..ogmmmmdddddo..",
    "..ogmmmmddddo...",
    "...ooggmmddoo...",
    ".w..ooooooo.....",
    "wgw.............",
    ".w..........w...",
    "...........wgw..",
  ],
};

// Per rank: [palette extras]. `o` outline is a dark tint of the track so it reads on the dark HUD and the sky.
// prettier-ignore
const EXTRA: Record<number, Palette> = {
  1: { o: "#2b1a5c", a: "#d6dbe6", w: "#ffffff", d: "#5b34b8" },
  2: { o: "#050a1f", c: "#8cf0ff", a: "#a9b8e8", w: "#ffffff", d: "#14214d" },
  3: { o: "#0a0610", w: "#ffd6fb", d: "#4a1f66" },
  4: { o: "#5c4308", w: "#fffbe8", d: "#a87a0c" },
  5: { o: "#6a4a9c", m: "#9fe8ff", a: "#ff7ad9", g: "#ffe38a", w: "#fbf8ff", p: "#c9a8ff", d: "#9fe8ff" },
};

const mirror = (half: readonly string[]) => half.map((r) => r + [...r].reverse().join(""));

/** The 16 rows of rank's crest (empty for an unknown rank). */
export const emblemRows = (rank: number): string[] => FULL[rank] ?? mirror(HALVES[rank] ?? []);

/** The colours of one crest: the track's own, then the shades its art needs. */
export const emblemPalette = (rank: number): Palette => {
  const t = PRESTIGE_TRACKS[rank - 1];
  if (!t) return {};
  return { m: t.colors.main, a: t.colors.accent, g: t.colors.glow, ...EXTRA[rank] };
};

const FRAMES = 4;

/** A glint pass: pixels on the sweeping diagonal (x + y ≡ phase, a band 2 wide) lighten to white. */
const lit = (x: number, y: number, frame: number): boolean => {
  const d = x + y - frame * 8 + 2;
  return d >= 0 && d < 2;
};

const bakeEmblem = (rank: number, scale: number, frame: number): HTMLCanvasElement => {
  const rows = emblemRows(rank);
  const pal = emblemPalette(rank);
  const s = bake(EMBLEM_SIZE, EMBLEM_SIZE, (p) => {
    p.grid(rows, pal);
    if (frame < 0) return;
    for (const [y, row] of rows.entries())
      for (let x = 0; x < row.length; x++)
        if (row[x] !== "." && row[x] !== "o" && lit(x, y, frame)) p.px(x, y, "#ffffff");
  });
  if (scale === 1) return s;
  const out = document.createElement("canvas");
  out.width = out.height = EMBLEM_SIZE * scale;
  const g = out.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(s, 0, 0, out.width, out.height);
  return out;
};

const baked = cached((rank: number, scale: number, frame: number) => `${rank}:${scale}:${frame}`, bakeEmblem);

/** Rank's crest as a canvas, `EMBLEM_SIZE * scale` square. */
export const emblemSprite = (rank: number, scale = 1): HTMLCanvasElement => baked(rank, scale, -1);

/** The glint frames, in order; play them at about 8 fps with a pause on the plain crest. */
export const emblemFrames = (rank: number, scale = 1): HTMLCanvasElement[] =>
  Array.from({ length: FRAMES }, (_, f) => baked(rank, scale, f));
