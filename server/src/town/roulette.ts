import { checkBets, type Settled, settle, spinPocket } from "@tokenmaxxing/core/roulette.ts";
import { UserError } from "rivetkit";
import type { TxSql } from "../actors/shared.ts";
import { secureRandom } from "./cases.ts";
import { type Kept, ledgerAdd, type Wallet, wallet } from "./coins.ts";

/**
 * `userId` spins the solo table once: the stakes out, the pocket, the winnings back, in one transaction.
 * Run it serialized, like `openCase`. `rand` is the server's own; tests pass a seeded one.
 */
export async function spinRoulette(
  sql: TxSql,
  userId: number,
  rawBets: unknown,
  now: number,
  kept?: Kept,
  rand: () => number = secureRandom,
): Promise<{ spin: Settled; wallet: Wallet }> {
  const checked = checkBets(rawBets);
  if ("refused" in checked) throw new UserError(checked.refused, { code: "bad_bet" });
  const { bets } = checked;
  const spin = await sql.transaction(async (tx) => {
    const total = bets.reduce((a, b) => a + b.stake, 0);
    if ((await wallet(tx, userId, now, kept)).balance < total)
      throw new UserError("Not enough coins for that bet.", { code: "too_poor" });
    const s = settle(bets, spinPocket(rand));
    await ledgerAdd(tx, userId, -s.staked, "roulette", "roulette:bet", now);
    if (s.payout > 0) await ledgerAdd(tx, userId, s.payout, "roulette", "roulette:win", now);
    return s;
  });
  return { spin, wallet: await wallet(sql, userId, now, kept) };
}
