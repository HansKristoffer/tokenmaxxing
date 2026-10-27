import { describe, expect, test } from "bun:test";
import { caseById, VENDOR_COINS } from "@tokenmaxxing/core/cases.ts";
import { rarityOf } from "@tokenmaxxing/core/rarity.ts";
import { UserError } from "rivetkit";
import { openCase, sellDuplicates, sellItem } from "../src/town/cases.ts";
import { bag } from "../src/town/coins.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

const night = caseById("night-market")!;
const now = Date.now();

async function setup(coins: number) {
  const { sql } = memorySql();
  await migrate(sql);
  const look = JSON.stringify({ style: 0, skin: 0, hair: 0, outfit: 0, glasses: 0, hat: 0, pet: 0, petVariant: 0 });
  await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (7, 'u7', ?, ?)", look, now);
  await sql.execute("INSERT INTO ledger (user_id, amount, kind, ref, at) VALUES (7, ?, 'admin', 'admin', 0)", coins);
  return sql;
}
const balance = async (sql: Awaited<ReturnType<typeof setup>>) =>
  (await (await import("../src/town/coins.ts")).wallet(sql, 7, now)).balance;
const give = (sql: Awaited<ReturnType<typeof setup>>, item: string, n = 1) =>
  Promise.all(Array.from({ length: n }, () => sql.execute("INSERT INTO items (owner_id, item, at) VALUES (7, ?, 0)", item)));
const rejects = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (err) => err);
  expect(e).toBeInstanceOf(UserError);
  expect((e as UserError).code).toBe(code);
};

describe("openCase", () => {
  test("charges the key and grants one case item", async () => {
    const sql = await setup(200);
    const before = await balance(sql);
    const out = await openCase(sql, 7, "night-market", now);
    expect(night.items.some((i) => i.id === out.item.id)).toBe(true);
    expect(before - out.wallet.balance).toBe(75);
    expect(await bag(sql, 7)).toEqual([{ item: out.item.id, count: 1 }]);
  });

  test("too few coins or an unknown case: refused, nothing charged or granted", async () => {
    const sql = await setup(74);
    const before = await balance(sql);
    await rejects(openCase(sql, 7, "night-market", now), "too_poor");
    await rejects(openCase(sql, 7, "nope", now), "not_found");
    await rejects(openCase(sql, 7, { x: 1 }, now), "not_found");
    expect(await balance(sql)).toBe(before);
    expect(await bag(sql, 7)).toEqual([]);
  });

  test("the dry counter makes the tenth opening a rare or better", async () => {
    const sql = await setup(5000);
    const rand = () => 0; // always the commonest roll
    for (let i = 0; i < 9; i++) expect(rarityOf((await openCase(sql, 7, "night-market", now, undefined, rand)).item)).toBe("common");
    const tenth = await openCase(sql, 7, "night-market", now, undefined, rand);
    expect(["rare", "epic", "legendary"]).toContain(rarityOf(tenth.item));
    // And it starts over.
    expect(rarityOf((await openCase(sql, 7, "night-market", now, undefined, rand)).item)).toBe("common");
  });
});

describe("selling", () => {
  test("pays by rarity and removes exactly one row", async () => {
    const sql = await setup(0);
    for (const rarity of ["common", "uncommon", "rare", "epic"] as const) {
      const item = night.items.find((i) => rarityOf(i) === rarity)!;
      await give(sql, item.id, 2);
      const before = await balance(sql);
      const { wallet } = await sellItem(sql, 7, item.id, now);
      expect(wallet.balance - before).toBe(VENDOR_COINS[rarity]);
      expect((await bag(sql, 7)).find((r) => r.item === item.id)?.count).toBe(1);
    }
  });

  test("refuses non-case items and items you do not hold", async () => {
    const sql = await setup(0);
    await give(sql, "glasses.1");
    await rejects(sellItem(sql, 7, "glasses.1", now), "not_sellable");
    await rejects(sellItem(sql, 7, "nope", now), "not_sellable");
    await rejects(sellItem(sql, 7, night.items[0]!.id, now), "not_owned");
    expect(await balance(sql)).toBe(0);
    expect(await bag(sql, 7)).toEqual([{ item: "glasses.1", count: 1 }]);
  });

  test("selling the last worn copy takes it off the look", async () => {
    const sql = await setup(0);
    const hat = night.items.find((i) => i.slot === "hat")!;
    await give(sql, hat.id);
    await sql.execute("UPDATE users SET look = ? WHERE id = 7", JSON.stringify({ style: 0, skin: 0, hair: 0, outfit: 0, glasses: 0, hat: hat.index, pet: 0, petVariant: 0 }));
    expect((await sellItem(sql, 7, hat.id, now)).unworn).toBe(true);
    const [row] = await sql.execute("SELECT look FROM users WHERE id = 7");
    expect(JSON.parse((row as { look: string }).look).hat).toBe(0);
  });

  test("sellDuplicates keeps one of each and pays for the rest", async () => {
    const sql = await setup(0);
    const [a, b, c] = night.items;
    await give(sql, a!.id, 3);
    await give(sql, b!.id, 1);
    await give(sql, c!.id, 2);
    await give(sql, "glasses.1", 4);
    const owed = 2 * VENDOR_COINS[rarityOf(a!)] + VENDOR_COINS[rarityOf(c!)];
    const out = await sellDuplicates(sql, 7, "night-market", now);
    expect(out.sold).toBe(3);
    expect(out.wallet.balance).toBe(owed);
    const held = Object.fromEntries((await bag(sql, 7)).map((r) => [r.item, r.count]));
    expect(held).toEqual({ [a!.id]: 1, [b!.id]: 1, [c!.id]: 1, "glasses.1": 4 });
    await rejects(sellDuplicates(sql, 7, "nope", now), "not_found");
  });
});
