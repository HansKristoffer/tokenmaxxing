import { expect, test } from "bun:test";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";
import { hatPreview } from "../src/render3d/shops/clothes-items.ts";

installHeadlessGlobals();

test("shop hat brims clear the display head", () => {
  // The display head is a voxel ball: 0.25 * 1.8 * 1.04 / 2 high.
  for (const [name, base] of [
    ["Julehue", -0.015],
    ["Santa hat", -0.015],
    ["Archmage hat", 0.12],
    ["Cowboy coder hat", 0.13],
    ["Lucky lure hat", -0.012],
  ] as const) {
    const hat = hatPreview(name).getObjectByName("hat-preview-gear");
    expect(hat, name).toBeDefined();
    expect(hat!.position.y + base, name).toBeGreaterThan(0.234);
  }
});

test("head-wrapping preview hats retain their original position", () => {
  expect(hatPreview("Viking helmet").getObjectByName("hat-preview-gear")!.position.y).toBe(0);
});
