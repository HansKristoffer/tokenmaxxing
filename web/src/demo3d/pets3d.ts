/**
 * Pets in 3D: every look of every pet in the 2D game (`web/src/art/pet-variants/*`, `art/pets.ts`,
 * `art/loot.ts`), built from the kit's boxes and balls with the colours of the 2D palettes, plus the
 * Easter-egg costumes (Penny, Nemo), pet gear, the Lv50 crown, a sitting and a sleeping pose
 * (`art/pet-sleep.ts`) and the pet bed (tile Q). Additive to `avatar.ts`'s `Pet`: a `Pet3D` has the same
 * `root` / `moving` / `update(t)`, so it can stand in for one.
 */
import * as THREE from "three";
import { C } from "../art/palette.ts";
import { PET_NAME, PET_NAMED, PET_SPECIES, PET_VARIANTS, PETWEAR, type Species } from "./data/pets.ts";
import { type Asset, light } from "./furniture.ts";
import {
  checker,
  glass,
  glow,
  Model,
  type Paint,
  painted,
  tint,
  toon,
  type V3,
} from "./kit.ts";

export type { Species } from "./data/pets.ts";
export type PetPose = "stand" | "sit" | "sleep";

type Mesh = THREE.Mesh;
const SIDES = [-1, 1] as const;
const INK = C.ink;

/** What a builder hands back: the moving parts and where gear goes. */
interface Rig {
  head: Model;
  /** Squashed shut when asleep. */
  eyes: Mesh[];
  fore: Mesh[];
  hind: Mesh[];
  tails: THREE.Object3D[];
  /** Gear anchors, in the head's own space: the neck's middle (and its radius) and the top of the head. */
  neck: V3;
  neckR: number;
  top: V3;
  /** Quadrupeds sit back on their haunches; the rest just settle. */
  tilt: boolean;
  /** Hover height for the ones that float. */
  float?: number;
  /** Hip-to-nose length, to centre the pet on its tile. */
  span: number;
  /** Own animation (flames, fins, props). */
  fx?: (t: number, moving: boolean) => void;
}

const eyeBall = (m: Model, at: V3, color: string = INK, r = 0.02): Mesh => {
  const e = m.ball(r, color, at, [1, 1.2, 0.5], 8);
  e.userData.sy = 1.2;
  return e;
};

// MARK: Four-legged pets (cat, dog, panda, forked cat, red panda)

interface Quad {
  len: number;
  bw: number;
  bh: number;
  legH: number;
  legW: number;
  /** Head radius. */
  hr: number;
  body: string;
  head?: string;
  leg?: string;
  paw?: string;
  ear: "point" | "big" | "bat" | "floppy" | "round" | "none";
  earC: string;
  earIn?: string;
  snout?: { c: string; w: number; l: number };
  nose: string;
  eye: string;
  tongue?: string;
  tail: "cat" | "curl" | "stub" | "thick" | "pom" | "thin" | "fork" | "ring" | "none";
  tailC: string;
  tailC2?: string;
  /** Anything breed-specific, drawn last: `by` is the torso's bottom, `cy`/`cz` the head ball's centre. */
  more?: (c: { b: Model; f: Model; head: Model; by: number; cy: number; cz: number; q: Quad }) => void;
}

function quad(b: Model, f: Model, q: Quad): Rig {
  const { len, bw, bh, legH, legW, hr } = q;
  const by = legH * 0.85;
  b.box([bw, bh, len + 0.12], q.body, [0, by, len / 2], Math.min(0.07, bh / 2.2));
  const fore: Mesh[] = [];
  const hind: Mesh[] = [];
  for (const s of SIDES)
    for (const [group, list, z] of [
      [b, hind, 0],
      [f, fore, len],
    ] as const) {
      const x = s * (bw / 2 - legW * 0.6);
      const leg = group.box([legW, legH, legW], q.leg ?? q.body, [x, 0, z], 0.02);
      list.push(leg);
      if (q.paw) {
        const paw = group.box([legW + 0.006, 0.03, legW + 0.012], q.paw, [x, 0, z + 0.004], 0.012);
        paw.userData.paw = true;
        list.push(paw);
      }
    }
  // The head turns on its neck.
  const head = b.part([0, by + bh * 0.72, len + 0.04]);
  const cy = hr * 0.45;
  const cz = hr * 0.55;
  head.ball(hr, q.head ?? q.body, [0, cy, cz], [1.08, 0.97, 1]);
  const earAt = (s: number, y: number): V3 => [s * hr * 0.58, cy + hr * y, cz - hr * 0.1];
  for (const s of SIDES) {
    switch (q.ear) {
      case "point":
      case "big": {
        const k = q.ear === "big" ? 1.5 : 1;
        head.cyl(hr * 0.38 * k, hr * 0.68 * k, q.earC, earAt(s, 0.7), 0.003, 4).rotation.z = -s * 0.3;
        if (q.earIn)
          head.cyl(
            hr * 0.2 * k,
            hr * 0.4 * k,
            q.earIn,
            earAt(s, 0.74).map((v, i) => (i === 2 ? v + hr * 0.08 : v)) as V3,
            0.002,
            4,
          ).rotation.z = -s * 0.3;
        break;
      }
      case "bat": {
        head.cyl(hr * 0.5, hr * 0.95, q.earC, earAt(s, 0.65), 0.01, 4).rotation.z = -s * 0.12;
        if (q.earIn)
          head.cyl(
            hr * 0.28,
            hr * 0.6,
            q.earIn,
            [s * hr * 0.58, cy + hr * 0.72, cz - hr * 0.02],
            0.005,
            4,
          ).rotation.z = -s * 0.12;
        break;
      }
      case "floppy":
        head.box(
          [hr * 0.22, hr * 0.8, hr * 0.5],
          q.earC,
          [s * hr * 0.98, cy - hr * 0.3, cz - hr * 0.1],
          0.025,
        ).rotation.z = s * 0.22;
        break;
      case "round":
        head.ball(hr * 0.36, q.earC, earAt(s, 0.78), [1, 1, 0.6], 10);
        break;
      case "none":
        break;
    }
  }
  const eyes: Mesh[] = [];
  for (const s of SIDES)
    eyes.push(eyeBall(head, [s * hr * 0.42, cy + hr * 0.2, cz + hr * 0.86], q.eye, hr * 0.17));
  if (q.snout) {
    const { c, w, l } = q.snout;
    head.box([hr * w, hr * 0.5, hr * l], c, [0, cy - hr * 0.62, cz + hr * (0.82 - l * 0.35)], hr * 0.2);
    head.ball(hr * 0.2, q.nose, [0, cy - hr * 0.2, cz + hr * (0.82 + l * 0.38)], [1.1, 0.8, 0.8], 8);
  } else head.ball(hr * 0.14, q.nose, [0, cy - hr * 0.22, cz + hr * 0.92], [1.1, 0.8, 0.7], 8);
  if (q.tongue)
    head.box([hr * 0.22, hr * 0.06, hr * 0.3], q.tongue, [0, cy - hr * 0.82, cz + hr * 0.95], 0.01);
  // The tail.
  const tails: THREE.Object3D[] = [];
  const tailMat = q.tailC;
  const ty = by + bh * 0.8;
  const mk = (x = 0): Model => {
    const t = b.part([x, ty, -0.05]);
    tails.push(t);
    return t;
  };
  switch (q.tail) {
    case "cat":
      mk().cyl(0.025, 0.2, tailMat, [0, 0, 0], 0.02, 6).rotation.x = -0.85;
      break;
    case "thin":
      mk().cyl(0.014, 0.28, tailMat, [0, 0, 0], 0.008, 6).rotation.x = -0.45;
      break;
    case "fork":
      for (const s of SIDES) {
        const t = mk(s * 0.035);
        t.cyl(0.024, 0.26, s < 0 ? tailMat : (q.tailC2 ?? tailMat), [0, 0, 0], 0.016, 6).rotation.set(
          -0.55,
          0,
          s * 0.35,
        );
      }
      break;
    case "curl": {
      const t = mk();
      t.ball(0.045, tailMat, [0, 0.06, -0.03], [0.8, 1, 0.8], 8);
      t.ball(0.03, tailMat, [0, 0.12, -0.01], [0.8, 1, 0.8], 8);
      break;
    }
    case "stub":
      mk().ball(0.03, tailMat, [0, 0.02, -0.01], [1, 1, 1], 8);
      break;
    case "thick":
      mk().cyl(0.045, 0.2, tailMat, [0, 0, 0], 0.03, 8).rotation.x = -0.9;
      break;
    case "pom": {
      const t = mk();
      t.cyl(0.015, 0.1, tailMat, [0, 0, 0], 0.012, 6).rotation.x = -0.6;
      t.ball(0.055, tailMat, [0, 0.1, -0.08], [1, 1, 1], 10);
      break;
    }
    case "ring": {
      const t = mk();
      const seg = t.part([0, 0, 0]);
      seg.rotation.x = -1.0;
      for (let i = 0; i < 5; i++)
        seg.cyl(
          0.055 - i * 0.003,
          0.05,
          i % 2 ? (q.tailC2 ?? tailMat) : tailMat,
          [0, i * 0.05, 0],
          0.052 - i * 0.003,
          10,
        );
      break;
    }
    case "none":
      break;
  }
  q.more?.({ b, f, head, by, cy, cz, q });
  return {
    head,
    eyes,
    fore,
    hind,
    tails,
    neck: [0, cy - hr * 0.52, cz - hr * 0.05],
    neckR: hr * 0.95,
    top: [0, cy + hr * 0.95, cz],
    tilt: true,
    span: len + hr * 1.6,
  };
}

// MARK: The colour maps

type Quads = Partial<Quad> & { more?: Quad["more"] };

const CAT: Quad = {
  len: 0.16,
  bw: 0.16,
  bh: 0.13,
  legH: 0.07,
  legW: 0.05,
  hr: 0.11,
  body: "#f0a04b",
  ear: "point",
  earC: "#f0a04b",
  earIn: "#f28bb2",
  nose: "#e0584f",
  eye: INK,
  tail: "cat",
  tailC: "#f0a04b",
};

/** A thin dark line across the torso's back, like the tabby's. */
const stripes =
  (c: string, n = 4) =>
  ({ b, by, q }: Parameters<NonNullable<Quad["more"]>>[0]) => {
    for (let i = 0; i < n; i++)
      b.box([q.bw + 0.008, 0.012, 0.022], c, [0, by + q.bh - 0.008, q.len * (0.1 + (i * 0.8) / n)], 0.004);
  };

/** A flat patch on the torso's top. */
const patch = (b: Model, c: string, x: number, y: number, z: number, r: number) =>
  b.ball(r, c, [x, y, z], [1, 0.3, 1.1], 8);

const CATS: Record<string, Quads> = {
  black: {
    body: "#4a4353",
    leg: "#4a4353",
    earC: "#4a4353",
    tailC: "#4a4353",
    eye: "#f5d14a",
    more: ({ b, by, q }) => patch(b, "#6e6680", 0.03, by + q.bh, q.len * 0.5, 0.045),
  },
  tuxedo: {
    body: "#2f2a38",
    earC: "#2f2a38",
    tailC: "#2f2a38",
    paw: C.white,
    more: ({ b, head, by, q, cy, cz }) => {
      b.ball(0.06, C.white, [0, by + q.bh * 0.4, q.len + 0.05], [1, 1.3, 0.6], 10);
      head.ball(0.04, C.white, [0, cy - q.hr * 0.3, cz + q.hr * 0.78], [1, 0.8, 0.7], 8);
    },
  },
  siamese: {
    body: "#f1e4c8",
    earC: "#5b3d2b",
    earIn: undefined,
    tailC: "#5b3d2b",
    paw: "#5b3d2b",
    eye: "#4fa3d9",
    more: ({ head, cy, cz, q }) =>
      head.ball(q.hr * 0.62, "#5b3d2b", [0, cy - q.hr * 0.18, cz + q.hr * 0.38], [1, 0.8, 0.8], 10),
  },
  calico: {
    body: "#fbf7ef",
    earC: "#3a3442",
    tailC: "#f0a04b",
    more: ({ b, head, by, q, cy, cz }) => {
      patch(b, "#f0a04b", 0.04, by + q.bh, q.len * 0.3, 0.055);
      patch(b, "#3a3442", -0.04, by + q.bh, q.len * 0.7, 0.05);
      head.ball(q.hr * 0.4, "#f0a04b", [q.hr * 0.5, cy + q.hr * 0.55, cz + q.hr * 0.25], [1, 0.9, 0.5], 8);
    },
  },
  greytabby: {
    body: "#a7a2a0",
    earC: "#7d7880",
    tailC: "#7d7880",
    more: (c) => {
      stripes("#5e5a63")(c);
      for (const x of [-0.03, 0, 0.03])
        c.head.box([0.012, 0.004, 0.05], "#5e5a63", [x, c.cy + c.q.hr * 0.95, c.cz + 0.01], 0.002);
    },
  },
  sphynx: {
    body: "#e2b49a",
    earC: "#e2b49a",
    earIn: "#ee8c8c",
    ear: "big",
    tail: "thin",
    tailC: "#e2b49a",
    eye: "#3b6e55",
    nose: "#d9787a",
    bw: 0.14,
    more: ({ b, head, by, q, cy, cz }) => {
      // Wrinkles: darker skin folds across the back and the brow.
      for (let i = 0; i < 3; i++)
        b.box([q.bw + 0.004, 0.006, 0.01], "#b46c58", [0, by + q.bh * 0.55, q.len * (0.2 + i * 0.3)], 0.002);
      for (const dz of [0, 0.02])
        head.box([q.hr * 0.9, 0.006, 0.008], "#b46c58", [0, cy + q.hr * 0.62 - dz, cz + q.hr * 0.7], 0.002);
    },
  },
  witch: {
    body: "#4a4358",
    earC: "#4a4358",
    tailC: "#4a4358",
    eye: "#f5d14a",
    more: ({ head, cy, cz, q }) => {
      // The pointed hat, a yellow band and buckle.
      const y = cy + q.hr * 0.78;
      head.cyl(q.hr * 1.15, 0.018, "#7a55b8", [0, y, cz - 0.01], q.hr * 1.15, 14);
      head.cyl(q.hr * 0.62, q.hr * 1.5, "#7a55b8", [0, y + 0.01, cz - 0.01], 0.008, 12).rotation.x = -0.12;
      head.cyl(q.hr * 0.66, 0.025, "#f5d14a", [0, y + 0.012, cz - 0.01], q.hr * 0.66, 12);
    },
  },
};

const DOG: Quad = {
  len: 0.19,
  bw: 0.18,
  bh: 0.15,
  legH: 0.1,
  legW: 0.06,
  hr: 0.13,
  body: "#c9925a",
  ear: "floppy",
  earC: "#7a4f2c",
  snout: { c: "#d9b387", w: 0.72, l: 0.7 },
  nose: INK,
  eye: INK,
  tongue: "#e0584f",
  tail: "cat",
  tailC: "#c9925a",
};

const spot = (b: Model, c: string, x: number, z: number, y: number, r = 0.035) =>
  b.ball(r, c, [x, y, z], [1, 0.4, 1], 8);

const DOGS: Record<string, Quads> = {
  dalmatian: {
    body: C.white,
    earC: "#3b3440",
    tailC: C.white,
    snout: { c: "#f4eee4", w: 0.72, l: 0.7 },
    more: ({ b, head, by, cy, cz, q }) => {
      const top = by + q.bh;
      spot(b, "#3b3440", 0.04, 0.05, top);
      spot(b, "#3b3440", -0.05, 0.12, top, 0.03);
      spot(b, "#3b3440", 0.02, 0.17, top, 0.025);
      head.ball(0.03, "#3b3440", [0.06, cy + 0.1, cz + 0.02], [1, 0.5, 1], 8);
      b.ball(0.03, "#3b3440", [q.bw / 2, by + 0.07, 0.07], [0.4, 1, 1], 8);
    },
  },
  husky: {
    body: "#8d96a3",
    earC: "#6f7885",
    ear: "point",
    eye: "#bfe6ff",
    tail: "curl",
    tailC: "#8d96a3",
    snout: { c: C.white, w: 0.72, l: 0.7 },
    more: ({ b, head, by, cy, cz, q }) => {
      b.ball(0.07, C.white, [0, by + q.bh * 0.35, q.len + 0.05], [1, 1.2, 0.6], 10);
      head.ball(q.hr * 0.62, C.white, [0, cy - q.hr * 0.22, cz + q.hr * 0.4], [1, 0.8, 0.7], 10);
      b.box([q.bw * 0.6, 0.01, q.len], C.white, [0, by - 0.002, q.len / 2], 0.004);
    },
  },
  shiba: {
    body: "#d9713c",
    earC: "#8f4424",
    ear: "point",
    tail: "curl",
    tailC: "#d9713c",
    snout: { c: "#f6e7c8", w: 0.72, l: 0.7 },
    more: ({ b, head, by, cy, cz, q }) => {
      b.ball(0.07, "#f6e7c8", [0, by + q.bh * 0.35, q.len + 0.05], [1, 1.2, 0.6], 10);
      for (const s of SIDES)
        head.ball(0.04, "#f6e7c8", [s * q.hr * 0.55, cy - q.hr * 0.25, cz + q.hr * 0.55], [1, 0.9, 0.7], 8);
    },
  },
  golden: {
    body: "#f2bd36",
    earC: "#a86a18",
    tail: "thick",
    tailC: "#f2bd36",
    snout: { c: "#f8d56c", w: 0.72, l: 0.7 },
    more: ({ b, by, q }) => {
      patch(b, "#d08e1e", 0, by + q.bh, q.len * 0.5, 0.07);
      b.ball(0.065, "#fff0c4", [0, by + q.bh * 0.35, q.len + 0.05], [1, 1.2, 0.6], 10);
      b.box([q.bw * 0.6, 0.03, q.len], "#fff0c4", [0, by - 0.004, q.len / 2], 0.01);
    },
  },
  pug: {
    len: 0.17,
    legH: 0.075,
    body: "#d9b27c",
    earC: "#5a4a50",
    tail: "curl",
    tailC: "#d9b27c",
    snout: { c: "#34303a", w: 0.8, l: 0.35 },
    nose: "#1c1920",
    more: ({ head, cy, cz, q }) => {
      // Wrinkled forehead.
      for (const dz of [0, 0.02])
        head.box(
          [q.hr * 0.8, 0.006, 0.008],
          "#a8794a",
          [0, cy + q.hr * 0.6 - dz, cz + q.hr * 0.72 - dz],
          0.002,
        );
    },
  },
  corgi: {
    len: 0.2,
    legH: 0.065,
    body: "#e0954f",
    ear: "big",
    earC: "#e0954f",
    earIn: "#f6ecd9",
    tail: "stub",
    tailC: "#e0954f",
    paw: "#f6ecd9",
    snout: { c: "#f6ecd9", w: 0.72, l: 0.7 },
    more: ({ b, by, q }) => b.ball(0.07, "#f6ecd9", [0, by + q.bh * 0.35, q.len + 0.05], [1, 1.2, 0.6], 10),
  },
  dachshund: {
    len: 0.32,
    bw: 0.14,
    bh: 0.12,
    legH: 0.06,
    hr: 0.115,
    body: "#a4552f",
    earC: "#6e3519",
    tail: "thin",
    tailC: "#a4552f",
    snout: { c: "#c46a40", w: 0.6, l: 0.9 },
  },
  poodle: {
    body: "#f8e2bc",
    ear: "round",
    earC: "#f8e2bc",
    tail: "pom",
    tailC: "#f8e2bc",
    snout: { c: "#f8e2bc", w: 0.5, l: 0.8 },
    tongue: undefined,
    more: ({ b, f, head, cy, cz, q }) => {
      // Pompoms: topknot, ears, legs and tail, in curls of two creams.
      head.ball(0.075, "#f8e2bc", [0, cy + q.hr * 0.95, cz - 0.01], [1, 0.9, 1], 10);
      for (const s of SIDES) {
        head.ball(0.06, "#f8e2bc", [s * q.hr * 1.0, cy - q.hr * 0.15, cz - 0.02], [0.7, 1.2, 1], 10);
        for (const g of [b, f])
          g.ball(
            0.05,
            "#d49a5c",
            [s * (q.bw / 2 - 0.035), 0.1, g === b ? 0 : q.len],
            [1, 0.9, 1],
            8,
          ).userData.pom = true;
        b.ball(0.06, "#f8e2bc", [s * 0.045, 0.2, q.len * 0.5], [1, 0.8, 1.6], 10);
      }
      head.ball(0.06, "#f8e2bc", [0, cy + q.hr * 0.2, cz + q.hr * 0.5], [1.4, 1, 1], 10);
    },
  },
  frenchie: {
    body: "#b3a79b",
    ear: "bat",
    earC: "#b3a79b",
    earIn: "#e0aaa0",
    tail: "stub",
    tailC: "#7d7068",
    snout: { c: "#7d7068", w: 0.8, l: 0.35 },
    more: ({ b, by, q }) => {
      for (let i = 0; i < 3; i++)
        b.box([q.bw + 0.008, 0.008, 0.02], "#7d7068", [0, by + q.bh - 0.01, q.len * (0.2 + i * 0.3)], 0.003);
    },
  },
  chowchow: {
    body: "#b8663a",
    ear: "round",
    earC: "#b8663a",
    tongue: "#3d4a82",
    tail: "curl",
    tailC: "#b8663a",
    snout: { c: "#d98f55", w: 0.8, l: 0.55 },
    more: ({ head, b, cy, cz, q }) => {
      // The lion's mane, round the neck and shoulders.
      head.ball(q.hr * 1.15, "#d98f55", [0, cy - q.hr * 0.05, cz - q.hr * 0.3], [1.15, 1, 0.8], 12);
      b.ball(0.11, "#d98f55", [0, q.legH + 0.1, q.len], [1.1, 1, 0.8], 12);
    },
  },
  chihuahua: {
    len: 0.14,
    bw: 0.13,
    bh: 0.1,
    legH: 0.08,
    legW: 0.04,
    hr: 0.12,
    body: "#dcae74",
    ear: "big",
    earC: "#dcae74",
    earIn: "#e3b6a0",
    tail: "thin",
    tailC: "#dcae74",
    snout: { c: "#e8c28c", w: 0.55, l: 0.55 },
    more: ({ b, by, q }) => b.ball(0.05, C.white, [0, by + q.bh * 0.35, q.len + 0.04], [1, 1.2, 0.6], 10),
  },
  greyhound: {
    len: 0.25,
    bw: 0.13,
    bh: 0.12,
    legH: 0.15,
    legW: 0.045,
    hr: 0.1,
    body: "#8d9bb2",
    ear: "floppy",
    earC: "#66738c",
    tail: "thin",
    tailC: "#8d9bb2",
    snout: { c: "#a7b3c6", w: 0.5, l: 1.2 },
    more: ({ b, by, q }) => b.ball(0.05, "#f1eee8", [0, by + q.bh * 0.35, q.len + 0.04], [1, 1.2, 0.6], 10),
  },
  jackolantern: {
    more: ({ head, cy, cz, q }) => {
      // A pumpkin for a head, lit from inside.
      head.ball(q.hr * 1.5, "#e8832e", [0, cy + 0.02, cz + 0.01], [1.15, 0.95, 1.05], 14);
      head.cyl(0.018, 0.05, "#5fa85a", [0, cy + q.hr * 1.5, cz - 0.01], 0.012, 6).rotation.x = -0.2;
      const lit = glow("#ffd84a");
      for (const s of SIDES) {
        const eye = head.cyl(0.02, 0.02, lit, [s * 0.05, cy + 0.04, cz + q.hr * 1.4], 0.003, 3);
        eye.rotation.set(Math.PI / 2, 0, s * 0.3);
      }
      head.box([0.1, 0.03, 0.02], lit, [0, cy - 0.06, cz + q.hr * 1.45], 0.005);
      for (const x of [-0.04, 0.04])
        head.box([0.02, 0.025, 0.02], toon("#e8832e"), [x, cy - 0.055, cz + q.hr * 1.47], 0.003);
      light(head, [0, cy, cz + 0.25], "#ffb347", 1.4, 3);
    },
  },
};

const PANDA: Quad = {
  len: 0.17,
  bw: 0.22,
  bh: 0.17,
  legH: 0.08,
  legW: 0.07,
  hr: 0.14,
  body: "#f4f1ea",
  leg: "#3a3540",
  ear: "round",
  earC: "#3a3540",
  snout: { c: "#f4f1ea", w: 0.5, l: 0.35 },
  nose: INK,
  eye: INK,
  tail: "stub",
  tailC: "#f4f1ea",
  more: ({ b, head, by, cy, cz, q }) => pandaMarks(b, head, by, cy, cz, q, "#3a3540", "#3a3540"),
};

function pandaMarks(
  b: Model,
  head: Model,
  by: number,
  cy: number,
  cz: number,
  q: Quad,
  k: string,
  eye: string,
): void {
  // The shoulder band, over the back and down to the fore legs, and the eye patches.
  b.box([q.bw + 0.012, q.bh + 0.012, 0.07], k, [0, by - 0.003, q.len - 0.02], 0.04);
  for (const s of SIDES) {
    const p = head.ball(
      q.hr * 0.28,
      eye,
      [s * q.hr * 0.43, cy + q.hr * 0.18, cz + q.hr * 0.8],
      [0.8, 1.2, 0.4],
      10,
    );
    p.rotation.z = s * 0.4;
  }
}

const PANDAS: Record<string, Quads> = {
  qinling: {
    body: "#f3e2c4",
    leg: "#8a5a3a",
    earC: "#8a5a3a",
    snout: { c: "#f3e2c4", w: 0.5, l: 0.35 },
    tailC: "#f3e2c4",
    more: ({ b, head, by, cy, cz, q }) => pandaMarks(b, head, by, cy, cz, q, "#8a5a3a", "#8a5a3a"),
  },
  polar: {
    body: "#f7fbfd",
    leg: "#9fb4c7",
    earC: "#9fb4c7",
    tailC: "#f7fbfd",
    snout: { c: "#f7fbfd", w: 0.5, l: 0.35 },
    more: ({ b, head, by, cy, cz, q }) => pandaMarks(b, head, by, cy, cz, q, "#9fb4c7", "#2b2433"),
  },
  albino: {
    body: "#fffafc",
    leg: "#e4c6ee",
    earC: "#e4c6ee",
    earIn: "#ffa6c4",
    nose: "#ff7fa8",
    eye: "#ff2f68",
    tailC: "#fffafc",
    snout: { c: "#fffafc", w: 0.5, l: 0.35 },
    more: ({ b, head, by, cy, cz, q }) => pandaMarks(b, head, by, cy, cz, q, "#e4c6ee", "#f1d9f4"),
  },
  red: {
    // The red panda: rust coat, cream face and white-tipped ears, dark legs and belly, a ringed tail.
    len: 0.2,
    bw: 0.17,
    bh: 0.13,
    hr: 0.115,
    body: "#c8643a",
    leg: "#3a3540",
    ear: "point",
    earC: "#c8643a",
    earIn: "#f4f1ea",
    snout: { c: "#f4f1ea", w: 0.55, l: 0.5 },
    tail: "ring",
    tailC: "#c8643a",
    tailC2: "#6e2a18",
    more: ({ b, head, by, cy, cz, q }) => {
      b.box([q.bw * 0.7, 0.04, q.len], "#3a3540", [0, by - 0.005, q.len / 2], 0.015);
      for (const s of SIDES) {
        head.ball(
          q.hr * 0.5,
          "#ecd0a2",
          [s * q.hr * 0.42, cy - q.hr * 0.15, cz + q.hr * 0.5],
          [1, 0.9, 0.6],
          8,
        );
        const tear = head.ball(
          0.012,
          "#6e2a18",
          [s * q.hr * 0.3, cy - q.hr * 0.18, cz + q.hr * 0.95],
          [0.5, 2.6, 0.4],
          6,
        );
        tear.rotation.z = s * 0.2;
      }
    },
  },
};

// MARK: Costumes for named pets (Penny's sweater, Nemo's Wookiee coat)

const OUTFITS: Record<string, Quad["more"]> = {
  "penny-sweater": ({ b, f, by, q }) => {
    // Dark chocolate knit from behind the neck to the hips, a pink roll neck, hem and cuff.
    b.box([q.bw + 0.024, q.bh * 0.82, q.len * 0.8], "#5e3a26", [0, by + q.bh * 0.12, q.len * 0.5], 0.05);
    for (let i = 0; i < 5; i++)
      b.box([q.bw + 0.028, 0.012, 0.012], "#432718", [0, by + q.bh * 0.5, q.len * (0.18 + i * 0.15)], 0.003);
    b.box([q.bw + 0.03, 0.035, 0.05], "#f0adbd", [0, by + q.bh * 0.12, q.len * 0.08], 0.012);
    b.cyl(q.hr * 0.62, 0.075, "#f0adbd", [0, by + q.bh * 0.55, q.len + 0.01], q.hr * 0.55, 12);
    f.box(
      [q.legW + 0.02, 0.03, q.legW + 0.02],
      "#f0adbd",
      [q.bw / 2 - q.legW * 0.6, q.legH * 0.55, q.len],
      0.01,
    );
  },
  "nemo-wookiee": ({ b, head, by, cy, cz, q }) => {
    // A shaggy brown coat over the back, wrapped up round the head like a hood, and a bandolier.
    const fur = ["#5a3822", "#3b2314"];
    for (let i = 0; i < 9; i++) {
      const s = i % 2 ? 1 : -1;
      b.ball(
        0.05,
        fur[i % 2]!,
        [s * (q.bw / 2 - 0.01), by + q.bh * (0.45 + (i % 3) * 0.18), q.len * (0.08 + i * 0.1)],
        [0.8, 1.1, 1.1],
        8,
      );
    }
    b.box([q.bw + 0.012, 0.05, q.len + 0.04], fur[0]!, [0, by + q.bh - 0.005, q.len / 2], 0.02);
    for (const s of SIDES)
      head.ball(
        q.hr * 0.5,
        fur[i2(s)]!,
        [s * q.hr * 0.9, cy + q.hr * 0.1, cz - q.hr * 0.25],
        [0.7, 1.2, 1],
        8,
      );
    head.ball(q.hr * 0.9, fur[0]!, [0, cy + q.hr * 0.3, cz - q.hr * 0.45], [1.1, 0.8, 0.8], 10);
    const band = b.box(
      [q.bw + 0.014, 0.012, q.len * 0.9],
      "#1f1e27",
      [0, by + q.bh + 0.006, q.len * 0.5],
      0.004,
    );
    band.rotation.y = 0;
    for (const z of [0.25, 0.5, 0.75])
      b.box([q.bw + 0.014, 0.004, 0.006], "#9a9eb0", [0, by + q.bh + 0.012, q.len * z], 0.001);
  },
};
const i2 = (s: number) => (s < 0 ? 0 : 1);

function quadFor(species: Species, variant: string, outfit: string | null): Quad {
  const base = { cat: CAT, forkedcat: CAT, dog: DOG, panda: PANDA }[species as "cat"]!;
  const over =
    (species === "cat" ? CATS : species === "dog" ? DOGS : species === "panda" ? PANDAS : {})[variant] ?? {};
  const q: Quad = { ...base, ...over };
  if (species === "forkedcat")
    Object.assign(q, {
      body: "#8a93a1",
      earC: "#8a93a1",
      tail: "fork",
      tailC: "#8a93a1",
      tailC2: "#f0a04b",
    });
  // The variant's marks (or the base's), then the costume's.
  const marks = [over.more ?? base.more, outfit ? OUTFITS[outfit] : undefined];
  q.more = (c) => {
    for (const m of marks) m?.(c);
  };
  return q;
}

// MARK: Duck

interface Duck {
  body: string;
  head: string;
  bill: string;
  wing: string;
  eye: string;
  scale?: number;
  headScale?: number;
  more?: (c: { b: Model; head: Model }) => void;
  ghost?: boolean;
}

const DUCKS: Record<string, Partial<Duck>> = {
  "": {},
  mallard: {
    body: "#8c8077",
    head: "#3f8a57",
    bill: "#f2b13b",
    wing: "#6f655d",
    more: ({ b, head }) => {
      head.cyl(0.06, 0.014, C.white, [0, -0.025, 0.015], 0.06, 12);
      b.ball(0.1, "#7a4a2e", [0, 0.17, 0.07], [1.05, 0.9, 0.85], 10);
    },
  },
  rubber: {
    body: "#ffcf00",
    head: "#ffcf00",
    bill: "#ff6a00",
    wing: "#f2a100",
    more: ({ b, head }) => {
      // Glossy: a white glint on the head and the back.
      head.ball(0.02, C.white, [-0.04, 0.12, 0.05], [1, 0.7, 0.5], 6);
      b.ball(0.03, C.white, [-0.09, 0.22, -0.04], [0.6, 1, 0.5], 6);
    },
  },
  pekin: { body: "#f7f2e6", head: "#f7f2e6", wing: "#bfb8ad", bill: "#f08a3c" },
  swedish: {
    body: "#3b4762",
    head: "#3b4762",
    wing: "#2e384e",
    eye: C.white,
    more: ({ b, head }) => {
      b.ball(0.07, C.white, [0, 0.17, 0.12], [1, 1.2, 0.5], 8);
      head.ball(0.05, "#7f93bd", [0, 0.1, -0.02], [1.3, 0.35, 1], 8);
    },
  },
  duckling: {
    body: "#f7e08a",
    head: "#f7e08a",
    wing: "#e8c862",
    scale: 0.72,
    headScale: 1.2,
    more: ({ head }) => {
      head.cyl(0.01, 0.06, "#f7e08a", [0, 0.1, 0.0], 0.002, 4);
    },
  },
  ghost: {
    body: "#fbf7ef",
    head: "#fbf7ef",
    wing: "#d8d4e0",
    eye: "#3a3540",
    ghost: true,
  },
};

function duck(b: Model, f: Model, variant: string): Rig {
  const d: Duck = {
    body: "#f5d14a",
    head: "#f5d14a",
    bill: "#f08a3c",
    wing: "#e0b83a",
    eye: INK,
    ...DUCKS[variant],
  };
  const k = d.scale ?? 1;
  const hs = d.headScale ?? 1;
  const paint = (c: string): THREE.Material | string => (d.ghost ? glass(c, 0.6) : c);
  const z0 = 0.1;
  b.ball(0.15 * k, paint(d.body), [0, 0.13 * k + 0.02, z0], [1, 0.85, 1.2]);
  // Head on its neck.
  const head = b.part([0, 0.26 * k, z0 + 0.08 * k]);
  head.ball(0.1 * k * hs, paint(d.head), [0, 0.05 * k, 0]);
  head.box([0.09 * k, 0.03 * k, 0.08 * k], d.bill, [0, 0, 0.1 * k * hs], 0.012);
  const eyes: Mesh[] = [];
  for (const s of SIDES)
    eyes.push(eyeBall(head, [s * 0.045 * k * hs, 0.085 * k, 0.085 * k * hs], d.eye, 0.02 * k));
  if (d.ghost)
    for (const s of SIDES) {
      const r = head.ball(0.03, "#3a3540", [s * 0.045, 0.085, 0.08], [1, 1.2, 0.4], 8);
      r.scale.set(1.1, 1.3, 0.4);
    }
  // Wings, tail, feet.
  const tails: THREE.Object3D[] = [];
  const tail = b.part([0, 0.2 * k, z0 - 0.15 * k]);
  tail.ball(0.07 * k, paint(tint(d.body, -0.08)), [0, 0, 0], [1, 0.6, 1]);
  tails.push(tail);
  if (d.wing && variant !== "rubber")
    for (const s of SIDES)
      b.ball(0.07 * k, paint(d.wing), [s * 0.14 * k, 0.15 * k + 0.02, z0 - 0.02], [0.4, 0.8, 1.1], 8);
  else for (const s of SIDES) b.ball(0.05, d.wing, [s * 0.14, 0.14, z0 - 0.02], [0.3, 0.7, 0.9], 8);
  d.more?.({ b, head });
  const feet: Mesh[] = [];
  if (!d.ghost)
    for (const s of SIDES)
      feet.push(f.box([0.05 * k, 0.02, 0.07 * k], "#f08a3c", [s * 0.05 * k, 0, z0 + 0.03], 0.008));
  else {
    // A ghost has no feet: a wavy hem.
    for (let i = 0; i < 4; i++)
      b.ball(
        0.035,
        paint(d.body),
        [Math.cos(i * 1.57 + 0.7) * 0.1, 0.03, z0 + Math.sin(i * 1.57 + 0.7) * 0.12],
        [1, 0.8, 1],
        8,
      );
  }
  const rig: Rig = {
    head,
    eyes,
    fore: feet,
    hind: [],
    tails,
    neck: [0, 0.0, 0],
    neckR: 0.092 * k * hs,
    top: [0, 0.15 * k * hs, 0],
    tilt: false,
    float: d.ghost ? 0.1 : undefined,
    span: 0.35 * k,
  };
  if (variant === "ghost")
    rig.fx = (t) => {
      head.rotation.z = Math.sin(t * 2) * 0.05;
    };
  return rig;
}

// MARK: Dragon

interface Dragon {
  g: string;
  w: string;
  y: string;
  e: string;
  n: string;
  bone?: boolean;
  baby?: boolean;
  glowEyes?: boolean;
}

const DRAGONS: Record<string, Partial<Dragon>> = {
  "": {},
  red: { g: "#c94a3f", w: "#f19a8a", y: "#f7e6c2", n: "#f5d14a" },
  ice: { g: "#9fd8ee", w: "#dff3ff", y: "#fbf7ef", n: "#7fd4ff" },
  gold: { g: "#e0b23a", w: "#f7eaa0", y: "#fbf0d0", n: "#f08a3c" },
  shadow: {
    g: "#463f86",
    w: "#7d4fb0",
    y: "#5b5680",
    e: "#ff4fd2",
    n: "#b070ff",
    glowEyes: true,
  },
  skeleton: {
    g: "#f1ead6",
    w: "#4a4158",
    y: "#d6cdb4",
    e: "#14101c",
    n: "#fffaf0",
    bone: true,
  },
  baby: { g: "#8ccf86", w: "#f0a58a", y: "#f5e2a8", n: "#f5d14a", baby: true },
};

function dragon(b: Model, f: Model, variant: string): Rig {
  const d: Dragon = {
    g: "#4fb36a",
    w: "#8fd6a0",
    y: "#f5d98a",
    e: INK,
    n: "#ff8a3c",
    ...DRAGONS[variant],
  };
  const k = d.baby ? 0.72 : 1;
  const hk = d.baby ? 1.35 : 1;
  const bodyC = d.bone ? "#4a4258" : d.g;
  const len = 0.2;
  // Body and belly; a skeleton shows dark gaps between its ribs.
  b.ball(0.15 * k, bodyC, [0, 0.19 * k, len / 2], [0.85, 0.8, 1.35]);
  if (d.bone)
    for (let i = 0; i < 4; i++)
      b.box([0.27 * k, 0.012, 0.03], d.g, [0, 0.2 * k + (i % 2) * 0.02, 0.02 + i * 0.08 * k], 0.004);
  else b.ball(0.12 * k, d.y, [0, 0.13 * k, len / 2 + 0.02], [0.8, 0.55, 1.1]);
  // Four legs.
  const fore: Mesh[] = [];
  const hind: Mesh[] = [];
  for (const s of SIDES)
    for (const [group, list, z] of [
      [b, hind, 0.02],
      [f, fore, len - 0.02],
    ] as const)
      list.push(group.box([0.055 * k, 0.1 * k, 0.065 * k], d.g, [s * 0.1 * k, 0, z], 0.02));
  // Back spikes.
  for (let i = 0; i < 4; i++)
    b.cyl(
      0.02 * k,
      0.05 * k,
      d.bone ? d.g : d.y,
      [0, 0.31 * k - Math.abs(i - 1.5) * 0.015, i * 0.07 * k - 0.0],
      0.002,
      4,
    );
  // Neck and head.
  b.cyl(0.05 * k, 0.15 * k, d.g, [0, 0.25 * k, len + 0.0], 0.04 * k, 8).rotation.x = 0.5;
  const head = b.part([0, 0.36 * k, len + 0.09 * k]);
  const hr = 0.075 * hk;
  head.box([hr * 1.8, hr * 1.5, hr * 1.7], d.g, [0, 0, 0], 0.03);
  head.box([hr * 1.2, hr * 0.9, hr * 1.0], d.bone ? d.y : d.y, [0, 0, hr * 1.4], 0.025);
  const eyeMat: Paint = d.glowEyes ? glow(d.e) : d.e;
  const eyes: Mesh[] = [];
  for (const s of SIDES) {
    const e = head.ball(0.02 * hk, eyeMat, [s * hr * 0.78, hr * 1.0, hr * 0.7], [1, 1.2, 0.6], 8);
    e.userData.sy = 1.2;
    eyes.push(e);
    head
      .cyl(0.018 * hk, 0.07 * hk, d.bone ? d.g : d.w, [s * hr * 0.6, hr * 1.4, -hr * 0.2], 0.003, 5)
      .rotation.set(-0.5, 0, -s * 0.3);
    head.ball(0.012, d.n, [s * hr * 0.25, hr * 0.15, hr * 2.0], [1, 1, 0.8], 6);
  }
  // A little fire in the nostrils.
  const flame = head.cyl(0.018, 0.045, glow(d.n), [0, hr * 0.1, hr * 2.0], 0.002, 5);
  flame.rotation.x = Math.PI / 2;
  // Wings.
  const wings: THREE.Object3D[] = [];
  for (const s of SIDES) {
    const wing = b.part([s * 0.11 * k, 0.28 * k, len * 0.4], 0);
    const sp = (r: number, h: number, rz: number, ry: number, c: string) => {
      const m = wing.cyl(r, h, c, [0, 0, 0], r * 0.7, 5);
      m.rotation.set(0, ry, s * rz);
      return m;
    };
    sp(0.012, 0.22 * k, 1.1, 0, d.bone ? d.g : d.g);
    sp(0.01, 0.2 * k, 1.35, 0.5, d.bone ? d.g : d.g);
    sp(0.01, 0.18 * k, 1.55, -0.5, d.bone ? d.g : d.g);
    if (!d.bone) {
      const sail = wing.box([0.2 * k, 0.012, 0.15 * k], d.w, [s * 0.1 * k, 0.08 * k, -0.01], 0.004);
      sail.rotation.z = s * 0.35;
    } else {
      wing.box(
        [0.2 * k, 0.012, 0.15 * k],
        glass(d.w, 0.35),
        [s * 0.1 * k, 0.08 * k, -0.01],
        0.004,
      ).rotation.z = s * 0.35;
    }
    wings.push(wing);
  }
  // Tail: three tapering links and a spade (or a flame, for the baby).
  const tail = b.part([0, 0.17 * k, 0]);
  const links = [0.16, 0.14, 0.12];
  let z = 0;
  links.forEach((l, i) => {
    const c = tail.cyl((0.05 - i * 0.012) * k, l * k, d.g, [0, 0, z], (0.04 - i * 0.012) * k, 7);
    c.rotation.x = -Math.PI / 2;
    c.position.set(0, 0, z);
    z -= l * k * 0.95;
  });
  if (d.baby) tail.cyl(0.03, 0.07, glow(d.n), [0, 0.0, z - 0.02], 0.002, 6).rotation.x = -Math.PI / 2;
  else
    tail.cyl(0.001, 0.07 * k, d.bone ? d.g : d.y, [0, 0.0, z - 0.02], 0.045 * k, 4).rotation.x = Math.PI / 2;
  const rig: Rig = {
    head,
    eyes,
    fore,
    hind,
    tails: [tail],
    neck: [0, -hr * 0.8, -hr * 0.2],
    neckR: hr * 0.8,
    top: [0, hr * 0.8, 0],
    tilt: true,
    span: len + 0.3 * k,
  };
  rig.fx = (t, moving) => {
    wings.forEach((w, i) => {
      const flap = Math.sin(t * (moving ? 9 : 2)) * (moving ? 0.35 : 0.1);
      w.rotation.z = (i ? -1 : 1) * flap;
    });
    flame.scale.setScalar(0.9 + Math.sin(t * 14) * 0.25);
  };
  if (d.glowEyes || d.bone) light(head, [0, 0.1, 0.2], d.bone ? "#bfe6ff" : "#b070ff", 0.9, 2.2);
  return rig;
}

// MARK: Loot and special pets

/** Sand golem: a block of every second you waited, eyes glowing. */
function golem(b: Model, f: Model): Rig {
  const s = "#e3c07a";
  const S = "#b8934e";
  const fore: Mesh[] = [];
  const hind: Mesh[] = [];
  for (const sd of SIDES) {
    hind.push(b.box([0.09, 0.1, 0.09], S, [sd * 0.06, 0, 0.08], 0.03));
    fore.push(f.box([0.09, 0.1, 0.09], S, [sd * 0.06, 0, 0.08], 0.03));
    b.box([0.07, 0.17, 0.08], s, [sd * 0.155, 0.12, 0.08], 0.03).rotation.z = sd * 0.1;
  }
  b.box([0.2, 0.18, 0.17], s, [0, 0.1, 0.08], 0.04);
  b.box([0.21, 0.04, 0.18], S, [0, 0.1, 0.08], 0.015);
  for (const [x, z] of [
    [-0.05, 0.17],
    [0.06, 0.17],
    [0.0, -0.01],
  ] as const)
    b.ball(0.025, S, [x, 0.2, z], [1, 0.7, 1], 6);
  const head = b.part([0, 0.28, 0.08]);
  head.box([0.16, 0.13, 0.14], s, [0, 0, 0], 0.035);
  const eyes: Mesh[] = [];
  const lit = glow("#ff9a3c");
  for (const sd of SIDES) {
    const e = head.box([0.03, 0.03, 0.02], lit, [sd * 0.04, 0.06, 0.075], 0.004);
    e.userData.sy = 1;
    eyes.push(e);
  }
  head.box([0.05, 0.012, 0.01], S, [0, 0.025, 0.075], 0.002);
  // Sand trickling off it.
  const grains = Array.from({ length: 4 }, (_, i) => ({
    m: b.box([0.012, 0.012, 0.012], s, [0, 0, 0], 0.002),
    i,
  }));
  light(head, [0, 0, 0.15], "#ff9a3c", 0.5, 1.6);
  return {
    head,
    eyes,
    fore,
    hind,
    tails: [],
    neck: [0, -0.04, 0],
    neckR: 0.08,
    top: [0, 0.07, 0],
    tilt: false,
    span: 0.2,
    fx: (t) => {
      for (const { m, i } of grains) {
        const u = (t * 0.7 + i * 0.25) % 1;
        m.position.set(-0.1 + i * 0.06, 0.2 - u * 0.2, 0.0 + (i % 2) * 0.1);
        m.visible = u < 0.9;
      }
    },
  };
}

/** Goldfish: floating along, a bubble at a time. It forgot already. */
function goldfish(b: Model, f: Model): Rig {
  void f;
  const g = "#ff8a3c";
  const G = "#d9622b";
  b.ball(0.12, g, [0, 0.0, 0.0], [0.75, 0.95, 1.25]);
  const head = b.part([0, 0.0, 0.1]);
  head.ball(0.02, C.white, [0.07, 0.04, 0.03], [0.5, 1.1, 1.1], 8).userData.sy = 1.1;
  head.ball(0.02, C.white, [-0.07, 0.04, 0.03], [0.5, 1.1, 1.1], 8).userData.sy = 1.1;
  const eyes: Mesh[] = [];
  for (const s of SIDES) eyes.push(eyeBall(head, [s * 0.082, 0.04, 0.035], INK, 0.011));
  const tail = b.part([0, 0, -0.14]);
  for (const s of SIDES)
    tail.box([0.012, 0.15, 0.1], G, [s * 0.01, -0.07, -0.04], 0.004).rotation.x = s * 0.4;
  b.box([0.012, 0.08, 0.12], G, [0, 0.1, -0.02], 0.004);
  for (const s of SIDES) b.box([0.01, 0.05, 0.07], G, [s * 0.09, -0.05, 0.03], 0.003).rotation.z = s * -0.5;
  const bubbles = Array.from({ length: 3 }, (_, i) =>
    b.ball(0.017 + i * 0.004, glass("#a8dcf7", 0.7), [0, 0, 0], [1, 1, 1], 8),
  );
  return {
    head,
    eyes,
    fore: [],
    hind: [],
    tails: [tail],
    neck: [0, 0, 0],
    neckR: 0.085,
    top: [0, 0.09, 0],
    tilt: false,
    float: 0.25,
    span: 0.3,
    fx: (t, moving) => {
      b.rotation.z = Math.sin(t * 3) * 0.05;
      tail.rotation.y = Math.sin(t * (moving ? 14 : 6)) * 0.5;
      bubbles.forEach((m, i) => {
        const u = (t * 0.45 + i / 3) % 1;
        m.position.set(0.02 + Math.sin(u * 8) * 0.015, 0.1 + u * 0.28, 0.14);
        m.scale.setScalar(Math.max(0.01, 1 - u * 0.3) * (u > 0.95 ? 0.01 : 1));
      });
    },
  };
}

/** A ghost: it says it exists. A sheet with a face and a wavy hem. */
function ghost(b: Model, f: Model): Rig {
  void f;
  const sheet = glass("#f4f6ff", 0.82);
  b.ball(0.13, sheet, [0, 0.2, 0.0], [1, 1.05, 1]);
  b.cyl(0.13, 0.17, sheet, [0, 0.03, 0.0], 0.13, 14);
  const hem: Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    hem.push(b.ball(0.045, sheet, [Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1], [1, 1.2, 1], 8));
  }
  for (const s of SIDES) b.ball(0.05, sheet, [s * 0.15, 0.12, 0.02], [0.5, 1.2, 0.7], 8);
  const head = b.part([0, 0.2, 0]);
  const eyes: Mesh[] = [];
  for (const s of SIDES) eyes.push(eyeBall(head, [s * 0.05, 0.02, 0.118], INK, 0.025));
  head.ball(0.02, INK, [0, -0.035, 0.125], [1, 1.3, 0.4], 8);
  light(head, [0, 0, 0.2], "#cfe0ff", 0.8, 2.6);
  return {
    head,
    eyes,
    fore: [],
    hind: [],
    tails: [],
    neck: [0, -0.1, 0],
    neckR: 0.12,
    top: [0, 0.13, 0],
    tilt: false,
    float: 0.12,
    span: 0.3,
    fx: (t) => {
      for (const [i, m] of hem.entries()) m.position.y = 0.03 + Math.sin(t * 4 + i) * 0.025;
      b.rotation.z = Math.sin(t * 1.5) * 0.04;
    },
  };
}

/** The Singularity orb: a tiny black hole with a glowing ring, floating off the ground. */
function orb(b: Model, f: Model): Rig {
  void f;
  const core = b.ball(0.11, "#14101f", [0, 0, 0], [1, 1, 1], 16);
  void core;
  const ring = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 28), glow("#9b6fd6"));
  disc.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 6, 28), glow("#ffd27a"));
  rim.rotation.x = Math.PI / 2;
  ring.add(disc, rim);
  ring.rotation.z = 0.35;
  b.add(ring);
  const eyes: Mesh[] = [];
  const head = b.part([0, 0, 0]);
  light(head, [0, 0.1, 0.2], "#9b6fd6", 1.1, 3);
  return {
    head,
    eyes,
    fore: [],
    hind: [],
    tails: [],
    neck: [0, -0.1, 0],
    neckR: 0.13,
    top: [0, 0.14, 0],
    tilt: false,
    float: 0.3,
    span: 0.3,
    fx: (t) => {
      ring.rotation.y = t * 1.6;
      ring.rotation.x = Math.sin(t * 0.8) * 0.2;
    },
  };
}

// MARK: Pet gear and the crown

/** Gear sits on the neck or the top of the head; sized by the pet's neck. */
function gear(wear: number, rig: Rig): { group: Model; spin?: THREE.Object3D } | null {
  const w = PETWEAR[wear - 1];
  if (!w) return null;
  const g = new Model();
  const r = rig.neckR;
  const gs = Math.max(0.6, r / 0.09);
  let spin: THREE.Object3D | undefined;
  switch (wear) {
    case 1: // Red bandana: a knot at the back and a point down the chest.
      g.cyl(r * 1.04, 0.035, "#d23c3c", [0, -0.03, 0], r * 1.04, 14);
      g.cyl(0.004, 0.1 * gs, "#d23c3c", [0, -0.14 * gs, r * 0.55], r * 0.95, 4).rotation.y = Math.PI / 4;
      g.ball(0.02, "#962626", [0, -0.015, -r], [1, 1, 1], 6);
      break;
    case 2: // Pink bow.
      for (const s of SIDES)
        g.ball(0.04 * gs, "#ff7fb0", [0.06 * gs + s * 0.04 * gs, 0.01, 0], [1.1, 0.8, 0.5], 8).rotation.z =
          s * 0.3;
      g.ball(0.02 * gs, "#c23a6b", [0.06 * gs, 0.01, 0.005], [1, 1, 1], 6);
      break;
    case 3: // Bow tie.
      for (const s of SIDES)
        g.cyl(0.001, 0.05 * gs, "#2a3a8a", [0, -0.04, r * 0.85], 0.025 * gs, 4).rotation.z =
          s * (Math.PI / 2);
      g.ball(0.016 * gs, "#f5c842", [0, -0.04, r * 0.88], [1, 1, 1], 6);
      break;
    case 4: // Party hat.
      g.cyl(0.05 * gs, 0.14 * gs, "#4f8fe0", [0, -0.005, 0], 0.004, 12);
      g.cyl(0.036 * gs, 0.02 * gs, "#f5d14a", [0, 0.04 * gs, 0], 0.032 * gs, 12);
      g.ball(0.02 * gs, C.white, [0, 0.14 * gs, 0], [1, 1, 1], 8);
      break;
    case 5: // Gold collar with its tag.
      g.cyl(r * 1.03, 0.028, "#f5c842", [0, -0.03, 0], r * 1.03, 14);
      g.ball(0.022, "#fff2a8", [0, -0.05, r * 1.02], [1, 1, 0.5], 8);
      break;
    case 6: {
      // Propeller cap: a yellow cap, three blades that spin.
      g.ball(0.052 * gs, "#f5d14a", [0, 0.0, 0], [1, 0.62, 1], 12);
      g.box([0.07 * gs, 0.012, 0.035 * gs], "#c9971f", [0, 0.0, 0.05 * gs], 0.004);
      g.cyl(0.006, 0.03, "#2b2433", [0, 0.025 * gs, 0], 0.006, 5);
      const hub = g.part([0, 0.055 * gs, 0]);
      (["#e0584f", "#3ddc84", "#4f8fe0"] as const).forEach((c, i) => {
        const blade = hub.part([0, 0, 0], (i * Math.PI * 2) / 3);
        blade.box([0.016, 0.006, 0.06 * gs], c, [0, 0, 0.032 * gs], 0.002);
      });
      spin = hub;
      break;
    }
    case 7: // Winter scarf: red and white rings, an end hanging down the shoulder.
      for (let i = 0; i < 3; i++)
        g.cyl(r * 1.08, 0.022, i % 2 ? C.white : "#d23c3c", [0, -0.055 + i * 0.02, 0], r * 1.08, 14);
      for (let i = 0; i < 4; i++)
        g.box(
          [0.03, 0.025, 0.012],
          i % 2 ? C.white : "#d23c3c",
          [r * 0.8, -0.1 - i * 0.025, r * 0.55],
          0.004,
        );
      break;
  }
  return { group: g, spin };
}

/** The Lv50 crown: gold with a red stone, and a few stars about it. */
function makeCrown(rig: Rig, lift: number): { group: Model; stars: Mesh[] } {
  const g = new Model();
  const s = Math.max(0.7, rig.neckR / 0.09);
  g.cyl(0.05 * s, 0.03 * s, "#c98e22", [0, lift, 0], 0.05 * s, 14);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.cyl(
      0.015 * s,
      0.045 * s,
      "#ffe066",
      [Math.cos(a) * 0.04 * s, lift + 0.02 * s, Math.sin(a) * 0.04 * s],
      0.002,
      4,
    );
  }
  g.ball(0.014 * s, glow("#e0405a"), [0, lift + 0.015 * s, 0.052 * s], [1, 1, 0.6], 8);
  const stars = [0, 1, 2].map(() => g.ball(0.011, glow("#fff1a8"), [0, 0, 0], [1, 1, 1], 4));
  return { group: g, stars };
}

/** A little lit "z" made of three bars. */
function zGlyph(): Model {
  const z = new Model();
  const lit = glow("#eef4ff");
  z.box([0.12, 0.035, 0.035], lit, [0, 0.1, 0], 0.008);
  z.box([0.12, 0.035, 0.035], lit, [0, 0, 0], 0.008);
  z.box([0.15, 0.035, 0.035], lit, [0, 0.05, 0], 0.008).rotation.z = 0.85;
  z.visible = false;
  return z;
}

// MARK: The pet

/** A pet from the 2D game. Same `root` / `moving` / `update(t)` as `avatar.ts`'s `Pet`, plus poses and gear. */
export class Pet3D {
  readonly root = new Model();
  moving = false;
  pose: PetPose = "stand";
  /** `Look.petwear`: 0 is none, 1 to 7 the gear (`PETWEAR`). */
  wear = 0;
  /** An owner at Lv50 and above has their pet crowned. */
  crown = false;
  private readonly lift = this.root.part();
  private readonly body: Model;
  private readonly fore: Model;
  private readonly rig: Rig;
  private sit = 0;
  private sleep = 0;
  private last = 0;
  private blinkAt = 2;
  private worn = 0;
  private wornGroup?: THREE.Object3D;
  private spin?: THREE.Object3D;
  private crowned: {
    group: THREE.Object3D;
    stars: Mesh[];
    lifted: boolean;
  } | null = null;
  private readonly zs = [zGlyph(), zGlyph(), zGlyph()];

  constructor(
    readonly species: Species,
    readonly variant = "",
    /** The costume id when named like a 2D Easter egg. */
    readonly outfit: string | null = null,
  ) {
    const b = new Model();
    const f = new Model();
    switch (species) {
      case "duck":
        this.rig = duck(b, f, variant);
        break;
      case "cat":
      case "dog":
      case "panda":
      case "forkedcat":
        this.rig = quad(b, f, quadFor(species, variant, outfit));
        break;
      case "dragon":
        this.rig = dragon(b, f, variant);
        break;
      case "golem":
        this.rig = golem(b, f);
        break;
      case "goldfish":
        this.rig = goldfish(b, f);
        break;
      case "ghost":
        this.rig = ghost(b, f);
        break;
      default:
        this.rig = orb(b, f);
    }
    // Stand centred on the root, nose towards +z.
    b.position.z = f.position.z = -this.rig.span / 2;
    this.body = b;
    this.fore = f;
    this.lift.add(b, f);
    this.lift.position.y = this.rig.float ?? 0;
    for (const z of this.zs) this.root.add(z);
  }

  /** The tag a pet is shown under. */
  get label(): string {
    return PET_NAME[this.species];
  }

  update(t: number): void {
    const dt = Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    const r = this.rig;
    const k = 1 - Math.exp(-dt * 7);
    this.sit += ((this.pose === "sit" ? 1 : 0) - this.sit) * k;
    this.sleep += ((this.pose === "sleep" ? 1 : 0) - this.sleep) * k;
    const si = this.sit;
    const sl = this.sleep;
    const walk = this.moving && this.pose === "stand";
    const b = this.body;
    // Posture: sit back on the haunches (or settle); lie down curled up and breathe.
    const breath = Math.sin(t * 2.2) * 0.025 * sl;
    b.rotation.x = r.tilt ? -0.62 * si : 0;
    b.rotation.z = walk ? Math.sin(t * 14) * 0.06 : 0;
    b.position.y = (r.tilt ? 0 : -0.07 * si) - 0.04 * sl + (walk ? Math.abs(Math.sin(t * 14)) * 0.04 : 0);
    b.scale.set(1 + 0.05 * sl, 1 - 0.28 * sl + breath, 1);
    this.fore.position.y = b.position.y;
    r.head.rotation.x = (r.tilt ? 0.55 * si : 0) + 0.6 * sl;
    const stretch = r.tilt ? 1 + 1.3 * si : 1 - 0.2 * si;
    for (const l of r.fore) l.scale.y = l.userData.paw ? 1 : stretch * (1 - 0.7 * sl);
    for (const l of r.hind) l.scale.y = l.userData.paw ? 1 : (1 - 0.5 * si) * (1 - 0.7 * sl);
    this.lift.position.y = (r.float ?? 0) * (1 - 0.75 * sl) + (r.float ? Math.sin(t * 2) * 0.03 : 0);
    // Eyes: blink now and then, shut when asleep.
    if (t > this.blinkAt + 0.12) this.blinkAt = t + 2 + ((t * 7) % 3);
    const shut = Math.max(sl, t > this.blinkAt && t < this.blinkAt + 0.12 ? 1 : 0);
    for (const e of r.eyes) e.scale.y = (e.userData.sy ?? 1) * (1 - 0.88 * shut);
    for (const [i, tl] of r.tails.entries())
      tl.rotation.y = Math.sin(t * (walk ? 12 : 3) + i) * (0.5 - 0.35 * sl);
    r.fx?.(t, walk);
    // Gear and crown come off when asleep (the 2D pet curls up without them).
    this.syncGear();
    const dressed = sl < 0.5;
    if (this.wornGroup) this.wornGroup.visible = dressed;
    if (this.spin) this.spin.rotation.y = t * (walk ? 30 : 12);
    if (this.crowned) {
      this.crowned.group.visible = dressed;
      this.crowned.stars.forEach((s, i) => {
        const a = t * 2 + (i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.1, 0.08 + Math.sin(t * 3 + i) * 0.03, Math.sin(a) * 0.1);
        s.scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(t * 4 + i * 2)));
      });
    }
    // z, z, z.
    this.zs.forEach((z, i) => {
      const u = (t * 0.45 + i / 3) % 1;
      z.position.set(0.1 + u * 0.12, 0.28 + u * 0.3 + (r.float ?? 0), 0.04);
      z.scale.setScalar(1.1 + u * 0.8);
      z.rotation.y = Math.PI / 4;
      z.visible = sl > 0.6 && u < 0.92;
    });
  }

  private syncGear(): void {
    const r = this.rig;
    const hat = PETWEAR[this.wear - 1]?.at === "top";
    if (this.worn !== this.wear) {
      this.wornGroup?.removeFromParent();
      this.wornGroup = this.spin = undefined;
      const g = gear(this.wear, r);
      if (g) {
        g.group.position.set(...(PETWEAR[this.wear - 1]?.at === "top" ? r.top : r.neck));
        r.head.add(g.group);
        this.wornGroup = g.group;
        this.spin = g.spin;
      }
      this.worn = this.wear;
    }
    if (this.crown !== !!this.crowned || (this.crowned && this.crowned.lifted !== hat)) {
      this.crowned?.group.removeFromParent();
      this.crowned = null;
      if (this.crown) {
        const c = makeCrown(r, hat ? 0.12 : 0);
        c.group.position.set(...r.top);
        r.head.add(c.group);
        this.crowned = { ...c, lifted: hat };
      }
    }
  }
}

/**
 * The 3D twin of a 2D pet. `species` is `Look.pet` (1 duck, 2 cat, 3 dog, 4 dragon, 5 panda, 6 Singularity
 * orb, 7 to 10 the boss-loot pets) or its name; `variant` is `Look.petVariant` (0 the original, n the
 * n-th of `PET_VARIANTS`) or the variation's id; `name` is the pet's name, which dresses Penny and Nemo.
 */
export function petFrom2D(species: number | string, variant: number | string = 0, name = ""): Pet3D {
  const sp: Species = (typeof species === "number" ? PET_SPECIES[species] : (species as Species)) ?? "duck";
  const id =
    typeof variant === "number" ? (variant > 0 ? (PET_VARIANTS[sp]?.[variant - 1] ?? "") : "") : variant;
  const clean = name.trim().toLowerCase();
  const outfit = clean
    ? (PET_NAMED.find((n) => n.name.toLowerCase() === clean && n.species === sp && n.variant === id)?.art ??
      null)
    : null;
  return new Pet3D(sp === "none" ? "duck" : sp, id, outfit);
}

// MARK: Pet bed (tile Q)

/** A round cushion basket: woven wall, blue cushion with a few pillow dots. */
function petBed(): Model {
  const m = new Model();
  m.cyl(0.4, 0.05, C.woodDark, [0, 0, 0], 0.4, 24);
  const ring = (r: number, tube: number, y: number, c: string) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 28), toon(c));
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    t.castShadow = t.receiveShadow = true;
    m.add(t);
  };
  ring(0.36, 0.085, 0.12, C.woodDark);
  ring(0.36, 0.03, 0.2, C.woodLight);
  // The weave: short uprights round the outside.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    m.box([0.03, 0.12, 0.03], C.wood, [Math.cos(a) * 0.43, 0.04, Math.sin(a) * 0.43], 0.008).rotation.y = -a;
  }
  m.cyl(0.31, 0.1, C.fabric, [0, 0.03, 0], 0.31, 24);
  m.cyl(0.31, 0.012, C.fabricDark, [0, 0.12, 0], 0.31, 24);
  m.cyl(0.24, 0.012, C.fabric, [0, 0.128, 0], 0.24, 24);
  for (const [x, z] of [
    [-0.12, 0.08],
    [0.1, -0.12],
    [0.15, 0.1],
  ] as const)
    m.ball(0.022, C.pillow, [x, 0.145, z], [1, 0.4, 1], 6);
  return m;
}

export const PETS_ASSETS: readonly Asset[] = [
  {
    id: "tile:Q",
    name: "Pet bed",
    price: 0,
    w: 1,
    d: 1,
    build: petBed,
    bed: [0, 0.12, 0],
  },
];

// MARK: The gallery

interface Entry {
  species: Species;
  variant?: string;
  name?: string;
  pose?: PetPose;
  wear?: number;
  crown?: boolean;
  text?: string;
}

const row = (species: Species): Entry[] => [
  { species },
  ...(PET_VARIANTS[species] ?? []).map((variant) => ({ species, variant })),
];

/** Every look on one floor: a row per species, then the loot pets, poses and the named pets, then gear. */
const GALLERY_ROWS: Entry[][] = [
  row("duck"),
  row("cat"),
  row("dog"),
  row("dragon"),
  row("panda"),
  (["orb", "golem", "goldfish", "forkedcat", "ghost"] as const).map((species) => ({ species })),
  [
    {
      species: "dog",
      variant: "greyhound",
      name: "Penny",
      text: "Penny (sweater)",
    },
    { species: "dog", variant: "pug", name: "Nemo", text: "Nemo (Wookiee)" },
    { species: "cat", variant: "tuxedo", pose: "sit", text: "Cat · sitting" },
    { species: "dog", pose: "sit", text: "Dog · sitting" },
    {
      species: "dragon",
      variant: "gold",
      pose: "sit",
      text: "Dragon · sitting",
    },
    { species: "cat", variant: "calico", pose: "sleep", text: "Cat · asleep" },
    { species: "dog", variant: "corgi", pose: "sleep", text: "Corgi · asleep" },
    { species: "panda", pose: "sleep", text: "Panda · asleep" },
    {
      species: "duck",
      variant: "mallard",
      pose: "sleep",
      text: "Duck · asleep",
    },
    { species: "dog", variant: "husky", crown: true, text: "Lv50 crown" },
  ],
  PETWEAR.map((w, i) => ({
    species: "dog" as Species,
    variant: "shiba",
    wear: i + 1,
    text: w.name,
  })),
];

export interface PetGallery {
  group: THREE.Group;
  labels: { text: string; at: THREE.Vector3 }[];
  size: { w: number; d: number };
  update: (dt: number, t: number) => void;
}

/** Everything, laid out for the "Pets" stage; the bed (with a sleeper in it) ends the gear row. */
export function buildPetGallery(): PetGallery {
  const group = new THREE.Group();
  const labels: PetGallery["labels"] = [];
  const pets: Pet3D[] = [];
  const stepX = 1.45;
  const stepZ = 2;
  const cols = Math.max(...GALLERY_ROWS.map((r) => r.length)) + 2;
  const w = cols * stepX + 1;
  const d = GALLERY_ROWS.length * stepZ + 1;
  const tex = checker("#e8dcc4", "#dccdb0", 2);
  tex.repeat.set(w / 2, d / 2);
  const side = toon(tint("#dccdb0", -0.4));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), [
    side,
    side,
    painted(tex),
    side,
    side,
    side,
  ]);
  floor.position.set(0, -0.15, 0);
  floor.receiveShadow = true;
  group.add(floor);
  const at = (c: number, r: number) =>
    new THREE.Vector3(
      c * stepX - (cols * stepX) / 2 + stepX,
      0,
      r * stepZ - (GALLERY_ROWS.length * stepZ) / 2 + stepZ * 0.5,
    );
  const tag = (text: string, p: THREE.Vector3) =>
    labels.push({ text, at: p.clone().add(new THREE.Vector3(0, 0, 0.75)) });
  GALLERY_ROWS.forEach((entries, r) => {
    const first = entries[0]!;
    tag(r < 6 ? PET_NAME[first.species].toUpperCase() : ["POSES AND COSTUMES", "PET GEAR"][r - 6]!, at(0, r));
    entries.forEach((e, c) => {
      const p = petFrom2D(e.species, e.variant ?? "", e.name ?? "");
      p.pose = e.pose ?? "stand";
      p.wear = e.wear ?? 0;
      p.crown = !!e.crown;
      p.root.position.copy(at(c + 1, r));
      p.root.rotation.y = Math.PI / 4;
      group.add(p.root);
      pets.push(p);
      tag(e.text ?? e.variant ?? (r < 5 ? "original" : PET_NAME[e.species]), at(c + 1, r));
    });
  });
  const lastRow = GALLERY_ROWS.length - 1;
  for (const a of PETS_ASSETS) {
    const bed = a.build();
    const p = at(GALLERY_ROWS[lastRow]!.length + 1, lastRow);
    bed.position.copy(p);
    group.add(bed);
    tag(`${a.name} (tile Q)`, p);
    const sleeper = petFrom2D("cat", "witch");
    sleeper.pose = "sleep";
    sleeper.root.position.copy(p).add(new THREE.Vector3(0, 0.15, 0));
    group.add(sleeper.root);
    pets.push(sleeper);
  }
  return {
    group,
    labels,
    size: { w, d },
    update: (_dt, t) => {
      for (const p of pets) p.update(t);
    },
  };
}
