import { expect, test } from "bun:test";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { FANCY_FURNITURE } from "../src/art/furniture-fancy.ts";
import { recorder } from "./support.ts";

test("every fancy piece has a unique id, a valid footprint, frames and a price", () => {
  expect(FANCY_FURNITURE.length).toBeGreaterThanOrEqual(25);
  expect(new Set(FANCY_FURNITURE.map((f) => f.id)).size).toBe(FANCY_FURNITURE.length);
  for (const f of FANCY_FURNITURE) {
    for (const n of [f.w, f.h, f.frames]) expect(Number.isInteger(n) && n >= 1).toBe(true);
    expect(f.w * f.h).toBeLessThanOrEqual(6);
    expect(f.frames).toBeLessThanOrEqual(4);
    expect(f.height).toBeGreaterThanOrEqual(f.h * TILE);
    expect(f.frameMs).toBeGreaterThan(0);
    expect(f.price).toBeGreaterThan(0);
    if (f.tint !== null) expect(f.tint).toMatch(/^#[0-9a-f]{6}$/);
  }
});

test("every frame draws something, on whole pixels inside its sprite", () => {
  for (const f of FANCY_FURNITURE)
    for (let frame = 0; frame < f.frames; frame++) {
      const r = recorder(f.w * TILE, f.height);
      f.draw(r.pen, frame, f.tint ?? "#6d7fc4");
      expect({ id: f.id, frame, out: r.bad }).toEqual({ id: f.id, frame, out: [] });
      expect(r.painted()).toBeGreaterThan(10);
    }
});
