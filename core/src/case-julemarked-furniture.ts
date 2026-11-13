/**
 * The Julemarked case's furniture: six pieces only a case opening gives, like the other cases'
 * (`case-furniture.ts`): never sold, never raided, tradeable, and put down only in your own office. Each is
 * one map character from the Cyrillic block (`Ъ Є Ђ Ћ Џ Љ`; none has a Latin lookalike or a decomposed form),
 * the item id is `furn.<ch>`, and `art` is its sprite in `web/src/art/furniture-home.ts` and its model in
 * `web/src/render3d/furniture/`. Design brief: `docs/cases/julemarked.md`.
 */
import type { CasePiece } from "./case-furniture.ts";
import type { HomePiece } from "./home.ts";
import type { Rarity } from "./rarity.ts";

const entry = (
  ch: string,
  art: string,
  name: string,
  rarity: Rarity,
  blurb: string,
  w: number,
  extra: Partial<Pick<HomePiece, "wall" | "flat">> = {},
): CasePiece => ({ ch, art, name, price: 0, text: blurb, home: true, rarity, blurb, w, ...extra });

/** Never reorder or reuse: the characters are in saved offices and the ids in bags. Add new ones at the end. */
// prettier-ignore
export const JULEMARKED_PIECES: readonly CasePiece[] = [
  entry("Ъ", "jul-heart-garland", "Julehjerte-guirlande", "common", "A garland of woven paper hearts, each one a little crooked on purpose.", 2, { wall: true }),
  entry("Є", "jul-kalenderlys", "Kalenderlys", "common", "A candle marked with the days of December. Today is further down than you think.", 1),
  entry("Ђ", "jul-pebernod-bowl", "Pebernødskål", "common", "A bowl of pepper nuts, topped up every time you look away.", 1),
  entry("Ћ", "jul-advent", "Adventsstage", "uncommon", "Four candles on a stand. Light one more each Sunday, and wait.", 1),
  entry("Џ", "jul-kravlenisse", "Kravlenisse", "uncommon", "A tiny paper nisse peering over the edge of the furniture. He is keeping an eye on the porridge.", 1),
  entry("Љ", "jul-tree", "Juletræ", "rare", "A Danish tree with woven hearts, paper flags and real candles. The whole family dances round it.", 3),
];
