import { expect, test } from "bun:test";
import { RARITIES, rarityOf } from "@tokenmaxxing/core/rarity.ts";
import { ITEMS } from "@tokenmaxxing/core/shop.ts";
import { BAG_GROUPS, groupBag, groupOf } from "../src/hud/bagGroups.ts";

const rows = ITEMS.map((i) => ({ item: i.id, count: 1 }));

test("every row lands in exactly one group", () => {
  const all = [...rows, { item: "nope.1", count: 2 }];
  const groups = groupBag(all);
  const placed = groups.flatMap((g) => g.entries.map((e) => e.row.item));
  expect(placed.toSorted()).toEqual(all.map((r) => r.item).toSorted());
  expect(new Set(placed).size).toBe(placed.length);
});

test("groups come in the fixed order and empty ones are hidden", () => {
  const order = BAG_GROUPS.map(([id]) => id);
  const ids = groupBag(rows).map((g) => g.id);
  expect(ids).toEqual(order.filter((id) => ids.includes(id)));
  expect(groupBag([])).toEqual([]);
  const one = ITEMS.find((i) => groupOf(i) === "outfit")!;
  expect(groupBag([{ item: one.id, count: 3 }]).map((g) => [g.id, g.count])).toEqual([["outfit", 3]]);
});

test("rewards and loot are grouped apart from their slot; unknown kinds go to other", () => {
  const reward = ITEMS.find((i) => i.level !== undefined);
  if (reward) expect(groupOf(reward)).toBe("rewards");
  const loot = ITEMS.find((i) => i.loot);
  if (loot) expect(groupOf(loot)).toBe("rewards");
  expect(groupOf(undefined)).toBe("other");
});

test("worn first, then rarest, then by name", () => {
  const outfits = ITEMS.filter((i) => groupOf(i) === "outfit");
  const worn = outfits[outfits.length - 1]!;
  const g = groupBag(
    outfits.map((i) => ({ item: i.id, count: 1 })),
    (i) => i.id === worn.id,
  )[0]!;
  expect(g.entries[0]!.item).toBe(worn);
  const rest = g.entries.slice(1).map((e) => e.item!);
  const keys = rest.map((i) => [RARITIES.indexOf(rarityOf(i)), i.name] as const);
  const sorted = keys.toSorted((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]));
  expect(keys).toEqual(sorted);
});
