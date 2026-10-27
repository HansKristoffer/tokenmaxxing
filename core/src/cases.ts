/**
 * Cases: a key's worth of coins for one random item from a fixed pool. The server rolls (never the
 * client) and grants the item; this file is the data and the pure roll. Everything is keyed by case id,
 * so a later case is one more `CaseDef`.
 */
import { CASE_ITEMS } from "./case.ts";
import { CASE_PIECES } from "./case-furniture.ts";
import { RARITIES, type Rarity } from "./rarity.ts";
import { type Item, itemById } from "./shop.ts";

/** The building where cases are sold (registered in `shoprooms.ts`). */
export const CASE_SHOP_ID = "natmarked";

export interface CaseDef {
  id: string;
  name: string;
  blurb: string;
  /** Coins for one opening. */
  keyPrice: number;
  /** Chance of each tier; sums to 1. */
  odds: Record<Rarity, number>;
  /** Every this-many openings has at least a rare: `rareWithin - 1` in a row below rare make the next one rare or better. */
  rareWithin: number;
  /** Times a roll that lands on something you own is drawn again within its tier. */
  dupeRerolls: number;
  items: readonly Item[];
}

/** What the vendor pays for one case item, by rarity. */
export const VENDOR_COINS: Record<Rarity, number> = {
  common: 10,
  uncommon: 20,
  rare: 30,
  epic: 40,
  legendary: 50,
};

const poolItems = (ids: readonly string[]): Item[] =>
  ids.map((id) => itemById(id)).filter((i): i is Item => i !== undefined);

export const CASES: readonly CaseDef[] = [
  {
    id: "night-market",
    name: "Night Market case",
    blurb: "Hats, pets, outfits and lanterns from the stalls after dark.",
    keyPrice: 75,
    odds: { common: 0.475, uncommon: 0.25, rare: 0.15, epic: 0.1, legendary: 0.025 },
    rareWithin: 10,
    dupeRerolls: 1,
    items: poolItems([...CASE_ITEMS.map((i) => i.id), ...CASE_PIECES.map((p) => `furn.${p.ch}`)]),
  },
];

export const caseById = (id: unknown): CaseDef | undefined => CASES.find((c) => c.id === id);

/** The case a rarity-bearing item belongs to, if any. */
export const caseOfItem = (itemId: string): CaseDef | undefined =>
  CASES.find((c) => c.items.some((i) => i.id === itemId));

const tierOf = (i: Item): Rarity => i.rarity ?? "common";

/** Whether a tier counts as a hit for the guarantee: rare or better. */
export const isHit = (tier: Rarity): boolean => RARITIES.indexOf(tier) >= RARITIES.indexOf("rare");

/** The `dry` counter after an opening that landed on `tier`. */
export const nextDry = (dry: number, tier: Rarity): number => (isHit(tier) ? 0 : dry + 1);

/**
 * One opening. `rand` is uniform in [0, 1); `owned` the item ids held; `dry` how many openings in a
 * row gave less than rare. Tier by `odds` (rare or better, renormalised, once `dry` reaches
 * `rareWithin - 1`); an empty tier falls to the next lower tier with items (then up, if none below);
 * a landing on an owned item is drawn again within the tier, `dupeRerolls` times.
 */
export function rollCase(
  def: CaseDef,
  rand: () => number,
  owned: ReadonlySet<string>,
  dry: number,
): { item: Item; tier: Rarity } {
  const guaranteed = dry >= def.rareWithin - 1;
  const weights = RARITIES.map((r) => (guaranteed && !isHit(r) ? 0 : def.odds[r]));
  let x = rand() * weights.reduce((a, b) => a + b, 0);
  let at = weights.findIndex((w) => {
    x -= w;
    return x < 0;
  });
  if (at < 0) at = weights.findLastIndex((w) => w > 0);
  const has = (i: number) => def.items.some((it) => tierOf(it) === RARITIES[i]);
  // Down first, then up.
  let tierAt = at;
  while (tierAt >= 0 && !has(tierAt)) tierAt--;
  if (tierAt < 0) {
    tierAt = at;
    while (tierAt < RARITIES.length && !has(tierAt)) tierAt++;
  }
  const tier = RARITIES[tierAt]!;
  const pool = def.items.filter((it) => tierOf(it) === tier);
  const draw = () => pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!;
  let item = draw();
  for (let n = 0; n < def.dupeRerolls && owned.has(item.id); n++) item = draw();
  return { item, tier };
}
