import { type FishCatch, type FishingEntry, fishById } from "@tokenmaxxing/core/fishing.ts";
import { UserError } from "rivetkit";
import { all, type Sql } from "../actors/shared.ts";

export async function migrateFishing(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS fishing_journal (
    user_id INTEGER NOT NULL, fish TEXT NOT NULL, count INTEGER NOT NULL, cm INTEGER NOT NULL,
    PRIMARY KEY (user_id, fish)) WITHOUT ROWID`);
}
export function fishingJournal(sql: Sql, userId: number): Promise<FishingEntry[]> {
  return all<FishingEntry>(
    sql,
    "SELECT fish, count, cm FROM fishing_journal WHERE user_id = ? ORDER BY fish",
    userId,
  );
}
/** Called only by the world after an on-time reel. cm keeps the personal best. */
export async function recordFish(sql: Sql, userId: number, caught: FishCatch): Promise<FishingEntry[]> {
  const fish = caught && fishById(caught.fish);
  if (!fish || !Number.isInteger(caught.cm) || caught.cm < fish.min || caught.cm > fish.max)
    throw new UserError("Invalid catch.", { code: "invalid_catch" });
  await sql.execute(
    `INSERT INTO fishing_journal (user_id, fish, count, cm) VALUES (?, ?, 1, ?)
    ON CONFLICT (user_id, fish) DO UPDATE SET count = count + 1, cm = MAX(cm, excluded.cm)`,
    userId,
    caught.fish,
    caught.cm,
  );
  return fishingJournal(sql, userId);
}
