import { beforeEach, describe, expect, test } from "bun:test";
import type { Sql } from "../src/actors/shared.ts";
import { heldIn, hold, pay, refund, wallet } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: Sql;
const NOW = Date.UTC(2026, 8, 29, 12);
const names = { 1: "ada", 2: "bo", 3: "cy" };

/** Gives `userId` a balance: √(tokens ÷ 1M) coins for one old day, plus 25 for finishing it first. */
async function earn(userId: number, day: string, tokens: number) {
  await sql.execute("INSERT INTO usage_daily VALUES (?, ?, 'm', ?, 0, 0, 0, 1)", userId, day, tokens);
}
const balance = async (userId: number) => (await wallet(sql, userId, NOW)).balance;
const sumOf = async (ref: string) =>
  ((await sql.execute("SELECT SUM(amount) AS n FROM ledger WHERE ref = ?", ref)) as [{ n: number }])[0].n;

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await earn(1, "2026-01-01", 10_000e6); // √10000 = 100, +25 first place = 125
  await earn(2, "2026-01-02", 2_500e6); // 50, +25 = 75
  await earn(3, "2026-01-03", 100e6); // 10, +25 = 35
});

describe("the coin ledger", () => {
  test("a stake is held, then paid out, and the ref sums to 0", async () => {
    expect(await balance(1)).toBe(125);
    await hold(
      sql,
      "table:1",
      "stake",
      [
        { userId: 1, amount: 30 },
        { userId: 2, amount: 30 },
      ],
      names,
      NOW,
    );
    expect(await balance(1)).toBe(95);
    expect(await balance(2)).toBe(45);
    expect(await heldIn(sql, "table:1")).toEqual(
      new Map([
        [1, 30],
        [2, 30],
      ]),
    );
    await pay(sql, "table:1", "payout", [{ userId: 2, amount: 60 }], NOW);
    expect(await balance(1)).toBe(95);
    expect(await balance(2)).toBe(105);
    expect(await sumOf("table:1")).toBe(0);
  });

  test("a stake is at most half your coins, and holds are all or nothing", async () => {
    await expect(
      hold(
        sql,
        "table:2",
        "stake",
        [
          { userId: 1, amount: 20 },
          { userId: 3, amount: 20 }, // cy has 35: at most 17
        ],
        names,
        NOW,
      ),
    ).rejects.toThrow("cy can stake at most 🪙 17");
    expect(await balance(1)).toBe(125); // nothing was taken from ada either
    // A side bet only has to fit the balance.
    await hold(sql, "bets:2", "bet", [{ userId: 3, amount: 35 }], names, NOW);
    expect(await balance(3)).toBe(0);
  });

  test("a pot never pays out more than it holds", async () => {
    await hold(sql, "table:3", "stake", [{ userId: 1, amount: 10 }], names, NOW);
    await expect(pay(sql, "table:3", "payout", [{ userId: 2, amount: 11 }], NOW)).rejects.toThrow(
      "only 10 held",
    );
    await pay(sql, "table:3", "payout", [{ userId: 2, amount: 10 }], NOW);
    await expect(pay(sql, "table:3", "payout", [{ userId: 2, amount: 1 }], NOW)).rejects.toThrow();
  });

  test("a refund gives back exactly what each still has in", async () => {
    await hold(
      sql,
      "table:4",
      "stake",
      [
        { userId: 1, amount: 40 },
        { userId: 2, amount: 20 },
      ],
      names,
      NOW,
    );
    await refund(sql, "table:4", NOW, [2]);
    expect(await balance(2)).toBe(75);
    expect(await heldIn(sql, "table:4")).toEqual(new Map([[1, 40]]));
    await refund(sql, "table:4", NOW);
    expect(await balance(1)).toBe(125);
    expect(await sumOf("table:4")).toBe(0);
  });
});
