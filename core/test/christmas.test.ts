import { expect, test } from "bun:test";
import {
  blocksTile,
  CHRISTMAS_NPC,
  GARLANDS,
  GIFT_TILES,
  GIFTS_MAX,
  giftLine,
  giftsShown,
  NISSE_TILE,
  nisseSpots,
  ORNAMENTS,
  ornamentsShown,
  progress,
  SNOWMEN,
  SQUARE_LAMPS,
  snowmenShown,
  starUp,
  TREE,
  wreathSpots,
} from "../src/christmas.ts";
import { COSTUME_BASE, COSTUMES, costumeAt, onSale } from "../src/costumes.ts";
import { FESTIVE_NPC, festiveWith, parseFestivePin } from "../src/festive.ts";
import { plotId, SHOP_BLOCKS, townMap } from "../src/maps.ts";
import { copenhagenToMs } from "../src/sky.ts";
import { FESTIVE_THEMES } from "../src/themes.ts";
import { route } from "../src/world.ts";

const cph = (at: string) => copenhagenToMs(at)!;
const at = (iso: string) => festiveWith(null, cph(iso));
const plots = [plotId(-2, 0), plotId(0, 2), plotId(1, -1)];
const map = townMap(plots);

test("the build-up: a bare tree on the 18th, everything by the 24th at 18:00", () => {
  expect(progress(null)).toBe(0);
  const first = at("2026-12-18T00:00");
  expect(progress(first)).toBeCloseTo(0, 5);
  expect(ornamentsShown(progress(first))).toBe(0);
  expect(giftsShown(progress(first))).toBe(0);
  expect(snowmenShown(progress(first))).toBe(1);
  expect(starUp(progress(first))).toBe(false);
  const last = at("2026-12-24T18:00");
  expect(progress(last)).toBe(1);
  expect(ornamentsShown(1)).toBe(ORNAMENTS.length);
  expect(giftsShown(1)).toBe(GIFTS_MAX);
  expect(snowmenShown(1)).toBe(SNOWMEN.length);
  expect(starUp(1)).toBe(true);
  // The 25th stays full; another theme's day has none.
  expect(progress(at("2026-12-25T12:00"))).toBe(1);
  expect(progress(at("2026-10-31T12:00"))).toBe(0);
});

test("the tree grows through every day, never shrinks", () => {
  let before = -1;
  let gifts = -1;
  for (let ms = cph("2026-12-18T00:00"); ms <= cph("2026-12-25T23:00"); ms += 30 * 60_000) {
    const p = progress(festiveWith(null, ms));
    expect(ornamentsShown(p)).toBeGreaterThanOrEqual(before);
    expect(giftsShown(p)).toBeGreaterThanOrEqual(gifts);
    before = ornamentsShown(p);
    gifts = giftsShown(p);
  }
  // Each day adds some: the 19th, 21st and 23rd at noon are strictly more than the day before.
  const noon = (d: number) => ornamentsShown(progress(at(`2026-12-${d}T12:00`)));
  for (const d of [19, 20, 21, 22, 23, 24]) expect(noon(d)).toBeGreaterThan(noon(d - 1));
  // And within a day it moves, so a player who comes back at night sees more.
  expect(ornamentsShown(progress(at("2026-12-21T20:00")))).toBeGreaterThan(noon(21));
});

test("ornaments hang on the front half, every set shows, and the lights are in four colours", () => {
  expect(new Set(ORNAMENTS.map((o) => o.set)).size).toBe(7);
  for (const o of ORNAMENTS) {
    expect(o.h).toBeGreaterThan(0);
    expect(o.h).toBeLessThan(1);
    expect(Math.abs(o.a)).toBeLessThan(Math.PI);
  }
  expect(new Set(ORNAMENTS.filter((o) => o.set === "lightsLow").map((o) => o.hue)).size).toBe(4);
});

test("the tree, Knud and the gifts are on the square's paving, and the square stays open round them", () => {
  const spots = [TREE, NISSE_TILE, ...GIFT_TILES];
  expect(new Set(spots.map((s) => `${s.x},${s.y}`)).size).toBe(spots.length);
  for (const s of spots) expect(map.at(s.x, s.y)).toBe(":");
  // No chokepoint: with both blocked the whole square still connects, and every neighbour of either is free but
  // for the other.
  const open = (x: number, y: number) => map.walkable(x, y) && !blocksTile(x, y);
  const blocked = new Proxy(map, {
    get: (t, k) => {
      if (k === "walkable") return open;
      const v = Reflect.get(t, k, t);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
  expect(route(blocked, [1, 5], [19, 5])).not.toBeNull();
  expect(route(blocked, [10, 8], [10, 5])).not.toBeNull();
  expect(route(blocked, [13, 8], [13, 4])).not.toBeNull();
  for (const [x, y] of [
    [TREE.x, TREE.y],
    [NISSE_TILE.x, NISSE_TILE.y],
  ] as const)
    expect(
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => open(x + dx!, y + dy!)).length,
    ).toBeGreaterThanOrEqual(3);
  expect(blocksTile(TREE.x, TREE.y)).toBe(true);
  expect(blocksTile(NISSE_TILE.x, NISSE_TILE.y)).toBe(true);
  expect(blocksTile(GIFT_TILES[0]!.x, GIFT_TILES[0]!.y)).toBe(false);
});

test("the garlands run between lamps that are lamps, the snowmen stand on open ground", () => {
  for (const [x, y] of SQUARE_LAMPS) expect(map.at(x, y)).toBe("L");
  for (const g of GARLANDS) expect(SQUARE_LAMPS[g.from]![1]).toBe(SQUARE_LAMPS[g.to]![1]);
  for (const s of SNOWMEN) expect(map.walkable(s.x, s.y)).toBe(true);
});

test("a wreath on every door, a nisse on the grass beside each path", () => {
  const doors = wreathSpots(map);
  // The Tavern, three companies and the shops.
  expect(doors).toHaveLength(1 + plots.length + Object.keys(SHOP_BLOCKS).length);
  expect(doors.filter((d) => d.inn)).toHaveLength(1);
  expect(doors.filter((d) => d.kind === "company")).toHaveLength(plots.length);
  const nisser = nisseSpots(map);
  expect(nisser.length).toBeGreaterThanOrEqual(doors.length - 1);
  for (const n of nisser) expect(map.at(n.x, n.y)).toBe(".");
});

test("Nisse Knud is registered, with a real script", () => {
  expect(FESTIVE_NPC.christmas).toBe(CHRISTMAS_NPC);
  expect(CHRISTMAS_NPC.name).toBe("Nisse Knud");
  expect([CHRISTMAS_NPC.x, CHRISTMAS_NPC.y]).toEqual([NISSE_TILE.x, NISSE_TILE.y]);
  expect(CHRISTMAS_NPC.lines.length).toBeGreaterThanOrEqual(6);
  expect(CHRISTMAS_NPC.lines.length).toBeLessThanOrEqual(12);
  for (const l of CHRISTMAS_NPC.lines) expect(l.length).toBeLessThan(260);
  expect(CHRISTMAS_NPC.lines.join(" ")).toMatch(/julehjerte/);
  expect(giftLine(-1).length).toBeGreaterThan(0);
});

test("Christmas has its own music for the square and the Tavern", () => {
  expect(FESTIVE_THEMES.christmas?.town?.id).toBe("festive-christmas-town");
  expect(FESTIVE_THEMES.christmas?.tavern?.id).toBe("festive-christmas-tavern");
});

test("three Christmas hats, in the season's own index range, sold from the 10th to the 26th", () => {
  const hats = COSTUMES.filter((c) => c.holiday === "christmas");
  expect(hats.map((c) => c.name)).toEqual(["Santa hat", "Reindeer antlers", "Gløgg mug hat"]);
  for (const c of hats) {
    expect(c.index).toBeGreaterThanOrEqual(COSTUME_BASE + 40);
    expect(c.index).toBeLessThanOrEqual(COSTUME_BASE + 49);
    expect(costumeAt("hat", c.index)).toBe(c);
    expect(onSale(c, cph("2026-12-09T23:59"))).toBe(false);
    expect(onSale(c, cph("2026-12-10T00:00"))).toBe(true);
    expect(onSale(c, cph("2026-12-26T23:59"))).toBe(true);
    expect(onSale(c, cph("2026-12-27T00:00"))).toBe(false);
  }
  // Nobody else's index is in the reserved range, and no two share one.
  const indexes = COSTUMES.map((c) => c.index);
  expect(new Set(indexes).size).toBe(indexes.length);
  expect(COSTUMES.filter((c) => c.holiday !== "christmas" && c.index >= COSTUME_BASE + 40 && c.index < COSTUME_BASE + 50)).toHaveLength(0);
});

test("the theme pins say christmas", () => {
  const pin = parseFestivePin("christmas@12-22", cph("2026-10-30T12:00"));
  expect(festiveWith(pin, cph("2026-10-30T12:00"))?.id).toBe("christmas");
});
