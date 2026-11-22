import * as THREE from "three";

/** Flat AABB table for contiguous triangle chunks (6 floats per chunk: minX, minY, minZ, maxX, maxY, maxZ). */
interface ChunkIndex {
  boxes: Float32Array;
  start: number;
  end: number;
  count: number;
}

const chunkTable = new WeakMap<THREE.BufferGeometry, ChunkIndex>();
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
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const hitLocal = new THREE.Vector3();
const hitWorld = new THREE.Vector3();
const scratchHits: THREE.Intersection[] = [];
/** Triangles per chunk of a big mesh (three indices each): a ray tests only the chunks whose boxes it crosses. */
const CHUNK = 64 * 3;

const versionOf = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number =>
  (a as THREE.BufferAttribute).version ?? (a as THREE.InterleavedBufferAttribute).data.version;

/** A mesh whose shape is not its geometry's alone: three's own raycast knows how, and its bounds are not the geometry's. */
const deforms = (mesh: THREE.Mesh): boolean =>
  (mesh as THREE.InstancedMesh).isInstancedMesh ||
  (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
  !!mesh.morphTargetInfluences?.some((v) => v !== 0);

/** Brings `source`'s bounds up to date with its buffers and draw range (and drops the chunks cut from the old ones). */
function measure(source: THREE.BufferGeometry): void {
  const position = source.getAttribute("position");
  const positionVersion = versionOf(position);
  const indexVersion = source.index?.version ?? -1;
  const { start, count } = source.drawRange;
  const was = measured.get(source);
  const unchanged =
    was !== undefined &&
    was.position === position &&
    was.index === source.index &&
    was.positionVersion === positionVersion &&
    was.indexVersion === indexVersion &&
    was.start === start &&
    was.count === count;
  if (unchanged) return;
  const freshBounds =
    was === undefined &&
    source.boundingBox !== null &&
    source.boundingSphere !== null &&
    positionVersion === 0 &&
    indexVersion <= 0 &&
    start === 0 &&
    count === Infinity;
  if (!freshBounds) {
    source.computeBoundingBox();
    source.computeBoundingSphere();
  }
  measured.set(source, { position, index: source.index, positionVersion, indexVersion, start, count });
  chunkTable.delete(source);
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

/** Builds flat per-chunk AABBs directly from position/index typed arrays (zero BufferGeometry/Box3 allocations). */
function chunksOf(source: THREE.BufferGeometry, totalCount: number): ChunkIndex {
  let idx = chunkTable.get(source);
  if (idx) return idx;
  const start = source.drawRange.start;
  const end = Math.min(totalCount, start + source.drawRange.count);
  const numChunks = Math.max(0, Math.ceil((end - start) / CHUNK));
  const boxes = new Float32Array(numChunks * 6);
  const position = source.getAttribute("position");
  const index = source.index;
  const isInterleaved = (position as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute === true;
  const posArr = isInterleaved ? null : (position.array as Float32Array | Float64Array);
  const idxArr = index ? index.array : null;

  for (let c = 0; c < numChunks; c++) {
    const s = start + c * CHUNK;
    const e = Math.min(s + CHUNK, end);
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    if (posArr) {
      if (idxArr) {
        for (let i = s; i < e; i++) {
          const v = idxArr[i]! * 3;
          const x = posArr[v]!;
          const y = posArr[v + 1]!;
          const z = posArr[v + 2]!;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }
      } else {
        for (let i = s; i < e; i++) {
          const v = i * 3;
          const x = posArr[v]!;
          const y = posArr[v + 1]!;
          const z = posArr[v + 2]!;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }
      }
    } else {
      for (let i = s; i < e; i++) {
        const v = idxArr ? idxArr[i]! : i;
        const x = position.getX(v);
        const y = position.getY(v);
        const z = position.getZ(v);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
    const b = c * 6;
    boxes[b] = minX;
    boxes[b + 1] = minY;
    boxes[b + 2] = minZ;
    boxes[b + 3] = maxX;
    boxes[b + 4] = maxY;
    boxes[b + 5] = maxZ;
  }
  idx = { boxes, start, end, count: numChunks };
  chunkTable.set(source, idx);
  return idx;
}

/** Exact slab test matching `THREE.Ray.prototype.intersectsBox` against 6 packed floats. */
function rayHitsBox(
  ox: number,
  oy: number,
  oz: number,
  invDx: number,
  invDy: number,
  invDz: number,
  boxes: Float32Array,
  b: number,
): boolean {
  let tmin: number;
  let tmax: number;
  if (invDx >= 0) {
    tmin = (boxes[b]! - ox) * invDx;
    tmax = (boxes[b + 3]! - ox) * invDx;
  } else {
    tmin = (boxes[b + 3]! - ox) * invDx;
    tmax = (boxes[b]! - ox) * invDx;
  }
  let tymin: number;
  let tymax: number;
  if (invDy >= 0) {
    tymin = (boxes[b + 1]! - oy) * invDy;
    tymax = (boxes[b + 4]! - oy) * invDy;
  } else {
    tymin = (boxes[b + 4]! - oy) * invDy;
    tymax = (boxes[b + 1]! - oy) * invDy;
  }
  if (tmin > tymax || tymin > tmax) return false;
  if (tymin > tmin || Number.isNaN(tmin)) tmin = tymin;
  if (tymax < tmax || Number.isNaN(tmax)) tmax = tymax;
  let tzmin: number;
  let tzmax: number;
  if (invDz >= 0) {
    tzmin = (boxes[b + 2]! - oz) * invDz;
    tzmax = (boxes[b + 5]! - oz) * invDz;
  } else {
    tzmin = (boxes[b + 5]! - oz) * invDz;
    tzmax = (boxes[b + 2]! - oz) * invDz;
  }
  if (tmin > tzmax || tzmin > tmax) return false;
  if (tzmin > tmin || Number.isNaN(tmin)) tmin = tzmin;
  if (tzmax < tmax || Number.isNaN(tmax)) tmax = tzmax;
  return tmax >= 0;
}

/**
 * Returns true as soon as `mesh` blocks `caster`'s ray above `minY`, without allocating `Intersection` records.
 * Accepts a pre-inverted `mesh.matrixWorld` (`invMatrix`) so a 9-ray probe inverts each mesh at most once.
 */
export function occlusionBlocked(
  mesh: THREE.Mesh,
  caster: THREE.Raycaster,
  minY: number,
  invMatrix?: THREE.Matrix4,
): boolean {
  if (deforms(mesh)) {
    scratchHits.length = 0;
    mesh.raycast(caster, scratchHits);
    for (let i = 0; i < scratchHits.length; i++) {
      if (scratchHits[i]!.point.y > minY) {
        scratchHits.length = 0;
        return true;
      }
    }
    scratchHits.length = 0;
    return false;
  }
  const source = mesh.geometry;
  measure(source);
  const position = source.getAttribute("position");
  const count = source.index?.count ?? position.count;
  if (count <= CHUNK) {
    scratchHits.length = 0;
    mesh.raycast(caster, scratchHits);
    for (let i = 0; i < scratchHits.length; i++) {
      if (scratchHits[i]!.point.y > minY) {
        scratchHits.length = 0;
        return true;
      }
    }
    scratchHits.length = 0;
    return false;
  }
  const inv = invMatrix ?? inverse.copy(mesh.matrixWorld).invert();
  localRay.copy(caster.ray).applyMatrix4(inv);
  if (!localRay.intersectsBox(source.boundingBox!)) return false;

  const chunks = chunksOf(source, count);
  const boxes = chunks.boxes;
  const ox = localRay.origin.x;
  const oy = localRay.origin.y;
  const oz = localRay.origin.z;
  const invDx = 1 / localRay.direction.x;
  const invDy = 1 / localRay.direction.y;
  const invDz = 1 / localRay.direction.z;

  const side = Array.isArray(mesh.material) ? THREE.FrontSide : mesh.material.side;
  const isBack = side === THREE.BackSide;
  const cull = side !== THREE.DoubleSide;
  const near = caster.near;
  const far = caster.far;
  const worldMat = mesh.matrixWorld;
  const rayOrigin = caster.ray.origin;
  const isInterleaved = (position as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute === true;
  const posArr = isInterleaved ? null : (position.array as Float32Array | Float64Array);
  const idxArr = source.index ? source.index.array : null;

  for (let c = 0; c < chunks.count; c++) {
    if (!rayHitsBox(ox, oy, oz, invDx, invDy, invDz, boxes, c * 6)) continue;
    const s = chunks.start + c * CHUNK;
    const e = Math.min(s + CHUNK, chunks.end);
    for (let i = s; i + 2 < e; i += 3) {
      const ia = idxArr ? idxArr[i]! : i;
      const ib = idxArr ? idxArr[i + 1]! : i + 1;
      const ic = idxArr ? idxArr[i + 2]! : i + 2;
      if (posArr) {
        const oa = ia * 3;
        const ob = ib * 3;
        const oc = ic * 3;
        vA.set(posArr[oa]!, posArr[oa + 1]!, posArr[oa + 2]!);
        vB.set(posArr[ob]!, posArr[ob + 1]!, posArr[ob + 2]!);
        vC.set(posArr[oc]!, posArr[oc + 1]!, posArr[oc + 2]!);
      } else {
        vA.fromBufferAttribute(position, ia);
        vB.fromBufferAttribute(position, ib);
        vC.fromBufferAttribute(position, ic);
      }
      const hit = isBack
        ? localRay.intersectTriangle(vC, vB, vA, true, hitLocal)
        : localRay.intersectTriangle(vA, vB, vC, cull, hitLocal);
      if (!hit) continue;
      hitWorld.copy(hitLocal).applyMatrix4(worldMat);
      if (hitWorld.y <= minY) continue;
      const dist = rayOrigin.distanceTo(hitWorld);
      if (dist >= near && dist <= far) return true;
    }
  }
  return false;
}

export function occlusionRaycast(
  mesh: THREE.Mesh,
  caster: THREE.Raycaster,
  hits: THREE.Intersection[],
): void {
  if (occlusionBlocked(mesh, caster, -Infinity)) {
    hits.push({
      distance: caster.ray.origin.distanceTo(hitWorld),
      point: hitWorld.clone(),
      object: mesh,
    });
  }
}
