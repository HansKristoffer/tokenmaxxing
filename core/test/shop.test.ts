import { expect, test } from "bun:test";
import { ITEMS, isTradeable, itemById, levelItems, parseSide } from "../src/shop.ts";
import { LOOK_OPTIONS } from "../src/world.ts";

test("level items: the shop's milestones at 10-50, the wardrobe's at 5, 15, 25, the head pack's at 7, 17, 27", () => {
  expect(levelItems(4)).toEqual([]);
  expect(levelItems(10).map((i) => i.name)).toEqual(["Top hat", "Rubber-duck hat", "Rubber duck"]);
  expect(
    levelItems(50)
      .map((i) => i.level)
      .sort((a, b) => a! - b!),
  ).toEqual([5, 7, 10, 15, 17, 20, 25, 27, 30, 40, 50]);
  expect(
    levelItems(50)
      .filter((i) => i.level! >= 40)
      .map((i) => i.name),
  ).toEqual(["Nebula visor", "Golden regalia"]);
  // One reward a level.
  expect(new Set(levelItems(Infinity).map((i) => i.level)).size).toBe(levelItems(Infinity).length);
  for (const i of ITEMS.filter((i) => i.level !== undefined)) {
    expect(i.price).toBe(0);
    expect(i.index).toBeLessThan(i.slot === "furniture" ? 0 : LOOK_OPTIONS[i.slot]);
  }
});

test("rewards never change hands; furniture is sold and does", () => {
  expect(levelItems(50).some((i) => isTradeable(i.id))).toBe(false);
  expect([isTradeable("hat.1"), isTradeable("furn.s"), isTradeable("nope")]).toEqual([true, true, false]);
  expect(itemById("furn.t")).toMatchObject({ slot: "furniture", name: "TV", price: 120 });
  expect(parseSide({ coins: 0, items: ["hat.4"] })).toBeNull();
  expect(parseSide({ coins: 5, items: ["furn.s", "hat.1"] })).toEqual({
    coins: 5,
    items: ["furn.s", "hat.1"],
  });
});

test("no two items share a slot and index: a look's number means one thing", () => {
  const worn = ITEMS.filter((i) => i.slot !== "furniture").map((i) => `${i.slot}.${i.index}`);
  expect(new Set(worn).size).toBe(worn.length);
});
