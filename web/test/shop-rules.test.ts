import { expect, test } from "bun:test";
import { ITEMS } from "@tokenmaxxing/core/shop.ts";
import { SHOP_IDS, shopForSlot } from "@tokenmaxxing/core/shoprooms.ts";
import { buyHint, MENU, SHOP_DIRECTORY, shopSlots } from "../src/hud/shops.ts";

test("the menu has no store, only the shop directory", () => {
  const kinds = MENU.map(([p]) => p.kind) as string[];
  expect(kinds).not.toContain("shop");
  expect(kinds).not.toContain("companyShop");
  expect(kinds).toContain("shops");
});

test("the directory lists the four shops with their keepers", () => {
  expect(SHOP_DIRECTORY.map((s) => s.id)).toEqual([...SHOP_IDS]);
  expect(SHOP_DIRECTORY.find((s) => s.id === "furniture")).toMatchObject({
    name: "Møbelhuset",
    keeper: "Freja",
  });
});

test("a shop's page carries only its own slots", () => {
  expect(shopSlots("pets")).toEqual(["pet", "petwear"]);
  expect(shopSlots("furniture")).toEqual(["furniture"]);
  expect(shopSlots("clothes")).not.toContain("pet");
  expect(shopSlots("barber")).toEqual([]);
  // No slot is on two shops' pages.
  const all = SHOP_IDS.flatMap((s) => shopSlots(s));
  expect(new Set(all).size).toBe(all.length);
});

test("every item you can buy is sold by exactly one shop", () => {
  for (const i of ITEMS) {
    if (i.earned || i.level !== undefined || i.loot || i.price === 0) continue;
    const shop = shopForSlot(i.slot);
    expect(shop, i.id).not.toBeNull();
    if (i.slot !== "merch") expect(shopSlots(shop!), i.id).toContain(i.slot as never);
  }
});

test("the bag's hint names the shop", () => {
  expect(buyHint("hat", "hats")).toBe("Buy hats at Thread & Token");
  expect(buyHint("pet", "pets")).toBe("Buy pets at Pet shop");
  expect(buyHint("nope", "x")).toBeNull();
});
