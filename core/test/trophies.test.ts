import { expect, test } from "bun:test";
import { palindromeDate, TROPHIES, type TrophyFacts, trophiesFor } from "../src/trophies.ts";

/** Copenhagen wall-clock time as ms (CEST, UTC+2, in summer; CET, UTC+1, in winter). */
const cph = (iso: string) => {
  const ms = Date.parse(`${iso}Z`);
  const summer = iso.slice(5, 7) >= "04" && iso.slice(5, 7) <= "10";
  return ms - (summer ? 2 : 1) * 3_600_000;
};
const hour = (iso: string, tokens: number, prompts = 0) => ({ hour: cph(iso), tokens, prompts });
const none: TrophyFacts = { hours: [], prs: [], today: "2026-10-21" };
const ids = (f: Partial<TrophyFacts>) => trophiesFor({ ...none, ...f }).map((t) => t.id);

test("every trophy has its own id", () => {
  expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
  expect(TROPHIES.length).toBeGreaterThanOrEqual(15);
});

test("nothing earned from nothing", () => {
  expect(trophiesFor(none)).toEqual([]);
});

test("PR trophies go by the Copenhagen clock and say the day they were first earned", () => {
  const pr = (iso: string, hash = "ab") => ({ at: cph(iso), hash });
  expect(trophiesFor({ ...none, prs: [pr("2026-07-10T03:15:00"), pr("2026-07-01T03:59:00")] })).toEqual([
    { id: "3am", day: "2026-07-01" },
    // 10 July 2026 is a Friday, but 3 AM isn't after five.
  ]);
  expect(ids({ prs: [pr("2026-07-10T04:00:00")] })).toEqual([]);
  expect(ids({ prs: [pr("2026-07-10T17:00:00")] })).toEqual(["friday"]);
  expect(ids({ prs: [pr("2027-01-01T12:00:00"), pr("2026-12-25T12:00:00")] })).toEqual([
    "newyear",
    "holiday",
  ]);
});

test("vanity hashes", () => {
  const pr = (hash: string) => ({ at: cph("2026-07-07T12:00:00"), hash });
  expect(ids({ prs: [pr("00af")] })).toEqual(["zeros"]);
  expect(ids({ prs: [pr("12beef34")] })).toEqual(["deadbeef"]);
  expect(ids({ prs: [pr("99c0ffee00")] })).toEqual(["c0ffee"]);
  expect(ids({ prs: [pr("0a0b")] })).toEqual([]);
});

test("day totals count only once the day is over", () => {
  const today = { hours: [hour("2026-10-21T10:00:00", 12_344_321)] };
  expect(ids(today)).toEqual(["million"]);
  expect(ids({ ...today, today: "2026-10-22" })).toEqual(["million", "palintotal"]);
  // Two hours make the day's total.
  const day = (tokens: number) => ({
    today: "2026-10-22",
    hours: [hour("2026-10-20T10:00:00", 1_000), hour("2026-10-20T11:00:00", tokens - 1_000)],
  });
  expect(ids(day(5_000_000))).toEqual(["million", "round"]);
  expect(ids(day(2_000_777))).toEqual(["million", "jackpot"]);
  expect(ids(day(213_370))).toEqual(["leet"]);
});

test("hours of the day: early bird, midnight oil, round the clock", () => {
  expect(ids({ hours: [hour("2026-10-20T05:30:00", 5)] })).toEqual(["earlybird"]);
  const night = [0, 1, 2, 3, 4].map((h) => hour(`2026-10-20T0${h}:00:00`, 5));
  expect(ids({ hours: night })).toEqual(["midnight"]);
  const allDay = Array.from({ length: 24 }, (_, h) =>
    hour(`2026-10-20T${String(h).padStart(2, "0")}:00:00`, 5),
  );
  expect(ids({ hours: allDay })).toEqual(["earlybird", "midnight", "allday"]);
});

test("a seven-day streak is earned on its seventh day", () => {
  const days = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => hour(`2026-10-${String(from + i).padStart(2, "0")}T12:00:00`, 5));
  // 4-6 October, a gap, then 8-14 October (10 and 11 October 2026 are a weekend).
  const t = trophiesFor({ ...none, hours: [...days(4, 3), ...days(8, 7)] });
  expect(t.find((x) => x.id === "streak")).toEqual({ id: "streak", day: "2026-10-14" });
  expect(t.find((x) => x.id === "weekend")).toEqual({ id: "weekend", day: "2026-10-04" });
});

test("calendar days and prompts", () => {
  expect(ids({ hours: [hour("2025-03-14T12:00:00", 1)] })).toEqual(["piday"]);
  expect(ids({ hours: [hour("2026-07-07T12:00:00", 0, 60)] })).toEqual(["storm"]);
  expect(ids({ hours: [hour("2026-06-22T12:00:00", 1)] })).toEqual(["palindate"]);
});

test("palindrome dates", () => {
  expect(["2021-12-02", "2026-06-20", "2026-02-06", "2030-03-02"].map(palindromeDate)).toEqual([
    true,
    true,
    true,
    true,
  ]);
  expect(["2026-10-21", "2026-06-19"].map(palindromeDate)).toEqual([false, false]);
});

test("switch-hitter: three tools in one day, across its hours", () => {
  const h = (iso: string, sources: string[]) => ({ ...hour(iso, 100), sources });
  expect(ids({ hours: [h("2026-07-07T09:00:00", ["a", "b"]), h("2026-07-07T10:00:00", ["b"])] })).toEqual([]);
  const f = { hours: [h("2026-07-07T09:00:00", ["a", "b"]), h("2026-07-07T10:00:00", ["c"])] };
  expect(trophiesFor({ ...none, ...f }).find((t) => t.id === "switch")).toEqual({
    id: "switch",
    day: "2026-07-07",
  });
  // Three tools over three days is not it.
  expect(
    ids({
      hours: [
        h("2026-07-07T09:00:00", ["a"]),
        h("2026-07-08T09:00:00", ["b"]),
        h("2026-07-09T09:00:00", ["c"]),
      ],
    }),
  ).not.toContain("switch");
});

test("perfect week: tokens every day from a Monday to the Sunday, dated that Sunday", () => {
  // 6 July 2026 is a Monday.
  const days = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) =>
      hour(`2026-07-${String(from + i).padStart(2, "0")}T12:00:00`, 10),
    );
  expect(ids({ hours: days(6, 11) })).not.toContain("perfectweek");
  expect(trophiesFor({ ...none, hours: days(6, 12) }).find((t) => t.id === "perfectweek")).toEqual({
    id: "perfectweek",
    day: "2026-07-12",
  });
  // Seven in a row, but Tuesday to Monday.
  expect(ids({ hours: days(7, 13) })).not.toContain("perfectweek");
});
