import { describe, expect, test } from "bun:test";
import { byDoor, FRAME_MS, LINGER_MS, SWING_FRAMES, shut, swingStep } from "../src/game/doors.ts";
import { copenhagenDay, SPECIALS, STRIDE, specialOn } from "../src/game/specials.ts";

describe("door swing", () => {
  test("opens a frame at a time while someone's by it, lingers, then shuts", () => {
    const s = shut();
    const frames: number[] = [];
    let t = 1000;
    for (; t < 1000 + FRAME_MS * 5; t += FRAME_MS) frames.push(swingStep(s, true, t));
    expect(frames).toEqual([1, 2, 3, 3, 3]);
    // They walk off: it stays open a moment, then swings shut.
    const gone = t - FRAME_MS;
    expect(swingStep(s, false, gone + LINGER_MS - 1)).toBe(SWING_FRAMES);
    expect(swingStep(s, false, gone + LINGER_MS)).toBe(2);
    expect(swingStep(s, false, gone + LINGER_MS + 1)).toBe(2); // not faster than a frame per FRAME_MS
    expect(swingStep(s, false, gone + LINGER_MS + FRAME_MS)).toBe(1);
    expect(swingStep(s, false, gone + LINGER_MS + FRAME_MS * 2)).toBe(0);
    expect(swingStep(s, false, gone + LINGER_MS + FRAME_MS * 3)).toBe(0);
  });

  test("by the door: on it or the step in front, not walking along the road below", () => {
    expect(byDoor(5, 6, 5, 6)).toBe(true);
    expect(byDoor(5, 7, 5, 6)).toBe(true);
    expect(byDoor(6, 7, 5, 6)).toBe(true);
    expect(byDoor(5.5, 7.5, 5, 6)).toBe(true); // mid-step
    expect(byDoor(5, 8, 5, 6)).toBe(false);
    expect(byDoor(7, 7, 5, 6)).toBe(false);
    expect(byDoor(5, 5, 5, 6)).toBe(false); // inside the walls
  });
});

describe("the Inn's special", () => {
  test("changes at midnight in Copenhagen, not UTC", () => {
    // 23:30 UTC on 20 October is 01:30 on the 21st in Copenhagen (summer time).
    const late = new Date("2026-10-20T23:30:00Z");
    expect(copenhagenDay(late)).toBe(copenhagenDay(new Date("2026-10-21T12:00:00Z")));
    expect(copenhagenDay(new Date("2026-10-20T21:59:00Z"))).toBe(copenhagenDay(late) - 1);
    // Winter: UTC+1.
    expect(copenhagenDay(new Date("2026-12-31T23:00:00Z"))).toBe(
      copenhagenDay(new Date("2027-01-01T12:00:00Z")),
    );
    expect(specialOn(late)).toBe(specialOn(new Date("2026-10-21T21:00:00Z")));
  });

  test("every special comes round once before any repeats", () => {
    expect(SPECIALS.length).toBeGreaterThanOrEqual(40);
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    expect(gcd(STRIDE, SPECIALS.length)).toBe(1);
    const start = Date.parse("2026-10-21T12:00:00Z");
    const seen = new Set(SPECIALS.map((_, i) => specialOn(new Date(start + i * 86_400_000))));
    expect(seen.size).toBe(SPECIALS.length);
    expect(new Set(SPECIALS).size).toBe(SPECIALS.length);
  });
});
