import { describe, expect, test } from "bun:test";
import { BARKEEP, BARKEEP_HOME } from "../src/barkeep.ts";
import {
  doorOf,
  frontier,
  type GameMap,
  LEGEND,
  MAPS,
  plotBlock,
  plotId,
  TOWN_SPAWN,
  townMap,
} from "../src/maps.ts";
import { RAIDERS_SHOWN, roomEntry } from "../src/world.ts";

/** Tiles you can walk onto or stand next to (to sit, read or open a door) from (x, y). */
function reachable(map: GameMap, x: number, y: number): Set<string> {
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

  test("town: grows around its companies, and the spawn reaches every door, bench and the Inn", () => {
    // Companies on every side, with a gap left by one that closed (a park).
    let plots: number[] = [];
    for (let i = 0; i < 12; i++) plots.push(frontier(plots)[i % 3]!);
    plots = plots.filter((_, i) => i !== 4);
    const town = townMap(plots);
    for (const row of town.rows) expect(row.length).toBe(town.width);
    for (const row of town.rows) for (const ch of row) expect(LEGEND[ch]).toBeDefined();
    expect(town.walkable(...TOWN_SPAWN)).toBe(true);
    const seen = reachable(town, ...TOWN_SPAWN);
    expect(town.find("D")).toHaveLength(plots.length);
    for (const plot of plots) {
      expect(town.at(...doorOf(plot))).toBe("D");
      expect(seen.has(doorOf(plot).join(","))).toBe(true);
    }
    for (const ch of ["I", "B", "N", "o", "G"])
      for (const t of town.find(ch)) expect(seen.has(t.join(","))).toBe(true);
    expect(town.x0).toBeLessThan(0);
  });

  test("town: you can build on any empty block next to it, nearest the square first", () => {
    const first = frontier([]);
    expect(first).toHaveLength(8); // around the 2×2 core
    expect(first).not.toContain(plotId(0, 0));
    const next = frontier([plotId(2, 0)]);
    expect(next).toContain(plotId(3, 0));
    expect(next).not.toContain(plotId(2, 0));
    for (const p of next) expect(plotId(...plotBlock(p))).toBe(p);
  });

  test("dungeon: a war desk in front of every seat, one per raider shown, all on aisles you can walk", () => {
    const map = MAPS.dungeon;
    expect(map.find("x")).toHaveLength(1);
    const seats = map.find("r");
    expect(seats).toHaveLength(RAIDERS_SHOWN);
    const entry = roomEntry("dungeon");
    const seen = reachable(map, entry.x, entry.y);
    for (const [x, y] of seats) {
      expect(map.at(x, y - 1)).toBe("l");
      expect(seen.has(`${x},${y}`)).toBe(true);
    }
    // You can walk up to the boss.
    expect(map.find("Z").some((t) => seen.has(t.join(",")))).toBe(true);
  });

  for (const id of ["hq", "inn", "basement"] as const) {
    test(`${id}: one exit, and every bed and chair is reachable from it`, () => {
      const map = MAPS[id];
      expect(map.find("x")).toHaveLength(1);
      const entry = roomEntry(id === "hq" ? "hq:1" : id);
      const seen = reachable(map, entry.x, entry.y);
      for (const ch of ["b", "c"]) for (const t of map.find(ch)) expect(seen.has(t.join(","))).toBe(true);
    });
  }

  describe("the Tavern", () => {
    const map = MAPS.inn;
    const entry = roomEntry("inn");
    const seen = reachable(map, entry.x, entry.y);
    const cells = (ch: string) => map.find(ch);

    test("24x14, one exit, the door steps in just above it", () => {
      expect([map.width, map.height]).toEqual([24, 14]);
      expect(map.name).toBe("The Tavern");
      expect(cells("x")).toEqual([[11, 13]]);
      expect([entry.x, entry.y]).toEqual([11, 12]);
      expect(map.walkable(entry.x, entry.y)).toBe(true);
    });

    test("every chair, stool and sofa is reachable from the door", () => {
      for (const ch of ["c", "v", "s"]) {
        expect(cells(ch).length).toBeGreaterThan(0);
        for (const t of cells(ch)) expect(seen.has(t.join(","))).toBe(true);
      }
    });

    test("the bar is sealed: the barkeep's cell can't be reached, and isn't floor to sleep on", () => {
      expect(map.walkable(BARKEEP_HOME.x, BARKEEP_HOME.y)).toBe(true);
      expect(seen.has(`${BARKEEP_HOME.x},${BARKEEP_HOME.y}`)).toBe(false);
      expect(BARKEEP.home).toEqual(BARKEEP_HOME);
      // Everything behind the bar line is rug or shelf, never `_`.
      for (let x = 1; x <= 8; x++) expect(map.at(x, 3)).toBe("=");
      for (const t of cells("=").filter(([, y]) => y === 3)) expect(seen.has(t.join(","))).toBe(false);
    });

    test("the boards and the tap are all there, and each can be walked up to", () => {
      for (const ch of ["a", "y", "m", "A", "P", "f", "n", "e", "h", "K", "o"]) {
        expect(cells(ch).length).toBeGreaterThan(0);
        const standable = cells(ch).some(([x, y]) =>
          [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ].some(([dx, dy]) => map.walkable(x + dx!, y + dy!) && seen.has(`${x + dx!},${y + dy!}`)),
        );
        expect(standable).toBe(true);
      }
      expect(cells("A")).toHaveLength(4);
      expect(cells("P")).toHaveLength(2);
      expect(LEGEND.y!.serves).toBe(true);
      // The stage is walkable; the stairs down are in the bottom wall.
      expect(LEGEND.e!.walk).toBe(true);
      expect(cells("S")).toEqual([[3, 13]]);
    });

    test("the stage can be walked across", () => {
      for (const t of cells("e")) expect(seen.has(t.join(","))).toBe(true);
    });
  });
});
