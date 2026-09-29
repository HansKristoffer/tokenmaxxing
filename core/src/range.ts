/** The whole world runs on one clock: "today" and daily charts are Copenhagen days. */
const WORLD_TZ = "Europe/Copenhagen";

export const RANGES = ["today", "7d", "30d", "all"] as const;
export type RangeKey = (typeof RANGES)[number];

export const isRangeKey = (s: unknown): s is RangeKey => (RANGES as readonly unknown[]).includes(s);

const partsFormat = new Map<string, Intl.DateTimeFormat>();

/** Wall-clock date of `ms` in `tz`. */
function wallDate(ms: number, tz: string) {
  let f = partsFormat.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" });
    partsFormat.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const { type, value } of f.formatToParts(ms)) p[type] = Number(value);
  return { y: p.year!, m: p.month!, d: p.day! };
}

/** `YYYY-MM-DD` of the world day containing `ms`. */
export function dayKey(ms: number, tz = WORLD_TZ): string {
  const { y, m, d } = wallDate(ms, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` shifted by `n` days (pure calendar math, no timezone). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Inclusive world-day bounds of a range; `from` is null for all time. */
export function rangeDays(key: RangeKey, now: number): { from: string | null; to: string } {
  const to = dayKey(now);
  const back = { today: 0, "7d": 6, "30d": 29, all: null }[key];
  return { from: back === null ? null : addDays(to, -back), to };
}
