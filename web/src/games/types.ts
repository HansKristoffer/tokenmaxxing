import type { MatchInfo } from "@tokenmaxxing/core/games/wire.ts";

/** What every game's component gets: its view, who you are, and a way to move. */
export interface GameProps<View> {
  view: View;
  info: MatchInfo;
  /** You, when you're playing; null when watching. */
  you: number | null;
  /** The server's clock, now. */
  now: number;
  move: (m: unknown) => void;
}
