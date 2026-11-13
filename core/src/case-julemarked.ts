/**
 * The Julemarked case: a Danish Christmas market, in cosmetics only a case opening gives (never sold in a shop,
 * never dropped by a raid). Like the other cases (`case.ts`) they are worn through `Look` and tradeable the
 * moment they're opened, but their indices start at `JULEMARKED_BASE`, so the ranges (shop and loot below 300,
 * Night Market 300 to 399, Nusantara 400 to 499, Ragnarok Eve 500 to 599, the pond's treasures 600 to 699,
 * prestige 700 to 799, this 800 to 899) never meet. The art is keyed by the same indices.
 * Design brief: `docs/cases/julemarked.md`.
 */
import type { CaseItem, CaseSlot } from "./case.ts";
import type { Rarity } from "./rarity.ts";

/** Look indices from here up to `JULEMARKED_BASE + 99`, in a case slot, are Julemarked items. */
export const JULEMARKED_BASE = 800;

const entry = (slot: CaseSlot, n: number, name: string, rarity: Rarity, blurb: string): CaseItem => ({
  id: `${slot}.${JULEMARKED_BASE + n}`,
  slot,
  index: JULEMARKED_BASE + n,
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
export const JULEMARKED_ITEMS: readonly CaseItem[] = [
  // Common
  entry("hat", 0, "Nissehue", "common", "Red, a bit too long, and flops over your eyes exactly when it matters."),
  entry("hat", 1, "Pomponhue", "common", "Knitted by someone who loves you, with a bobble the size of a plum."),
  entry("hat", 2, "Grankrans", "common", "A pine wreath with a red ribbon, worn as a crown. It sheds, regally."),
  entry("held", 0, "Gløgg mug", "common", "Hot, spiced and full of raisins. You will be chewing it for a week."),
  entry("held", 1, "Brændte mandler", "common", "A paper cone of burnt almonds, gone before you reach the next stall."),
  entry("held", 2, "Æbleskiver", "common", "A plate of puffs with jam and powdered sugar. The sugar is on everything now."),
  entry("held", 3, "Pebernød tin", "common", "Tiny pepper nuts by the hundred. There is always one more."),
  entry("glasses", 0, "Kolde kinder", "common", "Two rosy stripes of cold cheek. The walk from the bus did that."),
  entry("glasses", 1, "Julelys-briller", "common", "Frames made of tiny fairy lights. They blink out of time with each other."),
  entry("outfit", 0, "Islandsk sweater", "common", "A thick wool yoke in cream, red and green. It will outlive you."),
  entry("outfit", 1, "Bagerforklæde", "common", "Dusted with flour, and with something that was definitely a cinnamon swirl."),
  // Uncommon
  entry("hat", 3, "Lucia-krone", "uncommon", "A crown of candles. Please walk slowly and avoid the tinsel."),
  entry("back", 0, "Gavesæk", "uncommon", "A sack of gifts over one shoulder, and one of them is for you."),
  entry("glasses", 2, "Nissebriller", "uncommon", "Round gold specs and fluffy white brows. The nisse sees everything, and says nothing."),
  entry("held", 4, "Flæskestegssandwich", "uncommon", "Paper-wrapped roast pork with crackling. The crackling is the whole point."),
  entry("outfit", 2, "Nissedragt", "uncommon", "Grey wool, a red cap and a quiet watch over the barn."),
  entry("outfit", 3, "Dannebrog-trøje", "uncommon", "A red sweater with the white cross, knitted for cold quays and cold football."),
  // Rare
  entry("pet", 0, "Rødkælk", "rare", "A robin on a snowy branch, puffed up to twice its size."),
  entry("pet", 1, "Marcipangris", "rare", "A marzipan pig with a red bow. Lucky, sweet, and gone by Twelfth Night."),
  entry("pet", 2, "Nissekat", "rare", "The nisse's cat, in a little red cap. She is the one who is really in charge."),
  entry("pet", 3, "Julesvaneand", "rare", "A duck in a nissehue, because the town deserves one."),
  entry("outfit", 4, "Julemandsdragt", "rare", "The Danish julemand: red suit, white beard, and a long walk up from Greenland."),
  // Epic
  entry("pet", 4, "Julebuk", "epic", "The straw Yule goat. It guards the tree and has opinions about the decorations."),
  entry("pet", 5, "Lygtenisse", "epic", "A tiny nisse with a lantern. Follows you home so nobody trips on the ice."),
  entry("outfit", 5, "Lucia-tog", "epic", "A white gown, a red sash and a procession of candles, all singing in tune."),
  entry("back", 1, "Julehjerte-vinger", "epic", "Woven paper hearts in red and white, folded into wings. Sturdy, and also very pretty."),
  // Legendary
  entry("aura", 0, "Julestjerne", "legendary", "Warm paper stars drift round you, folded one point at a time."),
  entry("aura", 1, "Adventskrans", "legendary", "Four candles flicker in a ring. Each Sunday there is one more."),
  entry("aura", 2, "Snefnug", "legendary", "A swirl of fresh snow that never quite reaches the ground."),
  entry("aura", 3, "Nordlys", "legendary", "Ribbons of northern lights, dancing over the harbour of your shoulders."),
];
