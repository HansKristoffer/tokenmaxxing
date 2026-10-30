import { festiveAt } from "./festive.ts";
import { NYTAR_BLOCKS } from "./nytar.ts";

/**
 * Whether tile (x, y) is one of New Year's Eve's props (the watchman, the clock, the buffet, the chair) while the
 * theme is on by the real clock: nobody walks onto it. The server's `onProp` asks this at `Date.now()`; the client
 * blocks the same tiles while its own theme is on (`game/nytar.ts`). In its own file because `festive.ts` imports
 * `nytar.ts` for the watchman.
 */
export const isNytarProp = (x: number, y: number, ms: number): boolean =>
  NYTAR_BLOCKS.some((b) => b.x === x && b.y === y) && festiveAt(ms)?.id === "nytar";
