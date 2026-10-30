import { UserError } from "rivetkit";
import { all, type Sql } from "../actors/shared.ts";

export interface RetroScore {
  userId: number;
  name: string;
  score: number;
  level: number;
}

export function retroGame(value: unknown): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0 || value > 3)
    throw new UserError("Unknown cabinet.", { code: "invalid_game" });
  return value;
}

export async function recordRetro(
  sql: Sql,
  userId: number,
  game: unknown,
  score: unknown,
  level: unknown,
  now: number,
): Promise<void> {
  const id = retroGame(game);
  if (
    typeof score !== "number" ||
    !Number.isSafeInteger(score) ||
    score < 1 ||
    score > 10000000 ||
    typeof level !== "number" ||
    !Number.isSafeInteger(level) ||
    level < 1 ||
    level > 10000
  )
    throw new UserError("Invalid arcade score.", { code: "invalid_score" });
  await sql.execute(
    `INSERT INTO retro_scores (user_id, game, score, level, at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, game) DO UPDATE SET score = excluded.score, level = excluded.level, at = excluded.at
    WHERE excluded.score > retro_scores.score`,
    userId,
    id,
    score,
    level,
    now,
  );
}

export async function retroBoard(sql: Sql, game: unknown): Promise<RetroScore[]> {
  return all<RetroScore>(
    sql,
    `SELECT u.id AS userId, u.name, r.score, r.level FROM retro_scores r
    JOIN users u ON u.id = r.user_id WHERE r.game = ? ORDER BY r.score DESC, r.at ASC, r.user_id ASC LIMIT 20`,
    retroGame(game),
  );
}
