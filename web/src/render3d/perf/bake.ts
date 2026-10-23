import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { blockStandIn } from "../../demo3d/blocky.ts";
import { ticks } from "../../demo3d/kit.ts";

/**
 * Static batching. A room is hundreds to thousands of tiny meshes (a tree is a trunk and five balls), each its
 * own draw call, twice over once the shadow pass counts. `bakeStatic` folds everything that never moves into a
 * handful of merged meshes (per material and ~12 tile cell, so frustum culling still works), hides the
 * originals and keeps them as the source of truth. Anything that animates is found by running the kit's tick
 * functions at a few times and comparing world matrices, and stays live; so does whatever the builders flag
 * with `userData.live = true` (night swaps, walls that lower, anything a caller keeps a handle to).
 *
 * Two variants are kept per layer: the smooth meshes, and the blocky ones the Voxel style swaps in (see
 * `blocky.ts`), built on first use. `syncBaked` flips between them, so there is no per-frame traversal.
 */

export type BakeMode = "smooth" | "block";

/** Set on an object (or anything above it) to keep it out of the batches. */
export const LIVE = "live";
/** Set on a room's root: `bakeScene` batches it. */
export const BAKE = "bake";

const cellSize = (): number => Number((globalThis as { __bakeCell?: number }).__bakeCell ?? 8);
const SAMPLE_TIMES = [0.37, 3.91, 11.3, 29.77];

/** `?nobake` turns batching off (to compare pictures, or to see what it costs). */
const disabled = typeof location !== "undefined" && new URLSearchParams(location.search).has("nobake");

let epoch = 0;
/** Bumps whenever anything is added to any object: cheap way to know the scene graph may have changed. */
export const sceneEpoch = (): number => epoch;
let patched = false;
export function trackAdditions(): void {
  if (patched) return;
  patched = true;
  const add = THREE.Object3D.prototype.add;
  THREE.Object3D.prototype.add = function (this: THREE.Object3D, ...objs: THREE.Object3D[]) {
    epoch++;
    return add.apply(this, objs);
  };
}

export interface BakeStats {
  sources: number;
  live: number;
  merged: Record<BakeMode, { meshes: number; triangles: number } | undefined>;
}

function isLive(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p.userData[LIVE] || p.userData.noBake) return true;
    if (p === root) break;
  }
  return false;
}

function hiddenAbove(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return true;
    if (p === root) break;
  }
  return false;
}

function bakeable(m: THREE.Mesh): boolean {
  const mat = m.material;
  if (Array.isArray(mat) || (mat as THREE.Material).transparent) return false;
  if ((m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return false;
  if (m.renderOrder !== 0 || m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return false;
  const g = m.geometry;
  return !!g.getAttribute("position") && g.getAttribute("position").count > 0 && !g.morphAttributes.position;
}

const tex = (t: THREE.Texture | null | undefined): string =>
  t ? `${t.uuid}:${t.offset.x},${t.offset.y},${t.repeat.x},${t.repeat.y},${t.rotation}` : "-";

type Lit = THREE.MeshToonMaterial & { flatShading?: boolean; fog?: boolean };

/** Plain colour materials (no texture, no glow tricks) fold into one material per kind; their colour moves to the vertices. */
function foldable(m: THREE.Material): boolean {
  const a = m as Lit;
  if (m.type !== "MeshToonMaterial" && m.type !== "MeshBasicMaterial") return false;
  if (a.map || m.alphaTest || m.opacity !== 1 || a.vertexColors) return false;
  return !a.emissive || a.emissive.getHex() === 0;
}

/** Two materials that look the same share a batch. */
function matKey(m: THREE.Material): string {
  const a = m as Lit;
  const fold = foldable(m);
  return [
    m.type, fold ? "vc" : (a.color?.getHexString() ?? ""), tex(a.map), tex(a.gradientMap), a.emissive?.getHexString() ?? "",
    m.side, m.opacity, a.flatShading ? 1 : 0, m.alphaTest, a.vertexColors ? 1 : 0, a.fog ? 1 : 0, m.depthWrite ? 1 : 0,
  ].join("|");
}

/** The shared vertex-coloured stand-in for a folded material. */
function folded(m: THREE.Material): THREE.Material {
  const a = m as Lit;
  const c = m.clone() as Lit;
  c.vertexColors = true;
  c.color.set(0xffffff);
  c.userData.baked = true;
  if (a.gradientMap) (c as THREE.MeshToonMaterial).gradientMap = a.gradientMap;
  return c;
}

function matState(m: THREE.Material): string {
  return `${matKey(m)}|${m.visible}`;
}

/** Finds what moves by running every tick function at a few times and watching world matrices and materials. */
function findMoving(root: THREE.Object3D, meshes: THREE.Mesh[]): Set<THREE.Mesh> {
  const moving = new Set<THREE.Mesh>();
  const snap = () => {
    root.updateMatrixWorld(true);
    return meshes.map((m) => `${m.matrixWorld.elements.join()}|${m.visible}|${matState(m.material as THREE.Material)}`);
  };
  const before = snap();
  for (const t of SAMPLE_TIMES) {
    for (const tick of ticks) {
      try {
        tick(t);
      } catch {
        /* a tick that belongs to something torn down */
      }
    }
    const after = snap();
    for (let i = 0; i < meshes.length; i++) if (after[i] !== before[i]) moving.add(meshes[i]!);
  }
  // Put the animation back where the loop would have it next frame: the next real tick overwrites it anyway.
  return moving;
}

const tmp = new THREE.Matrix4();
const inv = new THREE.Matrix4();

function prepared(src: THREE.BufferGeometry, matrix: THREE.Matrix4, color?: THREE.Color): THREE.BufferGeometry {
  const g = src.clone();
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
  if (!g.getAttribute("uv")) {
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
  }
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  g.clearGroups();
  if (color) {
    const n = g.getAttribute("position").count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = color.r;
      c[i * 3 + 1] = color.g;
      c[i * 3 + 2] = color.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  }
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) {
    // A mirrored copy turns inside out: flip the winding.
    if (g.index) {
      const ix = g.index.array as Uint16Array | Uint32Array;
      for (let i = 0; i < ix.length; i += 3) {
        const t = ix[i + 1]!;
        ix[i + 1] = ix[i + 2]!;
        ix[i + 2] = t;
      }
    } else {
      for (const a of Object.values(g.attributes) as THREE.BufferAttribute[]) {
        const n = a.itemSize;
        const arr = a.array as Float32Array;
        for (let i = 0; i < a.count; i += 3)
          for (let k = 0; k < n; k++) {
            const t = arr[(i + 1) * n + k]!;
            arr[(i + 1) * n + k] = arr[(i + 2) * n + k]!;
            arr[(i + 2) * n + k] = t;
          }
      }
    }
  }
  return g;
}

interface Source {
  mesh: THREE.Mesh;
  key: string;
  cell: string;
  material: THREE.Material;
  /** Set when the colour goes into the vertices. */
  color?: THREE.Color;
}

export class BakedLayer {
  readonly group = new THREE.Group();
  mode: BakeMode | null = null;
  private readonly variants: Partial<Record<BakeMode, THREE.Group>> = {};
  private sources: Source[] = [];
  /** Sources a variant could not represent (the blocky swap wants the mesh itself kept). */
  private readonly rejected = new Set<THREE.Mesh>();
  liveCount = 0;

  constructor(
    readonly root: THREE.Object3D,
    sources: Source[],
  ) {
    this.sources = sources;
    this.group.name = "baked";
    this.group.matrixAutoUpdate = false;
    this.group.userData.noBake = true;
    root.add(this.group);
  }

  get sourceMeshes(): THREE.Mesh[] {
    return this.sources.map((s) => s.mesh);
  }

  /** Shows the variant for `mode`, building it the first time. */
  show(mode: BakeMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    let v = this.variants[mode];
    if (!v) {
      v = this.build(mode);
      this.variants[mode] = v;
      this.group.add(v);
    }
    for (const [m, g] of Object.entries(this.variants)) g!.visible = m === mode;
    // Sources a variant left out keep drawing themselves, the rest are hidden behind the merged copy.
    for (const s of this.sources) {
      s.mesh.visible = mode === "block" && this.rejected.has(s.mesh);
      s.mesh.userData.bakedSource = !s.mesh.visible;
    }
  }

  stats(): BakeStats {
    const of = (m: BakeMode) => {
      const v = this.variants[m];
      if (!v) return undefined;
      let tris = 0;
      for (const c of v.children) {
        const g = (c as THREE.Mesh).geometry;
        tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
      }
      return { meshes: v.children.length, triangles: tris };
    };
    return { sources: this.sources.length, live: this.liveCount, merged: { smooth: of("smooth"), block: of("block") } };
  }

  private build(mode: BakeMode): THREE.Group {
    const out = new THREE.Group();
    out.matrixAutoUpdate = false;
    inv.copy(this.root.matrixWorld).invert();
    const groups = new Map<string, { parts: THREE.BufferGeometry[]; mat: THREE.Material; cast: boolean; recv: boolean }>();
    for (const s of this.sources) {
      const m = s.mesh;
      let geo: THREE.BufferGeometry | null = m.geometry;
      if (mode === "block") {
        const b = blockStandIn(m);
        if (b === "reject") {
          this.rejected.add(m);
          continue;
        }
        geo = b ?? m.geometry;
      }
      tmp.multiplyMatrices(inv, m.matrixWorld);
      const key = `${s.key}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${s.cell}`;
      let grp = groups.get(key);
      if (!grp) groups.set(key, (grp = { parts: [], mat: s.material, cast: m.castShadow, recv: m.receiveShadow }));
      grp.parts.push(prepared(geo!, tmp, s.color));
    }
    for (const [key, grp] of groups) {
      const indexed = grp.parts.every((p) => p.index);
      const flat = indexed ? grp.parts : grp.parts.map((p) => (p.index ? p.toNonIndexed() : p));
      const merged = mergeGeometries(flat, false);
      for (const p of grp.parts) p.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, grp.mat);
      mesh.castShadow = grp.cast;
      mesh.receiveShadow = grp.recv;
      mesh.matrixAutoUpdate = false;
      mesh.name = `baked:${key.split("|").slice(0, 2).join(":")}`;
      mesh.userData.noBake = true;
      out.add(mesh);
    }
    return out;
  }

  dispose(): void {
    for (const v of Object.values(this.variants)) {
      for (const c of v!.children) (c as THREE.Mesh).geometry.dispose();
    }
    this.group.removeFromParent();
    for (const s of this.sources) {
      s.mesh.visible = true;
      s.mesh.userData.bakedSource = false;
    }
  }
}

/** Batches the static meshes under `root`; the originals stay in the tree, hidden once a variant shows. */
export function bakeStatic(root: THREE.Object3D): BakedLayer | null {
  root.updateMatrixWorld(true);
  const candidates: THREE.Mesh[] = [];
  const why = { live: 0, hidden: 0, unbakeable: 0, moving: 0, baked: 0 };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (isLive(m, root)) why.live++;
    else if (hiddenAbove(m, root)) why.hidden++;
    else if (!bakeable(m)) why.unbakeable++;
    else candidates.push(m);
  });
  if (!candidates.length) return null;
  const moving = findMoving(root, candidates);
  const reps = new Map<string, THREE.Material>();
  const sources: Source[] = [];
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const p = new THREE.Vector3();
  for (const m of candidates) {
    if (moving.has(m)) continue;
    const mat = m.material as THREE.Material;
    const key = matKey(mat);
    const fold = foldable(mat);
    if (!reps.has(key)) reps.set(key, fold ? folded(mat) : mat);
    p.setFromMatrixPosition(m.matrixWorld).applyMatrix4(inverse);
    sources.push({
      mesh: m,
      key,
      cell: `${Math.floor(p.x / cellSize())},${Math.floor(p.z / cellSize())}`,
      material: reps.get(key)!,
      color: fold ? (mat as Lit).color : undefined,
    });
  }
  if (sources.length < 2) return null;
  why.moving = candidates.length - sources.length;
  why.baked = sources.length;
  (globalThis as unknown as { __bakes?: unknown[] }).__bakes ??= [];
  (globalThis as unknown as { __bakes: unknown[] }).__bakes.push({ root: root.name || root.type, ...why });
  const layer = new BakedLayer(root, sources);
  (globalThis as unknown as { __layers?: BakedLayer[] }).__layers ??= [];
  (globalThis as unknown as { __layers: BakedLayer[] }).__layers.push(layer);
  layer.liveCount = candidates.length - sources.length;
  return layer;
}

const layers = new WeakMap<THREE.Object3D, BakedLayer | null>();
const seen = new WeakMap<THREE.Scene, { epoch: number; mode: BakeMode | null; layers: BakedLayer[] }>();

/** Bakes every flagged root (`userData.bake`) not yet baked, and shows the variant for `mode`. Cheap when nothing changed. */
export function syncBaked(scene: THREE.Scene, mode: BakeMode): BakedLayer[] {
  if (disabled) return [];
  let s = seen.get(scene);
  if (!s) seen.set(scene, (s = { epoch: -1, mode: null, layers: [] }));
  if (s.epoch === epoch && s.mode === mode) return s.layers;
  if (s.epoch !== epoch) {
    s.epoch = epoch;
    const found: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData[BAKE] && !layers.has(o)) found.push(o);
    });
    for (const root of found) {
      const l = bakeStatic(root);
      layers.set(root, l);
      if (l) s.layers.push(l);
    }
    // Baking adds the layer groups: that is not a change worth another sweep.
    s.epoch = epoch;
  }
  s.mode = mode;
  for (const l of s.layers) l.show(mode);
  return s.layers;
}
