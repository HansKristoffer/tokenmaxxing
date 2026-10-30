import { describe, expect, test } from "bun:test";
import { COSTUME_BASE, COSTUMES, costumeAt, onSale } from "../src/costumes.ts";
import { FESTIVE_NPC } from "../src/festive.ts";
import { townMap } from "../src/maps.ts";
import {
  BALTALER,
  BALTALER_TILE,
  blanketCount,
  blanketSpots,
  flagCount,
  flagSpots,
  MIDSOMMER_HATS,
  wormAt,
  wreathDoors,
} from "../src/midsommer.ts";
import { BONFIRE } from "../src/sankthans.ts";
import { copenhagenToMs } from "../src/sky.ts";
import { FESTIVE_THEMES } from "../src/themes.ts";

const town = townMap([]);
const grassy = (x: number, y: number) => [".", '"'].includes(town.at(x, y));

describe("Sankt Hans scenery", () => {
  test("poles, blankets and the speaker stand on grass, off the bonfire", () => {
    const onFire = (x: number, y: number) => y === BONFIRE.y && x >= BONFIRE.x && x < BONFIRE.x + BONFIRE.w;
    expect(flagSpots(town).length).toBe(6);
    for (const [x, y] of flagSpots(town)) expect(onFire(x, y)).toBe(false);
    expect(blanketSpots(town).length).toBe(3);
    for (const [x, y] of blanketSpots(town)) {
      expect(grassy(x, y) && grassy(x + 1, y)).toBe(true);
      expect(onFire(x, y) || onFire(x + 1, y)).toBe(false);
    }
    expect(grassy(BALTALER_TILE.x, BALTALER_TILE.y)).toBe(true);
    expect(
      blanketSpots(town).some(([x, y]) => y === BALTALER_TILE.y && [x, x + 1].includes(BALTALER_TILE.x)),
    ).toBe(false);
    expect(wreathDoors(town).length).toBeGreaterThan(2);
  });

  test("more shows as the 23rd comes on, never fewer", () => {
    let flags = 0;
    let blankets = 0;
    for (let k = 0.4; k <= 1; k += 0.05) {
      expect(flagCount(k)).toBeGreaterThanOrEqual(flags);
      expect(blanketCount(k)).toBeGreaterThanOrEqual(blankets);
      flags = flagCount(k);
      blankets = blanketCount(k);
    }
    expect(flagCount(1)).toBe(6);
  });

  test("a glow-worm stays over the lawn and blinks between 0 and 1", () => {
    for (let i = 0; i < 20; i++)
      for (let t = 0; t < 60; t += 3) {
        const [x, y, blink] = wormAt(i, t);
        expect(x).toBeGreaterThan(-1);
        expect(x).toBeLessThan(16);
        expect(y).toBeGreaterThan(8);
        expect(y).toBeLessThan(20);
        expect(blink).toBeGreaterThanOrEqual(0);
        expect(blink).toBeLessThanOrEqual(1);
      }
  });
});

describe("Sankt Hans NPC, music and hats", () => {
  test("the båltaler is registered, talks, and has a tile of her own", () => {
    expect(FESTIVE_NPC.sanktHans).toBe(BALTALER);
    expect(BALTALER.lines.length).toBeGreaterThanOrEqual(6);
    expect(BALTALER.lines.length).toBeLessThanOrEqual(12);
    const taken = Object.values(FESTIVE_NPC).filter((n) => n && n.x === BALTALER.x && n.y === BALTALER.y);
    expect(taken.length).toBe(1);
  });

  test("the music is registered for the town and the Tavern", () => {
    const tracks = FESTIVE_THEMES.sanktHans!;
    expect(tracks.town?.id).toBe("festive-sanktHans-town");
    expect(tracks.tavern?.id).toBe("festive-sanktHans-tavern");
  });

  test("three hats at 250 to 252, sold round Sankt Hans only", () => {
    expect(MIDSOMMER_HATS.length).toBe(3);
    for (const [i, name] of MIDSOMMER_HATS.entries()) {
      const c = costumeAt("hat", COSTUME_BASE + 50 + i)!;
      expect(c.name).toBe(name);
      expect(c.holiday).toBe("sanktHans");
      expect(COSTUMES.filter((x) => x.index === c.index).length).toBe(1);
      expect(onSale(c, copenhagenToMs("2026-06-23T12:00")!)).toBe(true);
      expect(onSale(c, copenhagenToMs("2026-06-05T12:00")!)).toBe(false);
      expect(onSale(c, copenhagenToMs("2026-06-26T12:00")!)).toBe(false);
    }
  });
});
