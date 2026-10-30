import { expect, test } from "bun:test";
import { recordRetro, retroBoard } from "../src/town/retro.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

test("cabinet boards keep each player's best, sorted with stable ties and separated by game", async () => {
  const { sql } = memorySql();
  await migrate(sql);
  await migrate(sql);
  for (const [id, name] of [
    [1, "Ada"],
    [2, "Bo"],
  ] as const)
    await sql.execute("INSERT INTO users (id, name, look, created_at) VALUES (?, ?, '{}', 0)", id, name);
  await recordRetro(sql, 1, 0, 100, 2, 1);
  await recordRetro(sql, 2, 0, 100, 3, 2);
  await recordRetro(sql, 1, 0, 50, 1, 3);
  await recordRetro(sql, 2, 1, 500, 4, 4);
  expect(await retroBoard(sql, 0)).toEqual([
    { userId: 1, name: "Ada", score: 100, level: 2 },
    { userId: 2, name: "Bo", score: 100, level: 3 },
  ]);
  await recordRetro(sql, 2, 0, 120, 4, 5);
  expect((await retroBoard(sql, 0))[0]?.name).toBe("Bo");
  expect((await retroBoard(sql, 1)).length).toBe(1);
  for (const args of [
    [4, 10, 1],
    [0, -1, 1],
    [0, 1.5, 1],
    [0, 10, 0],
  ] as const)
    await expect(recordRetro(sql, 1, args[0], args[1], args[2], 6)).rejects.toThrow();
});
