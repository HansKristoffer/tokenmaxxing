/**
 * THREAD & TOKEN, the Clothes shop: a walk-in boutique with every outfit, hat, face piece, held item, back
 * item and company-merch piece from the 2D catalogues physically on display.
 *
 * - Outfits (29) on wooden mannequins on rarity-ringed podiums, three rows deep; the locked ones (level
 *   rewards, boss drops) stand under glass with a padlock.
 * - Back items (7) on mannequins turned away so the cape or wings face you.
 * - Hats (45) on display heads on the north wall, face pieces (29) on the west wall, held items (10) below them.
 * - A merch table, a fitting-room curtain, and a mirror with a try-on spot: `tryOn` (clothes-items.ts) puts an
 *   item on a player's look.
 * - Bree, the stylist, behind the till.
 *
 * Tiles are the room's own (x east, z south, from the north-west corner); the integrator adds the inset.
 */
import * as THREE from "three";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import { canvasTexture, glass, glow, Model, painted, ticks, tint } from "../kit/kit.ts";
import type { Avatar } from "../people/avatar.ts";
import { avatarFor, type Look2D } from "../people/gear3d.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { Room, type Turn } from "../rooms/room.ts";
import { clothesExterior } from "./clothes-exterior.ts";
import {
  buildClothesItems,
  isLocked,
  mannequin,
  metaOf,
  RARITY_HEX,
  type ShopItem,
} from "./clothes-items.ts";
import { bubble, CREAM, GOLD, lockFor, PINK, PLUM, priceTag, signBoard } from "./clothes-parts.ts";

export type { ShopItem } from "./clothes-items.ts";

export interface ShopSpec {
  id: "furniture" | "clothes" | "barber" | "pets";
  name: string;
  sign: string;
  items: ShopItem[];
  exterior: () => Model;
  footprint: { w: number; d: number };
  buildInterior: () => {
    room: Room;
    displays: { item: ShopItem; at: [number, number] }[];
    shopkeeper: Avatar;
    counter: [number, number];
    door: [number, number];
  };
}

/** What the interior adds beyond the contract. */
interface ClothesInterior {
  room: Room;
  displays: {
    item: ShopItem;
    at: [number, number];
    /** Room-local position of the item itself, for picking by ray. */
    world: [number, number, number];
  }[];
  shopkeeper: Avatar;
  counter: [number, number];
  door: [number, number];
  /** The fitting-room mirror: stand on `spot` (a tile) to see yourself; `mirror` is the glass's centre. */
  fitting: { spot: [number, number]; mirror: [number, number, number]; curtain: [number, number] };
  /** Per-frame work the shop does by itself (the keeper's idle, her bubble). Also run from `kit.ticks`. */
  update: (dt: number, t: number) => void;
}

const SHOPKEEPER = { name: "Bree", title: "Stylist" };

const W = 22;
const D = 15;
const FLOOR = "#c8a47c";
const WALL = "#f3e6d6";
const STRIPE = "#e8d2c0";

const wood = "#a5784f";
const woodDark = "#6e4a30";

const asset = (id: string, w: number, d: number, build: () => Model): Asset => ({
  id,
  name: id,
  price: 0,
  w,
  d,
  build,
});

/** Shrinks a preview to fit a box, keeps its feet on the ground, and centres it. */
function fitted(preview: Model, maxW: number, maxH: number, cap = 1): Model {
  const holder = new Model();
  holder.add(preview);
  holder.updateMatrixWorld(true);

  const size = new THREE.Box3().setFromObject(preview).getSize(new THREE.Vector3());
  const scale = Math.min(cap, maxW / Math.max(size.x, 0.01), maxH / Math.max(size.y, 0.01));
  preview.scale.setScalar(scale);
  holder.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(preview);
  preview.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
  return holder;
}

interface Placement {
  item: ShopItem;
  holder: THREE.Object3D;
  tile: [number, number];
}

interface ShelfOpts {
  w: number;
  tiers: number[];
  per: number;
  maxH: number;
  cap: number;
  tagH?: number;
}

/**
 * A pegboard wall with shelves, `w` tiles long and one deep (its back on `z = -0.5`). Items stand on the
 * boards in rows of `per`, a price tag on each board's lip and a padlock on what can't be bought.
 */
function shelfWall(
  items: ShopItem[],
  shelf: ShelfOpts,
): { model: Model; spots: { item: ShopItem; holder: THREE.Object3D; x: number }[] } {
  const m = new Model();
  const spots: { item: ShopItem; holder: THREE.Object3D; x: number }[] = [];
  const back = -0.5;

  m.box([shelf.w, 2.5, 0.044], "#ead7c4", [0, 0, back], 0.01);
  m.box([shelf.w + 0.1, 0.1, 0.12], woodDark, [0, 0, back + 0.03], 0.01);
  m.box([shelf.w + 0.1, 0.08, 0.12], woodDark, [0, 2.5, back + 0.03], 0.01);

  // Pegboard dots.
  const dots = canvasTexture(
    16,
    16,
    (ctx) => {
      ctx.fillStyle = "#ead7c4";
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = "#d9bfa6";
      ctx.fillRect(3, 3, 2, 2);
      ctx.fillRect(11, 11, 2, 2);
    },
    false,
  );
  dots.wrapS = THREE.RepeatWrapping;
  dots.wrapT = THREE.RepeatWrapping;
  dots.repeat.set(shelf.w * 3, 8);
  m.plane(shelf.w, 2.45, painted(dots), [0, 1.25, back + 0.036]);

  const gap = shelf.w / shelf.per;
  const tagH = shelf.tagH ?? 0.22;
  shelf.tiers.forEach((y, tierIndex) => {
    m.box([shelf.w, 0.05, 0.38], wood, [0, y - 0.05, back + 0.2], 0.01);
    m.box([shelf.w, 0.03, 0.02], GOLD, [0, y - 0.04, back + 0.4], 0.004);
    // A bracket every third slot along the board.
    for (let post = 0; post <= shelf.per; post += 3) {
      m.box([0.04, 0.12, 0.3], woodDark, [-shelf.w / 2 + post * gap, y - 0.17, back + 0.2], 0.008);
    }

    for (let slot = 0; slot < shelf.per; slot++) {
      const item = items[tierIndex * shelf.per + slot];
      if (!item) continue;

      const x = -shelf.w / 2 + (slot + 0.5) * gap;
      const rarity = RARITY_HEX[metaOf.get(item.id)?.rarity ?? "common"];
      const holder = fitted(item.preview(), gap * 0.82, shelf.maxH, shelf.cap);
      holder.position.set(x, y, back + 0.22);
      m.add(holder);
      m.cyl(gap * 0.3, 0.012, rarity, [x, y - 0.025, back + 0.22], gap * 0.3, 16);

      const tag = priceTag(item, gap - 0.06, tagH);
      tag.position.set(x, y - 0.08, back + 0.44);
      tag.rotation.x = -0.2;
      m.add(tag);

      if (isLocked(item.id)) {
        const lock = lockFor(item.id);
        lock.position.set(x + gap * 0.3, y + shelf.maxH * 0.72, back + 0.3);
        m.add(lock);
      }
      spots.push({ item, holder, x });
    }
  });
  return { model: m, spots };
}

/** A mannequin on a round podium with a rarity ring and a tag; under glass if it can't be bought. */
function podium(item: ShopItem, figure: Avatar, turn: number): Model {
  const m = new Model();
  const rarity = RARITY_HEX[metaOf.get(item.id)?.rarity ?? "common"];
  m.cyl(0.46, 0.1, "#3a3040", [0, 0, 0], 0.46, 20);
  m.cyl(0.47, 0.02, rarity, [0, 0.1, 0], 0.47, 20);
  m.cyl(0.4, 0.015, "#5b4a68", [0, 0.12, 0], 0.4, 20);

  figure.root.position.set(0, 0.135, 0);
  figure.root.rotation.y = turn;
  m.add(figure.root);

  const tag = priceTag(item, 1.15, 0.36);
  tag.position.set(0, 0, 0.62);
  tag.rotation.x = -0.55;
  m.add(tag);

  if (isLocked(item.id)) {
    m.cyl(0.52, 1.3, glass("#dff0ff", 0.22), [0, 0.12, 0], 0.52, 20);
    m.cyl(0.54, 0.04, GOLD, [0, 0.12, 0], 0.54, 20);

    const lock = lockFor(item.id);
    lock.scale.setScalar(1.8);
    lock.position.set(0, 1.62, 0);
    m.add(lock);
    ticks.push((t) => {
      if (lock.parent) lock.rotation.y = Math.sin(t * 1.4) * 0.5;
    });
  }
  return m;
}

/** Poses a mannequin by index (a gesture, never an animation) and returns the turn its podium gives it. */
function pose(figure: Avatar, index: number): number {
  // Five stances, taken in turn by index.
  const stance = index % 5;
  if (stance === 1) figure.arms[1].rotation.z = 0.55;
  if (stance === 2) figure.arms[0].rotation.z = -0.5;
  if (stance === 3) {
    figure.arms[0].rotation.x = -0.35;
    figure.arms[1].rotation.x = 0.2;
  }
  if (stance === 4) figure.legs[0].rotation.x = -0.15;
  return [0.3, -0.3, 0.12, -0.15, 0.4][stance]!;
}

function counterModel(w: number): Model {
  const m = new Model();
  m.box([w, 0.95, 0.7], woodDark, [0, 0, 0], 0.03);
  m.box([w + 0.12, 0.07, 0.86], "#f1e7d8", [0, 0.95, 0], 0.02);
  m.box([w - 0.2, 0.55, 0.02], PLUM, [0, 0.2, 0.36], 0.006);
  m.box([w - 0.2, 0.03, 0.025], GOLD, [0, 0.78, 0.37], 0.004);

  // The till.
  m.box([0.42, 0.18, 0.34], "#3a3040", [-w / 2 + 0.9, 1.02, 0], 0.02);
  const screen = m.box([0.34, 0.2, 0.04], "#a8dcf7", [-w / 2 + 0.9, 1.2, -0.08], 0.01);
  screen.rotation.x = -0.4;

  // Gift bags, a card reader, a tape measure and a pin cushion.
  for (const [x, color] of [
    [0.7, PINK],
    [1.05, GOLD],
    [1.4, "#8fb8ff"],
  ] as const) {
    m.box([0.28, 0.4, 0.14], color, [x, 1.02, -0.05], 0.02);
    m.box([0.18, 0.02, 0.01], CREAM, [x, 1.38, -0.05]);
  }
  m.box([0.14, 0.04, 0.1], "#3a3040", [-0.4, 1.02, 0.12], 0.01);
  m.cyl(0.07, 0.03, "#f5d14a", [0.1, 1.02, 0.15], 0.07, 12);
  m.ball(0.07, "#d23c3c", [-1.1, 1.08, 0.12], [1, 0.7, 1], 10);
  for (let pin = 0; pin < 6; pin++) {
    m.cyl(0.004, 0.06, "#f4efe4", [-1.1 + Math.cos(pin) * 0.03, 1.1, 0.12 + Math.sin(pin) * 0.03], 0.004, 4);
  }
  return m;
}

function table(w: number, d: number): Model {
  const m = new Model();
  m.box([w, 0.08, d], "#f1e7d8", [0, 0.72, 0], 0.02);
  m.box([w - 0.1, 0.3, d - 0.1], PLUM, [0, 0.42, 0], 0.02);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      m.cyl(0.04, 0.42, woodDark, [sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12)], 0.04, 8);
    }
  }
  return m;
}

function runner(w: number, d: number): Model {
  const m = new Model();
  m.box([w - 0.05, 0.025, d - 0.1], "#c76f8f", [0, 0, 0], 0.01);
  m.box([w - 0.2, 0.03, d - 0.28], "#d98aa6", [0, 0, 0], 0.01);
  m.box([w - 0.05, 0.032, 0.03], GOLD, [0, 0, (d - 0.1) / 2 - 0.05], 0.004);
  m.box([w - 0.05, 0.032, 0.03], GOLD, [0, 0, -(d - 0.1) / 2 + 0.05], 0.004);
  return m;
}

/** The merch table: one of each piece on a riser, a tag in front, a banner behind. */
function merchTable(items: ShopItem[], spots: { item: ShopItem; holder: THREE.Object3D }[]): Model {
  const m = table(5, 2);
  const gap = 5 / items.length;
  items.forEach((item, index) => {
    const x = -2.5 + (index + 0.5) * gap;
    m.cyl(0.38, 0.1, "#fbf4ea", [x, 0.76, -0.1], 0.38, 16);
    m.cyl(0.39, 0.02, RARITY_HEX.common, [x, 0.85, -0.1], 0.39, 16);

    const holder = fitted(item.preview(), 0.7, 0.65, 2.4);
    holder.position.set(x, 0.87, -0.1);
    m.add(holder);

    const tag = priceTag(item, 0.95, 0.3);
    tag.position.set(x, 0.8, 0.62);
    tag.rotation.x = -0.45;
    m.add(tag);
    spots.push({ item, holder });
  });

  for (const side of [-1, 1]) m.cyl(0.03, 1.1, woodDark, [side * 2.2, 0.8, -0.8], 0.03, 8);
  const banner = signBoard("COMPANY MERCH", 3.6, 0.5, {
    sub: "every company's colours · outsiders pay, the company earns",
  });
  banner.position.set(0, 1.55, -0.85);
  m.add(banner);
  return m;
}

/** A tall mirror on the north wall with a gilt frame. */
function mirrorModel(w: number, h: number): Model {
  const m = new Model();
  const tex = canvasTexture(
    32,
    64,
    (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 32, 64);
      grad.addColorStop(0, "#e6f4ff");
      grad.addColorStop(0.5, "#b9d9ee");
      grad.addColorStop(1, "#9cc2dc");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 64);

      // Two diagonal glints, each a stripe of pixels stepping right as it goes down.
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (const [x, width] of [
        [6, 3],
        [12, 1],
      ] as const) {
        for (let y = 0; y < 64; y++) ctx.fillRect(x + Math.floor(y / 4), y, width, 1);
      }
    },
    false,
  );

  m.box([w + 0.24, h + 0.24, 0.1], GOLD, [0, 0, 0], 0.03);
  m.box([w + 0.12, h + 0.12, 0.11], tint(GOLD, -0.25), [0, 0, 0], 0.02);
  m.plane(w, h, glow("#fff", tex), [0, (h + 0.12) / 2, 0.06]);
  m.ball(0.09, GOLD, [0, h + 0.28, 0.02]);
  return m;
}

/** A glowing try-on ring on the floor. */
function tryOnSpot(): Model {
  const m = new Model();
  m.cyl(0.62, 0.05, "#3a3040", [0, 0, 0], 0.62, 24);
  m.cyl(0.55, 0.06, glow(GOLD), [0, 0, 0], 0.55, 24);
  m.cyl(0.5, 0.07, "#5b4a68", [0, 0, 0], 0.5, 24);
  m.box([0.16, 0.01, 0.08], GOLD, [-0.1, 0.08, 0.1], 0.003);
  m.box([0.16, 0.01, 0.08], GOLD, [0.1, 0.08, 0.1], 0.003);
  return m;
}

/** The fitting room: a corner stall 4 wide and 3 deep, partitions, a rail and a half-drawn curtain. */
function fittingRoom(): Model {
  const m = new Model();
  const w = 4;
  const d = 3;
  const h = 2.35;

  // Floor, the west partition and the lintel; the north and east sides are the room's own walls.
  m.box([w, 0.04, d], "#6b3f6e", [0, 0, 0], 0.01);
  m.box([0.12, h, d], "#8a5a86", [-w / 2 + 0.06, 0, 0], 0.02);
  m.box([w - 0.02, 0.5, 0.12], "#8a5a86", [0, h - 0.5, d / 2 - 0.06], 0.02);
  m.box([0.1, h - 0.004, 0.108], woodDark, [w / 2 - 0.05, 0, d / 2 - 0.06], 0.01);
  m.box([0.1, h - 0.004, 0.108], woodDark, [-w / 2 + 0.12, 0, d / 2 - 0.06], 0.01);

  // A bench, hooks with clothes, a little mirror, a bag on the floor.
  m.box([1.0, 0.1, 0.4], wood, [0.9, 0.4, -d / 2 + 0.4], 0.02);
  for (const x of [0.5, 1.3]) m.box([0.07, 0.4, 0.3], woodDark, [x, 0, -d / 2 + 0.4], 0.01);
  for (const [x, color] of [
    [-1.2, "#d98aa6"],
    [-0.8, "#8fb8ff"],
    [-0.4, GOLD],
  ] as const) {
    m.box([0.34, 0.6, 0.06], color, [x, 1.1, -d / 2 + 0.1], 0.02);
    m.box([0.2, 0.04, 0.04], woodDark, [x, 1.72, -d / 2 + 0.1]);
  }
  m.box([0.35, 0.22, 0.22], PINK, [0.9, 0.5, -d / 2 + 0.4], 0.04);

  // The rail and the curtains, drawn to the sides with a gap of about a tile and a half.
  const rail = m.cyl(0.02, w, woodDark, [0, h - 0.1, d / 2 - 0.02], 0.02, 6);
  rail.rotation.z = Math.PI / 2;
  const sign = signBoard("FITTING ROOM", 1.6, 0.26);
  sign.position.set(0, h + 0.05, d / 2 - 0.02);
  m.add(sign);

  for (const side of [-1, 1]) {
    const folds = 6;
    for (let fold = 0; fold < folds; fold++) {
      const x = side * (w / 2 - 0.15 - fold * 0.2);
      if (Math.abs(x) < 0.7) break;
      const curtain = m.box(
        [0.24, h - 0.4, 0.1],
        fold % 2 ? "#e8789a" : "#c75a7e",
        [x, 0.12, d / 2 - 0.02],
        0.02,
      );
      curtain.scale.z = 1 + (fold % 2) * 0.4;
    }
    m.cyl(0.03, 0.12, GOLD, [side * 0.72, 1.0, d / 2 + 0.03], 0.03, 6);
  }

  light(m, [0, 2.0, 0.3], "#ffd9a8", 1.6, 5);
  return m;
}

const GREETINGS = [
  "Welcome to Thread & Token!",
  "Try anything on, darling.",
  "The Gold suit is you.",
  "Locked? Earn it, then wear it.",
  "Company merch is by the window.",
  "That hat? Stunning.",
];

function makeShopkeeper(): { avatar: Avatar; update: (dt: number, t: number) => void } {
  const look: Look2D = { style: 2, skin: 1, hair: 5, outfit: 28, glasses: 9 };
  const avatar = avatarFor(look, { level: 22 });

  // A pink silk scarf and a tape measure round the neck.
  const body = avatar.body;
  body.box([0.3, 0.06, 0.2], PINK, [0, 0.72, 0], 0.02);
  body.box([0.06, 0.26, 0.02], PINK, [0.06, 0.5, 0.11], 0.008);
  body.box([0.04, 0.3, 0.015], "#f5d14a", [-0.08, 0.48, 0.108], 0.004);

  const { sprite, say } = bubble(GREETINGS, `${SHOPKEEPER.name} · ${SHOPKEEPER.title}`);
  sprite.position.set(0, avatar.height + 0.12, 0);
  avatar.root.add(sprite);

  let greeting = 0;
  let nextGreetingAt = 0;
  let waveUntil = 0;
  return {
    avatar,
    update(dt, t) {
      // A new greeting every six seconds; she waves for 1.6 seconds while she speaks.
      if (t > nextGreetingAt) {
        say(GREETINGS[greeting++ % GREETINGS.length]!);
        nextGreetingAt = t + 6;
        waveUntil = t + 1.6;
      }

      avatar.pose = t < waveUntil ? "wave" : "stand";
      avatar.talking = t < waveUntil;
      avatar.update(dt, t);
    },
  };
}

function buildClothesInterior(items = buildClothesItems()): ClothesInterior {
  const room = new Room(W, D, { floor: FLOOR, wall: WALL, stripe: STRIPE, bare: true });
  const placements: Placement[] = [];
  const put = (piece: Asset, x: number, z: number, turn: Turn = 0, model?: Model) =>
    room.place(piece, x, z, turn, model);

  // Runners under the aisles between the mannequin rows.
  for (const z of [5, 7, 9]) {
    put(
      asset("rug", 20, 1, () => runner(20, 1)),
      1,
      z,
    );
  }
  put(
    asset("rug", 3, 3, () => runner(3, 3)),
    15,
    1,
  );
  put(
    asset("rug", 5, 2, () => runner(5, 2)),
    8,
    13,
  );

  // Hats along the north wall, face pieces and held items down the west.
  const hats = shelfWall(items.hats, {
    w: 13,
    tiers: [0.42, 1.2, 1.98],
    per: 15,
    maxH: 0.62,
    cap: 0.72,
    tagH: 0.2,
  });
  put(
    asset("hat-wall", 13, 1, () => hats.model),
    1,
    0,
    0,
    hats.model,
  );
  const faces = shelfWall(items.faces, {
    w: 7,
    tiers: [0.42, 1.2, 1.98],
    per: 10,
    maxH: 0.58,
    cap: 0.66,
    tagH: 0.2,
  });
  put(
    asset("face-wall", 7, 1, () => faces.model),
    0,
    1,
    1,
    faces.model,
  );
  const held = shelfWall(items.held, { w: 7, tiers: [0.6, 1.5], per: 5, maxH: 0.7, cap: 1, tagH: 0.26 });
  put(
    asset("held-wall", 7, 1, () => held.model),
    0,
    8,
    1,
    held.model,
  );

  // The hat wall starts at tile x 1 and is 13 tiles wide, so its middle is at 7.5.
  for (const spot of hats.spots) {
    placements.push({ item: spot.item, holder: spot.holder, tile: [Math.floor(1 + 6.5 + spot.x), 0] });
  }

  // The west wall runs along z; the shelf's local x maps to world z (turned a quarter).
  for (const spot of faces.spots) {
    placements.push({ item: spot.item, holder: spot.holder, tile: [0, Math.floor(1 + 3.5 - spot.x)] });
  }
  for (const spot of held.spots) {
    placements.push({ item: spot.item, holder: spot.holder, tile: [0, Math.floor(8 + 3.5 - spot.x)] });
  }

  // Outfit mannequins, ten to a row, three rows.
  items.outfits.forEach((item, index) => {
    const row = Math.floor(index / 10);
    const x = 2 + (index % 10) * 2;
    const z = 4 + row * 2;
    const meta = metaOf.get(item.id)!;

    const figure = mannequin({ style: 0, skin: 0, hair: 1, outfit: meta.index });
    const pod = podium(item, figure, pose(figure, index));
    put(
      asset(`pod:${item.id}`, 1, 1, () => pod),
      x,
      z,
      0,
      pod,
    );
    placements.push({ item, holder: figure.root, tile: [x, z] });
  });

  // Back items, their mannequins turned away so the cape faces the room. Each wears one of outfits 13 to 18.
  items.backs.forEach((item, index) => {
    const meta = metaOf.get(item.id)!;
    const x = 2 + index * 2;

    const figure = mannequin({
      style: 0,
      skin: 0,
      hair: 1,
      outfit: 13 + ((index * 3) % 6),
      back: meta.index,
    });
    const pod = podium(item, figure, Math.PI + [0.25, -0.2, 0.1, -0.3][index % 4]!);
    put(
      asset(`pod:${item.id}`, 1, 1, () => pod),
      x,
      10,
      0,
      pod,
    );
    placements.push({ item, holder: figure.root, tile: [x, 10] });
  });

  // The merch table.
  const merchSpots: { item: ShopItem; holder: THREE.Object3D }[] = [];
  const merchModel = merchTable(items.merch, merchSpots);
  put(
    asset("merch-table", 5, 2, () => merchModel),
    16,
    10,
    0,
    merchModel,
  );
  for (const [index, spot] of merchSpots.entries()) {
    const x = 16 + Math.floor((index + 0.5) * (5 / merchSpots.length));
    placements.push({ item: spot.item, holder: spot.holder, tile: [x, 10] });
  }

  // The till, with Bree behind it (north of the counter, facing the customers).
  put(
    asset("counter", 6, 1, () => counterModel(6)),
    8,
    12,
    0,
  );
  const keeper = makeShopkeeper();
  keeper.avatar.root.position.set(14.6, 0.02, 12.6);
  room.group.add(keeper.avatar.root);
  const counterSign = signBoard("THREAD & TOKEN", 1.5, 0.26);
  counterSign.position.set(12.2, 1.02, 12.25);

  // The fitting room, the mirror and the try-on spot.
  const stall = fittingRoom();
  put(
    asset("fitting-room", 4, 3, () => stall),
    18,
    0,
    0,
    stall,
  );
  const mirror = mirrorModel(2.2, 1.7);
  mirror.position.set(16.5, 0.55, 0.06);
  room.group.add(mirror);
  const spot = tryOnSpot();
  spot.position.set(16.5, 0, 1.7);
  room.group.add(spot);
  const mirrorSign = signBoard("TRY IT ON", 1.3, 0.2);
  mirrorSign.position.set(16.5, 2.55, 0.06);
  room.group.add(mirrorSign);

  // The way out, plants, lamps.
  const door = exitDoorway({ outside: true, wall: WALL, leaf: PLUM });
  door.position.set(5.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);
  for (const [x, z] of [
    [0, 0],
    [1, 14],
    [21, 14],
    [21, 9],
  ] as const) {
    put(assetById.get("plant")!, x, z);
  }

  const lamps = new Model();
  for (const [x, y, z, color, strength] of [
    [4, 2.3, 1.6, "#ffd9a8", 2.2],
    [11, 2.3, 1.6, "#ffd9a8", 2.2],
    [1.5, 2.3, 5, "#ffd9a8", 2],
    [1.5, 2.3, 11, "#ffd9a8", 2],
    [8, 2.3, 7, "#ffe6c4", 2.4],
    [15, 2.3, 7, "#ffe6c4", 2.4],
    [11, 2.0, 13, "#ffe6c4", 2],
    [18.5, 2.0, 9.4, "#ffe6c4", 1.8],
    [16.5, 2.2, 2.4, "#fff0d8", 2],
  ] as const) {
    light(lamps, [x, y, z], color, strength * 1.8, 9);
  }
  room.group.add(lamps, counterSign);

  // Positions of what's on display, in the room's own frame: the middle of each model, where the pointer finds
  // it (its holder is the foot of its stand, a shelf lower than the thing itself).
  room.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const displays = placements.map((placement) => {
    const center = box.setFromObject(placement.holder).getCenter(new THREE.Vector3());
    return {
      item: placement.item,
      at: placement.tile,
      world: [center.x, center.y, center.z] as [number, number, number],
    };
  });

  // The keeper's idle runs with the world's ticks, and only while she is in the room.
  let lastTick = performance.now() / 1000;
  const tick = (t: number) => {
    if (!keeper.avatar.root.parent) return;

    // Caps a long frame's step at 0.1 s.
    keeper.update(Math.min(0.1, t - lastTick), t);
    lastTick = t;
  };
  ticks.push(tick);

  return {
    room,
    displays,
    shopkeeper: keeper.avatar,
    counter: [11, 12],
    door: [5, D - 1],
    fitting: { spot: [16, 1], mirror: [16.5, 1.4, 0.1], curtain: [20, 3] },
    update: keeper.update,
  };
}

const catalogue = buildClothesItems();
const clothesItems: ShopItem[] = [
  ...catalogue.outfits,
  ...catalogue.hats,
  ...catalogue.faces,
  ...catalogue.held,
  ...catalogue.backs,
  ...catalogue.merch,
];

export const SHOP_CLOTHES: ShopSpec = {
  id: "clothes",
  name: "Thread & Token",
  sign: "THREAD & TOKEN",
  items: clothesItems,
  exterior: clothesExterior,
  footprint: { w: 5, d: 4 },
  buildInterior: () => buildClothesInterior(catalogue),
};
