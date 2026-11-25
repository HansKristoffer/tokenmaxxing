import { beforeEach, describe, expect, test } from "bun:test";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { houseTier } from "@tokenmaxxing/core/world.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { companyInfos } from "../src/town/companies.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute(
    "INSERT INTO companies (id, name, owner_id, plot, created_at) VALUES (1, 'Acme', 1, 1, 0)",
  );
});

/** A user in company 1 who made `tokens` today. */
async function member(id: number, tokens: number) {
  await sql.execute(
    "INSERT INTO users (id, name, company_id, joined_at, look, created_at) VALUES (?, ?, 1, 0, '{}', 0)",
    id,
    `u${id}`,
  );
  await sql.execute(
    "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns) VALUES (?, ?, 'm', ?, 0, 0, 0, 1)",
    id,
    dayKey(Date.now()),
    tokens,
  );
}

describe("a company's house", () => {
  test("is built from its five heaviest users, not dragged down by the rest", async () => {
    for (const [id, tokens] of [1e9, 1e9, 1e9, 1e9, 1e9].entries()) await member(id + 1, tokens);
    const [five] = await companyInfos(sql, [1]);
    expect(five?.topTokens30d).toBe(5e9);
    expect(houseTier(five?.topTokens30d ?? 0)).toBe(2);

    for (let id = 6; id <= 25; id++) await member(id, 1);
    const [crowd] = await companyInfos(sql, [1]);
    expect(crowd?.members).toBe(25);
    expect(crowd?.topTokens30d).toBe(5e9); // twenty light users change nothing
    expect(crowd?.tokens30d).toBeGreaterThan(5e9); // the plain total still counts them
  });

  test("a sixth heavy user doesn't count, and a solo user fills one seat of five", async () => {
    await member(1, 1e9);
    const [solo] = await companyInfos(sql, [1]);
    expect(houseTier(solo?.topTokens30d ?? 0)).toBe(1); // 200M a seat: a shack
    for (let id = 2; id <= 6; id++) await member(id, 1e9);
    const [six] = await companyInfos(sql, [1]);
    expect(six?.topTokens30d).toBe(5e9);
    expect(six?.tokens30d).toBe(6e9);
  });
});
