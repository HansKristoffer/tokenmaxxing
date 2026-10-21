import { expect, test } from "bun:test";
import { ITEMS, isTradeable, itemById, levelItems, parseSide } from "../src/shop.ts";
import { LOOK_OPTIONS } from "../src/world.ts";

test("level items come at 10, 20, 30, 40 and 50, free and wearable", () => {
  expect(levelItems(9)).toEqual([]);
  expect(levelItems(10).map((i) => i.name)).toEqual(["Top hat"]);
  expect(levelItems(30)).toHaveLength(3);
  expect(
    levelItems(50)
      .map((i) => i.name)
      .slice(3),
  ).toEqual(["Nebula visor", "Golden regalia"]);
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
