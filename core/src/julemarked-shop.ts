/**
 * What the Julemarked's three small stalls sell, for coins: Julegodter (things to hold), Julepynt (furniture
 * for your own office) and Den varme bod (warm clothes, things to carry and small animals). They are shop items like any other
 * (`ITEMS`, the bag, trades, the Shop page) with three differences: each is bought only inside the market
 * room (`stallOfItem`; the market is only open from J-dag to 26 December, so the season gate is the gate's),
 * the Shop page opens on a stall's own goods and only those (`STALL_TABS`), and Møbelhuset, Thread & Token
 * and the pet shop never list them. No case gives one, and no case item is sold here.
 *
 * Look indices count from `STALL_BASE` (900), after the Julemarked case's 800 to 899, so no range meets
 * another (shop and loot below 300, cases 300 to 599 and 800 to 899, the pond 600 to 699, prestige 700 to 799).
 * `parseLook` accepts them through `stallAt`. Never reorder or reuse: the ids are in bags.
 * Design and the art checklist: `docs/cases/julemarked.md`.
 */
import type { HomePiece } from "./home.ts";
import type { StallId } from "./julemarked.ts";
import type { Item } from "./shop.ts";
import type { ShopTab } from "./shoprooms.ts";

/** Look indices from here up to `STALL_BASE + 99`, in a stall's slot, are stall goods. */
export const STALL_BASE = 900;

/** The stalls that sell for coins (Nissens bod sells the case). */
export type ShopStallId = Exclude<StallId, "nissen">;
export const SHOP_STALL_IDS: readonly ShopStallId[] = ["godter", "pynt", "varme"];

/** What E on a stall opens the Shop page on: its tabs, in order. Only these stalls' goods are listed. */
export const STALL_TABS: Record<ShopStallId, readonly ShopTab[]> = {
  godter: ["held"],
  pynt: ["furniture"],
  varme: ["hat", "glasses", "outfit", "back", "held", "pet"],
};

/** The stall keeper's line at the top of the page. */
export const STALL_HELLO: Record<ShopStallId, string> = {
  godter: 'Julegodter: "Warm, sweet and gone in four bites. Take two, we can tell you will."',
  pynt: 'Julepynt: "Everything is a little crooked on purpose. That is the craft."',
  varme: 'Den varme bod: "Wool is a love language. Try the hat, then try the seal pup."',
};

type WearSlot = "hat" | "glasses" | "held" | "outfit" | "back" | "pet";
interface Wear {
  stall: ShopStallId;
  slot: WearSlot;
  /** Look index is `STALL_BASE + n`. */
  n: number;
  name: string;
  price: number;
  blurb: string;
}

// A catalog reads best one to a line.
// prettier-ignore
const WEARABLES: readonly Wear[] = [
  { stall: "godter", slot: "held", n: 0, name: "Varm kakao", price: 30, blurb: "Hot, thick and topped with cream. Your hands will not give it back." },
  { stall: "godter", slot: "held", n: 1, name: "Klejner", price: 40, blurb: "Twisted fried dough, dusted with sugar. Technically a knot, spiritually a hug." },
  { stall: "godter", slot: "held", n: 2, name: "Risengrød med smør", price: 50, blurb: "Rice porridge with a pat of butter. The almond is in someone else's bowl, probably." },
  { stall: "godter", slot: "held", n: 3, name: "Marcipanbrød", price: 60, blurb: "A loaf of marzipan under dark chocolate. Slice it thin; you will not." },
  { stall: "godter", slot: "held", n: 4, name: "Sukkerstang", price: 30, blurb: "Red and white and sticky to the elbow. Lasts until the next stall." },
  { stall: "varme", slot: "hat", n: 0, name: "Øreværmere", price: 80, blurb: "Wool earmuffs that make every compliment sound far away." },
  { stall: "varme", slot: "outfit", n: 0, name: "Strikket sæt", price: 140, blurb: "A knitted jumper with matching mittens, made by someone with too much time and love." },
  { stall: "varme", slot: "outfit", n: 1, name: "Uldfrakke", price: 200, blurb: "A long wool coat. It has outlived two winters and a bad haircut." },
  { stall: "varme", slot: "pet", n: 0, name: "Gråspurv", price: 180, blurb: "A fluffed-up sparrow that has decided your shoulder is the warm one." },
  { stall: "varme", slot: "pet", n: 1, name: "Snehare", price: 240, blurb: "A white hare in a white drift. You find it by the nose, not the eyes." },
  { stall: "varme", slot: "hat", n: 1, name: "Pelshue", price: 120, blurb: "A fur trapper hat with the flaps down. Warm ears, and a shaky respect from every bear." },
  { stall: "varme", slot: "hat", n: 2, name: "Sixpence", price: 90, blurb: "A flat wool cap. The brim is for tipping, and for nothing else." },
  { stall: "varme", slot: "glasses", n: 0, name: "Skibriller", price: 110, blurb: "Mirrored ski goggles. You are not skiing, and that is fine." },
  { stall: "varme", slot: "glasses", n: 1, name: "Hyggebriller", price: 80, blurb: "Round tortoiseshell specs that fog up whenever anyone says cocoa." },
  { stall: "varme", slot: "outfit", n: 2, name: "Gul regnjakke", price: 170, blurb: "The yellow raincoat every Dane owns. It rains eight months a year, and the other four are a rumour." },
  { stall: "varme", slot: "outfit", n: 3, name: "Flonelsskjorte", price: 120, blurb: "A red-and-black flannel shirt. Smells of woodsmoke and a decent plan." },
  { stall: "varme", slot: "back", n: 0, name: "Hyggetæppe", price: 150, blurb: "A plaid blanket worn as a cape. The whole sofa is in there somewhere." },
  { stall: "varme", slot: "back", n: 1, name: "Ski", price: 140, blurb: "A pair of skis across your back. The hill is sold separately." },
  { stall: "varme", slot: "held", n: 5, name: "Termokande", price: 70, blurb: "A steel thermos with a dent. Still hot, since last Thursday." },
  { stall: "varme", slot: "held", n: 6, name: "Fyrfadslys", price: 60, blurb: "A tea light in a little glass. Small, steady and entirely enough." },
  { stall: "varme", slot: "pet", n: 2, name: "Pindsvin", price: 200, blurb: "A hedgehog in a nest of leaves. Do not hug it. Do not ask it." },
  { stall: "varme", slot: "pet", n: 3, name: "Rødt egern", price: 220, blurb: "A red squirrel with a nut it has no plans to share." },
  { stall: "varme", slot: "pet", n: 4, name: "Sælunge", price: 280, blurb: "A grey seal pup with big, wet and entirely undeserved eyes." },
];

/** The wearables as shop items: coin-priced, tradeable, never in a case. */
export const STALL_WEARABLES: readonly Item[] = WEARABLES.map((w) => ({
  id: `${w.slot}.${STALL_BASE + w.n}`,
  slot: w.slot,
  index: STALL_BASE + w.n,
  name: w.name,
  price: w.price,
  tradeable: true,
  blurb: w.blurb,
  stall: w.stall,
}));

const piece = (
  ch: string,
  art: string,
  name: string,
  price: number,
  text: string,
  wall?: true,
): HomePiece => ({ ch, art, name, price, w: 1, text, home: true, stall: "pynt", ...(wall && { wall }) });

/**
 * Julepynt's furniture: `HOME_PIECES` ends with these (own office only, cosmetic, one tile wide). One map
 * character each from the Cyrillic block (none has a Latin lookalike or a decomposed form).
 */
export const JULEPYNT_PIECES: readonly HomePiece[] = [
  piece(
    "Ѫ",
    "jst-star",
    "Adventsstjerne",
    120,
    "A paper star in the window, lit from inside. It is always on, and nobody remembers switching it on.",
    true,
  ),
  piece(
    "Ѧ",
    "jst-kalender",
    "Julekalender",
    180,
    "Twenty-four little doors. Someone has already opened tomorrow's. It was you.",
    true,
  ),
  piece(
    "Ѱ",
    "jst-nissedoer",
    "Nissedør",
    140,
    "A very small door at the foot of the wall. Leave porridge, and do not ask what for.",
    true,
  ),
  piece(
    "Ѯ",
    "jst-bordtree",
    "Bordjuletræ",
    240,
    "A tabletop tree with a string of lights and four paper hearts. Hygge, at desk height.",
  ),
  piece(
    "Ѭ",
    "jst-gaver",
    "Gavestabel",
    160,
    "A neat stack of wrapped gifts. All of them are for you, and one is socks.",
  ),
];

const BY_ID = new Map<string, Item>(STALL_WEARABLES.map((i) => [i.id, i]));
const BY_PIECE = new Map(JULEPYNT_PIECES.map((p) => [`furn.${p.ch}`, p]));

/** The stall that sells an item id, if it is one of theirs: the one place it can be bought. */
export const stallOfItem = (id: unknown): ShopStallId | undefined =>
  BY_ID.get(id as string)?.stall ?? (BY_PIECE.has(id as string) ? "pynt" : undefined);

/** The stall wearable a look index stands for in a slot, if it is one (`parseLook`, the art lookup). */
export const stallAt = (slot: string, index: number): Item | undefined =>
  index >= STALL_BASE ? STALL_WEARABLES.find((i) => i.slot === slot && i.index === index) : undefined;
