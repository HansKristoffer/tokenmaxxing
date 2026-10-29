import { expect, test } from "bun:test";
import { PRESTIGE_BASE, PRESTIGE_ITEMS } from "@tokenmaxxing/core/prestige.ts";
import { isPrestigeBack, isPrestigeOutfit, smoothFit } from "../src/render3d/people/gear3dSmoothBody.ts";

test("every prestige back item and outfit index is dressed on smooth bodies, nothing else", () => {
  for (const i of PRESTIGE_ITEMS.filter((x) => x.slot === "back")) expect(isPrestigeBack(i.name)).toBe(true);
  for (const i of PRESTIGE_ITEMS.filter((x) => x.slot === "outfit"))
    expect(isPrestigeOutfit(i.index)).toBe(true);
  expect(isPrestigeBack("Cape")).toBe(false);
  expect(isPrestigeOutfit(PRESTIGE_BASE - 1)).toBe(false);
});

test("a fit exists for the grown, chibi and bot bodies and scales stay positive", () => {
  for (const [style, human] of [
    ["grown", true],
    ["chibi", true],
    ["animal", true],
    ["bot", true],
  ] as const) {
    const f = smoothFit(style, human, 1)!;
    expect(f).not.toBeNull();
    for (const v of [...f.torso, ...f.arm, f.back]) expect(v).toBeGreaterThan(0);
  }
  expect(smoothFit("grown", false)).toBeNull();
  expect(smoothFit("animal", false)).toBeNull();
  expect(smoothFit("voxel", true)).toBeNull();
});
