import { RARITIES, rarityOf } from "@tokenmaxxing/core/rarity.ts";
import { type Item, itemById } from "@tokenmaxxing/core/shop.ts";
import type { BagRow } from "@tokenmaxxing/server/registry";

/** The Bag's headings, in the order they are shown. */
export const BAG_GROUPS = [
  ["outfit", "Outfits"],
  ["face", "Glasses & hats"],
  ["carry", "Held & back items"],
  ["pets", "Pets & pet gear"],
  ["furniture", "Furniture"],
  ["rewards", "Loot & rewards"],
  ["merch", "Merch & editions"],
  ["other", "Other"],
] as const;

export type BagGroupId = (typeof BAG_GROUPS)[number][0];

export interface BagEntry {
  row: BagRow;
  /** Undefined for a kind the catalog no longer knows (it lands in "Other"). */
  item: Item | undefined;
}

export interface BagGroup {
  id: BagGroupId;
  title: string;
  entries: BagEntry[];
  /** How many things (copies) are in the group, not how many kinds. */
  count: number;
}

/** Which heading an item sits under, from its slot and flags: loot and level rewards first, then merch, then the slot. */
export function groupOf(item: Item | undefined): BagGroupId {
  if (!item) return "other";
  if (item.loot || item.level !== undefined) return "rewards";
  switch (item.slot) {
    case "merch":
      return "merch";
    case "outfit":
      return "outfit";
    case "glasses":
    case "hat":
      return "face";
    case "held":
    case "back":
      return "carry";
    case "pet":
    case "petwear":
      return "pets";
    case "furniture":
      return "furniture";
    default:
      return "other";
  }
}

/**
 * The bag's rows under their headings, in a fixed order; a heading with nothing under it is left out.
 * Within one: what I'm wearing first, then rarest first, then by name.
 */
export function groupBag(
  rows: readonly BagRow[],
  isWorn: (item: Item) => boolean = () => false,
  nameOf: (item: Item) => string = (item) => item.name,
): BagGroup[] {
  const rank = (item: Item | undefined) => (item ? RARITIES.indexOf(rarityOf(item)) : -1);
  const by = new Map<BagGroupId, BagEntry[]>();
  for (const row of rows) {
    const item = itemById(row.item);
    const id = groupOf(item);
    by.set(id, [...(by.get(id) ?? []), { row, item }]);
  }
  return BAG_GROUPS.flatMap(([id, title]) => {
    const entries = by.get(id);
    if (!entries) return [];
    const worn = (e: BagEntry) => (e.item && isWorn(e.item) ? 0 : 1);
    const name = (e: BagEntry) => (e.item ? nameOf(e.item) : e.row.item);
    entries.sort(
      (a, b) => worn(a) - worn(b) || rank(b.item) - rank(a.item) || name(a).localeCompare(name(b)) || 0,
    );
    return [{ id, title, entries, count: entries.reduce((n, e) => n + e.row.count, 0) }];
  });
}
