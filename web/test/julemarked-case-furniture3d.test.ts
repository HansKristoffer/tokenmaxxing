import { expect, test } from "bun:test";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const SMOOTH = new Set([
  "SphereGeometry",
  "CylinderGeometry",
  "TorusGeometry",
  "CapsuleGeometry",
  "CircleGeometry",
]);
const stats = (o: THREE.Object3D) => {
  let meshes = 0;
  const smooth: string[] = [];
  o.traverse((c) => {
    if (!(c as THREE.Mesh).isMesh) return;
    meshes++;
    const t = (c as THREE.Mesh).geometry.type;
    if (SMOOTH.has(t)) smooth.push(t);
  });
  return { meshes, smooth };
};

test("the Julemarked case furniture is all boxes, animates, and keeps its footprint", async () => {
  const { JUL_ASSETS } = await import("../src/render3d/furniture/jul3d.ts");
  const { ticks } = await import("../src/render3d/kit/kit.ts");
  expect(JUL_ASSETS.map((a) => [a.id, a.w, a.d])).toEqual([
    ["jul-heart-garland", 2, 1],
    ["jul-kalenderlys", 1, 1],
    ["jul-pebernod-bowl", 1, 1],
    ["jul-advent", 1, 1],
    ["jul-kravlenisse", 1, 1],
    ["jul-tree", 3, 1],
  ]);
  for (const a of JUL_ASSETS) {
    const before = ticks.length;
    const m = a.build();
    const s = stats(m);
    expect(s.smooth, a.id).toEqual([]);
    expect(s.meshes, a.id).toBeGreaterThan(40);
    expect(s.meshes, a.id).toBeLessThan(900);
    expect(ticks.length - before, `${a.id} moves`).toBeGreaterThan(0);
    for (const t of [0, 0.7, 2.4, 4.4, 8, 13.3]) for (const f of ticks.slice(before)) f(t);
    const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    expect(size.x, `${a.id} width`).toBeLessThan(a.w + 0.6);
    expect(size.z, `${a.id} depth`).toBeLessThan(a.d + 0.6);
  }
});

test("the Julemarked chest (closed and open) and key are boxes, animate, and the key rests on y = 0", async () => {
  const { buildJulemarkedBox, buildJulemarkedKey } = await import("../src/render3d/case-box3d-julemarked.ts");
  for (const [name, build] of [
    ["closed", (r: never) => buildJulemarkedBox(false, r)],
    ["open", (r: never) => buildJulemarkedBox(true, r)],
    ["key", (r: never) => buildJulemarkedKey(r)],
  ] as const) {
    const fns: ((t: number) => void)[] = [];
    const m = build(((_: unknown, f: (t: number) => void) => fns.push(f)) as never);
    expect(stats(m).smooth, name).toEqual([]);
    expect(fns.length, name).toBe(1);
    for (const t of [0, 0.3, 1.1, 2.9, 4.4]) fns[0]!(t);
    if (name === "key") expect(new THREE.Box3().setFromObject(m).min.y).toBeCloseTo(0, 1);
  }
});
