/** Badges on the player card: worked out on read from a player's facts, never stored or claimed. */
import { plural } from "./format.ts";
import { GAMES } from "./games/index.ts";
import { LOOT } from "./loot.ts";
import { addDays } from "./range.ts";
import type { Rarity } from "./rarity.ts";

export interface BadgeFacts {
  /** World days in a row with tokens (the game's rule: any tokens count), ending today or yesterday. */
  streak: number;
  /** Tokens on the best single day. */
  bestDay: number;
  /** Days finished in the top 3. */
  podiums: number;
  peakAgents: number;
  prs: number;
  wins: number;
  biggestPot: number;
  founder: boolean;
  // Optional, so older callers and tests still pass (the `picnics?` pattern).
  /** Outage picnics sat in. */
  picnics?: number;
  /** Days with at least one PR. */
  shipDays?: number;
  /** Models with at least `POLYGLOT_MIN` lifetime tokens. */
  models?: number;
  /** Lifetime cache reads over input, cache writes and cache reads, 0 to 1. */
  cacheShare?: number;
  /** Lifetime tokens: the cache badge needs `CACHE_FLOOR`. */
  lifetime?: number;
  /** Best run of days in a row with tokens, ever. */
  longestRun?: number;
  /** Raid bosses felled while they were a raider. */
  raidKills?: number;
  /** Different raid loot pieces held. */
  lootOwned?: number;
  /** Games finished. */
  gamesPlayed?: number;
  /** Different game types played. */
  gameTypes?: number;
  /** Days spent in the Tavern (`tavern_daily` visits). */
  tavernDays?: number;
  /** Daily quests cleared (`questsCleared`). */
  helped?: number;
}

export type Group = "Usage" | "Social" | "Town" | "Raid" | "Games" | "Seasonal";

export type Frame = "bronze" | "silver" | "gold" | "diamond";
export const FRAMES: readonly Frame[] = ["bronze", "silver", "gold", "diamond"];

/** A model counts for Polyglot from this many lifetime tokens. */
export const POLYGLOT_MIN = 100_000;
/** Cache wizard needs this many lifetime tokens, so a handful of cached prompts can't earn it. */
export const CACHE_FLOOR = 50_000_000;

interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  group: Group;
  /** How it's earned, for the collection log. */
  how: string;
  /** Ascending; the label for each. */
  tiers: { at: number; label: string }[];
  of: (f: BadgeFacts) => number;
  /** Earned in the background, so its gold is never announced to the town. */
  quiet?: boolean;
}

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  /** 1-based tier reached (0: not earned, only in `badgeStates`). */
  tier: number;
  /** How many tiers it has. */
  tiers: number;
  frame: Frame;
  rarity: Rarity;
  /** Where they stand now. */
  value: number;
  /** The next tier, null at the top. */
  next: { at: number; label: string } | null;
  /** The tier reached's threshold (0 before the first): the progress bar starts here. */
  prev: number;
}

const ladder = (at: number[], label: (at: number) => string) => at.map((n) => ({ at: n, label: label(n) }));

export const BADGES: readonly BadgeDef[] = [
  {
    id: "streak",
    emoji: "🔥",
    name: "Streak",
    group: "Usage",
    how: "Tokens on days in a row",
    tiers: ladder([7, 30, 100, 365], (at) => `${at}-day streak`),
    of: (f) => f.streak,
  },
  {
    id: "bigday",
    emoji: "🧠",
    name: "Big day",
    group: "Usage",
    how: "Tokens in a single day",
    tiers: [1, 5, 10].map((b) => ({ at: b * 1e9, label: `${b}B-token day` })),
    of: (f) => f.bestDay,
  },
  {
    id: "podium",
    emoji: "🏆",
    name: "Podium",
    group: "Social",
    how: "Finish a day in the top 3 of the town",
    tiers: ladder([1, 10, 50, 200], (at) => plural(at, "podium")),
    of: (f) => f.podiums,
  },
  {
    id: "octopus",
    emoji: "🐙",
    name: "Octopus",
    group: "Usage",
    how: "Agents running at once",
    tiers: ladder([5, 10, 20], (at) => `${at} agents at once`),
    of: (f) => f.peakAgents,
  },
  {
    id: "shipper",
    emoji: "🚢",
    name: "Shipper",
    group: "Usage",
    how: "Open pull requests",
    tiers: ladder([10, 50, 250, 1000], (at) => plural(at, "PR")),
    of: (f) => f.prs,
  },
  {
    id: "shark",
    emoji: "🦈",
    name: "Shark",
    group: "Games",
    how: "Win games",
    tiers: ladder([5, 25, 100, 500], (at) => plural(at, "win")),
    of: (f) => f.wins,
  },
  {
    id: "whale",
    emoji: "🐋",
    name: "Whale",
    group: "Games",
    how: "Win a big pot",
    // 5000 sits between the old top and the new diamond, so nobody drops a tier.
    tiers: ladder([500, 2000, 5000, 10000], (at) => `${at}-coin pot`),
    of: (f) => f.biggestPot,
  },
  {
    id: "founder",
    emoji: "🏢",
    name: "Founder",
    group: "Town",
    how: "Own a company",
    tiers: [{ at: 1, label: "Founder" }],
    of: (f) => +f.founder,
    quiet: true,
  },
  {
    id: "picnic",
    emoji: "🧺",
    name: "I was there",
    group: "Seasonal",
    how: "Sit on a blanket at an outage picnic",
    tiers: [
      { at: 1, label: "I was there" },
      { at: 5, label: "5 outage picnics" },
    ],
    of: (f) => f.picnics ?? 0,
    quiet: true,
  },
  {
    id: "shipdays",
    emoji: "📦",
    name: "Ship days",
    group: "Usage",
    how: "Open a PR on different days",
    tiers: ladder([10, 30, 100], (at) => `PRs on ${at} days`),
    of: (f) => f.shipDays ?? 0,
  },
  {
    id: "polyglot",
    emoji: "🗣️",
    name: "Polyglot",
    group: "Usage",
    how: "Use different models (100k tokens each)",
    tiers: ladder([3, 6, 10], (at) => `${at} models`),
    of: (f) => f.models ?? 0,
  },
  {
    id: "cache",
    emoji: "🧙",
    name: "Cache wizard",
    group: "Usage",
    how: "Share of your tokens read from cache, after 50M tokens (your tool matters too)",
    tiers: ladder([80, 90, 95], (at) => `${at}% cache hits`),
    of: (f) => ((f.lifetime ?? 0) >= CACHE_FLOOR ? Math.floor((f.cacheShare ?? 0) * 100) : 0),
  },
  {
    id: "longrun",
    emoji: "🏃",
    name: "Longest run",
    group: "Usage",
    how: "Your best run of days in a row with tokens",
    tiers: ladder([14, 60, 200], (at) => `${at}-day run`),
    of: (f) => f.longestRun ?? 0,
  },
  {
    id: "raider",
    emoji: "⚔️",
    name: "Raider",
    group: "Raid",
    how: "Join in felling raid bosses",
    tiers: ladder([1, 10, 50], (at) => `${plural(at, "boss", "bosses")} felled`),
    of: (f) => f.raidKills ?? 0,
  },
  {
    id: "hunter",
    emoji: "🎒",
    name: "Hunter",
    group: "Raid",
    how: "Collect the raid's loot",
    tiers: ladder([1, 5, LOOT.length], (at) => plural(at, "loot piece")),
    of: (f) => f.lootOwned ?? 0,
  },
  {
    id: "regular",
    emoji: "🎲",
    name: "Regular",
    group: "Games",
    how: "Finish games",
    tiers: ladder([10, 50, 250], (at) => plural(at, "game")),
    of: (f) => f.gamesPlayed ?? 0,
  },
  {
    id: "allgames",
    emoji: "🎯",
    name: "Variety",
    group: "Games",
    how: "Play every kind of game",
    // Poker at the Tavern is a kind of game too (`POKER_GAME`).
    tiers: ladder([2, 4, Object.keys(GAMES).length + 1], (at) => `${at} kinds of game`),
    of: (f) => f.gameTypes ?? 0,
  },
  {
    id: "tavern",
    emoji: "🍺",
    name: "Tavern regular",
    group: "Town",
    how: "Spend time in the Tavern on different days",
    tiers: ladder([7, 30, 100], (at) => `${at} days at the Tavern`),
    of: (f) => f.tavernDays ?? 0,
  },
  {
    id: "helper",
    emoji: "🤝",
    name: "Helper",
    group: "Social",
    how: "Clear the town's daily quests",
    tiers: ladder([1, 10, 50], (at) => `${plural(at, "quest")} cleared`),
    of: (f) => f.helped ?? 0,
  },
];

/** The frame of tier `tier` (1-based) of a badge with `count` tiers: a lone one is gold, four end in diamond. */
export const frameOf = (tier: number, count: number): Frame =>
  count === 1 ? "gold" : FRAMES[Math.min(Math.max(tier, 1), count) - 1]!;

/** Bronze, silver, gold and diamond as the shop's rarity words. */
export const FRAME_RARITY: Record<Frame, Rarity> = {
  bronze: "uncommon",
  silver: "rare",
  gold: "epic",
  diamond: "legendary",
};

const stateOf = (b: BadgeDef, f: BadgeFacts): Badge => {
  const value = b.of(f);
  const tier = b.tiers.filter((t) => value >= t.at).length;
  const frame = frameOf(tier, b.tiers.length);
  return {
    id: b.id,
    emoji: b.emoji,
    label: tier ? b.tiers[tier - 1]!.label : b.name,
    tier,
    tiers: b.tiers.length,
    frame,
    rarity: FRAME_RARITY[frame],
    value,
    next: b.tiers[tier] ?? null,
    prev: tier ? b.tiers[tier - 1]!.at : 0,
  };
};

/** Every badge with where they stand, earned or not (the collection log). */
export const badgeStates = (f: BadgeFacts): Badge[] => BADGES.map((b) => stateOf(b, f));

/** The highest tier met of each badge; badges below their first tier are left out. */
export const badgesFor = (f: BadgeFacts): Badge[] => badgeStates(f).filter((b) => b.tier > 0);

/** How far to the next tier, 0 to 1 (1 at the top). */
export const progressOf = (b: Pick<Badge, "value" | "next" | "prev">): number =>
  b.next ? Math.min(1, Math.max(0, (b.value - b.prev) / (b.next.at - b.prev))) : 1;

/** Whether reaching this tier is told to the whole town: gold and diamond, unless the badge is quiet. */
export const announced = (id: string, tier: number): boolean => {
  const def = BADGES.find((b) => b.id === id);
  if (!def || def.quiet) return false;
  const frame = frameOf(tier, def.tiers.length);
  return frame === "gold" || frame === "diamond";
};

/** "Ada earned Shipper gold: 250 PRs", for the toast and the chat line. */
export function awardLine(name: string, id: string, tier: number): string | null {
  const def = BADGES.find((b) => b.id === id);
  const t = def?.tiers[tier - 1];
  if (!def || !t) return null;
  return `🏅 ${name} earned ${def.name} ${frameOf(tier, def.tiers.length)}: ${t.label}`;
}

/** The longest run of consecutive days in a set of `YYYY-MM-DD` days. */
export function longestRun(days: Set<string>): number {
  let best = 0;
  for (const day of days) {
    // Only count from the start of a run.
    if (days.has(addDays(day, -1))) continue;
    let n = 1;
    while (days.has(addDays(day, n))) n++;
    best = Math.max(best, n);
  }
  return best;
}

/** Current streak from the set of `YYYY-MM-DD` days with tokens: counts back from `today`, or from yesterday if today has none yet. */
export function streakOf(days: Set<string>, today: string): number {
  let n = 0;
  for (let day = days.has(today) ? today : addDays(today, -1); days.has(day); day = addDays(day, -1)) n++;
  return n;
}
