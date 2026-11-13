// Browser harness for the Julemarked 3D pets and auras: the real Pet3D and avatars on a WebGL canvas.
import * as THREE from "three";
import { blockify } from "../../../web/src/render3d/kit/blocky.ts";

const VOXEL = location.hash === "#voxel";

import { avatarFor } from "../../../web/src/render3d/people/gear3d.ts";
import { view } from "../../../web/src/render3d/perf/freeze.ts";
import { petFrom2D } from "../../../web/src/render3d/pets/pets3d.ts";

view.sees = () => true;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color("#2a2733");
scene.add(new THREE.AmbientLight("#ffffff", 0.9));
const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
sun.position.set(2, 4, 3);
scene.add(sun);

function sheet(id: string, w: number, h: number) {
  const c = document.createElement("canvas");
  c.id = `sheet-${id}`;
  c.width = w;
  c.height = h;
  document.body.append(c);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a2733";
  ctx.fillRect(0, 0, w, h);
  return ctx;
}
const shoot = (
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  x: number,
  y: number,
  cam: THREE.Camera,
  label: string,
) => {
  renderer.setSize(cw, ch, false);
  if (VOXEL) blockify(scene);
  renderer.render(scene, cam);
  ctx.drawImage(renderer.domElement, x, y, cw, ch);
  ctx.fillStyle = "#fff";
  ctx.font = "13px monospace";
  ctx.fillText(label, x + 6, y + 16);
};

// Pets: rows are species, columns are a three-quarter, the side, the back, and mid-walk.
{
  const S = 260;
  const ctx = sheet("pets", S * 4, S * 6);
  [800, 801, 802, 803, 804, 805].forEach((sp, row) => {
    [0, 1, 2, 3].forEach((col) => {
      const pet = petFrom2D(sp);
      scene.add(pet.root);
      pet.root.rotation.y = [0.6, Math.PI / 2, Math.PI + 0.5, 0.6][col]!;
      if (col === 3) pet.moving = true;
      for (let i = 0; i < 40; i++) pet.update(1 / 30, 1 + i / 30);
      const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
      cam.position.set(0, 0.35, 1.5);
      cam.lookAt(0, 0.17, 0);
      shoot(ctx, S, S, col * S, row * S, cam, `pet ${sp} ${["34", "side", "back", "walk"][col]}`);
      scene.remove(pet.root);
    });
  });
}

// Close-ups: each pet alone, big, three-quarter and from the side (for judging the detail of the case pets).
{
  const S = 520;
  const ctx = sheet("close", S * 4, S * 3);
  [800, 801, 802, 803, 804, 805].forEach((sp, i) => {
    [0.6, Math.PI / 2 + 0.3].forEach((rot, col) => {
      const pet = petFrom2D(sp);
      scene.add(pet.root);
      pet.root.rotation.y = rot;
      for (let k = 0; k < 40; k++) pet.update(1 / 30, 1 + k / 30);
      const big = sp === 804;
      const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
      cam.position.set(0, big ? 0.5 : 0.3, big ? 2.2 : 1.05);
      cam.lookAt(0, big ? 0.3 : 0.15, 0);
      shoot(ctx, S, S, ((i % 2) * 2 + col) * S, Math.floor(i / 2) * S, cam, `close ${sp}`);
      scene.remove(pet.root);
    });
  });
}

// Stall pets (900 to 904): same columns, plus a sleeping column.
{
  const S = 260;
  const ctx = sheet("stall-pets", S * 5, S * 5);
  [900, 901, 902, 903, 904].forEach((sp, row) => {
    [0, 1, 2, 3, 4].forEach((col) => {
      const pet = petFrom2D(sp);
      scene.add(pet.root);
      pet.root.rotation.y = [0.6, Math.PI / 2, Math.PI + 0.5, 0.6, 0.6][col]!;
      if (col === 3) pet.moving = true;
      if (col === 4) pet.pose = "sleep";
      for (let i = 0; i < 60; i++) pet.update(1 / 30, 1 + i / 30);
      const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
      cam.position.set(0, 0.35, 1.5);
      cam.lookAt(0, 0.17, 0);
      shoot(ctx, S, S, col * S, row * S, cam, `pet ${sp} ${["34", "side", "back", "walk", "sleep"][col]}`);
      scene.remove(pet.root);
    });
  });
}

// Auras: rows are the four auras, columns front / back at three moments.
{
  const CW = 300;
  const CH = 400;
  const ctx = sheet("auras", CW * 6, CH * 4);
  [800, 801, 802, 803].forEach((idx, row) => {
    const av = avatarFor(
      { style: 0, skin: 1, hair: 2, aura: idx } as never,
      undefined,
      VOXEL ? "voxel" : "grown",
    );
    scene.add(av.root);
    const h = av.height + 0.2;
    const cam = new THREE.PerspectiveCamera(30, CW / CH, 0.05, 50);
    cam.position.set(0, h * 0.55, h * 2.9);
    cam.lookAt(0, h * 0.5, 0);
    let now = 0;
    [0.5, 1.4, 2.6].forEach((time, k) => {
      for (; now < time; now += 1 / 30) av.update(1 / 30, now);
      [0, Math.PI].forEach((turn, a) => {
        av.root.rotation.y = turn;
        shoot(ctx, CW, CH, (k * 2 + a) * CW, row * CH, cam, `aura ${idx} ${a ? "back" : "front"} t=${time}`);
      });
    });
    scene.remove(av.root);
    av.dispose();
  });
}
document.title = "ready";
