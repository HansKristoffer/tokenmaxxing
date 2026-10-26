import * as THREE from "three";
import { addPatch } from "../kit/patches.ts";
import { pickable } from "./pick.ts";

/**
 * A cutaway through foreground scenery when it hides most of the player's upper body.
 * One uniform shared by every patched material:
 * x, y: the player's place in the render target's pixels; z: their depth from the camera; w: the ring's
 * radius in those pixels (0 turns it off).
 */
export const SEE = { value: new THREE.Vector4(0, 0, 0, 0) };

/** How much nearer than the player (world units) a thing must be to be cut away. */
const NEARER = 0.9;
/** Below this height (the floor, a lawn, a path) nothing is cut. */
const FLOOR_TOP = 0.14;
/** The hole's radius, as a share of the ring's; the rim and the shade round it take the rest. */
const HOLE = 0.78;

const patch = (sh: Parameters<THREE.Material["onBeforeCompile"]>[0]) => {
  sh.uniforms.uSee = SEE;
  sh.vertexShader = sh.vertexShader
    .replace("#include <common>", "#include <common>\nvarying float vSeeZ;\nvarying float vSeeY;")
    .replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n  vSeeZ = -mvPosition.z;\n  vSeeY = (modelMatrix * vec4(transformed, 1.0)).y;",
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
  if (uSee.w > 0.0 && vSeeY > ${FLOOR_TOP.toFixed(2)} && vSeeZ < uSee.z - ${NEARER.toFixed(2)}) {
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

/** Teaches the toon materials under `root` to cut themselves away round the player (see `SEE`). */
export function seeThrough(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.nosee) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      if ((mat as THREE.MeshToonMaterial).isMeshToonMaterial && !mat.transparent) addPatch(mat, "see", patch);
  });
}

/** Probe the head and torso, so a narrow post or a low prop does not open a cutaway. */
export class PlayerOcclusion {
  private readonly caster = new THREE.Raycaster();
  private readonly point = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly ndc = new THREE.Vector2();
  private readonly hits: THREE.Intersection[] = [];
  private hidden = false;
  private elapsed = Infinity;
  private amount = 0;

  constructor(private readonly root: THREE.Object3D) {}

  update(at: THREE.Vector3, camera: THREE.OrthographicCamera, dt: number, calm: boolean): number {
    this.elapsed += dt;
    if (this.elapsed >= 0.08) {
      this.elapsed = 0;
      this.root.updateMatrixWorld(true);
      const meshes = pickable(this.root).filter((o): o is THREE.Mesh => {
        const mesh = o as THREE.Mesh;
        return !Array.isArray(mesh.material) && mesh.material.userData.patches?.includes("see");
      });
      this.right.setFromMatrixColumn(camera.matrixWorld, 0);
      let blocked = 0;
      for (let row = 0; row < 3; row++) {
        for (let column = -1; column <= 1; column++) {
          this.point.copy(at).addScaledVector(this.right, column * 0.14);
          this.point.y += -0.35 + row * 0.22;
          const depth = -this.projected.copy(this.point).applyMatrix4(camera.matrixWorldInverse).z;
          this.projected.copy(this.point).project(camera);
          this.ndc.set(this.projected.x, this.projected.y);
          this.caster.setFromCamera(this.ndc, camera);
          this.caster.far = depth - NEARER;
          this.hits.length = 0;
          for (const mesh of meshes) {
            mesh.raycast(this.caster, this.hits);
            if (this.hits.some((hit) => hit.point.y > FLOOR_TOP)) {
              blocked++;
              break;
            }
            this.hits.length = 0;
          }
        }
      }
      // Hysteresis keeps a roof edge from flickering between adjacent samples while walking.
      this.hidden = blocked >= (this.hidden ? 4 : 5);
    }
    const target = this.hidden ? 1 : 0;
    this.amount = calm ? target : THREE.MathUtils.damp(this.amount, target, this.hidden ? 18 : 12, dt);
    if (Math.abs(this.amount - target) < 0.005) this.amount = target;
    return this.amount;
  }
}
