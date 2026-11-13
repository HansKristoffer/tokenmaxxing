/**
 * The tiles we have just walked off. The server tells everyone in the room where we are, us included, a
 * round trip and up to a tick after each step. By then a runner (a tile every 130 ms) is past that tile:
 * with 200 ms to the server they are two tiles on, and taking the old tile as the server's word pulled them
 * back to it, again and again. A tile on the trail is our own step coming back, not the server moving us.
 */
export interface Left {
  x: number;
  y: number;
  at: number;
}

/** How long a tile stays ours to ignore: longer than any connection a game is playable on. */
export const TRAIL_MS = 2_000;

/** We stepped off (x, y) at `now`. */
export function leave(trail: Left[], x: number, y: number, now: number): void {
  while (trail.length > 0 && now - trail[0]!.at > TRAIL_MS) trail.shift();
  trail.push({ x, y, at: now });
}

/**
 * Whether the server saying we are at (x, y) is only one of our own steps: where we stand, a tile from it
 * (the step we are taking), or somewhere we stood within `TRAIL_MS`.
 */
export function ownStep(
  trail: readonly Left[],
  me: { x: number; y: number },
  x: number,
  y: number,
  now: number,
): boolean {
  if (Math.abs(x - me.x) + Math.abs(y - me.y) <= 1) return true;
  return trail.some((t) => t.x === x && t.y === y && now - t.at <= TRAIL_MS);
}
