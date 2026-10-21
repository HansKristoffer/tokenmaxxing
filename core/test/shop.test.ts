import { expect, test } from "bun:test";
import { ITEMS, isTradeable, itemById, levelItems, parseSide } from "../src/shop.ts";
import { LOOK_OPTIONS } from "../src/world.ts";

test("level items come at 5, 10, 15, 20, 25 and 30, free and wearable", () => {
  expect(levelItems(4)).toEqual([]);
  expect(levelItems(10).map((i) => i.name)).toEqual(["Top hat", "Rubber-duck hat"]);
  expect(levelItems(30)).toHaveLength(6);
  for (const i of ITEMS.filter((i) => i.level !== undefined)) {
    expect(i.price).toBe(0);
    expect(i.index).toBeLessThan(i.slot === "furniture" ? 0 : LOOK_OPTIONS[i.slot]);
  }
});

test("rewards never change hands; furniture is sold and does", () => {
  expect(levelItems(30).some((i) => isTradeable(i.id))).toBe(false);
  expect([isTradeable("hat.1"), isTradeable("furn.s"), isTradeable("nope")]).toEqual([true, true, false]);
  expect(itemById("furn.t")).toMatchObject({ slot: "furniture", name: "TV", price: 120 });
  expect(parseSide({ coins: 0, items: ["hat.4"] })).toBeNull();
  expect(parseSide({ coins: 5, items: ["furn.s", "hat.1"] })).toEqual({
    coins: 5,
    items: ["furn.s", "hat.1"],
  });
});
