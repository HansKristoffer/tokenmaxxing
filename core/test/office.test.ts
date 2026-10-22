import { describe, expect, test } from "bun:test";
import { MAPS } from "../src/maps.ts";
import {
  doorsFor,
  FURNITURE,
  hqMap,
  OFFICE_LEVEL,
  OFFICE_MAPS,
  OFFICE_SIZES,
  type OfficeTier,
  officeMap,
  officeTier,
  STARTER_OFFICE,
  setOffice,
  withPieces,
} from "../src/office.ts";
import { route } from "../src/world.ts";

describe("offices", () => {
  test("doors: 10 to a hallway, by id", () => {
    const owners = [5, 3, 11, 1, 2, 4, 6, 7, 8, 9, 10].map((id) => ({
      userId: id,
      name: `u${id}`,
      open: true,
    }));
    const doors = doorsFor(owners);
    expect(doors.map((d) => d.userId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(doors.slice(0, 10).map((d) => [d.x, d.y])).toEqual(
      [1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map((x) => [x, -2]),
    );
    expect(doors[10]).toMatchObject({ userId: 11, x: 1, y: -5 });
  });

  test("the building: today's floor, with hallways of doors above it, all reachable", () => {
    expect(MAPS.hq.find("R")).toEqual([]);
    expect(hqMap([])).toEqual(MAPS.hq);
    const three = doorsFor([1, 2, 3].map((id) => ({ userId: id, name: `u${id}`, open: true })));
    const map = hqMap(three);
    expect(map.y0).toBe(-3);
    expect(map.find("R")).toEqual(three.map((d) => [d.x, d.y]));
    for (const d of three) expect([map.at(d.x, d.y - 1), map.at(d.x, d.y + 1)]).toEqual(["W", "_"]);
    expect(map.rows.slice(2 - map.y0)).toEqual(MAPS.hq.rows.slice(2)); // the floor, where it was
    const tower = hqMap(
      doorsFor(Array.from({ length: 25 }, (_, i) => ({ userId: i, name: "", open: true }))),
    );
    const [ex, ey] = tower.find("x")[0]!;
    for (const [x, y] of tower.find("R")) expect(route(tower, [ex, ey - 1], [x, y])).not.toBeNull();
  });

  test("furniture is written over floor only: never over a wall or a door", () => {
    const pieces = [
      { ch: "d", x: 0, y: 0 },
      { ch: "d", x: 5, y: 8 },
      { ch: "t", x: 10, y: 1 },
    ];
    const map = withPieces(pieces, MAPS.office);
    expect([map.at(0, 0), map.at(5, 8), map.at(10, 1), map.at(11, 1)]).toEqual(["W", "x", "t", "W"]);
  });

  test("the pet bed: in every office, off the door, the desk and the paths, and reachable", () => {
    const office = MAPS.office;
    const beds = office.find("Q");
    expect(beds).toHaveLength(1);
    const [bx, by] = beds[0]!;
    expect(office.kind(bx, by).name).toBe("pet bed");
    expect(office.walkable(bx, by)).toBe(false);
    // In a corner, so it blocks nothing.
    expect([office.at(bx + 1, by), office.at(bx, by + 1), office.at(bx + 1, by + 1)]).toEqual([
      "W",
      "W",
      "W",
    ]);
    const [door] = office.find("x");
    for (const p of STARTER_OFFICE) expect([p.x, p.y]).not.toEqual([bx, by]);
    // Someone can stand beside it (to read its sign), reaching it from the door.
    const [ex, ey] = door!;
    const beside = [
      [bx - 1, by],
      [bx, by - 1],
    ] as const;
    expect(beside.some(([x, y]) => route(office, [ex, ey - 1], [x, y]) !== null)).toBe(true);
    // With the starter desk and chair there, and with every piece of furniture beside it.
    const starter = withPieces(STARTER_OFFICE, office);
    expect(starter.at(bx, by)).toBe("Q");
    expect(route(starter, [ex, ey - 1], [bx - 1, by])).not.toBeNull();
  });

  test("nothing can be dropped on the pet bed: furniture is written over floor only", () => {
    const [bx, by] = MAPS.office.find("Q")[0]!;
    for (const f of FURNITURE) {
      const map = withPieces([{ ch: f.ch, x: bx - (f.w ?? 1) + 1, y: by }], MAPS.office);
      expect(map.at(bx, by)).toBe("Q");
    }
  });

  test("tier 0 is the template every office had", () => {
    expect(officeMap(0).rows).toEqual([
      "WWWWWWWWWWWW",
      "W____UUUU__W",
      "W__________W",
      "W__________W",
      "W__________W",
      "W__________W",
      "W__________W",
      "W_________QW",
      "WWWWWxWWWWWW",
    ]);
    expect(MAPS.office.rows).toEqual(officeMap(0).rows);
  });

  test("tiers by level: 10, 25, 40", () => {
    expect([0, 9, 10, 24].map(officeTier)).toEqual([0, 0, 0, 0]);
    expect([25, 39].map(officeTier)).toEqual([1, 1]);
    expect([40, 99].map(officeTier)).toEqual([2, 2]);
    expect(OFFICE_SIZES[0]!.level).toBe(OFFICE_LEVEL);
  });

  for (const tier of [0, 1, 2] as OfficeTier[])
    describe(`size ${tier}`, () => {
      const { w, h } = OFFICE_SIZES[tier]!;
      const map = officeMap(tier);

      test("one door at x = 5, one pet bed in the corner, the shelf on the top row", () => {
        expect([map.width, map.height]).toEqual([w, h]);
        expect(map.find("x")).toEqual([[5, h - 1]]);
        expect(map.find("Q")).toEqual([[w - 2, h - 2]]);
        expect(map.find("U")).toEqual([5, 6, 7, 8].map((x) => [x, 1]));
        expect(map.rows.every((r) => r.length === w)).toBe(true);
      });

      test("the bed is reachable from the door, with the starter desk down", () => {
        const [bx, by] = map.find("Q")[0]!;
        const starter = withPieces(STARTER_OFFICE, map);
        for (const m of [map, starter]) {
          expect(m.at(bx, by)).toBe("Q");
          expect(route(m, [5, h - 2], [bx - 1, by])).not.toBeNull();
        }
        expect([starter.at(5, 3), starter.at(5, 4)]).toEqual(["d", "c"]);
      });
    });

  test("growing keeps the floor and the shelf where they were", () => {
    const small = officeMap(0);
    for (const tier of [1, 2] as OfficeTier[]) {
      const big = officeMap(tier);
      for (let y = 0; y < small.height; y++)
        for (let x = 0; x < small.width; x++) {
          const was = small.at(x, y);
          if (was === "_" || was === "U") expect(big.at(x, y)).toBe(was);
        }
    }
  });

  test("setOffice: a map per owner, kept while nothing changes, with decor on it", () => {
    const a = setOffice(901, 1);
    expect(a.width).toBe(14);
    expect(setOffice(901, 1)).toBe(a);
    const b = setOffice(901, 1, { wall: "nyhavn" });
    expect(b).not.toBe(a);
    expect(b.decor).toEqual({ wall: "nyhavn" });
    expect(withPieces(STARTER_OFFICE, b).decor).toEqual({ wall: "nyhavn" });
    expect(setOffice(902, 0)).toBe(MAPS.office);
    expect(OFFICE_MAPS.get(901)).toBe(b);
  });
});
