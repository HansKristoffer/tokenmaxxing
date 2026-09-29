import { describe, expect, test } from "bun:test";
import { PICK_MS, REVEAL_MS, type SprState, spr } from "../../src/games/spr.ts";
import { isRefused } from "../../src/games/types.ts";

const T0 = 1_000_000;
const play = (s: SprState, player: number, pick: string, now: number) => {
  const r = spr.move(s, player, { pick }, now);
  if (isRefused(r)) throw new Error(r.refused);
  return r;
};
/** Both pick, then the reveal ends. */
const round = (s: SprState, a: string, b: string, now: number) =>
  spr.tick!(play(play(s, 1, a, now), 2, b, now), now + REVEAL_MS);

describe("Ship, Pivot, Raise", () => {
  test("ship beats raise, raise beats pivot, pivot beats ship; draws replay", () => {
    let s = spr.setup([1, 2], 7, {}, T0);
    s = round(s, "ship", "raise", T0);
    s = round(s, "pivot", "raise", T0 + 3000);
    s = round(s, "pivot", "ship", T0 + 6000);
    s = round(s, "ship", "ship", T0 + 9000);
    expect(s.rounds.map((r) => r.winner)).toEqual([1, 2, 1, null]);
    expect(spr.outcome(s)).toBeNull();
    s = round(s, "raise", "pivot", T0 + 12_000);
    expect(spr.outcome(s)).toEqual({ places: [[1], [2]] });
  });

  test("the other pick stays secret until both have picked", () => {
    let s = spr.setup([1, 2], 7, {}, T0);
    s = play(s, 1, "ship", T0);
    expect(spr.view(s, 1, T0).mine).toBe("ship");
    expect(spr.view(s, 2, T0).mine).toBeNull();
    expect(JSON.stringify(spr.view(s, 2, T0))).not.toContain("ship");
    expect(JSON.stringify(spr.view(s, null, T0))).not.toContain("ship");
    expect(spr.view(s, 2, T0).picked).toEqual({ 1: true, 2: false });
    s = play(s, 2, "raise", T0 + 100);
    expect(spr.view(s, null, T0 + 100).rounds[0]!.picks).toEqual({ 1: "ship", 2: "raise" });
  });

  test("a missed pick loses the round; picking twice or during the reveal is refused", () => {
    let s = spr.setup([1, 2], 7, {}, T0);
    s = play(s, 2, "pivot", T0);
    expect(isRefused(spr.move(s, 2, { pick: "ship" }, T0))).toBe(true);
    s = spr.tick!(s, T0 + PICK_MS);
    expect(s.rounds[0]!.winner).toBe(2);
    expect(isRefused(spr.move(s, 1, { pick: "ship" }, T0 + PICK_MS + 1))).toBe(true);
    expect(isRefused(spr.move(s, 1, { pick: "nope" }, T0 + PICK_MS + REVEAL_MS))).toBe(true);
  });

  test("forfeiting hands the other player the win", () => {
    const s = spr.forfeit(spr.setup([1, 2], 7, {}, T0), 1, T0);
    expect(spr.outcome(s)).toEqual({ places: [[2], [1]] });
  });

  test("callouts say who beat what", () => {
    const s = spr.setup([1, 2], 7, {}, T0);
    const after = play(play(s, 1, "ship", T0), 2, "raise", T0);
    expect(spr.callouts!(s, after)).toEqual([{ player: 1, text: "🚢 Ship beats Raise!" }]);
  });
});
