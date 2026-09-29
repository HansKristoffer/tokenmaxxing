import { describe, expect, test } from "bun:test";
import { GRACE_MS, type TokenmaxxingState, tokenmaxxing as tm } from "../../src/games/tokenmaxxing.ts";

const T0 = Date.UTC(2026, 8, 29, 12, 0, 20);
const start = () => tm.setup([1, 2, 3], 0, { minutes: 15 }, T0);
const use = (s: TokenmaxxingState, p: number, tokens: number, at: number, flagged = false) =>
  tm.usage!(s, p, { tokens, flagged }, at);

describe("Tokenmaxxing", () => {
  test("starts on the minute after a minute's countdown; the window is the battle", () => {
    const s = start();
    expect(s.startsAt).toBe(Date.UTC(2026, 8, 29, 12, 2, 0));
    expect(s.endsAt - s.startsAt).toBe(15 * 60_000);
    expect(tm.usageWindow!(s)).toEqual({ from: s.startsAt, to: s.endsAt, until: s.endsAt + GRACE_MS });
    expect(tm.betsCloseAt(s)).toBe(s.startsAt + 90_000);
  });

  test("phases move with the clock, and it's final only after the grace period", () => {
    let s = start();
    s = tm.tick!(s, s.startsAt);
    expect(s.phase).toBe("live");
    s = use(s, 1, 500, s.startsAt + 1000);
    s = use(s, 2, 900, s.startsAt + 2000);
    s = tm.tick!(s, s.endsAt);
    expect(s.phase).toBe("grace");
    expect(tm.outcome(s)).toBeNull();
    s = use(s, 1, 900, s.endsAt + 60_000); // a late sync still counts
    s = tm.tick!(s, s.endsAt + GRACE_MS);
    expect(s.phase).toBe("over");
    expect(tm.usageWindow!(s)).toBeNull();
    expect(tm.outcome(s)).toEqual({ places: [[1, 2], [3]] }); // exact ties share
  });

  test("the scoreboard, the lead callout and the flag", () => {
    let s = tm.tick!(start(), start().startsAt);
    const before = s;
    s = use(s, 3, 2_000_000, s.startsAt + 1000, true);
    expect(tm.board!(s, 0)[0]).toEqual({ player: 3, value: 2_000_000, label: "2.0M" });
    expect(tm.callouts!(before, s)).toContainEqual({ player: 3, text: "🔥 Takes the lead!" });
    expect(tm.status!(s, 3, 0)).toBe("🏁 1st · 2.0M ⚠️");
  });

  test("nobody burning anything is void", () => {
    const s = tm.tick!(start(), start().endsAt + GRACE_MS);
    expect(tm.outcome(s)).toEqual({ void: "Nobody burned a single token." });
  });
});
