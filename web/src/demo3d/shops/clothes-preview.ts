/**
 * Stand-alone preview of the Clothes shop. `?view=exterior|interior`, `&night=1`, `&px=1` (HD), `&az=<radians>`,
 * `&zoom=`, `&tx=&tz=&span=` to look somewhere. Drag to pan, wheel to zoom, Q/E to turn, N for night.
 * `window.shop` has the built interior (displays, shopkeeper, fitting) for poking at from the console.
 */
import * as THREE from "three";
import { Avatar } from "../avatar.ts";
import { ticks } from "../kit.ts";
import { Pipeline } from "../pipeline.ts";
import { setPropsNight } from "../props.ts";
import { setRoomNight } from "../room.ts";
import { SHOP_CLOTHES, tryOn } from "./clothes.ts";

const q = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const pipe = new Pipeline(canvas, { preserve: true });
pipe.pixelSize = Number(q.get("px") ?? 3);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
const ELEVATION = Math.atan(0.5);

const scene = new THREE.Scene();
const view = q.get("view") ?? "interior";
const target = new THREE.Vector3();
let span = 28;
const hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
scene.add(hemi, sun, sun.target);
let facing: ((v: THREE.Vector3) => void) | null = null;

if (view === "exterior") {
  const ext = SHOP_CLOTHES.exterior();
  scene.add(ext);
  // A pavement and a road for scale.
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.1, 9),
    new THREE.MeshToonMaterial({ color: "#cfc6b8" }),
  );
  walk.position.set(0, -0.06, -1);
  walk.receiveShadow = true;
  scene.add(walk);
  target.set(0, 1, -1);
  span = 9;
} else {
  const inside = SHOP_CLOTHES.buildInterior();
  scene.add(inside.room.group);
  facing = (v) => inside.room.facing(v);
  target.set(inside.room.W / 2, 0.6, inside.room.D / 2);
  span = 24;
  (window as unknown as Record<string, unknown>).shop = inside;
  (window as unknown as Record<string, unknown>).tryOn = tryOn;
  void Avatar;
}
if (q.get("tx")) {
  target.set(Number(q.get("tx")), Number(q.get("ty") ?? 0.6), Number(q.get("tz")));
  span = Number(q.get("span") ?? 12);
}
sun.position.set(target.x - 12, 30, target.z + 8);
sun.target.position.copy(target);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
{
  const s = sun.shadow.camera;
  s.left = s.bottom = -26;
  s.right = s.top = 26;
  s.near = 1;
  s.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
}

let night = q.get("night") === "1";
function setNight(on: boolean) {
  night = on;
  setPropsNight(on);
  setRoomNight(on);
  hemi.intensity = on ? 0.55 : 1.6;
  hemi.color.set(on ? "#8fa0ff" : "#fff4e0");
  sun.intensity = on ? 0.35 : 2.4;
  sun.color.set(on ? "#9fb0ff" : "#fff1d6");
  scene.background = new THREE.Color(on ? "#0f111a" : "#1b1f2a");
  scene.traverse((o) => {
    if (o instanceof THREE.PointLight) o.intensity = on ? (o.userData.night ?? 0) : 0;
  });
}
setNight(night);

const bar = document.querySelector("#bar")!;
for (const [label, fn] of [
  ["Exterior", () => (location.search = "?view=exterior")],
  ["Interior", () => (location.search = "?view=interior")],
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
  facing?.(camera.position.clone().sub(target).setY(0).normalize());
  const now = performance.now() / 1000;
  for (const t of [...ticks]) t(now);
  pipe.render(scene, camera, w, h);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
