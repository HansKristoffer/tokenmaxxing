/**
 * Møbelhuset, the furniture showroom: every piece the 2D furniture shop sells, standing in a walk-in store.
 * Staged room-sets (a lounge corner, a home office, a kitchenette, a bedroom nook, a games corner), a row
 * of desk setups, a poster wall, a wall of wallpaper samples and a board of floor samples, and a shelf bank
 * of small things, each piece with a price placard. Freja the shopkeeper minds the counter.
 *
 * `SHOP_FURNITURE` follows the shop contract (`ShopSpec`, the shape every store implements). `displays[].at` are
 * world-grid tiles: the room's own tile plus `INSET` (the two wall rows on top and one column on the left, as for
 * every hand-built room), and so are `counter` (the tile a customer stands on to talk to the shopkeeper) and `door`.
 */
import { SUPPLIES_DESK } from "@tokenmaxxing/core/shoprooms.ts";
import * as THREE from "three";
import { FLOORS, WALLPAPERS } from "../furniture/decor3d.ts";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import { DESK_TIER_ASSETS, extraAssetById } from "../furniture/furniture3d.ts";
import { glow, Model, painted, ticks } from "../kit/kit.ts";
import type { Avatar } from "../people/avatar.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { type Placed, Room, type Turn } from "../rooms/room.ts";
import {
  DESK_ROWS,
  FLOOR_ROWS,
  FURNITURE_SHOP_ROWS,
  type FurnRow,
  POSTER_ROWS,
  WALLPAPER_ROWS,
} from "./data/furniture.ts";
import {
  counter,
  furnitureStorefront,
  headerBoard,
  makeShopkeeper,
  priceTag,
  samplePanel,
  setSign,
  shelfBank,
  suppliesDesk,
  wallpaperRolls,
  wallTag,
  windowOf,
} from "./furniture-parts.ts";

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  level?: number;
  group?: string;
  /** A small 3D model of the item (for shelves/rails/pens and for the buy panel). */
  preview: () => Model;
}

export interface ShopSpec {
  id: "furniture" | "clothes" | "barber" | "pets" | "natmarked" | "market";
  name: string;
  sign: string;
  items: ShopItem[];
  /** The storefront for the town: about 5x4 tiles, a door on its south face. Built facing +z. */
  exterior: () => Model;
  footprint: { w: number; d: number };
  /** The walkable interior. */
  buildInterior: () => {
    room: Room;
    /** World-grid tiles where a click means 'browse this item'. */
    displays: {
      item: ShopItem;
      at: [number, number];
      /** Where the item stands in the room's own frame, when the shop places it (otherwise its tile). */
      world?: [number, number, number];
    }[];
    shopkeeper: Avatar;
    counter: [number, number];
    door: [number, number];
  };
  /** The same interior built in slices (a yield between pieces), for shops heavy enough to hitch a frame. */
  slices?: () => Generator<void, ReturnType<ShopSpec["buildInterior"]>, void>;
}

/** How far the room sits in the world grid: two wall rows on top, one column on the left. */
export const INSET: [number, number] = [1, 2];

const lookById = <T extends { id: string }>(list: readonly T[], id: string): T =>
  list.find((entry) => entry.id === id)!;

/** A small free-standing sample of a wallpaper: a framed board. */
function wallpaperPreview(id: string): Model {
  const look = lookById(WALLPAPERS, id);
  const m = new Model();
  m.box([1.0, 1.0, 0.08], "#3a2a1c", [0, 0, 0], 0.015);
  const texture = windowOf(look.texture(), 1.0 / look.span, 0.3, 0, 0.3);
  m.plane(0.9, 0.9, glow("#fff", texture), [0, 0.5, 0.05]);
  return m;
}

/** A small slab of a flooring, with the pattern on top. */
function floorPreview(id: string): Model {
  const look = lookById(FLOORS, id);
  const m = new Model();
  m.box([1.0, 0.12, 1.0], "#3a2a1c", [0, 0, 0], 0.015);
  const texture = windowOf(look.texture(), 0.3, 0.3, 0, 0);
  const top = m.plane(0.94, 0.94, painted(texture), [0, 0.125, 0]);
  top.rotation.x = -Math.PI / 2;
  top.userData.noBlock = true;
  return m;
}

const assetOf = (id: string): Asset | undefined => assetById.get(id) ?? extraAssetById.get(id);

function previewOf(row: FurnRow): () => Model {
  switch (row.group) {
    case "Wallpaper":
      return () => wallpaperPreview(row.asset);
    case "Floors":
      return () => floorPreview(row.asset);
    case "Desks":
      return () => DESK_TIER_ASSETS[Number(row.asset)]!.build();
    default:
      return () => (assetOf(row.asset) ?? assetById.get("plant")!).build();
  }
}

const ITEMS: ShopItem[] = FURNITURE_SHOP_ROWS.map((row) => ({
  id: row.id,
  name: row.name,
  price: row.price,
  level: row.level,
  group: row.group,
  preview: previewOf(row),
}));
const itemOf = new Map(ITEMS.map((item) => [item.id, item]));

// Desk rows use their tier index as `asset`, so their key gets a suffix to stay apart from the model ids.
const rowOf = new Map(
  FURNITURE_SHOP_ROWS.map((row) => [row.asset + (row.group === "Desks" ? ":desk" : ""), row]),
);
const rowByAsset = (asset: string): FurnRow => {
  const row = rowOf.get(asset);
  if (!row) throw new Error(`furniture shop: no catalogue row for ${asset}`);
  return row;
};

const W = 29;
const D = 18;
const WALL_H = 2.6;

/** Rugs lie flat: they take the id Room treats as walk-over-able. */
const RUGS = new Set(["rug", "rug-persian", "wool-rug"]);

/** A shop-only asset: no price and no catalogue entry, just a footprint and a model. */
const shopAsset = (id: string, name: string, w: number, d: number, build: () => Model): Asset => ({
  id,
  name,
  price: 0,
  w,
  d,
  build,
});

function buildInterior(): ReturnType<ShopSpec["buildInterior"]> {
  const room = new Room(W, D, { floor: "#d6b27a", wall: "#efe3cc", stripe: "#e0d0b2", bare: true });
  const displays: { item: ShopItem; at: [number, number]; world?: [number, number, number] }[] = [];
  /** The model each display shows, where it has one: the pointer finds the middle of it, not its tile. */
  const shown: (THREE.Object3D | undefined)[] = [];
  const seen = new Set<string>();
  const used = new Set<number>();
  const tile = (x: number, z: number) => z * W + x;
  const show = (row: FurnRow, x: number, z: number, model?: THREE.Object3D) => {
    seen.add(row.id);
    displays.push({ item: itemOf.get(row.id)!, at: [x + INSET[0], z + INSET[1]] });
    shown.push(model);
  };

  // Floor pieces, by asset id and top-left tile.
  const floorPlaced: { p: Placed; row: FurnRow }[] = [];
  const put = (id: string, x: number, z: number, turn: Turn = 0, row = rowByAsset(id)) => {
    const base = assetOf(id);
    if (!base) throw new Error(`furniture shop: no 3D asset ${id}`);

    const asset: Asset = RUGS.has(id) ? { ...base, id: "rug" } : base;
    if (!room.fits(asset, x, z, turn)) throw new Error(`furniture shop: ${id} does not fit at ${x},${z}`);
    const placed = room.place(asset, x, z, turn);
    if (RUGS.has(id)) placed.model.position.y = 0.012;

    floorPlaced.push({ p: placed, row });
    show(row, x, z, placed.model);
    return placed;
  };
  const putDesk = (tier: number, x: number, z: number) => {
    const row = DESK_ROWS[tier]!;
    const asset = DESK_TIER_ASSETS[tier]!;
    const placed = room.place(asset, x, z, 0);

    floorPlaced.push({ p: placed, row });
    show(row, x, z, placed.model);
    return placed;
  };

  // Desk setups along the north wall.
  [2, 5, 8, 11, 14].forEach((x, tier) => {
    putDesk(tier, x, 1);
  });

  // The lounge corner: a Persian rug, a Chesterfield and a table, a TV nook.
  put("rug-persian", 6, 5);
  put("sofa-chesterfield", 6, 4);
  put("coffee-table", 6, 6);
  put("lounge-chair", 9, 5, 3);
  put("beanbag", 5, 6, 1);
  put("arc-lamp", 5, 4);
  put("monstera", 3, 4);
  put("record-player", 3, 6);
  put("tv", 3, 8, 1);
  put("rug", 4, 8);
  put("sofa", 7, 8, 3);
  put("bench", 10, 7, 3);
  put("chair", 10, 8, 3);

  // The bedroom nook.
  put("bed", 3, 12);
  put("floor-lamp", 4, 12);
  put("wool-rug", 5, 13);
  put("bean-bag", 6, 12, 2);
  put("fiddle-fig", 8, 12);
  put("bookcase", 9, 12);

  // The games corner and the big pieces down the middle.
  put("ping-pong", 13, 4);
  put("arcade-cabinet", 17, 4);
  put("server-rack", 18, 4);
  put("foosball", 13, 8);
  put("gong", 16, 8);
  put("aquarium", 13, 10);
  put("trophy-case", 16, 10);
  put("touched-grass", 13, 12);
  const chandelier = put("chandelier", 16, 12);

  // The chandelier hangs from a beam, since there is no ceiling here.
  const beam = new Model();
  beam.box([2.4, 0.12, 0.3], "#8c5c36", [0, 2.6, 0], 0.02);
  for (const side of [-1, 1]) beam.box([0.1, 0.5, 0.1], "#8c5c36", [side * 1.15, 2.12, 0], 0.01);
  beam.position.set(chandelier.x + 1, 0, chandelier.z + 0.5);
  room.group.add(beam);

  // The home office, top right.
  put("desk", 19, 2);
  put("chair", 20, 3, 2);
  put("standing-desk", 22, 2);
  put("whiteboard", 25, 2);
  put("bookshelf-library", 19, 5);
  put("keyboard-case", 22, 5);
  put("shelf", 25, 5);

  // The kitchenette: a checker floor patch and a run of appliances.
  const checker = new Model();
  checker.box([9, 0.02, 3], "#e8e2d4", [0, 0, 0], 0.002);
  for (let cellX = 0; cellX < 9; cellX++) {
    for (let cellZ = 0; cellZ < 3; cellZ++) {
      if ((cellX + cellZ) % 2)
        checker.box([0.99, 0.025, 0.99], "#3b3f50", [-4 + cellX, 0.002, -1 + cellZ], 0.001);
    }
  }
  checker.position.set(23.5, 0.005, 11.5);
  room.group.add(checker);
  put("coffee", 20, 10);
  put("espresso-bar", 21, 10);
  put("water-cooler", 23, 10);
  put("mini-fridge", 24, 10);
  put("home-fridge", 25, 10);
  put("vending-machine", 26, 10);

  // The small-things shelf bank.
  const BANK_X = 19;
  const BANK_Z = 7;
  const bankIds = [
    "duck-shelf",
    "bonsai-stand",
    "plant",
    "lamp",
    "lava-lamp",
    "globe",
    "cactus",
    "bonsai",
    "rubber-duck-statue",
  ];
  const slots = bankIds.map((id) => {
    const row = rowByAsset(id);
    return { id, model: assetOf(id)!.build(), row };
  });
  const bank = shelfBank(4, slots);
  room.place(
    shopAsset("shop:bank", "Shelf bank", 4, 1, () => bank.model),
    BANK_X,
    BANK_Z,
    0,
    bank.model,
  );
  slots.forEach((slot, index) => {
    show(slot.row, BANK_X + bank.cols[index]!, BANK_Z, slot.model);
  });

  // The counter, the till and Freja.
  const CTR_X = 22;
  const CTR_Z = 14;
  room.place(
    shopAsset("shop:counter", "Counter", 6, 1, () => counter(6)),
    CTR_X,
    CTR_Z,
    0,
  );

  const rolls = wallpaperRolls();
  room.place(
    shopAsset("shop:rolls", "Wallpaper rolls", 1, 1, () => rolls),
    20,
    13,
    0,
    rolls,
  );

  // The company-supplies catalogue desk by the door: E on it opens the Company tab (`SUPPLIES_DESK` in core).
  const supplies = suppliesDesk();
  room.place(
    shopAsset("shop:supplies", "Company supplies", 2, 1, () => supplies),
    SUPPLIES_DESK[0] - INSET[0],
    SUPPLIES_DESK[1] - INSET[1],
    0,
    supplies,
  );

  const keeper = makeShopkeeper();
  keeper.avatar.root.position.set(CTR_X - 0.9, 0.02, CTR_Z + 0.55);
  keeper.avatar.root.rotation.y = 0.35;
  room.group.add(keeper.avatar.root);

  // Her idle runs with the world's clock when nobody calls `update` on her.
  let lastTick = performance.now() / 1000;
  ticks.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - lastTick));
    lastTick = t;
    keeper.avatar.update(dt, t);
  });

  // The way out.
  const DOOR_X = 10;
  const door = exitDoorway({ outside: true, wall: "#efe3cc", leaf: "#2c5f5a" });
  door.position.set(DOOR_X + 0.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);

  // Wall pieces on the north wall: posters, then the hangings.
  const measure = (m: Model): THREE.Box3 => {
    m.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(m);
  };
  const hangNorth = (m: Model, centerX: number, bottom: number) => {
    const bounds = measure(m);
    m.position.set(centerX - (bounds.min.x + bounds.max.x) / 2, bottom - bounds.min.y, 0.01);
    room.group.add(m);
    return measure(m);
  };

  let posterX = 1.0;
  for (const row of POSTER_ROWS) {
    const m = assetOf(row.asset)!.build();
    const width = measure(m).getSize(new THREE.Vector3()).x;
    const bounds = hangNorth(m, posterX + width / 2, 0.85);

    const tag = wallTag(row, Math.max(1.0, width));
    tag.position.set(posterX + width / 2, bounds.max.y + 0.06, 0.02);
    room.group.add(tag);
    show(row, Math.floor(posterX + width / 2), 0, m);
    posterX += width + 0.3;
  }

  const hangings = [
    "certificate",
    "hanging-plant",
    "wall-whiteboard",
    "wall-neon",
    "neon-sign",
    "plant-wall",
  ];
  let hangingX = 18.1;
  for (const id of hangings) {
    const row = rowByAsset(id);
    const m = assetOf(id)!.build();
    const width = measure(m).getSize(new THREE.Vector3()).x;
    const bounds = hangNorth(m, hangingX + width / 2, 1.0);

    const tag = wallTag(row, Math.max(1.0, Math.min(width, 1.5)));
    tag.position.set(hangingX + width / 2, bounds.min.y - 0.45, 0.02);
    room.group.add(tag);
    show(row, Math.floor(hangingX + width / 2), 0, m);
    hangingX += width + 0.22;
  }

  // Samples on the west wall: wallpaper in two rows of five, floors in two rows of five.
  const PANEL = { w: 1.35, h: 1.0 };
  const PITCH = 1.55;
  const west = (m: Model, centerZ: number, y: number) => {
    m.position.set(0.04, y, centerZ);
    m.rotation.y = Math.PI / 2;
    room.group.add(m);
  };
  const sampleBlock = (
    rows: readonly FurnRow[],
    z0: number,
    make: (row: FurnRow) => THREE.Texture,
    thick: number,
  ) => {
    rows.forEach((row, index) => {
      const col = index % 5;
      const rowIdx = Math.floor(index / 5);
      const centerZ = z0 + PANEL.w / 2 + col * PITCH;
      const m = samplePanel(row, make(row), PANEL, thick);
      west(m, centerZ, 0.12 + rowIdx * 1.12);
      show(row, 0, Math.min(D - 2, Math.floor(centerZ)), m);
    });
  };
  sampleBlock(
    WALLPAPER_ROWS,
    1.0,
    (row) => {
      const look = lookById(WALLPAPERS, row.asset);
      const plain = row.asset === "plain";
      return windowOf(look.texture(), PANEL.w / look.span, plain ? 0.5 : 0.7 / WALL_H, 0, plain ? 0.2 : 0.3);
    },
    0.05,
  );
  sampleBlock(
    FLOOR_ROWS,
    9.7,
    (row) => windowOf(lookById(FLOORS, row.asset).texture(), 0.45, 0.234, 0, 0.1),
    0.1,
  );
  const wallpaperHeader = headerBoard("WALLPAPER", "10 patterns · E to browse", 7.8, 0.28);
  west(wallpaperHeader, 1.0 + 3.9, 2.38);
  const floorHeader = headerBoard("FLOOR SAMPLES", "10 floors · E to browse", 7.8, 0.28);
  west(floorHeader, 9.7 + 3.9, 2.38);
  // The poster wall is labelled by its own tags, so it gets no header board.

  // Placards for the floor pieces.
  const tileOpen = (x: number, z: number) =>
    room.inside(x, z) && room.open(x, z) && !used.has(tile(x, z)) && z < D - 1;
  for (const { p, row } of floorPlaced) {
    const [fw, fd] = Room.footprint(p.asset, p.turn);
    const front = p.z + fd;

    // Candidate spots for the tag, in order of preference: centred under the piece, under each of its
    // tiles, then either side of it. The first one with open, unused tiles wins; else the centred one.
    const middle = Math.floor(p.x + fw / 2);
    const spots: { cx: number; z: number; tiles: number[] }[] = [];
    spots.push({ cx: p.x + fw / 2, z: front, tiles: fw === 1 ? [p.x] : [middle - 1, middle] });
    for (let i = 0; i < fw; i++) spots.push({ cx: p.x + i + 0.5, z: front, tiles: [p.x + i] });
    spots.push(
      { cx: p.x - 0.5, z: front, tiles: [p.x - 1] },
      { cx: p.x + fw + 0.5, z: front, tiles: [p.x + fw] },
    );

    let spot = spots.find((candidate) => candidate.tiles.every((x) => tileOpen(x, front)));
    spot ??= spots[0]!;
    for (const x of spot.tiles) used.add(tile(x, front));

    const tag = priceTag(row);
    tag.position.set(spot.cx, 0, spot.z + 0.28);
    room.group.add(tag);
  }

  // Section signs.
  const signs: [string, string, number, number][] = [
    ["MONITORS", "desk setups · laptop to battlestation", 17.3, 2.4],
    ["COMPANY SUPPLIES", "furniture · posters · house desks", 15.5, 14.7],
    ["THE LOUNGE", "sofas · rugs · TV", 11.9, 5.0],
    ["BEDROOM NOOK", "bed · lamp · books", 6.5, 15.4],
    ["GAMES & BIG PIECES", "ping-pong to gong", 15.5, 7.1],
    ["HOME OFFICE", "desks · shelves · boards", 23.6, 4.5],
    ["KITCHENETTE", "coffee · fridges · vending", 24.0, 12.2],
  ];
  for (const [title, sub, x, z] of signs) {
    const sign = setSign(title, sub);
    sign.position.set(x, 0, z);
    room.group.add(sign);
  }

  // Warm light for the night, and the shop windows.
  const lamps = new Model();
  for (const [x, z] of [
    [7, 7],
    [6, 14],
    [15, 6],
    [15, 12],
    [22, 5],
    [24, 11],
    [22, 14],
    [10, 15],
    [4, 2],
    [10, 2],
  ] as const) {
    light(lamps, [x, 2.2, z], "#ffd9a0", 4, 9);
  }
  room.group.add(lamps);

  // Every catalogue item has a display, and none is missing.
  const missing = ITEMS.filter((item) => !seen.has(item.id));
  if (missing.length) {
    throw new Error(`furniture shop: not on display: ${missing.map((item) => item.id).join(", ")}`);
  }

  room.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  displays.forEach((display, index) => {
    const model = shown[index];
    if (!model || box.setFromObject(model).isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    display.world = [center.x, center.y, center.z];
  });

  return {
    room,
    displays,
    shopkeeper: keeper.avatar,
    counter: [CTR_X + 3 + INSET[0], CTR_Z + 1 + INSET[1]],
    door: [DOOR_X + INSET[0], D - 1 + INSET[1]],
  };
}

export const SHOP_FURNITURE: ShopSpec = {
  id: "furniture",
  name: "Møbelhuset",
  sign: "MØBELHUSET",
  items: ITEMS,
  exterior: furnitureStorefront,
  footprint: { w: 5, d: 4 },
  buildInterior,
};
