import { beforeEach, describe, expect, test } from "bun:test";
import { levelUpCoins } from "@tokenmaxxing/core/economy.ts";
import { levelFor } from "@tokenmaxxing/core/format.ts";
import { PODIUM_COINS } from "@tokenmaxxing/core/shop.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { balances, wallet } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { trophyStep } from "../src/town/trophy-awards.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const at = (day: string) => Date.parse(`${day}T12:00:00Z`);
const NOW = at("2026-12-10");

async function usage(userId: number, day: string, tokens: number) {
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', ?, 0, 0, 0, 1)",
    userId,
    day,
    tokens,
  );
}

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute(
    "INSERT INTO users (id, name, company_id, joined_at, look, created_at) VALUES (1, 'a', NULL, NULL, '{}', ?)",
    at("2026-01-01"),
  );
});

describe("the new ways to earn", () => {
  test("a streak pays more each day, and the wallet and the admin page agree", async () => {
    for (const day of ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"])
      await usage(1, day, 100e6);
    // 10 coins a day, at ×1, ×1.5, ×2, ×2.5 and ×3: 0 + 5 + 10 + 15 + 20 more. Every finished day wins the podium.
    const expected = 50 + 50 + 5 * PODIUM_COINS[0] + levelUpCoins(levelFor(500e6));
    expect((await wallet(sql, 1, NOW)).balance).toBe(expected);
    expect((await balances(sql, NOW)).get(1)).toBe(expected);
    expect((await wallet(sql, 1, NOW)).streak).toBe(1);
  });

  test("a day off costs two steps, not the streak", async () => {
    for (const day of ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-07"])
      await usage(1, day, 100e6);
    // The day back after the gap is ×2: 10 more.
    const expected = 60 + 50 + 10 + 6 * PODIUM_COINS[0] + levelUpCoins(levelFor(600e6));
    expect((await balances(sql, NOW)).get(1)).toBe(expected);
  });

  test("badge tiers pay once each, and milestone levels' rows pay nothing here", async () => {
    const base = (await wallet(sql, 1, NOW)).balance;
    for (const [badge, tier] of [
      ["streak", 1],
      ["streak", 2],
      ["streak", 3],
      ["shipper", 1],
      ["level", 10],
    ] as const)
      await sql.execute(
        "INSERT INTO badge_awards (user_id, badge, tier, at, backfill) VALUES (1, ?, ?, ?, 0)",
        badge,
        tier,
        NOW,
      );
    // Streak to Gold: 10 + 25 + 50. A first Shipper: 10.
    expect((await wallet(sql, 1, NOW)).balance).toBe(base + 95);
    expect((await balances(sql, NOW)).get(1)).toBe(base + 95);
  });

  test("trophies are paid once, from what a sweep recorded", async () => {
    const base = (await wallet(sql, 1, NOW)).balance;
    const trophies = [
      { id: "million", day: "2026-12-01" },
      { id: "piday", day: "2026-03-14" },
      { id: "zeros", day: "2026-12-02" },
    ];
    // The backfill reads everyone, 10 a sweep, then the ones who synced.
    const dirty = new Set<number>();
    expect([...(await trophyStep(sql, dirty, NOW, async () => trophies)).values()]).toEqual([
      ["million", "piday", "zeros"],
    ]);
    expect((await wallet(sql, 1, NOW)).balance).toBe(base + 5 + 25);
    expect((await balances(sql, NOW)).get(1)).toBe(base + 5 + 25);
    // A later look finds nothing new, and pays nothing again.
    dirty.add(1);
    expect((await trophyStep(sql, dirty, NOW, async () => trophies)).size).toBe(0);
    expect((await wallet(sql, 1, NOW)).balance).toBe(base + 5 + 25);
  });
});
