import * as THREE from "three";
import { type Model, toon } from "../kit/kit.ts";
import type { Build } from "./gear3dHead.ts";
import { isVox } from "./voxgear.ts";

/**
 * Påske's three costumes in 3D (`core/src/costumes.ts`, indices 60-62; the 2D art is `art/paaske-hats.ts`), merged into
 * `HAT_BUILDERS` in `gear3dHead.ts` by the item's name. They draw in the head frame (origin at the skull's centre, +z the
 * face, +y up, the skull about .25 across); the voxel people's heads are a tenth taller, so their parts sit higher.
 */

const WHITE = "#f6f1e7";
const PINK = "#f2a6b8";
const YELLOW = "#f7d23a";
const ORANGE = "#e8902a";
const GREEN = "#4f9b3d";

/** A thin ring, tilted a little: a headband or a vine. */
function ring(m: Model, colour: string, r: number, thick: number, y: number, tiltX: number): void {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, thick, 6, 22), toon(colour));
  t.rotation.x = Math.PI / 2 + tiltX;
  t.position.set(0, y, 0);
  t.castShadow = true;
  m.add(t);
}

export const PAASKE_HAT_BUILDERS: Record<string, Build> = {
  // Bunny ears: a pink band and two long white ears with pink insides; one stands, one flops.
  "Bunny ears": (m) => {
    const vox = isVox(m);
    const up = vox ? 0.1 : 0;
    if (vox) m.box([0.52, 0.045, 0.52], PINK, [0, 0.1 + up, 0], 0.01);
    else ring(m, PINK, 0.25, 0.016, 0.07, -0.42);
    for (const s of [-1, 1]) {
      const ear = m.part([s * 0.11, 0.17 + up, -0.02]);
      if (vox) {
        ear.box([0.1, 0.46, 0.07], WHITE, [0, 0, 0], 0.01);
        ear.box([0.05, 0.34, 0.02], PINK, [0, 0.05, 0.045], 0.004);
        continue;
      }
      // The right one folds over at the middle.
      ear.rotation.z = s === 1 ? -0.9 : 0.12;
      ear.rotation.x = -0.12;
      ear.ball(0.055, WHITE, [0, 0.2, 0], [0.8, 4, 0.5], 8);
      ear.ball(0.032, PINK, [0, 0.2, 0.02], [0.7, 3.5, 0.4], 6);
    }
  },
  // Chick hat: a fluffy yellow chick sitting on the crown, beak and eyes to the front.
  "Chick hat": (m) => {
    const up = isVox(m) ? 0.1 : 0;
    const y = 0.3 + up;
    m.ball(0.21, "#ffe36a", [0, y, 0], [1.05, 0.85, 1.05], 12);
    m.ball(0.15, "#ffe36a", [0, y + 0.16, 0.08], [1, 1, 1], 10);
    m.ball(0.09, "#f2c230", [-0.18, y, -0.02], [0.4, 1, 1.5], 6);
    m.ball(0.09, "#f2c230", [0.18, y, -0.02], [0.4, 1, 1.5], 6);
    m.cyl(0.045, 0.1, ORANGE, [0, y + 0.14, 0.2], 0.005, 4).rotation.x = Math.PI / 2;
    for (const x of [-0.06, 0.06]) m.ball(0.026, "#2b2433", [x, y + 0.21, 0.205], [1, 1, 1], 5);
    m.ball(0.04, "#ffe36a", [0, y + 0.31, 0.07], [0.7, 1.4, 0.7], 5);
    for (const x of [-0.08, 0.08]) m.box([0.05, 0.03, 0.09], ORANGE, [x, y - 0.12, 0.14], 0.008);
  },
  // Påskelilje crown: a green vine ring with yellow narcissi, orange trumpets, all the way round.
  "Påskelilje crown": (m) => {
    const up = isVox(m) ? 0.1 : 0;
    const y = 0.1 + up;
    if (isVox(m)) m.box([0.52, 0.04, 0.52], GREEN, [0, y, 0], 0.008);
    else ring(m, GREEN, 0.26, 0.018, y + 0.02, 0.1);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.sin(a) * 0.27;
      const z = Math.cos(a) * 0.27;
      const f = m.part([x, y + 0.09, z]);
      f.rotation.set(Math.cos(a) * 0.6, a, 0);
      for (let k = 0; k < 6; k++) {
        const b = (k / 6) * Math.PI * 2;
        f.ball(0.04, YELLOW, [Math.cos(b) * 0.05, 0, Math.sin(b) * 0.05], [1, 0.4, 1], 6);
      }
      f.cyl(0.03, 0.06, ORANGE, [0, 0, 0], 0.04, 6);
      f.ball(0.04, GREEN, [Math.sin(a + 1) * 0.07, -0.05, 0], [1.5, 0.4, 0.8], 5);
    }
  },
};
