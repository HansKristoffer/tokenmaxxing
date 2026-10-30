import { Model } from "../kit/kit.ts";

const COAT = "#4a5568";
const COAT_DARK = "#3a4352";
const TROUSERS = "#3b3a44";
const SKIN = "#e9c9a6";
const HAIR = "#d8d6d0";
const SCARF = "#a8202c";
const CAP = "#7b7f88";
const CAP_DARK = "#3f4249";

/**
 * Henning (`core/src/befrielsen.ts`), the old resistance man at the memorial, in 3D: a long wool coat, a red scarf,
 * a grey flat cap, a grey moustache and a cane in his right hand. Standing at the origin, facing +z, about 1.7 high.
 * `befrielsen3d.ts` places him and merges him in with the memorial.
 */
export function henningModel(): Model {
  const m = new Model();
  // Shoes and legs.
  for (const s of [-1, 1]) {
    m.box([0.15, 0.08, 0.26], "#2b2433", [s * 0.1, 0, 0.03], 0.02);
    m.box([0.14, 0.62, 0.16], TROUSERS, [s * 0.1, 0.08, 0], 0.03);
  }
  // The coat, a little wider at the hem.
  m.box([0.44, 0.2, 0.28], COAT_DARK, [0, 0.62, 0], 0.04);
  m.box([0.4, 0.5, 0.26], COAT, [0, 0.78, 0], 0.05);
  m.box([0.04, 0.6, 0.27], COAT_DARK, [0, 0.66, 0.002], 0.005);
  // Arms: the left hangs, the right holds the cane.
  m.box([0.1, 0.5, 0.12], COAT, [-0.26, 0.76, 0], 0.03);
  const arm = m.box([0.1, 0.46, 0.12], COAT, [0.26, 0.78, 0.04], 0.03);
  arm.rotation.x = -0.35;
  for (const x of [-0.26, 0.27]) m.ball(0.055, SKIN, [x, 0.74, x > 0 ? 0.17 : 0.02], [1, 1, 1], 8);
  // The cane.
  m.cyl(0.018, 0.86, "#6e4a2a", [0.28, 0, 0.2], 0.018, 6);
  m.ball(0.032, "#8d6a3e", [0.28, 0.86, 0.2], [1, 0.8, 1], 8);
  // The scarf and the head.
  m.cyl(0.14, 0.09, SCARF, [0, 1.25, 0], 0.15, 12);
  m.box([0.08, 0.2, 0.04], SCARF, [-0.06, 1.05, 0.14], 0.01);
  m.ball(0.17, SKIN, [0, 1.46, 0], [1, 1.08, 1], 14);
  m.ball(0.03, SKIN, [0, 1.43, 0.17], [1, 1, 1.1], 8);
  for (const s of [-1, 1]) {
    m.ball(0.022, "#2b2433", [s * 0.065, 1.5, 0.15], [1, 1, 0.6], 6);
    m.box([0.07, 0.02, 0.03], HAIR, [s * 0.065, 1.54, 0.155], 0.005);
    m.box([0.04, 0.12, 0.1], HAIR, [s * 0.17, 1.4, 0], 0.01);
  }
  m.box([0.14, 0.03, 0.04], HAIR, [0, 1.385, 0.165], 0.012);
  // The flat cap: a low wide crown and a short brim.
  m.ball(0.2, CAP, [0, 1.6, -0.01], [1.05, 0.5, 1.1], 14);
  m.cyl(0.18, 0.04, CAP_DARK, [0, 1.585, 0], 0.18, 14);
  m.box([0.26, 0.025, 0.12], CAP_DARK, [0, 1.585, 0.17], 0.01);
  return m;
}
