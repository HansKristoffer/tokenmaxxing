/** The gear gallery page: `gear3d.html`. Every cosmetic on a stand-in character, through the demo's pipeline. */
import * as THREE from "three";
import { buildGearGallery, type Gallery, GEAR_CATEGORIES, type GearCategory } from "./gear3dGallery.ts";
import { ticks } from "./kit.ts";
import { Pipeline } from "./pipeline.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const labelLayer = document.querySelector<HTMLDivElement>("#labels")!;
const pipe = new Pipeline(canvas, { preserve: true });
const ELEVATION = Math.atan(0.5);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 160);
const params = new URLSearchParams(location.search);
if (params.get("clean")) for (const p of document.querySelectorAll<HTMLElement>(".panel")) p.hidden = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b1f2a");
const hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
sun.position.set(-8, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -14;
sc.right = sc.top = 14;
sc.near = 1;
sc.far = 40;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(hemi, sun, sun.target);

let gallery: Gallery;
let labels: { el: HTMLElement; at: THREE.Vector3; below?: boolean }[] = [];
let category: GearCategory = "Hats";
let zoom = Number(params.get("zoom") ?? 1);
let azimuth = Math.PI / 4;
let azimuthGoal = azimuth + (Number(params.get("az") ?? 0) * Math.PI) / 180;
azimuth = azimuthGoal;
const pan = new THREE.Vector3();
let spin = false;
let walk = false;

function show(cat: GearCategory): void {
  if (gallery) scene.remove(gallery.group);
  for (const l of labels) l.el.remove();
  category = cat;
  gallery = buildGearGallery(cat);
  scene.add(gallery.group);
  labels = gallery.labels.map((l) => {
    const el = typeof l.content === "string" ? document.createElement("div") : l.content;
    if (typeof l.content === "string") {
      el.className = `label ${l.cls ?? "tag item"}`;
      el.textContent = l.content;
    }
    labelLayer.append(el);
    return { el, below: l.below, at: l.at.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4) };
  });
  const at = params.get("at");
  pan.set(0, 0, 0);
  if (at !== null && gallery.cells[Number(at)]) pan.copy(gallery.cells[Number(at)]!);
  const row = params.get("row");
  if (row !== null) {
    const cells = gallery.cells.slice(Number(row) * gallery.cols, (Number(row) + 1) * gallery.cols);
    for (const c of cells) pan.add(c.clone().divideScalar(cells.length));
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("#cats button")) b.classList.toggle("on", b.dataset.value === cat);
  setWalk(walk);
}

const cats = document.querySelector("#cats")!;
for (const c of GEAR_CATEGORIES) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.value = c;
  b.textContent = c;
  b.onclick = () => {
    params.delete("at");
    show(c);
  };
  cats.append(b);
}

function setWalk(on: boolean): void {
  walk = on;
  for (const a of gallery.avatars) a.pose = on ? "walk" : "stand";
}

function setStyle(px: number): void {
  pipe.pixelSize = px;
  canvas.classList.toggle("smooth", px === 1);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-group=style]"))
    b.classList.toggle("on", (px === 1) === (b.dataset.value === "smooth"));
}
document.querySelector<HTMLElement>("[data-value=pixel]")!.onclick = () => setStyle(3);
document.querySelector<HTMLElement>("[data-value=smooth]")!.onclick = () => setStyle(1);
document.querySelector<HTMLElement>("#rot-l")!.onclick = () => (azimuthGoal -= Math.PI / 2);
document.querySelector<HTMLElement>("#rot-r")!.onclick = () => (azimuthGoal += Math.PI / 2);
document.querySelector<HTMLElement>("#spin")!.onclick = () => (spin = !spin);
document.querySelector<HTMLElement>("#walk")!.onclick = () => setWalk(!walk);
let night = false;
document.querySelector<HTMLElement>("#night")!.onclick = () => {
  night = !night;
  scene.background = new THREE.Color(night ? "#0d1020" : "#1b1f2a");
  hemi.intensity = night ? 0.5 : 1.6;
  sun.intensity = night ? 0.5 : 2.4;
};
window.addEventListener("keydown", (e) => {
  if (e.key === "q" || e.key === "Q") azimuthGoal -= Math.PI / 2;
  if (e.key === "e" || e.key === "E") azimuthGoal += Math.PI / 2;
});
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoom = Math.min(2.2, Math.max(0.12, zoom * Math.exp(e.deltaY * 0.0012)));
}, { passive: false });
let drag: { x: number; y: number } | null = null;
canvas.addEventListener("pointerdown", (e) => (drag = { x: e.clientX, y: e.clientY }));
window.addEventListener("pointerup", () => (drag = null));
window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const k = (gallery.view * zoom) / canvas.clientHeight;
  const dx = (e.clientX - drag.x) * k;
  const dy = (e.clientY - drag.y) * k;
  drag = { x: e.clientX, y: e.clientY };
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const fwd = new THREE.Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth));
  pan.addScaledVector(right, -dx).addScaledVector(fwd, dy / Math.sin(ELEVATION));
});

const v = new THREE.Vector3();
let last = performance.now() / 1000;
function frame(): void {
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - last);
  last = now;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  azimuth += (azimuthGoal - azimuth) * 0.15;
  const target = gallery.target.clone().add(pan);
  camera.position.set(
    target.x + 60 * Math.cos(ELEVATION) * Math.sin(azimuth),
    target.y + 60 * Math.sin(ELEVATION),
    target.z + 60 * Math.cos(ELEVATION) * Math.cos(azimuth),
  );
  camera.lookAt(target);
  const half = (gallery.view * zoom) / 2;
  camera.left = (-half * w) / h;
  camera.right = (half * w) / h;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  for (const tick of ticks) tick(now);
  gallery.update(dt, now);
  if (spin) for (const a of gallery.avatars) a.root.rotation.y += dt * 1.2;
  pipe.render(scene, camera, w, h);
  for (const l of labels) {
    v.copy(l.at).project(camera);
    l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, ${l.below ? "0" : "-100%"})`;
  }
  requestAnimationFrame(frame);
}

setStyle(Number(params.get("px") ?? 1));
if (params.get("walk")) walk = true;
if (params.get("spin")) spin = true;
show((params.get("cat") as GearCategory) ?? "Hats");
requestAnimationFrame(frame);
void category;
