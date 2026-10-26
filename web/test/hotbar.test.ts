import { expect, test } from "bun:test";
import { cycle, nextAfterPlace, orderSlots, pushRecent, slotsFit, wrap } from "../src/game/hotbar.ts";

const rows = [
  { item: "furn.a", count: 1 },
  { item: "furn.b", count: 3 },
  { item: "furn.c", count: 3 },
  { item: "hat.1", count: 5 },
  { item: "furn.d", count: 0 },
];

test("orders by recent placement, count, then name; furniture only", () => {
  const name = (i: string) => ({ "furn.b": "Sofa", "furn.c": "Bed" })[i] ?? i;
  expect(orderSlots(rows, [], name)).toEqual(["furn.c", "furn.b", "furn.a"]);
  expect(orderSlots(rows, ["furn.a"], name)).toEqual(["furn.a", "furn.c", "furn.b"]);
  expect(orderSlots(rows, [], name, 2)).toEqual(["furn.c", "furn.b"]);
});

test("wraps and cycles", () => {
  expect(wrap(0, -1, 3)).toBe(2);
  expect(wrap(2, 1, 3)).toBe(0);
  const s = ["a", "b", "c"];
  expect(cycle(s, "c", 1)).toBe("a");
  expect(cycle(s, "a", -1)).toBe("c");
  expect(cycle(s, null, 1)).toBe("a");
  expect(cycle(s, null, -1)).toBe("c");
  expect(cycle([], "a", 1)).toBeNull();
});

test("after a place: same kind while left, else next filled slot, else nothing", () => {
  const s = ["a", "b", "c"];
  expect(nextAfterPlace(s, "a", { a: 2, b: 1 })).toBe("a");
  expect(nextAfterPlace(s, "a", { b: 1, c: 1 })).toBe("b");
  expect(nextAfterPlace(s, "b", { a: 1 })).toBe("a");
  expect(nextAfterPlace(s, "c", {})).toBeNull();
});

test("recent list and slot fitting", () => {
  expect(pushRecent(["a", "b"], "b")).toEqual(["b", "a"]);
  expect(slotsFit(1400, 424)).toBe(9);
  expect(slotsFit(800, 316)).toBe(9);
  expect(slotsFit(500, 316)).toBe(3);
  expect(slotsFit(400, 316)).toBe(0);
});
