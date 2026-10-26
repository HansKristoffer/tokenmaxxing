import { beforeAll, expect, test } from "bun:test";
import { Model } from "../src/render3d/kit/kit.ts";
import { bakeStatic } from "../src/render3d/perf/bake.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";
import type { RoomView } from "../src/render3d/rooms/rooms.ts";
import { dropPropsNight, setPropsNight, streetLamp } from "../src/render3d/town/props.ts";

installHeadlessGlobals();

let RoomStage: typeof import("../src/render3d/engine/stage3d.ts").RoomStage;
beforeAll(async () => {
  ({ RoomStage } = await import("../src/render3d/engine/stage3d.ts"));
});

for (const night of [false, true]) {
  test(`batching a ${night ? "night" : "day"} scene preserves its lamp lighting`, () => {
    const group = new Model();
    group.add(streetLamp());
    const view: RoomView = {
      id: "lighting",
      group,
      outdoors: false,
      bounds: { minX: -4, maxX: 4, minZ: -4, maxZ: 4, height: 3 },
      view: 8,
      toWorld: (x, y) => [x, y],
      toTile: (x, z) => [x, z],
      seatY: () => 0,
      tick() {},
      signs: () => [],
      night: setPropsNight,
      dispose: () => dropPropsNight(group),
    };
    const stage = new RoomStage(view);
    setPropsNight(night);
    const layer = bakeStatic(group)!;
    try {
      for (const mode of ["smooth", "block"] as const) {
        layer.show(mode);
        const visibleGlows: string[] = [];
        layer.group.traverseVisible((mesh) => {
          if (mesh.userData.glow) visibleGlows.push(mesh.userData.glow);
        });
        expect(visibleGlows.length).toBeGreaterThan(0);
        expect(new Set(visibleGlows)).toEqual(new Set([night ? "night" : "day"]));
      }
    } finally {
      layer.dispose();
      stage.dispose();
      setPropsNight(false);
    }
  });
}
