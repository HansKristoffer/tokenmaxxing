import { expect, test } from "bun:test";
import { PRESTIGE_TRACKS, runLevelCoins } from "@tokenmaxxing/core/prestige.ts";
import { NO_PRESTIGE, runCoinsPaid } from "@tokenmaxxing/core/prestige-run.ts";
import {
  badgeOf,
  cardPrestige,
  coinSchedule,
  rewardPlan,
  runLine,
  runShare,
  runToasts,
} from "../src/hud/prestige-view.ts";

test("a payload without a badge, or with junk, is no prestige", () => {
  expect(badgeOf(undefined)).toBe(NO_PRESTIGE);
  expect(badgeOf({})).toBe(NO_PRESTIGE);
  expect(badgeOf({ prestige: { rank: "x" } })).toBe(NO_PRESTIGE);
  expect(badgeOf({ prestige: { rank: 2, runLevel: 99 } })).toEqual({ rank: 2, runLevel: 50 });
  expect(badgeOf({ prestige: { rank: 2, runLevel: 12 } })).toEqual({ rank: 2, runLevel: 12 });
});

test("the button shows at the cap of the first journey or a run, never mid-run or past the last track", () => {
  expect(cardPrestige(49, NO_PRESTIGE)).toEqual({ can: false, midRun: false, next: 1 });
  expect(cardPrestige(50, NO_PRESTIGE).can).toBe(true);
  expect(cardPrestige(50, { rank: 2, runLevel: 12 })).toEqual({ can: false, midRun: true, next: 3 });
  expect(cardPrestige(50, { rank: 2, runLevel: 50 }).can).toBe(true);
  expect(cardPrestige(50, { rank: PRESTIGE_TRACKS.length, runLevel: 50 }).can).toBe(false);
});

test("the run line and bar", () => {
  expect(runLine({ rank: 2, runLevel: 12 })).toBe("Prestige II · Cosmic — run level 12/50");
  expect(runLine(NO_PRESTIGE)).toBe("");
  expect(runShare(25)).toBe(0.5);
  expect(runShare(80)).toBe(1);
});

test("every track plans its six rewards in unlock order, with art for the wearables", () => {
  for (const t of PRESTIGE_TRACKS) {
    const plan = rewardPlan(t);
    expect(plan.map((r) => r.level)).toEqual([10, 20, 30, 40, 50, 50]);
    expect(plan.map((r) => r.kind)).toEqual(["hat", "outfit", "petwear", "back", "aura", "trophy"]);
    for (const r of plan) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(Boolean(r.item)).toBe(r.kind !== "petwear" && r.kind !== "trophy");
    }
  }
});

test("the coin schedule adds up to the 2,200 a run", () => {
  expect(coinSchedule()).toEqual([
    { level: 10, coins: 100 },
    { level: 20, coins: 200 },
    { level: 30, coins: 300 },
    { level: 40, coins: 400 },
    { level: 50, coins: 750 },
  ]);
  expect(runCoinsPaid(50)).toBe(2200);
  expect(runLevelCoins(11)).toBe(10);
});

test("toasts: entering gives the tag, a level its coins, a milestone its unlocks", () => {
  expect(runToasts(2, -1, 0).map((t) => t.key)).toEqual(["tag"]);
  expect(runToasts(2, 11, 12)[0]!.text).toBe("⬆️ Run level 12 · 🪙 10");
  const ten = runToasts(2, 9, 10);
  expect(ten.map((t) => t.key)).toEqual(["level", "hat"]);
  expect(ten[0]!.text).toContain("🪙 100");
  expect(ten[1]!.text).toContain("Starfield crown");
  expect(runToasts(2, 49, 50).map((t) => t.key)).toEqual(["level", "aura", "trophy"]);
  expect(runToasts(2, 12, 12)).toEqual([]);
  expect(runToasts(0, 0, 5)).toEqual([]);
});
