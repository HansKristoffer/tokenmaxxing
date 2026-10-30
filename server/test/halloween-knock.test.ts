import { beforeEach, expect, test } from "bun:test";
import { badgesFor } from "@tokenmaxxing/core/badges.ts";
import { CANDY_BUCKET, TREAT_CANDY, treatAt } from "@tokenmaxxing/core/spooky.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { bag } from "../src/town/coins.ts";
import { knock, sugarKingsOf, trickOrTreatOn } from "../src/town/halloween.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

let sql: TxSql;
/** The 30th of October 2026, 9 pm in Copenhagen (UTC+1), and the next evening. */
const NIGHT = Date.UTC(2026, 9, 30, 20);
const NEXT = Date.UTC(2026, 9, 31, 20);
const DOORS = ["5,6", "15,6", "-5,6"];

beforeEach(async () => {
  sql = memorySql().sql;
  await migrate(sql);
  await sql.execute(
    "INSERT INTO users (id, name, look, created_at) VALUES (1, 'u1', '{}', ?)",
    Date.UTC(2026, 0, 1),
  );
});

test("doors open on the 30th and 31st only", () => {
  expect([trickOrTreatOn(NIGHT), trickOrTreatOn(NEXT)]).toEqual([true, true]);
  expect(trickOrTreatOn(Date.UTC(2026, 9, 20, 20))).toBe(false);
});

test("a door opens once a night; the last door makes you sugar king, once a year", async () => {
  const first = await knock(sql, 1, "5,6", DOORS, NIGHT);
  expect(first).toEqual({
    door: "5,6",
    treat: treatAt("5,6", "2026-10-30"),
    candy: TREAT_CANDY[treatAt("5,6", "2026-10-30")],
    knocked: ["5,6"],
    of: 3,
  });
  expect((await knock(sql, 1, "5,6", DOORS, NIGHT + 1)).treat).toBeNull();
  await knock(sql, 1, "15,6", DOORS, NIGHT + 2);
  const last = await knock(sql, 1, "-5,6", DOORS, NIGHT + 3);
  expect(last.king).toBe(true);
  expect(last.knocked.toSorted()).toEqual(DOORS.toSorted());
  expect((await bag(sql, 1)).map((r) => r.item)).toContain(CANDY_BUCKET);
  expect(await sugarKingsOf(sql, 1)).toBe(1);
  expect(badgesFor({ sugarKing: 1 } as never).find((b) => b.id === "sugarking")?.tier).toBe(1);

  // The next night every door opens again, but a second round is no second hat.
  for (const d of DOORS) {
    const r = await knock(sql, 1, d, DOORS, NEXT);
    expect(r.treat).not.toBeNull();
    expect(r.king).toBeUndefined();
  }
  expect((await bag(sql, 1)).filter((r) => r.item === CANDY_BUCKET)).toHaveLength(1);
  expect(await sugarKingsOf(sql, 1)).toBe(1);
});
