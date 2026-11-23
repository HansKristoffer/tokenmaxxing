/**
 * The cold in the 3D town (2D: `game/cold.ts`, `game/snow.ts`): how iced over the pond is, a person's breath in
 * the air, and the bots' scarves. `Fx` eases `ICE`; `entities.ts` puts the breath and scarves on the people.
 */

import * as THREE from "three";
import { breathPuff, scarfOf } from "../../game/cold.ts";
import { Model } from "../kit/kit.ts";

/** 0..1 how iced over the pond is. `Fx` eases it towards the weather; the pond (`town3d.ts`) reads it each frame. */
export const ICE = { value: 0 };

const PUFF = new THREE.SphereGeometry(1, 8, 6);
const PUFF_MAT = new THREE.MeshBasicMaterial({
  color: "#f4f7fc",
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
});
// Everyone's breath is made of these two: freeing a person must leave them for the rest.
PUFF.userData.shared = PUFF_MAT.userData.shared = true;

/** Off the picking and the block swap, like the other effects hung on a person. */
const loose = (o: THREE.Object3D) => {
  o.userData.nopick = true;
  o.userData.noBlock = true;
};

/**
 * Where a person's neck is, above their feet, standing. Measured from where the voxel head sits on them (heads
 * differ by style), not counting how far the pose has the body dropped right now.
 */
export function neckOf(root: THREE.Object3D, body: THREE.Object3D, head: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const at = root.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  return at.y - body.position.y;
}

/** A puff of breath leaving the mouth every few seconds: two soft balls swelling, drifting forward and up, gone. */
export class Breath {
  readonly group = new THREE.Group();
  private readonly puffs: THREE.Mesh[] = [];

  constructor() {
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(PUFF, PUFF_MAT);
      loose(m);
      this.puffs.push(m);
      this.group.add(m);
    }
    loose(this.group);
    this.group.visible = false;
  }

  /** Poses the puff for person `id` at `now` (ms), the mouth `mouth` units up and facing +z. */
  update(id: number, now: number, mouth: number): void {
    const t = breathPuff(id, now);
    this.group.visible = t !== null;
    if (t === null) return;
    for (const [i, m] of this.puffs.entries()) {
      const k = Math.max(0, t - i * 0.18);
      m.position.set((i - 0.5) * 0.05, mouth + k * 0.18, 0.22 + k * 0.45);
      m.scale.setScalar(Math.max(0.001, Math.sin(Math.PI * Math.min(1, k * 1.2)) * (0.1 + i * 0.03)));
    }
  }
}

const MAX_PUFFS = 256;
const puffMat = new THREE.Matrix4();

/**
 * Draws every outdoor person's cold-weather breath in a single instanced draw call instead of two transparent
 * meshes per person.
 */
export class BreathPool {
  readonly mesh: THREE.InstancedMesh;
  private count = 0;

  constructor() {
    this.mesh = new THREE.InstancedMesh(PUFF, PUFF_MAT, MAX_PUFFS);
    loose(this.mesh);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.count = 0;
  }

  reset(): void {
    this.count = 0;
  }

  emit(id: number, now: number, x: number, y: number, z: number, yaw: number, mouth: number): void {
    if (this.count + 2 > MAX_PUFFS) return;
    const t = breathPuff(id, now);
    if (t === null) return;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const e = puffMat.elements;

    for (let i = 0; i < 2; i++) {
      const k = Math.max(0, t - i * 0.18);
      const size = Math.max(0.001, Math.sin(Math.PI * Math.min(1, k * 1.2)) * (0.1 + i * 0.03));
      const lx = (i - 0.5) * 0.05;
      const ly = mouth + k * 0.18;
      const lz = 0.22 + k * 0.45;

      // Column-major 4x4: a uniform scale on the diagonal, then the puff's place turned by the person's yaw.
      e[0] = size;
      e[1] = 0;
      e[2] = 0;
      e[3] = 0;
      e[4] = 0;
      e[5] = size;
      e[6] = 0;
      e[7] = 0;
      e[8] = 0;
      e[9] = 0;
      e[10] = size;
      e[11] = 0;
      e[12] = x + lx * cos + lz * sin;
      e[13] = y + ly;
      e[14] = z - lx * sin + lz * cos;
      e[15] = 1;
      this.mesh.setMatrixAt(this.count++, puffMat);
    }
  }

  flush(): void {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A striped scarf round the neck (at 0) with an end hanging down the front, in bot `id`'s colours. */
export function scarf(id: number): Model {
  const [a, b] = scarfOf(id);
  const m = new Model();
  m.box([0.36, 0.085, 0.3], a, [0, 0.02, 0.01], 0.03);
  m.box([0.37, 0.03, 0.31], b, [0, 0.02, 0.01], 0.01);
  m.box([0.085, 0.2, 0.045], a, [0.07, -0.1, 0.17], 0.02);
  m.box([0.09, 0.03, 0.05], b, [0.07, -0.08, 0.17], 0.01);
  m.box([0.09, 0.03, 0.05], b, [0.07, -0.16, 0.17], 0.01);
  loose(m);
  return m;
}
