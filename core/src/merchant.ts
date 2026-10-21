/**
 * The traveling merchant. A cart stands by the square from Thursday 08:00 until the week turns over,
 * Monday 08:00 (Copenhagen). Each week it sells `PER_WEEK` merchant editions (`editions.ts`), each a
 * print run of `supply` numbered copies for the whole town. The week, whether the cart is in and
 * what's on it all come from the clock; the server only keeps who bought which copy.
 */
import { EDITIONS, type Edition } from "./editions.ts";
import { addDays, dayKey, worldClock } from "./range.ts";

/** Editions on the cart each week. */
export const PER_WEEK = 4;
/** The week turns over on Monday at this hour. */
export const WEEK_HOUR = 8;
/** The cart comes on Thursday (at `WEEK_HOUR`) and stays until the week turns over. */
const ARRIVES = 4;

/**
 * Where the cart stands in town: its left wheel's tile, on the grass south-east of the square, below
 * the pølsevogn (`street.ts` `CART`, at (17, 4) and (18, 4)), so the two never stand on each other.
 */
export const CART_SPOT = { x: 17, y: 7 } as const;
/** The tiles it covers: three wide, two deep. The merchant stands just west of it. */
export const CART_W = 3;
export const CART_H = 2;

/** The week `now` is in: the date of its Monday (`YYYY-MM-DD`). Before 08:00 Monday is still last week. */
export function weekOf(now: number): string {
  const { day, hour } = worldClock(now);
  const back = ((day + 6) % 7) + (day === 1 && hour < WEEK_HOUR ? 7 : 0);
  return addDays(dayKey(now), -back);
}

/** Whether the cart is in town. */
export function cartOpen(now: number): boolean {
  const { day, hour } = worldClock(now);
  if (day === ARRIVES) return hour >= WEEK_HOUR;
  if (day === 1) return hour < WEEK_HOUR;
  return day === 5 || day === 6 || day === 0;
}

/** Weeks since the Monday 1970-01-05. */
const weekNumber = (week: string): number =>
  Math.round((Date.parse(`${week}T00:00:00Z`) - Date.parse("1970-01-05T00:00:00Z")) / (7 * 86_400_000));

/** A small stable hash, so everyone's cart is shuffled the same way. */
const hash = (a: number, b: number): number =>
  Math.imul(Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35), 0x27d4eb2f) >>> 0;

/** Weeks in one rotation: every edition is on the cart once in it. */
export const ROTATION = Math.ceil(EDITIONS.length / PER_WEEK);

/**
 * What the cart sells in `week`: the catalog is shuffled once per rotation and dealt out
 * `PER_WEEK` at a time, so nothing comes back until all of it has been round.
 */
export function lineup(week: string): Edition[] {
  const n = weekNumber(week);
  const round = Math.floor(n / ROTATION);
  const deck = EDITIONS.map((e, i) => ({ e, key: hash(round, i) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.e);
  const slot = n - round * ROTATION;
  return deck.slice(slot * PER_WEEK, slot * PER_WEEK + PER_WEEK);
}

/** "#3 of 20". */
export const editionLabel = (n: number, e: Pick<Edition, "supply">): string => `#${n} of ${e.supply}`;

/** Whether (x, y) is under the cart (in town): for E and for clicks. */
export const underCart = (x: number, y: number): boolean =>
  x >= CART_SPOT.x && x < CART_SPOT.x + CART_W && y >= CART_SPOT.y && y < CART_SPOT.y + CART_H;
