/**
 * Prestige runs as pure maths on facts: lifetime tokens and the list of prestiges taken, each with the lifetime
 * total at the moment it was chosen (`startedAt`). Nothing else is stored; a run's level is derived. Prestige is
 * voluntary and only offered at the cap (first-journey level `MAX_LEVEL`, or run level `RUN_LEVELS` of the
 * previous run). Tokens earned while sitting at the cap do not bank: a run counts from `startedAt`.
 */
import type { CaseItem } from "./case.ts";
import { MAX_LEVEL, levelFor } from "./format.ts";
import {
  PRESTIGE_ITEMS,
  PRESTIGE_TRACKS,
  REWARD_LEVEL,
  RUN_LEVELS,
  TOKENS_PER_LEVEL,
  prestigeTag,
  runLevelCoins,
  type PrestigeTrack,
} from "./prestige.ts";

export interface PrestigeTaken {
  /** Lifetime tokens the moment this prestige was chosen. */
  startedAt: number;
}

export interface PrestigeState {
  prestiges: readonly PrestigeTaken[];
}

export interface RunProgress {
  /** 0..RUN_LEVELS. */
  level: number;
  /** Tokens into the current level (0 at the cap). */
  into: number;
  /** Tokens to the next level (0 at the cap). */
  toNext: number;
}

export type RunReward =
  | { kind: "tag"; rank: number; label: string }
  | { kind: "hat" | "outfit" | "back" | "aura"; rank: number; itemId: string; name: string }
  | { kind: "petwear" | "trophy"; rank: number; name: string };

export const runProgress = (lifetime: number, startedAt: number): RunProgress => {
  const run = Math.max(0, lifetime - startedAt);
  const level = Math.min(RUN_LEVELS, Math.floor(run / TOKENS_PER_LEVEL));
  if (level >= RUN_LEVELS) return { level, into: 0, toNext: 0 };
  const into = run - level * TOKENS_PER_LEVEL;
  return { level, into, toNext: TOKENS_PER_LEVEL - into };
};

/** Run level of the latest prestige (0 before any is taken). */
const currentRunLevel = (lifetime: number, prestiges: readonly PrestigeTaken[]): number => {
  const last = prestiges[prestiges.length - 1];
  return last ? runProgress(lifetime, last.startedAt).level : 0;
};

/** At the cap of the first journey or of the latest run (regardless of whether another track exists). */
export const atCap = (lifetime: number, prestiges: readonly PrestigeTaken[]): boolean =>
  prestiges.length === 0 ? levelFor(lifetime) >= MAX_LEVEL : currentRunLevel(lifetime, prestiges) >= RUN_LEVELS;

/** True when the player can choose the next prestige now: at the cap and a track exists for it. */
export const canPrestige = (lifetime: number, prestiges: readonly PrestigeTaken[]): boolean =>
  atCap(lifetime, prestiges) && prestiges.length < PRESTIGE_TRACKS.length;

/** The state after choosing the next prestige at `lifetime`. Throws if not eligible. */
export const takePrestige = (state: PrestigeState, lifetime: number): PrestigeState => {
  if (!canPrestige(lifetime, state.prestiges)) throw new Error("prestige not available");
  return { prestiges: [...state.prestiges, { startedAt: lifetime }] };
};

/** Everything track `rank` unlocks by run level `runLevel` (the tag at once on entering, level 0). */
export const rewardsUnlocked = (rank: number, runLevel: number): RunReward[] => {
  const track = PRESTIGE_TRACKS[rank - 1];
  if (!track) return [];
  const out: RunReward[] = [{ kind: "tag", rank, label: prestigeTag(rank) }];
  const itemOf = (slot: "hat" | "outfit" | "back" | "aura"): CaseItem =>
    PRESTIGE_ITEMS.find((i) => i.slot === slot && i.index === 700 + rank - 1)!;
  const at = (kind: keyof typeof REWARD_LEVEL): RunReward => {
    if (kind === "petwear") return { kind, rank, name: track.petwear.name };
    if (kind === "trophy") return { kind, rank, name: track.trophy.name };
    const it = itemOf(kind);
    return { kind, rank, itemId: it.id, name: it.name };
  };
  for (const kind of ["hat", "outfit", "petwear", "back", "aura", "trophy"] as const)
    if (runLevel >= REWARD_LEVEL[kind]) out.push(at(kind));
  return out;
};

/** What reaching `to` from `from` newly unlocks and pays in track `rank` (for toasts). */
export const claimableBetween = (
  rank: number,
  from: number,
  to: number,
): { rewards: RunReward[]; coins: number } => {
  const before = new Set(rewardsUnlocked(rank, from).map((r) => `${r.kind}`));
  const rewards = rewardsUnlocked(rank, to).filter((r) => !before.has(r.kind));
  return { rewards, coins: from >= to ? 0 : runCoinsPaid(to) - runCoinsPaid(from) };
};

/** Coins paid for reaching `runLevel` in one run: derived, never stored. */
export const runCoinsPaid = (runLevel: number): number => {
  let sum = 0;
  for (let l = 1; l <= Math.min(runLevel, RUN_LEVELS); l++) sum += runLevelCoins(l);
  return sum;
};

export interface PrestigeView {
  /** Prestiges taken; 0 on the first journey. */
  rank: number;
  runLevel: number;
  progress: RunProgress;
  title: string;
  tag: string;
  /** Ids of every wearable of completed or unlocked tracks. */
  ownedItemIds: string[];
  /** The track the next prestige leads into, if one is defined. */
  nextTrack?: PrestigeTrack;
  canPrestige: boolean;
  /** At run level 50 of the last defined track: waiting for new tracks. */
  complete: boolean;
}

export const playerPrestigeView = (lifetime: number, prestiges: readonly PrestigeTaken[]): PrestigeView => {
  const rank = prestiges.length;
  const last = prestiges[rank - 1];
  const progress = last ? runProgress(lifetime, last.startedAt) : { level: 0, into: 0, toNext: 0 };
  const owned: string[] = [];
  for (let r = 1; r <= rank; r++) {
    const level = r < rank ? RUN_LEVELS : progress.level;
    for (const w of rewardsUnlocked(r, level)) if ("itemId" in w) owned.push(w.itemId);
  }
  const track = PRESTIGE_TRACKS[rank - 1];
  return {
    rank,
    runLevel: progress.level,
    progress,
    title: track?.name ?? "",
    tag: prestigeTag(rank),
    ownedItemIds: owned,
    nextTrack: PRESTIGE_TRACKS[rank],
    canPrestige: canPrestige(lifetime, prestiges),
    complete: rank >= PRESTIGE_TRACKS.length && progress.level >= RUN_LEVELS,
  };
};
