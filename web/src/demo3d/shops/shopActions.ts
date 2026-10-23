/**
 * What an item in any of the four shops means to the player: how it is gated (level, boss drop, price),
 * whether they have it, and what they can do with it (place it, apply it, try it on, wear it, adopt it).
 * The buy panel (`shopPanel.ts`) shows this; `main.ts` supplies the `ShopHooks` that touch the world.
 */
import type { Look as CoreLook } from "@tokenmaxxing/core/world.ts";
import type { Asset } from "../furniture.ts";
import { assetById } from "../furniture.ts";
import { DESK_TIER_ASSETS, extraAssetById } from "../furniture3d.ts";
import type { Look2D } from "../gear3d.ts";
import { restyle } from "./barber.ts";
import { tryOnLook2D } from "./clothes.ts";
import { metaOf, RARITY_HEX } from "./clothes-items.ts";
import { FACE_ROWS, HAIR_ROWS, SKIN_ROWS, STYLE_ROWS } from "./data/barber.ts";
import { FURNITURE_SHOP_ROWS } from "./data/furniture.ts";
import { CATALOG_PETS, SHOP_PETWEAR } from "./data/pets.ts";
import type { ShopId, ShopItem } from "./index.ts";
import { type PetChoice, wallet } from "./wallet.ts";

export const RARITY_COLOUR: Record<string, string> = {
  ...RARITY_HEX,
};

/** The world's side of the buy panel. */
export interface ShopHooks {
  level(): number;
  look(): Look2D;
  /** Shows `look` on the player for now (null puts the saved one back). */
  previewLook(look: Look2D | null): void;
  /** Makes `look` the player's own and saves it. */
  setLook(look: Look2D): void;
  pet(): PetChoice;
  setPet(pet: PetChoice): void;
  /** Starts placing `asset` in the Office (and takes you there). */
  placeFurniture(asset: Asset): void;
  decorOffice(d: { wall?: string; floor?: string }): void;
  /** The render style of the world, for the 3D preview. */
  renderStyle(): { style: "classic" | "voxel"; pixelSize: number; night: boolean };
}

export type Gate =
  | { kind: "free" }
  | { kind: "price"; price: number }
  | { kind: "earned"; level: number }
  | { kind: "level"; level: number }
  | { kind: "boss"; boss: string }
  | { kind: "needs"; what: string };

export interface ItemInfo {
  rarity?: string;
  blurb?: string;
  group: string;
  gate: Gate;
  /** The player can use it right now: free, earned or bought (and its prerequisites held). */
  have: boolean;
}

const pretty = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const petOf = (id: string) => CATALOG_PETS.find((p) => p.id === id.split(".").slice(0, 2).join("."));

function describe(shop: ShopId, item: ShopItem, level: number): Omit<ItemInfo, "have"> & { have?: boolean } {
  const group = item.group ?? "";
  let rarity: string | undefined;
  let blurb: string | undefined;
  let lvl = item.level;
  let boss: string | undefined;
  if (shop === "furniture") {
    const r = FURNITURE_SHOP_ROWS.find((x) => x.id === item.id);
    blurb = r?.blurb;
    lvl = r?.level;
    if (r?.earned) boss = r.earned;
  } else if (shop === "clothes") {
    const m = metaOf.get(item.id);
    rarity = m?.rarity;
    lvl = m?.level;
    boss = m?.boss;
    if (m?.free) return { group, rarity, gate: { kind: "free" } };
  } else if (shop === "barber") {
    const r = [...STYLE_ROWS, ...HAIR_ROWS, ...SKIN_ROWS, ...FACE_ROWS].find((x) => x.id === item.id);
    rarity = r?.rarity;
    blurb = r?.blurb;
    lvl = r?.level;
  } else {
    const w = SHOP_PETWEAR.find((x) => x.id === item.id);
    rarity = w?.rarity;
    blurb = w?.blurb;
    const parts = item.id.split(".");
    if (parts.length === 3) {
      const parent = petOf(item.id);
      const have = !!parent && wallet.owns(parent.id);
      if (!have) return { group, gate: { kind: "needs", what: parent?.name ?? "the pet" }, have: false, blurb: "A look for a pet you already have." };
      return { group, gate: { kind: "free" }, blurb: "A look for your pet.", have: true };
    }
  }
  if (boss) return { group, rarity, blurb, gate: { kind: "boss", boss: pretty(boss) } };
  if (lvl !== undefined) return { group, rarity, blurb, gate: level >= lvl ? { kind: "earned", level: lvl } : { kind: "level", level: lvl } };
  if (item.price <= 0) return { group, rarity, blurb, gate: { kind: "free" } };
  return { group, rarity, blurb, gate: { kind: "price", price: item.price } };
}

export function infoOf(shop: ShopId, item: ShopItem, level: number): ItemInfo {
  const d = describe(shop, item, level);
  const g = d.gate;
  const have = d.have ?? (g.kind === "free" || g.kind === "earned" || wallet.owns(item.id));
  return { group: d.group, rarity: d.rarity, blurb: d.blurb, gate: g, have };
}

export interface Action {
  label: string;
  /** Toast text after it ran. */
  run: () => string;
  primary?: boolean;
  /** Hovering or pressing and holding shows it without keeping it (try-ons). */
  preview?: () => void;
}

const assetOf = (id: string): Asset | undefined => assetById.get(id) ?? extraAssetById.get(id);

/** The things to do with an item the player has. */
export function actionsOf(shop: ShopId, item: ShopItem, hooks: ShopHooks): Action[] {
  const out: Action[] = [];
  if (shop === "furniture") {
    const row = FURNITURE_SHOP_ROWS.find((r) => r.id === item.id);
    if (!row) return out;
    if (row.group === "Wallpaper") {
      out.push({
        label: "Put on my Office walls",
        primary: true,
        run: () => {
          hooks.decorOffice({ wall: row.asset });
          wallet.decor = { ...wallet.decor, wall: row.asset };
          return `${row.name} is up in your Office`;
        },
      });
    } else if (row.group === "Floors") {
      out.push({
        label: "Lay it in my Office",
        primary: true,
        run: () => {
          hooks.decorOffice({ floor: row.asset });
          wallet.decor = { ...wallet.decor, floor: row.asset };
          return `${row.name} is down in your Office`;
        },
      });
    } else {
      const asset = row.group === "Desks" ? DESK_TIER_ASSETS[Number(row.asset)] : assetOf(row.asset);
      if (asset)
        out.push({
          label: "Place in my Office",
          primary: true,
          run: () => {
            hooks.placeFurniture(asset);
            return `Pick a tile in your Office for the ${item.name}`;
          },
        });
    }
  } else if (shop === "clothes") {
    out.push({
      label: "Try on",
      preview: () => hooks.previewLook(tryOnLook2D(item, hooks.look())),
      run: () => {
        hooks.previewLook(tryOnLook2D(item, hooks.look()));
        return `Trying on ${item.name} (close the card to take it off)`;
      },
    });
    out.push({
      label: "Wear",
      primary: true,
      run: () => {
        hooks.setLook(tryOnLook2D(item, hooks.look()));
        return `You are wearing ${item.name}`;
      },
    });
  } else if (shop === "barber") {
    const [slot, n] = item.id.split(".") as [string, string];
    const index = Number(n);
    const change = slot === "glasses" ? { face: index } : { [slot]: index };
    const apply = (): Look2D => ({ ...hooks.look(), ...pick(restyle(hooks.look() as unknown as CoreLook, change, { level: hooks.level() }) as unknown as Look2D) });
    out.push({
      label: "Try it",
      preview: () => hooks.previewLook(apply()),
      run: () => {
        hooks.previewLook(apply());
        return "Have a look in the mirror";
      },
    });
    out.push({
      label: "Apply",
      primary: true,
      run: () => {
        hooks.setLook(apply());
        return `Done: ${item.name}`;
      },
    });
  } else {
    const parts = item.id.split(".");
    if (item.id.startsWith("petwear.")) {
      const w = SHOP_PETWEAR.find((x) => x.id === item.id);
      if (w)
        out.push({
          label: "Put on my pet",
          primary: true,
          run: () => {
            hooks.setPet({ ...hooks.pet(), wear: w.index });
            return `Your pet is wearing the ${w.name.toLowerCase()}`;
          },
        });
      out.push({
        label: "Take off",
        run: () => {
          hooks.setPet({ ...hooks.pet(), wear: 0 });
          return "Gear off";
        },
      });
    } else if (parts[0] === "pet") {
      const p = petOf(item.id);
      if (p)
        out.push({
          label: parts.length === 3 ? "Use this look" : "Take it home",
          primary: true,
          run: () => {
            hooks.setPet({ species: p.species, variant: parts[2] ?? "", name: PET_NAMES[p.species] ?? p.name, wear: 0 });
            return `${PET_NAMES[p.species] ?? p.name} trots after you`;
          },
        });
    }
  }
  return out;
}

const PET_NAMES: Record<string, string> = { cat: "Miso", dog: "Waffle", duck: "Ducky", dragon: "Ember", panda: "Bao", orb: "Orb" };

const pick = (l: Look2D): Partial<Look2D> => ({ style: l.style, hair: l.hair, skin: l.skin, glasses: l.glasses });
