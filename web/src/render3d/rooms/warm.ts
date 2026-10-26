import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { SHOP_DOOR_CHAR, SHOP_IDS, type ShopId, warmShop } from "../shops/catalog.ts";

/** Tiles from a shop door within which its interior starts building. */
const NEAR = 16;

type Doors = [ShopId, readonly (readonly [number, number])[]][];
const doors = new WeakMap<GameMap, Doors>();

/**
 * Walking in town, builds the interior of a shop whose door is close, one slice a frame, so the frame the player
 * walks in on doesn't have to (the pet shop's takes a quarter of a second whole). Cheap when nothing is near.
 */
export function warmNearShops(map: GameMap, x: number, y: number): void {
  let list = doors.get(map);
  if (!list) {
    list = SHOP_IDS.map((id): Doors[number] => [id, map.find(SHOP_DOOR_CHAR[id])]);
    doors.set(map, list);
  }
  for (const [id, tiles] of list) {
    for (const [dx, dy] of tiles) {
      if (Math.abs(dx - x) > NEAR || Math.abs(dy - y) > NEAR) continue;
      if (!warmShop(id)) return;
      break;
    }
  }
}
