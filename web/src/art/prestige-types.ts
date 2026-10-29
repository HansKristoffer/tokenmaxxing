import type { Art } from "./editions.ts";
import type { Pen } from "./pixels.ts";
import type { Back, Outfit } from "./wardrobe.ts";

/** One prestige track's 2D wearables (`core/src/prestige.ts`); `prestige.ts` files them under their look indices. */
export interface TrackArt {
  /** Keyed like `FISHING_HATS`: the four directions are `down`, `side`, `up` of a 16-wide head piece. */
  hat?: Art;
  outfit?: Outfit;
  back?: Back;
  /** One of eight frames of the aura loop on the case-aura frame (`case-aura.ts`: 28×28, character at (6, 6)). */
  aura?: (p: Pen, f: number) => void;
}
