import type { GameMap, MapId } from "@tokenmaxxing/core/maps.ts";
import { SHOP_IDS, SHOP_ROOM, shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import { companyOfRoom, type RoomId } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { type BasementScene, dimBasement } from "../demo3d/basement3d.ts";
import { DUNGEON_ASSETS } from "../demo3d/dungeon3d.ts";
import { exitDoorway, exitStairs } from "../demo3d/exits3d.ts";
import { buildHq, type Hq } from "../demo3d/hq3d.ts";
import { beginTickScope, canvasTexture, endTickScope, glow, Model } from "../demo3d/kit.ts";
import { beginLanScope, endLanScope } from "../demo3d/livescreen.ts";
import { setPropsNight } from "../demo3d/props.ts";
import { Room } from "../demo3d/room.ts";
import { forgetShopRoom, type ShopRoom, shopRoom } from "../demo3d/shops/index.ts";
import type { TavernRoom } from "../demo3d/tavern3d.ts";
import { buildRoomSkin, type RoomSkin, WorldRoom } from "../demo3d/world.ts";
import "../demo3d/world-rooms.ts";
import { world } from "../game/world.ts";
import { disposeObject } from "./dispose.ts";
import { ExitMarkers } from "./exit-markers.ts";
import { hallwayTiles, houseOffset, housePassage } from "./hq-layout.ts";
import { liveBasement, liveTavern } from "./live.ts";
import { placedIn } from "./placed.ts";
import { type LiveFrame, type RoomCtx, type RoomView, registerRoom, withTicks } from "./rooms.ts";
import { TavernEvents } from "./tavern-events.ts";

/**
 * The demo's hand-built rooms, as the real game's: the Tavern and the dorm, the basement, the four shops, the
 * company house and the offices, each built from the core map of the room the server says we are in (so the
 * tiles, doors, seats and displays are the game's own). The slices register their tile art at load.
 */
const SEAT_Y: Record<string, number> = { bench: 0.31, chair: 0.33, sofa: 0.36, bed: 0.3 };
const WALL_H = 2.6;

/** What a room builder hands back besides the picture. */
export interface SkinParts {
  /** Once a frame: the real game's data on the room's boards (`live.ts`). */
  live?: (t: number) => void;
  /** Once a frame, after the people: the real game's events in the room (the Tavern's jukebox sign). */
  frame?: (f: LiveFrame) => void;
  /** A coin was tossed into the tip jar or fountain in front of this tile. */
  onToss?: (tx: number, ty: number) => void;
  /** The room's own light, once: given the stage's lights (the Tavern keeps them to dim after dark). */
  lights?: (scene: THREE.Scene, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight) => void;
  /** Frees what `frame` made (labels). */
  end?: () => void;
  /** A shop's interior, for picking its shelves. */
  shop?: ShopRoom;
  /** The basement's dim light. */
  dim?: boolean;
  /** The demo's own handles into the room (the Tavern's boards, the basement's screens...), by room. */
  extra: unknown;
  /** Bots whose bodies the room draws itself (the barkeep, the shopkeepers): ids. */
  keepers: ReadonlySet<number>;
  /** Lets go of what the room listens to outside itself (the LAN party), when it is thrown away. */
  free?: () => void;
}

/** Bent, the barkeep: the Tavern draws him behind the bar himself. */
const BARKEEP_BOT = -4;

const kindOf = (id: string): string => (id.includes(":") ? id.slice(0, id.indexOf(":")) : id);

/**
 * Which way each seat of a room is turned (a yaw), by the middle of its tile in the view's units. The server only
 * knows a chair as "up" and a bench as "down"; the pieces are turned to the table or the bar, and a sitter should
 * face where their seat does.
 */
function seatYaws(group: THREE.Group, extra: unknown): { x: number; z: number; yaw: number }[] {
  const room = (extra as { room?: unknown } | null)?.room;
  if (!(room instanceof Room)) return [];
  group.updateMatrixWorld(true);
  const origin = group.getWorldPosition(new THREE.Vector3());
  const out: { x: number; z: number; yaw: number }[] = [];
  for (const p of room.placed) {
    if (!p.asset.seat) continue;
    const seat = room.seatOf(p);
    if (seat) out.push({ x: seat.at.x - origin.x, z: seat.at.z - origin.z, yaw: seat.turn });
  }
  return out;
}

/** The room as a `RoomView`: the world room's group, its walls that lower, and the tick functions it registered. */
export function viewOf(
  id: string,
  map: GameMap,
  room: WorldRoom,
  ticks: ((t: number) => void)[],
  parts: SkinParts,
  view = Math.max(7, Math.min(12, Math.max(map.width * 0.5, map.height * 0.75))),
): RoomView & { parts: SkinParts; room: WorldRoom } {
  const W = map.width;
  const D = map.height;
  const group = new THREE.Group();
  group.add(room.group);
  // The pulsing ring on every exit's threshold while you are near it.
  const markers = new ExitMarkers(map, (tx, ty) => [tx - map.x0 + 0.5, ty - map.y0 + 0.5]);
  group.add(markers.group);
  let yaws: ReturnType<typeof seatYaws> | null = null;
  // The static batching of the renderer's stage does the merging; the demo's own flag would batch twice.
  room.group.userData.bake = false;
  return {
    id,
    group,
    room,
    parts,
    keepers: parts.keepers,
    shop: parts.shop,
    lights: parts.lights ?? (parts.dim ? (scene, hemi, sun) => dimBasement(scene, hemi, sun) : undefined),
    outdoors: false,
    bounds: { minX: 0, maxX: W, minZ: 0, maxZ: D, height: WALL_H },
    view,
    toWorld: (tx, ty) => [tx - map.x0 + 0.5, ty - map.y0 + 0.5],
    toTile: (x, z) => [Math.floor(x) + map.x0, Math.floor(z) + map.y0],
    seatY: (_x, _y, kind) => SEAT_Y[kind] ?? 0.33,
    seatYaw(tx, ty) {
      yaws ??= seatYaws(group, parts.extra);
      const x = tx - map.x0 + 0.5;
      const z = ty - map.y0 + 0.5;
      let best: number | null = null;
      let bestD = 0.6;
      for (const s of yaws) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < bestD) {
          bestD = d;
          best = s.yaw;
        }
      }
      return best;
    },
    tick(t, _dt, toward) {
      for (const f of ticks) f(t);
      parts.live?.(t);
      room.facing(toward);
    },
    frame(f) {
      markers.update(f.me, f.t);
      parts.frame?.(f);
    },
    onToss: parts.onToss,
    signs: () => [],
    night: (on) => setPropsNight(on),
    dispose() {
      parts.end?.();
      parts.free?.();
      markers.dispose();
      group.removeFromParent();
      disposeObject(group);
    },
  };
}

/** A world room from `skin` (or tile by tile when null), with the ticks its builders registered. */
export function worldRoom(mapId: MapId, map: GameMap, skin: () => RoomSkin | null) {
  const scope = beginTickScope();
  beginLanScope();
  const built = withTicks(() => new WorldRoom(mapId, map, skin()));
  const free = endLanScope();
  endTickScope(scope, built.value.group);
  return { ...built, free };
}

/** Any room of the demo's with a skin of its own (`world-rooms.ts`), or drawn tile by tile when it has none. */
function buildSkinned(id: RoomId, ctx: RoomCtx): RoomView {
  const mapId = kindOf(id) as MapId;
  const built = worldRoom(mapId, ctx.map, () => buildRoomSkin(mapId));
  const extra = built.value.skin?.extra ?? null;
  const live =
    mapId === "inn"
      ? liveTavern(extra as TavernRoom)
      : mapId === "basement"
        ? liveBasement(extra as BasementScene)
        : undefined;
  const inn = mapId === "inn" ? new TavernEvents(extra as TavernRoom) : null;
  return viewOf(id, ctx.map, built.value, built.ticks, {
    extra,
    keepers: mapId === "inn" ? new Set([BARKEEP_BOT]) : new Set(),
    live,
    dim: mapId === "basement",
    frame: inn ? (f) => inn.update(f) : undefined,
    lights: inn ? (_scene, hemi, sun) => inn.lights(hemi, sun) : undefined,
    onToss: inn ? () => inn.toss() : undefined,
    end: inn ? () => inn.dispose() : undefined,
    free: built.free,
  });
}

/** A shop: the interior the demo built for it, with the shopkeeper the room draws itself. */
function buildShop(id: RoomId, ctx: RoomCtx): RoomView {
  const shop = shopOfRoom(id)!;
  forgetShopRoom(shop);
  const mapId = SHOP_ROOM[shop] as MapId;
  const built = worldRoom(mapId, ctx.map, () => buildRoomSkin(mapId));
  const botId = SHOPKEEPER_BOT[shop];
  return viewOf(
    id,
    ctx.map,
    built.value,
    built.ticks,
    { extra: shopRoom(shop), shop: shopRoom(shop), keepers: new Set([botId]), free: built.free },
    SHOP_VIEW[shop] ?? 8.5,
  );
}

/** The core bot behind each shop's counter. */
export const SHOPKEEPER_BOT: Record<(typeof SHOP_IDS)[number], number> = {
  furniture: -5,
  clothes: -6,
  barber: -7,
  pets: -8,
};
const SHOP_VIEW: Partial<Record<(typeof SHOP_IDS)[number], number>> = {
  furniture: 11,
  clothes: 8.5,
  barber: 8,
  pets: 8.5,
};

/** The company house, with its dropped furniture and posters and the company's desk fleet and colours. */
function buildHouse(id: RoomId, ctx: RoomCtx): RoomView {
  const co = ctx.companies.find((c) => c.id === companyOfRoom(id));
  const scope = beginTickScope();
  const built = withTicks(() => buildHq({ fleet: co?.deskFleet ?? 0, placed: placedIn(ctx.map) }));
  const hq = built.value;
  endTickScope(scope, hq.room.group);
  // The stairs up to the common room, in the south wall (`u`): on the floor tile in front of it.
  for (const [sx, sy] of ctx.map.find("u")) {
    const [rx, rz] = hq.tile(sx, sy);
    const m = exitStairs("up", { wall: "#efe4cf", plate: "LOUNGE" });
    m.position.set(rx + 0.5, 0, rz - 0.5);
    m.rotation.y = Math.PI;
    hq.room.group.add(m);
  }
  // The house's floor keeps its tiles as the hallways grow above it (negative y, `hqMap`): the picture is placed by
  // the map's origin (`hq-layout.ts`), and the hallways with their office doors are drawn over it. The map is the
  // live one (`world.map`); the stage builds the room again when it changes (a door added), as its key is the map.
  const offset = houseOffset(ctx.map);
  const halls = buildHallways(ctx.map, hq);
  hq.room.group.add(halls.group);
  const skin: RoomSkin = {
    group: hq.room.group,
    offset,
    facing: (v) => {
      hq.room.facing(v);
      halls.facing(v);
    },
    extra: hq,
  };
  const room = new WorldRoom("hq", ctx.map, skin);
  return viewOf(id, ctx.map, room, built.ticks, {
    extra: hq,
    keepers: new Set(),
    frame: (f) => halls.player(f.me ? [f.me[0] - offset[0], f.me[1] - offset[1]] : null),
  });
}

/** The owner's name over an office door, on a plate; shut doors get a padlock. */
function namePlate(door: Model, name: string, open: boolean): void {
  const text = `${open ? "" : "🔒 "}${name}`.slice(0, 14);
  const tex = canvasTexture(128, 28, (g) => {
    g.fillStyle = "#2b2433";
    g.fillRect(0, 0, 128, 28);
    g.fillStyle = "#fbf7ef";
    g.font = "bold 14px ui-monospace, Menlo, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 64, 15);
  });
  door.box([0.96, 0.24, 0.03], "#2b2433", [0, 2.08, 0.1], 0.004);
  door.plane(0.92, 0.2, glow("#fff", tex), [0, 2.2, 0.12]);
}

/**
 * The hallways of office doors above the house's floor (`hqMap`: three rows per ten offices, a corridor behind a
 * wall of doors, joined to the floor by a passage through the north wall). Drawn tile by tile in the room's own
 * coordinates: wall blocks, corridor floor, the dungeon slice's office door on every `R`, and a doorway where the
 * passage meets the floor. The walls between you and the camera go down to a skirting while you are up there
 * (`facing`, `player`), like the room's own.
 */
function buildHallways(map: GameMap, hq: Hq) {
  const group = new THREE.Group();
  const WALL = "#efe4cf";
  const rows = new Map<number, { model: Model; z: number }>();
  const rowOf = (y: number) => {
    let r = rows.get(y);
    if (!r) {
      const model = new Model();
      model.userData.rigid = true;
      group.add(model);
      r = { model, z: hq.tile(0, y)[1] };
      rows.set(y, r);
    }
    return r;
  };
  const door = DUNGEON_ASSETS.find((a) => a.id === "tile:R");
  for (const t of hallwayTiles(map)) {
    const at: [number, number, number] = [t.rx + 0.5, 0, t.rz + 0.5];
    if (t.kind === "wall") {
      const row = rowOf(t.y).model;
      row.box([1, WALL_H, 1], WALL, at, 0);
      row.box([1.02, 0.1, 1.02], "#5b4a44", [at[0], WALL_H, at[2]], 0.01);
    } else if (t.kind === "door") {
      const m = door?.build();
      if (!m) continue;
      m.position.set(...at);
      // Whose office, as the 2D game writes over each door; a lock when it is shut.
      const d = world.doors.find((q) => q.x === t.x && q.y === t.y);
      if (d) namePlate(m, d.name, d.open);
      rowOf(t.y).model.add(m);
    } else {
      const floor = new Model();
      floor.box([1, 0.35, 1], "#c9a574", [at[0], -0.35, at[2]], 0);
      floor.box([0.9, 0.012, 0.04], "#b08a5c", at, 0.002);
      group.add(floor);
    }
  }
  const passage = housePassage(map);
  if (passage) {
    // The way up to the hallways: a doorway in the north wall where the passage meets the floor.
    const d = exitDoorway({ plate: "UP" });
    d.position.set(passage[0] + 0.5, 0, passage[1] + 0.5);
    group.add(d);
  }
  let me: [number, number] | null = null;
  return {
    group,
    player(at: [number, number] | null) {
      me = at;
    },
    /** `view` points from the room to the camera: rows between the player and the camera go down. */
    facing(view: THREE.Vector3) {
      const pz = me?.[1] ?? null;
      const south = view.z > 0.01;
      hq.room.cutaway([0, 1], south && pz !== null && pz < 0);
      for (const r of rows.values()) {
        const between = pz !== null && Math.abs(view.z) > 0.01 && (r.z + 0.5 - pz) * view.z > 0;
        const target = between ? 0.06 : 1;
        r.model.scale.y += (target - r.model.scale.y) * 0.25;
        r.model.visible = r.model.scale.y > 0.02;
      }
    },
  };
}

registerRoom("inn", buildSkinned);
registerRoom("upstairs", buildSkinned);
registerRoom("basement", buildSkinned);
registerRoom("dungeon", buildSkinned);
registerRoom("hq", buildHouse);
for (const shop of SHOP_IDS) registerRoom(SHOP_ROOM[shop], buildShop);
