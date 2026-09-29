import { describe, expect, test } from "bun:test";
import { LEGEND, MAPS, PLOT_COUNT, TOWN_SPAWN } from "../src/maps.ts";
import { roomEntry } from "../src/world.ts";

/** Tiles you can walk onto or stand next to (to sit, read or open a door) from (x, y). */
function reachable(map: (typeof MAPS)[keyof typeof MAPS], x: number, y: number): Set<string> {
  const seen = new Set([`${x},${y}`]);
  const queue = [[x, y] as [number, number]];
  while (queue.length) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = cx + dx!;
      const ny = cy + dy!;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (map.walkable(nx, ny)) queue.push([nx, ny]);
    }
  }
  return seen;
}

describe("maps", () => {
  for (const map of Object.values(MAPS)) {
    test(`${map.id}: rectangular, every tile in the legend`, () => {
      for (const row of map.rows) expect(row.length).toBe(map.width);
      for (const row of map.rows) for (const ch of row) expect(LEGEND[ch]).toBeDefined();
    });
  }

  test("town: the spawn is walkable and reaches every door, bench and the Inn", () => {
    const town = MAPS.town;
    expect(town.walkable(...TOWN_SPAWN)).toBe(true);
    const seen = reachable(town, ...TOWN_SPAWN);
    for (let plot = 1; plot <= PLOT_COUNT; plot++) {
      const doors = town.find(String(plot));
      expect(doors).toHaveLength(1);
      expect(seen.has(doors[0]!.join(","))).toBe(true);
    }
    for (const ch of ["I", "B", "N"]) for (const t of town.find(ch)) expect(seen.has(t.join(","))).toBe(true);
  });

  for (const id of ["hq", "inn"] as const) {
    test(`${id}: one exit, and every bed and chair is reachable from it`, () => {
      const map = MAPS[id];
      expect(map.find("x")).toHaveLength(1);
      const entry = roomEntry(id === "hq" ? "hq:1" : "inn");
      const seen = reachable(map, entry.x, entry.y);
      for (const ch of ["b", "c"]) for (const t of map.find(ch)) expect(seen.has(t.join(","))).toBe(true);
    });
  }
});
