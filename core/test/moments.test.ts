import { expect, test } from "bun:test";
import { describeDayResults, describeMoment, levelFor, type Moment, mentions } from "../src/moments.ts";
import { addDays, dayIn, hourIn } from "../src/range.ts";

test("dayIn: local days, including a 23-hour DST day", () => {
  // 23:30 UTC on the 22nd is already the 23rd in Copenhagen (UTC+2 in September).
  expect(dayIn(Date.UTC(2026, 8, 22, 23, 30), "Europe/Copenhagen").key).toBe("2026-09-23");
  const dst = dayIn(Date.UTC(2026, 2, 29, 12), "Europe/Copenhagen");
  expect(dst).toEqual({
    key: "2026-03-29",
    since: Date.UTC(2026, 2, 28, 23), // midnight CET (+1)
    until: Date.UTC(2026, 2, 29, 22), // midnight CEST (+2)
  });
  expect(dayIn(Date.UTC(2026, 8, 23, 12), "UTC")).toMatchObject({ since: Date.UTC(2026, 8, 23) });
  expect(hourIn(Date.UTC(2026, 8, 23, 1), "Europe/Copenhagen")).toBe(3);
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});

test("levelFor: half-decade steps from 1M", () => {
  expect([0, 999_999, 1e6, 3.2e6, 1e7, 1e8, 1e9, 1e10].map((t) => levelFor(t).level)).toEqual([
    0, 0, 1, 2, 3, 5, 7, 9,
  ]);
  expect(levelFor(1e9).title).toBe("Gigamaxxer");
});

test("mentions: whole handles only", () => {
  expect(mentions("gg @bob", "bob")).toBe(true);
  expect(mentions("@Bob!", "bob")).toBe(true);
  expect(mentions("@bobby", "bob")).toBe(false);
  expect(mentions("bob", "bob")).toBe(false);
});

const m = (kind: Moment["kind"], data: Record<string, unknown>, target: string | null = "bob"): Moment => ({
  id: 1,
  kind,
  actor: "alice",
  target,
  groupId: 1,
  groupName: "Arox",
  day: "2026-09-23",
  data,
  createdAt: 0,
  reactions: [],
});

test("describeMoment: one row, worded per viewer", () => {
  const cases: [Moment, string, string, boolean, number][] = [
    [m("overtake", { rank: 2, tokens: 3e6 }), "alice", "You passed bob", true, 2],
    [m("overtake", { rank: 2, tokens: 3e6 }), "bob", "alice passed you", true, 3],
    [m("overtake", { rank: 2, tokens: 3e6 }), "carol", "alice passed bob", false, 2],
    [m("take_lead", { tokens: 3e6 }), "bob", "alice took #1 from you", true, 6],
    [m("take_lead", { tokens: 3e6 }), "alice", "You took #1 in Arox", true, 4],
    [m("take_lead", { tokens: 3e6 }), "carol", "alice took #1 in Arox", true, 1],
    [m("close_gap", { gap: 5e5, rank: 1 }), "alice", "You're 500.0K behind bob", true, 1],
    [m("close_gap", { gap: 5e5, rank: 1 }), "bob", "alice is 500.0K behind you", true, 1],
    [m("climb", { from: 5, to: 2, tokens: 5e6 }, null), "alice", "You jumped from #5 to #2", true, 2],
    [m("personal_best", { tokens: 4.2e7 }, null), "alice", "Your biggest day yet", true, 2],
    [m("achievement", { key: "hydra" }, null), "carol", "alice unlocked 🐉 Hydra", false, 2],
    [m("achievement", { key: "level", level: 7 }, null), "alice", "Unlocked Level 7: Gigamaxxer", true, 2],
    [m("chat", { text: "gg @bob" }, null), "bob", "alice in Arox", true, 5],
    [m("chat", { text: "gg" }, null), "bob", "alice in Arox", false, 5],
  ];
  for (const [moment, viewer, title, notify, priority] of cases) {
    expect(describeMoment(moment, viewer)).toMatchObject({ title, notify, priority });
  }
});

test("describeDayResults: the morning recap line", () => {
  const titles = [
    m("day_title", { category: "prs", value: 4 }, null),
    { ...m("day_title", { category: "tokens", value: 8.4e7 }, null), actor: "anna" },
    { ...m("day_title", { category: "parallelism", value: 3.14 }, null), actor: "me" },
  ];
  expect(describeDayResults(titles, "me")).toEqual({
    title: "Yesterday in Arox",
    body: "👑 anna 84.0M · 🐙 you 3.1× · 🚢 alice 4 PRs",
  });
});
