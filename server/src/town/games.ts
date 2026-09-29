/** Game stats: who played what, where they placed and what they won, for player cards and the Games board. */
import { dayKey, type RangeKey, rangeDays } from "@tokenmaxxing/core/range.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { all, one, type Sql } from "../actors/shared.ts";
import { lookOf, type UserRow } from "./users.ts";

export interface Placed {
  userId: number;
  /** 1 for the winners. */
  place: number;
  /** Coins taken home from the pot. */
  won: number;
}

export interface GameStats {
  played: number;
  wins: number;
  /** Coins won minus stakes. */
  net: number;
  biggestPot: number;
}

export interface GamePlayer extends GameStats {
  userId: number;
  name: string;
  look: Look;
}

export async function recordMatch(
  sql: Sql,
  matchId: number,
  game: string,
  stake: number,
  players: Placed[],
  now: number,
): Promise<void> {
  const pot = stake * players.length;
  for (const p of players)
    await sql.execute(
      `INSERT OR IGNORE INTO match_players (match_id, user_id, game, place, stake, won, pot, day, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      matchId,
      p.userId,
      game,
      p.place,
      stake,
      p.won,
      pot,
      dayKey(now),
      now,
    );
}

const STATS = `COUNT(*) AS played, SUM(place = 1) AS wins, SUM(won - stake) AS net,
  COALESCE(MAX(CASE WHEN place = 1 THEN pot END), 0) AS biggestPot`;

export async function gameStats(sql: Sql, userId: number): Promise<GameStats | null> {
  const s = await one<GameStats>(sql, `SELECT ${STATS} FROM match_players WHERE user_id = ?`, userId);
  return s && s.played > 0 ? s : null;
}

/** Everyone who played in the range; the client ranks them by coins won, win rate or biggest pot. */
export async function gameBoard(sql: Sql, range: RangeKey, now: number): Promise<GamePlayer[]> {
  const { from, to } = rangeDays(range, now);
  const rows = await all<GameStats & UserRow>(
    sql,
    `SELECT u.id, u.name, u.company_id AS companyId, u.look, ${STATS}
     FROM match_players m JOIN users u ON u.id = m.user_id
     WHERE m.day >= ? AND m.day <= ? GROUP BY u.id`,
    from ?? "",
    to,
  );
  return rows.map((r) => ({
    userId: r.id,
    name: r.name,
    look: lookOf(r),
    played: r.played,
    wins: r.wins,
    net: r.net,
    biggestPot: r.biggestPot,
  }));
}
