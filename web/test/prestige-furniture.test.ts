import { expect, test } from "bun:test";
import { PRESTIGE_PIECES } from "@tokenmaxxing/core/prestige-furniture.ts";
import { fancyPiece } from "../src/art/furniture-fancy.ts";
import { PRESTIGE_TROPHIES } from "../src/art/prestige-trophy.ts";
import { extraAssetById } from "../src/render3d/furniture/furniture3d.ts";

test("each trophy piece has 2D art and a 3D model of its footprint under its art id", () => {
  for (const p of PRESTIGE_PIECES) {
    const art = fancyPiece(p.art)!;
    expect(art, p.art).toBeDefined();
    expect(art.w).toBe(p.w ?? 1);
    expect(PRESTIGE_TROPHIES).toContain(art);
    const asset = extraAssetById.get(p.art)!;
    expect(asset, p.art).toBeDefined();
    expect(asset.w).toBe(p.w ?? 1);
  }
});
