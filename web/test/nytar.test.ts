import { afterAll, expect, test } from "bun:test";
import { plotId, townMap } from "@tokenmaxxing/core/maps.ts";
import { NYTAR_CHAIR, NYTAR_CLOCK, NYTAR_TABLE } from "@tokenmaxxing/core/nytar.ts";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// Some of the 3D modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, { origin: "http://localhost" });

const { festiveNow } = await import("../src/game/festive.ts");
const { hud } = await import("../src/store.ts");
const { world } = await import("../src/game/world.ts");
const { Nytar3d, nytarNpcModel } = await import("../src/render3d/town/nytar3d.ts");
const { NYTAR_NPC } = await import("@tokenmaxxing/core/nytar.ts");
const { confetti, burstConfetti, nytarTick, nytarBlocks, nytarOn } = await import("../src/game/nytar.ts");
const { clockSprite, tableSprite, chairSprite, balloonSprite, nytarNpcSprite } = await import(
  "../src/art/nytar.ts"
);

// The theme, pinned the way the server pins it (and put back after, for the other files in this process).
hud.set({ festivePin: "nytar@12-31T21:00" });
afterAll(() => hud.set({ festivePin: null }));

const map = townMap([plotId(-2, 0), plotId(0, 2)]);
/** Tiles to the 3D town's world units, as `buildTown3d` lays them out. */
const toWorld = (tx: number, ty: number): [number, number] => [tx - map.x0 + 1.5, ty - map.y0 + 1.5];
const frame = (t: number, calm = false) =>
  ({ now: t * 1000, t, dt: 0.016, calm, density: 1, me: null, camera: null, overlay: null }) as never;

test("the theme is on by the pin, in the town, and its tiles block", () => {
  expect(festiveNow()?.id).toBe("nytar");
  Object.assign(world, { room: "town", map });
  expect(nytarOn()).toBe(true);
  expect(nytarBlocks(NYTAR_CLOCK.x, NYTAR_CLOCK.y)).toBe(true);
  expect(nytarBlocks(NYTAR_CLOCK.x, NYTAR_CLOCK.y - 1)).toBe(false);
  Object.assign(world, { room: "inn" });
  expect(nytarOn()).toBe(false);
  expect(nytarBlocks(NYTAR_CLOCK.x, NYTAR_CLOCK.y)).toBe(false);
  Object.assign(world, { room: "town" });
});

test("the 3D props stand on their tiles, in a few meshes, and go when the theme goes", () => {
  Object.assign(world, { room: "town", map });
  const town = new Nytar3d(toWorld);
  expect(town.group.visible).toBe(false);
  town.update(frame(1));
  expect(town.group.visible).toBe(true);
  town.group.updateMatrixWorld(true);
  const where = new Map<string, THREE.Box3>();
  const box = new THREE.Box3();
  let meshes = 0;
  town.group.traverse((o) => {
    const m = o as THREE.Mesh;
    // The confetti is one instanced mesh, placed instance by instance.
    if (!m.isMesh || !m.geometry || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    meshes++;
    m.geometry.computeBoundingBox();
    box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
    // Every piece is inside the town's walls: nothing baked far away from where it stands.
    expect(box.min.x).toBeGreaterThan(0);
    expect(box.max.x).toBeLessThan(map.width + 3);
    expect(box.min.z).toBeGreaterThan(0);
    expect(box.max.z).toBeLessThan(map.height + 3);
    where.set(`${meshes}`, box.clone());
  });
  const all = new THREE.Box3();
  for (const b of where.values()) all.union(b);
  // The clock is the tall one: over its tile, higher than a person.
  const [cx, cz] = toWorld(NYTAR_CLOCK.x, NYTAR_CLOCK.y);
  let tallest: THREE.Box3 | null = null;
  for (const b of where.values()) if (!tallest || b.max.y > tallest.max.y) tallest = b;
  expect(tallest!.max.y).toBeGreaterThan(3);
  expect(Math.abs((tallest!.min.x + tallest!.max.x) / 2 - cx)).toBeLessThan(1.2);
  expect(Math.abs((tallest!.min.z + tallest!.max.z) / 2 - cz)).toBeLessThan(1.2);
  // The buffet and the chair are on theirs.
  const [tx, tz] = toWorld(NYTAR_TABLE[0]!.x + 0.5, NYTAR_TABLE[0]!.y);
  const [kx, kz] = toWorld(NYTAR_CHAIR.x, NYTAR_CHAIR.y);
  const near = (x: number, z: number) =>
    [...where.values()].some(
      (b) => x >= b.min.x - 0.2 && x <= b.max.x + 0.2 && z >= b.min.z - 0.2 && z <= b.max.z + 0.2,
    );
  expect(near(tx, tz)).toBe(true);
  expect(near(kx, kz)).toBe(true);
  expect(meshes).toBeLessThan(80);
  town.dispose();
  expect(town.group.children).toHaveLength(0);
  town.update(frame(2));
  expect(town.group.visible).toBe(true);
  Object.assign(world, { room: "inn" });
  town.update(frame(3));
  expect(town.group.visible).toBe(false);
  expect(town.group.children).toHaveLength(0);
});

test("the watchman has a 3D model, standing on the floor", () => {
  const model = nytarNpcModel(NYTAR_NPC);
  const box = new THREE.Box3().setFromObject(model);
  expect(box.min.y).toBeGreaterThan(-0.2);
  expect(box.max.y).toBeGreaterThan(1.2);
  expect(box.max.y).toBeLessThan(3);
});

test("confetti is a pool: bursts add, time takes away, and reduced motion holds none", () => {
  Object.assign(world, { room: "town", map });
  confetti.n = 0;
  burstConfetti(10, 5, 60);
  expect(confetti.n).toBe(60);
  nytarTick(1000);
  nytarTick(1100);
  expect(confetti.n).toBeGreaterThan(0);
  burstConfetti(10, 5, 500);
  expect(confetti.n).toBeLessThanOrEqual(240);
  // They all come down inside their life.
  for (let t = 1200; t < 12_000; t += 100) nytarTick(t);
  expect(confetti.h.slice(0, confetti.n).every((h) => h >= 0)).toBe(true);
});

test("every 2D sprite is baked", () => {
  for (const s of [clockSprite(2027), tableSprite(), chairSprite(), balloonSprite(1)])
    expect(s.width).toBeGreaterThan(8);
  for (const facing of ["down", "up", "left", "right"] as const)
    for (const breath of [0, 1] as const) expect(nytarNpcSprite(facing, breath).height).toBe(20);
});
