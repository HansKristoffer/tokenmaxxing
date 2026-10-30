import { afterEach, expect, setSystemTime, test } from "bun:test";
import { plotId, townMap } from "@tokenmaxxing/core/maps.ts";
import { EXTRA_STONES, GERDA, HAUNTS } from "@tokenmaxxing/core/spooky.ts";
import type * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
Object.assign(globalThis.location, { origin: "http://localhost" });

const { HalloweenTown3d } = await import("../src/render3d/town/halloween3d.ts");
const { gerdaModel } = await import("../src/render3d/town/halloween3d-models.ts");
const { NPC_MODELS } = await import("../src/render3d/town/festive-npc3d.ts");
const { HAT_BUILDERS } = await import("../src/render3d/people/gear3dHead.ts");
const { graphics } = await import("../src/settings/graphics.ts");

const NIGHT = new Date("2026-10-31T20:00:00Z");
const JUNE = new Date("2027-06-10T12:00:00Z");
const map = townMap([plotId(-2, 0), plotId(0, 2)]);
const toWorld = (tx: number, ty: number): [number, number] => [tx + 0.5, ty + 0.5];

afterEach(() => setSystemTime());
graphics.override("seasonal", undefined);

const count = (root: THREE.Object3D) => {
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) n++;
  });
  return n;
};

test("the 3D spooky night is built only while the theme is on, and taken down after", () => {
  const town = new HalloweenTown3d(map, toWorld);
  setSystemTime(JUNE);
  town.update(0, null);
  expect(town.group.visible).toBe(false);
  expect(town.group.children).toHaveLength(0);
  expect(town.signs()).toEqual([]);

  setSystemTime(NIGHT);
  town.update(0, null);
  expect(town.group.visible).toBe(true);
  expect(town.group.children).toHaveLength(1);
  expect(count(town.group)).toBeGreaterThan(30);
  expect(town.signs().map((s) => s.text)).toEqual([GERDA.name]);

  setSystemTime(JUNE);
  town.update(1, null);
  expect(town.group.visible).toBe(false);
  expect(town.group.children).toHaveLength(0);
  town.dispose();
});

test("bats flap and fly, ghosts drift and shy from you", () => {
  setSystemTime(NIGHT);
  const town = new HalloweenTown3d(map, toWorld);
  town.update(0, null);
  const root = town.group.children[0]!;
  const moving = (t: number) => {
    town.update(t, null);
    return root.children.map((c) => [c.position.x, c.position.y, c.position.z].join());
  };
  const a = moving(1);
  const b = moving(4);
  expect(a.filter((p, i) => p !== b[i]).length).toBeGreaterThanOrEqual(8);
  // Stand on a ghost: it vanishes.
  town.update(2, null);
  const ghost = root.children.find(
    (c) => c.userData.live && c.children.length > 8 && c.scale.x < 1.01 && c.visible,
  )!;
  expect(ghost).toBeDefined();
  town.update(2, [ghost.position.x, ghost.position.z]);
  expect(ghost.visible).toBe(false);
  expect(HAUNTS.length).toBeGreaterThan(2);
  town.dispose();
});

test("Gerda has a model that stands on the ground, ticks, and is the Halloween NPC's", () => {
  expect(NPC_MODELS.halloween).toBe(gerdaModel);
  const m = gerdaModel(GERDA);
  expect(count(m)).toBeGreaterThan(5);
  expect(typeof m.userData.tick).toBe("function");
  (m.userData.tick as (t: number) => void)(1);
});

test("the three hats have builders, and the lawn has stones for each kind", () => {
  for (const name of ["Witch hat", "Ghost sheet", "Bat ears"]) expect(HAT_BUILDERS[name], name).toBeDefined();
  expect(new Set(EXTRA_STONES.map((s) => s.kind))).toEqual(new Set(["round", "cross", "slab"]));
});
