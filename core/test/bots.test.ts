import { describe, expect, test } from "bun:test";
import { BOTS, chase, wander } from "../src/bots.ts";
import { plotId, townMap } from "../src/maps.ts";
import { CHAT_MAX_LENGTH, DIRS, parseLook } from "../src/world.ts";

describe("bots", () => {
  test("every bot is well formed", () => {
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(BOTS.length);
    for (const b of BOTS) {
      expect(b.id).toBeLessThan(0);
      expect(parseLook(b.look)).toEqual(b.look);
      expect(b.lines.length).toBeGreaterThan(0);
      for (const line of b.lines) expect(line.length).toBeLessThanOrEqual(CHAT_MAX_LENGTH);
      expect(b.every[0]).toBeGreaterThan(0);
      expect(b.every[1]).toBeGreaterThanOrEqual(b.every[0]);
    }
  });

  test("wanders over walkable tiles only", () => {
    const town = townMap([plotId(2, 0)]);
    let walks = 0;
    for (let i = 0; i < 200; i++) {
      const path = wander(town, 9, 5);
      if (!path) continue;
      walks++;
      let [x, y] = [9, 5];
      for (const dir of path) {
        x += DIRS[dir][0];
        y += DIRS[dir][1];
        expect(town.walkable(x, y)).toBe(true);
      }
    }
    expect(walks).toBeGreaterThan(50);
  });

  test("chases someone and stops next to them", () => {
    const town = townMap([plotId(2, 0)]);
    let [x, y] = [9, 5];
    const [tx, ty] = [9, 12];
    for (let dir = chase(town, x, y, tx, ty); dir; dir = chase(town, x, y, tx, ty)) {
      x += DIRS[dir][0];
      y += DIRS[dir][1];
      expect(town.walkable(x, y)).toBe(true);
    }
    expect(Math.abs(tx - x) + Math.abs(ty - y)).toBe(1);
  });
});
