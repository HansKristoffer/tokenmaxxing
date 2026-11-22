import type { Art } from "./editions.ts";
import type { Pen } from "./pixels.ts";
import type { Back, BackView, Outfit } from "./wardrobe.ts";

/**
 * The shared helpers for a track's back items. They live here, not in `wardrobe.ts`, because `wardrobe.ts` imports
 * `prestige.ts` and a track importing `wardrobe.ts` at run time would make an import cycle.
 */

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */
export const frameAt = (rows: string[], y: number): string[] => [...Array<string>(y).fill(""), ...rows];
/** A back view that has only a front layer. */
export const frontView = (front: string[]): BackView => ({ front });
/** `rows` shifted a column to the right, for a flap or a lantern that swings out. */
export const nudge = (rows: string[]): string[] => rows.map((r) => (r ? `.${r.slice(0, 15)}` : r));

/** One prestige track's 2D wearables (`core/src/prestige.ts`); `prestige.ts` files them under their look indices. */
export interface TrackArt {
  /** Keyed like `FISHING_HATS`: `down`, `side` and `up` views of a 16-wide head piece. */
  hat?: Art;
  outfit?: Outfit;
  back?: Back;
  /** One of eight frames of the aura loop on the case-aura frame (`case-aura.ts`: 28×28, character at (6, 6)). */
  aura?: (p: Pen, f: number) => void;
}
