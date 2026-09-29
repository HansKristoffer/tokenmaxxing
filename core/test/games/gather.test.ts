import { describe, expect, test } from "bun:test";
import { findSpot, propTiles, type Spot, seatsFor, spotSize } from "../../src/games/gather.ts";
import { MAPS, TOWN_SPAWN } from "../../src/maps.ts";

const town = MAPS.town;

describe("gathering in town", () => {
  test("the nearest free 3×3 patch: all walkable, and never next to another game", () => {
    const at = findSpot(town, TOWN_SPAWN, 3, 3, [])!;
    for (let y = at.y; y < at.y + 3; y++)
      for (let x = at.x; x < at.x + 3; x++) expect(town.walkable(x, y)).toBe(true);
    const first: Spot = { ...at, w: 3, h: 3, kind: "table" };
    const second = findSpot(town, TOWN_SPAWN, 3, 3, [first])!;
    // No overlap, and at least a tile of space in between.
    const apart =
      second.x >= first.x + 4 ||
      second.x + 3 <= first.x - 1 ||
      second.y >= first.y + 4 ||
      second.y + 3 <= first.y - 1;
    expect(apart).toBe(true);
  });

  test("a duel faces off across the table; the table itself is blocked", () => {
    const spot: Spot = { x: 10, y: 10, ...spotSize("table", 2), kind: "table" };
    expect(seatsFor(spot, 2)).toEqual([
      { x: 10, y: 11, facing: "right" },
      { x: 12, y: 11, facing: "left" },
    ]);
    expect(propTiles(spot)).toEqual([[11, 11]]);
    expect(seatsFor(spot, 8)).toHaveLength(8);
    expect(seatsFor(spot, 8).some((s) => s.x === 11 && s.y === 11)).toBe(false);
  });

  test("an arena has a desk per player, everyone facing the scoreboard", () => {
    const spot: Spot = { x: 5, y: 5, ...spotSize("arena", 6), kind: "arena" };
    expect(spot.w).toBe(6);
    const seats = seatsFor(spot, 6);
    expect(seats.every((s) => s.y === 6 && s.facing === "up")).toBe(true);
    expect(propTiles(spot)).toHaveLength(6);
  });
});
