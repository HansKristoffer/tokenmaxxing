import { type GameMap, MAPS, tileBounds } from "./maps.ts";
import { SPOTS } from "./roulette.ts";

/**
 * The roulette table in the Tavern's basement net cafe: a block of `♦`, and the `♥` spots around it where
 * players stand.
 */
export const ROULETTE_TABLE_CHAR = "♦";
export const ROULETTE_SPOT_CHAR = "♥";

/** The table's tiles as a rectangle, or null if the map has none. */
export function rouletteTable(map: GameMap = MAPS.basement) {
  return tileBounds(map.find(ROULETTE_TABLE_CHAR));
}

/**
 * The spots, left to right, the one above the table before the one below it in each column. Spot `i` of a
 * `RouletteSeat` is `[i]`.
 */
export function rouletteSpots(map: GameMap = MAPS.basement): [number, number][] {
  return map
    .find(ROULETTE_SPOT_CHAR)
    .map(([x, y]): [number, number] => [x, y])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .slice(0, SPOTS);
}

/** The spot at tile (x, y): its index, or -1. */
export const spotAt = (x: number, y: number, map: GameMap = MAPS.basement): number =>
  rouletteSpots(map).findIndex(([sx, sy]) => sx === x && sy === y);
