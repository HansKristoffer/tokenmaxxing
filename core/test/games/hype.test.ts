import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  COUNTDOWN_MS,
  crashPoint,
  type HypeState,
  hype,
  msToReach,
  multiplier,
} from "../../src/games/hype.ts";
import { sha256 } from "../../src/games/sha256.ts";
import { isRefused } from "../../src/games/types.ts";

const T0 = 1_000_000;
const start = (players = [1, 2]) => hype.setup(players, 7, {}, T0);
const move = (s: HypeState, p: number, now: number) => {
  const r = hype.move(s, p, { cashOut: true }, now);
  if (isRefused(r)) throw new Error(r.refused);
  return r;
};
/** Runs the current round until it crashes. */
const crash = (s: HypeState) => {
  const r = s.rounds.find((x) => x.endedAt === null)!;
  return hype.tick!(s, r.startsAt + msToReach(r.crash / 100) + 1);
};

describe("Hype Cycle", () => {
  test("sha256 matches node's", () => {
    for (const t of ["", "abc", "x".repeat(55), "y".repeat(64), "å🚀".repeat(40)])
      expect(sha256(t)).toBe(createHash("sha256").update(t).digest("hex"));
  });

  test("crash points: ≥ ×1, ≤ ×50, about half under ×2", () => {
    const points = Array.from({ length: 2000 }, (_, i) => crashPoint(`s${i}`));
    expect(Math.min(...points)).toBeGreaterThanOrEqual(100);
    expect(Math.max(...points)).toBeLessThanOrEqual(5000);
    const under2 = points.filter((p) => p < 200).length / points.length;
    expect(under2).toBeGreaterThan(0.4);
    expect(under2).toBeLessThan(0.6);
  });

  test("the seed stays hidden until the round ends, and then checks out", () => {
    let s = start();
    const v = hype.view(s, 1, T0);
    expect(v.rounds).toHaveLength(1);
    expect(v.rounds[0]!.seed).toBeNull();
    expect(v.rounds[0]!.crash).toBeNull();
    expect(JSON.stringify(v)).not.toContain(s.rounds[0]!.seed);
    s = crash(s);
    const shown = hype.view(s, null, T0).rounds[0]!;
    expect(sha256(shown.seed!)).toBe(shown.hash);
    expect(crashPoint(shown.seed!)).toBe(shown.crash!);
  });

  test("cash out counts at arrival; too late after the crash; a crash scores 0", () => {
    let s = start();
    expect(isRefused(hype.move(s, 1, { cashOut: true }, T0))).toBe(true); // still counting down
    const r = s.rounds[0]!;
    const early = r.startsAt + msToReach(Math.min(1.01, r.crash / 100)) - 1;
    if (r.crash > 101) {
      s = move(s, 1, early);
      expect(s.rounds[0]!.cashed[1]).toBe(Math.floor(multiplier(early - r.startsAt) * 100));
    }
    expect(isRefused(hype.move(s, 2, { cashOut: true }, r.startsAt + msToReach(r.crash / 100) + 5))).toBe(
      true,
    );
    s = crash(s);
    expect(hype.view(s, null, T0).totals[2]).toBe(0);
    expect(s.rounds[1]!.startsAt).toBeGreaterThan(s.rounds[0]!.endedAt! + COUNTDOWN_MS);
  });

  test("everyone cashing out ends the round early", () => {
    let s = start();
    // Find a seed whose first round runs long enough to cash out.
    for (let seed = 1; s.rounds[0]!.crash < 150; seed++) s = hype.setup([1, 2], seed, {}, T0);
    const at = s.rounds[0]!.startsAt + msToReach(1.2);
    s = move(move(s, 1, at), 2, at + 10);
    expect(s.rounds[0]!.endedAt).toBe(at + 10);
    expect(hype.callouts!(start(), s).some((c) => c.text.startsWith("💥"))).toBe(false);
  });

  test("three rounds; highest total wins; all crashed is void", () => {
    let s = start([1, 2, 3]);
    for (let seed = 1; s.rounds.some((r) => r.crash < 130); seed++) s = hype.setup([1, 2, 3], seed, {}, T0);
    for (let i = 0; i < 3; i++) {
      const r = s.rounds[i]!;
      s = move(s, 1, r.startsAt + msToReach(1.25));
      s = move(s, 2, r.startsAt + msToReach(1.1));
      s = crash(s);
    }
    const out = hype.outcome(s);
    expect(out).toEqual({ places: [[1], [2], [3]] });

    let v = start();
    for (let i = 0; i < 3; i++) v = crash(v);
    expect(hype.outcome(v)).toEqual({ void: "Everyone crashed in every round." });
  });
});
