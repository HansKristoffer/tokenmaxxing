/**
 * What an item in any of the four shops means to the player: how it is gated (level, boss drop, price),
 * whether they have it, and what they can do with it (place it, apply it, try it on, wear it, adopt it).
 * The buy panel (`shopPanel.ts`) shows this; `main.ts` supplies the `ShopHooks` that touch the world.
 */
import type { Asset } from "../furniture.ts";
import type { Look2D } from "../gear3d.ts";
import type { ShopBackend } from "./backend.ts";
import { metaOf, RARITY_HEX } from "./clothes-items.ts";
import { FACE_ROWS, HAIR_ROWS, SKIN_ROWS, STYLE_ROWS } from "./data/barber.ts";
import { FURNITURE_SHOP_ROWS } from "./data/furniture.ts";
import { CATALOG_PETS, SHOP_PETWEAR } from "./data/pets.ts";
import type { ShopId, ShopItem } from "./index.ts";
import { done, type Outcome } from "./purchase.ts";
import type { PetChoice } from "./wallet.ts";

export const RARITY_COLOUR: Record<string, string> = {
  ...RARITY_HEX,
};

/** What the buy panel needs of the world: showing a look for now, and the render style of its 3D preview. */
export type PanelHooks = Pick<ShopHooks, "previewLook" | "renderStyle">;

/** The demo world's side of the buy panel (the real game's is `ShopWorld`, `render3d/shops/world.ts`). */
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
  /** Another can be bought while one is held (furniture), so Buy stays next to the item's actions. */
  again: boolean;
  /** How many are held and could be put down (furniture, company pieces). */
  count: number;
  /** It is on the player right now. */
  inUse: boolean;
  /** Where the coins come from: the player's, or the company wallet's. */
  pays: "me" | "company";
}

const pretty = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const petOf = (id: string) => CATALOG_PETS.find((p) => p.id === id.split(".").slice(0, 2).join("."));

/** Company furniture and the posters are paid from the company wallet. */
const COMPANY_GROUPS = new Set(["Company", "Posters"]);
export const paysFrom = (shop: ShopId, item: ShopItem): "me" | "company" =>
  shop === "furniture" && COMPANY_GROUPS.has(item.group ?? "") ? "company" : "me";

type Described = Omit<ItemInfo, "have" | "again" | "count" | "inUse" | "pays"> & { have?: boolean };

function describe(shop: ShopId, item: ShopItem, level: number, backend: ShopBackend): Described {
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
      // The server holds no variation: holding the pet (`setLook` checks it) unlocks every look.
      const have = !!parent && backend.owns(parent.id);
      if (!have) return { group, gate: { kind: "needs", what: parent?.name ?? "the pet" }, have: false, blurb: "A look for a pet you already have." };
      return { group, gate: { kind: "free" }, blurb: "A look for your pet.", have: true };
    }
  }
  if (boss) return { group, rarity, blurb, gate: { kind: "boss", boss: pretty(boss) } };
  if (lvl !== undefined) return { group, rarity, blurb, gate: level >= lvl ? { kind: "earned", level: lvl } : { kind: "level", level: lvl } };
  if (item.price <= 0) return { group, rarity, blurb, gate: { kind: "free" } };
  return { group, rarity, blurb, gate: { kind: "price", price: item.price } };
}

export function infoOf(shop: ShopId, item: ShopItem, backend: ShopBackend): ItemInfo {
  const d = describe(shop, item, backend.level(), backend);
  const g = d.gate;
  const count = backend.count(item.id);
  const again = backend.stackable(item.id);
  const have = d.have ?? (again ? count > 0 : g.kind === "free" || g.kind === "earned" || backend.owns(item.id));
  return {
    group: d.group,
    rarity: d.rarity,
    blurb: d.blurb,
    gate: g,
    have,
    again: again && g.kind === "price",
    count,
    inUse: backend.inUse(item.id),
    pays: paysFrom(shop, item),
  };
}

export interface Action {
  label: string;
  /** Toast text when it worked and the backend had nothing to say. */
  done: string;
  run: () => Promise<Outcome>;
  primary?: boolean;
  /** Hovering or pressing and holding shows it without keeping it (try-ons). */
  preview?: () => void;
}

/** The things to do with an item the player has. */
export function actionsOf(shop: ShopId, item: ShopItem, hooks: PanelHooks, backend: ShopBackend): Action[] {
  const out: Action[] = [];
  const equip = (on = true) => () => backend.equip(shop, item, on);
  const show = (): void => hooks.previewLook(backend.preview(shop, item));
  const tryIt = async (): Promise<Outcome> => {
    show();
    return done();
  };
  if (shop === "furniture") {
    const row = FURNITURE_SHOP_ROWS.find((r) => r.id === item.id);
    if (!row) return out;
    if (row.group === "Wallpaper") {
      out.push({ label: "Put on my Office walls", primary: true, done: `${row.name} is up in your Office`, run: equip() });
    } else if (row.group === "Floors") {
      out.push({ label: "Lay it in my Office", primary: true, done: `${row.name} is down in your Office`, run: equip() });
    } else if (row.group === "Desks") {
      // The real game's desks are looks you switch between; the demo's are pieces you put down.
      out.push({ label: backend.kind === "game" ? "Use this desk" : "Place in my Office", primary: true, done: `Your ${item.name.toLowerCase()} setup is ready`, run: equip() });
    } else if (COMPANY_GROUPS.has(row.group)) {
      out.push({ label: backend.kind === "game" ? "Put out in the company house" : "Place in my Office", primary: true, done: `The ${item.name} is out`, run: equip() });
    } else {
      out.push({ label: "Place in my Office", primary: true, done: `Pick a tile in your Office for the ${item.name}`, run: equip() });
    }
  } else if (shop === "clothes") {
    out.push({ label: "Try on", preview: show, done: `Trying on ${item.name} (close the card to take it off)`, run: tryIt });
    out.push({ label: "Wear", primary: true, done: `You are wearing ${item.name}`, run: equip() });
    if (backend.kind === "game" && backend.inUse(item.id)) out.push({ label: "Take off", done: `${item.name} is off`, run: equip(false) });
  } else if (shop === "barber") {
    out.push({ label: "Try it", preview: show, done: "Have a look in the mirror", run: tryIt });
    out.push({ label: "Apply", primary: true, done: `Done: ${item.name}`, run: equip() });
  } else if (item.id.startsWith("petwear.")) {
    out.push({ label: "Put on my pet", primary: true, done: "Your pet is dressed", run: equip() });
    out.push({ label: "Take off", done: "Gear off", run: equip(false) });
  } else if (item.id.startsWith("pet.")) {
    out.push({ label: item.id.split(".").length === 3 ? "Use this look" : "Take it home", primary: true, done: "Your pet trots after you", run: equip() });
  }
  return out;
}
