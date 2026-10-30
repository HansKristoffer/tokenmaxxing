import { festiveAt } from "@tokenmaxxing/core/festive.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { CANDY_BUCKET, dayKey, type Knock, TREAT_CANDY, treatAt } from "@tokenmaxxing/core/spooky.ts";
import { all, type Sql, scalar, type TxSql } from "../actors/shared.ts";
import { giveItem } from "./coins.ts";

/**
 * Trick-or-treat (`core/src/spooky.ts`): every door a player knocks on, a row a day (`halloween_knocks`), and
 * who knocked on every door in town in one night (`sugar_kings`, one row a year each). The knock that finishes
 * the round writes the king's row and gives the bucket hat in the same transaction, and the row is the year's
 * key: a second round, a restart or a race never gives a second hat.
 */
export async function migrateHalloween(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS halloween_knocks (
    user_id INTEGER NOT NULL, day TEXT NOT NULL, door TEXT NOT NULL, candy INTEGER NOT NULL,
    PRIMARY KEY (user_id, day, door)) WITHOUT ROWID`);
  await sql.execute(`CREATE TABLE IF NOT EXISTS sugar_kings (
    year INTEGER NOT NULL, user_id INTEGER NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (year, user_id)) WITHOUT ROWID`);
}

/** Whether doors open, on the real clock: the Halloween theme's nights (the 30th and 31st). */
export const trickOrTreatOn = (now: number): boolean => festiveAt(now)?.id === "halloween";

/**
 * `userId` knocks on `door`. `doors`: every doorstep's door in town now (`doorSteps`), so a house built or gone
 * since the evening began changes what "every door" is. Run it serialized, like the other bag writes.
 */
export async function knock(
  sql: TxSql,
  userId: number,
  door: string,
  doors: readonly string[],
  now: number,
): Promise<Knock> {
  const day = dayKey(now);
  return sql.transaction(async (tx) => {
    const treat = treatAt(door, day);
    const [fresh] = await all(
      tx,
      `INSERT INTO halloween_knocks (user_id, day, door, candy) VALUES (?, ?, ?, ?)
       ON CONFLICT DO NOTHING RETURNING door`,
      userId,
      day,
      door,
      TREAT_CANDY[treat],
    );
    const today = await all<{ door: string }>(
      tx,
      "SELECT door FROM halloween_knocks WHERE user_id = ? AND day = ?",
      userId,
      day,
    );
    const knocked = today.map((r) => r.door);
    const candy = await scalar(tx, "SELECT SUM(candy) AS n FROM halloween_knocks WHERE user_id = ?", userId);
    const out: Knock = { door, treat: fresh ? treat : null, candy, knocked, of: doors.length };
    const done = new Set(knocked);
    if (!fresh || doors.length === 0 || !doors.every((d) => done.has(d))) return out;
    const [king] = await all(
      tx,
      `INSERT INTO sugar_kings (year, user_id, day, at) VALUES (?, ?, ?, ?)
       ON CONFLICT DO NOTHING RETURNING year`,
      worldWall(now).y,
      userId,
      day,
      now,
    );
    if (!king) return out;
    await giveItem(tx, userId, CANDY_BUCKET, now);
    return { ...out, king: true };
  });
}

/** Halloweens `userId` was sugar king: the badge's fact. */
export const sugarKingsOf = (sql: Sql, userId: number): Promise<number> =>
  scalar(sql, "SELECT COUNT(*) AS n FROM sugar_kings WHERE user_id = ?", userId);
