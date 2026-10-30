import type { CaseItem } from "@tokenmaxxing/core/case.ts";
import { MAX_LEVEL } from "@tokenmaxxing/core/format.ts";
import {
  PRESTIGE_ITEMS,
  PRESTIGE_TRACKS,
  type PrestigeTrack,
  prestigeTag,
  REWARD_LEVEL,
  RUN_LEVELS,
  runLevelCoins,
} from "@tokenmaxxing/core/prestige.ts";
import {
  claimableBetween,
  NO_PRESTIGE,
  type PrestigeBadge,
  type RunReward,
} from "@tokenmaxxing/core/prestige-run.ts";

/** The badge on a server payload that may not carry one yet (older server, a bot): missing is NO_PRESTIGE. */
export const badgeOf = (x: unknown): PrestigeBadge => {
  const b = (x as { prestige?: Partial<PrestigeBadge> } | null | undefined)?.prestige;
  const rank = Number.isInteger(b?.rank) ? Math.max(0, b!.rank!) : 0;
  if (rank === 0) return NO_PRESTIGE;
  return { rank, runLevel: Math.min(RUN_LEVELS, Math.max(0, Math.floor(b?.runLevel ?? 0))) };
};

export interface CardPrestige {
  /** Another prestige can be taken now: at the cap of the first journey or of this run, and a track exists. */
  can: boolean;
  /** In a run that is not finished: show its progress row. */
  midRun: boolean;
  /** Rank of the prestige the button leads into. */
  next: number;
}

/** What my card shows about prestige: the button, or the progress row. `level` is my first-journey level. */
export const cardPrestige = (level: number, badge: PrestigeBadge): CardPrestige => {
  const next = badge.rank + 1;
  const atCap = badge.rank === 0 ? level >= MAX_LEVEL : badge.runLevel >= RUN_LEVELS;
  return {
    can: atCap && next <= PRESTIGE_TRACKS.length,
    midRun: badge.rank > 0 && badge.runLevel < RUN_LEVELS,
    next,
  };
};

/** "Prestige II · Cosmic — run level 12/50". */
export const runLine = (badge: PrestigeBadge): string =>
  badge.rank > 0 ? `${prestigeTag(badge.rank)} — run level ${badge.runLevel}/${RUN_LEVELS}` : "";

/** Share of the run done, 0..1, for the bar. */
export const runShare = (runLevel: number): number => Math.min(1, Math.max(0, runLevel / RUN_LEVELS));

export interface PlanRow {
  kind: "hat" | "outfit" | "petwear" | "back" | "aura" | "trophy";
  /** Run level it unlocks at. */
  level: number;
  label: string;
  name: string;
  /** The wearable, for its picture; the pet accessory and the trophy have none in the bag. */
  item?: CaseItem;
}

const LABEL = {
  hat: "Headwear",
  outfit: "Outfit",
  petwear: "Pet accessory",
  back: "Back item",
  aura: "Aura",
  trophy: "Home trophy",
} as const;

/** The track's six rewards in the order they unlock. */
export const rewardPlan = (t: PrestigeTrack): PlanRow[] =>
  (["hat", "outfit", "petwear", "back", "aura", "trophy"] as const).map((kind) => {
    const item =
      kind === "petwear" || kind === "trophy"
        ? undefined
        : PRESTIGE_ITEMS.find((i) => i.slot === kind && i.index === 700 + t.rank - 1);
    const name = kind === "petwear" ? t.petwear.name : kind === "trophy" ? t.trophy.name : item!.name;
    return { kind, level: REWARD_LEVEL[kind], label: LABEL[kind], name, item };
  });

/** The coin milestones of a run: the ordinary level pays and the five bonus levels. */
export const coinSchedule = (): { level: number; coins: number }[] =>
  [10, 20, 30, 40, 50].map((level) => ({ level, coins: runLevelCoins(level) }));

export const KEEP = [
  "Every item you own, including earlier prestige wearables",
  "Your coins and badges",
  "Your past prestige tags",
] as const;
export const RESTART = [
  "A new run of 50 levels (50 billion tokens), with tokens past the previous cap carried over",
] as const;

export interface RunToast {
  key: string;
  text: string;
}

const REWARD_ICON: Record<RunReward["kind"], string> = {
  tag: "🎖️",
  hat: "🎩",
  outfit: "👔",
  petwear: "🐾",
  back: "🎒",
  aura: "✨",
  trophy: "🏆",
};

/** The toasts for a run going from `from` to `to` in track `rank` (or entering it, from -1): level, coins, unlocks. */
export const runToasts = (rank: number, from: number, to: number): RunToast[] => {
  if (rank < 1 || to <= from) return [];
  const entered = from < 0;
  const { rewards, coins } = claimableBetween(rank, Math.max(0, from), to);
  const out: RunToast[] = [];
  if (entered) out.push({ key: "tag", text: `🎖️ ${prestigeTag(rank)}: your new tag` });
  else if (to > from)
    out.push({
      key: "level",
      text: `⬆️ Run level ${to}${coins > 0 ? ` · 🪙 ${coins.toLocaleString()}` : ""}`,
    });
  for (const r of rewards)
    if (r.kind !== "tag") out.push({ key: r.kind, text: `${REWARD_ICON[r.kind]} Unlocked: ${r.name}` });
  return out;
};
