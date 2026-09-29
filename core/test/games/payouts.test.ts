import { describe, expect, test } from "bun:test";
import { odds, potShares, sideBetShares } from "../../src/games/payouts.ts";

const sum = (m: Map<number, number>) => [...m.values()].reduce((n, x) => n + x, 0);

describe("pots", () => {
  test("winner takes all; a tie splits it, the odd coin to the lowest id", () => {
    expect(potShares([[2], [1]], 100, "all")).toEqual(new Map([[2, 100]]));
    const tie = potShares([[3, 1], [2]], 101, "all");
    expect(tie.get(1)).toBe(51);
    expect(tie.get(3)).toBe(50);
    expect(sum(tie)).toBe(101);
  });

  test("top 3 is 60/30/10, with 4 players or more", () => {
    expect(potShares([[1], [2], [3], [4]], 400, "top3")).toEqual(
      new Map([
        [1, 240],
        [2, 120],
        [3, 40],
      ]),
    );
    // With 3 players it's winner takes all.
    expect(potShares([[1], [2], [3]], 300, "top3").get(1)).toBe(300);
    // Tied second and third share 30 + 10.
    const tied = potShares([[1], [2, 3], [4]], 400, "top3");
    expect([tied.get(1), tied.get(2), tied.get(3)]).toEqual([240, 80, 80]);
  });

  test("top half splits evenly among the better half; every coin comes out", () => {
    const shares = potShares([[5], [4], [3], [2], [1]], 250, "half");
    expect([shares.get(5), shares.get(4), shares.has(3)]).toEqual([125, 125, false]);
    for (const pot of [7, 99, 1001])
      expect(sum(potShares([[1], [2], [3], [4], [5], [6]], pot, "half"))).toBe(pot);
  });
});

describe("side bets", () => {
  const bets = [
    { userId: 10, on: 1, amount: 100 },
    { userId: 11, on: 1, amount: 50 },
    { userId: 12, on: 2, amount: 90 },
  ];

  test("the winner's backers split the whole pool by stake", () => {
    const { refund, shares } = sideBetShares(bets, [1]);
    expect(refund).toBe(false);
    expect(shares).toEqual(
      new Map([
        [10, 160],
        [11, 80],
      ]),
    );
  });

  test("nobody backed the winner: everyone gets their bet back", () => {
    const { refund, shares } = sideBetShares(bets, [3]);
    expect(refund).toBe(true);
    expect(sum(shares)).toBe(240);
  });

  test("odds are the pool over what's on a player", () => {
    expect(odds(bets, 1)).toBe(1.6);
    expect(odds(bets, 2)).toBeCloseTo(2.667, 2);
    expect(odds(bets, 3)).toBeNull();
  });
});
