import { expect, test } from "bun:test";
import { caseAt } from "../src/case.ts";
import {
  PRESTIGE_BASE,
  PRESTIGE_ITEMS,
  PRESTIGE_TRACKS,
  RUN_LEVELS,
  RUN_LEVEL_COINS,
  prestigeTag,
  runLevelCoins,
  trackAt,
} from "../src/prestige.ts";

test("five tracks, four wearables each, at 700 up, never sold or traded", () => {
  expect(PRESTIGE_TRACKS).toHaveLength(5);
  expect(PRESTIGE_ITEMS).toHaveLength(20);
  for (const slot of ["hat", "outfit", "back", "aura"]) {
    const at = PRESTIGE_ITEMS.filter((i) => i.slot === slot).map((i) => i.index);
    expect(at).toEqual([0, 1, 2, 3, 4].map((n) => PRESTIGE_BASE + n));
  }
  for (const i of PRESTIGE_ITEMS) {
    expect(i.price).toBe(0);
    expect(i.tradeable).toBe(false);
    expect(caseAt(i.slot, i.index)).toBe(i);
  }
  expect(new Set(PRESTIGE_ITEMS.map((i) => i.name)).size).toBe(20);
  expect(trackAt(PRESTIGE_BASE + 2)?.name).toBe("Voidwalker");
  expect(trackAt(PRESTIGE_BASE + 5)).toBeUndefined();
});

test("a completed run pays 2,200 coins and the tag names the track", () => {
  let coins = 0;
  for (let l = 1; l <= RUN_LEVELS; l++) coins += runLevelCoins(l);
  expect(coins).toBe(2200);
  expect(runLevelCoins(7)).toBe(RUN_LEVEL_COINS);
  expect(prestigeTag(5)).toBe("Prestige V · Prismatic");
  expect(prestigeTag(6)).toBe("");
});
