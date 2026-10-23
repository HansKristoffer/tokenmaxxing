import { companyOfRoom, type RoomId } from "@tokenmaxxing/core/world.ts";
import { COMPANY_FURNITURE } from "@tokenmaxxing/core/office.ts";
import { POSTERS } from "@tokenmaxxing/core/posters.ts";
import type { GameMap, MapId } from "@tokenmaxxing/core/maps.ts";
import { SHOP_IDS, SHOP_ROOM, shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import * as THREE from "three";
import { buildHq } from "../demo3d/hq3d.ts";
import { beginTickScope, endTickScope } from "../demo3d/kit.ts";
import { setPropsNight } from "../demo3d/props.ts";
import { loadSlices } from "../demo3d/registry.ts";
import { forgetShopRoom, shopRoom } from "../demo3d/shops/index.ts";
import { buildRoomSkin, type RoomSkin, WorldRoom } from "../demo3d/world.ts";
import "../demo3d/world-rooms.ts";
import { disposeObject } from "./dispose.ts";
import { type RoomCtx, type RoomView, registerRoom, withTicks } from "./rooms.ts";

/**
 * The demo's hand-built rooms, as the real game's: the Tavern and the dorm, the basement, the four shops, the
 * company house and the offices, each built from the core map of the room the server says we are in (so the
 * tiles, doors, seats and displays are the game's own). The slices register their tile art at load.
 */
await loadSlices();

const SEAT_Y: Record<string, number> = { bench: 0.31, chair: 0.33, sofa: 0.36, bed: 0.3 };
const WALL_H = 2.6;

/** What a room builder hands back besides the picture. */
export interface SkinParts {
  /** The demo's own handles into the room (the Tavern's boards, the basement's screens...), by room. */
  extra: unknown;
  /** Bots whose bodies the room draws itself (the barkeep, the shopkeepers): ids. */
  keepers: ReadonlySet<number>;
}

const kindOf = (id: string): string => (id.includes(":") ? id.slice(0, id.indexOf(":")) : id);

/** The room as a `RoomView`: the world room's group, its walls that lower, and the tick functions it registered. */
function viewOf(
  id: string,
  map: GameMap,
  room: WorldRoom,
  ticks: ((t: number) => void)[],
  parts: SkinParts,
  view = Math.max(7, Math.min(10.5, Math.max(map.width * 0.5, map.height * 0.75))),
): RoomView & { parts: SkinParts; room: WorldRoom } {
  const W = map.width;
  const D = map.height;
  const group = new THREE.Group();
  group.add(room.group);
  // The static batching of the renderer's stage does the merging; the demo's own flag would batch twice.
  room.group.userData.bake = false;
  return {
    id,
    group,
    room,
    parts,
    keepers: parts.keepers,
    outdoors: false,
    bounds: { minX: 0, maxX: W, minZ: 0, maxZ: D, height: WALL_H },
    view,
    toWorld: (tx, ty) => [tx - map.x0 + 0.5, ty - map.y0 + 0.5],
    toTile: (x, z) => [Math.floor(x) + map.x0, Math.floor(z) + map.y0],
    seatY: (_x, _y, kind) => SEAT_Y[kind] ?? 0.33,
    tick(t, _dt, toward) {
      for (const f of ticks) f(t);
      room.facing(toward);
    },
    signs: () => [],
    night: (on) => setPropsNight(on),
    dispose() {
      group.removeFromParent();
      disposeObject(group);
    },
  };
}

/** A world room from `skin` (or tile by tile when null), with the ticks its builders registered. */
function worldRoom(mapId: MapId, map: GameMap, skin: () => RoomSkin | null) {
  const scope = beginTickScope();
  const built = withTicks(() => new WorldRoom(mapId, map, skin()));
  endTickScope(scope, built.value.group);
  return built;
}

/** Any room of the demo's with a skin of its own (`world-rooms.ts`), or drawn tile by tile when it has none. */
function buildSkinned(id: RoomId, ctx: RoomCtx): RoomView {
  const mapId = kindOf(id) as MapId;
  const built = worldRoom(mapId, ctx.map, () => buildRoomSkin(mapId));
  return viewOf(id, ctx.map, built.value, built.ticks, { extra: built.value.skin?.extra ?? null, keepers: new Set() });
}

/** A shop: the interior the demo built for it, with the shopkeeper the room draws itself. */
function buildShop(id: RoomId, ctx: RoomCtx): RoomView {
  const shop = shopOfRoom(id)!;
  forgetShopRoom(shop);
  const mapId = SHOP_ROOM[shop] as MapId;
  const built = worldRoom(mapId, ctx.map, () => buildRoomSkin(mapId));
  const botId = SHOPKEEPER_BOT[shop];
  return viewOf(id, ctx.map, built.value, built.ticks, { extra: shopRoom(shop), keepers: new Set([botId]) }, SHOP_VIEW[shop] ?? 8.5);
}

/** The core bot behind each shop's counter. */
export const SHOPKEEPER_BOT: Record<(typeof SHOP_IDS)[number], number> = { furniture: -5, clothes: -6, barber: -7, pets: -8 };
const SHOP_VIEW: Partial<Record<(typeof SHOP_IDS)[number], number>> = { furniture: 11, clothes: 8.5, barber: 8, pets: 8.5 };

const pieceChars = new Map<string, number>([...COMPANY_FURNITURE, ...POSTERS].map((p): [string, number] => [p.ch, p.w ?? 1]));

/** What a company has dropped in its house, read off the map (a piece writes its character on every tile it covers). */
export function placedIn(map: GameMap): { ch: string; x: number; y: number }[] {
  const out: { ch: string; x: number; y: number }[] = [];
  map.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const w = pieceChars.get(row[rx]!);
      if (!w) continue;
      out.push({ ch: row[rx]!, x: rx + map.x0, y: ry + map.y0 });
      rx += w - 1;
    }
  });
  return out;
}

/** The company house, with its dropped furniture and posters and the company's desk fleet and colours. */
function buildHouse(id: RoomId, ctx: RoomCtx): RoomView {
  const co = ctx.companies.find((c) => c.id === companyOfRoom(id));
  const scope = beginTickScope();
  const built = withTicks(() => buildHq({ fleet: co?.deskFleet ?? 0, placed: placedIn(ctx.map) }));
  const hq = built.value;
  endTickScope(scope, hq.room.group);
  const skin: RoomSkin = { group: hq.room.group, offset: [1, 2], facing: (v) => hq.room.facing(v), extra: hq };
  const room = new WorldRoom("hq", ctx.map, skin);
  return viewOf(id, ctx.map, room, built.ticks, { extra: hq, keepers: new Set() });
}

registerRoom("inn", buildSkinned);
registerRoom("upstairs", buildSkinned);
registerRoom("basement", buildSkinned);
registerRoom("hq", buildHouse);
for (const shop of SHOP_IDS) registerRoom(SHOP_ROOM[shop], buildShop);
