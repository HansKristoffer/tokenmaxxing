/**
 * The 2D game's pages for the same shops: the old Shop page's tabs, Decorate, Desk, the company shop and a
 * company's merch. In 2D mode (and whenever the 3D shop panel is not up) a shop counter opens these.
 */
import type { Item } from "@tokenmaxxing/core/shop.ts";
import { itemById } from "@tokenmaxxing/core/shop.ts";
import type { ShopId } from "../../demo3d/shops/index.ts";
import { purchaseOf } from "../../demo3d/shops/purchase.ts";
import { hud, type Panel } from "../../store.ts";

const TAB: Record<ShopId, Item["slot"]> = {
  clothes: "outfit",
  barber: "glasses",
  pets: "pet",
  furniture: "furniture",
};

/** The page a shop's counter opens in 2D: the Shop page on the tab that shop sells. */
export const pageForShop = (shop: ShopId): Panel => ({ kind: "shop", tab: TAB[shop] });

/** The page that sells one item (a shelf in the 3D shop, in 2D): the same tab, or the page for what the Shop page does not carry. */
export function pageForItem(id: string): Panel {
  const p = purchaseOf(id);
  switch (p.kind) {
    case "decor":
      return { kind: "decor" };
    case "desk":
      return { kind: "desk" };
    case "piece":
      return { kind: "companyShop" };
    case "merch":
      return { kind: "merch", companyId: p.companyId };
    default:
      return { kind: "shop", tab: itemById(id)?.slot };
  }
}

export const openShopPage = (shop: ShopId): void => hud.set({ panel: pageForShop(shop) });
