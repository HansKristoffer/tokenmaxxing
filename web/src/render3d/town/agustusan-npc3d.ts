import * as THREE from "three";
import { Model } from "../kit/kit.ts";
import { HAT_BUILDERS } from "../people/gear3dHead.ts";
import type { NpcModel } from "./festive-npc3d.ts";

const RED = "#d8283a";
const WHITE = "#fbf7ef";
const SKIN = "#c68a5f";
const SHIRT = "#f4f1ea";
const TROUSERS = "#2f3a56";
const HAIR = "#8d8d98";
const INK = "#2b2433";

/**
 * Pak Budi, the RT (`AGUSTUSAN_NPC`), built from the kit like the other props: a white kemeja, dark trousers, grey at the
 * temples, the black peci (`HAT_BUILDERS["Peci hitam"]`, the same one the shop sells), a red-and-white sash across the chest
 * and the merah putih on a bamboo stick in his raised hand, waving. Built on the same look as his 2D sprite
 * (`art/agustusan-npc.ts`). About 1.4 tall, as the town's people are, facing +z.
 */
export const pakBudiModel: NpcModel = () => {
  const root = new THREE.Group();
  const m = new Model();
  root.add(m);
  for (const s of [-1, 1]) {
    m.box([0.15, 0.42, 0.16], TROUSERS, [s * 0.1, 0, 0], 0.02);
    m.box([0.16, 0.05, 0.22], INK, [s * 0.1, 0, 0.03], 0.01);
  }
  // The torso, the sash across it (shoulder to hip), and the other arm hanging.
  m.box([0.4, 0.42, 0.24], SHIRT, [0, 0.4, 0], 0.03);
  for (let i = 0; i < 4; i++) {
    const piece = m.box(
      [0.11, 0.1, 0.03],
      i % 2 ? WHITE : RED,
      [0.14 - i * 0.095, 0.7 - i * 0.1, 0.13],
      0.01,
    );
    piece.rotation.z = -0.85;
  }
  const arm = m.part([-0.27, 0.8, 0]);
  arm.box([0.1, 0.36, 0.11], SHIRT, [0, -0.36, 0], 0.02);
  arm.ball(0.06, SKIN, [0, -0.38, 0], [1, 1, 1], 8);
  // The head: grey at the temples, a face, and the peci on top.
  const head = m.part([0, 1.1, 0]);
  head.ball(0.27, SKIN, [0, 0, 0], [1, 1, 1], 18);
  for (const s of [-1, 1]) {
    head.box([0.06, 0.14, 0.2], HAIR, [s * 0.255, -0.14, -0.02], 0.01);
    head.box([0.045, 0.07, 0.03], INK, [s * 0.1, 0.0, 0.255], 0.004);
  }
  head.box([0.12, 0.03, 0.03], "#8c4a3a", [0, -0.12, 0.25], 0.004);
  HAT_BUILDERS["Peci hitam"]?.(head.part(), {
    skin: SKIN,
    hair: HAIR,
    outfit: [SHIRT, SHIRT],
    pants: TROUSERS,
    tick: () => {},
  });

  // The waving arm, with the flag held up on its stick.
  const wave = m.part([0.27, 0.8, 0]);
  wave.box([0.1, 0.36, 0.11], SHIRT, [0, -0.36, 0], 0.02);
  wave.ball(0.06, SKIN, [0, -0.38, 0], [1, 1, 1], 8);
  const stick = wave.part([0, -0.4, 0]);
  stick.box([0.035, 0.95, 0.035], "#c9a95a", [0, -0.1, 0], 0.01);
  stick.box([0.5, 0.17, 0.014], RED, [0.26, 0.5, 0], 0.003);
  stick.box([0.5, 0.17, 0.014], WHITE, [0.26, 0.33, 0], 0.003);
  stick.ball(0.045, "#f5c842", [0, 0.88, 0], [1, 1, 1], 8);
  // It all moves a little: the batching leaves it alone.
  root.traverse((o) => {
    o.userData.live = true;
  });

  root.userData.tick = (t: number) => {
    wave.rotation.z = -2.5 + Math.sin(t * 4) * 0.22;
    stick.rotation.z = Math.sin(t * 7) * 0.12;
    arm.rotation.z = Math.sin(t * 1.3) * 0.04;
    head.rotation.z = Math.sin(t * 1.7) * 0.05;
    m.position.y = Math.abs(Math.sin(t * 2)) * 0.012;
  };
  return root;
};
