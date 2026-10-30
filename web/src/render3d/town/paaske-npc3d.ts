import type { FestiveNpc } from "@tokenmaxxing/core/festive.ts";
import type * as THREE from "three";
import { liveModel, type Model } from "../kit/kit.ts";

/**
 * Gudrun the egg farmer in the 3D town (`NPC_MODELS.paaske`, registered in `festive-npc3d.ts`): a grey-bunned farmer in a
 * straw hat, a red scarf and blue overalls over a cream shirt, with a basket of painted eggs on her hip and a
 * painted egg in her raised hand. Built from the kit (not an `Avatar`: the people's idle freezing merges what is
 * under a `nobatch` group into nothing). Her name is a label from `Paaske3d.signs`. She breathes, nods and turns
 * her head, about 1.6 units tall, facing +z.
 */
const SKIN = "#f1c9a5";
const SHIRT = "#f4efe4";
const DENIM = "#3b5a8a";
const DENIM_D = "#2e4870";
const SCARF = "#e8584f";
const STRAW = "#e8c970";
const STRAW_D = "#c9a24a";
const EGGS = ["#f4a6c8", "#9ccff2", "#f7e27a", "#a6dc92", "#c8aaf0"];

function head(m: Model): Model {
  const h = m.part([0, 1.1, 0]);
  h.box([0.32, 0.34, 0.3], SKIN, [0, -0.17, 0], 0.07);
  // Grey hair under the hat, a bun at the back.
  h.box([0.36, 0.16, 0.12], "#cfcfd6", [0, 0.0, -0.12], 0.05);
  h.box([0.1, 0.2, 0.3], "#cfcfd6", [-0.17, -0.12, -0.02], 0.03);
  h.box([0.1, 0.2, 0.3], "#cfcfd6", [0.17, -0.12, -0.02], 0.03);
  h.ball(0.1, "#cfcfd6", [0, 0.1, -0.2], [1, 1, 1], 10);
  // Face: eyes, rosy cheeks, a smile, little round glasses.
  for (const x of [-0.07, 0.07]) {
    h.box([0.05, 0.05, 0.02], "#2b2433", [x, -0.17, 0.152], 0.008);
    h.box([0.045, 0.03, 0.02], "#f19a8b", [x * 1.65, -0.24, 0.152], 0.008);
    h.box([0.09, 0.012, 0.012], "#8c5c36", [x, -0.125, 0.155], 0.004);
  }
  h.box([0.1, 0.02, 0.02], "#b4543a", [0, -0.27, 0.152], 0.008);
  h.box([0.05, 0.05, 0.04], "#e6aa86", [0, -0.2, 0.17], 0.01);
  // The straw hat: a wide brim, a dome, a red band.
  h.cyl(0.38, 0.035, STRAW, [0, 0.0, 0], 0.38, 18);
  h.cyl(0.25, 0.14, STRAW, [0, 0.03, 0], 0.2, 16);
  h.cyl(0.255, 0.04, SCARF, [0, 0.04, 0], 0.255, 16);
  h.cyl(0.38, 0.012, STRAW_D, [0, -0.005, 0], 0.38, 18);
  // A sprig of vintergæk in the band.
  h.cyl(0.006, 0.12, "#4f9b3d", [0.17, 0.04, 0.2], 0.006, 4);
  h.ball(0.025, "#fbf7ef", [0.17, 0.17, 0.2], [0.9, 1.2, 0.9], 6);
  return h;
}

export function gudrun3d(_npc: FestiveNpc): THREE.Object3D {
  const root = liveModel();
  const body = root.part();
  // Legs and boots.
  for (const x of [-0.1, 0.1]) {
    body.box([0.17, 0.5, 0.2], DENIM, [x, 0.1, 0], 0.03);
    body.box([0.19, 0.1, 0.3], "#5e3d28", [x, 0, 0.04], 0.03);
  }
  // Torso: cream shirt, overalls with a bib, straps and gold buttons.
  body.box([0.46, 0.56, 0.28], SHIRT, [0, 0.55, 0], 0.05);
  body.box([0.47, 0.26, 0.29], DENIM, [0, 0.5, 0], 0.04);
  body.box([0.32, 0.3, 0.04], DENIM_D, [0, 0.76, 0.14], 0.01);
  for (const x of [-0.12, 0.12]) {
    body.box([0.05, 0.28, 0.05], DENIM, [x, 0.84, 0.0], 0.01);
    body.ball(0.02, "#e9b73d", [x, 0.8, 0.165], [1, 1, 1], 5);
  }
  // The scarf.
  body.box([0.38, 0.1, 0.32], SCARF, [0, 1.0, 0], 0.04);
  body.box([0.07, 0.2, 0.05], SCARF, [0.12, 0.84, 0.15], 0.015);
  // The basket on her left hip, with painted eggs in it.
  const basket = body.part([-0.32, 0.4, 0.12]);
  basket.box([0.24, 0.14, 0.18], "#a8763c", [0, 0, 0], 0.025);
  basket.box([0.26, 0.025, 0.2], "#d49c67", [0, 0.13, 0], 0.01);
  EGGS.forEach((c, i) => {
    basket.ball(0.05, c, [-0.08 + i * 0.04, 0.2 + (i % 2) * 0.02, (i % 3) * 0.04 - 0.04], [1, 1.25, 1], 8);
  });
  // Arms: the left holds the basket, the right holds a painted egg up.
  const armL = body.part([-0.3, 0.98, 0]);
  armL.box([0.13, 0.46, 0.15], SHIRT, [0, -0.46, 0], 0.04);
  armL.box([0.11, 0.1, 0.12], SKIN, [0, -0.54, 0.03], 0.03);
  const armR = body.part([0.3, 0.98, 0]);
  armR.rotation.x = -1.1;
  armR.box([0.13, 0.46, 0.15], SHIRT, [0, -0.46, 0], 0.04);
  armR.box([0.11, 0.1, 0.12], SKIN, [0, -0.54, 0.03], 0.03);
  const egg = armR.part([0, -0.62, 0.06]);
  egg.ball(0.06, "#f4a6c8", [0, 0, 0], [1, 1.28, 1], 10);
  egg.box([0.125, 0.024, 0.125], "#fbf7ef", [0, -0.01, 0], 0.01);
  egg.box([0.1, 0.02, 0.1], "#f7e27a", [0, 0.05, 0], 0.01);
  const h = head(body);
  root.userData.tick = (t: number) => {
    body.scale.y = 1 + Math.sin(t * 1.9) * 0.008;
    h.rotation.y = Math.sin(t * 0.5) * 0.4;
    h.rotation.x = Math.sin(t * 0.9) * 0.05;
    armR.rotation.x = -1.1 + Math.sin(t * 1.3) * 0.12;
  };
  return root;
}
