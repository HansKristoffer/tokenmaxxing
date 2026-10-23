import * as THREE from "three";

/**
 * Many small glowing boxes in one draw call: missiles, sparks and the like. Each frame `begin`, `add` the ones that are
 * alive, `end`. It moves every frame, so it is marked `live` and the static batching leaves it alone.
 */
export class Swarm {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(readonly max: number, size = 0.06) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, max));
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, max) * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.mesh.userData.live = true;
    this.mesh.userData.nopick = true;
    this.mesh.userData.nobatch = true;
  }

  get size(): number {
    return this.n;
  }

  begin(): void {
    this.n = 0;
  }

  /** One box at (x, y, z), `scale` times the base size, in `colour`; ignored once the swarm is full. */
  add(x: number, y: number, z: number, scale: number, colour: THREE.ColorRepresentation): boolean {
    if (this.n >= this.max) return false;
    this.m.compose(this.p.set(x, y, z), this.q, this.s.setScalar(scale));
    this.mesh.setMatrixAt(this.n, this.m);
    this.mesh.setColorAt(this.n, this.c.set(colour));
    this.n++;
    return true;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
