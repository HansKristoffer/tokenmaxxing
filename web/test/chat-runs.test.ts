import { expect, test } from "bun:test";
import { chatRuns } from "../src/hud/format.ts";

test("the same line said again straight away folds into one with a count", () => {
  const line = (userId: number, text: string) => ({ userId, name: `u${userId}`, text });
  const runs = chatRuns([
    line(1, "🔥"),
    line(1, "🔥"),
    line(1, "🔥"),
    line(2, "🔥"),
    line(1, "🔥"),
    line(1, "hi"),
  ]);
  expect(runs.map((r) => [r.line.userId, r.line.text, r.n])).toEqual([
    [1, "🔥", 3],
    [2, "🔥", 1],
    [1, "🔥", 1],
    [1, "hi", 1],
  ]);
  expect(chatRuns([])).toEqual([]);
});
