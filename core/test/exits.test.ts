import { describe, expect, test } from "bun:test";
import { type GameMap, layoutOf, MAPS } from "../src/maps.ts";
import { doorsFor, hqMap, officeMap } from "../src/office.ts";
import { route } from "../src/world.ts";

/** Every room but the town, in the sizes the game builds them: the fixed rooms, a house with two hallways, every Office size. */
const rooms = (): GameMap[] => [
  ...Object.values(MAPS).filter((m) => m.id !== "town"),
  hqMap(doorsFor(Array.from({ length: 12 }, (_, i) => ({ userId: i + 1, name: `u${i}`, open: true })))),
  officeMap(1),
  officeMap(2),
];

/** Where you arrive (`roomEntry`): just inside the exit `x`, which every room has. */
const entry = (map: GameMap): [number, number] => {
  const [x, y] = map.find("x")[0]!;
  return [x, y - 1];
};

describe("exits", () => {
  for (const map of rooms()) {
    const doors = layoutOf(map).doors;
    test(`${map.id} (${map.width}×${map.height}): has a way out, and every exit is reached from the entry`, () => {
      expect(doors.length).toBeGreaterThan(0);
      expect(map.find("x").length).toBeGreaterThan(0);
      const from = entry(map);
      expect(map.walkable(...from)).toBe(true);
      for (const d of doors) {
        const way = route(map, from, [d.x, d.y]);
        expect(way, `${map.id}: ${d.ch} at ${d.x},${d.y}`).not.toBeNull();
      }
    });

    test(`${map.id}: every exit has a threshold, a walkable tile beside it for the mat and the marker`, () => {
      for (const d of doors) {
        const beside = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ].some(([dx, dy]) => map.walkable(d.x + dx!, d.y + dy!));
        expect(beside, `${map.id}: ${d.ch} at ${d.x},${d.y}`).toBe(true);
      }
    });
  }

  test("a house's office doors are reached through the passage, hallway by hallway", () => {
    const map = hqMap(
      doorsFor(Array.from({ length: 25 }, (_, i) => ({ userId: i + 1, name: `u${i}`, open: true }))),
    );
    expect(map.find("R")).toHaveLength(25);
    for (const [x, y] of map.find("R")) expect(route(map, entry(map), [x, y])).not.toBeNull();
  });
});
