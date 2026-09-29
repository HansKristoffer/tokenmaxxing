import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { coinsForTokens, type Item, PODIUM_COINS } from "@tokenmaxxing/core/shop.ts";
import { UserError } from "rivetkit";
import { all, type Sql } from "../actors/shared.ts";

export interface Wallet {
  balance: number;
  /** Coins from today's tokens so far. */
  today: number;
  /** Days finished in the top 3, newest first (the last 30 days). */
  wins: { day: string; place: number; coins: number }[];
  /** Shop item ids. */
  owned: string[];
}

export const ownedItems = async (sql: Sql, userId: number): Promise<string[]> =>
  (await all<{ item: string }>(sql, "SELECT item FROM purchases WHERE user_id = ? ORDER BY at", userId)).map(
    (r) => r.item,
  );

/**
 * Coins are worked out from usage every time rather than stored, so a late sync
 * still pays. Podium places count once a day is over.
 * ponytail: a late sync can also knock someone off a past podium after they spent
 * the bonus; the balance then reads short until they earn it back. Settle days into
 * a ledger if that ever matters.
 */
export async function wallet(sql: Sql, userId: number, now: number): Promise<Wallet> {
  const today = dayKey(now);
  const days = await all<{ day: string; tokens: number }>(
    sql,
    `SELECT day, SUM(input + output + cache_creation + cache_read) AS tokens
     FROM usage_daily WHERE user_id = ? GROUP BY day`,
    userId,
  );
  const places = await all<{ day: string; place: number }>(
    sql,
    `SELECT day, place FROM (
       SELECT user_id, day, ROW_NUMBER() OVER (PARTITION BY day ORDER BY SUM(input + output + cache_creation + cache_read) DESC, user_id) AS place
       FROM usage_daily WHERE day < ? GROUP BY user_id, day)
     WHERE user_id = ? AND place <= ? ORDER BY day DESC`,
    today,
    userId,
    PODIUM_COINS.length,
  );
  const [{ spent }] = (await all<{ spent: number | null }>(
    sql,
    "SELECT SUM(price) AS spent FROM purchases WHERE user_id = ?",
    userId,
  )) as [{ spent: number | null }];
  const wins = places.map((p) => ({ ...p, coins: PODIUM_COINS[p.place - 1]! }));
  const earned =
    days.reduce((n, d) => n + coinsForTokens(d.tokens), 0) + wins.reduce((n, w) => n + w.coins, 0);
  const since = addDays(today, -29);
  return {
    balance: earned - (spent ?? 0),
    today: coinsForTokens(days.find((d) => d.day === today)?.tokens ?? 0),
    wins: wins.filter((w) => w.day >= since),
    owned: await ownedItems(sql, userId),
  };
}

/** Pays for `item` from `userId`'s coins. Run it serialized, so two buys can't both spend the same coins. */
export async function buy(sql: Sql, userId: number, item: Item, now: number): Promise<Wallet> {
  const w = await wallet(sql, userId, now);
  if (w.owned.includes(item.id)) throw new UserError("You already have it.", { code: "owned" });
  if (w.balance < item.price) throw new UserError("Not enough coins yet.", { code: "too_poor" });
  await sql.execute(
    "INSERT INTO purchases (user_id, item, price, at) VALUES (?, ?, ?, ?)",
    userId,
    item.id,
    item.price,
    now,
  );
  return wallet(sql, userId, now);
}
