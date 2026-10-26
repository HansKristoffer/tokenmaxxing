import { expect, test } from "bun:test";
import * as THREE from "three";
import { PlayerOcclusion, seeThrough } from "../src/render3d/engine/seethrough.ts";
import { Model } from "../src/render3d/kit/kit.ts";
import { bakeStatic } from "../src/render3d/perf/bake.ts";

const player = new THREE.Vector3(0, 0.9, 0);
const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 1, 100);
camera.position.set(0, 10, 20);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

for (const batched of [false, true]) {
  test(`${batched ? "batched" : "unbatched"} cutaways reveal walls and roofs but leave small props intact`, () => {
    const cases = [
      { size: [3, 3, 0.2], at: [0, 0, 2], hidden: true },
      { size: [3, 0.2, 4], at: [0, 2, 2], hidden: true },
      { size: [0.045, 3, 0.1], at: [0, 0, 2], hidden: false },
      { size: [1, 1.6, 0.2], at: [0, 0, 2], hidden: false },
      { size: [3, 3, 0.2], at: [0, 0, -2], hidden: false },
      { size: [0.3, 3, 0.2], at: [0.8, 0, 2], hidden: false },
    ] satisfies { size: [number, number, number]; at: [number, number, number]; hidden: boolean }[];

    for (const scenario of cases) {
      const root = new Model();
      root.box(scenario.size, "#776655", scenario.at, 0);
      root.box([8, 0.1, 8], "#887766", [0, -0.1, 0], 0);
      seeThrough(root);
      const layer = batched ? bakeStatic(root) : null;
      layer?.show("block");
      try {
        const reveal = new PlayerOcclusion(root).update(player, camera, 0.1, true);
        expect(reveal).toBe(scenario.hidden ? 1 : 0);
      } finally {
        layer?.dispose();
      }
    }
  });
}

test("cutaways ignore glass and hidden scenery, and ease back after an obstruction moves away", () => {
  const root = new Model();
  const wall = root.box([3, 3, 0.2], "#776655", [0, 0, 2], 0);
  const glass = root.box(
    [3, 3, 0.2],
    new THREE.MeshToonMaterial({ transparent: true, opacity: 0.2 }),
    [0, 0, 3],
    0,
  );
  seeThrough(root);
  const occlusion = new PlayerOcclusion(root);
  const opening = occlusion.update(player, camera, 0.05, false);
  expect(opening).toBeGreaterThan(0);
  expect(opening).toBeLessThan(1);
  wall.position.x = 4;
  const closing = occlusion.update(player, camera, 0.1, false);
  expect(closing).toBeLessThan(opening);
  wall.position.x = 0;
  wall.visible = false;
  expect(occlusion.update(player, camera, 0.1, true)).toBe(0);
  glass.visible = false;
  wall.visible = true;
  expect(occlusion.update(player, camera, 0.1, true)).toBe(1);
});
