import { expect, test } from "bun:test";
import { PRESTIGE_BASE, PRESTIGE_ITEMS, PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import { CASE_HATS } from "../src/art/case.ts";
import { TRACK } from "../src/art/prestige-4.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";
import { checkRows, countMeshes, recorder } from "./support.ts";

installHeadlessGlobals();

const rank = 4;
const index = PRESTIGE_BASE + rank - 1;
const mine = PRESTIGE_ITEMS.filter((i) => i.index === index);
const named = (slot: string) => mine.find((i) => i.slot === slot)!;

test("track 4 has all four wearables", () => {
  expect(PRESTIGE_TRACKS[rank - 1]!.key).toBe("architect");
  expect(mine.map((i) => i.slot).sort()).toEqual(["aura", "back", "hat", "outfit"]);
});

test("the hat has three views on 16 columns, merged into the case hats", () => {
  const hat = TRACK.hat!;
  expect(CASE_HATS[named("hat").id]).toBe(hat);
  for (const v of ["down", "side", "up"] as const) checkRows(`hat ${v}`, hat[v]!, hat.pal);
});

test("the outfit has three views of marks in its palette", () => {
  const o = TRACK.outfit!;
  for (const v of ["down", "side", "up"] as const) {
    expect(o.marks[v].length).toBeGreaterThanOrEqual(3);
    checkRows(`outfit ${v}`, o.marks[v], { ...o.pal, c: "x", C: "x", p: "x" });
  }
});

test("the back item has every view in its palette", () => {
  const b = TRACK.back!;
  for (const v of ["down", "side", "up"] as const) {
    for (const rows of [b.views[v].behind, b.views[v].front, b.walk?.[v]?.behind, b.walk?.[v]?.front])
      if (rows) {
        expect(rows.length).toBeLessThanOrEqual(16);
        checkRows(`back ${v}`, rows, b.pal);
      }
    expect(b.views[v].behind ?? b.views[v].front).toBeDefined();
  }
});

test("the aura draws on every frame, inside its 28x28 canvas", () => {
  for (let f = 0; f < 8; f++) {
    const r = recorder(28, 28);
    TRACK.aura!(r.pen, f);
    expect({ f, bad: r.bad }).toEqual({ f, bad: [] });
    expect(r.painted(), `frame ${f}`).toBeGreaterThan(15);
  }
});

test("the 3D builders are registered under the right keys", async () => {
  const { HAT_BUILDERS, BACK_BUILDERS } = await import("../src/render3d/people/gear3d.ts");
  const { OUTFIT_BUILDERS } = await import("../src/render3d/people/gear3dBody.ts");
  const { AURA_BUILDERS } = await import("../src/render3d/people/gear3dAura.ts");
  const { COVERS_HAIR } = await import("../src/render3d/people/gear3dHead.ts");
  await import("../src/render3d/people/gear3dPrestige.ts");
  expect(HAT_BUILDERS[named("hat").name]).toBeTypeOf("function");
  expect(COVERS_HAIR.has(named("hat").name)).toBe(true);
  expect(BACK_BUILDERS[named("back").name]).toBeTypeOf("function");
  expect(AURA_BUILDERS[named("aura").name]).toBeTypeOf("function");
  expect(OUTFIT_BUILDERS[index]).toBeTypeOf("function");
});

test("dressed in the set, smooth or blocky, a character has more parts than a bare one and animates", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  await import("../src/render3d/people/gear3dPrestige.ts");
  const bare = { style: 0, skin: 1, hair: 2, outfit: 1 };
  for (const style of ["voxel", "grown"] as const) {
    const base = countMeshes(avatarFor(bare, undefined, style).root);
    const a = avatarFor({ ...bare, outfit: index, hat: index, back: index, aura: index }, undefined, style);
    expect(countMeshes(a.root), style).toBeGreaterThan(base + 10);
    for (const t of [0, 0.7, 1.9, 3.1]) a.update(1 / 30, t);
    a.pose = "walk";
    a.update(1 / 30, 4.5);
    a.dispose();
  }
});
