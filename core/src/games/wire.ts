/** What the arcade and matches send to clients. */
import type { ChatLine } from "../world.ts";
import type { Split } from "./payouts.ts";
import type { GameId, Options, Outcome } from "./types.ts";

/** A line in a match's own chat, for its players and whoever is watching. */
export type MatchChatLine = Omit<ChatLine, "room">;

export interface Seat {
  userId: number;
  name: string;
}

/** A game waiting for players. */
export interface TableView {
  id: number;
  game: GameId;
  host: number;
  stake: number;
  seats: number;
  split: Split;
  /** Anyone can take a free seat; otherwise only the invited. */
  open: boolean;
  options: Options;
  seated: Seat[];
  invited: (Seat & { expiresAt: number; counter: number | null })[];
  createdAt: number;
}

/** A game being played, as the lobby and the world see it. */
export interface MatchInfo {
  id: number;
  game: GameId;
  players: Seat[];
  stake: number;
  pot: number;
  split: Split;
  options: Options;
  startedAt: number;
  betsCloseAt: number;
  /** Side bets so far: the pool on each player. */
  bets: Record<number, number>;
  /** Set once it's over. */
  outcome: Outcome | null;
}

export interface Lobby {
  /** Open tables, plus private ones you're at or invited to. */
  tables: TableView[];
  /** Games being played (and just finished), for watching and betting. */
  matches: MatchInfo[];
  /** Where you are: at a table, in a match, or neither. */
  me: { table: number | null; match: number | null; bets: Record<number, { on: number; amount: number }> };
}

/** One match as one viewer sees it, pushed on every change. */
export interface Frame<View = unknown> {
  info: MatchInfo;
  /** You, when you're playing; null when watching. */
  you: number | null;
  view: View;
  /** The server's clock, so countdowns line up. */
  now: number;
  /** People watching who aren't playing. */
  watchers: number;
}
