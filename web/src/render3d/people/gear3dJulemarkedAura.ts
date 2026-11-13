/**
 * The Julemarked case's four legendary auras in 3D (`core/src/case-julemarked.ts`, slot "aura"): Julestjerne,
 * Adventskrans, Snefnug and Nordlys. Like the other cases' (`gear3dAura.ts`, `gear3dRagnarokAura.ts`) each builder
 * gets a frame at the middle of the body, scaled to the avatar's height (one unit is one metre of a 0.95 m person)
 * and registers a tick that moves its parts. Registered by `gear3dAura.ts`, which calls `registerJulemarkedAuras`
 * (this file never imports it back, so the two cannot form a cycle).
 *
 * These are the case's top prize, so they are the biggest auras in the game: radius 0.5 to 0.9 m (the other cases stop
 * at 0.45), three to four layers each, and every one has an emissive (unlit, additive) part, a slow ground glow and
 * something that lights, twinkles or falls. Sharp and blocky throughout: boxes, stepped pixel shapes, nothing round.
 * Mesh counts stay below ~100 each; the big sheets (wreath, dashed rings, ground glow, wind streaks) are merged to one.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seeded } from "../kit/kit.ts";
import type { AuraBuilder } from "./gear3dAura.ts";

const CUBE = new THREE.BoxGeometry(1, 1, 1);
const TAU = Math.PI * 2;

/** Materials every wearer shares: one per colour and mode, never disposed with a model. */
const shared = new Map<string, THREE.Material>();
function basic(color: string, opacity = 1, additive = false): THREE.Material {
  const key = `${color}/${opacity}/${additive}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1 || additive,
      opacity,
      depthWrite: opacity >= 1 && !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

/** A material for geometry that carries its own (rgba) vertex colours, tinted by `color`. */
function vertex(color = "#ffffff", additive = false, alpha = false): THREE.Material {
  const key = `v/${color}/${additive}/${alpha}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      vertexColors: true,
      transparent: alpha || additive,
      depthWrite: !alpha && !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

/** A cube of `w`×`h`×`d` metres that moves and scales and stays out of the blocky swap. */
function cube(
  parent: THREE.Object3D,
  size: [number, number, number],
  mat: THREE.Material,
  at?: [number, number, number],
): THREE.Mesh {
  const o = new THREE.Mesh(CUBE, mat);
  o.scale.set(...size);
  o.userData.noBlock = true;
  if (at) o.position.set(...at);
  parent.add(o);
  return o;
}

/** A mesh of its own geometry (cached by the caller) that stays out of the blocky swap. */
function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.userData.noBlock = true;
  parent.add(o);
  return o;
}

/** A box with rgba vertex colours (`k` brightens the colour), moved to `at` and turned about y by `ry`. */
function vbox(
  size: [number, number, number],
  at: [number, number, number],
  hex: string,
  alpha = 1,
  k = 1,
  ry = 0,
  rx = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(...size).toNonIndexed();
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position!.count * 4);
  for (let i = 0; i < arr.length; i += 4) arr.set([c.r * k, c.g * k, c.b * k, alpha], i);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 4));
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(...at);
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  out.userData.shared = true;
  return out;
}

/** A pixel picture ('X' a cell, 'O' a brighter cell, '.' empty) as a thin slab of cubes, centred, `cell` metres a cell. */
function pixels(rows: string[], cell: number, depth: number, bright = 1.35): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const h = rows.length;
  for (const [r, row] of rows.entries())
    for (const [c, ch] of [...row].entries()) {
      if (ch === ".") continue;
      parts.push(
        vbox(
          [cell, cell, depth],
          [(c - (row.length - 1) / 2) * cell, (h - 1 - r - (h - 1) / 2) * cell, 0],
          "#ffffff",
          1,
          ch === "O" ? bright : 1,
        ),
      );
    }
  return merge(parts);
}

/** A ring of dashes (thin boxes) at radius `r`, `n` of them, each `len` long, merged to one mesh. */
function dashes(
  r: number,
  n: number,
  len: number,
  thick: number,
  hex: string,
  alpha: number,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    parts.push(
      vbox([len, thick, thick], [Math.sin(a) * r, 0, Math.cos(a) * r], hex, alpha, 1, -a + Math.PI / 2),
    );
  }
  return merge(parts);
}

/** A flat stepped square pad: `layers` squares narrowing inward, the faintest outermost, for a glow on the floor. */
function pad(size: number, layers: number, hex: string, alpha: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < layers; i++) {
    const w = size * (1 - i / layers);
    parts.push(
      vbox(
        [w, 0.008, w],
        [0, i * 0.003, 0],
        hex,
        alpha * (0.5 + (i / layers) * 0.9),
        1,
        i % 2 ? Math.PI / 4 : 0,
      ),
    );
  }
  return merge(parts);
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const FLOOR = -0.47;

// MARK: Julestjerne

const STAR = pixels(
  ["...X...", "..XXX..", "XXXOXXX", ".XXXXX.", "..XXX..", ".XX.XX.", ".X...X."],
  0.02,
  0.026,
);
/** A four-armed twinkle: two crossed slivers and a brighter core. */
const TWINKLE = merge([
  vbox([0.05, 0.008, 0.008], [0, 0, 0], "#ffffff"),
  vbox([0.008, 0.05, 0.008], [0, 0, 0], "#ffffff"),
  vbox([0.014, 0.014, 0.014], [0, 0, 0], "#ffffff", 1, 1.4),
]);
/** The long rays of the crown star, a cross of thin boxes. */
const RAYS = merge([
  vbox([0.62, 0.012, 0.012], [0, 0, 0], "#ffe9a0", 0.55),
  vbox([0.012, 0.62, 0.012], [0, 0, 0], "#ffe9a0", 0.55),
  vbox([0.012, 0.012, 0.62], [0, 0, 0], "#ffe9a0", 0.4),
  vbox([0.36, 0.01, 0.01], [0, 0, 0], "#ffffff", 0.45, 1, Math.PI / 4),
  vbox([0.36, 0.01, 0.01], [0, 0, 0], "#ffffff", 0.45, 1, -Math.PI / 4),
]);
const STAR_COLORS = ["#f2c14e", "#f4ecd8", "#c8102e", "#ffd978", "#ffffff"];

// Julestjerne: a crown star hangs over the head, ringed by rays; three tiers of paper stars (red, cream and gold) orbit
// at different heights, speeds and directions, each on a faint gold dashed ring, with twinkles and gold dust rising
// between them and a warm glow on the floor.
const julestjerne: AuraBuilder = (m, tick) => {
  const crown = new THREE.Group();
  crown.position.y = 0.8;
  m.add(crown);
  const crownStar = mesh(crown, STAR, vertex("#f2c14e"));
  crownStar.scale.setScalar(1.7);
  const crownHalo = mesh(crown, STAR, vertex("#4a2c08", true));
  crownHalo.scale.setScalar(2.4);
  const rays = mesh(crown, RAYS, vertex("#ffffff", true, true));

  const tiers = [
    { n: 4, r: 0.56, y: 0.3, sp: 0.46, sz: 0.95 },
    { n: 5, r: 0.72, y: -0.02, sp: -0.32, sz: 1.2 },
    { n: 5, r: 0.62, y: -0.33, sp: 0.55, sz: 0.9 },
  ].map((tier, ti) => {
    const g = new THREE.Group();
    g.position.y = tier.y;
    m.add(g);
    mesh(g, dashes(tier.r, 36, 0.05, 0.008, "#ffe9a0", 0.5), vertex("#ffffff", true, true));
    const stars = Array.from({ length: tier.n }, (_, i) => ({
      o: mesh(g, STAR, vertex(STAR_COLORS[(i + ti * 2) % STAR_COLORS.length]!)),
      a: (i / tier.n) * TAU,
      i,
    }));
    return { g, stars, ...tier, ti };
  });

  const rnd = seeded(800);
  const dust = Array.from({ length: 18 }, (_, i) => ({
    o: cube(m, [0.018, 0.018, 0.018], basic(i % 3 ? "#f2c14e" : "#ffffff")),
    a: rnd() * TAU,
    p: rnd(),
    r: 0.45 + rnd() * 0.35,
    s: 0.2 + rnd() * 0.2,
  }));
  const twinkles = Array.from({ length: 7 }, () => ({
    o: mesh(m, TWINKLE, vertex("#fff2b8", true, true)),
    a: rnd() * TAU,
    y: rnd() * 1.2 - 0.4,
    r: 0.5 + rnd() * 0.3,
    p: rnd() * 6,
  }));
  const floor = mesh(m, pad(1.5, 5, "#ffb83c", 0.16), vertex("#ffffff", true, true));
  floor.position.y = FLOOR;

  tick((t, walking) => {
    const sp = walking ? 1.4 : 1;
    crown.position.y = 0.8 + Math.sin(t * 1.4) * 0.025;
    crown.rotation.y = Math.sin(t * 0.6) * 0.9;
    crownStar.rotation.z = Math.sin(t * 0.9) * 0.12;
    crownHalo.scale.setScalar(1.9 + Math.sin(t * 3) * 0.15);
    crownHalo.rotation.z = crownStar.rotation.z;
    rays.rotation.set(t * 0.5, t * 0.35, t * 0.7);
    for (const tier of tiers) {
      tier.g.rotation.y = t * tier.sp * sp;
      tier.g.position.y = tier.y + Math.sin(t * 0.9 + tier.ti * 2) * 0.03;
      for (const s of tier.stars) {
        const bob = Math.sin(t * 1.3 + s.i * 1.7 + tier.ti);
        s.o.position.set(Math.sin(s.a) * tier.r, bob * 0.07, Math.cos(s.a) * tier.r);
        s.o.rotation.set(
          Math.sin(t * 0.7 + s.i) * 0.35,
          t * (0.8 + s.i * 0.13) * (tier.ti % 2 ? -1 : 1),
          bob * 0.3,
        );
        s.o.scale.setScalar(tier.sz * (1 + 0.14 * Math.sin(t * 4.2 + s.i * 2.5 + tier.ti)));
      }
    }
    for (const d of dust) {
      const k = (t * d.s + d.p) % 1;
      const a = d.a + t * 0.35 + k * 2;
      d.o.position.set(Math.cos(a) * d.r, -0.45 + k * 1.3, Math.sin(a) * d.r);
      d.o.scale.setScalar(Math.sin(k * Math.PI) * 0.026 + 0.001);
    }
    for (const w of twinkles) {
      const f = Math.max(0, Math.sin(t * 2.6 + w.p)) ** 6;
      w.o.position.set(Math.cos(w.a + t * 0.25) * w.r, w.y, Math.sin(w.a + t * 0.25) * w.r);
      w.o.scale.setScalar(f * 2.2 + 0.01);
      w.o.rotation.z = t + w.p;
    }
    floor.rotation.y = t * 0.2;
    floor.scale.setScalar(1 + Math.sin(t * 1.6) * 0.05);
  });
};

// MARK: Adventskrans

/** The wreath, merged to one mesh: two layers of dark and mid green boxes, outward fir sprigs, red berries, gold glints, cones. */
function wreath(r: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rnd = seeded(801);
  const greens = ["#1f4d2d", "#2f5d3a", "#3f7a4a", "#2a6a3c"];
  for (let layer = 0; layer < 2; layer++) {
    const n = layer ? 44 : 60;
    for (let i = 0; i < n; i++) {
      const a = ((i + layer * 0.5) / n) * TAU;
      const s = 0.05 + rnd() * 0.03;
      const rr = r + (layer ? -0.025 : 0.015) + (rnd() - 0.5) * 0.03;
      parts.push(
        vbox(
          [s * 1.7, s, s * 1.4],
          [Math.sin(a) * rr, (layer ? 0.035 : 0) + (rnd() - 0.5) * 0.03, Math.cos(a) * rr],
          greens[Math.floor(rnd() * greens.length)]!,
          1,
          1,
          -a + rnd() * 0.4,
          rnd() * 1.1,
        ),
      );
    }
  }
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU + rnd() * 0.2;
    const out = rnd() < 0.5;
    parts.push(
      vbox(
        [0.014, 0.012, 0.085],
        [
          Math.sin(a) * (r + (out ? 0.06 : -0.06)),
          0.02 + rnd() * 0.03,
          Math.cos(a) * (r + (out ? 0.06 : -0.06)),
        ],
        i % 2 ? "#2f7a46" : "#3f8a50",
        1,
        1,
        -a + (out ? 0 : Math.PI) + (rnd() - 0.5) * 0.5,
        0.3,
      ),
    );
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.2;
    const k = 0.022 + rnd() * 0.01;
    parts.push(
      vbox(
        [k, k, k],
        [Math.sin(a) * (r + (rnd() - 0.5) * 0.08), 0.06 + rnd() * 0.02, Math.cos(a) * r],
        "#e0262c",
        1,
        1.25,
        a,
      ),
    );
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.5;
    parts.push(
      vbox([0.016, 0.016, 0.016], [Math.sin(a) * (r + 0.02), 0.075, Math.cos(a) * r], "#ffd36a", 1, 1.6, a),
    );
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.9;
    parts.push(
      vbox(
        [0.034, 0.04, 0.034],
        [Math.sin(a) * (r - 0.04), 0.03, Math.cos(a) * (r - 0.04)],
        "#7a5230",
        1,
        1,
        a,
      ),
    );
  }
  return merge(parts);
}
const WREATH = wreath(0.5);
const BOW = merge([
  vbox([0.05, 0.05, 0.035], [0, 0, 0], "#8e2422"),
  vbox([0.08, 0.06, 0.025], [-0.075, 0.012, 0], "#c8102e", 1, 1, 0, 0),
  vbox([0.08, 0.06, 0.025], [0.075, 0.012, 0], "#c8102e"),
  vbox([0.03, 0.1, 0.02], [-0.03, -0.075, 0], "#b8302c"),
  vbox([0.03, 0.1, 0.02], [0.03, -0.075, 0], "#b8302c"),
]);

/** Candle `i` is lit from `ADVENT[i]` seconds into a 16 s cycle, all four burn until 13, then they go out one breath. */
const ADVENT = [1.5, 4, 6.5, 9];
const ember = (i: number) => basic(i % 3 ? "#ffb04a" : "#ffe08a", 1, true);

// Adventskrans: a big wreath rings the wearer at the hips, turning slowly. Its four candles light one after another
// (first, second, third and fourth Sunday), each with a flare, then burn together, with embers drifting up from the lit
// ones and a warm glow that grows on the wreath and the floor with every flame.
const adventskrans: AuraBuilder = (m, tick) => {
  const tilt = new THREE.Group();
  tilt.rotation.x = 0.16;
  tilt.position.y = -0.1;
  m.add(tilt);
  const ring = new THREE.Group();
  tilt.add(ring);
  mesh(ring, WREATH, vertex());
  const bow = mesh(ring, BOW, vertex());
  bow.position.set(0, 0.07, 0.5);
  const candles = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * TAU + Math.PI / 4;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * 0.5, 0.04, Math.cos(a) * 0.5);
    g.scale.setScalar(1.35);
    ring.add(g);
    const wax = i % 2 ? "#f4ecd8" : "#c8102e";
    cube(g, [0.08, 0.026, 0.08], basic("#c9a14a"), [0, 0.0, 0]);
    cube(g, [0.052, 0.2, 0.052], basic(wax), [0, 0.11, 0]);
    cube(g, [0.056, 0.02, 0.056], basic(i % 2 ? "#c8102e" : "#f4ecd8"), [0, 0.15, 0]);
    cube(g, [0.056, 0.012, 0.056], basic(i % 2 ? "#c8102e" : "#f4ecd8"), [0, 0.07, 0]);
    cube(g, [0.012, 0.05, 0.012], basic("#f4ecd8"), [0.03, 0.17, 0.026]);
    cube(g, [0.006, 0.018, 0.006], basic("#2a1e16"), [0, 0.225, 0]);
    const flame = new THREE.Group();
    flame.position.y = 0.26;
    g.add(flame);
    cube(flame, [0.044, 0.07, 0.044], basic("#ff8a2a", 0.9, true), [0, 0, 0]);
    cube(flame, [0.03, 0.058, 0.03], basic("#ffd36a", 1, true), [0, -0.004, 0]);
    cube(flame, [0.016, 0.032, 0.016], basic("#fff6d0"), [0, -0.012, 0]);
    const halo = cube(flame, [0.15, 0.15, 0.15], basic("#ff9a3c", 0.05, true));
    halo.visible = false;
    const halo2 = cube(flame, [0.08, 0.08, 0.08], basic("#ffd070", 0.14, true));
    return { g, flame, halo, halo2, a };
  });
  const rnd = seeded(802);
  const embers = Array.from({ length: 16 }, (_, i) => ({
    o: cube(m, [0.016, 0.016, 0.016], ember(i)),
    c: i % 4,
    p: rnd(),
    s: 0.25 + rnd() * 0.2,
    w: rnd() * TAU,
  }));
  const wreathGlow = mesh(tilt, pad(1.35, 5, "#ff9a3c", 0.22), vertex("#ffffff", true, true));
  wreathGlow.position.y = -0.03;
  const floor = mesh(m, pad(1.9, 6, "#ff8a2a", 0.2), vertex("#ffffff", true, true));
  floor.position.y = FLOOR;
  tick((t, walking) => {
    const cyc = t % 16;
    const lit = ADVENT.map((on) => {
      const up = smooth(on, on + 0.6, cyc);
      const flare = Math.exp(-((cyc - on - 0.5) ** 2) * 6) * 0.7 * (cyc > on ? 1 : 0);
      return Math.max(0, up * (1 - smooth(13, 14.6, cyc)) + flare);
    });
    ring.rotation.y = t * (walking ? 0.5 : 0.28);
    tilt.position.y = -0.1 + Math.sin(t * 1.2) * 0.02;
    tilt.rotation.z = Math.sin(t * 0.5) * 0.05;
    candles.forEach(({ flame, halo, halo2 }, i) => {
      const f = lit[i]!;
      const flick = 1 + Math.sin(t * 11 + i * 2.3) * 0.12 + Math.sin(t * 17 + i) * 0.08;
      flame.scale.set(
        Math.max(0.001, f / Math.sqrt(flick)),
        Math.max(0.001, f * flick),
        Math.max(0.001, f / Math.sqrt(flick)),
      );
      flame.rotation.z = Math.sin(t * 7 + i) * 0.12;
      flame.rotation.x = Math.sin(t * 5.3 + i * 2) * 0.1;
      halo2.visible = f > 0.02;
      // The halo cubes are inside a scaled flame; undo the squash so they stay cubes.
      halo.scale.set(
        0.22 / Math.max(0.2, flame.scale.x),
        0.22 / Math.max(0.2, flame.scale.y),
        0.22 / Math.max(0.2, flame.scale.z),
      );
      halo2.scale.set(
        0.12 / Math.max(0.2, flame.scale.x),
        0.12 / Math.max(0.2, flame.scale.y),
        0.12 / Math.max(0.2, flame.scale.z),
      );
    });
    for (const e of embers) {
      const f = lit[e.c]!;
      const k = (t * e.s + e.p) % 1;
      const a = candles[e.c]!.a + ring.rotation.y;
      e.o.position.set(
        Math.sin(a) * 0.5 + Math.sin(t * 2 + e.w) * 0.05 * k,
        -0.02 + 0.3 + k * 0.6,
        Math.cos(a) * 0.5 + Math.cos(t * 1.7 + e.w) * 0.05 * k,
      );
      e.o.scale.setScalar((Math.sin(k * Math.PI) * 0.02 + 0.001) * Math.min(1, f * 1.4));
      e.o.rotation.set(t * 3 + e.w, t * 2, 0);
    }
    const sum = (lit[0]! + lit[1]! + lit[2]! + lit[3]!) / 4;
    wreathGlow.scale.setScalar(0.6 + sum * 0.5 + Math.sin(t * 9) * 0.015);
    wreathGlow.visible = floor.visible = sum > 0.01;
    floor.scale.setScalar(0.5 + sum * 0.6 + Math.sin(t * 7) * 0.02);
    floor.rotation.y = t * 0.15;
  });
};

// MARK: Snefnug

const CRYSTAL = pixels(
  ["X..X..X", ".X.X.X.", "..XXX..", "XXXOXXX", "..XXX..", ".X.X.X.", "X..X..X"],
  0.02,
  0.012,
);
const FLAKE = pixels([".X.", "XOX", ".X."], 0.018, 0.012);
/** A sweep of wind: dashes along a helix, merged. */
function streaks(r: number, turns: number, hex: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 44;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const a = k * TAU * turns;
    parts.push(
      vbox(
        [0.07, 0.008, 0.01],
        [Math.sin(a) * r, 0.7 - k * 1.2, Math.cos(a) * r],
        hex,
        0.35 + 0.3 * Math.sin(k * Math.PI),
        1,
        -a + Math.PI / 2,
        0.2,
      ),
    );
  }
  return merge(parts);
}

// Snefnug: a layered blizzard that never lands. Far, slow, big crystals; a middle sheet of crosses; a near sheet of
// fine flakes, each swirling down round the wearer at its own speed with a cold sparkle, wind streaks sweeping the
// other way and a drift of snow with glints on the floor.
const snefnug: AuraBuilder = (m, tick) => {
  const rnd = seeded(803);
  type Flake = {
    o: THREE.Mesh;
    p: number;
    a: number;
    r: number;
    s: number;
    w: number;
    size: number;
    tumble: boolean;
  };
  const flakes: Flake[] = [];
  const add = (o: THREE.Mesh, r0: number, r1: number, s0: number, w: number, size: number, tumble: boolean) =>
    flakes.push({
      o,
      p: rnd(),
      a: rnd() * TAU,
      r: r0 + rnd() * (r1 - r0),
      s: s0 * (0.8 + rnd() * 0.5),
      w: w * (0.8 + rnd() * 0.4),
      size,
      tumble,
    });
  // Far layer: the big crystals, slow, wide, and some of them a pale ice blue.
  for (let i = 0; i < 9; i++)
    add(mesh(m, CRYSTAL, vertex(i % 3 ? "#ffffff" : "#a8d8f2")), 0.62, 0.92, 0.09, 0.22, 1.5, true);
  // Middle: crosses, with two sizes.
  for (let i = 0; i < 14; i++)
    add(
      mesh(m, FLAKE, vertex(i % 2 ? "#ffffff" : "#d4ebf8")),
      0.42,
      0.7,
      0.14,
      0.4,
      1 + (i % 3) * 0.25,
      true,
    );
  // Near: fine bits, quick.
  for (let i = 0; i < 24; i++)
    add(cube(m, [1, 1, 1], basic(i % 3 ? "#ffffff" : "#bcdff2")), 0.28, 0.5, 0.2, 0.7, 0.02, false);
  const winds = [
    mesh(m, streaks(0.55, 2.2, "#dff1fb"), vertex("#ffffff", true, true)),
    mesh(m, streaks(0.78, 1.7, "#a8d8f2"), vertex("#ffffff", true, true)),
  ];
  const drift = mesh(m, pad(1.7, 5, "#cfe9f8", 0.2), vertex("#ffffff", true, true));
  drift.position.y = FLOOR;
  const glints = Array.from({ length: 8 }, () => ({
    o: mesh(m, TWINKLE, vertex("#e8f6ff", true, true)),
    a: rnd() * TAU,
    r: 0.3 + rnd() * 0.55,
    y: rnd() * 1.3 - 0.45,
    p: rnd() * 6,
  }));
  // A low mound of snow cubes round the feet.
  const heap = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * TAU + rnd() * 0.3;
    const r = 0.38 + rnd() * 0.25;
    const s = 0.04 + rnd() * 0.04;
    return cube(m, [s, s * 0.7, s], basic(i % 3 ? "#ffffff" : "#d9ecf7", 0.9), [
      Math.sin(a) * r,
      FLOOR + s * 0.3,
      Math.cos(a) * r,
    ]);
  });
  void heap;
  tick((t, walking) => {
    for (const f of flakes) {
      const k = (t * f.s + f.p) % 1;
      const a = f.a + t * f.w * (walking ? 1.3 : 1) + k * 2.6;
      const r = f.r + Math.sin(k * Math.PI) * 0.05 + Math.sin(t * 1.3 + f.a) * 0.02;
      f.o.position.set(Math.cos(a) * r, 0.85 - k * 1.3 + Math.sin(t * 2 + f.a) * 0.02, Math.sin(a) * r);
      const fade = Math.sin(k * Math.PI) ** 0.5;
      f.o.scale.setScalar(
        (f.tumble ? f.size * (1 + 0.12 * Math.sin(t * 5 + f.a * 3)) : f.size) * fade + 0.001,
      );
      if (f.tumble)
        f.o.rotation.set(Math.sin(t * 0.6 + f.a) * 0.9, t * 0.9 + f.a, t * 0.4 * (f.w > 0.4 ? 1 : -1));
    }
    winds[0]!.rotation.y = -t * 0.45;
    winds[1]!.rotation.y = t * 0.3;
    drift.rotation.y = t * 0.1;
    drift.scale.setScalar(1 + Math.sin(t * 1.1) * 0.04);
    for (const g of glints) {
      const f = Math.max(0, Math.sin(t * 2.2 + g.p)) ** 8;
      g.o.position.set(Math.cos(g.a + t * 0.2) * g.r, g.y - ((t * 0.1) % 0.1), Math.sin(g.a + t * 0.2) * g.r);
      g.o.scale.setScalar(f * 2 + 0.01);
      g.o.rotation.z = g.p + t * 0.5;
    }
  });
};

// MARK: Nordlys

/** A curtain column of five stacked slabs, white with its alpha fading up from the hem: bright bottom edge, ghost top. */
const COLUMN = (() => {
  const parts: THREE.BufferGeometry[] = [];
  const alphas = [0.55, 0.36, 0.22, 0.12, 0.04];
  for (const [i, a] of alphas.entries())
    parts.push(vbox([1, 0.2, 1], [0, 0.1 + i * 0.2, 0], "#ffffff", a, 1.15 - i * 0.1));
  return merge(parts);
})();
/** Green, teal, cyan, violet, magenta: each column picks along them. */
const AURORA = ["#58ffa0", "#3cf0c0", "#44d4f0", "#8a84ff", "#c27cff"];

// Nordlys: three curtains of northern lights wrap the wearer at different radii and heights, each a row of tall slabs
// that fade from a bright hem to nothing, rippling out of phase, shifting from green through teal to violet along their
// length, with a shimmer racing up them, a few stars and a pale glow on the floor. Additive, so overlaps brighten.
const nordlys: AuraBuilder = (m, tick) => {
  const N = 22;
  const ribbons = [
    { r: 0.58, y: -0.2, sweep: Math.PI * 1.6, h: 0.55, sp: 0.26, off: 0 },
    { r: 0.7, y: -0.05, sweep: Math.PI * 1.4, h: 0.62, sp: -0.2, off: 2.2 },
    { r: 0.82, y: 0.1, sweep: Math.PI * 1.2, h: 0.46, sp: 0.14, off: 4.1 },
  ].map((rb, ri) => ({
    ...rb,
    ri,
    cols: Array.from({ length: N }, (_, i) => {
      const k = i / (N - 1);
      const pal = Math.min(AURORA.length - 1, Math.floor(((k + ri * 0.28) % 1) * AURORA.length));
      return { o: mesh(m, COLUMN, vertex(AURORA[pal]!, true, true)), k };
    }),
  }));
  const rnd = seeded(804);
  const shimmer = Array.from({ length: 12 }, (_, i) => ({
    o: cube(m, [1, 1, 1], basic(i % 2 ? "#e8fff4" : "#d8ccff", 0.9, true)),
    ri: i % 3,
    k: rnd(),
    p: rnd(),
    s: 0.12 + rnd() * 0.12,
  }));
  const stars = Array.from({ length: 9 }, () => ({
    o: mesh(m, TWINKLE, vertex("#ffffff", true, true)),
    a: rnd() * TAU,
    y: rnd() * 1.4 - 0.4,
    r: 0.5 + rnd() * 0.45,
    p: rnd() * 6,
  }));
  const floor = mesh(m, pad(1.7, 5, "#58ffc0", 0.14), vertex("#ffffff", true, true));
  floor.position.y = FLOOR;
  const place = (rb: (typeof ribbons)[number], k: number, t: number, walking: boolean) => {
    const base = t * rb.sp * (walking ? 1.6 : 1) + rb.off;
    const a = base + (k - 0.5) * rb.sweep;
    const ri = rb.ri;
    const r = rb.r + Math.sin(t * 0.9 + k * 7 + ri) * 0.035 + Math.sin(t * 0.5 + k * 3) * 0.02;
    const wave = Math.sin(t * 1.2 + k * 6 + ri * 1.7);
    const y = rb.y + wave * 0.09 + Math.sin(t * 0.7 + k * 11 + ri * 3) * 0.04;
    return { a, r, y };
  };
  tick((t, walking) => {
    for (const rb of ribbons) {
      for (const c of rb.cols) {
        const { a, r, y } = place(rb, c.k, t, walking);
        const fade = Math.sin(c.k * Math.PI) ** 0.6;
        const surge = 0.65 + 0.35 * Math.sin(t * 1.7 + c.k * 9 + rb.ri);
        c.o.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        c.o.rotation.set(0, a + Math.sin(t * 0.8 + c.k * 5) * 0.25, 0);
        c.o.scale.set(((rb.sweep * r) / N) * 1.18, rb.h * surge * fade + 0.01, 0.012);
      }
    }
    for (const s of shimmer) {
      const rb = ribbons[s.ri]!;
      const k = (t * s.s + s.p) % 1;
      const col = (s.k * 0.7 + 0.15 + Math.floor(t * s.s + s.p) * 0.137) % 1;
      const { a, r, y } = place(rb, col, t, walking);
      s.o.position.set(Math.sin(a) * r, y + k * rb.h * 0.7, Math.cos(a) * r);
      const q = Math.sin(k * Math.PI) + 0.01;
      s.o.scale.set(0.024 * q, 0.07 * q, 0.024 * q);
    }
    for (const s of stars) {
      const f = Math.max(0, Math.sin(t * 2.4 + s.p)) ** 5;
      s.o.position.set(Math.cos(s.a + t * 0.12) * s.r, s.y, Math.sin(s.a + t * 0.12) * s.r);
      s.o.scale.setScalar(f * 2 + 0.01);
      s.o.rotation.z = t * 0.4 + s.p;
    }
    floor.rotation.y = t * 0.12;
    floor.scale.setScalar(1 + Math.sin(t * 0.8) * 0.06);
  });
};

/** Adds the four auras to `into` (the builders table of `gear3dAura.ts`), keyed by the item's name. */
export function registerJulemarkedAuras(into: Record<string, AuraBuilder>): void {
  into.Julestjerne = julestjerne;
  into.Adventskrans = adventskrans;
  into.Snefnug = snefnug;
  into.Nordlys = nordlys;
}
