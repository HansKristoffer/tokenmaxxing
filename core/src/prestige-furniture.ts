/**
 * The prestige trophies as furniture: one per track (`PRESTIGE_TRACKS[n].trophy`), given into the bag as the
 * run reaches `REWARD_LEVEL.trophy`, never sold, never traded, and put down only in your own office (like
 * `case-furniture.ts`, which files them in `ALL_CASE_PIECES` so every home lookup finds them). Each is one map
 * character from the Cyrillic block, the item id is `furn.<ch>`, and `art` is `prestige-trophy-<rank>`: its
 * sprite is `PRESTIGE_TROPHIES` in `web/src/art/prestige-trophy.ts` and its model `PRESTIGE_TROPHY_ASSETS` in
 * `web/src/render3d/furniture/prestige3d.ts`.
 */
import type { CasePiece } from "./case-furniture.ts";
import { PRESTIGE_TRACKS, REWARD_LEVEL } from "./prestige.ts";

/** Never reorder or reuse: the characters are in saved offices and the ids in bags. Track n is entry n - 1. */
const CHARS = ["Л", "П", "У", "И", "Ь"] as const;

export const PRESTIGE_PIECES: readonly CasePiece[] = PRESTIGE_TRACKS.map((t, i) => ({
  ch: CHARS[i]!,
  art: `prestige-trophy-${t.rank}`,
  name: t.trophy.name,
  price: 0,
  w: t.trophy.w,
  text: t.trophy.blurb,
  home: true,
  rarity: "legendary",
  blurb: t.trophy.blurb,
}));

const IDS = new Set(PRESTIGE_PIECES.map((p) => p.ch));
export const isPrestigePiece = (ch: unknown): boolean => IDS.has(ch as string);

/** The bag id of a track's trophy (`furn.<ch>`); rank 1 is the first track. */
export const prestigeTrophyId = (rank: number): string | undefined => {
  const p = PRESTIGE_PIECES[rank - 1];
  return p && `furn.${p.ch}`;
};

/** The trophy items a run of track `rank` has earned at `runLevel` (none before `REWARD_LEVEL.trophy`). */
export const trophyItems = (rank: number, runLevel: number): string[] => {
  const id = runLevel >= REWARD_LEVEL.trophy ? prestigeTrophyId(rank) : undefined;
  return id ? [id] : [];
};

/** The trophy ids track `rank` grants on reaching level 50 (what `grantRewards` puts in the bag). */
export const prestigeTrophyIds = (rank: number): string[] => trophyItems(rank, REWARD_LEVEL.trophy);
