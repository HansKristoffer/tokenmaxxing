/**
 * The Julemarked stall pets (core/src/julemarked-shop.ts, pet.900 and pet.901), sharp and blocky: boxes only, no round
 * helpers. Gråspurv is a house sparrow in a tiny red scarf; Snehare is a white snow hare with long ears and a tiny tail.
 */
import type * as THREE from "three";
import { Model } from "../kit/kit.ts";
import { type Built, DARK, GLINT, joint, put, SIDES, speckle, U } from "./pets3d-night.ts";
import { type Cell, eye, Grid } from "./petvox.ts";

const SCARF = "#b8302c";
const SCARF_D = "#8e2422";
const CREAM = "#f4ecd8";

function eyePair(head: Model, x: number, y: number, z: number): THREE.Mesh[] {
  return SIDES.map((s) => {
    const e = eye([[DARK, GLINT]]);
    e.rotation.y = s * 0.9;
    e.position.set(U(s * x), U(y), U(z));
    head.add(e);
    return e;
  });
}

// MARK: Gråspurv

/** A fluffed-up house sparrow: grey crown, chestnut nape, streaked brown back, black bib, a small red scarf. */
export function graaspurv(): Built {
  const body = new Model();
  const fore = new Model();
  const BROWN = "#8a6a48";
  const STREAK = "#4a3a2c";
  const CHEST = "#9c5a34";
  const GREY = "#a8a29a";
  const BELLY = "#dcd4c4";
  const bg = new Grid();
  bg.box(-4, 4, 4, 10, -4, 4, (c) => {
    if (c.t < 0.3) return BELLY;
    if (c.u > 0.5 && c.t < 0.7) return speckle(c, GREY, "#b9b3aa", 2, 0.25);
    return Math.floor(c.z / 2) % 2 === 0 ? BROWN : STREAK;
  });
  bg.box(-3, 3, 10, 11, -3, 3, BROWN);
  // Tail: two stepped slabs angled up.
  bg.box(-1, 1, 7, 8, -8, -5, STREAK);
  bg.box(-1, 1, 8, 9, -10, -8, "#3a2e24");
  put(body, bg, [0, 0, 0], 1);
  // Folded wings: chestnut slabs along the sides with a pale bar.
  for (const s of SIDES) {
    const wg = new Grid();
    wg.box(0, 0, 0, 3, -4, 2, (c) => (c.z === 0 ? "#efe6d2" : speckle(c, CHEST, "#6f4026", 6, 0.3)));
    put(body, wg, [s * 5, 6, -1], 5);
  }
  const feet: Model[] = [];
  for (const s of SIDES) {
    const fg = new Grid();
    fg.box(0, 0, 0, 3, 0, 0, "#6a5040");
    fg.box(-1, 1, 0, 0, 1, 2, "#6a5040");
    const j = joint(body, [s * 2, 3.4, 0.5]);
    put(j, fg, [0, -3, 0], 7);
    feet.push(j);
  }
  const head = joint(body, [0, 12, 3]);
  const hg = new Grid();
  hg.box(-3, 3, -3, 3, -3, 3, (c: Cell) => {
    if (c.y >= 1 && c.z > -3) return GREY;
    if (c.z <= -2 && c.y >= -1) return CHEST;
    if (c.y <= -2 && c.z >= 1) return "#1f1a18";
    if (c.y >= -1 && c.y <= 0 && Math.abs(c.x) >= 3) return CHEST;
    return "#d8d0c0";
  });
  // Short thick beak.
  hg.box(-1, 1, -1, 0, 4, 4, "#5a4a3c");
  hg.box(0, 0, 0, 0, 5, 5, "#4a3a30");
  put(head, hg, [0, 0, 0], 2);
  // The scarf: a red band round the neck, a knot and two short tails hanging at the chest.
  const sc = new Grid();
  sc.box(-4, 4, 0, 1, -3, 3, (c) => (Math.floor((c.x + 8) / 2) % 2 ? SCARF : SCARF_D));
  sc.box(-1, 0, -3, -1, 3, 4, SCARF);
  sc.box(1, 2, -4, -1, 3, 3, SCARF_D);
  sc.box(-3, -3, 0, 0, -3, 3, CREAM);
  put(head, sc, [0, -3, 0], 3);
  const eyeMeshes = eyePair(head, 3.2, 0.6, 1.4);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2.5), U(0.5)],
      neckR: U(3.4),
      top: [0, U(3), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        const h = Math.max(0, Math.sin(t * (moving ? 12 : 2.6))) ** 2;
        body.position.y = U(h * (moving ? 3 : 1.4));
        body.rotation.x = -h * 0.1;
        const peck = moving ? 0 : Math.max(0, Math.sin(t * 1.3 + 2)) ** 8 * 0.6;
        head.rotation.x = peck;
        head.rotation.y = Math.sin(t * 0.9) * 0.35 * (moving ? 0.2 : 1);
        for (const f of feet) f.rotation.x = -h * 0.35;
      },
    },
    body,
    fore,
  };
}

// MARK: Snehare

/** A white snow hare: a long boxy body, big hind haunches, tall ears with grey-black tips, a tiny cream tail. */
export function snehare(): Built {
  const body = new Model();
  const fore = new Model();
  const SNOW = "#f2f5f8";
  const SNOW_D = "#d7dee6";
  const SHADE = "#c3ccd8";
  const bg = new Grid();
  bg.box(-3, 3, 5, 11, -6, 5, (c) => (c.t < 0.25 ? SNOW_D : speckle(c, SNOW, SNOW_D, 3, 0.25)));
  // The haunch: a taller block at the back.
  bg.box(-4, 4, 4, 12, -8, -2, (c) => speckle(c, SNOW, SHADE, 5, 0.2));
  // Tiny tail.
  bg.box(-1, 0, 8, 9, -10, -9, "#ffffff");
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  const mk = (z: number, s: number, len: number, w: number, phase: number, seed: number) => {
    const j = joint(body, [s * 3, len + 1, z]);
    const g = new Grid();
    g.box(-1, 0, -len + 1, -1, 0, w, SNOW_D);
    g.box(-1, 0, -len, -len, 0, w + 1, SHADE);
    put(j, g, [0, 0, 0], seed);
    legs.push({ j, phase });
  };
  for (const [si, s] of SIDES.entries()) {
    mk(4, s, 4, 1, si * Math.PI, 5);
    mk(-5, s, 4, 2, si * Math.PI + Math.PI, 6);
  }
  const head = joint(body, [0, 11, 5.5]);
  const hg = new Grid();
  hg.box(-2, 2, -2, 2, -2, 3, (c) => speckle(c, SNOW, SNOW_D, 6, 0.2));
  hg.box(-1, 1, -2, -1, 3, 4, "#ffffff");
  hg.box(0, 0, 0, 0, 4, 4, "#e8a0a8");
  // Ears: long slabs standing up and back a little, pink inside, dark tip.
  for (const s of SIDES) {
    const x0 = s === -1 ? -2 : 1;
    hg.box(x0, x0 + 1, 3, 8, -2, -1, SNOW);
    hg.box(x0, x0 + 1, 9, 9, -2, -1, "#4a4e58");
    hg.box(x0 + (s === -1 ? 1 : 0), x0 + (s === -1 ? 1 : 0), 4, 8, -1, -1, "#eab4b8");
  }
  put(head, hg, [0, 0, 0], 2);
  const eyeMeshes = eyePair(head, 2.1, 0.8, 1.4);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2), U(0)],
      neckR: U(2.6),
      top: [0, U(3), 0],
      tilt: false,
      span: U(12),
      fx: (t, moving) => {
        for (const l of legs) l.j.rotation.x = moving ? Math.sin(t * 12 + l.phase) * 0.7 : 0;
        const hop = moving ? Math.abs(Math.sin(t * 6)) : 0;
        body.position.y = U(hop * 2);
        head.rotation.y = Math.sin(t * 0.6) * 0.25;
        head.rotation.x = Math.max(0, Math.sin(t * 1.1)) ** 10 * 0.25;
      },
    },
    body,
    fore,
  };
}


// MARK: Pindsvin

/** A hedgehog: a stepped-box back of brown spines, a pale face and snout, tiny dark feet. */
export function pindsvin(): Built {
  const body = new Model();
  const fore = new Model();
  const SPINE = "#6a4a30";
  const SPINE_D = "#3e2a1c";
  const SPINE_L = "#9a7448";
  const PALE = "#e6cfa6";
  const bg = new Grid();
  // Pale belly, then the spiny back in three stepped layers with speckled tips.
  bg.box(-3, 3, 2, 4, -5, 4, PALE);
  bg.box(-4, 4, 4, 8, -6, 4, (c) => speckle(c, SPINE, SPINE_D, 3, 0.4));
  bg.box(-3, 3, 8, 10, -6, 3, (c) => speckle(c, SPINE, SPINE_L, 4, 0.4));
  bg.box(-2, 2, 10, 11, -5, 1, (c) => speckle(c, SPINE_L, SPINE_D, 5, 0.4));
  // Individual spine tips poking out at the back.
  bg.box(-2, -1, 6, 7, -7, -7, SPINE_D);
  bg.box(1, 2, 7, 8, -7, -7, SPINE_D);
  put(body, bg, [0, 0, 0], 1);
  const feet: { j: Model; phase: number }[] = [];
  for (const [si, s] of SIDES.entries()) {
    for (const [zi, z] of [3, -4].entries()) {
      const j = joint(body, [s * 2.5, 2.2, z]);
      const g = new Grid();
      g.box(-1, 0, -2, 0, 0, 1, "#5a4030");
      g.box(-1, 0, -2, -2, 1, 2, "#3e2a1c");
      put(j, g, [0, 0, 0], 8);
      feet.push({ j, phase: (si + zi) * Math.PI });
    }
  }
  const head = joint(body, [0, 5, 5]);
  const hg = new Grid();
  hg.box(-3, 3, -3, 2, -2, 3, (c: Cell) => (c.y >= 1 && c.z <= -1 ? SPINE : PALE));
  // Pointed snout in two steps ending in a dark nose.
  hg.box(-2, 2, -2, 0, 4, 5, PALE);
  hg.box(-1, 1, -1, 0, 6, 6, PALE);
  hg.box(0, 0, -1, 0, 7, 7, "#241a16");
  // Small round-ish ears (blocky) on the sides of the head.
  for (const s of SIDES) {
    const x = s === -1 ? -4 : 3;
    hg.box(x, x, 2, 3, -1, 0, "#caa57a");
  }
  put(head, hg, [0, 0, 0], 2);
  const eyeMeshes = eyePair(head, 3.7, 0.2, 1.6);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-1), U(0.5)],
      neckR: U(3),
      top: [0, U(3), 0],
      tilt: false,
      span: U(7),
      fx: (t, moving) => {
        for (const f of feet) f.j.rotation.x = moving ? Math.sin(t * 16 + f.phase) * 0.6 : 0;
        body.position.y = U(moving ? Math.abs(Math.sin(t * 16)) * 0.6 : 0);
        body.scale.y = 1 + (moving ? 0 : Math.sin(t * 2.2) * 0.015);
        head.rotation.y = Math.sin(t * 0.8) * 0.3 * (moving ? 0.3 : 1);
        head.rotation.x = Math.max(0, Math.sin(t * 1.4)) ** 6 * 0.3;
      },
    },
    body,
    fore,
  };
}

// MARK: Rødt egern

/** A red squirrel: a rust body, cream belly, ear tufts and a huge stepped bushy tail curling over its back. */
export function egern(): Built {
  const body = new Model();
  const fore = new Model();
  const RUST = "#b8541e";
  const RUST_D = "#8a3a14";
  const RUST_L = "#d9742c";
  const BELLY = "#f4e4c4";
  const bg = new Grid();
  bg.box(-3, 3, 3, 9, -3, 3, (c) => (c.t < 0.3 && c.z > -2 ? BELLY : speckle(c, RUST, RUST_D, 3, 0.25)));
  bg.box(-3, 3, 2, 3, -5, -3, RUST_D);
  put(body, bg, [0, 0, 0], 1);
  // Tail: stepped slabs rising up and over the back, widening, with pale tip.
  const tail = joint(body, [0, 4, -4]);
  const tg = new Grid();
  tg.box(-1, 1, 0, 3, -2, 0, RUST_D);
  tg.box(-2, 2, 3, 7, -3, -1, (c) => speckle(c, RUST, RUST_D, 6, 0.3));
  tg.box(-3, 3, 7, 12, -4, -1, (c) => speckle(c, RUST_L, RUST, 7, 0.35));
  tg.box(-3, 3, 11, 14, -2, 0, (c) => speckle(c, RUST_L, RUST, 8, 0.35));
  tg.box(-2, 2, 14, 15, -1, 0, CREAM);
  put(tail, tg, [0, 0, 0], 3);
  const legs: { j: Model; phase: number }[] = [];
  for (const [si, s] of SIDES.entries()) {
    for (const [zi, z] of [2.5, -2.5].entries()) {
      const j = joint(body, [s * 2.5, 4, z]);
      const g = new Grid();
      g.box(-1, 0, -3, -1, 0, 1, RUST_D);
      g.box(-1, 0, -4, -4, 0, 2, "#3e2418");
      put(j, g, [0, 0, 0], 9);
      legs.push({ j, phase: (si + zi) * Math.PI });
    }
  }
  const head = joint(body, [0, 9, 3]);
  const hg = new Grid();
  hg.box(-3, 3, -3, 3, -2, 3, (c: Cell) => (c.y <= -1 && c.z >= 1 ? BELLY : speckle(c, RUST, RUST_L, 2, 0.2)));
  hg.box(-1, 1, -2, -1, 4, 4, BELLY);
  hg.box(0, 0, 0, 0, 4, 5, "#2a1a14");
  // Ears with long dark tufts.
  for (const s of SIDES) {
    const x0 = s === -1 ? -3 : 2;
    hg.box(x0, x0 + 1, 3, 5, -1, 0, RUST);
    hg.box(x0, x0 + 1, 6, 8, -1, 0, "#3e2418");
  }
  put(head, hg, [0, 0, 0], 2);
  const eyeMeshes = eyePair(head, 3.7, 0.8, 1.6);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2), U(0)],
      neckR: U(3),
      top: [0, U(4), 0],
      tilt: false,
      span: U(8),
      fx: (t, moving) => {
        for (const l of legs) l.j.rotation.x = moving ? Math.sin(t * 13 + l.phase) * 0.7 : 0;
        const hop = moving ? Math.abs(Math.sin(t * 6.5)) : 0;
        body.position.y = U(hop * 1.8);
        tail.rotation.x = Math.sin(t * (moving ? 6.5 : 1.8)) * 0.08;
        head.rotation.y = Math.sin(t * 0.7) * 0.3;
        head.rotation.x = Math.max(0, Math.sin(t * 1.2)) ** 8 * 0.3;
      },
    },
    body,
    fore,
  };
}

// MARK: Sælunge

/** A grey seal pup: a chubby spotted slab of a body, flippers, a big dark-eyed head with whisker pads. */
export function saelunge(): Built {
  const body = new Model();
  const fore = new Model();
  const GREY = "#a8aeb6";
  const GREY_D = "#7e858f";
  const BELLY = "#e4e8ec";
  const bg = new Grid();
  bg.box(-4, 4, 1, 8, -4, 4, (c) => (c.t < 0.3 ? BELLY : speckle(c, GREY, GREY_D, 4, 0.3)));
  bg.box(-3, 3, 2, 7, -7, -4, (c) => speckle(c, GREY, GREY_D, 5, 0.3));
  bg.box(-2, 2, 2, 5, -9, -7, GREY_D);
  put(body, bg, [0, 0, 0], 1);
  // Tail flippers: two flat blocks splayed at the back.
  const rear: Model[] = [];
  for (const s of SIDES) {
    const j = joint(body, [s * 2, 2.5, -8]);
    const g = new Grid();
    g.box(-1, 1, 0, 0, -3, 0, GREY_D);
    g.box(s === 1 ? 1 : -2, s === 1 ? 2 : -2, 0, 0, -4, 0, GREY_D);
    put(j, g, [0, 0, 0], 6);
    rear.push(j);
  }
  // Front flippers at the sides.
  const flips: { j: Model; phase: number }[] = [];
  for (const [si, s] of SIDES.entries()) {
    const j = joint(body, [s * 4.5, 4.5, 2]);
    const g = new Grid();
    g.box(0, 1, -3, 0, -1, 2, GREY_D);
    g.box(0, 1, -4, -3, 0, 3, "#5e656f");
    put(j, g, [s === -1 ? -1.5 : 0, 0, 0], 7);
    flips.push({ j, phase: si * Math.PI });
  }
  const head = joint(body, [0, 7, 4]);
  const hg = new Grid();
  hg.box(-4, 4, -3, 3, -3, 3, (c: Cell) => speckle(c, GREY, GREY_D, 2, 0.2));
  // Pale muzzle with whisker pads and a dark nose.
  hg.box(-3, 3, -3, 0, 3, 4, BELLY);
  hg.box(0, 0, 0, 1, 4, 4, "#1c1c22");
  for (const s of SIDES) {
    const x = s === -1 ? -4 : 3;
    hg.box(x, x, -2, -1, 3, 4, "#ffffff");
    hg.box(x, x, 0, 0, 4, 4, "#c9ced4");
  }
  put(head, hg, [0, 0, 0], 2);
  const eyeMeshes = eyePair(head, 4.7, 1.2, 1.8);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2), U(0)],
      neckR: U(4),
      top: [0, U(3), 0],
      tilt: false,
      span: U(9),
      fx: (t, moving) => {
        // A seal hump: the body arches forward as it hauls itself along.
        const w = moving ? Math.sin(t * 7) : 0;
        body.position.y = U(Math.abs(w) * 1.2);
        body.rotation.x = w * 0.08;
        for (const f of flips) f.j.rotation.x = moving ? Math.sin(t * 7 + f.phase) * 0.6 : Math.sin(t * 1.5 + f.phase) * 0.06;
        for (const r of rear) r.rotation.y = Math.sin(t * (moving ? 7 : 1.6)) * 0.2;
        head.rotation.y = Math.sin(t * 0.6) * 0.3;
        head.rotation.x = -0.1 + Math.sin(t * 1.1) * 0.06;
      },
    },
    body,
    fore,
  };
}

export const JULEMARKED_STALL_PETS = { graaspurv, snehare, pindsvin, egern, saelunge } as const;
