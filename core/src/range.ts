/** Every range is half-open `[since, until)` in unix-ms. */
export interface Range {
  since: number;
  until: number;
}

export const DAY_MS = 86_400_000;

export const RANGES = ["today", "7d", "30d", "all"] as const;
export type RangeKey = (typeof RANGES)[number];

export const isRangeKey = (s: string): s is RangeKey => (RANGES as readonly string[]).includes(s);

/**
 * `today` is the viewer's local day, so the client passes its UTC offset
 * (`tzOffsetMin`, as returned by `Date#getTimezoneOffset`). Rolling ranges
 * are floored to the minute so polls within one minute share a result.
 */
export function resolveRange(key: RangeKey, nowMs: number, tzOffsetMin = 0): Range {
  const until = Math.floor(nowMs / 60_000) * 60_000 + 60_000;
  switch (key) {
    case "today": {
      const localNow = nowMs - tzOffsetMin * 60_000;
      const localMidnight = Math.floor(localNow / DAY_MS) * DAY_MS;
      return { since: localMidnight + tzOffsetMin * 60_000, until };
    }
    case "7d":
      return { since: until - 7 * DAY_MS, until };
    case "30d":
      return { since: until - 30 * DAY_MS, until };
    case "all":
      return { since: 0, until };
  }
}

/** A calendar day in an IANA timezone: `key` is `YYYY-MM-DD`, `[since, until)` its unix-ms bounds. */
export interface Day extends Range {
  key: string;
}

const partsFormat = new Map<string, Intl.DateTimeFormat>();

/** Wall-clock parts of `ms` in `tz`. */
function wallClock(ms: number, tz: string) {
  let f = partsFormat.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partsFormat.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const { type, value } of f.formatToParts(ms)) p[type] = Number(value);
  return { y: p.year!, m: p.month!, d: p.day!, h: p.hour!, min: p.minute!, s: p.second! };
}

/** Offset of `tz` from UTC at instant `ms`, in ms (Copenhagen summer → +2h). */
export function tzOffset(ms: number, tz: string): number {
  const w = wallClock(ms, tz);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - Math.floor(ms / 1000) * 1000;
}

/** Unix ms of local midnight starting the (possibly overflowing) date y-m-d in `tz`. */
function midnight(y: number, m: number, d: number, tz: string): number {
  const utc = Date.UTC(y, m - 1, d);
  // Two passes: the offset at the guess can differ from the offset at the answer across DST.
  const guess = utc - tzOffset(utc, tz);
  return utc - tzOffset(guess, tz);
}

export const isTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** The local day containing `ms` in `tz`. */
export function dayIn(ms: number, tz: string): Day {
  const { y, m, d } = wallClock(ms, tz);
  const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { key, since: midnight(y, m, d, tz), until: midnight(y, m, d + 1, tz) };
}

/** Local hour (0–23) of `ms` in `tz`. */
export const hourIn = (ms: number, tz: string): number => wallClock(ms, tz).h;

/** The day before `day` in the same timezone. */
export const dayBefore = (day: Day, tz: string): Day => dayIn(day.since - 1, tz);

/** `YYYY-MM-DD` shifted by `n` days (pure calendar math, no timezone). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}
