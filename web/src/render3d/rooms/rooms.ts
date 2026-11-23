import type { GameMap, SeatKind } from "@tokenmaxxing/core/maps.ts";
import type { CompanyInfo, RoomId } from "@tokenmaxxing/core/world.ts";
import type * as THREE from "three";
import type { Overlay } from "../engine/overlay.ts";
import type { Bounds } from "../engine/rig.ts";
import { ticks } from "../kit/kit.ts";
import type { ShopRoom } from "../shops/catalog.ts";

/** A label fixed to a place in a room: a company's sign, the Tavern's, a door's name. */
export interface Sign {
  key: string;
  /** World position of the label's bottom centre. */
  at: [number, number, number];
  kind: "company" | "inn" | "door" | "label";
  companyId?: number;
  text?: string;
  /** The viewer's own (a door to their office): drawn as a light sign, like the 2D game's. */
  own?: boolean;
  /** A colour for a `label` (`gold`, `green`, `cyan`, a loot rarity): see overlay.ts. */
  cls?: string;
  /** Makes the label a button. */
  onClick?: () => void;
  /** Screen pixels down from `at` (negative: up), to stack labels over one place. */
  dy?: number;
}

/** What a room's `frame` hook is given once a frame: the clock, the camera and where you stand. */
export interface LiveFrame {
  /** The frame's time in ms (the animation clock) and in seconds. */
  now: number;
  t: number;
  /** Seconds since the last frame. */
  dt: number;
  camera: THREE.OrthographicCamera;
  overlay: Overlay;
  /** Where the local player is drawn (world x, z), if they are in the room. */
  me: [number, number] | null;
  /** Reduce motion. */
  calm: boolean;
  /** How lively the effects may be, 0 to 1 (the graphics tier's particle density): caps the emoji bursts. */
  density: number;
}

/** What a room needs to know to be drawn. */
export interface RoomCtx {
  map: GameMap;
  companies: readonly CompanyInfo[];
  /** The world's clock, as minutes since midnight in Copenhagen (the street's schedules). */
  minutes: () => number;
}

/**
 * One room, drawn. `buildRoom` makes one from a map id; a room agent registers a better one with
 * `registerRoom`. Everything it adds to `group` is freed by `dispose` (plus whatever the builder
 * created itself).
 */
export interface RoomView {
  readonly id: string;
  readonly group: THREE.Group;
  /** Outdoors: the sky, weather and the sun's day apply. */
  readonly outdoors: boolean;
  /** The floor, in world units, for the camera. */
  readonly bounds: Bounds;
  /** The picture height the camera starts with. */
  readonly view: number;
  /** The middle of a tile in world units (x, z), and back. Tiles are the core map's own. */
  toWorld(tx: number, ty: number): [number, number];
  toTile(x: number, z: number): [number, number];
  /** How high a seat or bed on this tile is. */
  seatY(tx: number, ty: number, kind: string): number;
  /** Which way a sitter on this tile faces (a yaw), as the seat piece is turned. Null where the room can't say. */
  seatYaw?(tx: number, ty: number): number | null;
  /** Once a frame: the clock `t` (s), `dt` (s) and the direction from the room to the camera. */
  tick(t: number, dt: number, toward: THREE.Vector3): void;
  /**
   * Once a frame, after the people are placed: the real game's events in the room (the merchant, the picnic, the tip
   * jar...).
   */
  frame?(f: LiveFrame): void;
  /**
   * Things drawn over the room that change as the game does (the street's events). Added to the scene beside the
   * room, never batched.
   */
  readonly extras?: THREE.Object3D;
  /** A toss landed in the tip jar or fountain in front of this tile (the server said so). */
  onToss?(tx: number, ty: number): void;
  /** Signs in the room, for the label layer. */
  signs(): Sign[];
  /**
   * Signs that change with the game (the raid's names, a table's banner). Asked for every frame, so return a kept
   * list.
   */
  liveSigns?(): Sign[];
  /** Bots whose bodies the room draws itself (the barkeep, a shopkeeper). The people layer leaves those bodies out. */
  readonly keepers?: ReadonlySet<number>;
  /** In a shop: its interior (the displays on its shelves), for picking what to buy. */
  readonly shop?: ShopRoom;
  /** Sets the room's own light (the basement's dim): once, when its stage is made. */
  lights?(scene: THREE.Scene, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight): void;
  /** Lamps and windows at night. */
  night?(on: boolean): void;
  /** The room stays built but is no longer shown (the kept town): take down what it put in the label layer. */
  leave?(): void;
  dispose(): void;
}

export type RoomBuilder = (id: RoomId, ctx: RoomCtx) => RoomView;

/** How high a seat of each kind is, in world units: the cushion or bench top a sitter's hips rest on. */
export const SEAT_Y: Record<SeatKind, number> = { bench: 0.31, chair: 0.33, sofa: 0.36, bed: 0.3 };

const builders = new Map<string, RoomBuilder>();
let generic: RoomBuilder | null = null;

/** Makes `build` the way room `id` is drawn. The last registration wins. */
export function registerRoom(id: string, build: RoomBuilder): void {
  builders.set(id, build);
}

/** The builder for rooms nobody has registered (it draws any core map from its legend). */
export function registerFallbackRoom(build: RoomBuilder): void {
  generic = build;
}

/** The room kind of an id: `office` for `office:7`, the id itself for a room with no instance number. */
export const kindOfRoom = (id: string): string => (id.includes(":") ? id.slice(0, id.indexOf(":")) : id);

/**
 * The view of room `id`. Rooms with no builder of their own, an office's id included (`office:7`), use the
 * generic one, so every room is at least walkable and legible.
 */
export function buildRoom(id: RoomId, ctx: RoomCtx): RoomView {
  const build = builders.get(id) ?? builders.get(kindOfRoom(id)) ?? generic;
  if (!build) throw new Error(`no room builder for ${id}`);
  return build(id, ctx);
}

/**
 * Runs `make` and takes the per-frame callbacks it registered with the kit (`ticks`) out of the global list
 * into the room's own, so they stop when the room goes.
 */
export function withTicks<T>(make: () => T): { value: T; ticks: ((t: number) => void)[] } {
  const before = ticks.length;
  const value = make();
  return { value, ticks: ticks.splice(before) };
}

type Prep = () => Promise<void>;
const preps = new Map<string, Prep>();
const prepared = new Set<string>();
const preparing = new Map<string, Promise<void>>();

/** Registers the code a room kind needs before `buildRoom` may be called for it (its hand-built module, its art). */
export function registerRoomPrep(kind: string, prep: Prep): void {
  preps.set(kind, prep);
}

/** Whether `buildRoom(id)` may be called now: rooms with nothing to fetch are always ready. */
export function roomReady(id: string): boolean {
  const kind = kindOfRoom(id);
  return !preps.has(kind) || prepared.has(kind);
}

/** Fetches what the room needs (once; calls share it). Resolves when `buildRoom` can run. */
export function prepareRoom(id: string): Promise<void> {
  const kind = kindOfRoom(id);
  const prep = preps.get(kind);
  if (!prep || prepared.has(kind)) return Promise.resolve();

  let inFlight = preparing.get(kind);
  if (!inFlight) {
    inFlight = prep()
      .then(() => void prepared.add(kind))
      .finally(() => preparing.delete(kind));
    preparing.set(kind, inFlight);
  }
  return inFlight;
}

/** Runs `run` when the browser is idle, or shortly after where it has no idle callbacks (Safari). */
export function whenIdle(run: () => void): void {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback;
  if (idle) idle(run, { timeout: 2000 });
  else setTimeout(run, 200);
}

/** Fetches a room's code when the browser is idle: the door you are most likely to take next. */
export function preloadRoom(id: string): void {
  if (roomReady(id)) return;

  // A failed prefetch is not an error: the room's code is fetched again when the player walks in.
  whenIdle(() => void prepareRoom(id).catch(() => {}));
}

/** The rooms a door of `id` leads to (kinds), for `preloadRoom`. */
const NEXT: Record<string, readonly string[]> = {
  town: [
    "inn",
    "hq",
    "dungeon",
    "shop-furniture",
    "shop-clothes",
    "shop-barber",
    "shop-pets",
    "shop-natmarked",
    "shop-market",
    "julemarked",
  ],
  julemarked: ["town"],
  inn: ["upstairs", "basement", "town"],
  upstairs: ["inn"],
  basement: ["inn", "dungeon"],
  dungeon: ["town", "basement"],
  hq: ["common", "office", "town"],
  common: ["hq"],
  office: ["hq"],
};
export const roomsNextTo = (id: string): readonly string[] => NEXT[kindOfRoom(id)] ?? [];
