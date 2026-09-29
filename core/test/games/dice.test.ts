import { describe, expect, test } from "bun:test";
import { type DiceState, dice, REVEAL_MS, TURN_MS } from "../../src/games/dice.ts";
import { isRefused } from "../../src/games/types.ts";

const T0 = 1_000_000;
const ok = (s: DiceState, p: number, m: unknown, now = T0) => {
  const r = dice.move(s, p, m, now);
  if (isRefused(r)) throw new Error(r.refused);
  return r;
};
/** A game with the dice set by hand. */
const rigged = (d: Record<number, number[]>) => ({ ...dice.setup([1, 2, 3], 1, {}, T0), dice: d });

describe("Due Diligence", () => {
  test("five dice each, secret: you see yours and everyone's count", () => {
    const s = dice.setup([1, 2], 9, {}, T0);
    const v = dice.view(s, 1, T0);
    expect(v.mine).toHaveLength(5);
    expect(v.counts).toEqual({ 1: 5, 2: 5 });
    expect(JSON.stringify(dice.view(s, null, T0))).not.toContain(JSON.stringify(s.dice[2]));
  });

  test("raises must go up; unicorns can't be claimed; turns go round", () => {
    let s = rigged({ 1: [2, 2, 3, 4, 5], 2: [1, 6, 6, 3, 3], 3: [2, 4, 4, 4, 1] });
    expect(isRefused(dice.move(s, 2, { count: 2, face: 3 }, T0))).toBe(true); // not their turn
    expect(isRefused(dice.move(s, 1, { count: 2, face: 1 }, T0))).toBe(true); // 🦄
    expect(isRefused(dice.move(s, 1, { count: 16, face: 3 }, T0))).toBe(true); // more than on the table
    expect(isRefused(dice.move(s, 1, { liar: true }, T0))).toBe(true); // nothing to call
    s = ok(s, 1, { count: 3, face: 3 });
    expect(s.turn).toBe(2);
    expect(isRefused(dice.move(s, 2, { count: 3, face: 2 }, T0))).toBe(true);
    s = ok(s, 2, { count: 3, face: 5 });
    expect(s.turn).toBe(3);
  });

  test("Liar! with unicorns counted: the wrong one loses a die and starts the next round", () => {
    // 4s: 1, 3 (+ 2 🦄) = 6 with unicorns.
    let s = rigged({ 1: [2, 2, 3, 4, 5], 2: [1, 6, 6, 3, 3], 3: [2, 4, 4, 4, 1] });
    s = ok(s, 1, { count: 6, face: 4 });
    s = ok(s, 2, { liar: true }); // there were 6: the caller was wrong
    expect(s.dice[2]).toHaveLength(4);
    expect(s.reveal).toMatchObject({ actual: 6, loser: 2, caller: 2 });
    expect(s.turn).toBe(2);
    expect(isRefused(dice.move(s, 2, { count: 1, face: 2 }, T0 + 10))).toBe(true); // still revealing
    s = dice.tick!(s, T0 + REVEAL_MS);
    expect(s.reveal).toBeNull();
    s = ok(s, 2, { count: 9, face: 6 }, T0 + REVEAL_MS + 1);
    s = ok(s, 3, { liar: true }, T0 + REVEAL_MS + 2); // a bluff: the claimer loses one
    expect(s.dice[2]).toHaveLength(3);
  });

  test("a timeout costs a die", () => {
    const s = dice.setup([1, 2], 3, {}, T0);
    const t = dice.tick!(s, T0 + TURN_MS);
    expect(t.dice[1]).toHaveLength(4);
    expect(dice.callouts!(s, t).map((c) => c.text)).toContain("⏰ −1 🎲");
  });

  test("out of dice and you're out; places go in reverse order of elimination", () => {
    let s = rigged({ 1: [2], 2: [2], 3: [3, 3] });
    s = ok(s, 1, { count: 3, face: 3 });
    s = ok(s, 2, { liar: true }); // only 2 threes: 1 bluffed, and is out
    expect(s.out).toEqual([1]);
    expect(s.turn).toBe(2); // the one after the loser starts
    s = dice.tick!(s, T0 + REVEAL_MS);
    s = { ...s, dice: { ...s.dice, 2: [5], 3: [2, 2] } };
    s = ok(s, 2, { count: 2, face: 5 }, T0 + REVEAL_MS);
    s = ok(s, 3, { liar: true }, T0 + REVEAL_MS);
    expect(dice.outcome(s)).toEqual({ places: [[3], [2], [1]] });
  });
});
