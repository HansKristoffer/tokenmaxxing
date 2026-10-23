import * as THREE from "three";
import type { Company } from "../demo3d/data/town.ts";
import { Pipeline } from "../demo3d/pipeline.ts";
import { buildTown3d, type Town3d } from "../demo3d/town3d.ts";
import type { Renderer, Tile } from "../game/renderer.ts";
import { world } from "../game/world.ts";
import type { GraphicsSettings } from "../settings/graphics.ts";

/**
 * The 3D renderer's entry, loaded on demand (`loadRenderer`) so Three.js is never downloaded on the Low
 * tier. Return a `Renderer` (see `game/renderer.ts`), or null when 3D isn't available: the game then runs
 * on 2D. Throwing (a shader error, a lost context) also falls back, with a toast.
 */
export function create3D(): Renderer | null {
  return new Renderer3D();
}

const ELEVATION = Math.atan(0.5); // 2:1 pixel lines, like the demo.

/**
 * Smoke-level 3D: the town drawn from the real companies' plots (so its tile map is the 2D game's) through
 * the demo's `Pipeline`, with a static camera. No avatars, no other rooms, no input yet.
 */
class Renderer3D implements Renderer {
  readonly kind = "3d";
  private readonly canvas = document.createElement("canvas");
  private readonly pipe: Pipeline;
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 160);
  private scene = new THREE.Scene();
  private town: Town3d | null = null;
  private plots = "";
  private w = 1;
  private h = 1;
  private fail?: (reason: string) => void;
  private readonly ray = new THREE.Raycaster();

  constructor() {
    this.canvas.id = "world";
    this.pipe = new Pipeline(this.canvas);
    this.pipe.autoQuality = false;
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.fail?.("the graphics context was lost");
    });
  }

  mount(host: HTMLElement): void {
    host.append(this.canvas);
  }

  onFail(cb: (reason: string) => void): void {
    this.fail = cb;
  }

  /** (Re)builds the town when the companies' plots change. */
  private sync(): void {
    const list = [...world.companies.values()];
    const key = list
      .map((c) => c.plot)
      .sort((a, b) => a - b)
      .join();
    if (this.town && key === this.plots) return;
    this.plots = key;
    const next = new THREE.Scene();
    next.background = new THREE.Color("#9fd3ee");
    const hemi = new THREE.HemisphereLight("#fff4e0", "#7a6a8a", 1.6);
    const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
    this.town = buildTown3d(list as unknown as Company[]);
    const [W, D] = this.town.size;
    const reach = Math.max(W, D) * 0.75;
    sun.position.set(W / 2 - reach * 0.55, 14, D / 2 + reach * 0.35);
    sun.target.position.set(W / 2, 0, D / 2);
    sun.castShadow = this.pipe.renderer.shadowMap.enabled;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = s.bottom = -reach;
    s.right = s.top = reach;
    s.near = 1;
    s.far = 40;
    next.add(hemi, sun, sun.target, this.town.group);
    this.scene = next;
  }

  private aim(): void {
    const [W, D] = this.town!.size;
    const t = new THREE.Vector3(W / 2, 0.5, D / 2);
    const az = Math.PI / 4;
    const c = this.camera;
    c.position.set(
      t.x + 60 * Math.cos(ELEVATION) * Math.sin(az),
      t.y + 60 * Math.sin(ELEVATION),
      t.z + 60 * Math.cos(ELEVATION) * Math.cos(az),
    );
    c.lookAt(t);
    const half = Math.max(D, W / (this.w / this.h)) / 2;
    const aspect = this.w / this.h;
    c.left = -half * aspect;
    c.right = half * aspect;
    c.top = half;
    c.bottom = -half;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  frame(_now: number): void {
    this.sync();
    this.aim();
    this.pipe.render(this.scene, this.camera, this.w, this.h);
  }

  resize(w: number, h: number, _dpr: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
  }

  setQuality(s: GraphicsSettings): void {
    const p = this.pipe;
    p.style = s.tier === "medium" ? "classic" : "voxel";
    p.pixelSize = p.style === "voxel" ? 1 : Math.max(1, Math.round(3 / s.renderScale));
    p.quality = s.tier === "ultra" ? 2 : s.tier === "high" ? 1 : 0;
    p.renderer.shadowMap.enabled = s.shadows !== "off";
  }

  pick(clientX: number, clientY: number): Tile | null {
    if (!this.town) return null;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!hit) return null;
    const [x, y] = this.town.toTile(hit.x, hit.z);
    return { x, y };
  }

  dispose(): void {
    this.pipe.renderer.dispose();
    this.canvas.remove();
  }
}
