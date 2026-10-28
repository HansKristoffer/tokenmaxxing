import type { GameMap } from "./maps.ts";
import { DIRS, type Facing } from "./world.ts";

/** Free catch-and-release fishing: a journal, without coins or consumable bait. */
export const FISH = [
  { id: "perch", name: "Pond perch", emoji: "🐟", weight: 38, min: 12, max: 32, color: "#8db56b" },
  { id: "carp", name: "Copper carp", emoji: "🐠", weight: 28, min: 20, max: 65, color: "#db9c54" },
  { id: "tench", name: "Sleepy tench", emoji: "🐟", weight: 18, min: 18, max: 50, color: "#8fa098" },
  { id: "pike", name: "Mossy pike", emoji: "🐟", weight: 10, min: 35, max: 90, color: "#6e9275" },
  { id: "duck", name: "Rubber duck", emoji: "🦆", weight: 5, min: 6, max: 12, color: "#f3ce59" },
  { id: "golden", name: "Golden koi", emoji: "✨", weight: 1, min: 25, max: 55, color: "#f6cc6c" },
] as const;
export type FishId = (typeof FISH)[number]["id"];
export interface FishCatch {
  fish: FishId;
  cm: number;
}
export interface FishingEntry extends FishCatch {
  count: number;
}
export const BITE_WINDOW_MS = 2400;
export const CAST_COOLDOWN_MS = 1500;

export interface FishingCast {
  x: number;
  y: number;
  waterX: number;
  waterY: number;
  biteAt: number;
  endsAt: number;
}
export type CastReply = { ok: true; cast: FishingCast; now: number } | { ok: false; message: string };
export type ReelReply =
  { ok: true; catch: FishCatch; journal: FishingEntry[] } | { ok: false; message: string };

export const fishById = (id: string) => FISH.find((f) => f.id === id);

/** Only the town pond's water can be cast into, from an adjacent walkable bank. */
export function fishingWater(map: GameMap, x: number, y: number, facing: Facing): [number, number] | null {
  const [dx, dy] = DIRS[facing];
  return map.id === "town" && map.walkable(x, y) && map.at(x + dx, y + dy) === "~" ? [x + dx, y + dy] : null;
}

export function newCast(
  x: number,
  y: number,
  water: [number, number],
  now: number,
  random = Math.random,
): FishingCast {
  const biteAt = now + 2500 + Math.floor(random() * 3500);
  return { x, y, waterX: water[0], waterY: water[1], biteAt, endsAt: biteAt + BITE_WINDOW_MS };
}
export const fishingPhase = (cast: FishingCast, now: number): "waiting" | "bite" | "missed" =>
  now < cast.biteAt ? "waiting" : now < cast.endsAt ? "bite" : "missed";

export function rollCatch(random = Math.random): FishCatch {
  let roll = random() * 100;
  const fish =
    FISH.find((f) => {
      roll -= f.weight;
      return roll < 0;
    }) ?? FISH[FISH.length - 1]!;
  return { fish: fish.id, cm: fish.min + Math.floor(random() * (fish.max - fish.min + 1)) };
}
