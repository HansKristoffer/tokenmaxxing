/**
 * The Julemarked case and its key in 3D (`case-box3d.ts` picks these by case id): a matte red felt-and-wood gift chest
 * with a cream band, a green ribbon tied in a bow, woven paper hearts on the front, a gold clasp and a candle on the lid;
 * open, warm candle gold spills out with a few drifting sparks and tiny hearts. The key is a gold key with a woven paper
 * heart for a bow, hanging on a green ribbon. Same frame as the Night Market's: bottom centre at the origin, front along
 * +z, about 0.9 x 0.8 x 0.6. Design brief: docs/cases/julemarked.md.
 */
import * as THREE from "three";
import {
  JUL_CREAM,
  JUL_GOLD,
  JUL_GREEN,
  JUL_RED,
  paperHeart,
} from "./furniture/jul3d.ts";
import { glow, Model, tint } from "./kit/kit.ts";

const W = 0.9;
const D = 0.6;
const BODY_H = 0.46;
const LID_H = 0.2;
const WOOD_D = "#6e4526";
const GREEN_D = tint(JUL_GREEN, -0.18);

type Animator = (t: number) => void;
type Register = (m: Model, fn: Animator) => void;

/** A ribbon bow, facing +z at (x, y, z): two loops, a knot and two tails. */
function bow(p: Model, x: number, y: number, z: number, s: number): void {
  const b = p.part([x, y, z]);
  for (const sx of [-1, 1]) {
    const loop = b.ball(0.07 * s, JUL_GREEN, [sx * 0.07 * s, 0.03 * s, 0], [1.3, 1, 0.6], 8);
    loop.rotation.z = sx * 0.45;
    b.ball(0.04 * s, GREEN_D, [sx * 0.07 * s, 0.03 * s, 0.025 * s], [1.1, 0.8, 0.4], 6).rotation.z = sx * 0.45;
    const tail = b.box([0.04 * s, 0.14 * s, 0.014 * s], JUL_GREEN, [sx * 0.04 * s, -0.12 * s, 0.0], 0.003);
    tail.rotation.z = sx * 0.28;
  }
  b.ball(0.036 * s, GREEN_D, [0, 0.025 * s, 0.03 * s], [1, 1, 0.8], 6);
}

export function buildJulemarkedBox(open: boolean, register: Register): Model {
  const m = new Model();
  const front = D / 2;
  const lit = glow(JUL_GOLD);
  // A wooden plinth and the felt-red body, with a cream band round the middle and a stitched edge.
  m.box([W + 0.04, 0.05, D + 0.04], WOOD_D, [0, 0, 0], 0.012);
  m.box([W, BODY_H - 0.05, D], JUL_RED, [0, 0.05, 0], 0.01);
  m.box([W + 0.012, 0.09, D + 0.012], JUL_CREAM, [0, 0.19, 0], 0.01);
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 0.1;
    m.box([0.05, 0.016, 0.006], JUL_RED, [x, 0.23, front + 0.007], 0.001);
    m.box([0.05, 0.016, 0.006], JUL_RED, [x + 0.0, 0.2, front + 0.007], 0.001);
  }
  // The ribbon down the front and round the sides.
  m.box([0.1, BODY_H - 0.05, D + 0.014], JUL_GREEN, [0, 0.05, 0], 0.008);
  m.box([0.014, BODY_H - 0.05, D + 0.02], GREEN_D, [-0.05, 0.05, 0], 0.002);
  m.box([0.014, BODY_H - 0.05, D + 0.02], GREEN_D, [0.05, 0.05, 0], 0.002);
  // Woven paper hearts either side of the ribbon, and a pair of tiny gold stars above them.
  paperHeart(m, -0.26, 0.17, front + 0.012, 0.24, JUL_RED, JUL_CREAM);
  paperHeart(m, 0.26, 0.17, front + 0.012, 0.24, JUL_RED, JUL_CREAM);
  for (const x of [-0.37, 0.37]) m.ball(0.018, lit, [x, 0.36, front + 0.01], [1, 1, 0.5], 5);
  // The side face: one more heart.
  const flank = m.part([0, 0, 0], Math.PI / 2);
  paperHeart(flank, 0, 0.19, W / 2 + 0.012, 0.28, JUL_RED, JUL_CREAM);
  // A gold clasp on the ribbon and corner caps.
  m.box([0.09, 0.09, 0.02], JUL_GOLD, [0, 0.31, front + 0.012], 0.008);
  m.ball(0.018, "#8a6a1a", [0, 0.345, front + 0.026], [1, 1, 0.5], 5);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.box([0.05, 0.05, 0.05], JUL_GOLD, [sx * (W / 2 - 0.01), 0.0, sz * (front - 0.01)], 0.01);

  // The lid, hinged along the back top edge: a domed felt top with a cream rim, the ribbon over it and a bow.
  const hinge = m.part([0, BODY_H + 0.03, -D / 2]);
  const lid = hinge.part([0, 0, D / 2]);
  lid.box([W + 0.04, LID_H * 0.55, D + 0.04], JUL_RED, [0, 0, 0], 0.008);
  lid.box([W - 0.04, LID_H * 0.35, D - 0.08], tint(JUL_RED, 0.05), [0, LID_H * 0.55, 0], 0.008);
  lid.box([W - 0.2, 0.03, D - 0.2], tint(JUL_RED, 0.1), [0, LID_H * 0.9, 0], 0.012);
  lid.box([W + 0.052, 0.04, D + 0.052], JUL_CREAM, [0, 0, 0], 0.01);
  lid.box([0.1, LID_H * 0.55 + 0.008, D + 0.05], JUL_GREEN, [0, 0, 0], 0.008);
  lid.box([0.1, LID_H * 0.35 + 0.008, D - 0.06], JUL_GREEN, [0, LID_H * 0.55, 0], 0.008);
  lid.box([0.1, 0.034, D - 0.18], JUL_GREEN, [0, LID_H * 0.9, 0], 0.008);
  bow(lid, 0, LID_H * 0.9 + 0.02, 0, 1.1);
  // Snow-white cotton on the rim and a few paper hearts on the lid.
  for (const [x, z, r] of [
    [-0.32, 0.18, 0.06],
    [-0.24, 0.26, 0.04],
    [0.3, 0.2, 0.05],
  ] as const)
    lid.box([r * 2.4, r * 0.8, r * 1.8], "#ffffff", [x, LID_H * 0.9 + 0.015, z], 0.004);
  // The candle on the lid corner.
  const candleStand = lid.part([0.3, LID_H * 0.9, -0.06]);
  candleStand.box([0.1, 0.02, 0.1], JUL_GOLD, [0, 0, 0], 0.003);
  candleStand.box([0.05, 0.1, 0.05], JUL_CREAM, [0, 0.02, 0], 0.003);
  candleStand.box([0.006, 0.025, 0.006], "#2a2220", [0, 0.12, 0], 0.001);
  const fl = candleStand.ball(0.024, lit, [0, 0.168, 0], [0.8, 1.5, 0.8], 6);
  candleStand.ball(0.012, glow("#fff6d0"), [0, 0.158, 0], [0.7, 1.2, 0.7], 5);

  const motion: Animator[] = [];
  if (open) {
    hinge.rotation.x = -1.95;
    // The mouth: a pool of candle gold and a soft beam, and the inside of the lid lit.
    const mouth = glow(JUL_GOLD);
    m.box([W - 0.1, 0.02, D - 0.1], mouth, [0, BODY_H + 0.004, 0], 0.004);
    lid.box([W - 0.08, 0.012, D - 0.08], tint(JUL_CREAM, -0.04), [0, -0.006, 0], 0.004);
    const beamMat = new THREE.MeshBasicMaterial({
      color: "#ffd36a",
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const beam = m.cyl(0.32, 0.75, beamMat, [0, BODY_H + 0.01, 0], 0.17, 4);
    beam.rotation.y = Math.PI / 4;
    beam.scale.set(0.85, 1, 1.15);
    // Sparks of gold and tiny hearts drifting up.
    const sparks = Array.from({ length: 7 }, (_, i) =>
      m.box([0.022, 0.022, 0.022], glow(i % 3 ? JUL_GOLD : "#fff1c0"), [0, BODY_H, 0], 0.003),
    );
    const hearts = [JUL_RED, JUL_CREAM].map((c) => {
      const h = new Model();
      paperHeart(h, 0, 0, 0, 0.11, c, tint(c, 0.15));
      m.add(h);
      return h;
    });
    motion.push((t) => {
      const g = 0.5 + 0.5 * Math.sin(t * 2.4);
      mouth.color.set(tint(JUL_GOLD, -0.1 + 0.2 * g));
      beamMat.opacity = 0.22 + 0.07 * g;
      sparks.forEach((s, i) => {
        const u = (t * (0.5 + (i % 3) * 0.12) + i * 0.41) % 1;
        s.position.set(
          (i - 3) * 0.1 + Math.sin(u * 8 + i) * 0.04,
          BODY_H + 0.02 + u * 0.7,
          Math.cos(i * 2.1 + u * 5) * 0.12,
        );
        s.scale.setScalar(Math.max(0.01, 1 - u) * 1.2);
        s.rotation.set(u * 9, u * 7, 0);
      });
      hearts.forEach((h, i) => {
        const u = (t * 0.28 + i * 0.5) % 1;
        h.position.set((i ? 0.2 : -0.2) + Math.sin(u * 5 + i) * 0.08, BODY_H + 0.1 + u * 0.6, 0.12);
        h.scale.setScalar(Math.max(0.01, Math.sin(u * Math.PI)));
        h.rotation.z = Math.sin(u * 6 + i) * 0.4;
      });
    });
  }
  register(m, (t) => {
    fl.scale.set(0.8, 1.5 + 0.3 * Math.sin(t * 8), 0.8);
    for (const fn of motion) fn(t);
  });
  return m;
}

/** A gold key with a woven paper heart for a bow, hanging by a green ribbon tied in a bow; it turns slowly. */
export function buildJulemarkedKey(register: Register): Model {
  const m = new Model();
  const CENTRE = 0.3;
  const spin = m.part([0, CENTRE, 0]);
  const GOLD_D = "#b88a1f";
  const GOLD_L = "#ffe28a";
  // The shaft hangs down from the bow; the bit has two teeth. The lowest point is at -0.3 (so y = 0 once placed).
  spin.box([0.06, 0.4, 0.05], JUL_GOLD, [0, -0.3, 0], 0.012);
  spin.box([0.085, 0.03, 0.06], GOLD_D, [0, -0.1, 0], 0.008);
  spin.box([0.085, 0.03, 0.06], GOLD_D, [0, -0.06, 0], 0.008);
  for (const [y, w] of [
    [-0.3, 0.14],
    [-0.23, 0.1],
  ] as const)
    spin.box([w, 0.05, 0.05], JUL_GOLD, [w / 2 - 0.02, y, 0], 0.008);
  spin.box([0.02, 0.38, 0.012], GOLD_L, [-0.012, -0.29, 0.027], 0.002);
  // The bow: a gold ring holding a two-tone woven heart, in a gold rim.
  spin.box([0.11, 0.05, 0.07], GOLD_D, [0, 0.0, 0], 0.01);
  const heart = spin.part([0, 0.2, 0]);
  paperHeart(heart, 0, 0, 0.03, 0.42, JUL_RED, JUL_CREAM);
  const back = heart.part([0, 0, 0], Math.PI);
  paperHeart(back, 0, 0, 0.03, 0.42, JUL_CREAM, JUL_RED);
  heart.box([0.2, 0.02, 0.022], GOLD_L, [0, 0.0, 0.0], 0.004);
  // The ribbon: through the heart's notch, up in a loop, with a tiny bow.
  const strand = (a: [number, number], b: [number, number]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const s = spin.box([len + 0.012, 0.03, 0.03], JUL_GREEN, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.015, 0], 0.008);
    s.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const loop: [number, number][] = [
    [0, 0.37],
    [-0.08, 0.37],
    [-0.08, 0.7],
    [0, 0.7],
  ];
  for (const s of [-1, 1])
    for (let i = 0; i < loop.length - 1; i++)
      strand([s * loop[i]![0], loop[i]![1]], [s * loop[i + 1]![0], loop[i + 1]![1]]);
  bow(spin, 0, 0.36, 0.02, 0.55);
  spin.ball(0.016, JUL_GOLD, [0, 0.68, 0], [1, 1, 1], 5);
  register(m, (time) => {
    spin.rotation.y = time * 0.9;
    spin.position.y = CENTRE + 0.012 * Math.sin(time * 1.6);
  });
  return m;
}
