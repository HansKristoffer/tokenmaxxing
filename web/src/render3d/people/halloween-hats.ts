import { glow } from "../kit/kit.ts";
import type { Build } from "./gear3dHead.ts";

/**
 * Halloween's hats in 3D (`core/src/costumes.ts`, hat.230 to hat.233), keyed by item name and merged into `HAT_BUILDERS`
 * (`gear3dHead.ts`). Origin at the skull's centre, +z the face, the skull about 0.25 in radius. The 2D ones are
 * `art/halloween-hats.ts`. Imports only types from `gear3dHead.ts`, which imports this file.
 */
export const HALLOWEEN_HAT_BUILDERS: Record<string, Build> = {
  // A purple cone with a tip that flops over, an orange band with a gold buckle, on a wide brim.
  "Witch hat": (m) => {
    m.cyl(0.37, 0.03, "#2a1646", [0, 0.15, 0], 0.37, 24);
    m.cyl(0.235, 0.14, "#4b2a78", [0, 0.17, 0], 0.2, 20);
    m.cyl(0.2, 0.28, "#4b2a78", [0, 0.3, 0], 0.09, 18);
    const tip = m.part([0.01, 0.56, 0]);
    tip.cyl(0.09, 0.18, "#4b2a78", [0, 0, 0], 0.03, 12).rotation.z = -0.35;
    tip.cyl(0.04, 0.14, "#4b2a78", [-0.06, 0.15, 0], 0.005, 8).rotation.z = 0.9;
    m.cyl(0.222, 0.06, "#e8772a", [0, 0.2, 0], 0.213, 20);
    m.box([0.075, 0.075, 0.02], "#ffd04a", [0, 0.195, 0.222], 0.004);
    m.box([0.04, 0.04, 0.022], "#4b2a78", [0, 0.213, 0.223], 0.002);
  },
  // A white sheet over the whole head with two black eye holes and an "oooh", a wavy hem on the shoulders.
  "Ghost sheet": (m) => {
    const sheet = "#eef2ff";
    m.ball(0.34, sheet, [0, 0.0, 0], [1, 1.1, 1], 18);
    m.cyl(0.46, 0.5, sheet, [0, -0.62, 0], 0.32, 18);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      m.ball(0.09, sheet, [Math.cos(a) * 0.43, -0.6, Math.sin(a) * 0.43], [1, 1.2, 1], 7);
    }
    for (const x of [-0.095, 0.095]) m.ball(0.05, "#1b1f2a", [x, -0.05, 0.325], [1, 1.5, 0.45], 7);
    m.ball(0.045, "#1b1f2a", [0, -0.17, 0.32], [1, 1.4, 0.45], 7);
    // The shaded side.
    m.ball(0.2, "#b9c0e6", [0.17, -0.25, -0.1], [0.6, 1, 1], 8);
  },
  // A dark cap with two big pointed ears, a purple inside, and a tiny pair of red eyes on the band.
  "Bat ears": (m) => {
    m.ball(0.27, "#2b1a40", [0, 0.1, -0.01], [1, 0.62, 1], 16);
    for (const s of [-1, 1]) {
      const ear = m.part([s * 0.16, 0.22, 0]);
      ear.cyl(0.13, 0.42, "#14091f", [0, 0, 0], 0.005, 4).rotation.z = -s * 0.25;
      ear.cyl(0.08, 0.3, "#7a4aa8", [0, 0.02, 0.04], 0.004, 4).rotation.z = -s * 0.25;
      m.ball(0.014, glow("#ff3030"), [s * 0.07, 0.17, 0.25], [1, 1, 1], 5);
    }
  },
  // The sugar king's (never sold): a blocky orange pumpkin pail on the crown, a carved grin, a wire handle, heaped
  // with sweets in the four candy colours.
  "Candy bucket": (m) => {
    m.box([0.38, 0.24, 0.38], "#e8772a", [0, 0.16, 0], 0.02);
    m.box([0.4, 0.04, 0.4], "#c25a1c", [0, 0.38, 0], 0.01);
    for (const x of [-0.09, 0.09]) m.box([0.07, 0.06, 0.02], "#14091f", [x, 0.29, 0.19], 0.004);
    m.box([0.2, 0.035, 0.02], "#14091f", [0, 0.21, 0.19], 0.004);
    const sweets = ["#ff4fa3", "#ffe14a", "#4fd1ff", "#8a3b12"];
    for (const [i, [x, z]] of (
      [
        [-0.1, -0.08],
        [0.09, -0.1],
        [-0.07, 0.09],
        [0.1, 0.07],
        [0, 0],
      ] as const
    ).entries())
      m.box([0.1, 0.06, 0.1], sweets[i % sweets.length]!, [x, 0.41 + (i === 4 ? 0.04 : 0), z], 0.01);
    for (const s of [-1, 1]) m.box([0.025, 0.16, 0.025], "#9aa0a8", [s * 0.19, 0.4, 0], 0.004);
    m.box([0.405, 0.025, 0.025], "#9aa0a8", [0, 0.56, 0], 0.004);
  },
};
