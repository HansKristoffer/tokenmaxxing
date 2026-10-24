import * as THREE from "three";
import { addPatch } from "../demo3d/patches.ts";

/**
 * Seeing yourself through trees and roofs: everything that stands up from the floor, is nearer the camera
 * than the player and falls within a ring round them on screen is cut away in a dither (the pixels drop out
 * more towards the middle). One uniform shared by every patched material:
 * x, y: the player's place in the render target's pixels; z: their depth from the camera; w: the ring's
 * radius in those pixels (0 turns it off).
 */
export const SEE = { value: new THREE.Vector4(0, 0, 0, 0) };

/** How much nearer than the player (world units) a thing must be to be cut away. */
const NEARER = 0.9;
/** Below this height (the floor, a lawn, a path) nothing is cut. */
const FLOOR_TOP = 0.14;

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
  if (uSee.w > 0.0 && vSeeY > ${FLOOR_TOP.toFixed(2)} && vSeeZ < uSee.z - ${NEARER.toFixed(2)}) {
    float seeD = distance(gl_FragCoord.xy, uSee.xy) / uSee.w;
    if (seeD < 1.0) {
      float keep = smoothstep(0.35, 1.0, seeD);
      float dith = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (dith > keep) discard;
    }
  }`,
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
