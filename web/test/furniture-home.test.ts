import { expect, test } from "bun:test";
import { HOME_PIECES } from "@tokenmaxxing/core/home.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { fancyPiece } from "../src/art/furniture-fancy.ts";
import { HOME_FURNITURE } from "../src/art/furniture-home.ts";
import { Pen } from "../src/art/pixels.ts";

test("every personal-office piece has its art, and every art is a piece", () => {
  expect(HOME_FURNITURE.map((f) => f.id).sort()).toEqual(HOME_PIECES.map((p) => p.art).sort());
  expect(new Set(HOME_FURNITURE.map((f) => f.id)).size).toBe(HOME_FURNITURE.length);
  for (const p of HOME_PIECES) {
    const art = fancyPiece(p.art)!;
    expect(art).toBeDefined();
    expect(art.w).toBe(p.w ?? 1);
    expect(art.name).toBe(p.name);
    expect(art.price).toBe(p.price);
    // Wall pieces fit the office's single row of wall face; rugs lie flat.
    if (p.wall) {
      expect(art.placement).toBe("wall");
      expect(art.height).toBe(TILE);
    }
    expect(art.placement === "flat").toBe(p.flat === true);
    expect(art.height).toBeGreaterThanOrEqual(TILE);
  }
});

test("every frame draws something, on whole pixels inside its sprite", () => {
  for (const f of HOME_FURNITURE)
    for (let frame = 0; frame < f.frames; frame++) {
      const out: string[] = [];
      let painted = 0;
      const g = {
        fillStyle: "",
        fillRect(x: number, y: number, w: number, h: number) {
          if (w <= 0 || h <= 0) return;
          painted++;
          if (
            ![x, y, w, h].every(Number.isInteger) ||
            x < 0 ||
            y < 0 ||
            x + w > f.w * TILE ||
            y + h > f.height
          )
            out.push(`${x},${y} ${w}x${h}`);
        },
      };
      f.draw(new Pen(g as unknown as CanvasRenderingContext2D), frame, f.tint ?? "#6d7fc4");
      expect({ id: f.id, frame, out }).toEqual({ id: f.id, frame, out: [] });
      expect(painted).toBeGreaterThan(10);
    }
});
