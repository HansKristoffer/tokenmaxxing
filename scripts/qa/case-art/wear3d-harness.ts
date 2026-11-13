// Browser harness for the Julemarked 3D wearables sheet (see wear3d.mjs): real avatars wearing each item, WebGL.
import * as THREE from "three";
import { blockify } from "../../../web/src/render3d/kit/blocky.ts";

const VOXEL = location.hash.includes("voxel");
const STALL = location.hash.includes("stall");

import { JULEMARKED_ITEMS } from "../../../core/src/case-julemarked.ts";
import { STALL_WEARABLES } from "../../../core/src/julemarked-shop.ts";
import { setSmoothBands } from "../../../web/src/render3d/kit/kit.ts";
import { avatarFor } from "../../../web/src/render3d/people/gear3d.ts";
import { view } from "../../../web/src/render3d/perf/freeze.ts";

view.sees = () => true;
const CW = 260;
const CH = 340;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setScissorTest(true);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#2a2733");
scene.add(new THREE.AmbientLight("#ffffff", 0.9));
const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
sun.position.set(2, 4, 3);
scene.add(sun);

function sheet(id: string, cols: number, rows: number) {
  const c = document.createElement("canvas");
  c.id = `sheet-${id}`;
  c.width = cols * CW;
  c.height = rows * CH;
  document.body.append(c);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a2733";
  ctx.fillRect(0, 0, c.width, c.height);
  return {
    draw(col: number, row: number, label: string, cam: THREE.PerspectiveCamera) {
      renderer.setSize(CW, CH, false);
      renderer.setViewport(0, 0, CW, CH);
      renderer.setScissor(0, 0, CW, CH);
      if (VOXEL) blockify(scene);
      renderer.render(scene, cam);
      ctx.drawImage(renderer.domElement, col * CW, row * CH, CW, CH);
      ctx.fillStyle = "#fff";
      ctx.font = "13px monospace";
      ctx.fillText(label, col * CW + 6, row * CH + 16);
    },
  };
}

const full = (h: number) => {
  const cam = new THREE.PerspectiveCamera(30, CW / CH, 0.05, 50);
  cam.position.set(0, h * 0.55, h * 2.9);
  cam.lookAt(0, h * 0.5, 0);
  return cam;
};

for (const slot of ["hat", "glasses", "outfit", "held", "back"] as const) {
  const items = (STALL ? STALL_WEARABLES : JULEMARKED_ITEMS).filter((i) => i.slot === slot);
  if (!items.length) continue;
  const s = sheet(slot, 6, items.length);
  items.forEach((it, row) => {
    const look = { style: 0, skin: 1, hair: 2, outfit: slot === "outfit" ? it.index : 1, [slot]: it.index };
    // columns: grown front, 3/4, back; voxel front, back; head/part close-up (grown)
    const spec: [string, number, number][] = [
      [VOXEL ? "voxel" : "grown", 0, 0],
      [VOXEL ? "voxel" : "grown", 0.8, 0],
      ["voxel", Math.PI, 0],
      ["voxel", 0, 0],
      ["voxel", 0.8, 0],
      [VOXEL ? "voxel" : "grown", 0.5, 1],
    ];
    spec.forEach(([style, turn, close], col) => {
      try {
        setSmoothBands(style === "voxel" || VOXEL);
        const av = avatarFor(look, undefined, style as "grown" | "voxel");
        scene.add(av.root);
        if (slot === "held") av.pose = "idle";
        for (let t = 0; t < 1.2; t += 1 / 30) av.update(1 / 30, t);
        av.root.rotation.y = turn;
        let cam = full(av.height + 0.2);
        if (close) {
          const p = new THREE.Vector3();
          const c2 = new THREE.PerspectiveCamera(30, CW / CH, 0.05, 50);
          if (slot === "hat" || slot === "glasses") {
            av.head.getWorldPosition(p);
            c2.position.set(Math.sin(turn) * 1.5, p.y + 0.5, Math.cos(turn) * 1.5);
            c2.lookAt(0, p.y + 0.32, 0);
          } else {
            c2.position.set(Math.sin(turn + 0.3) * 1.2, av.height * 0.5, Math.cos(turn + 0.3) * 1.2);
            c2.lookAt(0, av.height * 0.55, 0);
          }
          cam = c2;
        }
        s.draw(col, row, `${it.name} ${style}${close ? " close" : ""}`, cam);
        scene.remove(av.root);
        av.dispose();
      } catch (e) {
        console.error(it.name, String((e as Error).stack ?? e));
      }
    });
  });
}
document.title = "ready";
