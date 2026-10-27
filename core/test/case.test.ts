import { expect, test } from "bun:test";
import { CASE_BASE, CASE_ITEMS, caseAt } from "../src/case.ts";
import { EDITIONS } from "../src/editions.ts";
import { HEADWEAR_ITEMS } from "../src/headwear.ts";
import { LOOT } from "../src/loot.ts";
import { ITEMS, itemById } from "../src/shop.ts";
import { WARDROBE } from "../src/wardrobe.ts";

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
