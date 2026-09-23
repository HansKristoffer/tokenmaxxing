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
