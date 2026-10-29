// Browser harness: every pet of the first six species wearing each prestige rank's accessory, through the real
// 2D draw path (petFrame + drawPetCrown) and the real Pet3D. Built and shot by shots.mjs.
import * as THREE from "three";
import { PET_H, PET_W, petFrame } from "../../../web/src/art/pets.ts";
import { drawPetCrown } from "../../../web/src/game/legendary.ts";
import type { Avatar } from "../../../web/src/game/world.ts";
import { view } from "../../../web/src/render3d/perf/freeze.ts";
import { petFrom2D } from "../../../web/src/render3d/pets/pets3d.ts";

view.sees = () => true;
const SPECIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const Z = 8;
const CW = 14 * Z;
const CH = 20 * Z;

function sheet(id: string, w: number, h: number) {
  const c = document.createElement("canvas");
  c.id = `sheet-${id}`;
  c.width = w;
  c.height = h;
  document.body.append(c);
  const g = c.getContext("2d")!;
  g.fillStyle = "#3a4a3a";
  g.fillRect(0, 0, w, h);
  return g;
}

// 2D: rows are species, columns rank 0 (the crown only) to V; then the same facing left, hopping, with a hat.
for (const [name, left, hop, wear, level] of [
  ["right", false, false, 0, 50],
  ["left-hop", true, true, 0, 50],
  ["hat", false, false, 4, 50],
] as const) {
  const g = sheet(`2d-${name}`, CW * 6, CH * SPECIES.length);
  g.imageSmoothingEnabled = false;
  SPECIES.forEach((pet, row) => {
    for (let rank = 0; rank <= 5; rank++) {
      const a = {
        info: { level, look: { pet, petwear: wear }, prestige: { rank, runLevel: rank ? 30 : 0 } },
      } as unknown as Avatar;
      const ox = rank * CW + 2 * Z;
      const oy = row * CH + 9 * Z;
      const frame = petFrame(pet, left, hop, 0, null, wear);
      if (!frame) continue;
      g.save();
      g.translate(ox, oy);
      g.scale(Z, Z);
      g.drawImage(frame, 0, PET_H - frame.height);
      drawPetCrown(g, a, 0, 0, left, hop, 0);
      g.restore();
    }
  });
}

// 3D: the same grid.
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color("#3a4a3a");
scene.add(new THREE.AmbientLight("#ffffff", 1));
const sun = new THREE.DirectionalLight("#fff1d6", 2.2);
sun.position.set(2, 4, 3);
scene.add(sun);
const S = 200;
renderer.setSize(S, S, false);
for (const [name, wear] of [
  ["plain", 0],
  ["hat", 4],
] as const) {
  const g = sheet(`3d-${name}`, S * 6, S * SPECIES.length);
  SPECIES.forEach((sp, row) => {
    for (let rank = 0; rank <= 5; rank++) {
      const pet = petFrom2D(sp);
      pet.crown = true;
      pet.wear = wear;
      pet.prestigeWear = rank;
      scene.add(pet.root);
      pet.update(1, 0);
      pet.update(1.5, 0);
      const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
      cam.position.set(1.1, 0.7, 1.5);
      cam.lookAt(0, 0.28, 0);
      renderer.render(scene, cam);
      g.drawImage(renderer.domElement, rank * S, row * S, S, S);
      scene.remove(pet.root);
    }
  });
}
void PET_W;
document.title = "ready";
