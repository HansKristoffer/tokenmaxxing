/**
 * The Clothes shop's catalogue as shop items: every outfit, hat, face piece, held item, back item and the
 * company merch, each with a small 3D `preview()` built from the same builders the avatars wear
 * (`gear3dHead.ts`, `gear3dBody.ts`, `merch3d.ts`). Plus the fitting-room hook `tryOn`.
 */

import { onSale } from "@tokenmaxxing/core/costumes.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import { type Model, ticks } from "../kit/kit.ts";
import { Avatar, type Look } from "../people/avatar.ts";
import { type Look2D, type LookOptions, lookFrom2D, voxelHatLift } from "../people/gear3d.ts";
import { BACK_BUILDERS, HELD_BUILDERS } from "../people/gear3dBody.ts";
import { band, FACE_BUILDERS, HAT_BUILDERS } from "../people/gear3dHead.ts";
import { merchProp } from "../people/merch3d.ts";
import { VoxModel } from "../people/voxgear.ts";
import { CLOTHES, type ClothesRow, FREE_OUTFIT_NAMES, MERCH_PIECES, type Rarity } from "./data/clothes.ts";

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  level?: number;
  group?: string;
  /** A small 3D model of the item (for shelves/rails/pens and for the buy panel) */
  preview: () => Model;
}

/** What the shop knows about an item beyond the contract: rarity colour, locks, which slot. */
export interface ClothesMeta {
  slot: ClothesRow["slot"] | "merch";
  /** The value of `look[slot]` when worn (a merch piece's bit). */
  index: number;
  rarity: Rarity;
  /** Level reward (never sold) */
  level?: number;
  /** Raid loot: never sold, a boss drops it. */
  boss?: string;
  /** Free from the start (the eight plain tees). */
  free?: boolean;
}

export const metaOf = new Map<string, ClothesMeta>();

export const RARITY_HEX: Record<Rarity, string> = {
  common: "#c9ced6",
  uncommon: "#3ddc84",
  rare: "#4fa8ff",
  epic: "#c38bff",
  legendary: "#ffb347",
};
const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Can the player not simply buy it? A level reward or a boss drop. */
export const isLocked = (id: string): boolean => {
  const meta = metaOf.get(id);
  return !!meta && (meta.level !== undefined || meta.boss !== undefined);
};

/** Keeps `fn` running while `obj` is in a scene; stops once it has left (or never arrived). */
function alive(obj: Model, fn: (t: number) => void): void {
  let seen = false;
  let waited = 0;
  const tick = (t: number) => {
    let top: Model["parent"] = obj;
    while (top?.parent) top = top.parent;
    const inScene = !!top && (top as { isScene?: boolean }).isScene === true;
    if (inScene) {
      seen = true;
      fn(t);
      return;
    }

    // Gives up on an object that never reaches the scene: 900 ticks of waiting, then it is dropped.
    if (seen || ++waited > 900) {
      const at = ticks.indexOf(tick);
      if (at >= 0) ticks.splice(at, 1);
    }
  };
  ticks.push(tick);
}

const MANNEQUIN = { skin: "#d9c4a0", hair: "#b79a6c" };
const HEAD_Y = 0.37;

/** A pale display head on a post, `0.5` across, its centre at `HEAD_Y`. */
function bust(m: Model): Model {
  m.cyl(0.16, 0.03, "#3a3040", [0, 0, 0], 0.16, 12);
  m.cyl(0.035, 0.14, "#6b5a7a", [0, 0.02, 0], 0.035, 8);
  m.ball(0.25, MANNEQUIN.skin, [0, HEAD_Y, 0], [1, 1.04, 1], 16);
  return m.part([0, HEAD_Y, 0]);
}

/** The colours and the ticker the avatar builders expect, for a display head or a mannequin. */
const previewContext = (m: Model) => ({
  skin: MANNEQUIN.skin,
  hair: MANNEQUIN.hair,
  outfit: ["#8aa0c8", "#6b82ad"] as [string, string],
  pants: "#3d4a6b",
  tick: (fn: (t: number) => void) => alive(m, fn),
});

/** The three hats the avatar draws itself, redrawn for a display head. */
const OWN_HATS: Record<string, (h: Model) => void> = {
  Beanie: (h) => {
    h.ball(0.27, "#d8553f", [0, 0.06, 0], [1, 0.85, 1], 16);
    h.cyl(0.275, 0.07, "#a8402f", [0, -0.01, 0], 0.275, 16);
    h.ball(0.05, "#f4efe4", [0, 0.28, 0]);
  },
  Headphones: (h) => {
    for (let step = 0; step <= 8; step++) {
      const angle = (step / 8) * Math.PI;
      h.box(
        [0.045, 0.045, 0.06],
        "#2b2f3a",
        [Math.cos(angle) * 0.27, Math.sin(angle) * 0.27 - 0.02, 0],
        0.01,
      );
    }

    for (const side of [-1, 1]) {
      const cup = h.cyl(0.095, 0.07, "#e0584f", [side * 0.27, -0.12, 0], 0.095, 14);
      cup.rotation.z = Math.PI / 2;
    }
  },
  Crown: (h) => {
    band(h, "#f5c842", 0.2, 0.1, 0.2);
    for (let point = 0; point < 5; point++) {
      const angle = (point / 5) * Math.PI * 2;
      h.cyl(0.04, 0.1, "#f5c842", [Math.cos(angle) * 0.19, 0.3, Math.sin(angle) * 0.19], 0, 4);
      h.ball(0.022, point % 2 ? "#e0584f" : "#4fa8ff", [Math.cos(angle) * 0.19, 0.4, Math.sin(angle) * 0.19]);
    }
  },
};

export function hatPreview(name: string): Model {
  const m = new VoxModel();
  const head = bust(m);
  // Match the worn voxel hat's position relative to the top of the head. The mannequin head is larger than an
  // avatar head and the builder frame here is unscaled. The constants are the voxel head fit in `headFit`
  // (gear3d.ts): 0.1575 plus 0.025, the top at 0.36 and a scale of 0.63.
  const lift = voxelHatLift(name);
  // Santa's low band needs a little more room on the solid display head.
  const santaRoom = name === "Santa hat" ? 0.025 : 0;
  const previewLift = lift ? Math.max(0, 0.239 + (0.1825 + lift - 0.36) / 0.63) + santaRoom : 0;
  const hat = head.part([0, previewLift, 0]);
  hat.name = "hat-preview-gear";
  (OWN_HATS[name] ?? HAT_BUILDERS[name])?.(hat, previewContext(m));
  return m;
}

function facePreview(name: string): Model {
  const m = new VoxModel();
  const head = bust(m);
  FACE_BUILDERS[name]?.(head.part(), previewContext(m));
  return m;
}

function heldPreview(name: string): Model {
  const m = new VoxModel();
  m.cyl(0.14, 0.04, "#3a3040", [0, 0, 0], 0.14, 12);
  const h = m.part([0, 0.1, 0]);
  h.scale.setScalar(2.6);
  HELD_BUILDERS[name]?.(h, (fn) => alive(m, fn));
  return m;
}

/** A torso seen from behind with the item on its back (the builders draw on the back face, `z = -0.1`). */
function backPreview(name: string): Model {
  const m = new VoxModel();
  const turn = m.part([0, 0, 0], Math.PI);
  turn.cyl(0.16, 0.03, "#3a3040", [0, 0, 0], 0.16, 12);
  turn.cyl(0.035, 0.3, "#6b5a7a", [0, 0.02, 0], 0.035, 8);
  const frame = turn.part([0, 0.1, 0]);
  frame.scale.set(1.05, 1.2, 0.9);
  frame.box([0.3, 0.26, 0.2], MANNEQUIN.skin, [0, 0.22, 0], 0.03);
  BACK_BUILDERS[name]?.(frame.part([0, 0.37, -0.1]), (fn) => alive(m, (t) => fn(t, false)));
  return m;
}

/** A mannequin: a voxel person in the shop's wood colours, dressed by `lookFrom2D`, in a neutral stance. */
export function mannequin(look: Look2D, opts?: LookOptions): Avatar {
  const fullLook = lookFrom2D(look, opts);
  fullLook.skin = MANNEQUIN.skin;
  fullLook.hair = MANNEQUIN.hair;

  const avatar = new Avatar(fullLook, "voxel");
  if (avatar.look.gear?.animated) {
    alive(avatar.root, (t) => avatar.look.gear?.update?.(avatar, 0, t));
    return avatar;
  }

  // Static mannequins are posed once on their podiums and never animate: bake them into the room.
  delete avatar.root.userData.live;
  delete avatar.root.userData.bake;
  delete avatar.root.userData.actor;
  delete avatar.root.userData.sample;
  avatar.root.traverse((node) => {
    delete node.userData.rigid;
    const mesh = node as { isMesh?: boolean; material?: { userData?: { dynamic?: boolean } } | unknown[] };
    if (mesh.isMesh && mesh.material && !Array.isArray(mesh.material) && mesh.material.userData?.dynamic) {
      delete mesh.material.userData.dynamic;
    }
  });
  return avatar;
}

const BASE: Look2D = { style: 0, skin: 0, hair: 1, outfit: 1 };

function outfitPreview(index: number, back?: number): Model {
  return mannequin({ ...BASE, outfit: index, ...(back ? { back } : {}) }).root;
}

export const MERCH_COMPANIES = [
  { id: 1, name: "Token Co", brand: { roof: "#3a6fb8", plaque: "#f5d14a" } },
  { id: 2, name: "Ruby Labs", brand: { roof: "#c4544b", plaque: "#fbf7ef" } },
  { id: 3, name: "Fern AI", brand: { roof: "#3f8c50", plaque: "#f4efe4" } },
  { id: 4, name: "Nordlys", brand: { roof: "#5b3fbf", plaque: "#3ddc84" } },
] as const;

const GROUP: Record<string, string> = {
  outfit: "Outfits",
  hat: "Hats",
  glasses: "Face",
  held: "Held",
  back: "Back",
  merch: "Merch",
};

function previewOf(r: ClothesRow): () => Model {
  switch (r.slot) {
    case "outfit":
      return () => outfitPreview(r.index);
    case "hat":
      return () => hatPreview(r.name);
    case "glasses":
      return () => facePreview(r.name);
    case "held":
      return () => heldPreview(r.name);
    case "back":
      return () => backPreview(r.name);
  }
}

function fromRow(row: ClothesRow): ShopItem {
  metaOf.set(row.id, {
    slot: row.slot,
    index: row.index,
    rarity: row.rarity,
    level: row.level,
    boss: row.boss,
  });
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    ...(row.level !== undefined && { level: row.level }),
    group: row.boss ? `${GROUP[row.slot]} · ${row.boss} drop` : GROUP[row.slot],
    preview: previewOf(row),
  };
}

/** Cheapest, commonest first: a shelf reads as a climb through the rarities. */
const bySale = (a: ClothesRow, b: ClothesRow) => {
  const byRarity = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  return byRarity || a.price - b.price || a.index - b.index;
};

/** A slot's rows, the holiday costumes only in their season (the shop is built once a page). */
const slotRows = (slot: ClothesRow["slot"]) =>
  CLOTHES.filter((row) => row.slot === slot && onSale(itemById(row.id) ?? {}, Date.now()));

function freeOutfits(): ShopItem[] {
  return FREE_OUTFIT_NAMES.map((name, index) => {
    const id = `outfit.${index}`;
    metaOf.set(id, { slot: "outfit", index, rarity: "common", free: true });
    return { id, name, price: 0, group: "Outfits", preview: () => outfitPreview(index) };
  });
}

function merchItems(): ShopItem[] {
  return MERCH_PIECES.map((piece, index) => {
    // The companies take the pieces in turn: piece `index` is sold by company `index` mod the company count.
    const company = MERCH_COMPANIES[index % MERCH_COMPANIES.length]!;
    const id = `merch.${company.id}.${piece.kind}`;
    metaOf.set(id, { slot: "merch", index: piece.bit, rarity: "common" });
    return {
      id,
      name: `${company.name} ${piece.name.toLowerCase()}`,
      price: piece.price,
      group: "Merch",
      preview: () => merchProp(company, piece.kind),
    };
  });
}

/** Outfits in id order (the free tees, then the shop's), the rest by rarity then price. */
export function buildClothesItems(): {
  outfits: ShopItem[];
  hats: ShopItem[];
  faces: ShopItem[];
  held: ShopItem[];
  backs: ShopItem[];
  merch: ShopItem[];
} {
  metaOf.clear();
  const outfits = [...freeOutfits(), ...slotRows("outfit").map(fromRow)];
  return {
    outfits,
    hats: slotRows("hat").sort(bySale).map(fromRow),
    faces: slotRows("glasses").sort(bySale).map(fromRow),
    held: slotRows("held").sort(bySale).map(fromRow),
    backs: slotRows("back").sort(bySale).map(fromRow),
    merch: merchItems(),
  };
}

const SLOT_OF = /^(outfit|hat|glasses|held|back)\.(\d+)$/;
const MERCH_OF = /^merch\.(\d+)\.([a-z]+)$/;

/** The 2D look with `item` put on: the fitting-room mirror's data. Pure; the input is untouched. */
export function tryOnLook2D(item: Pick<ShopItem, "id">, look: Look2D): Look2D {
  const slot = SLOT_OF.exec(item.id);
  if (slot) return { ...look, [slot[1]!]: Number(slot[2]) } as Look2D;
  const merch = MERCH_OF.exec(item.id);
  const piece = merch && MERCH_PIECES.find((p) => p.kind === merch[2]);
  if (merch && piece) {
    const sameCompany = look.merch === Number(merch[1]);
    const wornBits = sameCompany ? (look.merchWorn ?? 0) : 0;

    // A hoodie goes over a tee: wearing one clears the other. The tee is bit 1 and the hoodie bit 2
    // (`MERCH_PIECES`).
    let merchWorn = wornBits | piece.bit;
    if (piece.kind === "hoodie") merchWorn = (wornBits & ~1) | 2;
    else if (piece.kind === "tee") merchWorn = (wornBits & ~2) | 1;

    return { ...look, merch: Number(merch[1]), merchWorn };
  }
  return { ...look };
}

/**
 * Fitting-room hook: puts `item` on a player's saved 2D look and returns the avatar `Look` for it
 * (`lookFrom2D`), ready for `new Avatar(look)` or swapping onto the mirror's reflection.
 */
export function tryOn(item: Pick<ShopItem, "id">, look: Look2D, opts?: LookOptions): Look {
  return lookFrom2D(tryOnLook2D(item, look), opts);
}
