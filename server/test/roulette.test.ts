import { describe, expect, test } from "bun:test";
import { PAYS } from "@tokenmaxxing/core/roulette.ts";
import { UserError } from "rivetkit";
import { wallet } from "../src/town/coins.ts";
import { spinRoulette } from "../src/town/roulette.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

const now = Date.now();

async function setup(coins: number) {
  const { sql } = memorySql();
  await migrate(sql);
  const look = JSON.stringify({
    style: 0,
    skin: 0,
    hair: 0,
    outfit: 0,
    glasses: 0,
    hat: 0,
    pet: 0,
    petVariant: 0,
  });
  await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (7, 'u7', ?, ?)", look, now);
  await sql.execute(
    "INSERT INTO ledger (user_id, amount, kind, ref, at) VALUES (7, ?, 'admin', 'admin', 0)",
    coins,
  );
  return sql;
}
type Db = Awaited<ReturnType<typeof setup>>;
const balance = async (sql: Db) => (await wallet(sql, 7, now)).balance;
const ledgerRows = async (sql: Db) =>
  (await sql.execute("SELECT COUNT(*) AS n FROM ledger WHERE user_id = 7"))[0] as { n: number };
/** A rand that lands on `pocket`. */
const landing = (pocket: number) => () => (pocket + 0.5) / 37;
const rejects = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(
    () => null,
    (err) => err,
  );
  expect(e).toBeInstanceOf(UserError);
  expect((e as UserError).code).toBe(code);
};
/** mulberry32 */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("spinRoulette", () => {
  test("a win pays stake * (pays + 1)", async () => {
    const sql = await setup(500);
    const out = await spinRoulette(sql, 7, [{ on: "n:17", stake: 10 }], now, undefined, landing(17));
    const payout = 10 * (PAYS.n! + 1);
    expect(out.spin.pocket).toBe(17);
    expect(out.spin.payout).toBe(payout);
    expect(out.wallet.balance).toBe(500 - 10 + payout);
    expect(await balance(sql)).toBe(500 - 10 + payout);
  });

  test("a loss takes exactly the stake", async () => {
    const sql = await setup(500);
    const out = await spinRoulette(sql, 7, [{ on: "red", stake: 100 }], now, undefined, landing(0));
    expect(out.spin.payout).toBe(0);
    expect(out.wallet.balance).toBe(400);
  });

  test("too poor: refused, nothing written", async () => {
    const sql = await setup(50);
    const before = await ledgerRows(sql);
    await rejects(spinRoulette(sql, 7, [{ on: "red", stake: 51 }], now), "too_poor");
    expect(await balance(sql)).toBe(50);
    expect(await ledgerRows(sql)).toEqual(before);
  });

  test("invalid bets: bad_bet", async () => {
    const sql = await setup(500);
    for (const bad of [
      null,
      [],
      [{ on: "n:37", stake: 1 }],
      [{ on: "red", stake: 0 }],
      [{ on: "red", stake: 1.5 }],
      [{ on: "red", stake: 5000 }],
    ])
      await rejects(spinRoulette(sql, 7, bad, now), "bad_bet");
    expect(await balance(sql)).toBe(500);
  });

  test("100 on red over many spins returns about 36/37", async () => {
    const sql = await setup(1_000_000);
    const rand = seeded(12345);
    const n = 3000;
    for (let i = 0; i < n; i++) await spinRoulette(sql, 7, [{ on: "red", stake: 100 }], now, undefined, rand);
    const rtp = ((await balance(sql)) - 1_000_000 + n * 100) / (n * 100);
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(1.04);
  });

  test("deterministic given the same seeded rand", async () => {
    const a = await spinRoulette(await setup(500), 7, [{ on: "odd", stake: 5 }], now, undefined, seeded(9));
    const b = await spinRoulette(await setup(500), 7, [{ on: "odd", stake: 5 }], now, undefined, seeded(9));
    expect(a.spin).toEqual(b.spin);
    expect(a.wallet.balance).toBe(b.wallet.balance);
  });
});
