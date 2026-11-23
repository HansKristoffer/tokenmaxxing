/**
 * The numbers the case shop shows, worked out from the case's own data (`core/src/cases.ts`): the chance of
 * each item (its tier's chance split evenly over the tier's items, the way `rollCase` draws), and what the
 * vendor pays for the spare copies in a bag. Pure, so the screen only formats them.
 */
import type { CaseDef } from "@tokenmaxxing/core/cases.ts";
import { VENDOR_COINS } from "@tokenmaxxing/core/cases.ts";
import { RARITIES, type Rarity } from "@tokenmaxxing/core/rarity.ts";
import type { Item } from "@tokenmaxxing/core/shop.ts";

export const tierOf = (i: Item): Rarity => i.rarity ?? "common";

/** The chance of landing in each tier. A tier with no items hands its chance down to the next lower tier with items (then up), as `rollCase` does. */
export function tierChances(def: CaseDef): Record<Rarity, number> {
  const has = (i: number) => def.items.some((it) => tierOf(it) === RARITIES[i]);
  // The nearest tier below with items, else the nearest above. Past the last tier is `RARITIES.length`.
  const landingTier = (at: number) => {
    let below = at;
    while (below >= 0 && !has(below)) below--;
    if (below >= 0) return below;

    let above = at;
    while (above < RARITIES.length && !has(above)) above++;
    return above;
  };

  const out = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  // With every odd at zero the total is 1 rather than 0, so the chances come out 0 and not NaN.
  const total = RARITIES.reduce((a, r) => a + def.odds[r], 0) || 1;
  RARITIES.forEach((r, at) => {
    const rarity = RARITIES[landingTier(at)];
    if (rarity !== undefined) out[rarity] += def.odds[r] / total;
  });
  return out;
}

export interface ItemChance {
  item: Item;
  tier: Rarity;
  /** 0 to 1. */
  chance: number;
}

/** Every item of the case with its chance, rarest tier first. The chances sum to 1. */
export function itemChances(def: CaseDef): ItemChance[] {
  const tiers = tierChances(def);
  return [...RARITIES].reverse().flatMap((tier) => {
    const items = def.items.filter((i) => tierOf(i) === tier);
    return items.map((item) => ({ item, tier, chance: tiers[tier] / items.length }));
  });
}

/** A chance as a percentage: "47.5%", "1.25%", "0.5%". */
export function percent(chance: number): string {
  const p = chance * 100;
  // Big chances keep one decimal and small ones two, so both 47.5% and 1.25% read well.
  const s = p >= 10 ? p.toFixed(1) : p.toFixed(2);
  // Drops the zeros toFixed pads on: "50.0" becomes "50", "0.50" becomes "0.5".
  return `${s.replace(/\.?0+$/, "")}%`;
}

/** The spare copies of this case's items in a bag (every copy past the first of each) and what the vendor pays for them. */
export function spareCopies(
  def: CaseDef,
  bag: readonly { item: string; count: number }[],
): { copies: number; coins: number } {
  let copies = 0;
  let coins = 0;
  for (const it of def.items) {
    const owned = bag.find((b) => b.item === it.id)?.count ?? 0;
    const spare = Math.max(0, owned - 1);
    copies += spare;
    coins += spare * VENDOR_COINS[tierOf(it)];
  }
  return { copies, coins };
}
