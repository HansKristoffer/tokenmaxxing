/**
 * The Julemarked case and its key in 3D (`case-box3d.ts` picks these by case id): a matte red felt-and-wood gift chest
 * with a cream band, cross-stitching, a green ribbon tied in a big bow, woven paper hearts, a gold clasp with a
 * glowing keyhole, candlelight leaking through the seam and a pair of candles on the lid. Opened, it bursts: a flash
 * of candlelight, rays and a ring of light, gold sparks, woven hearts and snowflakes floating up. The key is a gold
 * key with a woven paper heart for a bow, hanging from a green ribbon, that gleams as it turns. Same frame as the
 * Night Market's: bottom centre at the origin, front along +z, about 0.9 x 0.8 x 0.6. Everything is sharp and blocky:
 * boxes and stepped boxes only. Design brief: docs/cases/julemarked.md.
 */
import * as THREE from "three";
import { JUL_CREAM, JUL_GOLD, JUL_GREEN, JUL_RED, paperHeart } from "./furniture/jul3d.ts";
import { glow, Model, tint } from "./kit/kit.ts";

const W = 0.9;
const D = 0.6;
const BODY_H = 0.46;
const LID_H = 0.2;
const WOOD = "#a06a3c";
const WOOD_D = "#6e4526";
const GREEN_D = tint(JUL_GREEN, -0.18);
const RED_D = "#8c2220";
const GOLD_L = "#ffe28a";
const GOLD_D = "#b88a1f";
const INK = "#2a2220";

type Animator = (t: number) => void;
type Register = (m: Model, fn: Animator) => void;

const smooth = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

/** A translucent glow (light, a ring, a beam). */
const haze = (color: string, opacity: number) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
const noShadow = <T extends THREE.Mesh>(m: T): T => {
  m.castShadow = m.receiveShadow = false;
  return m;
};

/** A ribbon bow facing +z at (x, y, z): two stepped loops, a knot and two tails. */
function bow(p: Model, x: number, y: number, z: number, s: number): void {
  const b = p.part([x, y, z]);
  for (const sx of [-1, 1]) {
    b.box([0.12 * s, 0.07 * s, 0.07 * s], JUL_GREEN, [sx * 0.08 * s, 0.0, 0], 0.003);
    b.box([0.1 * s, 0.1 * s, 0.07 * s], JUL_GREEN, [sx * 0.11 * s, 0.035 * s, 0], 0.003);
    b.box([0.05 * s, 0.07 * s, 0.075 * s], GREEN_D, [sx * 0.12 * s, 0.045 * s, 0], 0.003);
    const tail = b.box(
      [0.05 * s, 0.16 * s, 0.025 * s],
      JUL_GREEN,
      [sx * 0.05 * s, -0.12 * s, 0.03 * s],
      0.003,
    );
    tail.rotation.z = sx * 0.28;
    b.box([0.05 * s, 0.025 * s, 0.027 * s], GOLD_L, [sx * 0.065 * s, -0.255 * s, 0.03 * s], 0.001);
  }
  b.box([0.07 * s, 0.08 * s, 0.08 * s], GREEN_D, [0, -0.005 * s, 0.01 * s], 0.003);
  b.box([0.03 * s, 0.03 * s, 0.03 * s], JUL_GOLD, [0, 0.015 * s, 0.055 * s], 0.001);
}

/** A flame in three stacked glow blocks; returns the part to dance. */
function flameBlock(p: Model, x: number, y: number, z: number, r: number): Model {
  const f = p.part([x, y, z]);
  f.box([r * 1.7, r * 2.2, r * 1.7], glow("#f2a93a"), [0, -r * 0.2, 0], 0.001);
  f.box([r * 1.2, r * 2.8, r * 1.2], glow(JUL_GOLD), [0, -r * 0.1, 0], 0.001);
  f.box([r * 0.6, r * 1.5, r * 0.6], glow("#fff6d0"), [0, -r * 0.05, 0], 0.001);
  return f;
}

export function buildJulemarkedBox(open: boolean, register: Register): Model {
  const m = new Model();
  const front = D / 2;
  const mouth = glow(JUL_GOLD);
  const keyhole = glow(GOLD_L);
  const seam = glow(JUL_GOLD);
  // A wooden plinth with gold feet, and the felt-red body with cross-stitching top and bottom.
  m.box([W + 0.06, 0.04, D + 0.06], WOOD_D, [0, 0.012, 0], 0.006);
  m.box([W + 0.02, 0.025, D + 0.02], WOOD, [0, 0.05, 0], 0.004);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      m.box([0.07, 0.04, 0.07], JUL_GOLD, [sx * (W / 2 + 0.01), 0, sz * (front + 0.01)], 0.004);
  m.box([W, BODY_H - 0.07, D], JUL_RED, [0, 0.07, 0], 0.006);
  m.box([W + 0.014, 0.1, D + 0.014], JUL_CREAM, [0, 0.19, 0], 0.006);
  for (let i = 0; i < 10; i++) {
    const x = (i - 4.5) * 0.09;
    for (const y of [0.205, 0.255])
      m.box([0.04, 0.014, 0.008], i % 2 ? JUL_RED : RED_D, [x, y, front + 0.009], 0.001);
    m.box([0.04, 0.014, 0.008], RED_D, [x, 0.1, front + 0.006], 0.001);
    m.box([0.04, 0.014, 0.008], RED_D, [x, 0.4, front + 0.006], 0.001);
  }
  // The ribbon down the front and round the sides, with a column of gold pixel stars on it.
  m.box([0.12, BODY_H - 0.07, D + 0.02], JUL_GREEN, [0, 0.07, 0], 0.004);
  m.box([0.014, BODY_H - 0.07, D + 0.028], GREEN_D, [-0.063, 0.07, 0], 0.002);
  m.box([0.014, BODY_H - 0.07, D + 0.028], GREEN_D, [0.063, 0.07, 0], 0.002);
  for (const y of [0.1, 0.15]) {
    m.box([0.02, 0.02, 0.01], GOLD_L, [0, y, front + 0.016], 0.001);
    m.box([0.05, 0.012, 0.01], GOLD_L, [0, y + 0.004, front + 0.016], 0.001);
  }
  // Woven paper hearts either side of the ribbon, big and rich, and glowing gold stars on the band above them.
  paperHeart(m, -0.26, 0.2, front + 0.016, 0.26, JUL_RED, JUL_CREAM);
  paperHeart(m, 0.26, 0.2, front + 0.016, 0.26, JUL_CREAM, JUL_RED);
  for (const x of [-0.39, 0.39]) {
    m.box([0.05, 0.016, 0.012], mouth, [x, 0.375, front + 0.012], 0.001);
    m.box([0.016, 0.05, 0.012], mouth, [x, 0.358, front + 0.012], 0.001);
  }
  // Both sides: a heart, and the back one more.
  for (const [turn, hx] of [
    [Math.PI / 2, W / 2],
    [-Math.PI / 2, W / 2],
    [Math.PI, front],
  ] as const) {
    const flank = m.part([0, 0, 0], turn);
    paperHeart(flank, 0, 0.2, hx + 0.016, 0.28, JUL_RED, JUL_CREAM);
  }
  // The clasp: a gold plate on the ribbon, a glowing keyhole in it.
  m.box([0.11, 0.12, 0.024], JUL_GOLD, [0, 0.3, front + 0.014], 0.004);
  m.box([0.13, 0.014, 0.026], GOLD_D, [0, 0.296, front + 0.014], 0.001);
  m.box([0.03, 0.03, 0.012], keyhole, [0, 0.358, front + 0.03], 0.001);
  m.box([0.014, 0.05, 0.012], keyhole, [0, 0.31, front + 0.03], 0.001);
  // Gold corner caps in L steps.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      m.box([0.06, 0.12, 0.06], JUL_GOLD, [sx * (W / 2 - 0.02), 0.07, sz * (front - 0.02)], 0.004);
      m.box([0.04, 0.04, 0.04], GOLD_L, [sx * (W / 2 - 0.02), 0.19, sz * (front - 0.02)], 0.002);
    }
  // The slit of candlelight between the body and the lid.
  m.box([W - 0.02, 0.04, D - 0.02], seam, [0, BODY_H - 0.012, 0], 0.001);

  // The lid, hinged along the back top edge: stepped felt, a cream rim, ribbon over it, a big bow, snow and candles.
  const hinge = m.part([0, BODY_H + 0.03, -D / 2]);
  const lid = hinge.part([0, 0, D / 2]);
  lid.box([W + 0.04, LID_H * 0.5, D + 0.04], JUL_RED, [0, 0, 0], 0.006);
  lid.box([W - 0.04, LID_H * 0.35, D - 0.08], tint(JUL_RED, 0.05), [0, LID_H * 0.5, 0], 0.006);
  lid.box([W - 0.2, 0.04, D - 0.2], tint(JUL_RED, 0.1), [0, LID_H * 0.85, 0], 0.006);
  lid.box([W + 0.054, 0.045, D + 0.054], JUL_CREAM, [0, 0, 0], 0.006);
  for (let i = 0; i < 10; i++)
    lid.box([0.04, 0.012, 0.008], i % 2 ? JUL_RED : RED_D, [(i - 4.5) * 0.09, 0.025, D / 2 + 0.031], 0.001);
  lid.box([0.12, LID_H * 0.5 + 0.008, D + 0.05], JUL_GREEN, [0, 0, 0], 0.004);
  lid.box([0.12, LID_H * 0.35 + 0.008, D - 0.07], JUL_GREEN, [0, LID_H * 0.5, 0], 0.004);
  lid.box([0.12, 0.044, D - 0.17], JUL_GREEN, [0, LID_H * 0.85, 0], 0.004);
  bow(lid, 0, LID_H * 0.85 + 0.05, 0.04, 1.5);
  // Snow-white cotton drifts, tiny gold stars and fir sprigs with berries on the lid.
  for (const [x, z, r] of [
    [-0.33, 0.12, 0.07],
    [-0.25, 0.24, 0.05],
    [0.18, 0.2, 0.06],
    [-0.36, -0.12, 0.05],
  ] as const) {
    lid.box([r * 2.4, r * 0.9, r * 1.8], "#ffffff", [x, LID_H * 0.85 + 0.03, z], 0.004);
    lid.box([r * 1.4, r * 0.7, r * 1.1], "#ffffff", [x + r * 0.2, LID_H * 0.85 + 0.075, z], 0.003);
  }
  for (const [x, z, k] of [
    [-0.18, 0.1, 0.4],
    [0.3, -0.12, 1.4],
  ] as const) {
    const sp = lid.part([x, LID_H * 0.85 + 0.04, z], k);
    sp.box([0.12, 0.03, 0.06], JUL_GREEN, [0, 0, 0], 0.001);
    sp.box([0.08, 0.03, 0.08], tint(JUL_GREEN, 0.15), [0.01, 0.025, 0], 0.001);
    sp.box([0.028, 0.028, 0.028], JUL_RED, [0.04, 0.045, 0.03], 0.001);
    sp.box([0.028, 0.028, 0.028], JUL_RED, [-0.03, 0.04, 0.0], 0.001);
  }
  // Two candles on the right of the lid, one taller, in gold cups, with dancing flames.
  const flames: { f: Model; ph: number }[] = [];
  for (const [x, z, h, ph] of [
    [0.3, 0.0, 0.14, 0],
    [0.3, -0.13, 0.1, 2.2],
  ] as const) {
    const st = lid.part([x, LID_H * 0.85 + 0.04, z]);
    st.box([0.1, 0.03, 0.1], JUL_GOLD, [0, 0, 0], 0.003);
    st.box([0.07, 0.015, 0.07], GOLD_L, [0, 0.03, 0], 0.002);
    st.box([0.052, h, 0.052], JUL_CREAM, [0, 0.03, 0], 0.003);
    st.box([0.056, 0.02, 0.056], JUL_RED, [0, 0.03 + h * 0.5, 0], 0.001);
    st.box([0.008, 0.026, 0.008], INK, [0, 0.03 + h, 0], 0.001);
    flames.push({ f: flameBlock(st, 0, 0.03 + h + 0.085, 0, 0.032), ph });
  }
  // A glow pool and a warm halo on the lid round the candles.
  const lidPool = haze("#ffd36a", 0.3);
  noShadow(lid.box([0.34, 0.004, 0.3], lidPool, [0.3, LID_H * 0.85 + 0.042, -0.07], 0));
  // The pool of candlelight on the floor round the chest.
  const floorPool = haze("#ffd36a", 0.1);
  noShadow(m.box([W + 0.5, 0.004, D + 0.5], floorPool, [0, 0.003, 0], 0));
  const floorPool2 = haze("#ffd36a", 0.18);
  noShadow(m.box([W + 0.22, 0.004, D + 0.22], floorPool2, [0, 0.005, 0], 0));

  const motion: Animator[] = [];
  if (open) {
    hinge.rotation.x = -1.95;
    // The mouth: a mound of glowing gold gifts inside with the inside of the lid lit, and a beam of stepped light.
    m.box([W - 0.1, 0.02, D - 0.1], mouth, [0, BODY_H + 0.004, 0], 0.001);
    for (const [x, z, w, h] of [
      [-0.22, 0.05, 0.2, 0.06],
      [0.15, -0.05, 0.24, 0.08],
      [0.0, 0.1, 0.16, 0.05],
    ] as const)
      m.box([w, h, w * 0.8], glow(h > 0.06 ? GOLD_L : "#fff6d0"), [x, BODY_H + 0.01, z], 0.003);
    lid.box([W - 0.08, 0.012, D - 0.08], glow(tint(JUL_CREAM, -0.04)), [0, -0.006, 0], 0.004);
    const beams = [0, 1].map((i) => {
      const mat = haze("#ffe9a0", 0.16 - i * 0.025);
      const sz = 0.4 + i * 0.22;
      noShadow(m.box([sz * 1.3, 0.3, sz * 0.8], mat, [0, BODY_H + 0.015 + i * 0.3, 0], 0));
      return mat;
    });
    // Rays of light fanned out of the mouth, thin slabs leaning away.
    const rays = Array.from({ length: 8 }, (_, i) => {
      const mat = haze(i % 2 ? "#fff1c0" : "#ffe08a", 0.4);
      const turn = m.part([0, BODY_H + 0.02, 0], (i / 8) * Math.PI * 2);
      const pivot = turn.part([0, 0, 0.05]);
      const r = pivot.box([0.06, 0.02, 0.5], mat, [0, 0, 0], 0);
      noShadow(r);
      return { pivot, mat, r };
    });
    // The burst: two square rings of light that expand and fade.
    const rings = [0, 1].map(() => {
      const mat = haze("#fff1c0", 0.5);
      const g = m.part([0, BODY_H + 0.03, 0]);
      for (const [w, d, x, z] of [
        [1, 0.06, 0, 0.47],
        [1, 0.06, 0, -0.47],
        [0.06, 1, 0.47, 0],
        [0.06, 1, -0.47, 0],
      ] as const)
        noShadow(g.box([w, 0.02, d], mat, [x * 0.5, 0, z * 0.5], 0));
      return { g, mat };
    });
    // Sparks of gold and cream that fly out and fall, and tiny glowing stars.
    const sparks = Array.from({ length: 14 }, (_, i) =>
      m.box([0.026, 0.026, 0.026], glow(i % 3 ? JUL_GOLD : "#fff1c0"), [0, BODY_H, 0], 0.001),
    );
    // Woven hearts floating up, two in red-on-cream and two cream-on-red.
    const hearts = [0, 1, 2, 3].map((i) => {
      const h = new Model();
      paperHeart(h, 0, 0, 0, 0.14, i % 2 ? JUL_CREAM : JUL_RED, i % 2 ? JUL_RED : JUL_CREAM);
      m.add(h);
      return h;
    });
    // Snowflakes: a plus and a cross of white blocks that tumble up and away.
    const flakes = Array.from({ length: 10 }, (_, i) => {
      const f = new Model();
      const mat = glow(i % 2 ? "#ffffff" : "#dff1ff");
      f.box([0.07, 0.014, 0.014], mat, [0, -0.007, 0], 0.001);
      f.box([0.014, 0.07, 0.014], mat, [0, -0.035, 0], 0.001);
      for (const k of [-1, 1]) {
        const d = f.box([0.014, 0.07, 0.014], mat, [0, 0, 0], 0.001);
        d.geometry = d.geometry.clone();
        d.geometry.translate(0, -0.035, 0);
        d.rotation.z = (k * Math.PI) / 4;
      }
      m.add(f);
      return f;
    });
    const mouthA = new THREE.Color(JUL_GOLD);
    const mouthB = new THREE.Color("#fff6d0");
    const CYCLE = 4.2;
    motion.push((t) => {
      const ph = t % CYCLE;
      // The burst is a flash that decays over the first second and a half of each cycle, then a soft glow.
      const burst = Math.exp(-ph * 2.4);
      const g = 0.5 + 0.5 * Math.sin(t * 2.4);
      mouth.color.copy(mouthA).lerp(mouthB, 0.15 + 0.2 * g + 0.65 * burst);
      beams.forEach((b, i) => {
        b.opacity = (0.1 - i * 0.015 + 0.03 * g) * (0.7 + 2.2 * burst);
      });
      rays.forEach(({ pivot, mat, r }, i) => {
        pivot.rotation.x = -0.75 - 0.12 * Math.sin(t * 1.2 + i) - 0.2 * burst;
        r.scale.set(1, 1, 0.5 + 1.1 * burst + 0.12 * Math.sin(t * 3 + i * 1.3));
        mat.opacity = 0.08 + 0.5 * burst;
      });
      rings.forEach(({ g: ring, mat }, i) => {
        const u = (ph - i * 0.25) / 1.4;
        const on = u > 0 && u < 1;
        ring.visible = on;
        if (on) {
          const s = 0.55 + 1.0 * (1 - (1 - u) ** 2);
          ring.scale.set(s, 1, s);
          ring.position.y = BODY_H + 0.03 + 0.5 * u;
          mat.opacity = 0.6 * (1 - u);
        }
      });
      sparks.forEach((s, i) => {
        const u = ((ph - (i % 5) * 0.04) / 2.4) % 1;
        const a = i * 2.4;
        const v = 0.35 + (i % 4) * 0.12;
        const u2 = Math.max(0, u);
        s.position.set(
          Math.cos(a) * v * u2 * 1.1,
          BODY_H + 0.02 + (1.6 * u2 - 1.6 * u2 * u2) * v * 1.6 * 0.5 + u2 * 0.1,
          Math.sin(a) * v * u2 * 0.7,
        );
        s.scale.setScalar(Math.max(0.01, 1 - u2) * (1.1 + (i % 3) * 0.4));
        s.rotation.set(u * 9, u * 7, 0);
      });
      hearts.forEach((h, i) => {
        const u = (t * 0.22 + i * 0.25 + 0.05) % 1;
        h.position.set(
          ((i % 2) * 2 - 1) * (0.15 + 0.1 * (i >> 1)) + Math.sin(u * 5 + i) * 0.08,
          BODY_H + 0.12 + u * 0.78,
          0.1 + (i >> 1) * 0.1,
        );
        h.scale.setScalar(Math.max(0.01, Math.sin(u * Math.PI) ** 0.7) * 1.3);
        h.rotation.z = Math.sin(u * 6 + i) * 0.35;
        h.rotation.y = Math.sin(u * 3 + i) * 0.5;
      });
      flakes.forEach((f, i) => {
        const u = (t * (0.16 + (i % 3) * 0.04) + i * 0.173) % 1;
        f.position.set(
          Math.sin(i * 1.7) * 0.4 + Math.sin(u * 7 + i) * 0.06,
          BODY_H + 0.05 + u * 0.95,
          Math.cos(i * 2.3) * 0.22,
        );
        f.scale.setScalar(Math.max(0.01, Math.sin(u * Math.PI)) * (1 + (i % 3) * 0.3));
        f.rotation.z = u * 3 + i;
        f.rotation.y = u * 2;
      });
    });
  }
  register(m, (t) => {
    const g = 0.5 + 0.5 * Math.sin(t * 2.4);
    flames.forEach(({ f, ph }) => {
      const w = Math.sin(t * 9 + ph) + 0.6 * Math.sin(t * 15.7 + ph * 2);
      f.scale.set(1 - 0.06 * w, 1.05 + 0.18 * w, 1 - 0.06 * w);
      f.rotation.z = 0.12 * Math.sin(t * 6.3 + ph) + 0.04 * w;
    });
    lidPool.opacity = 0.24 + 0.08 * Math.sin(t * 7.1) * Math.sin(t * 3.3);
    floorPool.opacity = (open ? 0.06 : 0.035) + 0.02 * g;
    floorPool2.opacity = (open ? 0.07 : 0.04) + 0.02 * g;
    keyhole.color.set(tint(GOLD_L, -0.08 + 0.18 * g));
    if (!open) seam.color.set(tint(JUL_GOLD, -0.1 + 0.25 * (0.5 + 0.5 * Math.sin(t * 3.1))));
    else seam.color.set(JUL_GOLD);
    for (const fn of motion) fn(t);
  });
  return m;
}

/** A gold key with a woven paper heart for a bow, hanging by a green ribbon tied in a bow; it turns slowly and gleams. */
export function buildJulemarkedKey(register: Register): Model {
  const m = new Model();
  const CENTRE = 0.3;
  const spin = m.part([0, CENTRE, 0]);
  const shine = glow("#ffffff");
  const pulse = glow(GOLD_L);
  // The shaft hangs down from the bow: stepped collars, a ridge of gold, and a bit with two heart-notched teeth.
  spin.box([0.075, 0.4, 0.06], JUL_GOLD, [0, -0.3, 0], 0.004);
  spin.box([0.02, 0.38, 0.012], GOLD_L, [-0.012, -0.29, 0.027], 0.002);
  spin.box([0.02, 0.38, 0.012], GOLD_D, [0.02, -0.29, -0.027], 0.002);
  for (const y of [-0.1, -0.06, -0.015])
    spin.box([0.095, 0.022, 0.07], y > -0.03 ? GOLD_L : GOLD_D, [0, y, 0], 0.004);
  for (const [y, w, h] of [
    [-0.3, 0.17, 0.05],
    [-0.235, 0.12, 0.05],
    [-0.18, 0.08, 0.03],
  ] as const) {
    spin.box([w, h, 0.05], JUL_GOLD, [w / 2 - 0.02, y, 0], 0.004);
    spin.box([w - 0.02, 0.012, 0.052], GOLD_L, [w / 2 - 0.02, y + h - 0.012, 0], 0.001);
  }
  spin.box([0.03, 0.03, 0.054], JUL_RED, [0.05, -0.285, 0], 0.001);
  // The bow: a stepped gold frame behind a big two-tone woven heart (the same on both faces).
  const heart = spin.part([0, 0.27, 0]);
  paperHeart(heart, 0, 0, 0.03, 0.46, JUL_RED, JUL_CREAM);
  const back = heart.part([0, 0, 0], Math.PI);
  paperHeart(back, 0, 0, 0.03, 0.46, JUL_CREAM, JUL_RED);
  // The hinge between heart and shaft, and a gem.
  spin.box([0.12, 0.05, 0.08], GOLD_D, [0, 0.0, 0], 0.004);
  spin.box([0.07, 0.03, 0.084], GOLD_L, [0, 0.02, 0], 0.002);
  heart.box([0.04, 0.04, 0.012], pulse, [0, 0.03, 0.048], 0.001);
  // The ribbon: a loop of green blocks through the heart's notch, and a little bow.
  spin.box([0.04, 0.26, 0.03], JUL_GREEN, [-0.09, 0.42, 0], 0.003);
  spin.box([0.04, 0.26, 0.03], JUL_GREEN, [0.09, 0.42, 0], 0.003);
  spin.box([0.22, 0.04, 0.03], JUL_GREEN, [0, 0.66, 0], 0.003);
  spin.box([0.22, 0.03, 0.034], GREEN_D, [0, 0.42, 0], 0.003);
  bow(spin, 0, 0.47, 0.03, 0.55);
  spin.box([0.035, 0.035, 0.035], JUL_GOLD, [0, 0.64, 0], 0.001);
  // The gleam: a bright bar that sweeps up the shaft and across the heart, and a sparkle cross that blinks.
  const sweep = spin.box([0.07, 0.02, 0.058], shine, [0, -0.3, 0], 0.001);
  const sparkle = new Model();
  for (const [w, h] of [
    [0.16, 0.024],
    [0.024, 0.16],
  ] as const)
    sparkle.box([w, h, 0.02], shine, [0, -h / 2, 0], 0.001);
  sparkle.box([0.05, 0.05, 0.02], glow("#fff6c8"), [0, -0.025, 0], 0.001);
  sparkle.position.set(-0.17, 0.5, 0.07);
  spin.add(sparkle);
  // Gold motes that circle the key.
  const motes = Array.from({ length: 5 }, (_, i) =>
    m.box([0.03, 0.03, 0.03], glow(i % 2 ? JUL_GOLD : GOLD_L), [0, 0, 0], 0.001),
  );
  register(m, (time) => {
    spin.rotation.y = time * 0.9;
    spin.position.y = CENTRE + 0.014 * Math.sin(time * 1.6);
    const c = (time % 2.6) / 2.6;
    const u = smooth(c / 0.5);
    sweep.position.y = -0.3 + u * 0.36;
    sweep.visible = c < 0.5;
    sweep.scale.set(1, 1, 1);
    const sp = Math.max(0, Math.sin(((c - 0.45) / 0.45) * Math.PI));
    sparkle.visible = c > 0.45 && c < 0.9;
    sparkle.scale.setScalar(Math.max(0.01, sp) * 1.3);
    sparkle.rotation.z = c * 3;
    shine.color.set(tint("#ffffff", -0.05 * Math.sin(time * 9)));
    pulse.color.set(tint(GOLD_L, -0.15 + 0.3 * (0.5 + 0.5 * Math.sin(time * 3.4))));
    motes.forEach((mt, i) => {
      const a = time * 1.3 + (i / 5) * Math.PI * 2;
      mt.position.set(
        Math.cos(a) * 0.36,
        CENTRE + 0.2 + Math.sin(time * 1.9 + i * 1.7) * 0.2,
        Math.sin(a) * 0.36,
      );
      mt.scale.setScalar(0.6 + 0.6 * Math.max(0, Math.sin(time * 4 + i * 2.1)));
      mt.rotation.set(a, a * 0.7, 0);
    });
  });
  return m;
}
