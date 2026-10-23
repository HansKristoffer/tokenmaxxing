import * as THREE from "three";
import { Avatar, randomLook } from "../avatar.ts";
import { petFrom2D } from "../pets3d.ts";
import { arcadeBuilding, car, grandFountain, hotDogCart, lanternTable, loungeSofa, parkBench, picnic, streetLamp } from "../props.ts";
import { companyHouse, tavernBuilding } from "../town3d-houses.ts";

export function logDims(): void {
  const out: string[] = [];
  const bb = (n: string, o: THREE.Object3D) => {
    const b = new THREE.Box3().setFromObject(o);
    out.push(`${n}: x ${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)} y ${b.min.y.toFixed(2)}..${b.max.y.toFixed(2)} z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)}`);
  };
  for (let t = 0; t <= 5; t++) bb(`house${t}`, companyHouse(t, "Acme", null));
  bb("tavern", tavernBuilding());
  bb("fountain", grandFountain());
  bb("cart", hotDogCart());
  bb("sofa", loungeSofa(2));
  bb("bench", parkBench());
  bb("lamp", streetLamp());
  bb("car", car("#f00"));
  bb("picnic", picnic());
  bb("ltable", lanternTable());
  bb("arcade", arcadeBuilding());
  const a = new Avatar(randomLook(), "voxel");
  a.update(0.1, 1);
  bb("avatar", a.root);
  for (const p of [1, 2, 3, 4, 5]) bb(`pet${p}`, petFrom2D(p).root);
  console.log(out.join("\n"));
}
