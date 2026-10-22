import { expect, test } from "bun:test";
import { daysAgoText, heatCells, heatLevel, sourceName } from "../src/hud/heat.ts";

test("heat levels: 0 for nothing, 1 to 4 on a square-root scale from the quietest active day to the busiest", () => {
  expect(heatLevel(0, 100)).toBe(0);
  expect(heatLevel(5, 0)).toBe(0);
  // From zero (no min given): sqrt(x / max) in four steps.
  expect(heatLevel(1, 100)).toBe(1);
  expect(heatLevel(6, 100)).toBe(1);
  expect(heatLevel(7, 100)).toBe(2);
  expect(heatLevel(25, 100)).toBe(3);
  expect(heatLevel(56, 100)).toBe(3);
  expect(heatLevel(57, 100)).toBe(4);
  expect(heatLevel(100, 100)).toBe(4);
});

test("steady days still show steps: the scale starts at the quietest active day", () => {
  // 90 to 100 tokens is nearly flat, but the quietest is level 1 and the busiest 4.
  expect(heatLevel(90, 100, 90)).toBe(1);
  expect(heatLevel(100, 100, 90)).toBe(4);
  const levels = [90, 93, 96, 100].map((t) => heatLevel(t, 100, 90));
  expect(new Set(levels).size).toBeGreaterThan(2);
  // Quiet stays distinct from the lowest active level.
  expect(heatLevel(0, 100, 90)).toBe(0);
  // All the same: one level, not a division by nothing.
  expect(heatLevel(50, 50, 50)).toBe(3);
});

test("the grid starts on the first day's weekday, Monday first", () => {
  // 2026-10-22 is a Thursday: three blanks (Mon, Tue, Wed).
  const days = [
    { day: "2026-10-22", tokens: 10 },
    { day: "2026-10-23", tokens: 0 },
    { day: "2026-10-24", tokens: 40 },
  ];
  const cells = heatCells(days);
  expect(cells.slice(0, 3)).toEqual([null, null, null]);
  expect(cells.slice(3).map((c) => c?.level)).toEqual([1, 0, 4]);
  // A Monday needs no padding; a Sunday needs six.
  expect(heatCells([{ day: "2026-10-19", tokens: 1 }])[0]).not.toBeNull();
  expect(heatCells([{ day: "2026-10-25", tokens: 1 }]).filter((c) => c === null)).toHaveLength(6);
  expect(heatCells([])).toEqual([]);
});

test("a quiet month is all zeros, not a division by nothing", () => {
  const cells = heatCells(
    Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, "0")}`, tokens: 0 })),
  );
  expect(cells.every((c) => c === null || c.level === 0)).toBe(true);
});

test("how long ago", () => {
  expect(daysAgoText("2026-10-22", "2026-10-22")).toBe("today");
  expect(daysAgoText("2026-10-21", "2026-10-22")).toBe("yesterday");
  expect(daysAgoText("2026-10-19", "2026-10-22")).toBe("3 days ago");
  expect(daysAgoText("2026-07-22", "2026-10-22")).toBe("3 months ago");
});

test("source names fall back to what the server sent", () => {
  expect(sourceName("claude_code")).toBe("Claude Code");
  expect(sourceName("brand_new")).toBe("brand_new");
});
