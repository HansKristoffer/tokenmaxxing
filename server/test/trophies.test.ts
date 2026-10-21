import { expect, test } from "bun:test";
import { migrateEvents } from "../src/actors/player.ts";
import { trophiesOf, trophyCache } from "../src/trophies.ts";
import { memorySql } from "./memory-sql.ts";

const insert = (db: ReturnType<typeof memorySql>["db"], type: string, at: number, id: string, tokens = 0) =>
  db.run(
    `INSERT INTO events (source, session_id, message_id, timestamp, day, model, message_type,
       input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
     VALUES ('claude_code', 's', ?, ?, '', 'm', ?, ?, 0, 0, 0)`,
    [id, at, type, tokens],
  );

test("trophies come from the events, and later looks read only the new ones", async () => {
  const { db, sql } = memorySql();
  await migrateEvents(sql);
  const cache = trophyCache();
  const now = Date.parse("2026-10-21T12:00:00Z");
  // 3:30 AM in Copenhagen (UTC+2) on Tuesday 20 October.
  const threeAm = Date.parse("2026-10-20T01:30:00Z");
  insert(db, "assistant", threeAm, "a", 600_123);
  insert(db, "pr", threeAm, "00deadbeef");
  expect(await trophiesOf(sql, cache, now)).toEqual([
    { id: "3am", day: "2026-10-20" },
    { id: "zeros", day: "2026-10-20" },
    { id: "deadbeef", day: "2026-10-20" },
  ]);
  // The same hour again: it adds up with what's cached, to a round million on the (finished) day.
  insert(db, "assistant", threeAm + 60_000, "b", 399_877);
  expect((await trophiesOf(sql, cache, now)).map((t) => t.id)).toEqual([
    "million",
    "3am",
    "zeros",
    "deadbeef",
    "round",
  ]);
  expect(cache.hours.size).toBe(1);
});
