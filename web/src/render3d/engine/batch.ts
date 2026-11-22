import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface BatchOptions {
  /** Meshes closer together than this (world units, in x and z) can share a draw call. */
  chunk: number;
  /** Puts the room in state `i` of `samples` (another hour, another time, another view): what moves shows. */
  probe: (i: number) => void;
  samples: number;
  /** Whatever the room changes by itself and this can't see (it swaps a mesh's material, say). */
  keep?: (mesh: THREE.Mesh) => boolean;
  /** Fold plain solid-colour toon/basic materials into one vertex-coloured batch per group. */
  foldPlain?: boolean;
}

export interface BatchResult {
  /** Draw calls (meshes) before and after. */
  before: number;
  after: number;
  batches: number;
}

interface Snapshot {
  matrix: Float32Array;
  visible: boolean;
  material: string;
  colour: number;
  opacity: number;
  version: number;
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as THREE.Mesh).isMesh === true;

/** Whether `o` or anything above it (up to `root`) is set to stay out of the batches (`userData.nobatch`): a boss, a crowd, a gate's boards. */
function kept(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p.userData.nobatch === true) return true;
    if (p === root) break;
  }
  return false;
}

/** Whether `o` and everything above it (up to `root`) is visible. */
function visibleThroughout(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === root) break;
  }
  return true;
}

function snapshot(m: THREE.Mesh, root: THREE.Object3D): Snapshot {
  const mat = m.material as THREE.MeshStandardMaterial;
  return {
    matrix: Float32Array.from(m.matrixWorld.elements),
    visible: visibleThroughout(m, root),
    material: mat.uuid,
    colour: mat.color?.getHex() ?? 0,
    opacity: mat.opacity,
    version: (m.geometry.attributes.position as THREE.BufferAttribute | undefined)?.version ?? 0,
  };
}

// Matrices are compared to 1e-5, which is well under a visible move and above float noise.
const same = (a: Snapshot, b: Snapshot): boolean => {
  if (a.visible !== b.visible || a.material !== b.material || a.colour !== b.colour) return false;
  if (a.opacity !== b.opacity || a.version !== b.version) return false;
  for (let i = 0; i < 16; i++) if (Math.abs(a.matrix[i]! - b.matrix[i]!) > 1e-5) return false;
  return true;
};

type PlainMat = THREE.MeshToonMaterial & { flatShading?: boolean; fog?: boolean };

function plainFoldable(m: THREE.Material): m is PlainMat {
  const a = m as PlainMat;
  if (m.type !== "MeshToonMaterial" && m.type !== "MeshBasicMaterial") return false;
  if (a.map || m.alphaTest || m.opacity !== 1 || m.transparent || a.vertexColors) return false;
  return !a.emissive || a.emissive.getHex() === 0;
}

function plainKey(m: PlainMat): string {
  return [
    "vc",
    m.type,
    m.gradientMap?.uuid ?? "-",
    m.side,
    m.flatShading ? 1 : 0,
    m.fog ? 1 : 0,
    m.depthWrite ? 1 : 0,
    m.customProgramCacheKey?.() ?? "",
  ].join(":");
}

function foldedPlain(m: PlainMat): THREE.Material {
  const c = m.clone() as PlainMat;
  c.vertexColors = true;
  c.color.set(0xffffff);
  c.onBeforeCompile = m.onBeforeCompile;
  c.customProgramCacheKey = m.customProgramCacheKey;
  if (m.gradientMap) (c as THREE.MeshToonMaterial).gradientMap = m.gradientMap;
  return c;
}

/**
 * Merges everything in `root` that never moves into a few big meshes: one per material per patch of floor.
 * A town is some three thousand little boxes, and every one is a draw call (twice, with shadows); merged it
 * is a few hundred. What counts as "never moves" is found out by running the room's own animation (`probe`)
 * through several states and keeping only the meshes that were the same in all of them. Meshes the caller
 * says to `keep`, see-through ones (they sort one by one), instanced, skinned and mirrored ones stay as
 * they are.
 */
export function batchStatic(root: THREE.Object3D, o: BatchOptions): BatchResult {
  root.updateMatrixWorld(true);
  const all: THREE.Mesh[] = [];
  root.traverse((n) => {
    if (isMesh(n)) all.push(n);
  });
  const candidates = all.filter((m) => {
    if (Array.isArray(m.material) || (m.material as THREE.Material).transparent) return false;
    const isInstancedOrSkinned =
      (m as unknown as THREE.InstancedMesh).isInstancedMesh ||
      (m as unknown as THREE.SkinnedMesh).isSkinnedMesh;
    if (isInstancedOrSkinned) return false;
    if (m.userData.nopick || m.userData.nobatch || o.keep?.(m) || kept(m, root)) return false;
    // A mirrored mesh (negative determinant) would turn its faces inside out when merged.
    return m.matrixWorld.determinant() > 0 && m.geometry.attributes.position !== undefined;
  });

  // Which of them move: a snapshot in each of the room's states.
  const first = new Map(candidates.map((m) => [m, snapshot(m, root)]));
  const moving = new Set<THREE.Mesh>();
  const markMoving = () => {
    for (const m of candidates) {
      if (!moving.has(m) && !same(first.get(m)!, snapshot(m, root))) moving.add(m);
    }
  };
  for (let i = 1; i < o.samples; i++) {
    o.probe(i);
    root.updateMatrixWorld(true);
    markMoving();
  }
  o.probe(0);
  root.updateMatrixWorld(true);
  markMoving();

  // Group the still ones by material, shadow flags and patch of floor.
  const groups = new Map<string, { list: THREE.Mesh[]; fold: boolean }>();
  const centre = new THREE.Vector3();
  const boxCenter = new THREE.Vector3();
  for (const m of candidates) {
    if (moving.has(m) || !first.get(m)!.visible) continue;
    const mat = m.material as THREE.Material;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    centre.copy(m.geometry.boundingBox!.getCenter(boxCenter)).applyMatrix4(m.matrixWorld);
    const shadows = `${+m.castShadow}${+m.receiveShadow}`;
    const patch = `${Math.floor(centre.x / o.chunk)},${Math.floor(centre.z / o.chunk)}`;
    const fold = !!o.foldPlain && plainFoldable(mat);
    const matId = fold ? plainKey(mat as PlainMat) : mat.uuid;
    const key = [matId, shadows, m.renderOrder, patch].join("|");
    const entry = groups.get(key);
    if (entry) entry.list.push(m);
    else groups.set(key, { list: [m], fold });
  }

  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const localMat = new THREE.Matrix4();
  const out = new THREE.Group();
  out.name = "batched";
  let batches = 0;
  let mergedMeshes = 0;
  for (const { list, fold } of groups.values()) {
    if (list.length < 2) continue;
    const lead = list[0]!;
    // Only bake vertex colours when multiple plain materials actually share this batch.
    const bakeColor = fold && list.some((m) => m.material !== lead.material);
    const parts: THREE.BufferGeometry[] = [];
    for (const m of list) {
      const src = m.geometry;
      const g = src.index ? src.toNonIndexed() : src.clone();
      // The vertex colours stay when the material reads them (the voxel people's bodies are painted that way).
      const colours = bakeColor || (m.material as THREE.MeshStandardMaterial).vertexColors === true;
      for (const name of Object.keys(g.attributes))
        if (
          name !== "position" &&
          name !== "normal" &&
          name !== "uv" &&
          !(!bakeColor && colours && name === "color")
        )
          g.deleteAttribute(name);
      const n = g.attributes.position!.count;
      if (bakeColor) {
        const col = (m.material as PlainMat).color;
        const c = new Float32Array(n * 3);
        const r = col.r;
        const gr = col.g;
        const b = col.b;
        for (let i = 0; i < n; i++) {
          const j = i * 3;
          c[j] = r;
          c[j + 1] = gr;
          c[j + 2] = b;
        }
        g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      } else if (colours && !g.attributes.color) {
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      g.applyMatrix4(localMat.multiplyMatrices(inverse, m.matrixWorld));
      parts.push(g);
    }
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, bakeColor ? foldedPlain(lead.material as PlainMat) : lead.material);
    mesh.castShadow = lead.castShadow;
    mesh.receiveShadow = lead.receiveShadow;
    mesh.renderOrder = lead.renderOrder;
    mesh.userData.batched = list.length;
    out.add(mesh);
    for (const m of list) {
      m.removeFromParent();
      const g = m.geometry;
      if (!g.userData.shared) g.dispose();
      const saved = m.userData.voxelSaved as { geometry?: THREE.BufferGeometry } | undefined;
      if (saved?.geometry && !saved.geometry.userData.shared) saved.geometry.dispose();
    }
    batches++;
    mergedMeshes += list.length;
  }
  root.add(out);
  return { before: all.length, after: all.length - mergedMeshes + batches, batches };
}
