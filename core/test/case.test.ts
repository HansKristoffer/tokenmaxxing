import { expect, test } from "bun:test";
import { CASE_BASE, CASE_ITEMS, caseAt } from "../src/case.ts";
import { EDITIONS } from "../src/editions.ts";
import { HEADWEAR_ITEMS } from "../src/headwear.ts";
import { LOOT } from "../src/loot.ts";
import { ITEMS, itemById } from "../src/shop.ts";
import { WARDROBE } from "../src/wardrobe.ts";
import { defaultLook, parseLook } from "../src/world.ts";

const others = [...ITEMS.filter((i) => !i.case), ...EDITIONS, ...HEADWEAR_ITEMS, ...WARDROBE, ...LOOT];

test("a case item is new: no id or name matches the shop, wardrobe, headwear, editions or raid loot", () => {
  const names = new Set(others.map((i) => i.name.toLowerCase()));
  const ids = new Set(others.map((i) => i.id));
  for (const c of CASE_ITEMS) {
    expect(names.has(c.name.toLowerCase())).toBe(false);
    expect(ids.has(c.id)).toBe(false);
  }
});

test("case items are unique among themselves, tradeable, free of a price, and above CASE_BASE", () => {
  expect(new Set(CASE_ITEMS.map((c) => c.id)).size).toBe(CASE_ITEMS.length);
  expect(new Set(CASE_ITEMS.map((c) => c.name.toLowerCase())).size).toBe(CASE_ITEMS.length);
  for (const c of CASE_ITEMS) {
    expect(c.index).toBeGreaterThanOrEqual(CASE_BASE);
    expect(c).toMatchObject({ price: 0, tradeable: true });
    expect(itemById(c.id)).toBe(c);
  }
});

test("caseAt finds a case item by slot and index, and nothing for a shop index", () => {
  const c = CASE_ITEMS[0]!;
  expect(caseAt(c.slot, c.index)).toBe(c);
  expect(caseAt(c.slot, 1)).toBeUndefined();
});

test("the four auras are legendary, tradeable, and in the aura slot", () => {
  const auras = CASE_ITEMS.filter((c) => c.slot === "aura");
  expect(auras.map((a) => [a.name, a.index, a.rarity, a.tradeable])).toEqual([
    ["Lantern Sky", 300, "legendary", true],
    ["Sakura Storm", 301, "legendary", true],
    ["Firefly Swarm", 302, "legendary", true],
    ["Koi Current", 303, "legendary", true],
  ]);
});

test("a look wears an aura 200..203, an old look without the field still parses, 999 is refused", () => {
  const look = defaultLook(1);
  for (const aura of [300, 301, 302, 303]) expect(parseLook({ ...look, aura })?.aura).toBe(aura);
  const old = { ...look };
  expect(parseLook(old)).toEqual(look);
  expect(parseLook(old)?.aura).toBeUndefined();
  expect(parseLook({ ...look, aura: 0 })).toEqual(look);
  expect(parseLook({ ...look, aura: 999 })).toBeNull();
  expect(parseLook({ ...look, aura: 1 })).toBeNull();
});
