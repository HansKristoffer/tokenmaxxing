/**
 * Trophies on the shelf in your office: silly coincidences in your own usage (a PR at 3 AM, a day total
 * that's a palindrome, a PR whose hash spells "dead"). Like badges, worked out on read from facts and
 * never stored or claimed; unlike badges, each says the world day it was first earned. No coins: a
 * trophy is for showing off, so there's nothing to gain from faking one.
 */
import { sortBy } from "hanzio";
import { addDays, dayKey, worldClock } from "./range.ts";

/** One hour of a player's events: its start (ms, on the hour) and what happened in it. */
export interface HourFacts {
  hour: number;
  tokens: number;
  prompts: number;
  /** The tools (`events.source`) that had tokens in it. */
  sources?: readonly string[];
}

/** A PR they opened: when, and its message id (the sha256 of its URL, from the GitHub source). */
export interface PrFacts {
  at: number;
  hash: string;
}

export interface TrophyFacts {
  hours: readonly HourFacts[];
  prs: readonly PrFacts[];
  /** Today's world day: a day's total only counts once the day is over. */
  today: string;
}

interface TrophyDef {
  id: string;
  name: string;
  /** How it's earned, for the shelf's list. */
  how: string;
  /** The world day it was first earned, or null. */
  earned: (f: Facts) => string | null;
}

/** An earned trophy, as the server sends it. */
export interface Trophy {
  id: string;
  day: string;
}

/** A day's tokens and the world-clock hours it had tokens in. */
interface DayFacts {
  day: string;
  tokens: number;
  hours: Set<number>;
  sources: Set<string>;
}

/** What the checks read: hours and PRs placed on the world clock, and per-day totals, oldest first. */
interface Facts {
  hours: (HourFacts & { day: string; weekday: number; clock: number })[];
  prs: (PrFacts & { day: string; weekday: number; clock: number })[];
  days: DayFacts[];
  /** Finished days only: today's total is still moving. */
  done: DayFacts[];
}

const onClock = <T extends { at: number }>(r: T) => ({ ...r, day: dayKey(r.at), ...clockOf(r.at) });
const clockOf = (ms: number) => {
  const c = worldClock(ms);
  return { weekday: c.day, clock: c.hour };
};

function factsOf(f: TrophyFacts): Facts {
  const hours = f.hours
    .filter((h) => h.tokens > 0 || h.prompts > 0)
    .map((h) => ({ ...h, day: dayKey(h.hour), ...clockOf(h.hour) }))
    .sort((a, b) => a.hour - b.hour);
  const days = new Map<string, DayFacts>();
  for (const h of hours) {
    if (h.tokens === 0) continue;
    const d = days.get(h.day) ?? { day: h.day, tokens: 0, hours: new Set(), sources: new Set() };
    d.tokens += h.tokens;
    d.hours.add(h.clock);
    for (const s of h.sources ?? []) d.sources.add(s);
    days.set(h.day, d);
  }
  const all = [...days.values()];
  return {
    hours,
    prs: sortBy(f.prs.map(onClock), "at"),
    days: all,
    done: all.filter((d) => d.day < f.today),
  };
}

const first = <T extends { day: string }>(rows: readonly T[], ok: (r: T) => boolean): string | null =>
  rows.find(ok)?.day ?? null;

const isPalindrome = (s: string) => s.length > 1 && s === [...s].reverse().join("");

/** A date that reads the same backwards in a common way of writing it: 20211202, 6/20/26, 2.6.26. */
export function palindromeDate(day: string): boolean {
  const [y, m, d] = day.split("-") as [string, string, string];
  const yy = y.slice(2);
  const [mn, dn] = [Number(m), Number(d)];
  return [y + m + d, d + m + yy, m + d + yy, `${dn}${mn}${yy}`, `${mn}${dn}${yy}`].some(isPalindrome);
}

/** The day the first run of `n` days in a row with tokens got to `n`. */
function streakDay(days: readonly DayFacts[], n: number): string | null {
  let run = 0;
  let prev = "";
  for (const { day } of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    prev = day;
    if (run >= n) return day;
  }
  return null;
}

/** The Sunday that ended the first Monday-to-Sunday week with tokens on all seven days. */
function perfectWeek(days: readonly DayFacts[]): string | null {
  const have = new Set(days.map((d) => d.day));
  for (const { day } of days) {
    // Noon UTC is the same date everywhere, so its weekday is the day's.
    if (new Date(`${day}T12:00:00Z`).getUTCDay() !== 1) continue;
    if ([1, 2, 3, 4, 5, 6].every((i) => have.has(addDays(day, i)))) return addDays(day, 6);
  }
  return null;
}

// The shelf shows them in this order, seven to a shelf: append new ones, so nothing moves.
export const TROPHIES: readonly TrophyDef[] = [
  {
    id: "million",
    name: "Millionaire",
    how: "Burn 1M tokens in one day",
    earned: (f) => first(f.days, (d) => d.tokens >= 1e6),
  },
  {
    id: "billion",
    name: "Billionaire",
    how: "Burn 1B tokens in one day",
    earned: (f) => first(f.days, (d) => d.tokens >= 1e9),
  },
  {
    id: "streak",
    name: "Seven-Day Streak",
    how: "Tokens seven days in a row",
    earned: (f) => streakDay(f.days, 7),
  },
  {
    id: "3am",
    name: "3 AM PR",
    how: "Open a PR between 3 and 4 AM (Copenhagen)",
    earned: (f) => first(f.prs, (p) => p.clock === 3),
  },
  {
    id: "friday",
    name: "Friday Deploy",
    how: "Open a PR on a Friday after 5 PM",
    earned: (f) => first(f.prs, (p) => p.weekday === 5 && p.clock >= 17),
  },
  {
    id: "newyear",
    name: "New Year, New PR",
    how: "Open a PR on 1 January",
    earned: (f) => first(f.prs, (p) => p.day.endsWith("-01-01")),
  },
  {
    id: "holiday",
    name: "Holiday Shipper",
    how: "Open a PR on 24, 25 or 26 December",
    earned: (f) => first(f.prs, (p) => /-12-2[456]$/.test(p.day)),
  },
  {
    id: "zeros",
    name: "Leading Zeros",
    how: "A PR whose hash starts with 00",
    earned: (f) => first(f.prs, (p) => p.hash.startsWith("00")),
  },
  {
    id: "deadbeef",
    name: "Dead Beef",
    how: "A PR whose hash has dead or beef in it",
    earned: (f) => first(f.prs, (p) => /dead|beef/.test(p.hash)),
  },
  {
    id: "c0ffee",
    name: "C0FFEE",
    how: "A PR whose hash has c0ffee in it",
    earned: (f) => first(f.prs, (p) => p.hash.includes("c0ffee")),
  },
  {
    id: "earlybird",
    name: "Early Bird",
    how: "Burn tokens between 5 and 6 AM",
    earned: (f) => first(f.hours, (h) => h.tokens > 0 && h.clock === 5),
  },
  {
    id: "midnight",
    name: "Midnight Oil",
    how: "Burn tokens in every hour from midnight to 5 AM",
    earned: (f) => first(f.days, (d) => [0, 1, 2, 3, 4].every((h) => d.hours.has(h))),
  },
  {
    id: "allday",
    name: "Round the Clock",
    how: "Burn tokens in all 24 hours of one day",
    earned: (f) => first(f.days, (d) => d.hours.size >= 24),
  },
  {
    id: "weekend",
    name: "Weekend Warrior",
    how: "Burn tokens on a Saturday or Sunday",
    earned: (f) => first(f.hours, (h) => h.tokens > 0 && (h.weekday === 0 || h.weekday === 6)),
  },
  {
    id: "palindate",
    name: "Palindrome Day",
    how: "Burn tokens on a date that reads the same backwards (6/20/26)",
    earned: (f) => first(f.days, (d) => palindromeDate(d.day)),
  },
  {
    id: "palintotal",
    name: "Palindrome Total",
    how: "Finish a day on a palindrome total (12,344,321 tokens)",
    earned: (f) => first(f.done, (d) => d.tokens >= 1000 && isPalindrome(String(d.tokens))),
  },
  {
    id: "round",
    name: "Round Number",
    how: "Finish a day on a total ending in 000",
    earned: (f) => first(f.done, (d) => d.tokens >= 1000 && d.tokens % 1000 === 0),
  },
  {
    id: "jackpot",
    name: "Jackpot",
    how: "Finish a day on a total ending in 777",
    earned: (f) => first(f.done, (d) => d.tokens % 1000 === 777),
  },
  {
    id: "leet",
    name: "1337",
    how: "Finish a day on a total with 1337 in it",
    earned: (f) => first(f.done, (d) => String(d.tokens).includes("1337")),
  },
  {
    id: "piday",
    name: "Pi Day",
    how: "Burn tokens on 14 March",
    earned: (f) => first(f.days, (d) => d.day.endsWith("-03-14")),
  },
  {
    id: "storm",
    name: "Prompt Storm",
    how: "Send 60 prompts in one hour",
    earned: (f) => first(f.hours, (h) => h.prompts >= 60),
  },
  {
    id: "switch",
    name: "Switch-Hitter",
    how: "Use three different tools in one day",
    earned: (f) => first(f.days, (d) => d.sources.size >= 3),
  },
  {
    id: "perfectweek",
    name: "Perfect Week",
    how: "Tokens on all seven days, Monday to Sunday",
    earned: (f) => perfectWeek(f.days),
  },
];

/** Every trophy earned, in shelf order, with the day it was first earned. */
export function trophiesFor(f: TrophyFacts): Trophy[] {
  const facts = factsOf(f);
  return TROPHIES.flatMap((t) => {
    const day = t.earned(facts);
    return day ? [{ id: t.id, day }] : [];
  });
}
