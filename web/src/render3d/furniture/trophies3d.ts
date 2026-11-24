import type { Trophy } from "@tokenmaxxing/core/trophies.ts";

/**
 * What is on the shelf in an office, from the real data (`town.trophies`, a player's earned trophies). The 3D
 * shelf is built from a set of ids, so a change is a new picture: `signature` is part of the room's key, and the
 * renderer builds the office again when it changes (rarely: a trophy is earned once).
 */

/** How often the shelf of the office you are in is asked for again (new syncs, new trophies). */
const REFRESH_MS = 60_000;

const shelves = new Map<number, { ids: ReadonlySet<string>; sig: string; at: number; asking: boolean }>();

/** The ids earned by `owner`, as last asked; empty until the first answer. */
export const earnedBy = (owner: number): ReadonlySet<string> => shelves.get(owner)?.ids ?? new Set<string>();

/** A string that changes when what is on `owner`'s shelf does. */
export const signature = (owner: number): string => shelves.get(owner)?.sig ?? "";

export const sigOf = (trophies: readonly Pick<Trophy, "id">[]): string =>
  trophies
    .map((t) => t.id)
    .sort()
    .join(",");

/**
 * Asks for `owner`'s shelf when it has not been, or is stale: at most one request in flight per owner.
 * Returns the settling promise when a request starts, or null when skipped.
 */
export function watchShelf(
  owner: number,
  now: number,
  ask: (owner: number) => Promise<Trophy[]>,
): Promise<void> | null {
  const s = shelves.get(owner);
  if (s && (s.asking || now - s.at < REFRESH_MS)) return null;
  const entry = s ?? { ids: new Set<string>(), sig: "", at: 0, asking: false };
  entry.asking = true;
  entry.at = now;
  shelves.set(owner, entry);
  return (
    ask(owner)
      .then((list) => {
        entry.ids = new Set(list.map((t) => t.id));
        entry.sig = sigOf(list);
      })
      // A failed ask keeps the shelf as it was, and the next ask comes after `REFRESH_MS` like any other.
      .catch(() => {})
      .finally(() => {
        entry.asking = false;
      })
  );
}
