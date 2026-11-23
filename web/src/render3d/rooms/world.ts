/**
 * The world: a graph of rooms (town, hq, office, inn, upstairs, basement, dungeon) built from the 2D tile
 * maps (`data/maps.ts`). Every tile character becomes a 3D prop through a registry: slices call
 * `registerTile(ch, asset | builder)` (or export an `Asset` with id `tile:<ch>` from a `*_ASSETS` list, see
 * `registry.ts`); characters nobody has registered yet show as a labelled coloured box, so every room is
 * walkable and legible from day one. Walking is on the tile grid with collision, and stepping on a portal
 * tile moves you to the next room (`World.travel`).
 */

import { JULE_GATE_DOOR } from "@tokenmaxxing/core/julemarked.ts";
import { SHOP_DOOR_CHAR, SHOP_IDS, SHOP_ROOM } from "@tokenmaxxing/core/shoprooms.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import {
  GameMap,
  LEGEND,
  MAPS,
  type MapId,
  plotId,
  type SeatKind,
  TOWN_SPAWN,
  townMap,
} from "../data/maps.ts";
import { disposeObject } from "../engine/dispose.ts";
import type { Asset } from "../furniture/furniture.ts";
import {
  beginTickScope,
  canvasTexture,
  dropTickScope,
  endTickScope,
  Model,
  seeded,
  type TickScope,
  tint,
} from "../kit/kit.ts";
import { invalidateBaked } from "../perf/bake.ts";
import { floorSlab } from "./room.ts";
import { SEAT_Y, whenIdle } from "./rooms.ts";
import { wallEase } from "./walls.ts";

export type { MapId, SeatKind };

/** What a builder knows about the tile (or block of tiles) it is drawing. */
export interface TileCtx {
  ch: string;
  room: MapId;
  /** Grid position of the block's top-left tile (0 = the map's first column/row). */
  x: number;
  y: number;
  /** The block's size in tiles (`opts.block`, or 1×1 when a smaller leftover is drawn). */
  w: number;
  d: number;
  /** Which edge wall the tile is in (the model is turned to face the room), if any. */
  edge: "n" | "s" | "e" | "w" | null;
  /** The name from the 2D legend. */
  name: string;
}
/** Draws a tile standing on its centre, front towards +z. Return null to draw nothing. */
export type TileBuilder = (c: TileCtx) => Model | null;
export interface TileOpts {
  /** Claim a block of equal tiles at once (a 2×2 fountain); default is the asset's footprint, or 1×1. */
  block?: [number, number];
  /** Override whether you can walk through (default: the legend's `walk`). */
  walk?: boolean;
  /** Turn the model to face the room when the tile is in an edge wall (default true). */
  face?: boolean;
  /**
   * Only in these rooms: the same character means different things in different maps (`M` is the basement's wall
   * terminal and the dungeon's).
   */
  rooms?: readonly MapId[];
}
interface TileEntry {
  build: TileBuilder;
  block: [number, number];
  walk?: boolean;
  face: boolean;
}

const tiles = new Map<string, TileEntry>();

/**
 * Registers the 3D prop for a tile character. Later calls win, so a slice overrides the framework's
 * defaults (`tiles.ts`). An `Asset` is drawn with `asset.build()` over its footprint; a squeezed leftover
 * (a sofa of three tiles) is scaled to fit.
 */
export function registerTile(ch: string, src: Asset | TileBuilder, opts: TileOpts = {}): void {
  const keys = opts.rooms?.length ? opts.rooms.map((r) => `${r}:${ch}`) : [ch];
  const set = (e: TileEntry) => {
    for (const k of keys) tiles.set(k, e);
  };
  if (typeof src === "function") {
    set({ build: src, block: opts.block ?? [1, 1], walk: opts.walk, face: opts.face ?? true });
    return;
  }
  const block = opts.block ?? [src.w, src.d];
  set({
    block,
    walk: opts.walk,
    face: opts.face ?? true,
    build: (c) => {
      const model = src.build();
      const wrap = new Model();
      wrap.add(model);
      if (c.w !== block[0] || c.d !== block[1]) wrap.scale.set(c.w / block[0], 1, c.d / block[1]);
      return wrap;
    },
  });
}

/** The entry for a character in a room: the room's own registration first, else the general one. */
const tileFor = (room: MapId, ch: string): TileEntry | undefined =>
  tiles.get(`${room}:${ch}`) ?? tiles.get(ch);

/** Registers every `tile:<ch>` asset of a slice's `*_ASSETS` list. Other assets are left to the catalogue. */
export function registerTileAssets(list: readonly Asset[], rooms?: readonly MapId[]): void {
  for (const a of list) {
    if (/^tile:[^:.]$/u.test(a.id)) registerTile(a.id.slice(5), a, { rooms });
  }
}

/**
 * A room drawn by a slice instead of tile by tile (the town, the hq, the Tavern...). The room's map still
 * says where you can walk and where the doors are; the skin only supplies the picture. `offset` is where
 * the skin's own (0, 0) sits on the map's tile grid, in tiles.
 */
export interface RoomSkin {
  group: THREE.Object3D;
  offset: [number, number];
  /** Called every frame with the view from the room to the camera (to lower walls). */
  facing?: (view: THREE.Vector3) => void;
  /** A map of its own (the town's, which has the arcade written in). */
  map?: GameMap;
  /** Whatever else the slice wants to hand the integrator (models to hook, actors...). */
  extra?: unknown;
}
const skins = new Map<MapId, () => RoomSkin>();
export function registerRoomSkin(id: MapId, build: () => RoomSkin): void {
  skins.set(id, build);
}

/** A fresh skin of room `id`: the real game builds a room every time it is entered. Null when it has none. */
export const buildRoomSkin = (id: MapId): RoomSkin | null => skins.get(id)?.() ?? null;

const WALL_H = 2.6;
const GROUND = new Set([".", ",", ":", '"', "_", "=", "q", "e", "~", "Δ", "W"]);

/** The maps, as the 3D world has them: the town with one company house, the hq with doors to its offices. */
function worldMaps(): Record<MapId, GameMap> {
  const town = townMap([plotId(2, 0)]);
  // The hq's hallway of office doors (the 2D game adds these per company, `hqMap`).
  const rows = [...MAPS.hq.rows];
  const row = rows[1]!.split("");
  row[3] = "R";
  row[7] = "R";
  rows[1] = row.join("");
  return {
    ...MAPS,
    town,
    hq: new GameMap("hq", "Company house", rows),
  };
}

/** Where a portal tile leads: the room, and the tile character to arrive beside. */
const LINKS: Record<string, [MapId, string]> = {
  "town:I": ["inn", "x"],
  "town:G": ["dungeon", "x"],
  "town:D": ["hq", "x"],
  "hq:x": ["town", "D"],
  "hq:R": ["office", "x"],
  "office:x": ["hq", "R"],
  "inn:x": ["town", "I"],
  "inn:S": ["basement", "x"],
  "inn:u": ["upstairs", "x"],
  "basement:x": ["inn", "S"],
  "upstairs:x": ["inn", "u"],
  "dungeon:x": ["town", "G"],
  [`town:${JULE_GATE_DOOR}`]: ["julemarked", "x"],
  "julemarked:x": ["town", JULE_GATE_DOOR],
  ...Object.fromEntries(
    SHOP_IDS.flatMap((id) => [
      [`town:${SHOP_DOOR_CHAR[id]}`, [SHOP_ROOM[id], "x"]],
      [`${SHOP_ROOM[id]}:x`, ["town", SHOP_DOOR_CHAR[id]]],
    ]),
  ),
};

export interface Portal {
  x: number;
  y: number;
  ch: string;
  to: MapId;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** A shortest 8-way walk (no cutting corners) from one tile to the nearest tile `goal` accepts. */
function walk(
  W: number,
  D: number,
  from: [number, number],
  goal: (x: number, y: number) => boolean,
  step: (x: number, y: number) => boolean,
): [number, number][] | null {
  const key = (x: number, y: number) => y * W + x;
  const prev = new Map<number, number>([[key(...from), -1]]);
  const queue: [number, number][] = [from];
  let found = -1;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if ((x !== from[0] || y !== from[1]) && goal(x, y)) {
      found = key(x, y);
      break;
    }

    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= D || prev.has(key(nx, ny))) continue;

      // Goals may be blocked tiles (a seat, a portal); everything else must be open.
      if (!step(nx, ny) && !goal(nx, ny)) continue;
      // A diagonal step needs both tiles beside it open, so the walk never cuts a corner.
      if (dx && dy && !(step(x + dx, y) && step(x, y + dy))) continue;

      prev.set(key(nx, ny), key(x, y));
      // A goal that isn't open ends the search there; you can't walk through it.
      if (step(nx, ny)) {
        queue.push([nx, ny]);
      } else {
        found = key(nx, ny);
        queue.length = 0;
        break;
      }
    }
  }

  if (found < 0) return null;
  const out: [number, number][] = [];
  for (let k = found; k !== -1; k = prev.get(k)!) out.unshift([k % W, Math.floor(k / W)]);
  return out;
}

/** A small number from a string, for seeding the random look of a tile. */
export function hash(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** The floor tile a room with no legend of its own is painted with: grass outside, a dark floor in the dungeon. */
const GROUND_TILE: Record<string, string> = { town: ".", dungeon: "q" };
export const groundTileOf = (roomId: string): string => GROUND_TILE[roomId] ?? "_";

const GROUND_COLOURS: Record<string, [string, string]> = {
  ".": ["#6fb35a", "#66a852"],
  ",": ["#d7c49a", "#cdb98e"],
  ":": ["#ece2cc", "#dfd3b8"],
  '"': ["#6fb35a", "#66a852"],
  _: [C.floor, C.floorDark],
  "=": ["#b4524a", "#a24841"],
  Δ: ["#7a4f8f", "#6c447f"],
  q: ["#6b6f80", "#60647a"],
  e: ["#8c5c36", "#7e5230"],
  "~": ["#4aa3dd", "#5bb2e8"],
  W: ["#4a4452", "#4a4452"],
};

const labelCache = new Map<string, THREE.CanvasTexture>();
/** A small sign for a placeholder: the tile's name on its colour. */
function nameTexture(name: string, colour: string): THREE.CanvasTexture {
  const key = name + colour;
  let texture = labelCache.get(key);
  if (!texture) {
    texture = canvasTexture(
      128,
      48,
      (g) => {
        g.fillStyle = tint(colour, -0.35);
        g.fillRect(0, 0, 128, 48);
        g.fillStyle = "#fbf7ef";
        g.font = "bold 18px ui-monospace, Menlo, monospace";
        g.textAlign = "center";
        g.textBaseline = "middle";
        const words = name.split(" ");
        const lines =
          words.length > 1 && name.length > 9 ? [words.slice(0, -1).join(" "), words.at(-1)!] : [name];
        for (const [i, line] of lines.entries()) {
          g.fillText(line.slice(0, 11), 64, 24 + (i - (lines.length - 1) / 2) * 20);
        }
      },
      true,
    );
    labelCache.set(key, texture);
  }
  return texture;
}

/** The stand-in for a tile character nobody has drawn yet: a coloured box with its name on it. */
export function placeholder(ch: string): Model {
  const kind = LEGEND[ch];
  const name = kind?.name ?? ch;
  const rnd = seeded(hash(ch));
  const colour = `#${new THREE.Color().setHSL(rnd(), 0.45, 0.55).getHexString()}`;

  // Seats are low and portals tall; anything else gets a random height, so placeholders differ.
  let h: number;
  if (kind?.seat) h = 0.45;
  else if (kind?.portal) h = 1.9;
  else h = 0.8 + rnd() * 0.3;

  const model = new Model();
  model.box([0.84, h, 0.84], colour, [0, 0, 0], 0.04);
  const mat = new THREE.MeshBasicMaterial({ map: nameTexture(name, colour) });
  const front = model.plane(0.7, 0.26, mat, [0, h * 0.5, 0.43]);
  front.castShadow = false;
  const side = model.plane(0.7, 0.26, mat, [0.43, h * 0.5, 0]);
  side.rotation.y = Math.PI / 2;
  return model;
}

export class WorldRoom {
  readonly group = new THREE.Group();
  readonly W: number;
  readonly D: number;
  readonly portals: Portal[] = [];
  /** Walls that lower when the camera looks through them. */
  private readonly walls: { model: Model; normal: THREE.Vector3 }[] = [];
  private readonly wallGroups = new Map<string, Model>();
  /** The models drawn for each tile character, for hooks (a bar tab's names, a plaque's regulars). */
  readonly drawn = new Map<string, Model[]>();
  readonly skin: RoomSkin | null;

  constructor(
    readonly id: MapId,
    readonly map: GameMap,
    skin: RoomSkin | null = null,
    /** Tile-drawn rooms: leave the building to `steps()`, so a loader can spread it over several frames. */
    staged = false,
  ) {
    this.W = map.width;
    this.D = map.height;
    this.skin = skin;
    this.group.userData.bake = true;
    this.findPortals();

    if (skin) {
      skin.group.position.set(skin.offset[0], 0, skin.offset[1]);
      this.group.add(skin.group);
      return;
    }

    // Not staged: build every piece now, in one go.
    if (!staged) {
      for (const _ of this.steps());
    }
  }

  /** The tile-by-tile build in pieces (a row of tiles each): run it to the end, a little at a time. */
  *steps(): Generator<void> {
    if (this.skin) return;
    this.paintGround();
    yield;
    this.buildWalls();
    yield;
    yield* this.props();
  }

  private findPortals(): void {
    for (let y = 0; y < this.D; y++) {
      for (let x = 0; x < this.W; x++) {
        const ch = this.ch(x, y);
        const link = LINKS[`${this.id}:${ch}`];
        if (link && LEGEND[ch]?.portal) this.portals.push({ x, y, ch, to: link[0] });
      }
    }
  }

  get name(): string {
    return this.map.name;
  }

  ch(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.W || y >= this.D) return "W";
    return this.map.at(x + this.map.x0, y + this.map.y0);
  }

  /** Whether you can stand on the tile. */
  walkable(x: number, y: number): boolean {
    const ch = this.ch(x, y);
    const own = tileFor(this.id, ch)?.walk;
    return own ?? LEGEND[ch]?.walk === true;
  }

  portalAt(x: number, y: number): Portal | null {
    return this.portals.find((p) => p.x === x && p.y === y) ?? null;
  }

  seatAt(x: number, y: number): { kind: SeatKind; y: number } | null {
    const kind = LEGEND[this.ch(x, y)]?.seat;
    return kind ? { kind, y: SEAT_Y[kind] } : null;
  }

  textAt(x: number, y: number): string | null {
    return LEGEND[this.ch(x, y)]?.text ?? null;
  }

  /** The centre of a tile in world space. */
  centre(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(x + 0.5, 0, y + 0.5);
  }

  /** The tiles to walk to reach (`x`, `y`), or to stand next to it when it can't be stood on. */
  route(from: [number, number], x: number, y: number): [number, number][] | null {
    const standsOn = this.walkable(x, y) || this.portalAt(x, y) || this.seatAt(x, y);
    if (standsOn) {
      if (from[0] === x && from[1] === y) return [];
      return (
        walk(
          this.W,
          this.D,
          from,
          (gx, gy) => gx === x && gy === y,
          (gx, gy) => this.walkable(gx, gy),
        )?.slice(1) ?? null
      );
    }

    // A prop: go and stand beside it.
    return (
      walk(
        this.W,
        this.D,
        from,
        (gx, gy) => this.walkable(gx, gy) && Math.abs(gx - x) <= 1 && Math.abs(gy - y) <= 1,
        (gx, gy) => this.walkable(gx, gy),
      )?.slice(1) ?? null
    );
  }

  /** A walkable tile beside (`x`, `y`) to arrive on, and the way to face to look away from it. */
  beside(x: number, y: number): { at: [number, number]; turn: number } {
    for (const [dx, dy] of DIRS.slice(0, 4)) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.walkable(nx, ny)) return { at: [nx, ny], turn: Math.atan2(dx, dy) };
    }
    return { at: [x, y], turn: 0 };
  }

  /** Where you start in the room by default. */
  spawn(): { at: [number, number]; turn: number } {
    if (this.id === "town") {
      return { at: [TOWN_SPAWN[0] - this.map.x0, TOWN_SPAWN[1] - this.map.y0], turn: 0 };
    }
    const exit = this.portals[0];
    return exit ? this.beside(exit.x, exit.y) : { at: [1, 1], turn: 0 };
  }

  /** Lowers the walls between the camera and the room; `view` points from the room to the camera. */
  facing(view: THREE.Vector3): void {
    this.skin?.facing?.(view);
    for (const w of this.walls) {
      const front = w.normal.lengthSq() > 0 && w.normal.dot(view) < -0.01;
      const target = front ? 0.06 : 1;
      w.model.scale.y += (target - w.model.scale.y) * wallEase.k;
      w.model.visible = w.model.scale.y > 0.02;
    }
  }

  private paintGround(): void {
    const { W, D } = this;
    const px = 8;
    const rnd = seeded(hash(this.id));
    const base = groundTileOf(this.id);

    const tex = canvasTexture(W * px, D * px, (g) => {
      for (let y = 0; y < D; y++) {
        for (let x = 0; x < W; x++) {
          const ch = this.ch(x, y);
          const [oddTile, evenTile] = GROUND_COLOURS[ch] ?? GROUND_COLOURS[base]!;
          g.fillStyle = (x + y) % 2 ? oddTile : evenTile;
          g.fillRect(x * px, y * px, px, px);
          if (ch === "_" || ch === "e") {
            // Plank seams.
            g.fillStyle = C.floorLine;
            g.globalAlpha = 0.45;
            g.fillRect(x * px, y * px + 3, px, 1);
            const seamX = x * px + ((x * 3 + y) % 2 ? 2 : 5);
            g.fillRect(seamX, y * px + 4, 1, 4);
            g.globalAlpha = 1;
          } else if (ch === "." || ch === '"') {
            g.fillStyle = "#86c76d";
            for (let i = 0; i < 3; i++) {
              g.fillRect(x * px + Math.floor(rnd() * 7), y * px + Math.floor(rnd() * 7), 1, 1);
            }
            if (ch === '"') {
              for (const col of ["#f28bb2", "#f0b53c", "#fbf7ef"]) {
                g.fillStyle = col;
                g.fillRect(x * px + Math.floor(rnd() * 6), y * px + Math.floor(rnd() * 6), 2, 2);
              }
            }
          } else if (ch === "~") {
            g.fillStyle = "#8fd3f5";
            g.fillRect(x * px + 1 + ((x + y) % 3), y * px + 3, 3, 1);
          } else if (ch === "=" || ch === "Δ") {
            g.fillStyle = "#f0d9a0";
            g.fillRect(x * px, y * px, px, 1);
            g.fillRect(x * px, y * px + px - 1, px, 1);
          } else if (ch === "q") {
            g.fillStyle = "#555a6e";
            g.fillRect(x * px + Math.floor(rnd() * 6), y * px + Math.floor(rnd() * 6), 2, 1);
          } else if (ch === ",") {
            g.fillStyle = "#c2ae82";
            g.fillRect(x * px + Math.floor(rnd() * 6), y * px + Math.floor(rnd() * 6), 1, 1);
          }
        }
      }
    });
    this.group.add(floorSlab(W, D, tex, tint(base === "." ? "#6fb35a" : C.floor, -0.4)));
  }

  private edgeOf(x: number, y: number): TileCtx["edge"] {
    if (this.id === "town") return null;
    if (y <= 1) return "n";
    if (y === this.D - 1) return "s";
    if (x === 0) return "w";
    if (x === this.W - 1) return "e";
    return null;
  }

  private buildWalls(): void {
    const sides = {
      n: new THREE.Vector3(0, 0, 1),
      s: new THREE.Vector3(0, 0, -1),
      w: new THREE.Vector3(1, 0, 0),
      e: new THREE.Vector3(-1, 0, 0),
      none: new THREE.Vector3(),
    };

    // One group per edge, so the walls of an edge lower together when the camera looks through them.
    const groups = this.wallGroups;
    for (const [k, normal] of Object.entries(sides)) {
      const sideGroup = new Model();
      this.group.add(sideGroup);
      groups.set(k, sideGroup);
      sideGroup.userData.rigid = true;
      this.walls.push({ model: sideGroup, normal });
    }

    // The dungeon's walls are stone (`STONE` in dungeon3d.ts), not the rooms' plaster.
    const stone = this.id === "dungeon";
    const wall = stone ? "#3a3446" : C.wall;
    const top = stone ? "#1c1924" : C.wallTop;
    const base = stone ? "#2a2533" : C.woodDark;
    for (let y = 0; y < this.D; y++) {
      for (let x = 0; x < this.W; x++) {
        if (this.ch(x, y) !== "W") continue;

        const group = groups.get(this.edgeOf(x, y) ?? "none")!;
        // The two top rows are the plaster colour; the walls further down the room are a shade darker.
        const tx = x + 0.5;
        const tz = y + 0.5;
        const face = group.box([1, WALL_H, 1], y <= 1 ? wall : tint(wall, -0.03), [tx, 0, tz], 0);
        face.castShadow = true;
        group.box([1.02, 0.1, 1.02], top, [tx, WALL_H, tz], 0.01);
        group.box([1.01, 0.12, 1.01], base, [tx, 0, tz], 0.01);
      }
    }
  }

  private *props(): Generator<void> {
    const { W, D } = this;
    const claimed = new Uint8Array(W * D);
    for (let y = 0; y < D; y++) {
      yield;
      for (let x = 0; x < W; x++) {
        if (claimed[y * W + x]) continue;

        const ch = this.ch(x, y);
        const entry = tileFor(this.id, ch);
        const kind = LEGEND[ch];
        // Ground is painted into the floor, and a character the legend does not name draws nothing.
        if (!entry && (GROUND.has(ch) || !kind)) continue;

        // A block of equal tiles is one piece only when all of it fits, unclaimed; otherwise the tile stands alone.
        const [bw, bd] = entry?.block ?? [1, 1];
        let w = 1;
        let d = 1;
        if (bw > 1 || bd > 1) {
          let fits = x + bw <= W && y + bd <= D;
          for (let j = 0; fits && j < bd; j++) {
            for (let i = 0; fits && i < bw; i++) {
              if (this.ch(x + i, y + j) !== ch || claimed[(y + j) * W + x + i]) fits = false;
            }
          }
          if (fits) {
            w = bw;
            d = bd;
          }
        }
        for (let j = 0; j < d; j++) {
          for (let i = 0; i < w; i++) claimed[(y + j) * W + x + i] = 1;
        }

        const edge = this.edgeOf(x, y);
        const ctx: TileCtx = { ch, room: this.id, x, y, w, d, edge, name: kind?.name ?? ch };
        const model = entry ? entry.build(ctx) : placeholder(ch);
        if (!model) continue;

        model.position.set(x + w / 2, 0, y + d / 2);
        if (edge && (entry?.face ?? true)) {
          model.rotation.y = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }[edge];
        }

        // Things in an edge wall lower with it when the camera looks through. A door or stairs stays up, so the
        // way out is seen through the skirting the wall becomes.
        const lowersWithWall = edge && !kind?.portal;
        const parent = lowersWithWall ? this.wallGroups.get(edge)! : this.group;
        parent.add(model);
        this.drawn.set(ch, [...(this.drawn.get(ch) ?? []), model]);
      }
    }
  }
}

/**
 * How a room gets its code: world-rooms.ts registers a loader per hand-built room (a dynamic import of its builder
 * and a `registerRoomSkin`), so a room's code is only fetched when someone is about to walk in. Rooms without a
 * loader are drawn from the tile map alone and need nothing.
 */
const loaders = new Map<MapId, () => Promise<void>>();
const loading = new Map<MapId, Promise<void>>();
const loaded = new Set<MapId>();
export function registerRoomLoader(id: MapId, load: () => Promise<void>): void {
  loaders.set(id, load);
}
/** Loads the code for `id` (once). */
export function loadRoomCode(id: MapId): Promise<void> {
  const load = loaders.get(id);
  if (!load || loaded.has(id)) return Promise.resolve();

  let inFlight = loading.get(id);
  if (!inFlight) {
    inFlight = load().then(() => void loaded.add(id));
    loading.set(id, inFlight);
  }
  return inFlight;
}
const roomCodeReady = (id: MapId): boolean => !loaders.has(id) || loaded.has(id);

/**
 * A frame boundary: lets the browser paint (the loading veil) between pieces of work. The 48 ms timer is the fallback
 * for a tab where animation frames do not run, such as a hidden one.
 */
const nextFrame = (): Promise<void> =>
  new Promise((done) => {
    const timer = setTimeout(done, 48);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        clearTimeout(timer);
        done();
      });
    }
  });

export class World {
  readonly maps: Record<MapId, GameMap> = worldMaps();
  private readonly built = new Map<MapId, WorldRoom>();
  private readonly scopes = new Map<MapId, TickScope>();
  /** Use order, least recent first: what `evict` drops when more than `maxBuilt` rooms are kept. */
  private readonly used: MapId[] = [];
  private readonly pending = new Map<MapId, Promise<WorldRoom>>();
  /** Rooms that stay built whatever the cache says (the town, the room someone stands in). */
  readonly pinned = new Set<MapId>(["town"]);
  /** How many built rooms are kept; the least recently used go first. */
  maxBuilt = 8;
  /** The portal you last came through into each room, so the way back leads to the same door. */
  private readonly back = new Map<MapId, { room: MapId; x: number; y: number; ch: string }>();

  private touch(id: MapId): void {
    const i = this.used.indexOf(id);
    if (i >= 0) this.used.splice(i, 1);
    this.used.push(id);
  }

  isBuilt(id: MapId): boolean {
    return this.built.has(id);
  }

  /**
   * A built room at once. Hand-built rooms need their code first (`load`). Asking before that is a mistake, not a
   * blank room.
   */
  room(id: MapId): WorldRoom {
    let room = this.built.get(id);
    if (!room) {
      if (!roomCodeReady(id)) throw new Error(`room ${id} is not loaded: await world.load("${id}") first`);
      const scope = beginTickScope();
      const skin = skins.get(id)?.() ?? null;
      if (skin?.map) this.maps[id] = skin.map;
      room = new WorldRoom(id, this.maps[id], skin);
      endTickScope(scope, room.group);
      this.built.set(id, room);
      this.scopes.set(id, scope);
    }
    this.touch(id);
    return room;
  }

  /**
   * Fetches the room's code and builds it a little at a time (a frame boundary between the steps, so a loading veil
   * can paint and the game keeps running). Several calls for one room share one build. Resolves with the room.
   */
  load(id: MapId, onStep?: (done: number) => void): Promise<WorldRoom> {
    const have = this.built.get(id);
    if (have) {
      this.touch(id);
      return Promise.resolve(have);
    }

    let inFlight = this.pending.get(id);
    if (!inFlight) {
      inFlight = this.build(id, onStep).finally(() => this.pending.delete(id));
      this.pending.set(id, inFlight);
    }
    return inFlight;
  }

  private async build(id: MapId, onStep?: (done: number) => void): Promise<WorldRoom> {
    await loadRoomCode(id);
    await nextFrame();
    if (this.built.has(id)) return this.built.get(id)!;

    const skin = skins.get(id);
    if (skin) {
      // A hand-built room is one call; the frame boundary before and after is all the chunking it allows.
      const room = this.room(id);
      await nextFrame();
      this.trim();
      return room;
    }

    const scope = beginTickScope();
    const room = new WorldRoom(id, this.maps[id], null, true);
    // Ticks of props registered in each step belong to the room. The scope stays open between steps only within one
    // synchronous slice.
    endTickScope(scope, room.group);

    const steps = room.steps();
    let stepsDone = 0;
    for (;;) {
      const frameStart = performance.now();
      const open = beginTickScope();
      let end = false;

      // Six milliseconds of building per frame leaves the rest of a 60 fps frame to the game.
      while (performance.now() - frameStart < 6) {
        const step = steps.next();
        if (step.done) {
          end = true;
          break;
        }
        stepsDone++;
      }

      endTickScope(open, room.group);
      scope.fns.push(...open.fns);
      onStep?.(stepsDone);
      if (end) break;
      await nextFrame();
    }

    this.built.set(id, room);
    this.scopes.set(id, scope);
    this.touch(id);
    this.trim();
    return room;
  }

  /** Builds the room in the background when the browser is idle: the next door someone is likely to take. */
  preload(id: MapId): void {
    if (this.built.has(id) || this.pending.has(id)) return;

    // A failed preload is not an error: the room is built again when the player walks in.
    whenIdle(() => void this.load(id).catch(() => {}));
  }

  /** The rooms a portal of `id` leads to. */
  neighbours(id: MapId): MapId[] {
    const out = new Set<MapId>();
    for (const [k, v] of Object.entries(LINKS)) {
      if (k.startsWith(`${id}:`)) out.add(v[0]);
    }
    return [...out];
  }

  /** Drops the least recently used rooms beyond `maxBuilt` (never a pinned one). */
  trim(): void {
    while (this.built.size > this.maxBuilt) {
      const victim = this.used.find((id) => this.built.has(id) && !this.pinned.has(id));
      if (!victim) return;
      this.evict(victim);
    }
  }

  /** Forgets a built room: its ticks stop, its batches and GPU copies are freed. The next `room` or `load` builds it afresh. */
  evict(id: MapId): boolean {
    const r = this.built.get(id);
    if (!r) return false;
    const scope = this.scopes.get(id);
    if (scope) dropTickScope(scope);
    this.scopes.delete(id);
    invalidateBaked(r.group);
    r.group.removeFromParent();
    // Frees what the room held on the GPU. The shared kit geometry and materials upload again if another room uses them.
    disposeObject(r.group);
    this.built.delete(id);
    this.used.splice(this.used.indexOf(id), 1);
    return true;
  }

  /** `travel`, loading the far room first. */
  async travelTo(
    from: WorldRoom,
    portal: Portal,
  ): Promise<{ room: WorldRoom; at: [number, number]; turn: number }> {
    await this.load(LINKS[`${from.id}:${portal.ch}`]![0]);
    return this.travel(from, portal);
  }

  /** Where taking `portal` of `from` puts you. */
  travel(from: WorldRoom, portal: Portal): { room: WorldRoom; at: [number, number]; turn: number } {
    const link = LINKS[`${from.id}:${portal.ch}`]!;
    const room = this.room(link[0]);
    const memory = this.back.get(from.id);

    // The way back leads to the door you came in by, when there is a choice.
    const matching = room.map
      .find(link[1])
      .map(([x, y]) => [x - room.map.x0, y - room.map.y0] as [number, number]);
    let door = matching[0] ?? [1, 1];
    if (memory && memory.room === room.id && memory.ch === link[1]) door = [memory.x, memory.y];

    this.back.set(room.id, { room: from.id, x: portal.x, y: portal.y, ch: portal.ch });
    const beside = room.beside(door[0], door[1]);
    return { room, at: beside.at, turn: beside.turn };
  }
}
