import { RUN_LEVELS } from "@tokenmaxxing/core/prestige.ts";
import { trophyItems } from "@tokenmaxxing/core/prestige-furniture.ts";
import {
  canPrestige,
  NO_PRESTIGE,
  type PrestigeBadge,
  type PrestigeTaken,
  type PrestigeView,
  playerPrestigeView,
  rewardsUnlocked,
  runCoinsPaid,
  runProgress,
} from "@tokenmaxxing/core/prestige-run.ts";
import { UserError } from "rivetkit";
import { all, type Sql } from "../actors/shared.ts";
import { grantOnce } from "./rewards.ts";
import { among, type Ids, tokensIn } from "./users.ts";

/**
 * The prestiges taken: a row per rank, with the lifetime tokens at the moment it was chosen. A run's level,
 * its rewards and its coins are all derived from these (`core/prestige-run.ts`), never stored.
 */
export async function migratePrestige(sql: Sql): Promise<void> {
  await sql.execute(`CREATE TABLE IF NOT EXISTS prestiges (
    user_id INTEGER NOT NULL, rank INTEGER NOT NULL, started_at INTEGER NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (user_id, rank)) WITHOUT ROWID`);
}

/** `userId`'s prestiges, first to latest. */
export async function prestigesOf(sql: Sql, userId: number): Promise<PrestigeTaken[]> {
  return all<PrestigeTaken>(
    sql,
    "SELECT started_at AS startedAt FROM prestiges WHERE user_id = ? ORDER BY rank",
    userId,
  );
}

/** Everyone's prestiges (only those who took one), for the admin page's coins. */
async function prestigesAmong(sql: Sql, userIds: Ids): Promise<Map<number, PrestigeTaken[]>> {
  const [where, ...args] = among("user_id", userIds);
  const rows = await all<{ userId: number; startedAt: number }>(
    sql,
    `SELECT user_id AS userId, started_at AS startedAt FROM prestiges WHERE ${where} ORDER BY user_id, rank`,
    ...args,
  );
  const out = new Map<number, PrestigeTaken[]>();
  for (const r of rows) out.set(r.userId, [...(out.get(r.userId) ?? []), { startedAt: r.startedAt }]);
  return out;
}

/** What others see of each of `userIds`, given their lifetime tokens. Only those who took one are in it: read `?? NO_PRESTIGE`. */
export async function badgesOf(
  sql: Sql,
  userIds: Ids,
  lifetime: ReadonlyMap<number, number>,
): Promise<Map<number, PrestigeBadge>> {
  const out = new Map<number, PrestigeBadge>();
  for (const [id, taken] of await prestigesAmong(sql, userIds))
    out.set(id, {
      rank: taken.length,
      runLevel: runProgress(lifetime.get(id) ?? 0, taken[taken.length - 1]!.startedAt).level,
    });
  return out;
}

export const badgeOf = (badges: ReadonlyMap<number, PrestigeBadge>, id: number): PrestigeBadge =>
  badges.get(id) ?? NO_PRESTIGE;

/** Coins the prestiges are worth: every finished run in full, the current one as far as it has got. */
export function prestigeCoins(taken: readonly PrestigeTaken[], lifetime: number): number {
  let sum = 0;
  taken.forEach((t, i) => {
    sum += runCoinsPaid(i < taken.length - 1 ? RUN_LEVELS : runProgress(lifetime, t.startedAt).level);
  });
  return sum;
}

/** Every user's prestige coins, for `balances`. */
export async function prestigeCoinsAll(sql: Sql, lifetime: ReadonlyMap<number, number>) {
  const out = new Map<number, number>();
  for (const [id, taken] of await prestigesAmong(sql, "all"))
    out.set(id, prestigeCoins(taken, lifetime.get(id) ?? 0));
  return out;
}

export async function prestigeView(sql: Sql, userId: number): Promise<PrestigeView> {
  const lifetime = (await tokensIn(sql, [userId])).get(userId) ?? 0;
  return playerPrestigeView(lifetime, await prestigesOf(sql, userId));
}

/**
 * Chooses the next prestige now. Eligibility is checked again here against the stored rows, and a rank is
 * written once (its key), so a double click or two tabs take one. Run it serialized with the coin writes.
 */
export async function takeNextPrestige(sql: Sql, userId: number, now: number): Promise<PrestigeView> {
  const lifetime = (await tokensIn(sql, [userId])).get(userId) ?? 0;
  const taken = await prestigesOf(sql, userId);
  if (!canPrestige(lifetime, taken)) throw new UserError("Not ready for that yet.", { code: "not_ready" });
  const fresh = await all(
    sql,
    "INSERT INTO prestiges (user_id, rank, started_at, at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING rank",
    userId,
    taken.length + 1,
    lifetime,
    now,
  );
  if (fresh.length === 0) throw new UserError("Not ready for that yet.", { code: "not_ready" });
  await grantPrestige(sql, userId, now);
  return prestigeView(sql, userId);
}

/**
 * Puts the wearables the runs have reached into the bag, each once (`rewards`, key `prestige:<item>`; they
 * aren't tradeable). Every sync asks: one read of the rows, and a write only for what's new.
 */
export async function grantPrestige(sql: Sql, userId: number, now: number): Promise<void> {
  const taken = await prestigesOf(sql, userId);
  if (taken.length === 0) return;
  const lifetime = (await tokensIn(sql, [userId])).get(userId) ?? 0;
  const had = new Set(
    (
      await all<{ item: string }>(
        sql,
        "SELECT item FROM rewards WHERE user_id = ? AND item LIKE 'prestige:%'",
        userId,
      )
    ).map((r) => r.item),
  );
  for (const [i, t] of taken.entries()) {
    const level = i < taken.length - 1 ? RUN_LEVELS : runProgress(lifetime, t.startedAt).level;
    for (const w of rewardsUnlocked(i + 1, level)) {
      if (!("itemId" in w) || had.has(`prestige:${w.itemId}`)) continue;
      if (await grantOnce(sql, userId, `prestige:${w.itemId}`))
        await sql.execute("INSERT INTO items (owner_id, item, at) VALUES (?, ?, ?)", userId, w.itemId, now);
    }
    // The trophy comes with the run's last level, as furniture for the office.
    for (const id of trophyItems(i + 1, level)) {
      if (had.has(`prestige:${id}`)) continue;
      if (await grantOnce(sql, userId, `prestige:${id}`))
        await sql.execute("INSERT INTO items (owner_id, item, at) VALUES (?, ?, ?)", userId, id, now);
    }
  }
}
