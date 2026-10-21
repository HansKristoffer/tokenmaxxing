/**
 * The weekly raid: a ladder of bosses in the town square that the whole town fights together. Every
 * token anyone syncs that week hits the boss on the current rung, and every PR they open is a special
 * attack. When a boss falls the next, harder one appears at once and the overflow carries over. Like
 * coins, nothing is stored: a week's damage, the ladder, its kills and who gets paid are worked out
 * from the daily rollups, so a late sync still lands its hits. Pure functions, shared by server and client.
 */
import { addDays, dayKey } from "./range.ts";

export interface Boss {
  id: string;
  name: string;
  emoji: string;
  /** What it says over the square, one picked per poll. */
  taunts: readonly string[];
}

/** The ladder's order, easiest first; after the last it starts over as "II", "III"… */
export const BOSSES: readonly Boss[] = [
  {
    id: "rate-limit",
    name: "The Rate Limit",
    emoji: "⏳",
    taunts: ["You've hit your limit.", "Try again in 4h 59m.", "429. 429. 429.", "Upgrade to continue."],
  },
  {
    id: "context-window",
    name: "The Context Window",
    emoji: "🪟",
    taunts: [
      "I forgot what you said.",
      "Compacting conversation…",
      "Too long; didn't read.",
      "Start a new chat?",
    ],
  },
  {
    id: "merge-conflict",
    name: "Merge Conflict",
    emoji: "🔀",
    taunts: ["<<<<<<< HEAD", "Both modified.", "Rebase me. I dare you.", "=======  >>>>>>>"],
  },
  {
    id: "hallucination",
    name: "The Hallucination",
    emoji: "🌀",
    taunts: [
      "That function exists. Trust me.",
      "Tests pass. Probably.",
      "I made up that API.",
      "Citation needed.",
    ],
  },
];

/**
 * The first raid's rung 1 HP: this share of the week before's total damage. Clearing n rungs takes
 * `rung1 × 2 × (1.5ⁿ − 1)`, so 4 rungs cost 8.125 × rung 1 = 81% of that week: a week like it clears
 * four bosses and stands at the fifth.
 */
export const HP_SHARE = 0.1;
/** Every week after the first, rung 1 has this many times the HP of the week before's. */
export const WEEKLY_GROWTH = 1.1;
/** Each rung has this many times the HP of the one before. */
export const HP_GROWTH = 1.5;
/** The least HP the first raid's rung 1 comes with. */
export const MIN_HP = 2e9;
/** A PR opened is a special attack. */
export const PR_HIT = 25e6;
/** Damage that week, up to the day of a kill, to count as one of its raiders and be paid for it. */
export const RAIDER_AT = 10e6;
/** What each raider gets for rung 1's kill; each rung after pays ×1.5, to the nearest 5, up to `RAID_COIN_CAP`. */
export const RAID_COINS = 10;
/** The most one kill pays a raider, however high the ladder goes. */
export const RAID_COIN_CAP = 50;
/** The week's gate opens at this hour on Monday, world time. */
export const OPENS_AT_HOUR = 8;

/** A boss on a rung of the ladder: "Merge Conflict II" is rung 7, level 2. */
export interface RungBoss extends Boss {
  rung: number;
  /** 1 the first time round the ladder, 2 the second ("II"), and so on. */
  level: number;
}

const roman = (n: number): string => {
  let out = "";
  for (const [v, s] of [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ] as const)
    for (; n >= v; n -= v) out += s;
  return out;
};

/** The boss on `rung` (1 is the easiest). */
export function bossAt(rung: number): RungBoss {
  const boss = BOSSES[(rung - 1) % BOSSES.length]!;
  const level = Math.floor((rung - 1) / BOSSES.length) + 1;
  return { ...boss, name: level > 1 ? `${boss.name} ${roman(level)}` : boss.name, rung, level };
}

/** The first raid's rung 1 HP, from the week before's damage. */
export const hpFor = (lastWeekDamage: number): number =>
  Math.max(MIN_HP, Math.round(lastWeekDamage * HP_SHARE));

/** Rung 1's HP `n` weeks after the first raid, whose rung 1 had `first`: 10% more each week. */
export const weekHp = (first: number, n: number): number => Math.round(first * WEEKLY_GROWTH ** n);

/** The HP of `rung`, from rung 1's. */
export const rungHp = (base: number, rung: number): number => Math.round(base * HP_GROWTH ** (rung - 1));

/** What each raider gets when the boss on `rung` falls: 10, 15, 25, 35, 50, then 50 a kill. */
export const rewardFor = (rung: number): number =>
  Math.min(RAID_COIN_CAP, 5 * Math.round((RAID_COINS * HP_GROWTH ** (rung - 1)) / 5));

/** One player's world day, as the raid sees it. */
export interface RaidDay {
  userId: number;
  day: string;
  tokens: number;
  prs: number;
}

/** What one player's day does to the boss: every token, no cap. */
export const dayDamage = (d: { tokens: number; prs: number }): number => d.tokens + d.prs * PR_HIT;

/**
 * The first raid's week for a town that gets the raid at `now`: next Monday, whatever day it is, so
 * the first ladder opens at its 08:00. Earlier weeks only set its HP, so nobody is paid for bosses
 * that were never there.
 */
export const launchWeek = (now: number): string => addDays(weekOf(dayKey(now)), 7);

/** The Monday (`YYYY-MM-DD`) of the world week that `day` is in. */
export function weekOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** When world day `day` starts, in ms. The world's clock is one or two hours ahead of UTC. */
export function dayStart(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const midnight = Date.UTC(y!, m! - 1, d!);
  for (const hours of [-2, -1, 0]) {
    const at = midnight + hours * 3_600_000;
    if (dayKey(at) === day) return at;
  }
  return midnight;
}

/**
 * When `week`'s ladder opens: its Monday at 08:00, world time. The clocks change on Sundays, never
 * on a Monday morning, so it's always 8 hours after that Monday's midnight.
 */
export const opensAt = (week: string): number => dayStart(week) + OPENS_AT_HOUR * 3_600_000;

/**
 * The week the raid shows at `now`. Usage is stored per world day, so a week's damage is whole days
 * from Monday's midnight, but the town gets the night off: until Monday 08:00 it's still last
 * week, as it ended (its kills paid, its last boss standing), and the new ladder appears at 08:00
 * with Monday's early tokens already in it. Everything else (the history, wallets) follows this
 * too, so nobody is paid for a kill before the gate opens and shows it.
 */
export function raidWeekAt(now: number): string {
  const week = weekOf(dayKey(now));
  return now < opensAt(week) ? addDays(week, -7) : week;
}

/** A boss that fell, and the raiders paid for it. */
export interface Kill {
  rung: number;
  boss: RungBoss;
  /** The world day it fell. */
  day: string;
  /** What each raider got. */
  coins: number;
  /** Everyone with `RAIDER_AT` damage that week up to and including `day`. */
  raiders: number[];
}

export interface RaidWeek {
  week: string;
  /** Rung 1's HP; rung n has `rungHp(hp, n)`. */
  hp: number;
  /** Everything the town hit that week. */
  damage: number;
  /** The bosses that fell, in order. */
  kills: Kill[];
  /** The rung still standing, and how much of its HP has been hit (the overflow included). */
  current: { boss: RungBoss; hp: number; damage: number };
  /** Damage per player, highest first. */
  raiders: { userId: number; damage: number }[];
}

/** One week's ladder, from its days (all in that week). */
export function ladder(week: string, hp: number, days: readonly RaidDay[]): RaidWeek {
  const byDay = new Map<string, RaidDay[]>();
  for (const d of days) byDay.set(d.day, [...(byDay.get(d.day) ?? []), d]);
  const perUser = new Map<number, number>();
  const kills: Kill[] = [];
  let rung = 1;
  let pool = 0;
  let total = 0;
  for (const day of [...byDay.keys()].sort()) {
    for (const d of byDay.get(day)!) {
      const hit = dayDamage(d);
      perUser.set(d.userId, (perUser.get(d.userId) ?? 0) + hit);
      pool += hit;
      total += hit;
    }
    // A big day can bring down several, all on that day, in order.
    while (pool >= rungHp(hp, rung)) {
      pool -= rungHp(hp, rung);
      kills.push({
        rung,
        boss: bossAt(rung),
        day,
        coins: rewardFor(rung),
        raiders: [...perUser]
          .filter(([, n]) => n >= RAIDER_AT)
          .map(([userId]) => userId)
          .sort((a, b) => a - b),
      });
      rung++;
    }
  }
  return {
    week,
    hp,
    damage: total,
    kills,
    current: { boss: bossAt(rung), hp: rungHp(hp, rung), damage: pool },
    raiders: [...perUser]
      .map(([userId, damage]) => ({ userId, damage }))
      .sort((a, b) => b.damage - a.damage || a.userId - b.userId),
  };
}

/** The first raid's rung 1 HP so far: from the damage the week before `start` (`hpFor`). */
export const firstHp = (days: readonly RaidDay[], start: string): number => {
  const before = addDays(start, -7);
  return hpFor(days.filter((d) => weekOf(d.day) === before).reduce((n, d) => n + dayDamage(d), 0));
};

/**
 * Every raid from the first, `start` (a Monday), to the week shown at `now` (`raidWeekAt`), oldest
 * first; none before `start` opens. The first raid's HP comes from the damage the week before it
 * (`firstHp`); every week after is 10% tougher than the last (`weekHp`), whatever the town did.
 */
export function raidWeeks(days: readonly RaidDay[], now: number, start: string): RaidWeek[] {
  const current = raidWeekAt(now);
  const byWeek = new Map<string, RaidDay[]>();
  for (const d of days) {
    const w = weekOf(d.day);
    if (w > current) continue;
    byWeek.set(w, [...(byWeek.get(w) ?? []), d]);
  }
  const first = firstHp(days, start);
  const out: RaidWeek[] = [];
  for (let week = start; week <= current; week = addDays(week, 7))
    out.push(ladder(week, weekHp(first, out.length), byWeek.get(week) ?? []));
  return out;
}

/** What `userId` got for the kills in `weeks`. */
export const raidCoins = (weeks: readonly RaidWeek[], userId: number): number =>
  weeks.reduce((n, w) => n + w.kills.reduce((m, k) => m + (k.raiders.includes(userId) ? k.coins : 0), 0), 0);

/**
 * A raider's war desk in the dungeon, of `seats`: the one their id hashes to, or the next free one
 * round the room, so the same person keeps the same desk across reloads while there's room.
 */
export function seatFor(userId: number, taken: ReadonlySet<number>, seats: number): number {
  let h = Math.imul(userId ^ 0x5bd1e995, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  let seat = ((h ^ (h >>> 13)) >>> 0) % seats;
  while (taken.has(seat)) seat = (seat + 1) % seats;
  return seat;
}
