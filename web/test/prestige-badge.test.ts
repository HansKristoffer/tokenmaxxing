import { expect, test } from "bun:test";
import { prestigeOf } from "../src/hud/prestige-badge.ts";

test("a missing or malformed prestige is none", () => {
  expect(prestigeOf(undefined).rank).toBe(0);
  expect(prestigeOf({}).rank).toBe(0);
  expect(prestigeOf({ prestige: { rank: 0, runLevel: 0 } }).rank).toBe(0);
  expect(prestigeOf({ prestige: { rank: 1.5, runLevel: 3 } }).rank).toBe(0);
});

test("a badge passes through", () => {
  expect(prestigeOf({ prestige: { rank: 2, runLevel: 14 } })).toEqual({ rank: 2, runLevel: 14, runInto: 0 });
});
