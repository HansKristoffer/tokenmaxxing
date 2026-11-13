import { expect, test } from "bun:test";
import { JULEMARKED_ITEMS } from "@tokenmaxxing/core/case-julemarked.ts";
import type * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) n++;
  });
  return n;
};

test("every Julemarked hat, glasses, held, back and outfit has its 3D builder", async () => {
  const { HAT_BUILDERS, FACE_BUILDERS, HELD_BUILDERS, BACK_BUILDERS, OUTFIT_BUILDERS, outfitColours } =
    await import("../src/render3d/people/gear3d.ts");
  for (const item of JULEMARKED_ITEMS) {
    const where = `${item.slot}: ${item.name}`;
    if (item.slot === "hat") expect(HAT_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "glasses") expect(FACE_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "held") expect(HELD_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "back") expect(BACK_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "outfit") {
      expect(OUTFIT_BUILDERS[item.index], where).toBeTypeOf("function");
      expect(outfitColours(item.index).outfit[0]).not.toBe(outfitColours(0).outfit[0]);
    }
  }
});

test("a character wearing each Julemarked item is dressed in more than a bare one, in both body styles, and animates", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  const { setSmoothBands } = await import("../src/render3d/kit/kit.ts");
  const bare = { style: 0, skin: 1, hair: 2, outfit: 1 };
  for (const voxel of [false, true]) {
    setSmoothBands(voxel);
    const style = voxel ? "voxel" : "grown";
    const base = meshes(avatarFor(bare, undefined, style).root);
    for (const item of JULEMARKED_ITEMS) {
      if (item.slot === "pet" || item.slot === "aura") continue;
      // Body gear is built on the blocky body only (as for the other cases).
      if (!voxel && (item.slot === "outfit" || item.slot === "back")) continue;
      const a = avatarFor({ ...bare, [item.slot]: item.index }, undefined, style);
      expect(meshes(a.root), `${style} ${item.slot}: ${item.name}`).toBeGreaterThan(base);
      expect(meshes(a.root), `${item.name} stays modest`).toBeLessThan(base + 900);
      for (const t of [0, 0.7, 1.9]) a.update(1 / 30, t);
      a.pose = "walk";
      a.update(1 / 30, 2.5);
      a.dispose();
    }
  }
  setSmoothBands(false);
});
