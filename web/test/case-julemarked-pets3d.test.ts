import { expect, test } from "bun:test";
import { JULEMARKED_BASE, JULEMARKED_ITEMS } from "@tokenmaxxing/core/case-julemarked.ts";
import type * as THREE from "three";
import { JULEMARKED_PET_SPECIES, PET_NAME } from "../src/render3d/data/pets.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) n++;
  });
  return n;
};

test("every Julemarked aura has its 3D builder and it animates", async () => {
  const { AURA_BUILDERS } = await import("../src/render3d/people/gear3dAura.ts");
  const THREE = await import("three");
  const auras = JULEMARKED_ITEMS.filter((i) => i.slot === "aura");
  expect(auras.length).toBe(4);
  for (const item of auras) {
    const build = AURA_BUILDERS[item.name];
    expect(build, item.name).toBeTypeOf("function");
    const root = new THREE.Group();
    const ticks: ((t: number, walking: boolean) => void)[] = [];
    build!(root, (fn) => ticks.push(fn));
    expect(ticks.length, item.name).toBe(1);
    expect(meshes(root), item.name).toBeGreaterThan(5);
    expect(meshes(root), `${item.name} stays modest`).toBeLessThan(160);
    for (let t = 0; t < 3; t += 0.25) for (const walking of [false, true]) ticks[0]!(t, walking);
  }
});

test("each Julemarked pet is named, stands up, walks and sleeps", async () => {
  const { petFrom2D } = await import("../src/render3d/pets/pets3d.ts");
  const { view } = await import("../src/render3d/perf/freeze.ts");
  view.sees = () => true;
  const pets = JULEMARKED_ITEMS.filter((i) => i.slot === "pet");
  expect(pets.length).toBe(JULEMARKED_PET_SPECIES.length);
  JULEMARKED_PET_SPECIES.forEach((species, i) => {
    const pet = petFrom2D(JULEMARKED_BASE + i);
    expect(pet.species).toBe(species);
    expect(pet.label).toBe(PET_NAME[species]);
    expect(pet.label).toBe(pets[i]!.name);
    expect(meshes(pet.root)).toBeGreaterThan(3);
    pet.update(1);
    pet.moving = true;
    for (let t = 1; t < 2; t += 0.1) pet.update(t, 0.05);
    pet.moving = false;
    pet.pose = "sleep";
    for (let t = 2; t < 3; t += 0.1) pet.update(t);
    pet.dispose();
  });
});
