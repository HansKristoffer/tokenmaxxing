/**
 * A stand-alone preview of the barber: `?view=exterior|interior`, `&night=1`, `&px=1` (HD), `&az=<radians>`,
 * `&zoom=`, `&tx=&tz=` (look-at tile). Drag to pan, wheel to zoom, Q/E to turn, N for night.
 */
import * as THREE from "three";
import { ticks } from "../kit.ts";
import { Pipeline } from "../pipeline.ts";
import { setPropsNight } from "../props.ts";
import { setRoomNight } from "../room.ts";
import { restyle, SHOP_BARBER } from "./barber.ts";

(window as unknown as Record<string, unknown>).barber = { SHOP_BARBER, restyle };
const q = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const pipe = new Pipeline(canvas, { preserve: true });
pipe.pixelSize = Number(q.get("px") ?? 3);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
const ELEVATION = Math.atan(0.5);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b1f2a");
const target = new THREE.Vector3();
let span = 12;
let reach = 20;
const view = q.get("view") ?? "interior";
let facing: ((v: THREE.Vector3) => void) | null = null;

if (view === "exterior") {
  const m = SHOP_BARBER.exterior();
  m.position.set(0, 0, 2);
  scene.add(m);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.2, 10),
    new THREE.MeshToonMaterial({ color: "#86c35e" }),
  );
  ground.position.set(0, -0.1, -1);
  ground.receiveShadow = true;
  scene.add(ground);
  const path = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.02, 2),
    new THREE.MeshToonMaterial({ color: "#e6cc98" }),
  );
  path.position.set(0, 0.01, 3.4);
  scene.add(path);
  target.set(0, 0.8, 0);
  span = 8;
  reach = 12;
} else {
  const inside = SHOP_BARBER.buildInterior();
  scene.add(inside.room.group);
  target.set(inside.room.W / 2, 0.8, inside.room.D / 2);
  span = 24;
  reach = 24;
  facing = (v) => inside.room.facing(v);
  (window as unknown as Record<string, unknown>).inside = inside;
}
if (q.get("tx")) {
  target.set(Number(q.get("tx")), 0.8, Number(q.get("tz")));
  span = Number(q.get("span") ?? 8);
}

const hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
sun.position.set(target.x - reach * 0.55, 30, target.z + reach * 0.35);
sun.target.position.copy(target);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -reach;
sc.right = sc.top = reach;
sc.near = 1;
sc.far = 120;
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
  (e) => (zoom = Math.max(0.15, Math.min(2.5, zoom * (e.deltaY > 0 ? 1.1 : 0.9)))),
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
  for (const t of ticks) t(now);
  pipe.render(scene, camera, w, h);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
