/**
 * The wardrobe: a big pack of clothes, things to hold, things on your back, and gear for your pet.
 * Each one is an `Item` like the rest of the shop (same ids, same bag, same trades), with a rarity and
 * a line of flavour. Most are sold; the rarest few are level rewards, so you can only earn them.
 * Indices are stored in looks and bags: add to the end, never reorder.
 */
import type { Rarity } from "./rarity.ts";
import type { Item } from "./shop.ts";

/** Slots only the wardrobe fills: in a hand, on the back, on the pet. 0 is none, like glasses. */
export type WardrobeSlot = "held" | "back" | "petwear";

interface Entry {
  slot: "outfit" | WardrobeSlot;
  index: number;
  name: string;
  rarity: Rarity;
  blurb: string;
  /** Sold for this; or, with `level`, granted then and never sold. */
  price: number;
  level?: number;
}

const sold = (
  slot: Entry["slot"],
  index: number,
  name: string,
  rarity: Rarity,
  price: number,
  blurb: string,
): Entry => ({ slot, index, name, rarity, price, blurb });
const earned = (
  slot: Entry["slot"],
  index: number,
  name: string,
  rarity: Rarity,
  level: number,
  blurb: string,
): Entry => ({ slot, index, name, rarity, price: 0, level, blurb });

// Prices: a heavy day earns ~30 coins, so a common is a few days, an epic a month.
const ENTRIES: readonly Entry[] = [
  // Outfits, after the shop's 8–12.
  sold(
    "outfit",
    13,
    "Hoodie of infinite context",
    "epic",
    700,
    "Never forgets. Never compacts. Slightly warm.",
  ),
  sold(
    "outfit",
    14,
    "Rain jacket (Copenhagen edition)",
    "common",
    160,
    "Rated for horizontal rain and bike lanes.",
  ),
  sold("outfit", 15, "Lab coat", "common", 140, "For running experiments in prod."),
  sold("outfit", 16, "Flannel shirt", "common", 110, "Standard issue for a Rust rewrite."),
  sold("outfit", 17, "Founder vest", "rare", 260, "Pockets for a term sheet and a protein bar."),
  sold("outfit", 18, "Merge-conflict sweater", "rare", 240, "<<<<<<< HEAD knitted on the front."),
  sold("outfit", 19, "Tuxedo", "rare", 420, "For the launch party and the post-mortem."),
  sold("outfit", 20, "Space suit", "epic", 850, "Pressurised for zero-latency environments."),
  sold("outfit", 21, "Retro tracksuit", "common", 150, "Three stripes, zero sprints."),
  sold("outfit", 22, "Denim overalls", "common", 130, "Built to ship. Also to farm."),
  sold("outfit", 23, "Prompt wizard robe", "epic", 950, "Stars stitched by a temperature of 1.0."),
  sold("outfit", 24, "Hazard vest", "common", 90, "Worn when touching the billing code."),
  // In your hand.
  sold("held", 1, "Coffee mug", "common", 60, "World's okayest engineer."),
  earned("held", 2, "Rubber duck", "rare", 5, "Listens to every bug. Judges none."),
  sold("held", 3, "Laptop with stickers", "rare", 320, "Resale value: zero. Vibes: immaculate."),
  sold("held", 4, "Bubble tea", "common", 80, "Tapioca-driven development."),
  sold("held", 5, "Mechanical keyboard", "rare", 220, "Clicky. Your neighbours know."),
  sold("held", 6, "Pizza slice", "common", 70, "The fuel of every hackathon."),
  sold("held", 7, "Energy drink", "common", 60, "Tastes like a 3 a.m. deploy."),
  sold("held", 8, "Magnifying glass", "rare", 200, "For finding the missing semicolon."),
  sold("held", 9, "Fire extinguisher", "epic", 500, "Point at prod. Squeeze."),
  sold("held", 10, "Baguette", "common", 90, "Long-context bread."),
  // On your back.
  earned("back", 1, "Cape", "epic", 15, "Not all heroes write tests."),
  earned("back", 2, "Jetpack", "legendary", 25, "Ship faster. Literally."),
  sold("back", 3, "Backpack", "common", 120, "Charger, snacks, and one mystery cable."),
  sold("back", 4, "Pixel wings", "legendary", 1800, "Eight bits of pure ascension."),
  sold("back", 5, "Guitar", "rare", 350, "Knows one song, and it's Wonderwall."),
  sold("back", 6, "Yoga mat", "common", 100, "Downward-facing debugger."),
  sold("back", 7, "Katana", "epic", 650, "Cuts scope cleanly."),
  // On your pet.
  sold("petwear", 1, "Red bandana", "common", 60, "Very good dog energy, any species."),
  sold("petwear", 2, "Pink bow", "common", 60, "Adorable, and it knows it."),
  sold("petwear", 3, "Bow tie", "rare", 140, "For pets who attend standups."),
  sold("petwear", 4, "Party hat", "rare", 160, "Every merge is a birthday."),
  sold("petwear", 5, "Gold collar", "epic", 450, "The tag says: 10x pet."),
  sold("petwear", 6, "Propeller cap", "rare", 200, "Spins up when it's thinking."),
  sold("petwear", 7, "Winter scarf", "common", 90, "Hygge, for the small ones."),
];

/** How many indices each slot has, none (0) included: for `LOOK_OPTIONS`. */
const count = (slot: Entry["slot"]) =>
  Math.max(0, ...ENTRIES.filter((e) => e.slot === slot).map((e) => e.index)) + 1;
export const WARDROBE_OPTIONS = {
  outfit: count("outfit"),
  held: count("held"),
  back: count("back"),
  petwear: count("petwear"),
};

/** The wardrobe as shop items. */
export const WARDROBE: readonly Item[] = ENTRIES.map((e) => ({
  id: `${e.slot}.${e.index}`,
  slot: e.slot,
  index: e.index,
  name: e.name,
  price: e.price,
  ...(e.level !== undefined && { level: e.level }),
  tradeable: e.level === undefined,
  rarity: e.rarity,
  blurb: e.blurb,
}));
