/**
 * Påske (Easter) in town, from Palm Sunday to Easter Monday (`festive.ts`, anchored on `holidays.ts` `easter()`):
 * yellow påskeliljer and white vintergæk in the lawns, pastel bunting between the square's lamps, a påskeris on the
 * square hung with feathers and painted eggs, Gudrun the egg farmer with her stall, the påskefrokost table by the
 * Tavern, lambs, bunnies and chicks on the grass, and eight painted eggs hidden in the grass each day to find.
 *
 * Everything is worked out from the clock and the map, so the server keeps nothing: the eggs are a hash of the
 * tile and the day, and what a player has found is theirs, in their browser (`web/src/game/paaske.ts`). All of it
 * is scenery on grass or cobbles; the few things that block (the stall, the tree, the table, Gudrun) are the
 * client's own (`blocksPaaske`).
 */
import type { FestiveNpc } from "./festive.ts";
import type { GameMap } from "./maps.ts";

// MARK: Where things stand (town tiles)

/**
 * Gudrun the egg farmer: on the lawn west of the square, off the road (x = 0) and clear of every path. Facing the
 * camera. Her tile is a constant so a layout change is one edit.
 */
export const FARMER_TILE = { x: -2, y: 4 } as const;
/** Her stall of paint pots and eggs, the tile to her left. */
export const STALL = { x: -3, y: 4 } as const;
/** The påskeris: bare birch twigs hung with feathers and painted eggs, on the cobbles in the square. */
export const EASTER_TREE = { x: 3, y: 6 } as const;
/** The påskefrokost table, two tiles wide, on the lawn by the Tavern's door, clear of the spot where you step out of it (13, 17). */
export const FROKOST = { x: 15, y: 17, w: 2 } as const;

/** Tiles the scenery sits on, so no flower or egg is drawn under it. */
const RESERVED: readonly (readonly [number, number])[] = [
  [FARMER_TILE.x, FARMER_TILE.y],
  [STALL.x, STALL.y],
  [EASTER_TREE.x, EASTER_TREE.y],
  [FROKOST.x, FROKOST.y],
  [FROKOST.x + 1, FROKOST.y],
  [FARMER_TILE.x + 1, FARMER_TILE.y],
];

/**
 * Whether Gudrun is on (x, y): the one thing nobody walks through (the client keeps you off her, as `blocksPaaske`). The
 * stall, the table and the tree are only scenery: click-to-walk routes do not know the client's blocks, so a table on the
 * Tavern's lawn that blocked would trap a click on the way north, and the square's tree would trap one there.
 */
export const isPaaskeSolid = (x: number, y: number): boolean => x === FARMER_TILE.x && y === FARMER_TILE.y;

// MARK: The farmer

export const PAASKE_FARMER: FestiveNpc = {
  id: "paaske",
  name: "Farmer Gudrun",
  x: FARMER_TILE.x,
  y: FARMER_TILE.y,
  facing: "down",
  lines: [
    "Goddag! I'm Gudrun, and I paint eggs. This is Påske, Easter: the week from Palm Sunday to Easter Monday, when the whole town goes yellow.",
    "Påske is the spring feast. Maundy Thursday, Good Friday, then Easter Sunday and Monday, two days off. And it is when the påskeliljer, the yellow narcissi, finally open.",
    "See the bare birch twigs on the square, hung with feathers and painted eggs? That's the påskeris. Every kitchen table in Denmark has one this week.",
    "Gækkebrev! A letter cut in paper, a snowdrop folded inside, a rhyme, and dots for your name. Guess the sender and they owe you an egg. Fail, and you owe them one.",
    "The påskefrokost, the Easter lunch, is laid out on the lawn by the Tavern: herring, eggs, lamb, a little snaps. Nobody counts. Not on Easter.",
    "I have hidden eight painted eggs in the grass round town. Walk over one to pick it up. There are eight new ones every morning.",
    "Find all eight in a day and a little chick will follow you around for the rest of Easter. It's just for you, but it's a good chick.",
    "The closer we get to Easter Sunday, the more the town blooms: flowers, bunting, lambs and bunnies on the lawns. Come back tomorrow.",
    "Bunny ears, a chick hat and a crown of påskeliljer are in the Clothes shop until a couple of days after Easter. Hens don't wear them, but you can.",
  ],
};

// MARK: The egg hunt

/** Eggs hidden each day. */
export const EGGS_PER_DAY = 8;

/** Egg colours, pastel with a darker stripe: `[base, stripe, outline]`. */
export const EGG_COLOURS: readonly (readonly [string, string, string])[] = [
  ["#f4a6c8", "#fbf7ef", "#b4547f"],
  ["#9ccff2", "#f5d14a", "#4a86b4"],
  ["#f7e27a", "#e0584f", "#b48e1f"],
  ["#a6dc92", "#fbf7ef", "#4e8a3c"],
  ["#c8aaf0", "#f5d14a", "#7a58b4"],
  ["#f2967a", "#fbf7ef", "#b4543a"],
];

/** Deterministic noise in [0, 1) from three integers. */
export function noise(x: number, y: number, seed: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2147483647, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A number from a `YYYY-MM-DD` day key, the egg hunt's seed. */
export const daySeed = (day: string): number =>
  [...day].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

export interface Egg {
  x: number;
  y: number;
  /** Index into `EGG_COLOURS`. */
  colour: number;
}

/** Grass tiles with room to stand on: not under the scenery, with a walkable neighbour. */
function lawns(map: GameMap): [number, number][] {
  const out: [number, number][] = [];
  for (let y = map.y0; y < map.y0 + map.height; y++)
    for (let x = map.x0; x < map.x0 + map.width; x++) {
      if (map.at(x, y) !== ".") continue;
      if (RESERVED.some(([rx, ry]) => rx === x && ry === y)) continue;
      if (
        ![
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => map.walkable(x + dx!, y + dy!))
      )
        continue;
      out.push([x, y]);
    }
  return out;
}

/** The first `n` of `tiles` in the order of their noise, no two within `gap` tiles (Manhattan) of each other. */
function scatter(tiles: [number, number][], seed: number, n: number, gap: number): [number, number][] {
  const sorted = tiles
    .map((t) => [noise(t[0], t[1], seed), t] as const)
    .sort((a, b) => a[0] - b[0] || a[1][0] - b[1][0] || a[1][1] - b[1][1]);
  const out: [number, number][] = [];
  for (const [, t] of sorted) {
    if (out.length >= n) break;
    if (out.every((o) => Math.abs(o[0] - t[0]) + Math.abs(o[1] - t[1]) >= gap)) out.push(t);
  }
  return out;
}

/** The day's hidden eggs in `map` (the town): the same for everyone, new each world day. */
export function eggSpots(map: GameMap, day: string): Egg[] {
  const seed = daySeed(day);
  return scatter(lawns(map), seed, EGGS_PER_DAY, 6).map(([x, y]) => ({
    x,
    y,
    colour: Math.floor(noise(x, y, seed + 1) * EGG_COLOURS.length),
  }));
}

/** The storage key of an egg found, which day: `x,y`. */
export const eggKey = (e: Pick<Egg, "x" | "y">): string => `${e.x},${e.y}`;

// MARK: Flowers

export type FlowerKind = "narcissus" | "vintergaek" | "tulip";

export interface Flower {
  x: number;
  y: number;
  kind: FlowerKind;
}

/** How many clumps the lawns carry at full bloom. */
export const FLOWER_CLUMPS = 44;

/**
 * The flower clumps, in the order they come out: the first are there on Palm Sunday, the last on Easter Sunday
 * (`shown`). Narcissi most, then vintergæk, a few tulips.
 */
export function flowerSpots(map: GameMap): Flower[] {
  return scatter(lawns(map), 91, FLOWER_CLUMPS, 3).map(([x, y]) => {
    const k = noise(x, y, 5);
    return { x, y, kind: k < 0.5 ? "narcissus" : k < 0.8 ? "vintergaek" : "tulip" };
  });
}

/** How many of `total` things are out at this intensity (0..1): a few from the first day, all by the peak. */
export const shown = (total: number, intensity: number): number =>
  Math.min(total, Math.max(1, Math.ceil(total * Math.min(1, Math.max(0, intensity)))));

// MARK: Bunting

export interface Bunting {
  /** Tile coordinates of both ends (the lamps). */
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Strings between neighbouring lamps (the square's four corners): along each row and each column of them. */
export function buntingStrings(map: GameMap): Bunting[] {
  const lamps = map.find("L");
  const out: Bunting[] = [];
  for (const axis of [0, 1] as const) {
    const lines = new Map<number, [number, number][]>();
    for (const l of lamps) lines.set(l[1 - axis]!, [...(lines.get(l[1 - axis]!) ?? []), l]);
    for (const group of lines.values()) {
      group.sort((a, b) => a[axis]! - b[axis]!);
      for (let i = 0; i + 1 < group.length; i++) {
        const [a, b] = [group[i]!, group[i + 1]!];
        out.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1] });
      }
    }
  }
  return out;
}

// MARK: Lambs, bunnies and chicks

export type CritterKind = "lamb" | "bunny" | "chick";

export interface Critter {
  kind: CritterKind;
  /** Its home tile, on grass; it wanders within a tile or two. */
  x: number;
  y: number;
  /** Wander radius in tiles, and a phase so they don't move together. */
  r: number;
  phase: number;
}

/** Who is out on which lawn, in the order they appear as the week goes on. Each wanders in a patch of open grass (tested). */
export const CRITTERS: readonly Critter[] = [
  { kind: "lamb", x: -6, y: 6, r: 1.3, phase: 0.3 },
  { kind: "bunny", x: 18, y: 22, r: 1.4, phase: 1.1 },
  { kind: "chick", x: -8, y: 4, r: 1.0, phase: 2.7 },
  { kind: "lamb", x: 28, y: 11, r: 0.8, phase: 2.1 },
  { kind: "chick", x: 18, y: 13, r: 1.0, phase: 0.8 },
  { kind: "bunny", x: -5, y: 14, r: 1.4, phase: 4.0 },
  { kind: "chick", x: 12, y: 22, r: 1.0, phase: 3.3 },
  { kind: "bunny", x: 14, y: 24, r: 1.4, phase: 5.2 },
];

export interface CritterPose {
  /** Tile coordinates, fractional. */
  x: number;
  y: number;
  /** Looking to the right. */
  right: boolean;
  /** 0..1: how far up in a hop or a step. */
  hop: number;
}

/** Where `c` is at `ms`: a slow loop round its home. Pure, so both renderers agree. */
export function critterAt(c: Critter, ms: number): CritterPose {
  const t = ms / 1000;
  const w = c.kind === "lamb" ? 0.16 : c.kind === "bunny" ? 0.24 : 0.3;
  const a = t * w + c.phase;
  const x = c.x + Math.sin(a) * c.r;
  const y = c.y + Math.sin(a * 1.7 + 1) * c.r * 0.6;
  const dx = Math.cos(a) * c.r * w;
  const rate = c.kind === "bunny" ? 5 : c.kind === "chick" ? 7 : 2.5;
  return { x, y, right: dx >= 0, hop: Math.abs(Math.sin(t * rate + c.phase * 3)) };
}
