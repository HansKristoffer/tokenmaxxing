import { expect, test } from "bun:test";
import { fishingJournal, migrateFishing, recordFish } from "../src/town/fishing.ts";
import { memorySql } from "./memory-sql.ts";

test("the fishing journal persists totals and personal bests separately for each player", async () => {
  const { sql } = memorySql();
  await migrateFishing(sql);
  expect(await fishingJournal(sql, 1)).toEqual([]);
  await recordFish(sql, 1, { fish: "perch", cm: 18 });
  await recordFish(sql, 1, { fish: "perch", cm: 25 });
  await recordFish(sql, 1, { fish: "perch", cm: 12 });
  await recordFish(sql, 1, { fish: "duck", cm: 8 });
  await recordFish(sql, 2, { fish: "perch", cm: 30 });
  await migrateFishing(sql); // Safe on a later actor wake.
  expect(await fishingJournal(sql, 1)).toEqual([
    { fish: "duck", count: 1, cm: 8 },
    { fish: "perch", count: 3, cm: 25 },
  ]);
  expect(await fishingJournal(sql, 2)).toEqual([{ fish: "perch", count: 1, cm: 30 }]);
});
test("unknown catches and impossible lengths never enter a journal", async () => {
  const { sql } = memorySql();
  await migrateFishing(sql);
  for (const caught of [
    { fish: "nope", cm: 12 },
    { fish: "perch", cm: 999 },
    { fish: "perch", cm: 12.5 },
  ])
    await expect(recordFish(sql, 1, caught as never)).rejects.toThrow("Invalid catch");
  expect(await fishingJournal(sql, 1)).toEqual([]);
});
