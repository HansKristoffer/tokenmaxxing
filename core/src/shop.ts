/**
 * Coins and the shop. Coins come from using AI (per world day, square-rooted so
 * a heavy day earns more but not wildly more) and from finishing a day in the
 * top 3. They buy clothes, glasses, hats and pets, worn through `Look`, and
 * furniture for your office (`office.ts`). Everything bought or earned is a row in the bag.
 */
import { isRecord } from "hanzio";
import { EDITIONS } from "./editions.ts";
import { HEADWEAR_ITEMS } from "./headwear.ts";
import { HOME_PIECES } from "./home.ts";
import { LOOT, type Rarity as LootRarity } from "./loot.ts";
import { COMPANY_FURNITURE, FURNITURE } from "./office.ts";
import type { Rarity } from "./rarity.ts";
import { WARDROBE, type WardrobeSlot } from "./wardrobe.ts";
import type { Look } from "./world.ts";

/**
 * Coins for one day's tokens. Real days from the leaderboard: 1.5B tokens
 * earns 38, 600M earns 24, 120M earns 10, 10M earns 3.
 */
export const coinsForTokens = (tokens: number): number => Math.floor(Math.sqrt(Math.max(0, tokens) / 1e6));

/** Extra coins for finishing a world day 1st, 2nd or 3rd on tokens. */
export const PODIUM_COINS = [25, 15, 10] as const;

type Slot = "outfit" | "glasses" | "hat" | "pet" | WardrobeSlot;

export interface Item {
  /** `<slot>.<index>`, e.g. `pet.2`, `furn.<ch>` for furniture, or `merch.<companyId>.<kind>`. */
  id: string;
  slot: Slot | "furniture" | "merch";
  /** The value of `look[slot]` when worn; furniture's place in `PIECES` (office.ts) or `COMPANY_FURNITURE`; merch's bit in `merchWorn`. */
  index: number;
  name: string;
  price: number;
  /** Granted at this level; never sold. */
  level?: number;
  /** Can change hands. Rewards, merch and company furniture can't. */
  tradeable: boolean;
  /** Without one, `rarityOf` goes by price. */
  rarity?: Rarity;
  /** One line of flavour, under the name. */
  blurb?: string;
  /** How it's earned, for what the shop never sells and nobody can buy (`Piece.earned`). */
  earned?: string;
  /** Raid loot: which boss drops it, and how rarely (`loot.ts`). Never sold. */
  loot?: { boss: string; rarity: LootRarity };
  /** Company furniture: bought from a company wallet, for its building. */
  company?: true;
  /** Personal-office furniture: it goes down only in your own office (`canDropIn`). */
  home?: true;
  /** Merch: whose. */
  companyId?: number;
}

/** Outfits below this are free; the ones after are sold. */
export const FREE_OUTFITS = 8;

const item = (slot: Slot, index: number, name: string, price: number): Item => ({
  id: `${slot}.${index}`,
  slot,
  index,
  name,
  price,
  tradeable: true,
});
const reward = (slot: Slot, index: number, name: string, level: number): Item => ({
  ...item(slot, index, name, 0),
  level,
  tradeable: false,
});

export const ITEMS: readonly Item[] = [
  item("outfit", 8, "Hacker hoodie", 150),
  item("outfit", 9, "Sharp suit", 250),
  item("outfit", 10, "Galaxy jacket", 350),
  item("outfit", 11, "Gold suit", 600),
  item("glasses", 1, "Nerd specs", 60),
  item("glasses", 2, "Shades", 100),
  item("glasses", 3, "Heart glasses", 150),
  item("hat", 1, "Beanie", 100),
  item("hat", 2, "Headphones", 180),
  item("hat", 3, "Crown", 500),
  item("pet", 1, "Duck", 250),
  item("pet", 2, "Cat", 400),
  item("pet", 3, "Dog", 400),
  item("pet", 4, "Dragon", 1500),
  item("pet", 5, "Panda", 800),
  reward("hat", 4, "Top hat", 10),
  reward("outfit", 12, "Server-rack armour", 20),
  reward("pet", 6, "Singularity orb", 30),
  ...HEADWEAR_ITEMS,
  // Sold only off the traveling merchant's cart (`merchant.ts`).
  ...EDITIONS,
  ...WARDROBE,
  ...FURNITURE.map((f, index): Item => ({
    id: `furn.${f.ch}`,
    slot: "furniture",
    index,
    name: f.name,
    price: f.price,
    tradeable: !f.earned,
    ...(f.earned && { earned: f.earned }),
  })),
  // For personal offices only (`home.ts`): bought with coins, put down only in your own office.
  ...HOME_PIECES.map((f, index): Item => ({
    id: `furn.${f.ch}`,
    slot: "furniture",
    index,
    name: f.name,
    price: f.price,
    tradeable: true,
    home: true,
  })),
  // Raid loot: dropped by the bosses, never sold, and tradeable.
  ...LOOT.map((l): Item => ({
    id: l.id,
    slot: l.slot,
    index: l.index,
    name: l.name,
    price: 0,
    tradeable: true,
    rarity: l.rarity,
    blurb: l.blurb,
    loot: { boss: l.boss, rarity: l.rarity },
  })),
  ...COMPANY_FURNITURE.map((f, index): Item => ({
    id: `furn.${f.ch}`,
    slot: "furniture",
    index,
    name: f.name,
    price: f.price,
    tradeable: false,
    company: true,
  })),
];

/** The level items `level` has earned. */
export const levelItems = (level: number): Item[] =>
  ITEMS.filter((i) => i.level !== undefined && i.level <= level);

/**
 * Items by id, and by what a look's slot holds (with their place in `ITEMS`): the client asks for every
 * avatar, every frame.
 */
const BY_ID = new Map<string, Item>();
const BY_SLOT = new Map<Slot, Map<number, { item: Item & { slot: Slot }; at: number }>>();
ITEMS.forEach((item, at) => {
  if (!BY_ID.has(item.id)) BY_ID.set(item.id, item);
  if (item.slot === "furniture" || item.slot === "merch") return;
  const values = BY_SLOT.get(item.slot) ?? new Map();
  BY_SLOT.set(item.slot, values);
  if (!values.has(item.index)) values.set(item.index, { item: item as Item & { slot: Slot }, at });
});

export const itemById = (id: unknown): Item | undefined => BY_ID.get(id as string) ?? merchItem(id);

/** The shop items a look wears, in `ITEMS` order; everything else in it is free (merch is `merchIn`). */
export function itemsIn(look: Look): (Item & { slot: Slot })[] {
  const worn: { item: Item & { slot: Slot }; at: number }[] = [];
  for (const [slot, values] of BY_SLOT) {
    const w = values.get(look[slot]);
    if (w) worn.push(w);
  }
  return worn.sort((a, b) => a.at - b.at).map((w) => w.item);
}

// MARK: Merch

/**
 * Every company's merch, in its colours with its initials: sold to anyone, and what outsiders pay goes
 * into the company wallet. Worn through `look.merch` (whose) and `look.merchWorn` (these bits); a
 * hoodie goes over a tee.
 */
export const MERCH = [
  { kind: "tee", name: "Tee", price: 80, bit: 1 },
  { kind: "hoodie", name: "Hoodie", price: 160, bit: 2 },
  { kind: "cap", name: "Cap", price: 60, bit: 4 },
  { kind: "mug", name: "Mug", price: 40, bit: 8 },
] as const;
export type MerchKind = (typeof MERCH)[number]["kind"];

/** What a company's own people get off its merch: 1.0 is free, 0.8 is 80% off. */
export const EMPLOYEE_MERCH_DISCOUNT = 1.0;

/** What one of `kind` costs: the full price, or for the company's own people, less the discount. */
export function merchPrice(kind: MerchKind, employee: boolean): number {
  const price = MERCH.find((m) => m.kind === kind)!.price;
  return employee ? Math.round(price * (1 - EMPLOYEE_MERCH_DISCOUNT)) : price;
}

export const merchId = (companyId: number, kind: MerchKind) => `merch.${companyId}.${kind}`;

/** `merch.<companyId>.<kind>` as an item; the price is the outsiders' one. */
function merchItem(id: unknown): Item | undefined {
  const m = typeof id === "string" ? /^merch\.([1-9]\d{0,9})\.([a-z]+)$/.exec(id) : null;
  const kind = m && MERCH.find((k) => k.kind === m[2]);
  if (!kind) return undefined;
  return {
    id: id as string,
    slot: "merch",
    index: kind.bit,
    name: kind.name,
    price: kind.price,
    tradeable: false,
    companyId: Number(m[1]),
  };
}

/** The merch item ids a look wears. */
export const merchIn = (look: Look): string[] =>
  look.merch === 0 ? [] : MERCH.filter((m) => look.merchWorn & m.bit).map((m) => merchId(look.merch, m.kind));

// MARK: Trading

/** Items that can change hands: everything but level rewards and earned pieces. */
export const isTradeable = (id: unknown): boolean => itemById(id)?.tradeable ?? false;

/**
 * Whether `by` can put `item` down in `room`: anything that can change hands, anywhere; an earned piece
 * of furniture (Touched grass) and personal-office furniture (`home.ts`) only in their own office,
 * where nobody else can pick it up (and never in the company building).
 */
export const canDropIn = (item: unknown, room: string, by: number): boolean =>
  itemById(item)?.home
    ? room === `office:${by}`
    : isTradeable(item) || (isKeepsake(item) && room === `office:${by}`);

/** An earned piece of furniture: it leaves your bag only for your own office's floor (`canDropIn`). */
export function isKeepsake(id: unknown): boolean {
  const i = itemById(id);
  return i?.slot === "furniture" && i.earned !== undefined;
}

/** One side of a trade: what someone gives. */
export interface Side {
  coins: number;
  items: string[];
}
/** The stake cap: a fat finger can't empty a wallet. */
export const TRADE_COINS_CAP = 500;
export const TRADE_ITEMS_CAP = 4;

/** Null unless coins is an integer in range and every item is a tradeable one, no repeats. */
export function parseSide(raw: unknown): Side | null {
  if (!isRecord(raw)) return null;
  const { coins, items } = raw;
  if (!Number.isInteger(coins) || (coins as number) < 0 || (coins as number) > TRADE_COINS_CAP) return null;
  if (!Array.isArray(items) || items.length > TRADE_ITEMS_CAP || new Set(items).size < items.length)
    return null;
  if (!items.every(isTradeable)) return null;
  return { coins: coins as number, items: items as string[] };
}

export const emptySide = (s: Side): boolean => s.coins === 0 && s.items.length === 0;
