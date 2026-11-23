/**
 * Fireworks in the 3D town's sky. Which shows are up, and every rocket in them, come from the same place the
 * 2D canvas reads them (`game/fireworks.ts`, `core/src/fireworks.ts`), so both draw the same rockets at the same
 * moment. One instanced mesh of small glowing sparks (the camera is orthographic, so points would be a pixel),
 * set in place each frame. It is hidden, and draws nothing, while no show is on.
 */
import { climbOf, sparkAt, sparkFade } from "@tokenmaxxing/core/fireworks.ts";
import * as THREE from "three";
import { rocketsNow } from "../../game/fireworks.ts";

/** Sparks at once: the busiest moment of a finale is about 15 rockets of up to 27 sparks. */
const MAX = 1024;
/** A climbing rocket is its head and a short tail of fading sparks under it. */
const TRAIL = 4;
const SIZE = 0.2;

export class Fireworks3d {
  readonly group = new THREE.Group();
  private readonly sparks = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(SIZE / 2),
    new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      // Plain, not additive: on December's snow an additive glow adds up to white and vanishes.
      toneMapped: false,
    }),
    MAX,
  );
  private readonly palette = new Map<string, THREE.Color>();
  private readonly m4 = new THREE.Matrix4();
  private readonly tint = new THREE.Color();

  constructor(private readonly toWorld: (tx: number, ty: number) => [number, number]) {
    // They move every frame and fly well out of their box: never batched, culled, picked or shadowed.
    const mesh = this.sparks;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.live = true;
    mesh.userData.nopick = true;
    mesh.setColorAt(0, this.tint);
    mesh.count = 0;
    this.group.add(mesh);
    this.group.visible = false;
  }

  private colourOf(hex: string): THREE.Color {
    let c = this.palette.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      this.palette.set(hex, c);
    }
    return c;
  }

  update(): void {
    const rockets = rocketsNow();
    this.group.visible = rockets.length > 0;
    if (!this.group.visible) return;
    const mesh = this.sparks;
    let n = 0;
    const addSpark = (x: number, y: number, z: number, c: THREE.Color, k: number) => {
      if (n >= MAX) return;
      // Fading sparks shrink as they dim (they keep their colour).
      const size = 0.3 + 0.9 * k;
      mesh.setMatrixAt(n, this.m4.makeScale(size, size, size).setPosition(x, y, z));
      mesh.setColorAt(n, this.tint.copy(c));
      n++;
    };

    for (const r of rockets) {
      const [x, z] = this.toWorld(r.x, r.y);
      const c = this.colourOf(r.colour);
      if (r.burst === null) {
        // A rocket still climbing: its head, and a tail of sparks fading out below it.
        const top = climbOf(r);
        for (let i = 0; i < TRAIL; i++) addSpark(x, top - i * 0.25, z, c, 1 - i * 0.25);
        continue;
      }
      const fade = sparkFade(r);
      for (let i = 0; i < r.sparks; i++) {
        const [dx, dy, dz] = sparkAt(r, i);
        addSpark(x + dx, r.height + dy, z + dz, c, fade);
      }
    }

    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.sparks.geometry.dispose();
    (this.sparks.material as THREE.Material).dispose();
    this.sparks.dispose();
  }
}
