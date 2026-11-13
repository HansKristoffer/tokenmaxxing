/**
 * The Julemarked case's pets (core/src/case-julemarked.ts, pet.800 to pet.805) as voxel sculptures on the same
 * `petvox` grid as the other cases': Rødkælk (a puffed-up robin with a holly berry in its beak), Marcipangris (a glossy
 * marzipan pig with a red bow), Nissekat (a grey tabby in a tiny nisse cap and a bell collar), Julesvaneand (the plain
 * duck in a nissehue that wobbles when it waddles), Julebuk (the big straw Yule goat, bound with red ribbon, horns
 * glinting, faintly glowing) and Lygtenisse (a tiny nisse whose lantern lights the ground and leaves a trail of sparks).
 *
 * These are the case's pets, so they carry more than the plain coin-stall ones (`pets3d-julemarked-stall.ts`): separate
 * ears, tails and caps that move on their own, emissive cells (berries, bells, lanterns, glints) and a few cubes of
 * particles each. Everything is boxes: voxel cells, stepped slabs and cubes, nothing round. No real `PointLight`: one
 * more light in the scene would recompile every material in the town, so the lantern's light is an emissive core, a
 * flickering stepped halo and a pool of warm light on the ground.
 */
import * as THREE from "three";
import { Model } from "../kit/kit.ts";
import { duck } from "./pets3d-misc.ts";
import { type Built, DARK, GLINT, joint, put, SIDES, speckle, U } from "./pets3d-night.ts";
import { type Cell, eye, Grid, hash } from "./petvox.ts";

const NISSE_RED = "#b8302c";
const NISSE_RED_D = "#8e2422";
const CREAM = "#f4ecd8";
const GOLD = "#ffd24a";

// MARK: Shared bits

const CUBE = new THREE.BoxGeometry(1, 1, 1);
CUBE.userData.shared = true;
const mats = new Map<string, THREE.Material>();
/** One unlit material per colour and mode, shared by every pet and never disposed with one. */
function basic(color: string, opacity = 1, additive = false): THREE.Material {
  const key = `${color}/${opacity}/${additive}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1 || additive,
      opacity,
      depthWrite: opacity >= 1 && !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    m.userData.shared = true;
    mats.set(key, m);
  }
  return m;
}

/** A cube of `size` metres, out of the blocky swap and the shadow pass. */
function bit(parent: THREE.Object3D, color: string, size: number, opacity = 1, additive = false): THREE.Mesh {
  const o = new THREE.Mesh(CUBE, basic(color, opacity, additive));
  o.scale.setScalar(size);
  o.userData.noBlock = true;
  o.castShadow = o.receiveShadow = false;
  parent.add(o);
  return o;
}

type Mote = { o: THREE.Mesh; p: number; a: number; r: number; s: number };
/** `n` cubes with a phase, an angle, a radius and a speed each, for the pet's `fx` to move. */
function motes(
  parent: THREE.Object3D,
  n: number,
  color: string,
  size: number,
  seed: number,
  additive = true,
): Mote[] {
  return Array.from({ length: n }, (_, i) => ({
    o: bit(parent, i % 3 === 2 ? "#ffffff" : color, size, additive ? 0.9 : 1, additive),
    p: hash(i, 1, 2, seed),
    a: hash(i, 3, 4, seed) * Math.PI * 2,
    r: 0.5 + hash(i, 5, 6, seed) * 0.7,
    s: 0.25 + hash(i, 7, 8, seed) * 0.35,
  }));
}

/** A stepped, flat pool of light on the ground: squares narrowing inward, each a touch brighter. */
function pool(parent: THREE.Object3D, size: number, color: string, alpha: number, layers = 4): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < layers; i++) {
    const w = size * (1 - i / layers);
    const o = bit(g, color, 1, alpha * (0.2 + (i / layers) * 1.1), true);
    o.scale.set(w, 0.003, w);
    o.position.y = i * 0.0015;
    o.rotation.y = i % 2 ? Math.PI / 4 : 0;
  }
  parent.add(g);
  return g;
}

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

/** A holly sprig: two dark leaves with stepped points and a cluster of glowing berries; `at` is the berries' centre. */
function holly(parent: THREE.Object3D, at: [number, number, number], seed: number, k = 1): Model {
  const j = joint(parent, at);
  const g = new Grid();
  const LEAF = "#2f7a46";
  const LEAF_D = "#1f5a34";
  for (const s of SIDES) {
    g.box(s * 1, s * 3, 1, 1, -1, 0, LEAF);
    g.box(s * 2, s * 4, 1, 2, -2, -1, LEAF_D);
    g.set(s * 5, 2, -2, LEAF_D).set(s * 3, 1, 1, LEAF_D);
    g.set(s * 3, 2, 0, LEAF);
  }
  g.box(0, 1, -1, 0, 0, 1, "*#ee3a30");
  g.box(-1, -1, 0, 0, -1, 0, "*#d62a2a");
  g.set(0, 1, 1, "*#ffb4a0");
  g.set(-1, 0, 1, "*#ff6a5c");
  j.scale.setScalar(k);
  put(j, g, [0, 0, 0], seed);
  return j;
}

/**
 * A nisse cap from shrinking rings that bend over to one side, on its own joint at `at` so it can wobble: a cream rim,
 * red wool and a pompom (or bell) on a second joint at the bent tip that lags behind it.
 */
function nisseCap(
  parent: THREE.Object3D,
  at: [number, number, number],
  r: number,
  rows: number,
  bend: number,
  seed: number,
  tip: "pom" | "bell" = "pom",
): { cap: Model; tip: Model } {
  const cap = joint(parent, at);
  const g = new Grid();
  g.ell(0, 0, 0, r + 0.6, 1.1, r + 0.6, CREAM, 2.1);
  g.paint((c) => (c.c === CREAM ? speckle(c, CREAM, "#e2d8bd", seed, 0.3) : c.c));
  for (let i = 0; i < rows; i++) {
    const k = i / rows;
    const rr = Math.max(0.8, r * (1 - k * 0.92));
    g.ell(
      0,
      1 + i,
      Math.round(k * k * bend),
      rr,
      0.8,
      rr,
      (c) => speckle(c, NISSE_RED, NISSE_RED_D, seed + i, 0.22),
      2.4,
    );
  }
  // A cream stripe of knit round the middle.
  put(cap, g, [0, 0, 0], seed);
  const kk = (rows - 1) / rows;
  const tipJ = joint(cap, [0, rows, Math.round(kk * kk * bend)]);
  const tg = new Grid();
  if (tip === "pom") {
    tg.ell(0, 1, 0, 1.4, 1.4, 1.4, (c) => speckle(c, CREAM, "#e6dcc2", 4, 0.3), 2.2);
  } else {
    tg.box(-1, 0, 0, 1, -1, 0, "*#ffd24a");
    tg.set(0, 0, 1, "*#fff2b0").set(-1, 1, 1, "*#fff2b0");
    tg.box(-1, 0, 2, 2, -1, 0, "#a8791c");
  }
  put(tipJ, tg, [0, 0, 0], seed + 1);
  return { cap, tip: tipJ };
}

// MARK: Rødkælk

/** A robin puffed to twice its size: a brown back dusted with snow, a big orange-red breast that breathes, a holly berry. */
export function roedkaelk(): Built {
  const body = new Model();
  const fore = new Model();
  const BROWN = "#8b6b4a";
  const BREAST = "#e0642e";
  const bg = new Grid();
  bg.ell(0, 7.2, 0, 5, 5, 5.4, BROWN, 2.1);
  bg.paint((c) => {
    if (c.t > 0.88 && hash(c.x, c.y, c.z, 3) < 0.45) return "#f4f7fa";
    if (c.t < 0.26) return "#d9c9a8";
    return speckle(c, BROWN, "#6f533a", 4, 0.3);
  });
  put(body, bg, [0, 0, 0], 1);
  // The breast: a separate puff in front that swells and settles.
  const puff = joint(body, [0, 6.4, 3.4]);
  const pg = new Grid();
  pg.ell(0, 0, 0, 4.4, 3.9, 3.2, (c) => speckle(c, BREAST, "#c9501f", 2, 0.28), 2.1);
  pg.paint((c) => (c.t > 0.8 ? "#f08a4a" : c.t < 0.2 ? "#e9a070" : c.c));
  put(puff, pg, [0, 0, 0], 3);
  // The tail: a short wedge of feathers that flicks.
  const tail = joint(body, [0, 7.4, -5.2]);
  const tg = new Grid();
  tg.box(-1, 1, 0, 1, -4, 0, "#6f533a");
  tg.box(-1, 1, 1, 2, -5, -3, "#5a4430");
  tg.box(0, 0, 2, 2, -6, -5, "#4a3a30");
  tg.set(-2, 0, -2, "#755a3e").set(2, 0, -2, "#755a3e");
  put(tail, tg, [0, 0, 0], 4);
  tail.rotation.x = -0.4;
  // Folded wings on joints: pale-edged, they lift when it hops.
  const wings = SIDES.map((s) => {
    const j = joint(body, [s * 4.9, 9.6, -0.8]);
    const wg = new Grid();
    wg.ell(0, -2.4, 0, 1.3, 3.4, 4.2, (c) => speckle(c, "#755a3e", "#5a4430", 6, 0.3), 2.2);
    wg.box(0, 0, -5, -4, -4, -2, "#d9c9a8");
    wg.paint((c) => (c.t < 0.2 && c.u < 0.4 ? "#4a3a30" : c.c));
    put(j, wg, [0, 0, 0], 5);
    return j;
  });
  const feet: Model[] = [];
  for (const s of SIDES) {
    const fg = new Grid();
    fg.box(0, 0, 0, 2, 0, 0, "#4a3a30");
    fg.box(-1, 1, 0, 0, 1, 2, "#4a3a30");
    fg.set(-1, 0, 3, "#4a3a30").set(1, 0, 3, "#4a3a30");
    const j = joint(body, [s * 1.6, 2.2, 0.5]);
    put(j, fg, [0, -2, 0], 7);
    feet.push(j);
  }
  const head = joint(body, [0, 11.6, 3.2]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.2, 3, 3.2, BROWN, 2.2);
  hg.paint((c) => {
    if (c.t > 0.9 && hash(c.x, c.y, c.z, 8) < 0.3) return "#f4f7fa";
    if (c.u > 0.45 && c.t < 0.72) return speckle(c, BREAST, "#c9501f", 9, 0.25);
    return speckle(c, BROWN, "#6f533a", 9, 0.25);
  });
  // A thin dark beak, open a crack at the tip to hold the berry.
  hg.box(0, 0, -0.5, 0.5, 3, 5, "#2d2420");
  hg.box(-0.4, 0.4, -0.5, -0.5, 3, 5, "#4a3a30");
  hg.box(-1, 1, 1, 1, 3, 3, "#f4f7fa");
  put(head, hg, [0, 0, 0], 2);
  const berry = holly(head, [0, -1.4, 6.2], 13, 0.9);
  const eyeMeshes = eyes(head, 2.9, 0.8, 1.2, [[DARK, GLINT]], 0.9);
  // Snow falling past it, and a glint off the berry.
  const snow = motes(body, 5, "#ffffff", 0.011, 21, false);
  const glint = bit(head, "#fff0e8", 0.011, 0.9, true);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2.5), U(0.5)],
      neckR: U(3.2),
      top: [0, U(3.4), 0],
      tilt: false,
      span: U(2),
      fx: (t, moving) => {
        // Hops on both feet, tilts its head to look at things, pecks now and then, and fluffs its breast.
        const h = Math.max(0, Math.sin(t * (moving ? 12 : 2.8))) ** 2;
        body.position.y = U(h * (moving ? 3 : 1.6));
        body.rotation.x = -h * 0.12;
        const peck = moving ? 0 : Math.max(0, Math.sin(t * 1.4 + 1)) ** 8 * 0.55;
        head.rotation.x = peck + Math.sin(t * 5) * 0.03;
        head.rotation.y = Math.sin(t * 0.9) * 0.35 * (moving ? 0.2 : 1);
        const look = Math.max(-1, Math.min(1, Math.sin(t * 1.1) * 3)) * (moving ? 0.1 : 0.4);
        head.rotation.z = look;
        feet.forEach((f) => {
          f.rotation.x = -h * 0.35;
        });
        const breath = Math.sin(t * 2.6);
        puff.scale.set(1 + breath * 0.04, 1 + breath * 0.05, 1 + breath * 0.07 + h * 0.06);
        wings.forEach((w, i) => {
          w.rotation.z = SIDES[i]! * (0.1 + h * 0.55 + (moving ? 0.1 : 0));
        });
        const flick = Math.max(0, Math.sin(t * 1.9)) ** 8;
        tail.rotation.x = -0.4 + flick * 0.5 - h * 0.3;
        tail.rotation.y = Math.sin(t * 7) * flick * 0.25;
        berry.rotation.x = Math.sin(t * 5 + 1) * 0.05 - peck * 0.2;
        const gl = Math.max(0, Math.sin(t * 2.3)) ** 10;
        glint.position.set(U(0.5), U(-0.5), U(7));
        glint.scale.setScalar(0.004 + gl * 0.016);
        for (const s of snow) {
          const k = (t * s.s + s.p) % 1;
          s.o.position.set(
            U(Math.cos(s.a) * 9 * s.r) + Math.sin(t + s.a) * 0.01,
            U(22 - k * 22),
            U(Math.sin(s.a) * 9 * s.r),
          );
          s.o.scale.setScalar(Math.sin(k * Math.PI) * 0.014 + 0.001);
        }
      },
    },
    body,
    fore,
  };
}

// MARK: Marcipangris

/** A glossy marzipan pig: sheen on its back, sprinkles, pink cheeks, floppy ears, a curl of a tail that wiggles, a bow. */
export function marcipangris(): Built {
  const body = new Model();
  const fore = new Model();
  const MARZ = "#e9c3a6";
  const MARZ_D = "#d2a487";
  const BELLY = "#f2d6bd";
  const bg = new Grid();
  bg.ell(0, 7.2, 0, 5.3, 4.8, 6.6, MARZ, 2.2);
  bg.paint((c) => {
    if (c.t < 0.3) return BELLY;
    // Gloss: a lighter sheen up the back, and a few cells that catch the light.
    if (c.t > 0.8 && hash(c.x, c.y, c.z, 17) < 0.05) return "*#fff6ea";
    if (c.t > 0.74 && Math.abs(c.s) < 0.5) return speckle(c, "#f7dcc4", "#f0d0b4", 5, 0.2);
    // Sugar sprinkles.
    const h = hash(c.x, c.y, c.z, 31);
    if (c.t > 0.4 && h < 0.035) return "#c8302c";
    if (c.t > 0.4 && h > 0.97) return "#4a9a5e";
    if (c.t > 0.4 && h > 0.94 && h < 0.955) return "#ffffff";
    return speckle(c, MARZ, MARZ_D, 4, 0.2);
  });
  put(body, bg, [0, 0, 0], 1);
  // The curly tail: a stepped corkscrew on its own joint.
  const tail = joint(body, [0, 9.4, -6.4]);
  const tg = new Grid();
  for (const [y, z] of [
    [0, 0],
    [0, -1],
    [1, -2],
    [2, -2],
    [3, -1],
    [3, 0],
    [2, 0],
    [2, -1],
  ] as const)
    tg.box(0, 1, y, y, z, z, y > 1 ? "#e0b595" : MARZ_D);
  tg.set(1, 2, -1, "#e8a898");
  put(tail, tg, [0, 0, 0], 3);
  const legs: { j: Model; phase: number }[] = [];
  for (const [zi, z] of [3.8, -3.8].entries())
    for (const [si, s] of SIDES.entries())
      legs.push({
        j: leg(body, [s * 3.1, 3.6, z], 3.6, 3, (c) => (c.t > 0.5 ? MARZ : MARZ_D), "#a97a5e", 5 + zi),
        phase: (zi + si) * Math.PI,
      });
  const head = joint(body, [0, 8, 6]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.9, 3.6, 3.4, MARZ, 2.2);
  hg.paint((c) => {
    if (c.t > 0.8 && hash(c.x, c.y, c.z, 19) < 0.06) return "*#fff6ea";
    if (c.u > 0.4 && c.t < 0.55 && Math.abs(c.x) > 2) return "#f0a4a0";
    return speckle(c, MARZ, MARZ_D, 6, 0.15);
  });
  put(head, hg, [0, 0, 0], 2);
  // The snout on its own joint, so it twitches: flat, lighter, two dark nostrils.
  const snout = joint(head, [0, -0.6, 3.4]);
  const sg = new Grid();
  sg.box(-2, 2, -1, 1, 0, 1, "#f4d4c2");
  sg.box(-1, 1, 1, 1, 0, 1, "#f9e2d2");
  sg.set(-1, 0, 2, "#6b3f22").set(1, 0, 2, "#6b3f22");
  sg.set(-2, -1, 1, "#e8a898").set(2, -1, 1, "#e8a898");
  put(snout, sg, [0, 0, 0], 8);
  // Floppy ears that flick on their own.
  const ears = SIDES.map((s) => {
    const j = joint(head, [s * 2.6, 3, -0.4]);
    const eg = new Grid();
    eg.box(0, s * 2, 0, 1, -1, 0, MARZ_D);
    eg.box(s * 1, s * 3, 1, 1, -1, 0, MARZ_D);
    eg.box(s * 2, s * 3, 1, 2, 0, 1, "#f0a4a0");
    eg.set(s * 3, 0, -1, MARZ_D).set(s * 3, 1, 0, "#e8a898");
    put(j, eg, [0, 0, 0], 9);
    return j;
  });
  // The red bow on the left ear: two stepped loops, a knot and a glint, bobbing with the ear.
  const bow = joint(ears[0]!, [-0.5, 2, 0]);
  const bg2 = new Grid();
  bg2.box(-3, -2, 0, 2, 0, 1, NISSE_RED);
  bg2.box(2, 3, 0, 2, 0, 1, NISSE_RED);
  bg2.box(-3, -2, 1, 1, 1, 1, "#d8423c");
  bg2.box(2, 3, 1, 1, 1, 1, "#d8423c");
  bg2.box(-1, 1, 1, 2, 0, 2, NISSE_RED_D);
  bg2.set(0, 2, 2, "*#ffb4a8");
  bg2.box(-1, 0, -1, -4, 0, 0, NISSE_RED);
  bg2.box(1, 2, -1, -3, 0, 0, NISSE_RED_D);
  put(bow, bg2, [0, 0, 1], 11);
  const eyeMeshes = eyes(head, 3.5, 0.9, 1.9, [[DARK, GLINT]], 0.7);
  // Sugar twinkles round it.
  const spark = motes(body, 4, "#fff2d8", 0.012, 41);
  return {
    rig: {
      head,
      eyes: eyeMeshes,
      fore: [],
      hind: [],
      tails: [],
      neck: [0, U(-2.5), U(0.5)],
      neckR: U(3.2),
      top: [0, U(3.8), 0],
      tilt: false,
      span: U(11),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.6);
        head.rotation.x = Math.sin(t * 1.4) * 0.05 + (moving ? Math.sin(t * 13) * 0.04 : 0);
        head.rotation.z = Math.sin(t * 0.6) * 0.06;
        body.position.y = moving ? U(Math.abs(Math.sin(t * 13)) * 0.5) : 0;
        // The tail wiggles all the time, faster when it trots.
        tail.rotation.z = Math.sin(t * (moving ? 14 : 6)) * 0.45;
        tail.rotation.x = Math.sin(t * (moving ? 11 : 4) + 1) * 0.12;
        snout.rotation.x = Math.sin(t * 3.1) * 0.06 + Math.max(0, Math.sin(t * 0.8)) ** 12 * 0.2;
        snout.scale.y = 1 + Math.max(0, Math.sin(t * 3.1)) ** 4 * 0.12;
        ears.forEach((e, i) => {
          const flick = Math.max(0, Math.sin(t * (1.1 + i * 0.3) + i * 2)) ** 10;
          e.rotation.z = SIDES[i]! * (-0.2 - flick * 0.7 - (moving ? 0.1 + Math.sin(t * 13 + i) * 0.1 : 0));
        });
        bow.rotation.z = Math.sin(t * 2 + 1) * 0.06;
        // A wink every few seconds: the right eye shuts, the left stays open.
        const wink = t % 5.3 > 3.4 && t % 5.3 < 3.8 ? 1 : 0;
        eyeMeshes[1]!.scale.y = (1 - 0.9 * wink) * (eyeMeshes[1]!.scale.y > 0.5 ? 1 : 0.12);
        for (const s of spark) {
          const f = Math.max(0, Math.sin(t * 2.4 + s.p * 9)) ** 4;
          s.o.position.set(
            U(Math.cos(s.a + t * 0.3) * 9 * s.r),
            U(8 + Math.sin(s.a * 3) * 6 + 5),
            U(Math.sin(s.a + t * 0.3) * 9 * s.r),
          );
          s.o.scale.setScalar(0.002 + f * 0.016);
          s.o.rotation.set(t, t * 1.3, t * 0.7);
        }
      },
    },
    body,
    fore,
  };
}

// MARK: Nissekat

/** The nisse's cat: a grey tabby with darker stripes, a bell collar that jingles, a cap that flops and a tail that flicks. */
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
  // A white chest bib.
  bg.box(-1, 1, 5, 8, 6, 7, LIGHT);
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
    // Whiskers, long and pale.
    hg.box(s * 3.5, s * 6, -1, -1, 2, 2, "#e9ecef");
    hg.box(s * 3.5, s * 5.5, -2, -2, 2, 2, "#e9ecef");
  }
  put(head, hg, [0, 0, 0], 2);
  // Ears on joints: pointed, pink inside, they flick.
  const ears = SIDES.map((s) => {
    const j = joint(head, [s * 2.2, 2.6, -0.4]);
    const eg = new Grid();
    eg.box(0, s * 1, 0, 1, -1, 0, GREY);
    eg.box(0, s * 1, 2, 3, -1, -1, GREY);
    eg.box(0, s * 1, 1, 2, -1, 0, GREY);
    eg.set(0, 4, -1, STRIPE);
    eg.set(s * 0, 1, 1, "#e8b0b0")
      .set(s * 1, 1, 1, "#e8b0b0")
      .set(0, 2, 1, "#e8b0b0");
    put(j, eg, [0, 0, 0], 10);
    return j;
  });
  // The cap, tilted over one ear, with a pompom that lags a beat behind it.
  const { cap, tip } = nisseCap(head, [0, 3, -0.8], 2.5, 6, 3, 20);
  cap.rotation.z = -0.12;
  // The bell collar: a red band, a gold bell that gleams and swings.
  const collar = new Grid();
  collar.ell(0, 0, 0, 3.1, 1.2, 2.7, (c) => (c.t > 0.85 ? "#d8423c" : NISSE_RED), 2.4);
  put(head, collar, [0, -2.6, 0.3], 22);
  const bell = joint(head, [0, -3.2, 3]);
  const bgr = new Grid();
  bgr.box(0, 1, -1, 0, 0, 1, "*#ffd24a");
  bgr.set(0, 1, 2, "*#ffd24a").set(0, 0, 2, "*#fff2b0");
  bgr.set(1, -1, 2, "#a8791c");
  bgr.set(0, 1, 1, "#a8791c");
  put(bell, bgr, [0, 0, 0], 23);
  const eyeMeshes = eyes(
    head,
    2.7,
    0.5,
    1.8,
    [
      ["#9fd67a", "#9fd67a"],
      [DARK, "#9fd67a"],
    ],
    0.6,
  );
  // A long tail in three linked pieces: it curls up and over, and the flick runs down it like a wave.
  const t1 = joint(body, [0, 8, -7]);
  const t2 = joint(t1, [0, 1, -3.5]);
  const t3 = joint(t2, [0, 3, -2]);
  const seg = (
    j: Model,
    pts: [number, number, number][],
    r0: number,
    r1: number,
    tipDark: boolean,
    seed: number,
  ) => {
    const g = new Grid();
    g.tube(pts, r0, r1, (c) =>
      tipDark && c.u > 0.8 ? "#3f434c" : Math.floor((c.y + c.z + 30) / 2) % 2 ? STRIPE : GREY,
    );
    put(j, g, [0, 0, 0], seed);
  };
  seg(
    t1,
    [
      [0, 0, 0],
      [0, 1, -3.5],
    ],
    1.5,
    1.4,
    false,
    4,
  );
  seg(
    t2,
    [
      [0, 0, 0],
      [0, 3, -2],
      [0, 6, -1],
    ],
    1.4,
    1.25,
    false,
    5,
  );
  seg(
    t3,
    [
      [0, 0, 0],
      [0, 3, 1],
      [0, 4.5, 3],
    ],
    1.25,
    1.05,
    true,
    6,
  );
  const jingle = motes(head, 3, GOLD, 0.01, 51);
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
        const wag = Math.sin(t * (moving ? 8 : 1.5));
        t1.rotation.z = wag * 0.1 + flick * 0.3;
        t2.rotation.z = Math.sin(t * (moving ? 8 : 1.5) - 0.7) * 0.15 + flick * 0.5;
        t3.rotation.z = Math.sin(t * (moving ? 8 : 1.5) - 1.4) * 0.2 + flick * 0.7;
        t1.rotation.x = -0.1 + flick * 0.12;
        t2.rotation.x = flick * 0.15;
        head.rotation.y = Math.sin(t * 0.7) * 0.18;
        head.rotation.z = Math.sin(t * 0.5 + 2) * 0.05;
        // Ears: independent twitches.
        ears.forEach((e, i) => {
          const tw = Math.max(0, Math.sin(t * (2.1 + i * 0.7) + i * 3)) ** 12;
          e.rotation.z = SIDES[i]! * (0.05 + tw * 0.5);
          e.rotation.x = -tw * 0.15;
        });
        // The cap sways a beat behind the head, its pompom a beat behind that.
        cap.rotation.z = -0.12 + Math.sin(t * 1.4 - 0.6) * 0.07 - head.rotation.y * 0.3;
        tip.rotation.x = Math.sin(t * 2.2) * 0.35 + (moving ? Math.sin(t * 13) * 0.3 : 0);
        tip.rotation.z = Math.sin(t * 1.7 + 1) * 0.3;
        // The bell: swings with the head, rings when it flicks its tail.
        bell.rotation.x =
          Math.sin(t * 2.6) * 0.1 + (moving ? Math.sin(t * 13) * 0.35 : 0) + flick * Math.sin(t * 30) * 0.3;
        for (const s of jingle) {
          const ring = Math.max(flick, moving ? Math.abs(Math.sin(t * 6.5)) ** 4 : 0);
          const k = (t * 1.5 + s.p) % 1;
          s.o.position.set(U(Math.cos(s.a) * 3 * k), U(-3 - k * 3), U(3.4 + Math.sin(s.a) * 2 * k));
          s.o.scale.setScalar(ring * Math.sin(k * Math.PI) * 0.012 + 0.0005);
        }
      },
    },
    body,
    fore,
  };
}

// MARK: Julesvaneand

/** The plain duck in a red nissehue with a cream rim. It is a joke, so it is played straight; the hat wobbles when it waddles. */
export function julesvaneand(): Built {
  const built = duck("");
  const { cap, tip } = nisseCap(built.rig.head, [0, 5.2, 0.2], 4.2, 7, -3, 30, "bell");
  cap.rotation.x = -0.14;
  // A sprig of holly pinned to the rim.
  const pin = holly(cap, [3.4, 1.4, 2.6], 31, 0.7);
  pin.rotation.y = 0.6;
  const jingle = motes(cap, 4, GOLD, 0.011, 61);
  const prev = built.rig.fx;
  built.rig.fx = (t, moving) => {
    prev?.(t, moving);
    // At a stroll the hat sits and sways; at a waddle it flops from side to side a beat behind the body.
    const w = moving ? Math.sin(t * 9) : Math.sin(t * 1.3) * 0.2;
    cap.rotation.z = w * (moving ? 0.28 : 0.1);
    cap.rotation.x = -0.14 + (moving ? Math.abs(Math.sin(t * 9 + 0.8)) * 0.14 : Math.sin(t * 0.9) * 0.03);
    tip.rotation.z = -w * 0.9 + Math.sin(t * 3) * 0.1;
    tip.rotation.x = Math.sin(t * (moving ? 18 : 2.4)) * 0.35;
    for (const s of jingle) {
      const k = (t * 1.2 + s.p) % 1;
      s.o.position.set(U(-3 + Math.cos(s.a) * 3 * k), U(9 + k * 4), U(-3.4 + Math.sin(s.a) * 3 * k));
      s.o.scale.setScalar((moving ? 1 : 0.4) * Math.sin(k * Math.PI) * 0.012 + 0.0005);
    }
  };
  return built;
}

// MARK: Julebuk

/** The straw Yule goat, bigger than the rest (it is the epic): bound with red ribbon, horns that glint, a faint glow. */
export function julebuk(): Built {
  const body = new Model();
  const fore = new Model();
  // Everything hangs off one inner model so the whole goat can be the biggest of the case (the others are 14 cells tall, it is 28) without touching the posing of `body`.
  const big = new Model();
  big.scale.setScalar(1);
  body.add(big);
  const STRAW = "#e2b855";
  const STRAW_L = "#f2d88a";
  const STRAW_D = "#b98a32";
  const straw = (c: Cell, seed: number) =>
    // Vertical stalks: bands across x/z, with a few darker and lighter ones, and the odd stalk that catches the light.
    hash(c.x, 0, c.z, seed) < 0.3
      ? STRAW_D
      : hash(c.x, 0, c.z, seed + 1) < 0.4
        ? hash(c.x, c.y, c.z, seed + 2) < 0.03
          ? "*#fff0b0"
          : STRAW_L
        : STRAW;
  const bg = new Grid();
  bg.ell(0, 11, 0, 4.6, 4.4, 7.2, (c) => straw(c, 1), 3.2);
  bg.tube(
    [
      [0, 12, 5],
      [0, 16, 7.5],
    ],
    3,
    2.7,
    (c) => straw(c, 2),
  );
  // Straw tufts sticking out of it: single cells and short stalks along its surface.
  const spikes: [number, number, number][] = [];
  bg.each((x, y, z) => {
    if (hash(x, y, z, 77) < 0.045 && (Math.abs(x) >= 4 || y >= 14 || y <= 7)) spikes.push([x, y, z]);
  });
  for (const [x, y, z] of spikes) {
    const dx = Math.abs(x) >= 4 ? Math.sign(x) : 0;
    const dy = y >= 14 ? 1 : y <= 7 ? -1 : 0;
    bg.set(x + dx, y + dy, z, STRAW_L).set(x + dx * 2, y + dy * 2, z, STRAW_D);
  }
  // Ribbons: a wide red band round the chest with gold edges, and a strap over the back.
  bg.paint((c) => {
    if (c.z >= 1 && c.z <= 3) return c.z === 2 ? NISSE_RED : "#d8423c";
    if (c.z === 0 || c.z === 4) return "#e0b040";
    return c.c;
  });
  // A sprig of a tail: tied tufts.
  const tail = joint(big, [0, 14.5, -8]);
  const tg = new Grid();
  tg.box(-1, 1, -3, 1, -1, 0, STRAW_L);
  tg.box(0, 0, -4, -3, 0, 0, STRAW_D);
  tg.box(-1, 1, 0, 0, -1, 0, NISSE_RED);
  tg.set(-2, -2, -1, STRAW_D).set(2, -2, -1, STRAW_D);
  put(tail, tg, [0, 0, 0], 4);
  put(big, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [zi, z] of [4.4, -4.4].entries())
    for (const [si, s] of SIDES.entries()) {
      const lj = leg(
        big,
        [s * 2.9, 7.5, z],
        7.5,
        2,
        (c) => (hash(c.x, c.y, c.z, 6) < 0.3 ? STRAW_D : STRAW),
        "#5a3d1c",
        5 + zi,
      );
      // The tied hoof: a red band with a gold edge just above the foot.
      const band = new Grid();
      band.box(-1, 1, 0, 0, -1, 2, NISSE_RED);
      band.box(-1, 1, 1, 1, -1, 2, "#e0b040");
      put(lj, band, [0, -3, 0], 9);
      legs.push({ j: lj, phase: (zi + si) * Math.PI });
    }
  const head = joint(big, [0, 17.6, 7.8]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 2.9, 3.1, 3.2, (c) => straw(c, 3), 2.6);
  hg.ell(0, -1.4, 3, 1.9, 1.7, 2.4, STRAW_L);
  hg.set(-1, -0.4, 5, "#6b3f22").set(1, -0.4, 5, "#6b3f22");
  hg.box(-1, 1, -1, -1, 5, 5, "#3a2a14");
  // A stiff beard of straw, stepped down the chin; it sways on its own joint.
  put(head, hg, [0, 0, 0], 2);
  const beard = joint(head, [0, -3, 3.4]);
  const brd = new Grid();
  brd.box(-1, 1, -1, 0, 0, 1, STRAW_L);
  brd.box(-1, 1, -3, -2, 0, 1, STRAW);
  brd.box(0, 0, -5, -4, 0, 1, STRAW_D);
  brd.set(0, -6, 1, STRAW_D);
  brd.box(0, 0, 0, 0, 0, 1, NISSE_RED);
  put(beard, brd, [0, 0, 0], 12);
  // The horns: stepped slabs of gold straw, curling back, ringed with darker bands, with a glowing point.
  const glints: THREE.Mesh[] = [];
  for (const s of SIDES) {
    const hj = joint(head, [s * 1.6, 2.4, 0]);
    const hn = new Grid();
    const HORN = "#e8c060";
    const HORN_D = "#b8862c";
    hn.box(s * 0, s * 1, 0, 1, -1, 1, HORN_D);
    hn.box(s * 0, s * 1, 2, 3, -1, 0, HORN);
    hn.box(s * 1, s * 2, 3, 4, -1, 0, HORN);
    hn.box(s * 1, s * 2, 3, 3, -1, 0, HORN_D);
    hn.box(s * 2, s * 3, 5, 6, -2, -1, HORN);
    hn.box(s * 2, s * 3, 5, 5, -2, -1, HORN_D);
    hn.box(s * 2, s * 3, 7, 7, -3, -2, HORN);
    hn.box(s * 2, s * 2.5, 8, 8, -4, -3, HORN_D);
    hn.box(s * 2, s * 2, 9, 9, -5, -4, "*#fff0b0");
    hn.set(s * 2, 9, -5, "*#ffffff");
    hn.set(s * 3, 7, -2, "*#fff0b0");
    put(hj, hn, [0, 0, 0], 13);
    const gl = bit(hj, "#fff6d0", 0.02, 0.9, true);
    gl.position.set(U(s * 2), U(9.5), U(-5));
    glints.push(gl);
  }
  // Ears of straw on joints, with a red tie; they flick.
  const ears = SIDES.map((s) => {
    const j = joint(head, [s * 2.7, 0.8, -1]);
    const eg = new Grid();
    eg.box(s * 0, s * 3, 0, 1, -1, 0, STRAW);
    eg.box(s * 3, s * 5, 0, 0, -1, 0, STRAW_L);
    eg.set(s * 5, -1, -1, STRAW_D).set(s * 4, 0, -2, STRAW_D);
    eg.box(s * 0, s * 0, 0, 1, -1, 0, NISSE_RED);
    put(j, eg, [0, 0, 0], 14);
    return j;
  });
  // The ribbon at the neck: a bow with two tails that flutter.
  const ribbon = joint(head, [0, -3.2, 0.5]);
  const rg = new Grid();
  rg.box(-3, 3, -1, 0, -2, 2, NISSE_RED);
  rg.box(-3, 3, 0, 0, -2, 2, "#e0b040");
  rg.box(-3, -1, 1, 3, 2, 3, NISSE_RED);
  rg.box(1, 3, 1, 3, 2, 3, NISSE_RED);
  rg.box(-1, 1, 1, 2, 2, 3, NISSE_RED_D);
  rg.set(0, 3, 3, "*#ffb4a8");
  put(ribbon, rg, [0, 0, 0], 15);
  const tails = SIDES.map((s) => {
    const j = joint(ribbon, [s * 1.2, 0, 2.6]);
    const tl = new Grid();
    tl.box(0, 0, -4, 0, 0, 0, NISSE_RED);
    tl.box(s, s, -3, 0, 0, 0, "#d8423c");
    tl.set(0, -5, 0, NISSE_RED_D);
    put(j, tl, [0, 0, 0], 16);
    return j;
  });
  const eyeMeshes = eyes(
    head,
    2.6,
    0.9,
    2,
    [
      ["#e8a020", "#e8a020"],
      [DARK, "#e8a020"],
    ],
    0.65,
  );
  // The glow: a faint gold pool on the ground, rising straw-gold sparks, and the glints that wink on the horns.
  const glow = pool(body, 0.7, "#ffc24a", 0.14, 5);
  glow.position.y = 0.002;
  const sparks = motes(body, 12, "#ffd070", 0.014, 71);
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
      span: U(16),
      fx: (t, moving) => {
        stride(legs, t, moving, 0.55);
        // Opinionated: it tilts its head at the decorations and gives the odd stern nod.
        head.rotation.z = Math.sin(t * 0.8) * 0.12;
        head.rotation.x = Math.max(0, Math.sin(t * 1.9)) ** 8 * 0.3 + (moving ? Math.sin(t * 13) * 0.04 : 0);
        beard.rotation.x = Math.sin(t * 2.3) * 0.12 + head.rotation.x * 0.8;
        ribbon.rotation.z = Math.sin(t * 1.1) * 0.04;
        tails.forEach((j, i) => {
          j.rotation.x = 0.25 + Math.sin(t * (moving ? 12 : 3) + i * 1.5) * 0.25;
          j.rotation.z = SIDES[i]! * (0.15 + Math.sin(t * 2 + i) * 0.1);
        });
        tail.rotation.z = Math.sin(t * (moving ? 10 : 2.2)) * 0.35;
        tail.rotation.x = 0.2 + Math.max(0, Math.sin(t * 1.3)) ** 6 * 0.4;
        ears.forEach((e, i) => {
          const tw = Math.max(0, Math.sin(t * (1.6 + i * 0.5) + i * 2)) ** 10;
          e.rotation.z = SIDES[i]! * (-0.15 - tw * 0.6);
        });
        // Glints on the horn tips: they take turns to flash.
        glints.forEach((g, i) => {
          const f = Math.max(0, Math.sin(t * 2.1 + i * 2.6)) ** 6;
          g.scale.setScalar(0.003 + f * 0.034);
          g.rotation.set(t * 2, t * 3, 0);
        });
        const breath = 1 + Math.sin(t * 1.5) * 0.06;
        glow.scale.set(breath, 1, breath);
        glow.rotation.y = t * 0.2;
        for (const s of sparks) {
          const k = (t * s.s + s.p) % 1;
          const a = s.a + t * 0.4;
          s.o.position.set(U(Math.cos(a) * 11 * s.r), U(2 + k * 28), U(Math.sin(a) * 15 * s.r));
          s.o.scale.setScalar(Math.sin(k * Math.PI) * 0.02 + 0.001);
          s.o.rotation.set(t, t * 1.2, 0);
        }
      },
    },
    body,
    fore,
  };
}

// MARK: Lygtenisse

/** A tiny nisse: grey wool, a long slumped red cap, a white beard over the whole face and a lantern that lights the ground. */
export function lygtenisse(): Built {
  const body = new Model();
  const fore = new Model();
  const WOOL = "#8a8f98";
  const WOOL_D = "#6c717b";
  const BEARD = "#f4f0e6";
  const bg = new Grid();
  bg.ell(0, 8, 0, 3.6, 4, 3.2, WOOL, 2.3);
  bg.paint((c) => (c.t < 0.15 ? NISSE_RED_D : speckle(c, WOOL, WOOL_D, 2, 0.3)));
  // A belt with a buckle, and a red scarf at the neck.
  bg.box(-3, 3, 8, 8, -3, 3, "#4a3326");
  bg.box(-1, 1, 8, 8, 3, 3, "#c9a14a");
  bg.ell(0, 11.4, 0.4, 3, 1, 2.8, NISSE_RED, 2.2);
  put(body, bg, [0, 0, 0], 1);
  const legs: { j: Model; phase: number }[] = [];
  for (const [si, s] of SIDES.entries())
    legs.push({
      j: leg(body, [s * 1.7, 4.2, 0], 4, 2, (c) => (c.t > 0.5 ? WOOL_D : "#a06a3c"), "#a06a3c", 5 + si),
      phase: si * Math.PI,
    });
  // Arms: the left one hangs, the right one holds the lantern out.
  const armR = joint(body, [3.4, 10, 0.4]);
  const ag = new Grid();
  ag.box(-1, 0, -4, 0, -1, 0, WOOL);
  ag.box(-1, 0, -5, -5, -1, 0, CREAM);
  put(armR, ag, [0, 0, 0], 7);
  armR.rotation.x = -0.9;
  armR.rotation.z = -0.35;
  const armL = joint(body, [-3.4, 10, 0.4]);
  put(armL, ag, [0, 0, 0], 8);
  // The lantern: a bigger one than before. A dark frame with a stepped roof and a handle ring round a glowing gold
  // core, a brighter candle inside; the flame and the halo round it are separate cubes that flicker.
  const lamp = joint(body, [4.8, 6.6, 2.4]);
  const lg = new Grid();
  const FRAME = "#3a2a1c";
  lg.box(-2, 2, -3, -3, -2, 2, FRAME);
  lg.box(-1, 1, -4, -4, -1, 1, "#c9a14a");
  for (const x of [-2, 2]) for (const z of [-2, 2]) lg.box(x, x, -2, 2, z, z, FRAME);
  lg.box(-1, 1, -2, 2, -1, 1, "*#ffcf5a");
  lg.box(-2, -2, -2, 2, -1, 1, "*#ffb43c");
  lg.box(2, 2, -2, 2, -1, 1, "*#ffb43c");
  lg.box(-1, 1, -2, 2, -2, -2, "*#ffb43c");
  lg.box(-1, 1, -2, 2, 2, 2, "*#ffb43c");
  lg.box(0, 0, -1, 1, 0, 0, "*#fff6d0");
  lg.box(-2, 2, 3, 3, -2, 2, FRAME);
  lg.box(-1, 1, 4, 4, -1, 1, FRAME);
  lg.set(0, 5, 0, "#c9a14a");
  lg.box(0, 0, 6, 6, -1, 1, "#c9a14a");
  put(lamp, lg, [0, -4, 0], 12);
  const flame = bit(lamp, "#fff0b0", 0.026, 0.9, true);
  flame.position.set(0, U(-4), 0);
  const halo = bit(lamp, "#ffb43c", 0.2, 0.2, true);
  halo.position.set(0, U(-4), 0);
  const halo2 = bit(lamp, "#ffd070", 0.11, 0.3, true);
  halo2.position.set(0, U(-4), 0);
  // The light on the ground: warm stepped squares under the lantern that shift as it swings.
  const ground = pool(body, 0.62, "#ffb43c", 0.2, 5);
  ground.position.set(U(4.8), 0.003, U(2.4));
  const head = joint(body, [0, 14.2, 0.6]);
  const hg = new Grid();
  hg.ell(0, 0, 0, 3.2, 3, 3, "#e8b894", 2.2);
  // The beard buries the lower face; a round nose pokes through, two white brows above.
  hg.ell(0, -1.6, 1.4, 3.3, 2.6, 2.4, (c) => speckle(c, BEARD, "#dcd6c6", 3, 0.3), 2.2);
  hg.ell(0, 0.2, 3.2, 1, 0.9, 0.9, "#e0907a");
  for (const s of SIDES) hg.box(s * 1, s * 1.6, 1.6, 2, 2, 3, BEARD);
  put(head, hg, [0, 0, 0], 2);
  // The cap: long, slumped over to one side, with a cream fold and a pompom that swings.
  const { cap, tip } = nisseCap(head, [0, 2.2, -0.2], 3.3, 8, 5, 40);
  const eyeMeshes = eyes(head, 2.5, 1.4, 1.5, [[DARK, GLINT]], 0.5);
  // The trail: sparks that fly off the lantern behind it as it walks, and hang about it when it stands.
  const trail = motes(body, 14, "#ffc84a", 0.016, 81);
  let mv = 0;
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
        mv += ((moving ? 1 : 0) - mv) * 0.12;
        stride(legs, t, moving, 0.6);
        lamp.rotation.z = Math.sin(t * (moving ? 9 : 1.8)) * (moving ? 0.25 : 0.1);
        lamp.rotation.x = Math.sin(t * (moving ? 7 : 1.3) + 1) * 0.08;
        armR.rotation.x = -0.9 + (moving ? Math.sin(t * 13) * 0.15 : 0);
        armL.rotation.x = moving ? Math.sin(t * 13 + Math.PI) * 0.5 : Math.sin(t * 1.5) * 0.04;
        head.rotation.y = Math.sin(t * 0.7) * 0.2;
        cap.rotation.z = Math.sin(t * 1.2) * 0.05 - head.rotation.y * 0.2;
        tip.rotation.x = Math.sin(t * 2 + 1) * 0.3 + mv * Math.sin(t * 13) * 0.3;
        tip.rotation.z = Math.sin(t * 1.5) * 0.3;
        body.position.y = moving ? U(Math.abs(Math.sin(t * 13)) * 0.5) : 0;
        // The flame flickers: two uneven sines and a hash.
        const fl =
          1 +
          Math.sin(t * 17) * 0.18 +
          Math.sin(t * 29 + 1) * 0.12 +
          (hash(Math.floor(t * 14), 1, 2, 9) - 0.5) * 0.25;
        flame.scale.set(0.02 * (2 - fl), 0.034 * fl, 0.02 * (2 - fl));
        halo.scale.setScalar(0.2 * (0.85 + 0.2 * fl));
        halo2.scale.setScalar(0.11 * fl);
        // The pool of light follows the lantern's swing and breathes with the flame.
        ground.position.x = U(4.8) + Math.sin(lamp.rotation.z) * 0.08;
        ground.position.z = U(2.4) - Math.sin(lamp.rotation.x) * 0.08 - mv * 0.02;
        ground.scale.setScalar(0.9 + fl * 0.1);
        ground.rotation.y = t * 0.3;
        // Where the lantern is, in the body's own space: sparks start there.
        const lx = U(4.8) + Math.sin(lamp.rotation.z) * 0.05;
        const ly = U(6.6 - 4);
        for (const s of trail) {
          const k = (t * (0.55 + s.s) + s.p) % 1;
          const mix = Math.sin(k * Math.PI);
          // Walking: strung out behind in a wavering line. Standing: a slow orbit that drifts up.
          const wx = lx + Math.sin(t * 4 + s.a * 5 + k * 6) * 0.012 * (1 + k * 3);
          const wy = ly + Math.sin(t * 5 + s.a * 3 + k * 5) * 0.012 + k * 0.02 - k * k * 0.04;
          const wz = U(2.4) - k * 0.26;
          const ox = lx + Math.cos(s.a + t * 0.7) * (0.03 + k * 0.05);
          const oy = ly + k * 0.14;
          const oz = U(2.4) + Math.sin(s.a + t * 0.7) * (0.03 + k * 0.05);
          s.o.position.set(wx * mv + ox * (1 - mv), wy * mv + oy * (1 - mv), wz * mv + oz * (1 - mv));
          s.o.scale.setScalar(mix * (0.014 + 0.006 * Math.sin(t * 9 + s.a)) + 0.001);
        }
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
