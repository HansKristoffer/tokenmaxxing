/**
 * The Night Market case: cosmetics only a case opening gives, never sold in a shop and never dropped
 * by a raid. They are worn through `Look` like the shop's, but their indices start at `CASE_BASE`, so
 * the shop and the loot can grow without the two ever meeting. The art is keyed by the same names.
 * Tradeable, with a short lock after opening (`CASE_TRADE_LOCK_MS`).
 */
import type { Rarity } from "./rarity.ts";
import type { Item } from "./shop.ts";

/** Look indices from here up, in a case slot, are case items. Above `EDITION_BASE`, which holds hats and glasses. */
export const CASE_BASE = 200;

/** A new item can't be traded for this long after it's opened. */
export const CASE_TRADE_LOCK_MS = 24 * 3_600_000;

export type CaseSlot = "outfit" | "glasses" | "hat" | "held" | "back" | "pet";

export interface CaseItem extends Item {
  slot: CaseSlot;
  rarity: Rarity;
  blurb: string;
  case: true;
}

const entry = (slot: CaseSlot, n: number, name: string, rarity: Rarity, blurb: string): CaseItem => ({
  id: `${slot}.${CASE_BASE + n}`,
  slot,
  index: CASE_BASE + n,
  name,
  price: 0,
  tradeable: true,
  rarity,
  blurb,
  case: true,
});

/** Never reorder or reuse: the ids are in bags. Add new ones at the end of their slot. */
// A catalog reads best one item a line.
// prettier-ignore
export const CASE_ITEMS: readonly CaseItem[] = [
  // Common
  entry("hat", 0, "Straw kasa", "common", "Keeps the rain off the noodles."),
  entry("hat", 1, "Hachimaki", "common", "A twisted headband for the late shift."),
  entry("hat", 2, "Paper fan visor", "common", "Folds flat. Mostly unfolds."),
  entry("held", 0, "Ramen bowl", "common", "Steam rising, chopsticks ready."),
  entry("held", 1, "Paper umbrella", "common", "Oiled paper, bamboo ribs, one good spin."),
  entry("held", 2, "Boombox", "common", "Plays whatever the night market is playing."),
  entry("held", 3, "Skateboard", "common", "For the long way round the stalls."),
  entry("glasses", 0, "LED mask", "common", "A tiny scrolling grin."),
  entry("glasses", 1, "Steam goggles", "common", "Brass rims, fogged up by the noodle cart."),
  entry("outfit", 0, "Noodle apron", "common", "Splashed at the dawn rush."),
  entry("outfit", 1, "Happi coat", "common", "The stall crew's festival coat."),
  // Uncommon
  entry("hat", 3, "Fox half-mask", "uncommon", "Half the face, all of the mystery."),
  entry("back", 0, "Neon drone", "uncommon", "Hovers over your shoulder, lights up the street."),
  entry("back", 1, "Paper lantern pack", "uncommon", "A glowing lantern on your back, swaying as you walk."),
  entry("glasses", 2, "Holo shades", "uncommon", "The night market, reflected in a hologram."),
  entry("outfit", 2, "Cargo bomber", "uncommon", "Pockets for everything you'll buy."),
  entry("outfit", 3, "Techwear coat", "uncommon", "Waterproof, zip-heavy, very black."),
  // Rare
  entry("outfit", 4, "Dragon satin jacket", "rare", "A dragon coiled up the back, stitched in gold."),
  // Epic
  entry("back", 2, "Neon rain", "epic", "A cloud of neon drizzle follows you down the street."),
  // Legendary
  entry("outfit", 5, "Festival parade", "legendary", "The whole parade, on one person, with the lanterns lit."),
];

/** The case item a look index stands for in a slot, if it is one. */
export const caseAt = (slot: string, index: number): CaseItem | undefined =>
  index >= CASE_BASE ? CASE_ITEMS.find((c) => c.slot === slot && c.index === index) : undefined;
