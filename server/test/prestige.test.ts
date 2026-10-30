import { beforeEach, describe, expect, test } from "bun:test";
import { levelFor } from "@tokenmaxxing/core/format.ts";
import { RUN_LEVELS } from "@tokenmaxxing/core/prestige.ts";
import { prestigeTrophyId } from "@tokenmaxxing/core/prestige-furniture.ts";
import { NO_PRESTIGE, runCoinsPaid } from "@tokenmaxxing/core/prestige-run.ts";
import { isTradeable, itemById } from "@tokenmaxxing/core/shop.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { balances, grantRewards, wallet } from "../src/town/coins.ts";
import { badgesOf, prestigeView, takeNextPrestige } from "../src/town/prestige.ts";
import { migrate } from "../src/town/schema.ts";
import { playerCores, tokensIn } from "../src/town/users.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
const NOW = Date.parse("2026-12-10T12:00:00Z");
const B = 1e9;

/** Sets a user's lifetime tokens to `total`, on one old day. */
async function setLifetime(userId: number, total: number) {
  await sql.execute("DELETE FROM usage_daily WHERE user_id = ?", userId);
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, '2026-02-01', 'm', ?, 0, 0, 0, 1)",
    userId,
    total,
  );
}

const held = async (userId: number) =>
  (await sql.execute("SELECT item FROM items WHERE owner_id = ? ORDER BY item", userId)) as {
    item: string;
  }[];

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  for (const id of [1, 2])
    await sql.execute(
      "INSERT INTO users (id, name, company_id, joined_at, look, created_at) VALUES (?, ?, NULL, NULL, '{}', ?)",
      id,
      `u${id}`,
      Date.parse("2026-01-01"),
    );
});

describe("taking prestige", () => {
  test("not below the cap", async () => {
    await setLifetime(1, 49.9 * B);
    await expect(takeNextPrestige(sql, 1, NOW)).rejects.toMatchObject({ code: "not_ready" });
    expect((await prestigeView(sql, 1)).canPrestige).toBe(false);
  });

  test("Hans: 142B lifetime is eligible, and the first run banks what he earned past the cap", async () => {
    await setLifetime(1, 142 * B);
    expect((await prestigeView(sql, 1)).canPrestige).toBe(true);
    const v = await takeNextPrestige(sql, 1, NOW);
    expect(v.rank).toBe(1);
    // Run I began at the 50B cap, so 92B in it is done and the second prestige is open.
    expect(v.runLevel).toBe(RUN_LEVELS);
    expect(v.canPrestige).toBe(true);
    await setLifetime(1, 55 * B);
    const badges = await badgesOf(sql, "all", await tokensIn(sql, "all"));
    expect(badges.get(1)).toEqual({ rank: 1, runLevel: 5, runInto: 0 });
    expect(badges.get(2) ?? NO_PRESTIGE).toEqual(NO_PRESTIGE);
    // Tokens past the run's start count toward it.
    await setLifetime(1, 62.5 * B);
    expect((await prestigeView(sql, 1)).runLevel).toBe(12);
  });

  test("at exactly the cap; a second take is refused, and stays one", async () => {
    await setLifetime(1, 50 * B);
    await takeNextPrestige(sql, 1, NOW);
    await expect(takeNextPrestige(sql, 1, NOW)).rejects.toMatchObject({ code: "not_ready" });
    const rows = await sql.execute("SELECT 1 FROM prestiges WHERE user_id = 1");
    expect(rows).toHaveLength(1);
  });

  test("two at once take one", async () => {
    await setLifetime(1, 60 * B);
    const out = await Promise.allSettled([takeNextPrestige(sql, 1, NOW), takeNextPrestige(sql, 1, NOW)]);
    expect(out.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect((await prestigeView(sql, 1)).rank).toBe(1);
  });

  test("the next prestige needs the run's level 50, and no track is left past the last", async () => {
    await setLifetime(1, 50 * B);
    await takeNextPrestige(sql, 1, NOW);
    await setLifetime(1, 99.9 * B);
    await expect(takeNextPrestige(sql, 1, NOW)).rejects.toMatchObject({ code: "not_ready" });
    await setLifetime(1, 100 * B);
    expect((await takeNextPrestige(sql, 1, NOW)).rank).toBe(2);
  });
});

describe("prestige grants", () => {
  test("wearables come at their run levels, once each, and are not tradeable", async () => {
    await setLifetime(1, 50 * B);
    await takeNextPrestige(sql, 1, NOW);
    expect(await held(1)).toEqual([]);
    for (const [lifetime, items] of [
      [60 * B, ["hat.700"]],
      [70 * B, ["hat.700", "outfit.700"]],
      [90 * B, ["back.700", "hat.700", "outfit.700"]],
      [100 * B, ["aura.700", "back.700", "hat.700", "outfit.700"]],
    ] as const) {
      await setLifetime(1, lifetime);
      // A re-sync never duplicates.
      for (let i = 0; i < 3; i++) await grantRewards(sql, 1, levelFor(lifetime), NOW);
      expect((await held(1)).filter((r) => /\.700$/.test(r.item)).map((r) => r.item)).toEqual([...items]);
    }
    for (const id of ["hat.700", "aura.700"]) {
      expect(itemById(id)).toBeDefined();
      expect(isTradeable(id)).toBe(false);
    }
  });

  test("the trophy is furniture that comes with run level 50, once", async () => {
    const trophy = prestigeTrophyId(1)!;
    await setLifetime(1, 50 * B);
    await takeNextPrestige(sql, 1, NOW);
    await setLifetime(1, 99 * B);
    await grantRewards(sql, 1, 50, NOW);
    expect((await held(1)).map((r) => r.item)).not.toContain(trophy);
    await setLifetime(1, 100 * B);
    for (let i = 0; i < 3; i++) await grantRewards(sql, 1, 50, NOW);
    expect((await held(1)).filter((r) => r.item === trophy)).toHaveLength(1);
  });

  test("nobody else gets any", async () => {
    await setLifetime(2, 60 * B);
    await grantRewards(sql, 2, 50, NOW);
    expect((await held(2)).filter((r) => /\.7\d\d$/.test(r.item))).toEqual([]);
  });
});

describe("prestige coins", () => {
  test("a run pays 10 a level and its milestones, derived, and the wallet and the admin page agree", async () => {
    await setLifetime(1, 50 * B);
    const before = (await wallet(sql, 1, NOW)).balance;
    expect((await balances(sql, NOW)).get(1)).toBe(before);
    await takeNextPrestige(sql, 1, NOW);
    expect((await wallet(sql, 1, NOW)).balance).toBe(before);
    await setLifetime(1, 50 * B + 10 * B);
    const w = (await wallet(sql, 1, NOW)).balance;
    // The same tokens without the prestige row: only the run's coins differ.
    await sql.execute("DELETE FROM prestiges");
    expect(w - (await wallet(sql, 1, NOW)).balance).toBe(runCoinsPaid(10));
    await sql.execute("INSERT INTO prestiges (user_id, rank, started_at, at) VALUES (1, 1, ?, 0)", 50 * B);
    expect((await balances(sql, NOW)).get(1)).toBe(w);
    expect(runCoinsPaid(10)).toBe(10 * 9 + 100);
  });

  test("a finished run is worth 2,200, and the second run adds to it", async () => {
    await setLifetime(1, 50 * B);
    await takeNextPrestige(sql, 1, NOW);
    await setLifetime(1, 100 * B);
    const one = (await wallet(sql, 1, NOW)).balance;
    await takeNextPrestige(sql, 1, NOW);
    expect((await wallet(sql, 1, NOW)).balance).toBe(one);
    await setLifetime(1, 110 * B);
    const two = (await wallet(sql, 1, NOW)).balance;
    await sql.execute("DELETE FROM prestiges WHERE rank = 2");
    const without = (await wallet(sql, 1, NOW)).balance;
    await sql.execute("INSERT INTO prestiges (user_id, rank, started_at, at) VALUES (1, 2, ?, 0)", 100 * B);
    expect(two - without).toBe(runCoinsPaid(10));
    expect(without - one).toBeGreaterThanOrEqual(0);
    expect(runCoinsPaid(RUN_LEVELS)).toBe(2200);
    expect((await balances(sql, NOW)).get(1)).toBe(two);
  });
});

describe("the badge others see", () => {
  test("older prestige rows use the rank's start and retain partial level progress", async () => {
    await setLifetime(1, 144.4 * B);
    await sql.execute(
      "INSERT INTO prestiges (user_id, rank, started_at, at) VALUES (1, 1, ?, ?), (1, 2, ?, ?)",
      73.4 * B,
      NOW,
      144 * B,
      NOW,
    );
    expect((await prestigeView(sql, 1)).progress).toEqual({
      level: 44,
      into: 0.4 * B,
      toNext: 0.6 * B,
    });
    const badges = await badgesOf(sql, [1], await tokensIn(sql, [1]));
    expect(badges.get(1)).toEqual({ rank: 2, runLevel: 44, runInto: 0.4 * B });
  });

  test("playerCores carries it", async () => {
    await setLifetime(1, 55 * B);
    await takeNextPrestige(sql, 1, NOW);
    await setLifetime(1, 67 * B);
    const [p] = await playerCores(sql, [1]);
    expect(p!.prestige).toEqual({ rank: 1, runLevel: 17, runInto: 0 });
    expect((await playerCores(sql, [2]))[0]!.prestige).toEqual(NO_PRESTIGE);
  });
});
