/**
 * A stand-alone preview of the town slice: the data-driven town, a company building, and a catalogue of
 * everything the slice adds. `?view=town|hq|catalog`, `&night=1`, `&px=1` (HD) `&clock=12:30`, `&fleet=0..4`.
 * Drag to pan, wheel to zoom, Q/E to turn.
 */
import * as THREE from "three";
import { POSTERS } from "./data/town.ts";
import { ASSETS } from "./furniture.ts";
import { buildHq, HQ_ASSETS } from "./hq3d.ts";
import { ticks } from "./kit.ts";
import { Pipeline } from "./pipeline.ts";
import { setPropsNight } from "./props.ts";
import { setRoomNight } from "./room.ts";
import { buildTown3d, TOWN3D_ASSETS } from "./town3d.ts";

const q = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const pipe = new Pipeline(canvas, { preserve: true });
pipe.pixelSize = Number(q.get("px") ?? 3);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
const ELEVATION = Math.atan(0.5);

function lights(scene: THREE.Scene, centre: THREE.Vector3, reach: number) {
  const hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
  sun.position.set(centre.x - reach * 0.55, 30, centre.z + reach * 0.35);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = sun.shadow.camera;
  s.left = s.bottom = -reach;
  s.right = s.top = reach;
  s.near = 1;
  s.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { sun, hemi };
}

const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b1f2a");
const view = q.get("view") ?? "town";
const target = new THREE.Vector3();
let span = 28;
let reach = 40;

if (view === "town") {
  const town = buildTown3d();
  scene.add(town.group);
  target.set(town.size[0] / 2 - 4, 0, town.size[1] / 2 - 2);
  span = 36;
  reach = 45;
  (window as unknown as Record<string, unknown>).town = town;
  if (q.get("tx")) {
    target.set(Number(q.get("tx")), 0, Number(q.get("tz")));
    span = Number(q.get("span") ?? 14);
  }
  const focus = q.get("focus");
  if (focus) {
    const d = town.doors.find((x) => x.id === focus);
    if (d) {
      target.set(d.at[0], 0, d.at[1] - 2);
      span = Number(q.get("span") ?? 12);
    }
  }
} else if (view === "hq") {
  const fleet = Number(q.get("fleet") ?? 2);
    const placed = [
    { ch: "κ", x: 13, y: 2 },
    { ch: "ξ", x: 15, y: 4 },
    { ch: "Ξ", x: 20, y: 1 },
    ...POSTERS.map((p, i) => ({
      ch: p.ch,
      x: 2 + POSTERS.slice(0, i).reduce((n, q) => n + q.w, 0),
      y: 1,
    })),
    { ch: "φ", x: 12, y: 7 },
    { ch: "θ", x: 3, y: 4 },
    { ch: "α", x: 14, y: 8 },
    { ch: "Φ", x: 16, y: 10 },
    { ch: "ε", x: 13, y: 11 },
    { ch: "χ", x: 19, y: 12 },
    { ch: "τ", x: 5, y: 12 },
    { ch: "λ", x: 10, y: 6 },
    { ch: "Δ", x: 12, y: 4 },
  ];
  const hq = buildHq({ fleet, placed });
  scene.add(hq.room.group);
  target.set(hq.room.W / 2, 0.6, hq.room.D / 2);
  span = 17;
  reach = 20;
  (window as unknown as Record<string, unknown>).hq = hq;
  const camDir = new THREE.Vector3();
  ticks.push(() => {
    camera.getWorldDirection(camDir);
    hq.room.facing(camera.position.clone().sub(target).setY(0).normalize());
  });
} else {
  const items = [...TOWN3D_ASSETS, ...HQ_ASSETS, ...ASSETS.filter((a) => /trophy|desk/.test(a.id))];
  const cols = 6;
  const gap = 11;
  items.forEach((a, i) => {
    const m = a.build();
    const holder = new THREE.Group();
    holder.add(m);
    holder.position.set((i % cols) * gap, 0, Math.floor(i / cols) * gap);
    holder.rotation.y = Math.PI / 5;
    scene.add(holder);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(gap - 1, 0.1, gap - 1), new THREE.MeshToonMaterial({ color: "#2a2f3e" }));
    plate.position.set(holder.position.x, -0.06, holder.position.z);
    scene.add(plate);
  });
  target.set(((cols - 1) * gap) / 2, 0, (Math.ceil(items.length / cols) * gap) / 2 - gap / 2);
  span = 85;
  reach = 80;
  (window as unknown as Record<string, unknown>).items = items.map((a) => a.id);
}

const { sun, hemi } = lights(scene, target, reach);
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
  ["Town", () => (location.search = "?view=town")],
  ["HQ", () => (location.search = "?view=hq")],
  ["Catalog", () => (location.search = "?view=catalog")],
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
window.addEventListener("wheel", (e) => (zoom = Math.max(0.15, Math.min(2.5, zoom * (e.deltaY > 0 ? 1.1 : 0.9)))));
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
  const now = performance.now() / 1000;
  for (const t of ticks) t(now);
  pipe.render(scene, camera, w, h);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
