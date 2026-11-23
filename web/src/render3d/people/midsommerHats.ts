import type { Build } from "./gear3dHead.ts";
import { roundAt } from "./voxgear.ts";

/**
 * The three Sankt Hans hats (`core/src/costumes.ts` 50 to 52; 2D art in `web/src/art/midsommer.ts`), keyed by name for
 * `HAT_BUILDERS` (`gear3dHead.ts`). They draw in the head frame the other hats do (origin at the skull's centre, +z
 * the face, +y up) using only the model's own boxes, cones and balls, so smooth and blocky folk both wear them.
 */

const BLOOM = ["#e8584f", "#fbf7ef", "#f5d14a", "#6d9cf0"];

export const MIDSOMMER_HATS_3D: Record<string, Build> = {
  // Birch leaves and field flowers in a ring, a Dannebrog-red ribbon down the back.
  Midsommerkrans: (m) => {
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const [x, z] = roundAt(m, a, 0.27);
      m.ball(0.05, i % 2 ? "#72bf52" : "#3a7b2f", [x, 0.1 + (i % 2) * 0.03, z], [1, 0.9, 1], 6);
      if (i % 3 === 0) {
        const [fx, fz] = roundAt(m, a, 0.3);
        m.ball(0.04, BLOOM[(i / 3) % 4]!, [fx, 0.15, fz], [1, 1, 0.7], 6);
      }
    }
    for (const x of [-0.04, 0.04])
      m.box([0.035, 0.22, 0.012], "#c8102e", [x, -0.12, -0.28], 0.004).rotation.z = x * 3;
  },
  // A black cone bent at the tip over a wide brim, a straw band and a brass buckle.
  Heksehat: (m) => {
    m.cyl(0.38, 0.03, "#2a2433", [0, 0.1, 0], 0.38, 22);
    m.cyl(0.21, 0.3, "#2a2433", [0, 0.12, 0], 0.1, 16);
    m.cyl(0.21, 0.05, "#e3c35a", [0, 0.14, 0], 0.205, 16);
    m.box([0.06, 0.06, 0.02], "#f5c842", [0, 0.14, 0.2], 0.005);
    const tip = m.part([0, 0.4, 0]);
    tip.cyl(0.1, 0.22, "#2a2433", [0, 0, 0], 0.01, 12).rotation.z = -0.6;
  },
  // A wide straw hat with a Dannebrog-red band and a white stripe.
  "Strå-hat": (m) => {
    m.cyl(0.36, 0.03, "#e8c964", [0, 0.1, 0], 0.36, 22);
    m.cyl(0.21, 0.17, "#e8c964", [0, 0.1, 0], 0.19, 18);
    m.cyl(0.215, 0.05, "#c8102e", [0, 0.12, 0], 0.215, 18);
    m.box([0.03, 0.05, 0.02], "#fbf7ef", [0, 0.12, 0.22], 0.003);
    m.box([0.07, 0.015, 0.02], "#fbf7ef", [0, 0.14, 0.22], 0.003);
  },
};
