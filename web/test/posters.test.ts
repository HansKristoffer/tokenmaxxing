import { expect, test } from "bun:test";
import { COMPANY_FURNITURE } from "@tokenmaxxing/core/office.ts";
import { POSTERS } from "@tokenmaxxing/core/posters.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { drawPoster, POSTER_ART, POSTER_H, posterArt } from "../src/art/furniture-posters.ts";
import { recorder } from "./support.ts";

test("every poster in the catalog has its art, and every art is a poster", () => {
  for (const p of COMPANY_FURNITURE.filter((f) => f.wall)) {
    const a = posterArt(p.art);
    expect(a?.w).toBe(p.w ?? 1);
    expect(a?.title.length).toBeGreaterThan(0);
    // The title is drawn in the 3x5 font (4 pixels a letter) and has to fit the band.
    expect(a!.title.length * 4 - 1).toBeLessThanOrEqual(a!.w * TILE - 4);
    expect(a!.title).toMatch(/^[A-Z0-9&.!-]+$/);
  }
  expect(POSTER_ART.map((a) => a.id).sort()).toEqual(POSTERS.map((p) => p.art).sort());
  expect(new Set(POSTER_ART.map((a) => a.id)).size).toBe(POSTER_ART.length);
});

test("every poster draws something on whole pixels inside its sprite", () => {
  for (const a of POSTER_ART) {
    const r = recorder(a.w * TILE, POSTER_H);
    drawPoster(r.pen, a);
    expect({ id: a.id, bad: r.bad }).toEqual({ id: a.id, bad: [] });
    expect(r.painted()).toBeGreaterThan(40);
  }
});
