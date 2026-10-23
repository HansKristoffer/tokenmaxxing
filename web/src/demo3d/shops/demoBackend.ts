/**
 * The demo's `ShopBackend`: coins, ownership, the look and the pet in localStorage (`wallet.ts`), and the world
 * changed straight through the demo's `ShopHooks`. Nothing is asked of a server, so every call settles at once.
 */
import type { Look as CoreLook } from "@tokenmaxxing/core/world.ts";
import type { Asset } from "../furniture.ts";
import { assetById } from "../furniture.ts";
import { DESK_TIER_ASSETS, extraAssetById } from "../furniture3d.ts";
import type { Look2D } from "../gear3d.ts";
import type { ShopBackend } from "./backend.ts";
import { restyle } from "./barber.ts";
import { tryOnLook2D } from "./clothes.ts";
import { FURNITURE_SHOP_ROWS } from "./data/furniture.ts";
import { CATALOG_PETS, SHOP_PETWEAR } from "./data/pets.ts";
import type { ShopId, ShopItem } from "./index.ts";
import { done, fail, type Outcome } from "./purchase.ts";
import type { ShopHooks } from "./shopActions.ts";
import { wallet } from "./wallet.ts";

const PET_NAMES: Record<string, string> = { cat: "Miso", dog: "Waffle", duck: "Ducky", dragon: "Ember", panda: "Bao", orb: "Orb" };
const petOf = (id: string) => CATALOG_PETS.find((p) => p.id === id.split(".").slice(0, 2).join("."));
const assetOf = (id: string): Asset | undefined => assetById.get(id) ?? extraAssetById.get(id);
const SLOT_OF = /^(outfit|hat|glasses|held|back)\.(\d+)$/;

export function createDemoBackend(hooks: ShopHooks): ShopBackend {
  const preview = (shop: ShopId, item: ShopItem): Look2D | null => {
    if (shop === "clothes") return tryOnLook2D(item, hooks.look());
    if (shop !== "barber") return null;
    const [slot, n] = item.id.split(".") as [string, string];
    const change = slot === "glasses" ? { face: Number(n) } : { [slot]: Number(n) };
    const next = restyle(hooks.look() as unknown as CoreLook, change, { level: hooks.level() }) as unknown as Look2D;
    return { ...hooks.look(), style: next.style, hair: next.hair, skin: next.skin, glasses: next.glasses };
  };

  return {
    kind: "demo",
    coins: () => wallet.coins,
    companyCoins: () => null,
    level: () => hooks.level(),
    look: () => hooks.look(),
    owns: (id) => {
      const pet = id.split(".").length === 3 && id.startsWith("pet.") ? petOf(id) : undefined;
      return wallet.owns(pet ? pet.id : id);
    },
    count: (id) => (wallet.owns(id) ? 1 : 0),
    stackable: () => false,
    inUse(id) {
      const slot = SLOT_OF.exec(id);
      if (slot) return (hooks.look() as unknown as Record<string, number | undefined>)[slot[1]!] === Number(slot[2]);
      const w = SHOP_PETWEAR.find((x) => x.id === id);
      return w ? hooks.pet().wear === w.index : false;
    },
    async buy(_shop, item, price): Promise<Outcome> {
      if (wallet.owns(item.id)) return fail("owned", "You have that already.");
      if (!wallet.buy(item.id, price)) return fail("coins", `You need 🪙 ${price - wallet.coins} more.`);
      return done(`Bought ${item.name} for 🪙 ${price}`);
    },
    preview,
    async equip(shop, item, on = true): Promise<Outcome> {
      if (shop === "furniture") {
        const row = FURNITURE_SHOP_ROWS.find((r) => r.id === item.id);
        if (!row) return fail("unavailable", "That is not on the shelves.");
        if (row.group === "Wallpaper") {
          hooks.decorOffice({ wall: row.asset });
          wallet.decor = { ...wallet.decor, wall: row.asset };
          return done(`${row.name} is up in your Office`);
        }
        if (row.group === "Floors") {
          hooks.decorOffice({ floor: row.asset });
          wallet.decor = { ...wallet.decor, floor: row.asset };
          return done(`${row.name} is down in your Office`);
        }
        const asset = row.group === "Desks" ? DESK_TIER_ASSETS[Number(row.asset)] : assetOf(row.asset);
        if (!asset) return fail("unavailable", "That cannot be placed yet.");
        hooks.placeFurniture(asset);
        return done(`Pick a tile in your Office for the ${item.name}`);
      }
      if (!on && shop !== "pets") {
        const slot = SLOT_OF.exec(item.id);
        if (!slot) return fail("unavailable", "Nothing to take off.");
        hooks.setLook({ ...hooks.look(), [slot[1]!]: 0 });
        return done(`${item.name} is off`);
      }
      if (shop === "clothes" || shop === "barber") {
        const next = preview(shop, item);
        if (!next) return fail("unavailable", "Nothing to change.");
        hooks.setLook(next);
        return done(shop === "clothes" ? `You are wearing ${item.name}` : `Done: ${item.name}`);
      }
      const parts = item.id.split(".");
      const w = SHOP_PETWEAR.find((x) => x.id === item.id);
      if (w) {
        hooks.setPet({ ...hooks.pet(), wear: on ? w.index : 0 });
        return done(on ? `Your pet is wearing the ${w.name.toLowerCase()}` : "Gear off");
      }
      const p = petOf(item.id);
      if (!p) return fail("unavailable", "No such pet.");
      const name = PET_NAMES[p.species] ?? p.name;
      hooks.setPet({ species: p.species, variant: parts[2] ?? "", name, wear: 0 });
      return done(`${name} trots after you`);
    },
    async refresh() {},
    onChange(f) {
      wallet.onChange(f);
      return () => {};
    },
  };
}
