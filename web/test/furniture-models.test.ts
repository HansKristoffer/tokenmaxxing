import { expect, test } from "bun:test";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

test("touched grass has a voxel model that fits its two-tile footprint", async () => {
  const { extraAssetById } = await import("../src/render3d/furniture/furniture3d.ts");
  const asset = extraAssetById.get("touched-grass")!;
  expect(asset.w).toBe(2);
  expect(asset.d).toBe(1);
  const model = asset.build();
  const box = new THREE.Box3().setFromObject(model);
  // Two tiles wide and one deep at most, a patch not a hedge.
  expect(box.max.x - box.min.x).toBeLessThanOrEqual(2);
  expect(box.max.z - box.min.z).toBeLessThanOrEqual(1);
  expect(box.max.y).toBeLessThan(0.7);
  let meshes = 0;
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes++;
  });
  expect(meshes).toBeGreaterThan(20); // sod, tufts and flowers
});

test("wall furniture outside the floor inset is hung once on the inner wall face", async () => {
  const { HOME_PIECES } = await import("@tokenmaxxing/core/home.ts");
  const { withPieces, officeMap } = await import("@tokenmaxxing/core/office.ts");
  const { Room } = await import("../src/render3d/rooms/room.ts");
  Object.assign(globalThis.location, { origin: "http://localhost:4663" });
  const { furnish } = await import("../src/render3d/rooms/room-furnished.ts");
  const piece = HOME_PIECES.find((p) => p.wall && p.w === 2)!;
  const map = withPieces([{ ch: piece.ch, x: 1, y: 0 }], officeMap(0));
  const room = new Room(map.width - 2, map.height - 2);
  const hung = furnish(room, map, [1, 1]).filter((p) => p.asset.id === piece.art);
  expect(hung).toHaveLength(1);
  expect(hung[0]!.model.position.toArray()).toEqual([1, 0.95, 0.01]);
  expect(hung[0]!.model.parent).toBe(room.group);
});

test("company chandelier uses the preview model and centres on a rotated footprint", async () => {
  const { buildHq } = await import("../src/render3d/rooms/hq3d.ts");
  const { extraAssetById } = await import("../src/render3d/furniture/furniture3d.ts");
  const { room } = buildHq({ placed: [{ ch: "λ", x: 19, y: 8, rot: 1 }] });
  const placed = room.placed.find((p) => p.asset.id === "chandelier")!;
  expect(placed.asset).toBe(extraAssetById.get("chandelier")!);
  expect(placed.model.position.toArray()).toEqual([18.5, 0, 7]);
  const box = new THREE.Box3().setFromObject(placed.model);
  expect(box.max.y).toBeGreaterThan(2.5);
  expect(box.min.y).toBeGreaterThan(1);
});
