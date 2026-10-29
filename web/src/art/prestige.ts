import { PRESTIGE_BASE, PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import type { Art } from "./editions.ts";
import { TRACK as T1 } from "./prestige-1.ts";
import { TRACK as T2 } from "./prestige-2.ts";
import { TRACK as T3 } from "./prestige-3.ts";
import { TRACK as T4 } from "./prestige-4.ts";
import { TRACK as T5 } from "./prestige-5.ts";
import type { TrackArt } from "./prestige-types.ts";
import type { Pen } from "./pixels.ts";
import type { Back, Outfit } from "./wardrobe.ts";

/**
 * The prestige tracks' hats, outfits, backs and auras in 2D (`core/src/prestige.ts`), one file a track
 * (`prestige-1.ts` to `prestige-5.ts`). The hats are keyed by item id and merged into `CASE_HATS`, the rest by look
 * index (`PRESTIGE_BASE + rank - 1`) and merged into `wardrobe.ts`'s tables and `case-aura.ts`'s draws.
 */
const TRACKS: readonly TrackArt[] = [T1, T2, T3, T4, T5];
const idx = (i: number) => PRESTIGE_BASE + PRESTIGE_TRACKS[i]!.rank - 1;

export const PRESTIGE_HATS: Record<string, Art> = {};
export const PRESTIGE_OUTFITS: Record<number, Outfit> = {};
export const PRESTIGE_BACKS: Record<number, Back> = {};
export const PRESTIGE_AURAS: Record<number, (p: Pen, f: number) => void> = {};
TRACKS.forEach((t, i) => {
  if (t.hat) PRESTIGE_HATS[`hat.${idx(i)}`] = t.hat;
  if (t.outfit) PRESTIGE_OUTFITS[idx(i)] = t.outfit;
  if (t.back) PRESTIGE_BACKS[idx(i)] = t.back;
  if (t.aura) PRESTIGE_AURAS[idx(i)] = t.aura;
});
