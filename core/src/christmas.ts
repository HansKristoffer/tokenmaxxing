/**
 * Christmas in town (the theme in `festive.ts`, 18 to 25 December): a tree on the square that gains ornaments as
 * the days go, a gift pile under it, wreaths and a nisse on every doorstep, lights strung between the square's
 * lamps, candy-cane lamp posts, snowmen on the lawns, and Nisse Knud by the tree. All of it is placement, worked out
 * from the clock's build-up (`progress`) and the map, so the server keeps nothing. The 2D draw is
 * `web/src/game/christmas.ts`, the 3D one `web/src/render3d/town/christmas3d.ts`; both read this.
 * The advent calendar itself stays `december.ts`. Scenery on the grass or the paving blocks nothing, bar the
 * trunk and Knud (`blocksChristmas`).
 */
import type { Festive, FestiveNpc } from "./festive.ts";
import type { GameMap } from "./maps.ts";
import { SHOP_DOOR_CHAR } from "./shoprooms.ts";

/** The tree, on the square's paving south of the fountain: it blocks its own tile. */
export const TREE = { x: 10, y: 6 } as const;

/**
 * Nisse Knud's tile: on the square east of the tree, in the open paving (the square is 19 wide, so he is no
 * chokepoint: both ways round him are clear). He blocks his tile, and E on it talks (`FESTIVE_NPC.christmas`).
 */
export const NISSE_TILE = { x: 13, y: 5 } as const;

/** Where the gifts lie: beside the trunk, two stacks, up to four boxes each. */
export const GIFT_TILES: readonly { x: number; y: number }[] = [
  { x: 9, y: 6 },
  { x: 11, y: 6 },
];
/** The most boxes under the tree (on the 24th evening). */
export const GIFTS_MAX = 8;

/** The square's four lamps (CORE's `L`), top-left to bottom-right: the lights are strung between them. */
export const SQUARE_LAMPS: readonly [number, number][] = [
  [1, 1],
  [19, 1],
  [1, 8],
  [19, 8],
];
/** The garlands: a string of lights between each pair of lamps along the square's top and bottom edges. */
export const GARLANDS: readonly { from: number; to: number }[] = [
  { from: 0, to: 1 },
  { from: 2, to: 3 },
];

/** Three snowmen, on the lawns: the first is out from the start, a second and a third as the snow piles up. */
export const SNOWMEN: readonly { x: number; y: number }[] = [
  { x: 18, y: 7 },
  { x: 2, y: 7 },
  { x: 4, y: 10 },
];

/** The doors that get a wreath and a nisse: the Tavern's (`I`), each company's (`D`) and each shop's. */
const DOORS = ["I", "D", ...Object.values(SHOP_DOOR_CHAR)];

/** The build-up through the window, 0 on 18 December to 1 from 24 December 18:00 (continuous): from the theme's ramp. */
export const progress = (f: Festive | null): number =>
  f?.id === "christmas" ? Math.min(1, Math.max(0, (f.intensity - 0.15) / 0.85)) : 0;

/** Whether it is Juleaften itself or later (the 24th at 00:00 on): the gifts and the star are full. */
export const eveOn = (f: Festive | null): boolean => f?.id === "christmas" && f.days >= 0;

// MARK: The tree

export type OrnamentSet = "lightsLow" | "red" | "gold" | "lightsUp" | "hearts" | "flags" | "tinsel";

/** One thing on the tree: its set, its angle round the trunk (0 is the front, towards the player), its height 0..1 of the foliage. */
export interface Ornament {
  set: OrnamentSet;
  a: number;
  h: number;
  /** A colour index within its set (the lights' four, the flags' two). */
  hue: number;
}

/** Each set, in the order the days bring them, and how many hang. Julehjerter and a flagranke are the Danish ones. */
const SETS: readonly { set: OrnamentSet; n: number; lo: number; hi: number; spread: number }[] = [
  { set: "lightsLow", n: 14, lo: 0.06, hi: 0.5, spread: 2.6 },
  { set: "red", n: 10, lo: 0.1, hi: 0.82, spread: 2.2 },
  { set: "gold", n: 10, lo: 0.14, hi: 0.86, spread: 2.2 },
  { set: "lightsUp", n: 12, lo: 0.5, hi: 0.9, spread: 2.6 },
  { set: "hearts", n: 7, lo: 0.18, hi: 0.72, spread: 1.5 },
  { set: "flags", n: 8, lo: 0.2, hi: 0.78, spread: 2.4 },
  { set: "tinsel", n: 12, lo: 0.08, hi: 0.9, spread: 2.5 },
];

const GOLDEN = 2.399963;

/** All the ornaments, set by set (so showing the first `n` is "the days so far"): fixed, the same in both renderers. */
export const ORNAMENTS: readonly Ornament[] = SETS.flatMap(({ set, n, lo, hi, spread }, s) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    // The height climbs through the set; the angle swings back and forth across the front half (a golden-angle walk).
    const wob = ((i * GOLDEN + s * 1.7) % (2 * Math.PI)) / (2 * Math.PI);
    return { set, h: lo + (hi - lo) * t, a: (wob - 0.5) * spread * 2 * 0.72, hue: (i + s) % 4 };
  }),
);

/** How many ornaments are hanging at this build-up: none on the 18th, all by the 24th at 18:00. */
export const ornamentsShown = (p: number): number =>
  Math.min(ORNAMENTS.length, Math.floor(p * ORNAMENTS.length + 0.5));

/** The star on top goes up with the last days. */
export const starUp = (p: number): boolean => p >= 0.85;

/** How many gift boxes lie under the tree: none at first, eight on Juleaften's evening. */
export const giftsShown = (p: number): number => Math.min(GIFTS_MAX, Math.floor(p * (GIFTS_MAX + 0.5)));

/** How many snowmen are out: one from the start, three from the 23rd. */
export const snowmenShown = (p: number): number => Math.min(SNOWMEN.length, 1 + Math.floor(p * 2.4));

/** How many of the garland's bulbs are lit, 0..1: a quarter on the 18th, all of them by the 24th evening. */
export const garlandLit = (p: number): number => 0.25 + 0.75 * p;

/** A fixed hash of an index, 0..1: which bulbs light first. */
export const bulbHash = (i: number): number => {
  let h = Math.imul(i + 1, 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  return (h >>> 8) / 0x1000000;
};

// MARK: Doors

export interface DoorSpot {
  /** The door's tile. */
  x: number;
  y: number;
  /** The Tavern's wreath is the bigger one. */
  inn: boolean;
  /** Which kind of door: the 3D buildings sit differently to their door tile. */
  kind: "inn" | "company" | "shop";
}

/** Where the wreaths hang: each door in `map` (the town). */
export function wreathSpots(map: GameMap): DoorSpot[] {
  return DOORS.flatMap((ch) =>
    map.find(ch).map(([x, y]) => ({
      x,
      y,
      inn: ch === "I",
      kind: ch === "I" ? "inn" : ch === "D" ? "company" : "shop",
    })),
  );
}

export interface NisseSpot {
  x: number;
  y: number;
  /** Which way it looks: towards the path. */
  facing: "left" | "right";
}

/**
 * Where the small nisser sit: on the grass beside the path below each door (to its right, else its left: the
 * pumpkins take the left, the morning paper the right of the lower row), with a bowl of risalamande. Only on
 * grass, so never in a path.
 */
export function nisseSpots(map: GameMap): NisseSpot[] {
  const out: NisseSpot[] = [];
  for (const ch of DOORS)
    for (const [x, y] of map.find(ch)) {
      const right = map.at(x + 1, y + 1) === ".";
      const left = map.at(x - 1, y + 1) === ".";
      if (right) out.push({ x: x + 1, y: y + 1, facing: "left" });
      else if (left) out.push({ x: x - 1, y: y + 1, facing: "right" });
    }
  return out;
}

/** Whether the tile is the tree's trunk or Knud's, where nobody walks. */
export const blocksTile = (x: number, y: number): boolean =>
  (x === TREE.x && y === TREE.y) || (x === NISSE_TILE.x && y === NISSE_TILE.y);

// MARK: What Knud says and what the gifts say

/** The lines under the tree, one a day (a gift a player opens): flavour, no reward. */
export const GIFT_LINES: readonly string[] = [
  "A card from the Tokenhavn Bryggeri: 'Happy holidays, drink responsibly, deploy on Monday.'",
  "A rubber duck. Again. It has a tiny Santa hat.",
  "Socks. Wool, red, size 'whatever the cache hit rate is'.",
  "A tin of Danish butter cookies. There is sewing thread inside, as there always is.",
  "A marzipan pig. It looks at you the way a failing build does.",
  "A candle, a very large candle. It is for the window, not for the commit message.",
  "A book of Danish carols with every verse. You will sing only the first.",
  "A card from the Julekalender: 'Door 24 was always going to be the nisse'.",
];

export const giftLine = (day: number): string =>
  GIFT_LINES[((day % GIFT_LINES.length) + GIFT_LINES.length) % GIFT_LINES.length]!;

// MARK: Nisse Knud

/**
 * The square's nisse: a grey farm nisse in a red cap who has looked after the town's lofts since before the
 * Tavern had a roof, and who is very sure he is owed his risalamande. His lines say what Juleaften is in Aarhus
 * and what can be done now (they are the manual for the theme's few interactions).
 */
export const CHRISTMAS_NPC: FestiveNpc = {
  id: "knud",
  name: "Nisse Knud",
  x: NISSE_TILE.x,
  y: NISSE_TILE.y,
  facing: "left",
  lines: [
    "Knud's the name. Nisse. Grey coat, red cap, and no, you cannot see my eyes. That is the whole point of the cap.",
    "Juleaften is the 24th, in the evening. In Denmark that is THE night: dinner, the tree, the singing. The 25th is only for sleeping it off.",
    "We nisser live in the lofts and look after the place. Leave us a bowl of risalamande with a lump of butter in it, or the cows get ill. Old rule.",
    "Risalamande: rice pudding, cream, cherry sauce, and ONE whole almond. Whoever finds it gets the marzipan pig. Everyone else pretends not to be disappointed.",
    "See the tree? It went up on the 18th, bare, and the town has been dressing it a bit every day. Lights first, then baubles, the paper hearts, the flag garland. All of it by Juleaften evening.",
    "Press E at the foot of the tree and you hang a julehjerte of your own. One a day. Three days of hearts and I will know you are one of ours, and say so.",
    "The hearts are woven paper, red and white. Every Danish child makes them in December and every Danish child's are crooked. That is the tradition.",
    "The lights between the lamps get brighter every day. The wreaths on the doors are up since the first morning. Look at my cousins on the doorsteps, they are keeping watch.",
    "Under the tree: the gift pile. One more box a day. Press E on it and see what the Tavern left. Do not shake it.",
    "Julekalender at your desk, one door a day up to the 24th. Julefrokost in the Tavern on Fridays and Saturdays. And the Clothes shop sells a Santa hat, antlers and a gløgg mug until the 26th.",
    "And that Julehue on your head, if you have one? Good hat. Honest hat. A Santa hat is for people who deliver, a nisse hat is for people who WATCH.",
  ],
};
