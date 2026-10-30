import { beforeAll, expect, test } from "bun:test";
import { FESTIVE } from "@tokenmaxxing/core/festive.ts";
import { copenhagenToMs } from "@tokenmaxxing/core/sky.ts";
import { festiveGrade, festiveGreeting, SKY } from "../src/game/festive-palette.ts";
import { resolveSettings, sanitizeOverrides } from "../src/settings/graphics.ts";

test("seasonal effects are on unless the player turns them off", () => {
  expect(resolveSettings("low").seasonal).toBe(true);
  expect(resolveSettings("high", { seasonal: false }).seasonal).toBe(false);
  expect(sanitizeOverrides({ seasonal: false })).toEqual({ seasonal: false });
  expect(sanitizeOverrides({ seasonal: "no" })).toEqual({});
});

test("the toast copy", () => {
  expect(festiveGreeting({ id: "halloween", intensity: 1, days: 0 })).toBe("🎃 Happy Halloween");
  expect(festiveGreeting({ id: "christmas", intensity: 0.5, days: -6 })).toBe("🎄 6 sleeps to Christmas");
  expect(festiveGreeting({ id: "christmas", intensity: 0.9, days: -1 })).toBe("🎄 1 sleep to Christmas");
  expect(festiveGreeting({ id: "christmas", intensity: 1, days: 0 })).toBe("🎄 Merry Christmas Eve");
  expect(festiveGreeting({ id: "christmas", intensity: 1, days: 1 })).toBe("🎄 Merry Christmas");
});

test("every theme has a greeting, a grade and a sky", () => {
  for (const id of Object.keys(FESTIVE) as (keyof typeof FESTIVE)[])
    for (const days of [-3, 0, 1]) {
      const text = festiveGreeting({ id, intensity: 0.7, days });
      expect(text.length).toBeGreaterThan(4);
      expect(festiveGrade({ id, intensity: 0.7, days }, 0.5, 0.5).k).toBeGreaterThan(0);
    }
  expect(festiveGreeting({ id: "paaske", intensity: 1, days: 0 })).toBe("🐣 Glædelig påske, Easter Sunday");
  expect(festiveGreeting({ id: "agustusan", intensity: 1, days: 0 })).toContain("Selamat Hari Kemerdekaan");
});

test("the grade grows with the intensity and the dark, and stays a colour", () => {
  const f = (intensity: number) => ({ id: "halloween" as const, intensity, days: 0 });
  expect(festiveGrade(f(1), 1, 0).k).toBeGreaterThan(festiveGrade(f(0.5), 1, 0).k);
  expect(festiveGrade(f(1), 1, 0).k).toBeGreaterThan(festiveGrade(f(1), 0, 0).k);
  for (const id of ["halloween", "christmas"] as const)
    for (const [d, w] of [
      [0, 0],
      [0, 1],
      [1, 0],
      [0.5, 0.5],
    ] as const) {
      const g = festiveGrade({ id, intensity: 1, days: 0 }, d, w);
      expect(g.k).toBeGreaterThanOrEqual(0);
      expect(g.k).toBeLessThanOrEqual(1);
      for (const c of g.rgb) (expect(c).toBeGreaterThanOrEqual(0), expect(c).toBeLessThanOrEqual(255));
    }
  expect(Object.keys(SKY).sort()).toEqual(Object.keys(FESTIVE).sort());
});

// The wrapper reads the page URL once, on load: stub a page before importing it.
let wrapper: typeof import("../src/game/festive.ts");
let store: typeof import("../src/store.ts");
let gfx: typeof import("../src/settings/graphics.ts");
const clock = { now: Date.now() };
beforeAll(async () => {
  Object.assign(globalThis, { location: { search: "" } });
  wrapper = await import("../src/game/festive.ts");
  store = await import("../src/store.ts");
  gfx = await import("../src/settings/graphics.ts");
});

test("festiveNow follows the pin, the setting and the minute", () => {
  const real = Date.now;
  const at = (iso: string) => {
    clock.now = copenhagenToMs(iso)!;
    Date.now = () => clock.now;
  };
  try {
    at("2026-07-01T12:00");
    expect(wrapper.festiveNow()).toBeNull();
    // The server's pin.
    store.hud.set({ festivePin: "christmas@12-22" });
    expect(wrapper.festiveNow()).toMatchObject({ id: "christmas", days: -2 });
    // The player's setting beats the server's pin ...
    gfx.graphics.override("seasonal", false);
    expect(wrapper.festiveNow()).toBeNull();
    gfx.graphics.override("seasonal", undefined);
    expect(wrapper.festiveNow()).toMatchObject({ id: "christmas" });
    store.hud.set({ festivePin: null });
    expect(wrapper.festiveNow()).toBeNull();
    // ... and the clock, cached through the minute, moves on with it.
    at("2026-10-31T21:00");
    expect(wrapper.festiveNow()?.id).toBe("halloween");
    gfx.graphics.override("seasonal", false);
    expect(wrapper.festiveNow()).toBeNull();
    gfx.graphics.override("seasonal", undefined);
    at("2026-11-01T00:01");
    expect(wrapper.festiveNow()).toBeNull();
    expect(wrapper.intensityNow()).toBe(0);
  } finally {
    Date.now = real;
  }
});
