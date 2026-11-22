import * as THREE from "three";
import { addPatch } from "../kit/patches.ts";
import { occluderSphere, occlusionBlocked } from "./occlusion-ray.ts";

/**
 * A cutaway through foreground scenery when it hides most of the player's upper body.
 * One uniform shared by every patched material:
 * x, y: the player's place in the render target's pixels; z: their depth from the camera; w: the ring's
 * radius in those pixels (0 turns it off).
 *
 * What is cut is decided per piece (a leaf block, a wall, a roof), never per pixel: by pixel, a block straddling the
 * player's depth was sliced diagonally across its faces, and the slice swept over it with every step (the trees and
 * walls glittering round the player as they walked). A batched mesh (`perf/bake.ts`) carries each source piece's middle
 * in `seeAt` (w = 2), as does any geometry `seeThrough` or the Voxel swap has seen (`markMiddle`); anything else (a
 * person, built after) uses its own origin.
 */
export const SEE = { value: new THREE.Vector4(0, 0, 0, 0) };

/** How much nearer than the player (world units) a thing must be to hide them (`PlayerOcclusion`'s probe). */
const NEARER = 0.9;
/** The probe's samples: three columns this far apart, three rows from `PROBE_LOW` up in steps of `PROBE_RISE`. */
const PROBE_SIDE = 0.14;
const PROBE_LOW = -0.35;
const PROBE_RISE = 0.22;
/** No sample is farther than this from the probe's middle, so no sample's ray is farther from the middle's. */
const PROBE_REACH = Math.hypot(PROBE_SIDE, Math.max(-PROBE_LOW, PROBE_LOW + 2 * PROBE_RISE)) + 0.01;
/** How much nearer than the player a piece's middle must be to be cut: its surface is about half a piece nearer. */
const PIECE_NEARER = 0.5;
/** Below this height (the floor, a lawn, a path) nothing is cut. */
const FLOOR_TOP = 0.14;
/** The hole's radius, as a share of the ring's; the rim and the shade round it take the rest. */
const HOLE = 0.78;

const patch = (sh: Parameters<THREE.Material["onBeforeCompile"]>[0]) => {
  sh.uniforms.uSee = SEE;
  sh.vertexShader = sh.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying float vSeeZ;\nvarying float vSeeY;\nattribute vec4 seeAt;",
    )
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>
  // Where this piece is: its middle (seeAt.w = 2: a batch's source piece, or a marked geometry), else its origin.
  vec4 seeO = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
  seeO = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #endif
  if (seeAt.w > 1.5) seeO = modelMatrix * vec4(seeAt.xyz, 1.0);
  vSeeZ = -(viewMatrix * seeO).z;
  vSeeY = (modelMatrix * vec4(transformed, 1.0)).y;`,
    );
  sh.fragmentShader = sh.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying float vSeeZ;\nvarying float vSeeY;\nuniform vec4 uSee;",
    )
    .replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
  float seeRim = 0.0;
  float seeShade = 0.0;
  if (uSee.w > 0.0 && vSeeY > ${FLOOR_TOP.toFixed(2)} && vSeeZ < uSee.z - ${PIECE_NEARER.toFixed(2)}) {
    float seeOut = distance(gl_FragCoord.xy, uSee.xy) - uSee.w * ${HOLE.toFixed(2)};
    if (seeOut < 0.0) discard;
    seeRim = 1.0 - smoothstep(0.0, uSee.w * 0.035, seeOut);
    seeShade = 1.0 - smoothstep(0.0, uSee.w * ${(1 - HOLE).toFixed(2)}, seeOut);
  }`,
    )
    .replace(
      "#include <opaque_fragment>",
      `outgoingLight = mix(outgoingLight * (1.0 - 0.08 * seeShade * seeShade), vec3(1.0, 0.96, 0.86), seeRim * 0.14);
  #include <opaque_fragment>`,
    );
};

const middleVec = new THREE.Vector3();

/** Puts the middle of `g`'s bounding box (in its own space) in every vertex's `seeAt`, once per geometry. */
export function markMiddle(g: THREE.BufferGeometry): void {
  if (g.getAttribute("seeAt")) return;
  if (!g.boundingBox) g.computeBoundingBox();
  const c = g.boundingBox!.getCenter(middleVec);
  const cx = c.x;
  const cy = c.y;
  const cz = c.z;
  const n = g.getAttribute("position").count;
  const at = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    at[o] = cx;
    at[o + 1] = cy;
    at[o + 2] = cz;
    at[o + 3] = 2;
  }
  g.setAttribute("seeAt", new THREE.BufferAttribute(at, 4));
}

/** Teaches the toon materials under `root` to cut themselves away round the player (see `SEE`). */
export function seeThrough(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.nosee) return;
    let patched = false;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if ((mat as THREE.MeshToonMaterial).isMeshToonMaterial && !mat.transparent) {
        addPatch(mat, "see", patch);
        patched = true;
      }
    }
    if (patched && mesh.geometry.getAttribute("position")) markMiddle(mesh.geometry);
  });
}

/** Probe the head and torso, so a narrow post or a low prop does not open a cutaway. */
export class PlayerOcclusion {
  private readonly caster = new THREE.Raycaster();
  private readonly point = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly ndc = new THREE.Vector2();
  private readonly stack: THREE.Object3D[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  /** The meshes a sample's ray could touch this probe: those near the line from the camera to the player. */
  private readonly near: THREE.Mesh[] = [];
  /** Cached inverse world matrix for each `near` mesh during a single 9-ray probe. */
  private readonly nearInv: THREE.Matrix4[] = [];
  private readonly forward = new THREE.Vector3();
  private readonly ball = new THREE.Sphere();
  private hidden = false;
  private elapsed = Infinity;
  private amount = 0;
  private readonly lastAt = new THREE.Vector3(Infinity, Infinity, Infinity);
  private readonly lastView = new THREE.Matrix4();
  private readonly lastProjection = new THREE.Matrix4();
  private previous: {
    mesh: THREE.Mesh;
    geometry: THREE.BufferGeometry;
    position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
    index: THREE.BufferAttribute | null;
    matrix: THREE.Matrix4;
    version: number;
    indexVersion: number;
    start: number;
    count: number;
  }[] = [];

  constructor(private readonly root: THREE.Object3D) {}

  /** Collects visible pickable meshes patched for cutaway directly without intermediate arrays or closures. */
  private collectMeshes(): void {
    const meshes = this.meshes;
    const stack = this.stack;
    meshes.length = 0;
    stack.length = 0;
    if (!this.root.visible || this.root.userData.nopick) return;
    stack.push(this.root);
    while (stack.length > 0) {
      const o = stack.pop()!;
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const mat = mesh.material;
        if (
          !Array.isArray(mat) &&
          mat.userData.patches?.includes("see") &&
          mesh.geometry.getAttribute("position")
        ) {
          meshes.push(mesh);
        }
      }
      const children = o.children;
      for (let i = children.length - 1; i >= 0; i--) {
        const c = children[i]!;
        if (c.visible && !c.userData.nopick) stack.push(c);
      }
    }
  }

  update(at: THREE.Vector3, camera: THREE.OrthographicCamera, dt: number, calm: boolean): number {
    this.elapsed += dt;
    // About 12 probes a second: the cutaway eases over a fraction of a second, so finer probing buys nothing.
    if (this.elapsed >= 0.08) {
      this.elapsed = 0;
      this.root.updateMatrixWorld();
      this.collectMeshes();
      const meshes = this.meshes;
      let changed =
        !at.equals(this.lastAt) ||
        !camera.matrixWorld.equals(this.lastView) ||
        !camera.projectionMatrix.equals(this.lastProjection) ||
        meshes.length !== this.previous.length;
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i]!;
        const geometry = mesh.geometry;
        const attribute = geometry.getAttribute("position");
        const version =
          (attribute as THREE.BufferAttribute).version ??
          (attribute as THREE.InterleavedBufferAttribute).data.version;
        const indexVersion = geometry.index?.version ?? 0;

        // Any change to the piece's mesh, geometry, matrix or draw range makes the cutaway probe again.
        const old = this.previous[i];
        if (
          !changed &&
          (!old ||
            old.mesh !== mesh ||
            old.geometry !== geometry ||
            old.position !== attribute ||
            old.index !== geometry.index ||
            !old.matrix.equals(mesh.matrixWorld) ||
            old.version !== version ||
            old.indexVersion !== indexVersion ||
            old.start !== geometry.drawRange.start ||
            old.count !== geometry.drawRange.count)
        ) {
          changed = true;
        }

        if (old) {
          old.mesh = mesh;
          old.geometry = geometry;
          old.position = attribute;
          old.index = geometry.index;
          old.matrix.copy(mesh.matrixWorld);
          old.version = version;
          old.indexVersion = indexVersion;
          old.start = geometry.drawRange.start;
          old.count = geometry.drawRange.count;
        } else {
          this.previous.push({
            mesh,
            geometry,
            position: attribute,
            index: geometry.index,
            matrix: mesh.matrixWorld.clone(),
            version,
            indexVersion,
            start: geometry.drawRange.start,
            count: geometry.drawRange.count,
          });
        }
      }
      this.previous.length = meshes.length;
      if (changed) {
        this.lastAt.copy(at);
        this.lastView.copy(camera.matrixWorld);
        this.lastProjection.copy(camera.projectionMatrix);
        this.right.setFromMatrixColumn(camera.matrixWorld, 0);
        this.nearby(at, camera);
        const near = this.near;
        const nearLen = near.length;
        // Invert each candidate mesh's world matrix once for all up-to-9 sample rays.
        for (let i = 0; i < nearLen; i++) {
          let inv = this.nearInv[i];
          if (!inv) {
            inv = new THREE.Matrix4();
            this.nearInv[i] = inv;
          }
          inv.copy(near[i]!.matrixWorld).invert();
        }
        // Of the nine samples, five must be blocked to start a cutaway and four to keep one going.
        // Stop as soon as the quorum is guaranteed reached or unreachable: mathematically identical verdicts.
        const need = this.hidden ? 4 : 5;
        let blocked = 0;
        let remaining = 9;
        if (nearLen > 0) {
          probe: for (let row = 0; row < 3; row++) {
            for (let column = -1; column <= 1; column++) {
              remaining--;
              this.point.copy(at).addScaledVector(this.right, column * PROBE_SIDE);
              this.point.y += PROBE_LOW + row * PROBE_RISE;

              // Depth from the camera sets how far the ray goes; the screen position aims it.
              const depth = -this.projected.copy(this.point).applyMatrix4(camera.matrixWorldInverse).z;
              this.projected.copy(this.point).project(camera);
              this.ndc.set(this.projected.x, this.projected.y);
              this.caster.setFromCamera(this.ndc, camera);
              this.caster.far = depth - NEARER;
              for (let i = 0; i < nearLen; i++) {
                if (occlusionBlocked(near[i]!, this.caster, FLOOR_TOP, this.nearInv[i])) {
                  blocked++;
                  break;
                }
              }
              if (blocked >= need || blocked + remaining < need) break probe;
            }
          }
        }
        near.length = 0;
        this.hidden = blocked >= need;
      }
    }
    const target = this.hidden ? 1 : 0;
    // The cutaway opens a little faster than it closes.
    this.amount = calm ? target : THREE.MathUtils.damp(this.amount, target, this.hidden ? 18 : 12, dt);
    if (Math.abs(this.amount - target) < 0.005) this.amount = target;
    return this.amount;
  }

  /**
   * Fills `near` with the meshes a sample could be hidden by. Every sample's ray runs along the camera's
   * direction within `PROBE_REACH` of the line through `at`, and stops `NEARER` short of its sample: a mesh
   * whose bounding sphere is farther from that line, or wholly behind where the rays stop, cannot be hit.
   * A room is hundreds of meshes and a handful pass, so the nine rays test those and not the room.
   */
  private nearby(at: THREE.Vector3, camera: THREE.OrthographicCamera): void {
    const near = this.near;
    near.length = 0;
    const forward = camera.getWorldDirection(this.forward);
    const ball = this.ball;
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i]!;
      if (!occluderSphere(mesh, ball)) {
        near.push(mesh);
        continue;
      }
      const x = ball.center.x - at.x;
      const y = ball.center.y - at.y;
      const z = ball.center.z - at.z;
      const along = x * forward.x + y * forward.y + z * forward.z;
      if (along - ball.radius > PROBE_REACH - NEARER) continue;
      const reach = ball.radius + PROBE_REACH;
      if (x * x + y * y + z * z - along * along <= reach * reach) near.push(mesh);
    }
  }
}
