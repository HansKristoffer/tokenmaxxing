import { expect, test } from "bun:test";
import { STALL_BASE } from "@tokenmaxxing/core/julemarked-shop.ts";
import type * as THREE from "three";
import { JULEMARKED_STALL_PET_SPECIES, PET_NAME, speciesAt } from "../src/render3d/data/pets.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) n++;
  });
  return n;
};

test("the stall pets resolve at 900 and stand, walk and sleep", async () => {
  const { petFrom2D } = await import("../src/render3d/pets/pets3d.ts");
  const { view } = await import("../src/render3d/perf/freeze.ts");
  view.sees = () => true;
  expect(JULEMARKED_STALL_PET_SPECIES).toEqual(["graaspurv", "snehare", "pindsvin", "egern", "saelunge"]);
  JULEMARKED_STALL_PET_SPECIES.forEach((species, i) => {
    expect(speciesAt(STALL_BASE + i)).toBe(species);
    const pet = petFrom2D(STALL_BASE + i);
    expect(pet.species).toBe(species);
    expect(pet.label).toBe(PET_NAME[species]);
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
