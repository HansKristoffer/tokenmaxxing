/**
 * A stand-alone look at the pet store. `?view=inside|outside`, `&night=1`, `&px=1` (HD), `&az=`, `&zoom=`,
 * `&tx=&tz=&span=` to aim. Drag to pan, wheel to zoom, Q/E to turn, N for night.
 */
import * as THREE from "three";
import { ticks } from "../kit.ts";
import { Pipeline } from "../pipeline.ts";
import { setPropsNight } from "../props.ts";
import { setRoomNight } from "../room.ts";
import { SHOP_PETS } from "./pets.ts";

const q = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const pipe = new Pipeline(canvas, { preserve: true });
pipe.pixelSize = Number(q.get("px") ?? 3);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
const ELEVATION = Math.atan(0.5);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b1f2a");
const target = new THREE.Vector3();
let span = 20;
const view = q.get("view") ?? "inside";
const win = window as unknown as Record<string, unknown>;
let onFrame: (() => void) | null = null;

if (view === "outside") {
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.2, 12),
    new THREE.MeshToonMaterial({ color: "#86c35e" }),
  );
  ground.position.set(0, -0.1, -1);
  ground.receiveShadow = true;
  scene.add(ground);
  const path = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.21, 4),
    new THREE.MeshToonMaterial({ color: "#e6cc98" }),
  );
  path.position.set(0, -0.1, 2.5);
  scene.add(path);
  const ext = SHOP_PETS.exterior();
  scene.add(ext);
  target.set(0, 0.8, -1);
  span = 11;
} else {
  const inside = SHOP_PETS.buildInterior();
  scene.add(inside.room.group);
  target.set(inside.room.W / 2, 0.6, inside.room.D / 2 + 0.5);
  span = 24;
  win.inside = inside;
  onFrame = () => inside.room.facing(camera.position.clone().sub(target).setY(0).normalize());
}
win.shop = SHOP_PETS;
if (q.get("tx")) {
  target.set(Number(q.get("tx")), Number(q.get("ty") ?? 0.5), Number(q.get("tz")));
  span = Number(q.get("span") ?? 8);
}

const hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
sun.position.set(target.x - 14, 30, target.z + 10);
sun.target.position.copy(target);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const s = sun.shadow.camera;
s.left = s.bottom = -26;
s.right = s.top = 26;
s.near = 1;
s.far = 120;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

let night = q.get("night") === "1";
function setNight(on: boolean) {
  night = on;
  setPropsNight(on);
  setRoomNight(on);
  hemi.intensity = on ? 0.55 : 1.6;
  hemi.color.set(on ? "#8fa0ff" : "#fff4e0");
  sun.intensity = on ? 0.35 : 2.4;
  sun.color.set(on ? "#9fb0ff" : "#fff1d6");
  (scene.background as THREE.Color).set(on ? "#0f111a" : "#1b1f2a");
  scene.traverse((o) => {
    if (o instanceof THREE.PointLight) o.intensity = on ? (o.userData.night ?? 0) : 0;
  });
}
setNight(night);

const bar = document.querySelector("#bar")!;
for (const [label, fn] of [
  ["Inside", () => (location.search = "?view=inside")],
  ["Outside", () => (location.search = "?view=outside")],
  ["Day/Night", () => setNight(!night)],
  ["HD", () => (pipe.pixelSize = pipe.pixelSize === 1 ? 3 : 1)],
] as const) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = fn;
  bar.append(b);
}

let azimuth = Number(q.get("az") ?? Math.PI / 4);
let zoom = Number(q.get("zoom") ?? 1);
let drag: { x: number; y: number } | null = null;
canvas.addEventListener("pointerdown", (e) => (drag = { x: e.clientX, y: e.clientY }));
window.addEventListener("pointerup", () => (drag = null));
window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const k = (span * zoom) / canvas.clientHeight;
  const dx = (e.clientX - drag.x) * k;
  const dy = (e.clientY - drag.y) * k * 2;
  drag = { x: e.clientX, y: e.clientY };
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const fwd = new THREE.Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth));
  target.addScaledVector(right, -dx).addScaledVector(fwd, dy);
});
window.addEventListener(
  "wheel",
  (e) => (zoom = Math.max(0.1, Math.min(2.5, zoom * (e.deltaY > 0 ? 1.1 : 0.9)))),
);
window.addEventListener("keydown", (e) => {
  if (e.key === "q") azimuth -= Math.PI / 2;
  if (e.key === "e") azimuth += Math.PI / 2;
  if (e.key === "n") setNight(!night);
});

let lastNow = 0;
function frame() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const dist = 90;
  camera.position.set(
    target.x + dist * Math.cos(ELEVATION) * Math.sin(azimuth),
    target.y + dist * Math.sin(ELEVATION),
    target.z + dist * Math.cos(ELEVATION) * Math.cos(azimuth),
  );
  camera.lookAt(target);
  const half = (span * zoom) / 2;
  camera.left = (-half * w) / h;
  camera.right = (half * w) / h;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  const now = Number(q.get("t")) || performance.now() / 1000;
  onFrame?.();
  if (now !== lastNow) for (const t of ticks) t(now);
  lastNow = now;
  pipe.render(scene, camera, w, h);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
