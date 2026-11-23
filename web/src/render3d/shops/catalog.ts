/**
 * The four shops as the world sees them: one registry over the shops' own specs (`furniture.ts`, `clothes.ts`,
 * `barber.ts`, `pets.ts`), with every interior normalised to the same shape. Display tiles come out room-local
 * (the furniture shop writes them in world-grid tiles, with the `[1, 2]` inset; the others in the room's own),
 * and the room's blocked tiles become a `GameMap` (`W` is wall, `H` a prop, `c` a seat, `x` the door) so the
 * world's walking, seats and portals all work in them.
 */

import { SHOP_ROOM } from "@tokenmaxxing/core/shoprooms.ts";
import * as THREE from "three";
import { GameMap } from "../data/maps.ts";
import { disposeObject } from "../engine/dispose.ts";
import { beginTickScope, dropTickScope, endTickScope, type Model, type TickScope } from "../kit/kit.ts";
import type { Avatar } from "../people/avatar.ts";
import type { Room } from "../rooms/room.ts";
import { SHOP_BARBER } from "./barber.ts";
import { SHOP_CLOTHES } from "./clothes.ts";
import { INSET, SHOP_FURNITURE, type ShopItem, type ShopSpec } from "./furniture.ts";
import { SHOP_MARKET } from "./market.ts";
import { SHOP_NATMARKED } from "./natmarked.ts";
import { SHOP_PETS } from "./pets.ts";

export type { ShopItem, ShopSpec };
export type ShopId = ShopSpec["id"];

/** Where the room sits in the world grid: the two wall rows on top, one column on the left. */
export const SHOP_INSET = INSET;

export const SHOP_SPECS: Record<ShopId, ShopSpec> = {
  furniture: SHOP_FURNITURE,
  clothes: SHOP_CLOTHES,
  barber: SHOP_BARBER,
  pets: SHOP_PETS,
  natmarked: SHOP_NATMARKED,
  market: SHOP_MARKET,
};
export const SHOP_IDS: ShopId[] = ["furniture", "clothes", "barber", "pets", "natmarked", "market"];
/** The rooms and the storefronts' door tiles are the game's own (`core/src/shoprooms.ts`). */
export { SHOP_DOOR_CHAR, SHOP_ROOM } from "@tokenmaxxing/core/shoprooms.ts";
export const shopOfRoom = (room: string): ShopId | null =>
  SHOP_IDS.find((shopId) => SHOP_ROOM[shopId] === room) ?? null;

export interface ShopDisplay {
  item: ShopItem;
  /** The room's own tile. */
  tile: [number, number];
  /** Where the item stands, in the room's own units (for picking it with the pointer). */
  pos: THREE.Vector3;
}

export interface ShopRoom {
  id: ShopId;
  spec: ShopSpec;
  room: Room;
  displays: ShopDisplay[];
  shopkeeper: Avatar;
  /** The room's own tiles. */
  counter: [number, number];
  door: [number, number];
  map: GameMap;
  /** Whatever the shop gives beyond the contract (the clothes shop's mirror and `update`). */
  extra: unknown;
}

const cache = new Map<ShopId, ShopRoom>();

/** Drops the kept room, so the next `shopRoom` builds a fresh one (the real game frees a room when you leave it). */
export const forgetShopRoom = (id: ShopId): void => {
  cache.delete(id);
};

/**
 * Interiors being built ahead, a slice at a time (`warmShop`), and those finished and waiting for the player to
 * walk in.
 */
const warming = new Map<
  ShopId,
  {
    slices: Generator<void, ReturnType<ShopSpec["buildInterior"]>, void>;
    scopes: TickScope[];
    dormant: THREE.Group;
  }
>();
const warmed = new Map<ShopId, ReturnType<ShopSpec["buildInterior"]>>();

/**
 * Builds a bit of the shop's interior ahead of the player walking in (one slice per call), when its spec can
 * be sliced. True when there is nothing more to do: it is ready, or can only be built whole.
 */
export const shopNeedsWarm = (id: ShopId): boolean =>
  !!SHOP_SPECS[id].slices && !warmed.has(id) && !cache.has(id);

export function warmShop(id: ShopId): boolean {
  const spec = SHOP_SPECS[id];
  if (!spec.slices || warmed.has(id) || cache.has(id)) return true;
  let warm = warming.get(id);
  if (!warm) {
    warm = { slices: spec.slices(), scopes: [], dormant: new THREE.Group() };
    warming.set(id, warm);
  }
  const scope = beginTickScope();
  warm.scopes.push(scope);
  let step: IteratorResult<void, ReturnType<ShopSpec["buildInterior"]>>;
  try {
    step = warm.slices.next();
  } finally {
    endTickScope(scope, warm.dormant);
  }
  if (step.done) {
    ownWarmScopes(step.value, warm.scopes);
    warming.delete(id);
    warmed.set(id, step.value);
    return true;
  }
  return false;
}

/** Hands the scopes that built a warm interior over to its room, so disposing the room drops their work too. */
function ownWarmScopes(built: ReturnType<ShopSpec["buildInterior"]>, scopes: TickScope[]): void {
  const root = built.room.group;
  for (const scope of scopes) scope.root = root;

  const previousDispose = root.userData.onDispose as (() => void) | undefined;
  root.userData.onDispose = () => {
    previousDispose?.();
    for (const scope of scopes) dropTickScope(scope);
  };
}

/** A renderer leaving 3D must release unfinished and unused shop interiors too. */
export function dropWarmedShops(): void {
  const cancelled = new Error("Shop preparation cancelled");
  for (const pending of warming.values()) {
    // Throwing into the generator runs the rest of its build code, which ends in the `cancelled` error we expect.
    try {
      pending.slices.throw(cancelled);
    } catch (error) {
      if (error !== cancelled) throw error;
    } finally {
      for (const scope of pending.scopes) dropTickScope(scope);
    }
  }
  warming.clear();
  for (const built of warmed.values()) disposeObject(built.room.group);
  warmed.clear();
}

export function shopRoom(id: ShopId): ShopRoom {
  const cached = cache.get(id);
  if (cached) return cached;

  const spec = SHOP_SPECS[id];
  let ahead = warmed.get(id);
  warmed.delete(id);

  // A warm interior the player has not reached yet is finished now, in one go.
  const pending = warming.get(id);
  warming.delete(id);
  if (pending) {
    const scope = beginTickScope();
    pending.scopes.push(scope);
    try {
      let step = pending.slices.next();
      while (!step.done) step = pending.slices.next();
      ahead = step.value;
      ownWarmScopes(ahead, pending.scopes);
    } finally {
      endTickScope(scope, ahead?.room.group ?? pending.dormant);
    }
  }

  const built = ahead ?? spec.buildInterior();
  const { room } = built;

  // The furniture shop's tiles carry the inset; the others are the room's own.
  const shift: [number, number] = id === "furniture" ? INSET : [0, 0];
  const local = (tile: [number, number]): [number, number] => [tile[0] - shift[0], tile[1] - shift[1]];
  const door = local(built.door);

  // The walkable map: a wall column on each side, two wall rows above the room and one below it.
  const rows: string[] = [];
  for (let y = 0; y < room.D + 3; y++) {
    let row = "";
    for (let x = 0; x < room.W + 2; x++) {
      const roomX = x - 1;
      const roomZ = y - 2;
      if (roomX < 0 || roomZ < 0 || roomX >= room.W || roomZ >= room.D) {
        row += "W";
        continue;
      }
      if (roomX === door[0] && roomZ === door[1]) {
        row += "x";
        continue;
      }
      if (room.open(roomX, roomZ)) {
        row += "_";
        continue;
      }
      const piece = room.at(roomX, roomZ);
      if (piece?.asset.bed) row += "b";
      else if (piece?.asset.seat) row += "c";
      else row += "H";
    }
    rows.push(row);
  }

  const stackedOnTile = new Map<string, number>();
  const wallSampleCount = { Wallpaper: 0, Floors: 0 };
  const displays = built.displays.map((display): ShopDisplay => {
    const tile = local(display.at);
    const onWall = tile[0] <= 0 || tile[1] <= 0;
    const group = display.item.group as keyof typeof wallSampleCount;

    let pos: THREE.Vector3;
    if (display.world) {
      pos = new THREE.Vector3(display.world[0], display.world[1], display.world[2]);
    } else if (id === "furniture" && group in wallSampleCount) {
      // The wall samples: two rows of five panels on the west wall, 1.55 apart.
      const sample = wallSampleCount[group]++;
      const firstZ = group === "Wallpaper" ? 1.675 : 10.375;
      pos = new THREE.Vector3(0.2, 0.62 + Math.floor(sample / 5) * 1.12, firstZ + (sample % 5) * 1.55);
    } else {
      // Items sharing a tile stand on shelf tiers: spread them up the wall so they can each be picked.
      const key = `${tile[0]},${tile[1]}`;
      const stacked = stackedOnTile.get(key) ?? 0;
      stackedOnTile.set(key, stacked + 1);
      pos = new THREE.Vector3(tile[0] + 0.5, (onWall ? 0.5 : 0.4) + stacked * 0.4, tile[1] + 0.5);
    }
    return { item: display.item, tile, pos };
  });

  const shop: ShopRoom = {
    id,
    spec,
    room,
    displays,
    shopkeeper: built.shopkeeper,
    counter: local(built.counter),
    door,
    map: new GameMap(SHOP_ROOM[id], spec.name, rows),
    extra: built,
  };
  cache.set(id, shop);
  return shop;
}

/** The storefront model for the town. */
export const storefront = (id: ShopId): Model => SHOP_SPECS[id].exterior();
