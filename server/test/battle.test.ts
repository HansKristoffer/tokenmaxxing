import { expect, test } from "bun:test";
import { MINUTE_CAP } from "@tokenmaxxing/core/games/tokenmaxxing.ts";
import { tokensBetween } from "../src/actors/player.ts";
import { memorySql } from "./memory-sql.ts";

test("a battle counts assistant tokens inside its window, each minute capped and flagged", async () => {
  const { db, sql } = memorySql();
  db.run(`CREATE TABLE events (timestamp INTEGER, message_type TEXT, input_tokens INTEGER, output_tokens INTEGER,
    cache_creation_tokens INTEGER, cache_read_tokens INTEGER)`);
  const add = (t: number, type: string, input: number) =>
    db.run("INSERT INTO events VALUES (?, ?, ?, 10, 20, 30)", [t, type, input]);
  const start = 60_000 * 1000;
  add(start - 1, "assistant", 1_000); // before the start
  add(start, "assistant", 1_000); // 1060
  add(start + 30_000, "user", 5_000); // not an assistant turn
  add(start + 60_000, "assistant", 2_000); // 2060
  add(start + 120_000, "assistant", 1_000); // the end is exclusive
  expect(await tokensBetween(sql, start, start + 120_000)).toEqual({ tokens: 3_120, flagged: false });
  add(start + 60_001, "assistant", MINUTE_CAP);
  expect(await tokensBetween(sql, start, start + 120_000)).toEqual({
    tokens: 1_060 + MINUTE_CAP,
    flagged: true,
  });
});
