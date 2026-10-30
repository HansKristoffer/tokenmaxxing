import { describe, expect, test } from "bun:test";
import {
  CANDLE_SLOTS,
  FLAGPOLES,
  HENNING,
  inMemorial,
  isBefrielsenSolid,
  MAX_MINE,
  MEMORIAL,
  townCandles,
} from "../src/befrielsen.ts";
import { BEFRIELSEN_TAVERN, BEFRIELSEN_TOWN } from "../src/befrielsen-music.ts";
import { COSTUME_BASE, COSTUMES, costumeAt, onSale } from "../src/costumes.ts";
import { FESTIVE_NPC, festiveAt } from "../src/festive.ts";
import { MAPS } from "../src/maps.ts";
import { copenhagenToMs } from "../src/sky.ts";
import { FESTIVE_THEMES, THEME_STEPS } from "../src/themes.ts";
import { drumSteps, notes, voiceSteps } from "../src/tunes.ts";

const at = (iso: string) => copenhagenToMs(iso)!;

describe("befrielsen", () => {
  test("the window is 4 and 5 May, with candles by the evening", () => {
    expect(festiveAt(at("2026-05-03T23:00"))).toBeNull();
    expect(festiveAt(at("2026-05-04T10:00"))?.id).toBe("befrielsen");
    expect(festiveAt(at("2026-05-05T20:00"))?.id).toBe("befrielsen");
    expect(festiveAt(at("2026-05-06T08:00"))).toBeNull();
    const early = festiveAt(at("2026-05-04T08:00"))!.intensity;
    const evening = festiveAt(at("2026-05-04T21:30"))!.intensity;
    expect(evening).toBeGreaterThan(early);
    expect(evening).toBe(1);
  });

  test("the tray fills with the evening and leaves room for four of your own", () => {
    expect(townCandles(0.5)).toBeLessThan(townCandles(1));
    expect(townCandles(1) + MAX_MINE).toBeLessThanOrEqual(CANDLE_SLOTS);
    expect(townCandles(0)).toBeGreaterThan(0);
  });

  test("Henning is registered, stands apart from the memorial, and has 6-12 lines", () => {
    expect(FESTIVE_NPC.befrielsen).toBe(HENNING);
    expect(HENNING.lines.length).toBeGreaterThanOrEqual(6);
    expect(HENNING.lines.length).toBeLessThanOrEqual(12);
    expect(inMemorial(HENNING.x, HENNING.y)).toBe(false);
    expect(isBefrielsenSolid(HENNING.x, HENNING.y)).toBe(true);
  });

  test("everything stands on the square's paving, off its race edge and path, on free tiles", () => {
    const town = MAPS.town;
    const tiles: [number, number][] = [
      [HENNING.x, HENNING.y],
      ...FLAGPOLES.map((p) => [p.x, p.y] as [number, number]),
    ];
    for (let y = MEMORIAL.y; y < MEMORIAL.y + MEMORIAL.h; y++)
      for (let x = MEMORIAL.x; x < MEMORIAL.x + MEMORIAL.w; x++) tiles.push([x, y]);
    for (const [x, y] of tiles) {
      expect(town.walkable(x, y)).toBe(true);
      expect(town.at(x, y)).toBe(":");
      // The sprint race runs round the paving's edge (`PLAZA` in maps.ts).
      expect(x > 1 && x < 19 && y > 1 && y < 8).toBe(true);
    }
    expect(new Set(tiles.map(([x, y]) => `${x},${y}`)).size).toBe(tiles.length);
  });

  test("the hats are sold round 4 May, ids in the reserved range", () => {
    const mine = COSTUMES.filter((c) => c.holiday === "befrielsen");
    expect(mine.map((c) => c.index - COSTUME_BASE)).toEqual([65, 66]);
    for (const c of mine) {
      expect(costumeAt("hat", c.index)).toBe(c);
      expect(onSale(c, at("2026-04-25T12:00"))).toBe(true);
      expect(onSale(c, at("2026-05-06T12:00"))).toBe(true);
      expect(onSale(c, at("2026-06-20T12:00"))).toBe(false);
    }
    expect(new Set(COSTUMES.map((c) => c.index)).size).toBe(COSTUMES.length);
  });

  test("the music is registered and a whole loop", () => {
    expect(FESTIVE_THEMES.befrielsen).toEqual({ town: BEFRIELSEN_TOWN, tavern: BEFRIELSEN_TAVERN });
    for (const t of [BEFRIELSEN_TOWN, BEFRIELSEN_TAVERN]) {
      expect(voiceSteps(t.lead)).toBe(THEME_STEPS);
      expect(voiceSteps(t.bass)).toBe(THEME_STEPS);
      expect(drumSteps(t.drums)).toBe(THEME_STEPS);
      expect(() => notes(t.lead)).not.toThrow();
      expect(() => notes(t.bass)).not.toThrow();
    }
  });
});
