import { expect, test } from "bun:test";
import { COSTUME_BASE, COSTUMES, costumeAt, onSale } from "../src/costumes.ts";
import { FESTIVE_NPC, festiveAt, festiveNpcOf } from "../src/festive.ts";
import { plotId, townMap } from "../src/maps.ts";
import {
  buntingStrings,
  CRITTERS,
  critterAt,
  EASTER_TREE,
  EGGS_PER_DAY,
  eggSpots,
  FARMER_TILE,
  FLOWER_CLUMPS,
  FROKOST,
  flowerSpots,
  isPaaskeSolid,
  PAASKE_FARMER,
  STALL,
  shown,
} from "../src/paaske.ts";
import { copenhagenToMs } from "../src/sky.ts";
import { FESTIVE_THEMES, THEME_STEPS, themeOf } from "../src/themes.ts";
import { drumSteps, notes, voiceSteps } from "../src/tunes.ts";

const cph = (at: string) => copenhagenToMs(at)!;
/** Easter 2026 is 5 April: Palm Sunday 29 March, Easter Monday 6 April. */
const maps = [townMap([]), townMap([plotId(-2, 0), plotId(0, 2), plotId(1, -1)]), townMap([plotId(2, 2)])];

test("Påske runs from Palm Sunday to Easter Monday and builds to Easter Sunday noon", () => {
  expect(festiveAt(cph("2026-03-28T23:59"))).toBeNull();
  expect(festiveAt(cph("2026-03-29T00:00"))?.id).toBe("paaske");
  expect(festiveAt(cph("2026-04-06T23:59"))?.id).toBe("paaske");
  expect(festiveAt(cph("2026-04-07T00:00"))).toBeNull();
  const palm = festiveAt(cph("2026-03-29T12:00"))!.intensity;
  const friday = festiveAt(cph("2026-04-03T12:00"))!.intensity;
  const sunday = festiveAt(cph("2026-04-05T12:00"))!.intensity;
  expect(palm).toBeLessThan(friday);
  expect(friday).toBeLessThan(sunday);
  expect(sunday).toBe(1);
  // Another year: Easter 2027 is 28 March.
  expect(festiveAt(cph("2027-03-28T12:00"))?.id).toBe("paaske");
});

test("Gudrun is registered, has six to twelve lines, and stands on grass beside nothing in the way", () => {
  expect(FESTIVE_NPC.paaske).toBe(PAASKE_FARMER);
  expect(festiveNpcOf(festiveAt(cph("2026-04-04T12:00")))?.name).toBe("Farmer Gudrun");
  expect(PAASKE_FARMER.lines.length).toBeGreaterThanOrEqual(6);
  expect(PAASKE_FARMER.lines.length).toBeLessThanOrEqual(12);
  expect([PAASKE_FARMER.x, PAASKE_FARMER.y]).toEqual([FARMER_TILE.x, FARMER_TILE.y]);
  for (const map of maps) {
    expect(map.at(FARMER_TILE.x, FARMER_TILE.y)).toBe(".");
    expect(map.at(STALL.x, STALL.y)).toBe(".");
    expect(map.at(EASTER_TREE.x, EASTER_TREE.y)).toBe(":");
    for (let i = 0; i < FROKOST.w; i++) expect(map.at(FROKOST.x + i, FROKOST.y)).toBe(".");
    // Room to walk round all of it: every neighbour of the farmer except the stall is open.
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      expect(map.walkable(FARMER_TILE.x + dx, FARMER_TILE.y + dy)).toBe(true);
  }
  expect(isPaaskeSolid(FARMER_TILE.x, FARMER_TILE.y)).toBe(true);
  // Only she blocks: the stall, the tree and the table are scenery (see `isPaaskeSolid`).
  expect(isPaaskeSolid(FROKOST.x + 1, FROKOST.y)).toBe(false);
  expect(isPaaskeSolid(STALL.x, STALL.y)).toBe(false);
});

test("eight eggs a day on grass, the same for everyone, new every day, never under the scenery", () => {
  for (const map of maps) {
    const a = eggSpots(map, "2026-04-04");
    expect(a).toHaveLength(EGGS_PER_DAY);
    expect(eggSpots(map, "2026-04-04")).toEqual(a);
    expect(eggSpots(map, "2026-04-05")).not.toEqual(a);
    for (const e of a) {
      expect(map.at(e.x, e.y)).toBe(".");
      expect(isPaaskeSolid(e.x, e.y)).toBe(false);
      expect([e.x, e.y]).not.toEqual([EASTER_TREE.x, EASTER_TREE.y]);
      expect(e.colour).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(a.map((e) => `${e.x},${e.y}`)).size).toBe(a.length);
  }
});

test("the flower clumps are all on grass and come out in a fixed order", () => {
  for (const map of maps) {
    const f = flowerSpots(map);
    expect(f.length).toBe(FLOWER_CLUMPS);
    for (const s of f) expect(map.at(s.x, s.y)).toBe(".");
    expect(flowerSpots(map)).toEqual(f);
  }
  expect(shown(44, 0.2)).toBe(9);
  expect(shown(44, 1)).toBe(44);
  expect(shown(8, 0)).toBe(1);
});

test("the bunting runs between the square's lamps", () => {
  const strings = buntingStrings(maps[0]!);
  expect(strings).toHaveLength(4);
  for (const s of strings) {
    expect(maps[0]!.at(s.ax, s.ay)).toBe("L");
    expect(maps[0]!.at(s.bx, s.by)).toBe("L");
  }
});

test("lambs, bunnies and chicks start and wander on grass", () => {
  for (const c of CRITTERS) {
    for (const map of maps) expect(map.at(c.x, c.y)).toBe(".");
    for (let ms = 0; ms < 600_000; ms += 7_000) {
      const p = critterAt(c, ms);
      expect(Math.hypot(p.x - c.x, (p.y - c.y) / 0.6)).toBeLessThanOrEqual(c.r * 1.5 + 0.01);
      expect(p.hop).toBeGreaterThanOrEqual(0);
      expect(p.hop).toBeLessThanOrEqual(1);
      // Still on grass where it stands (the lawns are wide).
      expect(maps[0]!.at(Math.round(p.x), Math.round(p.y))).toBe(".");
    }
  }
});

test("the costumes sit in the reserved range, are sold round Easter and not in October", () => {
  const mine = COSTUMES.filter((c) => c.holiday === "paaske");
  expect(mine.map((c) => c.index)).toEqual([COSTUME_BASE + 60, COSTUME_BASE + 61, COSTUME_BASE + 62]);
  expect(new Set(COSTUMES.map((c) => c.id)).size).toBe(COSTUMES.length);
  expect(new Set(COSTUMES.map((c) => c.name)).size).toBe(COSTUMES.length);
  for (const c of mine) {
    expect(costumeAt("hat", c.index)).toBe(c);
    expect(onSale(c, cph("2026-03-21T12:00"))).toBe(false);
    expect(onSale(c, cph("2026-03-22T12:00"))).toBe(true);
    expect(onSale(c, cph("2026-04-07T12:00"))).toBe(true);
    expect(onSale(c, cph("2026-04-08T12:00"))).toBe(false);
    expect(onSale(c, cph("2026-10-30T12:00"))).toBe(false);
  }
  // The earlier ones are where they were.
  expect(COSTUMES[0]!.id).toBe("hat.200");
  expect(COSTUMES[1]!.id).toBe("hat.201");
});

test("the town and Tavern tracks are whole loops, and play only while Påske is on", () => {
  const { town, tavern } = FESTIVE_THEMES.paaske!;
  for (const t of [town!, tavern!]) {
    expect(voiceSteps(t.lead)).toBe(THEME_STEPS);
    expect(voiceSteps(t.bass)).toBe(THEME_STEPS);
    expect(drumSteps(t.drums)).toBe(THEME_STEPS);
    expect(notes(t.lead).length).toBeGreaterThan(20);
    expect(notes(t.bass).length).toBeGreaterThan(20);
  }
  expect(themeOf("town", "paaske").id).toBe("festive-paaske-town");
  expect(themeOf("inn", "paaske").id).toBe("festive-paaske-tavern");
  expect(themeOf("town", null).id).toBe("town");
});
