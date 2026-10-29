import { describe, expect, test } from "bun:test";
import { MAX_LEVEL, levelFor } from "../src/format.ts";
import { PRESTIGE_TRACKS, RUN_LEVELS } from "../src/prestige.ts";
import {
  canPrestige,
  type PrestigeState,
  claimableBetween,
  playerPrestigeView,
  rewardsUnlocked,
  runCoinsPaid,
  runProgress,
  takePrestige,
} from "../src/prestige-run.ts";

const B = 1e9;

describe("prestige runs", () => {
  test("Hans: 142B, first journey done, prestige starts a fresh run", () => {
    expect(levelFor(142 * B)).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(50);
    expect(canPrestige(142 * B, [])).toBe(true);
    const s = takePrestige({ prestiges: [] }, 142 * B);
    expect(runProgress(142 * B, s.prestiges[0]!.startedAt)).toEqual({ level: 0, into: 0, toNext: B });
    expect(playerPrestigeView(142 * B, s.prestiges).runLevel).toBe(0);
    expect(playerPrestigeView(143.5 * B, s.prestiges).progress).toMatchObject({ level: 1, into: 0.5 * B });
    expect(canPrestige(142 * B, s.prestiges)).toBe(false);
  });

  test("not eligible below the cap or past the last track", () => {
    expect(canPrestige(49 * B, [])).toBe(false);
    expect(() => takePrestige({ prestiges: [] }, 49 * B)).toThrow();
    let s: PrestigeState = { prestiges: [] };
    let at = 50 * B;
    for (let i = 0; i < PRESTIGE_TRACKS.length; i++) {
      s = takePrestige(s, at);
      at += RUN_LEVELS * B;
    }
    expect(canPrestige(at, s.prestiges)).toBe(false);
    expect(() => takePrestige(s, at)).toThrow();
    expect(playerPrestigeView(at, s.prestiges).complete).toBe(true);
    expect(playerPrestigeView(at - B, s.prestiges).complete).toBe(false);
  });

  test("run level caps at 50 and the next prestige needs a full run", () => {
    const s = takePrestige({ prestiges: [] }, 50 * B);
    expect(canPrestige(99 * B, s.prestiges)).toBe(false);
    expect(runProgress(500 * B, 50 * B)).toEqual({ level: 50, into: 0, toNext: 0 });
    expect(canPrestige(100 * B, s.prestiges)).toBe(true);
    const s2 = takePrestige(s, 300 * B); // surplus does not bank
    expect(runProgress(300 * B, s2.prestiges[1]!.startedAt).level).toBe(0);
  });

  test("rewards unlock at their levels and diff for toasts", () => {
    expect(rewardsUnlocked(1, 0).map((r) => r.kind)).toEqual(["tag"]);
    expect(rewardsUnlocked(1, 10).map((r) => r.kind)).toEqual(["tag", "hat"]);
    expect(rewardsUnlocked(1, 50).map((r) => r.kind)).toEqual(["tag", "hat", "outfit", "petwear", "back", "aura", "trophy"]);
    expect(claimableBetween(1, 9, 20).rewards.map((r) => r.kind)).toEqual(["hat", "outfit"]);
    expect(claimableBetween(1, 9, 20).coins).toBe(runCoinsPaid(20) - runCoinsPaid(9));
    expect(runCoinsPaid(50)).toBe(2200);
  });

  test("view owns completed tracks and unlocked items", () => {
    const s = { prestiges: [{ startedAt: 50 * B }, { startedAt: 100 * B }] };
    const v = playerPrestigeView(100 * B + 25 * B, s.prestiges);
    expect(v.rank).toBe(2);
    expect(v.tag).toBe("Prestige II · Cosmic");
    expect(v.ownedItemIds).toEqual(["hat.700", "outfit.700", "back.700", "aura.700", "hat.701", "outfit.701"]);
    expect(v.nextTrack?.rank).toBe(3);
  });
});
