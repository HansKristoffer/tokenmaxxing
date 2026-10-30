/**
 * The Sankt Hans festive theme's scenery and its one named person (`festive.ts` `sanktHans`, 22 and 23 June): the
 * Dannebrog on poles, picnic blankets on the lawns, green wreaths on the doors, glow-worms over the lawn by the
 * pond, and the båltaler by the bonfire (`sankthans.ts`, which keeps the fire itself). Pure and map-driven like
 * `halloween.ts`: the web draws it in 2D (`web/src/game/midsommer.ts`) and 3D
 * (`web/src/render3d/town/midsommer3d.ts`). Nothing here blocks, bar the speaker, and nothing is kept by the server.
 *
 * (Named `midsommer`, not `sanktHans`, because `sankthans.ts` is the bonfire and a case-insensitive disk would
 * make the two one file.)
 */
import type { FestiveNpc } from "./festive.ts";
import type { GameMap } from "./maps.ts";
import { SHOP_DOOR_CHAR } from "./shoprooms.ts";

/**
 * The båltaler's tile: the lawn south of the pond, four tiles west of the bonfire (9, 17), off every path and
 * clear of the road below it. Facing the fire.
 */
export const BALTALER_TILE = { x: 5, y: 17 } as const;

export const BALTALER: FestiveNpc = {
  id: "baltaler",
  name: "Birgit the båltaler",
  x: BALTALER_TILE.x,
  y: BALTALER_TILE.y,
  facing: "right",
  lines: [
    "Goddag! I'm Birgit, the town's båltaler, the bonfire speaker. Tonight is Sankt Hans aften: 23 June, the eve of St. John's day, and the middle of the Danish summer.",
    "The old idea was that a fire on midsummer night kept the evil spirits away. These days it's mostly a picnic, a song and the longest light of the year. We still light the bål on the lawn by the pond.",
    "On top of the pile sits the heks, the witch, made of straw and rags. By tradition she is sent flying to Bloksbjerg, the Brocken mountain in Germany, where all the witches meet on this night.",
    "The pile goes up in the morning and is lit at 21:00. Make yourself a small straw heks at the picnic and press E at the lit fire: she'll fly off to Bloksbjerg with a tail of sparks. Your first one each year earns you a Heksebrænder stamp.",
    "Before the fire we do the båltale, a short speech about summer, the country and being kind to each other. Then everybody sings Midsommervisen, 'Vi elsker vort land', Holger Drachmann's song from 1885. Our band plays a waltz instead. Hum along.",
    "Bring a blanket! The red and white ones on the lawn are for everyone. Sit down, put a snobrød on a stick over the embers, eat a sausage and wait for the sun to go down. In Aarhus it hardly does.",
    "See the Dannebrog on the poles? Denmark's flag is the oldest national flag still in use, they say it fell from the sky in 1219. And the green wreaths on the doors are birch and flowers: midsummer is greenery.",
    "The little lights over the lawn are Sankt Hans-orme, glow-worms. They really do glow around now, which is why we named them after the night.",
    "The Clothes shop has a Midsommerkrans, a Heksehat and a Sankt Hans straw hat for the week. Wear one at the bål and the whole town will know you were here. Glædelig Sankt Hans!",
  ],
};

/** The Dannebrog poles, on grass: either side of the bonfire and round the pond. The first two stand all window. */
const FLAGS: readonly [number, number][] = [
  [8, 17],
  [11, 17],
  [8, 12],
  [1, 13],
  [1, 16],
  [14, 17],
];

/** The picnic blankets (their left tile; each is two wide), on the lawns round the bonfire. */
const BLANKETS: readonly [number, number][] = [
  [11, 17],
  [1, 17],
  [4, 16],
];

/** How many of a list show at this intensity (`festive.ts`): more as the 23rd comes on. */
export const flagCount = (intensity: number): number => (intensity < 0.6 ? 2 : intensity < 0.85 ? 4 : 6);
export const blanketCount = (intensity: number): number => (intensity < 0.6 ? 1 : intensity < 0.85 ? 2 : 3);
/** The glow-worms over the lawn: a handful at the start of the window, a swarm at the bonfire. */
export const wormCount = (intensity: number): number => Math.round(6 + 14 * intensity);

const grassy = (map: GameMap, x: number, y: number): boolean => {
  const ch = map.at(x, y);
  return ch === "." || ch === '"';
};

/** Flag poles standing on grass in `map` (all of them; `flagCount` says how many show). */
export const flagSpots = (map: GameMap): [number, number][] =>
  FLAGS.filter(([x, y]) => grassy(map, x, y)).map(([x, y]) => [x, y]);

/** Blankets whose two tiles are both grass (left tile). */
export const blanketSpots = (map: GameMap): [number, number][] =>
  BLANKETS.filter(([x, y]) => grassy(map, x, y) && grassy(map, x + 1, y)).map(([x, y]) => [x, y]);

/** The doors that get a wreath: the Tavern's (`I`), each company's (`D`) and each shop's. */
const DOORS = ["I", "D", ...Object.values(SHOP_DOOR_CHAR)];

export const wreathDoors = (map: GameMap): [number, number][] =>
  DOORS.flatMap((ch) => map.find(ch).map(([x, y]): [number, number] => [x, y]));

/** The corners of the lawn where the glow-worms drift: the grass by the pond and the bonfire, in tiles. */
export const WORM_LAWN = { x0: 1, y0: 10, x1: 13, y1: 18 } as const;

/** Where one glow-worm is at `t` seconds: a slow drift round its own centre. In tiles. */
export function wormAt(i: number, t: number): [number, number, number] {
  const w = WORM_LAWN;
  const a = ((i * 7919) % 1000) / 1000;
  const b = ((i * 104729) % 1000) / 1000;
  const cx = w.x0 + a * (w.x1 - w.x0 + 1);
  const cy = w.y0 + b * (w.y1 - w.y0);
  const s = 0.3 + (i % 5) * 0.08;
  const x = cx + Math.sin(t * s + i * 1.7) * 1.4;
  const y = cy + Math.cos(t * s * 0.8 + i * 2.3) * 0.9;
  // How lit it is, 0..1: each blinks on its own beat.
  const blink = Math.max(0, Math.sin(t * (0.9 + (i % 4) * 0.25) + i * 3.1));
  return [x, y, blink];
}

/** The hats (`costumes.ts` indices 50 to 52). */
export const MIDSOMMER_HATS = ["Midsommerkrans", "Heksehat", "Strå-hat"] as const;

/** How long the little witch takes to fly to Bloksbjerg, in ms. */
export const FLIGHT_MS = 9000;

/** The storage key for the year's Heksebrænder stamp. */
export const stampKey = (year: number): string => `sanktHans:heks:${year}`;
