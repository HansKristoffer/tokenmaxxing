import { describe, expect, test } from "bun:test";
import { JULEPYNT_PIECES, STALL_BASE } from "@tokenmaxxing/core/julemarked-shop.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { fancyPiece } from "../src/art/furniture-fancy.ts";
import { PET_H, PET_W, PETS } from "../src/art/pet-base.ts";
import { Pen } from "../src/art/pixels.ts";

describe("Julemarked stall pets", () => {
  for (const [n, name] of [
    [0, "Gråspurv"],
    [1, "Snehare"],
    [2, "Pindsvin"],
    [3, "Rødt egern"],
    [4, "Sælunge"],
  ] as const) {
    test(`pet.${STALL_BASE + n} ${name} has two 12x10 frames`, () => {
      const pet = PETS[STALL_BASE + n]!;
      expect(pet).toBeDefined();
      expect(pet.frames).toHaveLength(2);
      for (const f of pet.frames) {
        expect(f).toHaveLength(PET_H);
        for (const row of f) {
          expect(row).toHaveLength(PET_W);
          for (const c of row) if (c !== ".") expect(pet.pal[c]).toBeDefined();
        }
      }
      expect(pet.frames[0]).not.toEqual(pet.frames[1]);
    });
  }
});

describe("Julepynt sprites", () => {
  for (const p of JULEPYNT_PIECES) {
    test(`${p.art} matches its footprint, placement and price`, () => {
      const f = fancyPiece(p.art)!;
      expect(f).toBeDefined();
      expect(f.w).toBe(p.w ?? 1);
      expect(f.h).toBe(1);
      expect(f.price).toBe(p.price);
      expect(f.placement).toBe(p.wall ? "wall" : "floor");
      if (p.wall) expect(f.height).toBe(TILE);
      for (let frame = 0; frame < f.frames; frame++) {
        let painted = 0;
        const g = {
          fillStyle: "",
          fillRect(x: number, y: number, w: number, h: number) {
            painted++;
            expect([x, y, w, h].every(Number.isInteger)).toBe(true);
            expect(x >= 0 && y >= 0 && x + w <= f.w * TILE && y + h <= f.height).toBe(true);
          },
        };
        f.draw(new Pen(g as unknown as CanvasRenderingContext2D), frame, "#fff");
        expect(painted).toBeGreaterThan(10);
      }
    });
  }
  test("the star and the tree animate, the rest are still", () => {
    expect(fancyPiece("jst-star")!.frames).toBe(2);
    expect(fancyPiece("jst-bordtree")!.frames).toBe(2);
    expect(fancyPiece("jst-gaver")!.frames).toBe(1);
  });
});
