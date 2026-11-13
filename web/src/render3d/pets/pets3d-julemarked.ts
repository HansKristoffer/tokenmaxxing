/**
 * The Julemarked case's pets (core/src/case-julemarked.ts, pet.800 to pet.805) as voxel sculptures on the same
 * `petvox` grid as the other cases': Rødkælk (a puffed-up robin), Marcipangris (a marzipan pig with a red bow),
 * Nissekat (a grey tabby in a tiny nisse cap), Julesvaneand (the plain duck in a nissehue), Julebuk (the straw Yule
 * goat, bound with red ribbon) and Lygtenisse (a tiny nisse with a lantern). Wool, straw and paper: every red is
 * matte, and the only glowing cells are the lantern's and the candle-gold ones.
 */
import type * as THREE from "three";
import { Model } from "../kit/kit.ts";
import { duck } from "./pets3d-misc.ts";
import { type Built, DARK, GLINT, joint, put, SIDES, speckle, U } from "./pets3d-night.ts";
import { type Cell, eye, Grid, hash } from "./petvox.ts";

const NISSE_RED = "#b8302c";
const NISSE_RED_D = "#8e2422";
const CREAM = "#f4ecd8";

/** A leg that hangs from its hip joint (cells), `len` long and `w` wide, with a foot of its own colour. */
function leg(
  parent: THREE.Object3D,
  at: [number, number, number],
  len: number,
  w: number,
  coat: (c: Cell) => string,
  foot: string,
  seed = 5,
): Model {
  const j = joint(parent, at);
  const g = new Grid();
  const lo = -Math.floor(w / 2);
  const hi = lo + w - 1;
  g.box(lo, hi, -len + 2, -1, lo, hi, (c) => coat({ ...c, t: (c.y + len) / len }));
  g.box(lo, hi, -len, -len + 1, lo, hi + 1, foot);
  put(j, g, [0, 0, 0], seed);
  return j;
}

const stride = (legs: { j: Model; phase: number }[], t: number, moving: boolean, amp = 0.7) => {
  for (const l of legs) l.j.rotation.x = moving ? Math.sin(t * 13 + l.phase) * amp : 0;
};

/** The two eyes of a head, round and glinting, on its sides. */
function eyes(head: Model, x: number, y: number, z: number, rows: string[][], turn = 0.55): THREE.Mesh[] {
  return SIDES.map((s) => {
    const e = eye(rows);
    e.rotation.y = s * turn;
    e.position.set(U(s * x), U(y), U(z));
    head.add(e);
    return e;
  });
}

/** A nisse cap for a head grid: shrinking rings that bend over to one side, a cream rim and (optionally) a pompom. */
function cap(g: Grid, at: [number, number, number], r: number, rows: number, bend: number, pom = false) {
  const [cx, cy, cz] = at;
  g.ell(cx, cy, cz, r + 0.6, 1.1, r + 0.6, CREAM, 2.1);
  for (let i = 0; i < rows; i++) {
    const k = i / rows;
    const rr = Math.max(0.8, r * (1 - k * 0.92));
    g.ell(cx, cy + 1 + i, cz + Math.round(k * k * bend), rr, 0.8, rr, (c) =>
      speckle(c, NISSE_RED, NISSE_RED_D, 3 + i, 0.22),
    );
  }
  if (pom) g.ell(cx, cy + rows + 1, cz + bend, 1.1, 1.1, 1.1, CREAM);
}

// MARK: Rødkælk

/** A robin puffed to twice its size: a round brown back dusted with snow, an orange-red breast, a thin dark beak. */
export function roedkaelk(): Built {
  const body = new Model();
  const fore = new Model();
  const BROWN = "#8b6b4a";
  const BREAST = "#e0642e";
  const bg = new Grid();
  bg.ell(0, 7.2, 0, 5, 5, 5.4, BROWN, 2.1);
  bg.paint((c) => {
    if (c.t > 0.9 && hash(c.x, c.y, c.z, 3) < 0.4) return "#f4f7fa";
    if (c.u > 0.52 && c.t > 0.18 && c.t < 0.78 && c.y < 9) return speckle(c, BREAST, "#c9501f", 2, 0.25);
    if (c.t < 0.22) return "#d9c9a8";
    return speckle(c, BROWN, "#6f533a", 4, 0.3);
  });
  // Tail: a short wedge angled up.
  bg.box(-1, 1, 7, 8, -9, -6, "#6f533a");
  bg.box(-1, 1, 8, 9, -10, -9, "#5a4430");
  put(body, bg, [0, 0, 0], 1);
  // Folded wings: darker slabs along the sides.
  for (const s of SIDES) {
    const wg = new Grid();
    wg.ell(0, 0, 0, 1.2, 3, 4, (c) => speckle(c, "#755a3e", "#5a4430", 6, 0.3), 2.2);
    put(body, wg, [s * 4.6, 7.4, -1], 5);
  }
  const feet: Model[] = [];
  for (const s of SIDES) {
    const fg = new Grid();
    fg.box(0, 0, 0, 2, 0, 0, "#4a3a30");
    fg.box(-1, 1, 0, 0, 1, 2, "#4a3a30");
    const j = joint(body, [s * 1.6, 2.2, 0.5]);
    put(j, fg, [0, -2, 0], 7);
    feet.push(j);
  }
  const head = joint(body, [0, 11.4, 3.2]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3, 2.8, 3, BROWN, 2.2);
  hg.paint((c) => {
    if (c.t > 0.92 && hash(c.x, c.y, c.z, 8) < 0.25) return "#f4f7fa";
    if (c.u > 0.5 && c.t < 0.62) return speckle(c, BREAST, "#c9501f", 9, 0.25);
    return speckle(c, BROWN, "#6f533a", 9, 0.25);
  });
  hg.box(0, 0, -0.5, 0.5, 3, 5, "#2d2420");
  hg.box(-0.4, 0.4, -0.5, -0.5, 3, 4, "#4a3a30");
  put(head, hg, [0, 0, 0], 2);
  const eyeMeshes = eyes(head, 2.7, 0.8, 1.2, [[DARK, GLINT]], 0.9);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2.5), U(0.5)],
      neckR: U(3.2),
      top: [0, U(3), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        // Hops on both feet, pecks now and then, and fluffs its tail.
        const h = Math.max(0, Math.sin(t * (moving ? 12 : 2.8))) ** 2;
        body.position.y = U(h * (moving ? 3 : 1.6));
        body.rotation.x = -h * 0.12;
        const peck = moving ? 0 : Math.max(0, Math.sin(t * 1.4 + 1)) ** 8 * 0.6;
        head.rotation.x = peck + Math.sin(t * 5) * 0.03;
        head.rotation.y = Math.sin(t * 0.9) * 0.35 * (moving ? 0.2 : 1);
        feet.forEach((f) => {
          f.rotation.x = -h * 0.35;
        });
      },
    },
    body,
    fore,
  };
}

// MARK: Marcipangris

/** A marzipan pig: pale pink-beige, a matte sheen, a flat snout, a curl of a tail and a red bow on one ear. */
export function marcipangris(): Built {
  const body = new Model();
  const fore = new Model();
  const MARZ = "#e9c3a6";
  const MARZ_D = "#d2a487";
  const BELLY = "#f2d6bd";
  const bg = new Grid();
  bg.ell(0, 7.2, 0, 5, 4.6, 6.4, MARZ, 2.2);
  bg.paint((c) => (c.t < 0.3 ? BELLY : speckle(c, MARZ, MARZ_D, 4, 0.2)));
  // Curly tail.
  bg.tube(
    [
      [0, 9, -6],
      [0, 11, -8],
      [1, 12, -8],
      [1, 11.5, -6.8],
    ],
    0.8,
    0.6,
    MARZ_D,
  );
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [zi, z] of [3.6, -3.6].entries())
    for (const [si, s] of SIDES.entries())
      legs.push({
        j: leg(body, [s * 3, 3.6, z], 3.6, 3, (c) => (c.t > 0.5 ? MARZ : MARZ_D), "#a97a5e", 5 + zi),
        phase: (zi + si) * Math.PI,
      });
  const head = joint(body, [0, 8, 5.8]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.8, 3.5, 3.4, MARZ, 2.2);
  hg.paint((c) => speckle(c, MARZ, MARZ_D, 6, 0.15));
  // The snout, flat and a little lighter, with two dark nostrils; a hint of a score line across the cheek.
  hg.box(-2, 2, -1.8, 0.8, 3, 4, "#f4d4c2");
  hg.set(-1, -0.5, 4, "#6b3f22").set(1, -0.5, 4, "#6b3f22");
  for (const s of SIDES) {
    hg.box(s * 2, s * 3.2, 3, 4, -1, 0, MARZ_D);
    hg.set(s * 2.6, 3.5, 0, "#e8a898");
  }
  put(head, hg, [0, 0, 0], 2);
  // The red bow on the right ear: two loops and a knot.
  const bow = new Grid();
  bow.box(-1.5, -0.5, 0, 1, 0, 0, NISSE_RED);
  bow.box(1.5, 2.5, 0, 1, 0, 0, NISSE_RED);
  bow.box(0, 1, 0, 1, 0, 1, NISSE_RED_D);
  bow.set(-2, 0, 0, NISSE_RED_D).set(3, 0, 0, NISSE_RED_D);
  put(head, bow, [-3.4, 3.4, -0.5], 11);
  const eyeMeshes = eyes(head, 3.4, 0.9, 2, [[DARK, GLINT]], 0.7);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2.5), U(0.5)],
      neckR: U(3.2),
      top: [0, U(3.5), 0],
      tilt: false,
      span: U(11),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.6);
        head.rotation.x = Math.sin(t * 1.4) * 0.05 + (moving ? Math.sin(t * 13) * 0.04 : 0);
        body.position.y = moving ? U(Math.abs(Math.sin(t * 13)) * 0.5) : 0;
      },
    },
    body,
    fore,
  };
}

// MARK: Nissekat

/** The nisse's cat: a grey tabby with darker stripes, a curled tail that flicks, and a tiny red cap between the ears. */
export function nissekat(): Built {
  const body = new Model();
  const fore = new Model();
  const GREY = "#8f949c";
  const STRIPE = "#5f646e";
  const LIGHT = "#cfd2d6";
  const bg = new Grid();
  bg.ell(0, 7, 0, 3.8, 3.6, 7, GREY, 2.3);
  bg.paint((c) => {
    if (c.t < 0.28) return LIGHT;
    if (c.t > 0.45 && Math.floor((c.z + 20) / 2) % 2 === 0) return speckle(c, STRIPE, "#4a4e58", 3, 0.2);
    return speckle(c, GREY, "#7d828a", 4, 0.2);
  });
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [zi, z] of [4.4, -4.4].entries())
    for (const [si, s] of SIDES.entries())
      legs.push({
        j: leg(body, [s * 2.4, 4, z], 4, 2, (c) => (c.t > 0.5 ? GREY : LIGHT), LIGHT, 5 + zi),
        phase: (zi + si) * Math.PI,
      });
  const head = joint(body, [0, 10.5, 6.2]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.4, 3, 3, GREY, 2.2);
  hg.paint((c) => {
    if (c.u > 0.6 && c.t < 0.5 && Math.abs(c.s) < 0.55) return LIGHT;
    if (c.t > 0.7 && Math.abs(c.x) < 2 && Math.floor((c.x + 10) / 1) % 2 === 0) return STRIPE;
    return speckle(c, GREY, "#7d828a", 6, 0.2);
  });
  hg.set(0, -0.8, 3, "#e59aa0");
  for (const s of SIDES) {
    // Ears: pointed, pink inside.
    hg.box(s * 2, s * 3, 2.5, 4, -1, 0, GREY);
    hg.box(s * 2.2, s * 2.8, 4, 5, -1, -1, GREY);
    hg.set(s * 2.4, 3, 0, "#e8b0b0");
    // Whiskers.
    hg.box(s * 3.5, s * 5, -1, -1, 2, 2, "#e9ecef");
  }
  // The cap: a tiny red cone with a cream rim, tilted over one ear, its tip flopping.
  cap(hg, [0, 3.2, -0.6], 2.4, 5, 3, false);
  put(head, hg, [0, 0, 0], 2);
  const eyeMeshes = eyes(
    head,
    2.7,
    0.5,
    1.8,
    [
      ["#7fc06a", "#7fc06a"],
      [DARK, "#7fc06a"],
    ],
    0.6,
  );
  // A long tail that curls up and over, with a dark tip.
  const tail = joint(body, [0, 8, -7]);
  const tg = new Grid();
  tg.tube(
    [
      [0, 0, 0],
      [0, 1, -3.5],
      [0, 4, -5.5],
      [0, 8, -4.5],
      [0, 10, -2],
    ],
    1.5,
    1.1,
    (c) => (c.u > 0.9 ? "#3f434c" : Math.floor(c.u * 9) % 2 ? STRIPE : GREY),
  );
  put(tail, tg, [0, 0, 0], 4);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2.5), U(-0.5)],
      neckR: U(3),
      top: [0, U(3.2), 0],
      tilt: false,
      span: U(14),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.7);
        const flick = Math.max(0, Math.sin(t * 1.7)) ** 6;
        tail.rotation.z = Math.sin(t * (moving ? 8 : 1.5)) * 0.12 + flick * 0.5;
        tail.rotation.x = -0.1 + flick * 0.2;
        head.rotation.y = Math.sin(t * 0.7) * 0.18;
      },
    },
    body,
    fore,
  };
}

// MARK: Julesvaneand

/** The plain duck in a red nissehue with a cream rim. It is a joke, so it is played straight. */
export function julesvaneand(): Built {
  const built = duck("");
  const hat = new Grid();
  // Tilted back off the brow, the tip slumping to one side.
  hat.ell(0, 0, 0, 4.3, 1.2, 4.5, CREAM, 2.1);
  for (let i = 0; i < 6; i++) {
    const k = i / 6;
    const r = 3.6 * (1 - k * 0.85);
    hat.ell(Math.round(k * k * -2), 1 + i, Math.round(-k * k * 3), r, 0.8, r, (c) =>
      speckle(c, NISSE_RED, NISSE_RED_D, 3 + i, 0.22),
    );
  }
  hat.ell(-2, 7.4, -3.4, 1.1, 1.1, 1.1, CREAM);
  put(built.rig.head, hat, [0, 5.2, 0.2], 3);
  return built;
}

// MARK: Julebuk

/** The straw Yule goat: bundles of golden straw bound with red ribbon at the neck, short straw horns, a stiff beard. */
export function julebuk(): Built {
  const body = new Model();
  const fore = new Model();
  const STRAW = "#e2b855";
  const STRAW_L = "#f2d88a";
  const STRAW_D = "#b98a32";
  const straw = (c: Cell, seed: number) =>
    // Vertical stalks: bands across x/z, with a few darker and lighter ones.
    hash(c.x, 0, c.z, seed) < 0.3 ? STRAW_D : hash(c.x, 0, c.z, seed + 1) < 0.4 ? STRAW_L : STRAW;
  const bg = new Grid();
  bg.ell(0, 11, 0, 4.4, 4.2, 7, (c) => straw(c, 1), 3.2);
  bg.tube(
    [
      [0, 12, 5],
      [0, 16, 7.5],
    ],
    3,
    2.7,
    (c) => straw(c, 2),
  );
  // A red ribbon bound round the body, and a sprig of a tail.
  bg.paint((c) => (c.z >= 1 && c.z <= 2 ? NISSE_RED : c.c));
  bg.box(-1, 1, 14, 16, -9, -8, STRAW_L);
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [zi, z] of [4.2, -4.2].entries())
    for (const [si, s] of SIDES.entries()) {
      const lj = leg(body, [s * 2.7, 7.5, z], 7.5, 2, (c) => (hash(c.x, c.y, c.z, 6) < 0.3 ? STRAW_D : STRAW), "#8a6a2c", 5 + zi);
      // The tied hoof: a red band just above the foot.
      const band = new Grid();
      band.box(-1, 1, 0, 0, -1, 2, NISSE_RED);
      put(lj, band, [0, -3, 0], 9);
      legs.push({ j: lj, phase: (zi + si) * Math.PI });
    }
  const head = joint(body, [0, 17.4, 7.6]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 2.8, 3, 3, STRAW, 2.6);
  hg.ell(0, -1.4, 3, 1.8, 1.6, 2.4, STRAW_L);
  hg.set(-1, -0.4, 5.4, "#6b3f22").set(1, -0.4, 5.4, "#6b3f22");
  // The ribbon at the neck, as a collar under the head.
  hg.box(-2, 2, -3, -2, -1, 1, NISSE_RED);
  hg.box(-1, 1, -4.4, -3, 0, 0, NISSE_RED_D);
  // A stiff, stand-up beard of straw.
  hg.box(-1, 1, -4, -2, 3, 4, STRAW_L);
  hg.box(0, 0, -5, -4, 3, 3, STRAW_D);
  for (const s of SIDES) {
    // Short horns of straw, curving back, with a tied tip.
    hg.tube(
      [
        [s * 1.6, 2.6, 0],
        [s * 2.4, 5, -1],
        [s * 2.2, 6.6, -3],
      ],
      1.4,
      0.6,
      (c) => (c.u > 0.9 ? NISSE_RED : STRAW_D),
    );
    // Ears of straw, out to the sides.
    hg.box(s * 2.5, s * 4.6, 0, 1, -1.5, -0.5, STRAW);
  }
  put(head, hg, [0, 0, 0], 2);
  const eyeMeshes = eyes(
    head,
    2.5,
    0.9,
    2,
    [
      ["#3a2a14", "#3a2a14"],
      [DARK, GLINT],
    ],
    0.65,
  );
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2.5), U(-1)],
      neckR: U(3),
      top: [0, U(3), 0],
      tilt: false,
      span: U(12),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.55);
        // Opinionated: it tilts its head at the decorations and gives the odd stern nod.
        head.rotation.z = Math.sin(t * 0.8) * 0.12;
        head.rotation.x = Math.max(0, Math.sin(t * 1.9)) ** 8 * 0.3 + (moving ? Math.sin(t * 13) * 0.04 : 0);
      },
    },
    body,
    fore,
  };
}

// MARK: Lygtenisse

/** A tiny nisse: grey wool, a long slumped red cap, a white beard over the whole face and a lantern that glows. */
export function lygtenisse(): Built {
  const body = new Model();
  const fore = new Model();
  const WOOL = "#8a8f98";
  const WOOL_D = "#6c717b";
  const BEARD = "#f4f0e6";
  const bg = new Grid();
  bg.ell(0, 8, 0, 3.6, 4, 3.2, WOOL, 2.3);
  bg.paint((c) => (c.t < 0.15 ? NISSE_RED_D : speckle(c, WOOL, WOOL_D, 2, 0.3)));
  // A red scarf at the neck and cream stripes on the cuffs are in the arms; the jacket gets a belt.
  bg.box(-3, 3, 8, 8, -3, 3, "#4a3326");
  bg.ell(0, 11.4, 0.4, 3, 1, 2.8, NISSE_RED, 2.2);
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [si, s] of SIDES.entries())
    legs.push({
      j: leg(body, [s * 1.7, 4.2, 0], 4, 2, (c) => (c.t > 0.5 ? WOOL_D : "#a06a3c"), "#a06a3c", 5 + si),
      phase: si * Math.PI,
    });
  // Arms: the left one hangs, the right one holds the lantern out.
  const lamp = joint(body, [4.8, 6.6, 2.4]);
  const armR = joint(body, [3.4, 10, 0.4]);
  const ag = new Grid();
  ag.box(-1, 0, -4, 0, -1, 0, WOOL);
  ag.box(-1, 0, -5, -5, -1, 0, CREAM);
  put(armR, ag, [0, 0, 0], 7);
  armR.rotation.x = -0.9;
  armR.rotation.z = -0.35;
  const armL = joint(body, [-3.4, 10, 0.4]);
  put(armL, ag, [0, 0, 0], 8);
  // The lantern: a dark wooden frame round a glowing gold core on a ring, swinging a little.
  const lg = new Grid();
  lg.box(-1, 1, -2, -2, -1, 1, "#4a3326");
  lg.box(-1, 1, 2, 2, -1, 1, "#4a3326");
  for (const x of [-1, 1]) for (const z of [-1, 1]) lg.box(x, x, -1, 1, z, z, "#4a3326");
  lg.box(0, 0, -1, 1, 0, 0, "*#ffe08a");
  lg.set(0, 0, 0, "*#fff2c0");
  lg.set(0, 3, 0, "#4a3326");
  lg.set(0, 4, 0, "#4a3326");
  put(lamp, lg, [0, -4, 0], 12);
  const head = joint(body, [0, 14.2, 0.6]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.2, 3, 3, "#e8b894", 2.2);
  // The beard buries the lower face; a round nose pokes through, two white brows above.
  hg.ell(0, -1.6, 1.4, 3.3, 2.6, 2.4, (c) => speckle(c, BEARD, "#dcd6c6", 3, 0.3), 2.2);
  hg.ell(0, 0.2, 3.2, 1, 0.9, 0.9, "#e0907a");
  for (const s of SIDES) hg.box(s * 1, s * 1.6, 1.6, 2, 2, 3, BEARD);
  // The cap: long, slumped over to one side, with a cream fold.
  cap(hg, [0, 2.2, -0.2], 3.3, 8, 5, true);
  put(head, hg, [0, 0, 0], 2);
  const eyeMeshes = eyes(head, 2.5, 1.4, 1.5, [[DARK, GLINT]], 0.5);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-3), U(0)],
      neckR: U(3),
      top: [0, U(3.6), 0],
      tilt: false,
      span: U(3),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.6);
        lamp.rotation.z = Math.sin(t * (moving ? 9 : 1.8)) * (moving ? 0.25 : 0.1);
        lamp.rotation.x = Math.sin(t * (moving ? 7 : 1.3) + 1) * 0.08;
        armR.rotation.x = -0.9 + (moving ? Math.sin(t * 13) * 0.15 : 0);
        armL.rotation.x = moving ? Math.sin(t * 13 + Math.PI) * 0.5 : Math.sin(t * 1.5) * 0.04;
        head.rotation.y = Math.sin(t * 0.7) * 0.2;
        body.position.y = moving ? U(Math.abs(Math.sin(t * 13)) * 0.5) : 0;
      },
    },
    body,
    fore,
  };
}

export const JULEMARKED_PETS = {
  roedkaelk,
  marcipangris,
  nissekat,
  julesvaneand,
  julebuk,
  lygtenisse,
} as const;
