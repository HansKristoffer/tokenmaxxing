/**
 * Nytårsaften (30 Dec to 1 Jan, `FESTIVE.nytar`): the pieces of the New Year's theme that are plain data and
 * clock maths, so the 2D and 3D towns and the tests share them. The big clock by the square and its countdown
 * caption, the evening's small firework shows (the midnight one is `newyear.ts`), the hop into the new year, and the
 * night watchman who explains it all. Clock only: the server keeps nothing.
 *
 * Type-only imports from `festive.ts` (it imports this file for `FESTIVE_NPC`).
 */
import type { FestiveNpc } from "./festive.ts";
import type { Fireworks } from "./fireworks.ts";
import { newYearShow } from "./newyear.ts";
import { worldWall } from "./range.ts";
import { copenhagenToMs } from "./sky.ts";
import type { Facing } from "./world.ts";

/** A tile in the town. */
export interface Spot {
  x: number;
  y: number;
}

/**
 * Where it all stands: one row on the square's south side (y = 6, inside the paving and off its edge where the race
 * runs; the spawn and the star counter above it, the build snail's row below, and the pølsevogn and the merchant's
 * cart further east): the jumping chair, the watchman, the buffet and the Nytårsur, west to east (so the 3D
 * camera sees him past the low table, not behind the tower). Each of these
 * tiles blocks walking; row 5 above them stays open.
 */
export const NYTAR_NPC_TILE: Spot & { facing: Facing } = { x: 11, y: 6, facing: "down" };
export const NYTAR_CLOCK: Spot = { x: 14, y: 6 };
/** The buffet: two tiles side by side, the left one first. */
export const NYTAR_TABLE: readonly Spot[] = [
  { x: 12, y: 6 },
  { x: 13, y: 6 },
];
export const NYTAR_CHAIR: Spot = { x: 10, y: 6 };

/** Tiles that block movement while the theme is on (the watchman, the clock, the table and the chair). */
export const NYTAR_BLOCKS: readonly Spot[] = [NYTAR_NPC_TILE, NYTAR_CLOCK, ...NYTAR_TABLE, NYTAR_CHAIR];

/** The lamps the party lights are strung between (the square's four corner lamps), as tiles. */
export const NYTAR_LAMPS = { left: 1, right: 19, top: 1, bottom: 8 } as const;

/** A hop lands in the new year if it starts within this many ms of the stroke of midnight. */
export const HOP_WINDOW_MS = 3_000;

/** The night watchman, `nytar` in `FESTIVE_NPC`. */
export const NYTAR_NPC: FestiveNpc = {
  id: "nytar-watch",
  name: "Nattevagt Niels",
  x: NYTAR_NPC_TILE.x,
  y: NYTAR_NPC_TILE.y,
  facing: NYTAR_NPC_TILE.facing,
  lines: [
    "Godt nytår, or nearly. I'm Niels, night watch. Tonight I mind the Nytårsur, the big clock, and everyone's fingers.",
    "Nytårsaften is 31 December. Dinner first, then at midnight kransekage and champagne. That tower on the table is almond rings stacked high: lift the top ring and the whole tower comes with it.",
    "At six o'clock the country goes quiet for the king's New Year speech. It ends 'Gud bevare Danmark'. After that the sky is ours: a few rockets over the square every half hour.",
    "Tradition number one: stand on a chair and jump into the new year at the last stroke. There's a chair by the clock. Press Space as it strikes twelve, within three seconds, and the confetti is yours.",
    "Tradition number two, and I take no responsibility: smash old plates against your friends' doors. A heap of shards on your step means you are well liked. Mine are untouched. Rude.",
    "In Copenhagen they all stand under the Rådhus clock and wait for its bells. Here we have mine. Watch the sign over it: it counts down to the new year.",
    "At midnight the big show starts: ten minutes of rockets over the square, the same for everyone. Hop for the new year, and the others who hop near you get confetti too.",
    "Skål! The Clothes shop has party hats for the night: a Nytårshat, a Midnight top hat and a Kransekage hat. They're on sale until a couple of days into January.",
    "Nytårsdag, tomorrow, is for sleeping in. Come back next 31 December. The clock will be here. So will I.",
  ],
};

// MARK: The clock

/** The stroke of midnight the nearest New Year starts at (ms) and the number of the year it begins. */
export function midnightOf(ms: number): { at: number; year: number } {
  const show = newYearShow(ms);
  return { at: show.at, year: show.seed };
}

/** Ms until (positive) or since (negative) that stroke. */
export const toMidnight = (ms: number): number => midnightOf(ms).at - ms;

/** Whether a hop that started at `hopMs` is a hop into the new year. */
export const hopsIntoYear = (hopMs: number): boolean => Math.abs(toMidnight(hopMs)) <= HOP_WINDOW_MS;

const pad = (n: number) => String(n).padStart(2, "0");

/** The words on the sign over the clock, by the hour. */
export function nytarCaption(ms: number): string {
  const { year } = midnightOf(ms);
  const { m, d, hour, minute } = worldWall(ms);
  const left = toMidnight(ms);
  if (left <= 0) return `🎆 Godt nytår ${year}!`;
  if (m === 12 && d === 30) return "🎆 Nytårsaften i morgen";
  if (hour < 18) return "👑 Kongens nytårstale kl. 18";
  if (hour === 18 && minute < 15) return "📺 Kongens nytårstale lige nu";
  const secs = Math.ceil(left / 1000);
  if (secs <= 10) return `🎆 ${secs}`;
  if (secs < 3600) return `⏳ ${pad(Math.floor(secs / 60))}:${pad(secs % 60)} til ${year}`;
  const h = Math.ceil(secs / 3600);
  return `⏳ ${h} t til ${year}`;
}

// MARK: Shows

const SHOW_MS = 150_000;
const SHOW_TAIL_MS = 4_000;
/** The evening's small shows: every half hour from 19:00 to 23:30 on 31 December, two and a half minutes each. */
export const NYTAR_COLOURS: readonly string[] = [
  "#f4c95d",
  "#ffb347",
  "#ff5d73",
  "#2fc8ff",
  "#b18cff",
  "#5fe28a",
];

/**
 * The small show for the half hour `ms` is in (31 December, 19:00 to 23:30), or null; with `withMidnight` also the
 * big one from `newYearShow` (a pinned `?sky=` shows it on the page's own clock; the real one is already a source).
 */
export function nytarShow(ms: number, withMidnight = false): Fireworks | null {
  const { y, m, d, hour, minute } = worldWall(ms);
  const big = withMidnight ? newYearShow(ms) : null;
  if (m !== 12 || d !== 31 || hour < 19) return big;
  const half = minute < 30 ? 0 : 30;
  const at = copenhagenToMs(`${y}-12-31T${pad(hour)}:${pad(half)}`);
  // Only while it is on (the burst of the last rocket takes a few seconds more): otherwise the big one, if asked.
  if (at === null || ms >= at + SHOW_MS + SHOW_TAIL_MS) return big;
  return {
    at,
    ms: SHOW_MS,
    x: 12.5,
    y: 4.5,
    w: 6,
    h: 2,
    seed: y * 100 + hour * 2 + (half ? 1 : 0),
    colours: NYTAR_COLOURS,
  };
}
