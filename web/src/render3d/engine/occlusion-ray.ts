import * as THREE from "three";

/** Small contiguous triangle ranges share the source buffers, but reject rays against their own bounds. */
const ranges = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry[]>();
/** The buffers a geometry's bounds were last worked out from. */
interface Measured {
  position: unknown;
  index: unknown;
  positionVersion: number;
  indexVersion: number;
  start: number;
  count: number;
}
const measured = new WeakMap<THREE.BufferGeometry, Measured>();
const inverse = new THREE.Matrix4();
const localRay = new THREE.Ray();
const point = new THREE.Vector3();
const empty = new THREE.BufferGeometry();
const material = new THREE.MeshBasicMaterial();
const proxy: THREE.Mesh = new THREE.Mesh(empty, material);
const CHUNK = 64 * 3;

const versionOf = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number =>
  (a as THREE.BufferAttribute).version ?? (a as THREE.InterleavedBufferAttribute).data.version;

/** A mesh whose shape is not its geometry's alone: three's own raycast knows how, and its bounds are not the geometry's. */
const deforms = (mesh: THREE.Mesh): boolean =>
  (mesh as THREE.InstancedMesh).isInstancedMesh ||
  (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
  !!mesh.morphTargetInfluences?.some((v) => v !== 0);

/** Brings `source`'s bounds up to date with its buffers and draw range (and drops the ranges cut from the old ones). */
function measure(source: THREE.BufferGeometry): void {
  const position = source.getAttribute("position");
  const positionVersion = versionOf(position);
  const indexVersion = source.index?.version ?? -1;
  const { start, count } = source.drawRange;
  const was = measured.get(source);
  if (
    was &&
    was.position === position &&
    was.index === source.index &&
    was.positionVersion === positionVersion &&
    was.indexVersion === indexVersion &&
    was.start === start &&
    was.count === count
  )
    return;
  source.computeBoundingBox();
  source.computeBoundingSphere();
  measured.set(source, { position, index: source.index, positionVersion, indexVersion, start, count });
  ranges.delete(source);
}

/**
 * The sphere round `mesh` in the world, into `out`: what a ray has to come near to touch it. False for a mesh
 * whose bounds are not its geometry's (instanced, skinned, morphed): those are always tested.
 */
export function occluderSphere(mesh: THREE.Mesh, out: THREE.Sphere): boolean {
  if (deforms(mesh)) return false;
  measure(mesh.geometry);
  out.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
  return true;
}

export function occlusionRaycast(
  mesh: THREE.Mesh,
  caster: THREE.Raycaster,
  hits: THREE.Intersection[],
): void {
  if (deforms(mesh)) {
    mesh.raycast(caster, hits);
    return;
  }
  const source = mesh.geometry;
  measure(source);
  const position = source.getAttribute("position");
  const count = source.index?.count ?? position.count;
  if (count <= CHUNK) {
    mesh.raycast(caster, hits);
    return;
  }
  inverse.copy(mesh.matrixWorld).invert();
  localRay.copy(caster.ray).applyMatrix4(inverse);
  if (!localRay.intersectsBox(source.boundingBox!)) return;

  let chunks = ranges.get(source);
  if (!chunks) {
    chunks = [];
    const end = Math.min(count, source.drawRange.start + source.drawRange.count);
    for (let start = source.drawRange.start; start < end; start += CHUNK) {
      const g = new THREE.BufferGeometry();
      g.attributes = source.attributes;
      g.index = source.index;
      g.setDrawRange(start, Math.min(CHUNK, end - start));
      const box = new THREE.Box3();
      for (let i = start; i < Math.min(start + CHUNK, end); i++) {
        const vertex = source.index ? source.index.getX(i) : i;
        box.expandByPoint(point.fromBufferAttribute(position, vertex));
      }
      g.boundingBox = box;
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      chunks.push(g);
    }
    ranges.set(source, chunks);
  }
  proxy.matrixWorld.copy(mesh.matrixWorld);
  proxy.material = mesh.material;
  for (const g of chunks) {
    if (!localRay.intersectsBox(g.boundingBox!)) continue;
    proxy.geometry = g;
    proxy.raycast(caster, hits);
  }
  // Do not keep the last room's buffers alive through the reusable mesh.
  proxy.geometry = empty;
  proxy.material = material;
}
