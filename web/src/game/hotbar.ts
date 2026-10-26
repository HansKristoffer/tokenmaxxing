/**
 * The hotbar's rules, pure: which pieces fill the nine slots, how selection wraps, and what to hold after a
 * piece goes down. The state and the keys are `hotbar-state.ts`; the bar is `hud/Hotbar.tsx`.
 */

export const HOTBAR_SIZE = 9;

export type Row = { item: string; count: number };

/** Most recently placed first, then the larger stack, then by name. Only furniture, only what is held. */
export function orderSlots(
  rows: readonly Row[],
  recent: readonly string[],
  nameOf: (item: string) => string = (i) => i,
  size = HOTBAR_SIZE,
): string[] {
  const rank = (item: string) => {
    const i = recent.indexOf(item);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };
  return rows
    .filter((r) => r.item.startsWith("furn.") && r.count > 0)
    .sort(
      (a, b) =>
        rank(a.item) - rank(b.item) ||
        b.count - a.count ||
        nameOf(a.item).localeCompare(nameOf(b.item)) ||
        a.item.localeCompare(b.item),
    )
    .slice(0, size)
    .map((r) => r.item);
}

/** `i` moved by `delta` around a ring of `len`. */
export function wrap(i: number, delta: number, len: number): number {
  return len <= 0 ? 0 : (((i + delta) % len) + len) % len;
}

/** The slot's item after stepping `delta` from `current` (null: nothing held, so the first, or the last backwards). */
export function cycle(slots: readonly string[], current: string | null, delta: number): string | null {
  if (slots.length === 0) return null;
  const at = current === null ? -1 : slots.indexOf(current);
  if (at < 0) return delta > 0 ? slots[0]! : slots[slots.length - 1]!;
  return slots[wrap(at, delta, slots.length)]!;
}

/**
 * What to hold after `placed` went down: the same kind while one is left, else the next filled slot after it
 * (`before` is the slots as they were), else nothing. `counts` is what the bag holds now.
 */
export function nextAfterPlace(
  before: readonly string[],
  placed: string,
  counts: Readonly<Record<string, number>>,
): string | null {
  if ((counts[placed] ?? 0) > 0) return placed;
  const at = Math.max(0, before.indexOf(placed));
  for (let k = 1; k < before.length; k++) {
    const item = before[(at + k) % before.length]!;
    if (item !== placed && (counts[item] ?? 0) > 0) return item;
  }
  return null;
}

/** The recent list with `item` first (kept short). */
export function pushRecent(recent: readonly string[], item: string, max = 32): string[] {
  return [item, ...recent.filter((i) => i !== item)].slice(0, max);
}

/** How many slots fit in `width` px between a reserved left edge and the right margin (0 when under 2). */
export function slotsFit(width: number, reserve: number, slot = 48, margin = 12): number {
  const n = Math.min(HOTBAR_SIZE, Math.floor((width - reserve - margin) / slot));
  return n < 2 ? 0 : n;
}
