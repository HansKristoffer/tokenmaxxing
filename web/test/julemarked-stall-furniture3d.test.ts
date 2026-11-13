import { expect, test } from "bun:test";
import { JULEPYNT_PIECES } from "@tokenmaxxing/core/julemarked-shop.ts";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

test("every Julepynt piece has a 3D asset with core's footprint, and the wall ones hang", async () => {
  const { extraAssetById, WALL_ASSET_IDS } = await import("../src/render3d/furniture/furniture3d.ts");
  for (const p of JULEPYNT_PIECES) {
    const a = extraAssetById.get(p.art);
    expect(a, p.art).toBeDefined();
    expect(a!.w, p.art).toBe(p.w ?? 1);
    expect(a!.d, p.art).toBe(1);
    expect(WALL_ASSET_IDS.has(p.art), p.art).toBe(!!p.wall);
  }
});

test("each builds boxes only, fits its footprint, and wall pieces stay on the wall side", async () => {
  const { JST_ASSETS } = await import("../src/render3d/furniture/jst3d.ts");
  expect(JST_ASSETS.map((a) => a.id)).toEqual(JULEPYNT_PIECES.map((p) => p.art));
  for (const a of JST_ASSETS) {
    const m = a.build();
    let meshes = 0;
    m.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      meshes++;
      const g = (o as THREE.Mesh).geometry;
      expect(g instanceof THREE.SphereGeometry || g instanceof THREE.CylinderGeometry, a.id).toBe(false);
    });
    expect(meshes, a.id).toBeGreaterThan(8);
    const box = new THREE.Box3().setFromObject(m);
    expect(box.max.x - box.min.x, a.id).toBeLessThanOrEqual(1.25 * a.w);
    expect(box.max.x, a.id).toBeLessThanOrEqual(0.7);
    expect(box.min.x, a.id).toBeGreaterThanOrEqual(-0.7);
    if (a.wall) expect(box.min.z, a.id).toBeGreaterThanOrEqual(-0.011);
    else expect(box.min.y, a.id).toBeGreaterThanOrEqual(-0.001);
  }
});
