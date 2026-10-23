import { HOME_PIECES } from "@tokenmaxxing/core/home.ts";
import { type GameMap, LEGEND } from "@tokenmaxxing/core/maps.ts";
import { COMPANY_FURNITURE, FURNITURE } from "@tokenmaxxing/core/office.ts";
import type { RoomId } from "@tokenmaxxing/core/world.ts";
import { C } from "../art/palette.ts";
import { applyDecor } from "../demo3d/decor3d.ts";
import { DUNGEON_ASSETS } from "../demo3d/dungeon3d.ts";
import { type Asset, assetById } from "../demo3d/furniture.ts";
import { beginTickScope, canvasTexture, endTickScope, Model, painted } from "../demo3d/kit.ts";
import { PETS_ASSETS } from "../demo3d/pets3d.ts";
import { type Placed, Room, type Turn } from "../demo3d/room.ts";
import { TAVERN_ASSETS } from "../demo3d/tavern3d.ts";
import { placeholder, type RoomSkin, WorldRoom } from "../demo3d/world.ts";
import { viewOf } from "./room-skin.ts";
import { type RoomCtx, type RoomView, registerRoom, withTicks } from "./rooms.ts";

/**
 * The rooms whose furniture is the players': an Office (its owner's drops) and a company's common room. The map
 * says what stands where (every dropped piece is a character on the floor, `office.ts`), so the room is a plain
 * `Room` (walls, windows, the owner's wallpaper and floor) with each piece placed from its character.
 */

/** The demo's piece for each map character that is furniture. */
const ASSET_OF = new Map<string, Asset>();
const bind = (ch: string, id: string) => {
  const a = assetById.get(id);
  if (a) ASSET_OF.set(ch, a);
};
for (const [ch, id] of Object.entries({ p: "plant", L: "lamp", c: "chair", k: "shelf", B: "bench", d: "desk", o: "coffee", b: "bed", s: "sofa", t: "tv" })) bind(ch, id);
for (const f of COMPANY_FURNITURE) bind(f.ch, f.art);
for (const h of HOME_PIECES) bind(h.ch, h.art);
for (const a of [...DUNGEON_ASSETS, ...PETS_ASSETS]) if (/^tile:[UYVQ]$/u.test(a.id)) ASSET_OF.set(a.id.slice(5), a);
const stool = TAVERN_ASSETS.find((a) => a.id === "tile:v");
if (stool) ASSET_OF.set("v", stool);

/** The demo's piece for a map character, if it has one. */
export const assetOfChar = (ch: string): Asset | undefined => ASSET_OF.get(ch);

/** Pieces that face the room's south (a chair at a desk, a sofa in front of the TV). */
const TURN: Record<string, Turn> = { c: 2, s: 2, v: 2, μ: 2, Σ: 2 };

export const turnOfChar = (ch: string): Turn => TURN[ch] ?? 0;

/** A flat tile of rug or stage floor: `rug` is the id the room treats as walkable. */
function flat(ch: string): Asset {
  const colour = ch === "e" ? "#8c5c36" : C.rug;
  return {
    id: "rug",
    name: "Rug",
    price: 0,
    w: 1,
    d: 1,
    build: () => {
      const m = new Model();
      const tex = canvasTexture(16, 16, (g) => {
        g.fillStyle = colour;
        g.fillRect(0, 0, 16, 16);
        g.fillStyle = ch === "e" ? "#9a6a40" : C.rugLight;
        g.fillRect(2, 2, 12, 12);
      });
      m.box([1, 0.025, 1], painted(tex), [0, 0, 0], 0.005);
      return m;
    },
  };
}

/** Furniture characters: what is placed from the map, with the footprint width of each. */
const WIDTH = new Map<string, number>([...FURNITURE, ...COMPANY_FURNITURE, ...HOME_PIECES].map((p): [string, number] => [p.ch, p.w ?? 1]));
const FLAT = new Set(["=", "e"]);

/** Fills `room` with what the map has on its floor. `at` maps a map tile to the room's. */
export function furnish(room: Room, map: GameMap, inset: [number, number]): Placed[] {
  const placed: Placed[] = [];
  const done = new Set<string>();
  map.rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx]!;
      const key = `${rx},${ry}`;
      if (done.has(key)) continue;
      const x = rx + map.x0 - inset[0];
      const z = ry + map.y0 - inset[1];
      if (x < 0 || z < 0 || x >= room.W || z >= room.D) continue;
      if (FLAT.has(ch)) {
        placed.push(room.place(flat(ch), x, z));
        continue;
      }
      const asset = ASSET_OF.get(ch);
      if (!asset) {
        // Things the legend names but no one has drawn: a labelled block, so the tile is not empty.
        if (LEGEND[ch]?.name && !LEGEND[ch]?.walk && !LEGEND[ch]?.portal && !"WΨΘπ".includes(ch) && ch !== "_" && WIDTH.has(ch))
          placed.push(room.place({ id: `ph:${ch}`, name: LEGEND[ch]!.name, price: 0, w: 1, d: 1, build: () => placeholder(ch) }, x, z));
        continue;
      }
      // A piece several tiles wide writes its character on each.
      const w = Math.max(1, Math.round(WIDTH.get(ch) ?? asset.w));
      for (let i = 1; i < w; i++) done.add(`${rx + i},${ry}`);
      placed.push(room.place(asset, x, z, TURN[ch] ?? 0));
    }
  });
  return placed;
}

/** The window columns of a map's top wall row (`Ψ`), as the room's `north` list (a tile's middle, inset applied). */
function windowsOf(map: GameMap, row: number, inset: number): number[] {
  const out: number[] = [];
  const r = map.rows[row - map.y0] ?? "";
  for (let x = 0; x < r.length; x++) if (r[x] === "Ψ") out.push(x + map.x0 - inset + 0.5);
  return out;
}

export interface Furnished {
  room: Room;
  placed: Placed[];
}

/** An Office or a common room, with its owner's wallpaper and floor. */
function buildFurnished(id: RoomId, ctx: RoomCtx): RoomView {
  const map = ctx.map;
  const office = id.startsWith("office");
  const inset: [number, number] = office ? [1, 1] : [1, 2];
  const W = map.width - 2;
  const D = map.height - inset[1] - 1;
  const scope = beginTickScope();
  const built = withTicks(() => {
    const room = new Room(W, D, {
      north: office ? [3, 7] : windowsOf(map, 1, inset[0]),
      door: null,
      west: [],
      ...(office ? {} : { floor: "#c9a574", wall: "#efe4cf", stripe: "#e1d3b6" }),
    });
    if (map.decor) applyDecor(room, map.decor);
    const placed = furnish(room, map, inset);
    return { room, placed } satisfies Furnished;
  });
  const { room } = built.value;
  endTickScope(scope, room.group);
  const skin: RoomSkin = { group: room.group, offset: inset, facing: (v) => room.facing(v), extra: built.value };
  const world = new WorldRoom(office ? "office" : "common", map, skin);
  return viewOf(id, map, world, built.ticks, { extra: built.value, keepers: new Set() });
}

registerRoom("office", buildFurnished);
registerRoom("common", buildFurnished);
