import { describe, expect, test } from "bun:test";
import { CASES, type CaseDef, caseById, rollCase, VENDOR_COINS } from "../src/cases.ts";
import { RARITIES, type Rarity } from "../src/rarity.ts";
import type { Item } from "../src/shop.ts";

/** A small seeded generator, so the distribution test is repeatable. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const night = caseById("night-market")!;
const fake = (id: string, rarity: Rarity): Item => ({ id, slot: "hat", index: 0, name: id, price: 0, tradeable: true, rarity });
const mini = (items: Item[]): CaseDef => ({ ...night, items });
const none = new Set<string>();

describe("cases", () => {
  test("odds sum to 1, the night market exists, vendor pays by rarity", () => {
    for (const c of CASES) expect(Object.values(c.odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(night.keyPrice).toBe(75);
    expect(caseById("nope")).toBeUndefined();
    expect(VENDOR_COINS.legendary).toBe(50);
    expect(night.items.length).toBeGreaterThanOrEqual(32);
    expect(new Set(night.items.map((i) => i.id)).size).toBe(night.items.length);
    expect(night.items.every((i) => i.case)).toBe(true);
  });

  test("tier distribution over 200k rolls follows the odds", () => {
    // A pool with every tier, so nothing falls through.
    const def = mini(RARITIES.flatMap((r) => [fake(`${r}1`, r), fake(`${r}2`, r)]));
    const rand = seeded(42);
    const n = 200_000;
    const seen: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const { tier } = rollCase(def, rand, none, 0);
      seen[tier] = (seen[tier] ?? 0) + 1;
    }
    for (const r of RARITIES) expect(Math.abs((seen[r] ?? 0) / n - def.odds[r])).toBeLessThan(0.006);
  });

  test("the tenth opening is rare or better after nine dry ones, whatever the dice say", () => {
    const def = mini(RARITIES.flatMap((r) => [fake(`${r}1`, r)]));
    const low = () => 0; // always common when unguaranteed
    expect(rollCase(def, low, none, 8).tier).toBe("common");
    expect(rollCase(def, low, none, 9).tier).toBe("rare");
    // Over a long run with a counter, no 10 in a row below rare.
    const rand = seeded(7);
    let dry = 0;
    let worst = 0;
    for (let i = 0; i < 50_000; i++) {
      const { tier } = rollCase(def, rand, none, dry);
      dry = RARITIES.indexOf(tier) >= 2 ? 0 : dry + 1;
      worst = Math.max(worst, dry);
    }
    expect(worst).toBeLessThanOrEqual(9);
  });

  test("a dupe is drawn again once, within its tier", () => {
    const def = mini([fake("a", "common"), fake("b", "common"), fake("c", "rare")]);
    const owned = new Set(["a"]);
    // First draw 0 -> a (owned), second 0.9 -> b.
    const seq = [0, 0, 0.9];
    expect(rollCase(def, () => seq.shift() ?? 0, owned, 0).item.id).toBe("b");
    // Both draws land on the owned one: it stays (one reroll only).
    const same = [0, 0, 0];
    expect(rollCase(def, () => same.shift() ?? 0, owned, 0).item.id).toBe("a");
    // Never leaves the tier.
    for (let i = 0; i < 100; i++) {
      const r = rollCase(def, seeded(i), new Set(["a", "b"]), 0);
      expect(r.item.rarity).toBe(r.tier);
    }
  });

  test("an empty tier falls to the next lower one with items", () => {
    const def = mini([fake("a", "common"), fake("r", "rare")]);
    // legendary roll (0.99) with no legendary, epic or uncommon items: lands on rare.
    expect(rollCase(def, () => 0.99, none, 0)).toMatchObject({ tier: "rare" });
    // uncommon roll (0.6) falls to common.
    const seq = [0.6, 0];
    expect(rollCase(def, () => seq.shift() ?? 0, none, 0).tier).toBe("common");
    // Nothing below common: goes up.
    const up = mini([fake("r", "rare")]);
    expect(rollCase(up, () => 0, none, 0).tier).toBe("rare");
  });
});
