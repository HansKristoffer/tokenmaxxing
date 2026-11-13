/**
 * The Julemarked case's hats, glasses and held things in 3D (`core/src/case-julemarked.ts`: four hats, three glasses,
 * five things held). Loaded by `gear3d.ts`, it adds its builders to the shop's `HAT_BUILDERS` / `FACE_BUILDERS` /
 * `HELD_BUILDERS` by item name and pulls in the body half (`gear3dJulemarkedBody.ts`: outfits and back items). Frames are
 * those of `gear3dHead.ts` (origin at the skull's centre, +z the face, +y up) and `gear3dBody.ts` (held: origin at the
 * hand, +z away from the body). Sharp and blocky: boxes and stepped boxes only. Wool, paper and candlelight, with glowing
 * bulbs and flames, and things that move (a tip that sways, a flame that flickers, steam, breath). These are the case's
 * showpieces, so they are bigger and busier than the plain coin stalls (`gear3dJulemarkedStall.ts`).
 * Brief: `docs/cases/julemarked.md`.
 */
import * as THREE from "three";
import type { Model, Paint } from "../kit/kit.ts";
import "./gear3dJulemarkedBody.ts";
import { HELD_BUILDERS, type HeldBuilder } from "./gear3dBody.ts";
import { COVERS_HAIR, EYE_Y, eyeAt, FACE_BUILDERS, HAT_BUILDERS, lit, see, sign } from "./gear3dHead.ts";
import { boxRing, isVox } from "./voxgear.ts";

const RED = "#b8302c";
const RED_DARK = "#8f2421";
const CREAM = "#f4ecd8";
const CREAM_DARK = "#d9cdb0";
const GREEN = "#2f5d3a";
const GREEN_LIGHT = "#44794e";
const GOLD = "#f2c14e";
const WOOD = "#a06a3c";
const PEBER = "#6b3f22";
const WHITE = "#ffffff";

type Ticker = { tick(fn: (t: number) => void): void };

/** A box by its centre (the kit's boxes stand on their bottom centre). */
function bx(
  m: Model,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  paint: Paint,
): THREE.Mesh {
  return m.box([w, h, d], paint, [x, y - h / 2, z], 0.004);
}

/** A glowing material of its own, so it can change colour. */
const bulbMat = (color: string) => new THREE.MeshBasicMaterial({ color });

/** A pattern of cells ("1" is a block) as boxes: `[row][col]`, row 0 at the top, centred on `at`. */
function cells(
  m: Model,
  rows: string[],
  cell: number,
  paint: (r: number, c: number) => Paint,
  at: [number, number, number],
  depth = cell,
): void {
  const w = rows[0]!.length;
  rows.forEach((row, r) => {
    for (let c = 0; c < w; c++) {
      if (row[c] !== "1") continue;
      bx(
        m,
        at[0] + (c - (w - 1) / 2) * cell,
        at[1] - (r - (rows.length - 1) / 2) * cell,
        at[2],
        cell,
        cell,
        depth,
        paint(r, c),
      );
    }
  });
}

/** A point at angle `a` round a head: on a circle for smooth models, on the square band for blocky ones. */
function roundAt(m: THREE.Object3D, a: number, r: number): [number, number] {
  const x = Math.sin(a);
  const z = Math.cos(a);
  if (!isVox(m)) return [x * r, z * r];
  const k = (r * 0.92) / Math.max(Math.abs(x), Math.abs(z));
  return [x * k, z * k];
}

// MARK: Hats

/** A tall stepped red cone, a thick cream brim, and a long floppy tip that curls back and sways, ending in a gold bell. */
function nissehue(m: Model, c: Ticker): void {
  bx(m, 0, 0.15, 0, 0.55, 0.3, 0.55, RED_DARK);
  bx(m, 0, 0.05, 0, 0.62, 0.09, 0.62, CREAM);
  bx(m, 0, 0.01, 0.0, 0.64, 0.03, 0.64, CREAM_DARK);
  for (let i = 0; i < 5; i++) {
    const w = 0.54 - i * 0.075;
    bx(m, 0, 0.32 + i * 0.075, -i * 0.01, w, 0.08, w, i % 2 ? RED : "#c9403a");
  }
  // The floppy tip: a chain of segments, each hung from the last, that curl backwards and ripple.
  const segs: Model[] = [];
  let parent = m.part([0, 0.64, -0.03]);
  const root = parent;
  const N = 7;
  for (let i = 0; i < N; i++) {
    const w = 0.17 * 0.84 ** i;
    const L = 0.15 - i * 0.008;
    bx(parent, 0, L / 2, 0, w, L, w, i % 2 ? RED : "#c9403a");
    const next = parent.part([0, L, 0]);
    segs.push(parent);
    parent = next;
  }
  // The bell on the end: gold, with a dark slit and a glint.
  const bell = parent.part([0, 0.0, 0]);
  bx(bell, 0, 0.04, 0, 0.1, 0.08, 0.1, GOLD);
  bx(bell, 0, 0.082, 0, 0.07, 0.02, 0.07, "#d8a232");
  bx(bell, 0, 0.012, 0.052, 0.07, 0.012, 0.01, "#6b4a12");
  const glint = bx(bell, 0.02, 0.055, 0.052, 0.02, 0.025, 0.01, lit(WHITE));
  segs.forEach((sg) => {
    sg.rotation.x = -0.5;
  });
  c.tick((t) => {
    root.rotation.z = Math.sin(t * 1.8) * 0.08;
    segs.forEach((s, i) => {
      s.rotation.x = -0.5 + Math.sin(t * 2.2 - i * 0.7) * 0.14;
      s.rotation.z = Math.sin(t * 1.7 - i * 0.8) * 0.09;
    });
    bell.rotation.x = Math.sin(t * 5) * 0.25;
    glint.visible = Math.sin(t * 3) > 0.2;
  });
}

/** A cream beanie with a red snowflake band, a ribbed brim and a fat fluffy pompom that bobs. */
function pomponhue(m: Model, c: Ticker): void {
  bx(m, 0, 0.14, 0, 0.55, 0.28, 0.55, CREAM);
  bx(m, 0, 0.3, 0, 0.46, 0.05, 0.46, CREAM);
  bx(m, 0, 0.34, 0, 0.34, 0.04, 0.34, CREAM_DARK);
  // The red band, with a snowflake of white blocks on three sides.
  bx(m, 0, 0.2, 0, 0.58, 0.12, 0.58, RED);
  const flake = ["00100", "10101", "01110", "10101", "00100"];
  const cs = 0.024;
  const out = 0.29 + 0.003;
  for (const [x, z, turn] of [
    [0, out, 0],
    [out, 0, 1],
    [-out, 0, 1],
  ] as const) {
    const f = m.part([x, 0.2, z], turn ? Math.PI / 2 : 0);
    cells(f, flake, cs, () => WHITE, [0, 0, 0], 0.012);
  }
  // The ribbed brim: upright ribs round the bottom.
  bx(m, 0, 0.04, 0, 0.59, 0.09, 0.59, CREAM_DARK);
  for (let i = 0; i < 20; i++) {
    const [x, z] = roundAt(m, (i / 20) * Math.PI * 2, 0.31);
    bx(m, x, 0.04, z, 0.035, 0.09, 0.035, i % 2 ? CREAM : "#e7dcc0");
  }
  // The pompom: a big block ringed with tufts.
  const pom = m.part([0, 0.37, 0]);
  bx(pom, 0, 0.1, 0, 0.2, 0.2, 0.2, CREAM);
  for (const [x, y, z] of [
    [0.11, 0.06, 0.03],
    [-0.11, 0.08, -0.03],
    [0.03, 0.12, 0.11],
    [-0.04, 0.09, -0.11],
    [0.05, 0.22, 0.02],
    [-0.06, 0.2, 0.04],
    [0.0, 0.03, 0.1],
  ] as const)
    bx(pom, x, y, z, 0.09, 0.09, 0.09, y > 0.15 ? "#fffaf0" : "#e9dfc6");
  c.tick((t) => {
    const k = Math.abs(Math.sin(t * 2.6));
    pom.position.y = 0.37 + k * 0.03;
    pom.scale.set(1 + (1 - k) * 0.05, 1 - (1 - k) * 0.08, 1 + (1 - k) * 0.05);
    pom.rotation.z = Math.sin(t * 1.3) * 0.08;
  });
}

/** A pine wreath of chunky leaf blocks round the crown. */
function wreath(m: Model, y: number, ring: number, size: number, n: number): void {
  if (isVox(m)) boxRing(m, GREEN, ring - 0.01, 0.03, [0, y - 0.02, 0]);
  for (let i = 0; i < n; i++) {
    const [x, z] = roundAt(m, (i / n) * Math.PI * 2, ring);
    const dy = (i % 3) * 0.012;
    bx(m, x, y + dy, z, size, size * 0.8, size, i % 2 ? GREEN : GREEN_LIGHT);
    bx(
      m,
      x * 1.02,
      y + 0.045 + dy,
      z * 1.02,
      size * 0.55,
      size * 0.5,
      size * 0.55,
      i % 2 ? GREEN_LIGHT : "#5c9a66",
    );
  }
}

/** A pine wreath with red berries, little coloured lights that blink and a red bow. */
function grankrans(m: Model, c: Ticker): void {
  wreath(m, 0.13, 0.275, 0.115, 16);
  for (let i = 0; i < 9; i++) {
    const [x, z] = roundAt(m, 0.35 + i * 0.7, 0.3);
    bx(m, x, 0.17 + (i % 2) * 0.012, z, 0.04, 0.04, 0.04, RED);
    bx(m, x + 0.008, 0.18 + (i % 2) * 0.012, z + 0.012, 0.012, 0.012, 0.012, "#ffd0c8");
  }
  const cols = ["#ff5a4a", "#ffd24a", "#58d0ff", "#7dff7a"];
  const bulbs: { mat: THREE.MeshBasicMaterial; mesh: THREE.Mesh; i: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const [x, z] = roundAt(m, 0.2 + i * 0.63, 0.31);
    const mat = bulbMat(cols[i % 4]!);
    bulbs.push({ mat, mesh: bx(m, x, 0.115 + (i % 3) * 0.02, z, 0.032, 0.032, 0.032, mat), i });
  }
  const [bx0, bz0] = roundAt(m, -0.75, 0.31);
  const bow = m.part([bx0, 0.16, bz0], -0.75);
  for (const s of [-1, 1]) {
    const loop = bow.box([0.1, 0.075, 0.025], RED, [s * 0.065, -0.04, 0.01], 0.01);
    loop.rotation.z = s * 0.3;
    bow.box([0.04, 0.14, 0.018], RED_DARK, [s * 0.04, -0.2, 0.005], 0.004);
  }
  bow.box([0.055, 0.055, 0.04], RED_DARK, [0, -0.045, 0.02], 0.008);
  c.tick((t) => {
    for (const { mat, mesh, i } of bulbs) {
      const on = Math.sin(t * 3 + i * 1.9) > -0.25;
      mat.color.set(cols[(i + Math.floor(t * 0.9)) % 4]!).multiplyScalar(on ? 1 : 0.3);
      mesh.scale.setScalar(on ? 1.15 : 0.8);
    }
  });
}

/** A leaf crown with five tall candles whose flames flicker, each with a halo of warm light. */
function luciaKrone(m: Model, c: Ticker): void {
  wreath(m, 0.1, 0.27, 0.1, 16);
  const flames: { f: THREE.Mesh; g: THREE.Mesh }[] = [];
  const angles = [-1.0, -0.5, 0, 0.5, 1.0, Math.PI];
  for (const [i, a] of angles.entries()) {
    const [x, z] = roundAt(m, a, 0.255);
    const tall = i === 2 ? 0.2 : 0.16;
    bx(m, x, 0.15 + tall / 2, z, 0.05, tall, 0.05, CREAM);
    bx(m, x + 0.026, 0.15 + tall * 0.7, z, 0.012, 0.07, 0.03, CREAM_DARK);
    bx(m, x, 0.15 + tall + 0.012, z, 0.01, 0.025, 0.01, "#3a2a1e");
    const top = 0.15 + tall + 0.025;
    const f = bx(m, x, top + 0.04, z, 0.062, 0.085, 0.062, lit("#ff9c2e"));
    const g = bx(m, x, top + 0.04, z, 0.032, 0.05, 0.032, lit("#fff3b0"));
    flames.push({ f, g });
  }
  c.tick((t) =>
    flames.forEach(({ f, g }, i) => {
      const k = 1 + Math.sin(t * 9 + i * 2.1) * 0.2 + Math.sin(t * 17 + i) * 0.08;
      f.scale.set(1 - (k - 1) * 0.5, k, 1 - (k - 1) * 0.5);
      g.scale.set(1, 1 + (k - 1) * 1.2, 1);
      f.rotation.z = Math.sin(t * 6 + i * 1.7) * 0.12;
    }),
  );
}

Object.assign(HAT_BUILDERS, {
  Nissehue: (m: Model, c: Ticker) => nissehue(m, c),
  Pomponhue: (m: Model, c: Ticker) => pomponhue(m, c),
  Grankrans: (m: Model, c: Ticker) => grankrans(m, c),
  "Lucia-krone": (m: Model, c: Ticker) => luciaKrone(m, c),
});
for (const n of ["Nissehue", "Pomponhue"]) COVERS_HAIR.add(n);

// MARK: Glasses

/** A square frame, `w` by `h`, of bars `t` thick, round the middle of `e`. */
function frame(e: Model, w: number, h: number, t: number, color: Paint, z = 0): void {
  bx(e, 0, h / 2 - t / 2, z, w, t, t, color);
  bx(e, 0, -h / 2 + t / 2, z, w, t, t, color);
  bx(e, -w / 2 + t / 2, 0, z, t, h - 2 * t, t, color);
  bx(e, w / 2 - t / 2, 0, z, t, h - 2 * t, t, color);
}

/** Arms back past the temples. */
function arms(m: Model, color: string, y = EYE_Y): void {
  const x = isVox(m) ? 0.21 : 0.255;
  for (const s of [-1, 1]) bx(m, s * x, y + 0.005, 0.1, 0.014, 0.014, 0.2, color);
}

Object.assign(FACE_BUILDERS, {
  // Rosy cheeks and a puff of cold breath that drifts off the mouth.
  "Kolde kinder": (m: Model, c: Ticker) => {
    const z = isVox(m) ? 0.25 : 0.268;
    sign(
      m,
      0.46,
      0.1,
      (g, w, h) => {
        g.fillStyle = "#e8666e";
        for (const x0 of [0.04, 0.58]) {
          g.fillRect(x0 * w, 0.05 * h, 0.38 * w, 0.9 * h);
          g.fillStyle = "#f59aa0";
          g.fillRect((x0 + 0.06) * w, 0.2 * h, 0.2 * w, 0.4 * h);
          g.fillStyle = "#e8666e";
        }
      },
      [0, EYE_Y - 0.085, z],
      140,
    );
    // A cold, red nose-tip and two glints of frost.
    bx(m, 0, EYE_Y - 0.07, z + 0.008, 0.05, 0.035, 0.012, "#e0545c");
    const frost = [-0.15, 0.15].map((x) =>
      bx(m, x, EYE_Y - 0.1, z + 0.01, 0.022, 0.022, 0.01, lit("#e6fbff")),
    );
    const puffs = [0, 1, 2].map((i) => {
      const mat = see("#dff6ff", 0.6, true);
      return { mat, mesh: bx(m, 0, EYE_Y - 0.19, z + 0.02, 0.06, 0.05, 0.06, mat), i };
    });
    c.tick((t) => {
      for (const { mat, mesh, i } of puffs) {
        const k = (t * 0.45 + i / 3) % 1;
        const q = Math.min(1, k * 1.6);
        mesh.position.set(Math.sin(k * 6 + i * 2) * 0.012, EYE_Y - 0.19 + k * 0.07, z + 0.02 + q * 0.16);
        mesh.scale.setScalar(0.4 + q * 2.2);
        (mat as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - k) * (k > 0.04 ? 1 : k / 0.04));
      }
      frost.forEach((f, i) => {
        f.scale.setScalar(Math.max(0.1, Math.sin(t * 2.5 + i * 3) ** 3 * 1.3));
      });
    });
  },
  // Square frames made of a string of bulbs that chase one another in red, gold, blue and green.
  "Julelys-briller": (m: Model, c: Ticker) => {
    const cols = ["#ff4a3a", "#ffd24a", "#4aa8ff", "#5cff7a"];
    const bulbs: { mat: THREE.MeshBasicMaterial; mesh: THREE.Mesh; i: number }[] = [];
    let n = 0;
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      frame(e, 0.15, 0.125, 0.008, GREEN, -0.004);
      const w = 0.15;
      const h = 0.125;
      const pts: [number, number][] = [];
      for (let k = 0; k < 5; k++) pts.push([-w / 2 + (k * w) / 4, h / 2]);
      for (let k = 0; k < 5; k++) pts.push([w / 2 - (k * w) / 4, -h / 2]);
      pts.push([-w / 2, 0], [w / 2, 0]);
      for (const [x, y] of pts) {
        const mat = bulbMat(cols[n % 4]!);
        const mesh = bx(e, x, y, 0.008, 0.026, 0.026, 0.024, mat);
        bulbs.push({ mat, mesh, i: n++ });
      }
    }
    bx(m, 0, EYE_Y, 0.245, 0.06, 0.014, 0.014, GREEN);
    arms(m, GREEN);
    c.tick((t) => {
      for (const { mat, mesh, i } of bulbs) {
        const k = Math.floor(t * 3);
        mat.color.set(cols[(i + k) % 4]!);
        mesh.scale.setScalar(0.9 + 0.3 * (Math.sin(t * 6 + i) > 0 ? 1 : 0));
      }
    });
  },
  // Gold rims, a pair of huge fluffy white brows that wiggle.
  Nissebriller: (m: Model, c: Ticker) => {
    const brows: Model[] = [];
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      frame(e, 0.15, 0.12, 0.012, GOLD);
      bx(e, 0, 0, 0.002, 0.14, 0.11, 0.006, see("#fff6d0", 0.22));
      bx(e, s * -0.045, 0.05, 0.012, 0.016, 0.016, 0.01, lit(WHITE));
      const b = e.part([0, 0.095, 0.02]);
      for (const [dx, dy, r, w] of [
        [-0.052, 0.0, 0.05, 0.9],
        [-0.02, 0.022, 0.062, 1],
        [0.016, 0.03, 0.066, 1],
        [0.052, 0.015, 0.056, 1],
        [s * 0.08, -0.012, 0.042, 0.9],
        [-0.005, 0.0, 0.05, 1],
      ] as const)
        bx(b, dx * w, dy, 0, r, r * 0.85, r * 0.9, dy > 0.02 ? "#ffffff" : "#f3efe6");
      brows.push(b);
    }
    bx(m, 0, EYE_Y + 0.02, 0.245, 0.08, 0.016, 0.016, GOLD);
    arms(m, GOLD);
    c.tick((t) =>
      brows.forEach((b, i) => {
        b.position.y = 0.095 + Math.max(0, Math.sin(t * 2.2 + i * 0.4)) ** 3 * 0.012;
        b.rotation.z = Math.sin(t * 1.6 + i * 2) * 0.06;
        b.scale.set(1 + Math.sin(t * 3 + i) * 0.03, 1, 1);
      }),
    );
  },
});

// MARK: Held

/** A rising puff of steam, glitter or dust: `n` translucent blocks that climb, grow and fade. */
function puffs(
  g: Model,
  tick: (fn: (t: number) => void) => void,
  at: [number, number, number],
  n: number,
  size: number,
  rise: number,
  color = WHITE,
  a = 0.55,
): void {
  const list = Array.from({ length: n }, (_, i) => {
    const mat = see(color, a, true);
    return {
      mat: mat as THREE.MeshBasicMaterial,
      mesh: bx(g, at[0], at[1], at[2], size, size, size, mat),
      i,
    };
  });
  tick((t) => {
    for (const { mat, mesh, i } of list) {
      const k = (t * 0.45 + i / n) % 1;
      mesh.position.set(
        at[0] + Math.sin(k * 7 + i * 2.3) * size * 0.7,
        at[1] + k * rise,
        at[2] + Math.cos(k * 5 + i) * size * 0.4,
      );
      mesh.scale.setScalar(0.5 + k * 1.3);
      mat.opacity = a * Math.sin(Math.PI * Math.min(1, k * 1.05)) ** 0.8;
    }
  });
}

/** A held thing is built in its own part, drawn big and set a little forward of the fist. */
const held = (h: Model, z: number, scale = 1.3): Model => {
  const p = h.part([0, 0, z]);
  p.scale.setScalar(scale);
  return p;
};

// biome-ignore format: a catalogue reads best one to a line
const HELD: Record<string, HeldBuilder> = {
  // A cream mug with a red band and a handle, wine-dark gløgg, a cinnamon stick, an orange slice and rising steam.
  "Gløgg mug": (h, tick) => {
    const g = held(h, 0.06);
    bx(g, 0, 0.05, 0, 0.1, 0.1, 0.1, CREAM);
    bx(g, 0, 0.035, 0, 0.104, 0.032, 0.104, RED);
    bx(g, 0, 0.065, 0, 0.104, 0.008, 0.104, GOLD);
    bx(g, 0.07, 0.085, 0, 0.03, 0.02, 0.03, CREAM);
    bx(g, 0.085, 0.055, 0, 0.022, 0.05, 0.03, CREAM);
    bx(g, 0.07, 0.025, 0, 0.03, 0.02, 0.03, CREAM);
    bx(g, 0, 0.099, 0, 0.082, 0.006, 0.082, "#5a1626");
    bx(g, -0.015, 0.103, 0.02, 0.016, 0.01, 0.016, "#2a1418");
    bx(g, 0.02, 0.103, -0.016, 0.014, 0.01, 0.014, "#2a1418");
    // The cinnamon stick leans out of the cup; the orange slice sits on the rim.
    const stick = g.part([-0.025, 0.09, -0.01]);
    stick.rotation.z = -0.3;
    bx(stick, 0, 0.07, 0, 0.018, 0.14, 0.018, "#8a4a26");
    bx(stick, 0, 0.14, 0, 0.012, 0.004, 0.012, "#5a2a12");
    bx(stick, 0.002, 0.04, 0.006, 0.006, 0.08, 0.006, "#a8643a");
    const slice = g.part([0.03, 0.098, 0.05]);
    slice.rotation.z = 0.5;
    bx(slice, 0, 0.0, 0, 0.07, 0.016, 0.05, "#ff9a1f");
    bx(slice, 0, 0.003, 0, 0.056, 0.016, 0.036, "#ffc04a");
    bx(slice, 0, 0.004, 0, 0.004, 0.02, 0.036, "#fff0c4");
    bx(slice, 0.015, 0.004, 0, 0.004, 0.02, 0.036, "#fff0c4");
    bx(slice, -0.015, 0.004, 0, 0.004, 0.02, 0.036, "#fff0c4");
    puffs(g, tick, [0, 0.12, 0], 4, 0.035, 0.22);
    const spark = bx(g, 0.04, 0.12, 0, 0.012, 0.012, 0.012, lit("#ffe9a0"));
    tick((t) => spark.scale.setScalar(Math.max(0.1, Math.sin(t * 3.4) ** 3 * 1.5)));
  },
  // A paper cone with a red stripe, a heap of glazed almonds with sugar glints.
  "Brændte mandler": (h, tick) => {
    const g = held(h, 0.06);
    const bag = g.part([0, 0, 0]);
    bag.rotation.z = 0.08;
    for (let i = 0; i < 8; i++) {
      const w = 0.03 + i * 0.012;
      bx(bag, 0, 0.012 + i * 0.022, 0, w, 0.024, w, i === 2 || i === 3 ? RED : i % 2 ? CREAM : CREAM_DARK);
    }
    bx(bag, 0, 0.19, 0, 0.14, 0.016, 0.14, CREAM_DARK);
    const brown = ["#8a5a2c", "#6b3f1c", "#a06a34", "#5d3418"];
    const al: [number, number, number][] = [
      [0, 0.2, 0],
      [0.035, 0.2, 0.02],
      [-0.035, 0.2, 0.015],
      [0.015, 0.2, -0.04],
      [-0.02, 0.2, -0.035],
      [0.04, 0.2, -0.03],
      [-0.045, 0.2, -0.01],
      [0.015, 0.225, 0.01],
      [-0.02, 0.225, 0.0],
      [0.0, 0.225, -0.025],
      [0.03, 0.225, -0.01],
      [0.0, 0.248, 0.0],
      [-0.012, 0.248, -0.015],
    ];
    al.forEach(([x, y, z], i) => {
      bx(bag, x, y + 0.012, z, 0.04, 0.03, 0.034, brown[i % 4]!);
    });
    // Sugar frosting on the almonds.
    for (const [x, y, z] of [
      [0.0, 0.265, 0.0],
      [0.03, 0.235, 0.015],
      [-0.035, 0.215, 0.02],
      [0.02, 0.22, -0.04],
    ] as const)
      bx(bag, x, y, z, 0.016, 0.01, 0.016, WHITE);
    const sparks = (
      [
        [-0.04, 0.27, 0.03],
        [0.04, 0.26, -0.02],
        [0.0, 0.3, 0.0],
        [0.05, 0.23, 0.04],
      ] as const
    ).map(([x, y, z]) => bx(bag, x, y, z, 0.016, 0.016, 0.016, lit(WHITE)));
    tick((t) =>
      sparks.forEach((s, i) => {
        s.scale.setScalar(Math.max(0.05, Math.sin(t * 3 + i * 2.2) ** 3 * 1.8));
      }),
    );
  },
  // A big plate of golden puffs dusted with sugar, a dollop of jam and drifting powdered sugar.
  Æbleskiver: (h, tick) => {
    const g = held(h, 0.11);
    bx(g, 0, 0.006, 0, 0.27, 0.012, 0.27, RED);
    bx(g, 0, 0.016, 0, 0.24, 0.012, 0.24, CREAM);
    bx(g, 0, 0.022, 0, 0.2, 0.004, 0.2, CREAM_DARK);
    const spots: [number, number][] = [
      [0, 0],
      [0.075, 0.04],
      [-0.075, 0.04],
      [0.045, -0.07],
      [-0.045, -0.07],
    ];
    for (const [x, z] of spots) {
      bx(g, x, 0.042, z, 0.07, 0.04, 0.07, "#c98a3c");
      bx(g, x, 0.074, z, 0.056, 0.03, 0.056, "#e3a850");
      bx(g, x, 0.094, z, 0.036, 0.012, 0.036, WHITE);
      bx(g, x + 0.012, 0.1, z - 0.008, 0.012, 0.01, 0.012, "#fffaf0");
    }
    bx(g, 0.0, 0.03, 0.1, 0.05, 0.03, 0.04, "#d8283a");
    bx(g, 0.0, 0.048, 0.1, 0.034, 0.012, 0.026, "#f5555f");
    const gl = bx(g, -0.01, 0.052, 0.112, 0.01, 0.008, 0.01, lit(WHITE));
    puffs(g, tick, [0.0, 0.11, 0.0], 3, 0.026, 0.14, WHITE, 0.5);
    tick((t) => gl.scale.setScalar(Math.max(0.1, Math.sin(t * 2.6) ** 3 * 1.4)));
  },
  // A red tin with a heart band, its lid ajar, pepper nuts spilling out and rolling down its front.
  "Pebernød tin": (h, tick) => {
    const g = held(h, 0.06);
    bx(g, 0, 0.055, 0, 0.13, 0.11, 0.13, RED);
    bx(g, 0, 0.01, 0, 0.136, 0.02, 0.136, CREAM_DARK);
    bx(g, 0, 0.09, 0, 0.136, 0.012, 0.136, GOLD);
    cells(
      g,
      ["01010", "11111", "01110", "00100"],
      0.017,
      (r) => (r < 2 ? CREAM : CREAM),
      [0, 0.05, 0.068],
      0.008,
    );
    // The lid, hinged at the back and swung open a little, bobbing.
    const lid = g.part([0, 0.114, -0.065]);
    bx(lid, 0, 0.012, 0.067, 0.14, 0.028, 0.14, CREAM);
    bx(lid, 0, 0.03, 0.067, 0.04, 0.012, 0.04, GOLD);
    bx(g, 0, 0.113, 0, 0.11, 0.004, 0.11, "#2a1a10");
    const heap: [number, number, number][] = [
      [0, 0.125, 0.02],
      [0.03, 0.125, -0.025],
      [-0.035, 0.125, 0.0],
      [0.01, 0.145, 0.0],
      [-0.015, 0.14, -0.02],
    ];
    heap.forEach(([x, y, z], i) => {
      bx(g, x, y, z, 0.034, 0.026, 0.034, i % 2 ? PEBER : "#8a5a32");
    });
    // Nuts that tumble out of the lip and down the front.
    const nuts = [0, 1, 2].map((i) => bx(g, 0, 0.12, 0.07, 0.028, 0.026, 0.028, i % 2 ? PEBER : "#8a5a32"));
    tick((t) => {
      lid.rotation.x = -0.6 + Math.sin(t * 1.6) * 0.07;
      nuts.forEach((n, i) => {
        const k = (t * 0.55 + i / 3) % 1;
        n.position.set(0.02 * (i - 1) + Math.sin(k * 5) * 0.01, 0.13 - k * k * 0.2, 0.075 + k * 0.07);
        n.rotation.z = k * 6;
        n.visible = k < 0.9;
      });
    });
  },
  // A bun of roast pork with a glistening amber crackling, in a torn paper sleeve.
  Flæskestegssandwich: (h, tick) => {
    const g = held(h, 0.08);
    const s = g.part([0, 0, 0]);
    s.rotation.x = -0.15;
    bx(s, 0, 0.025, 0, 0.14, 0.05, 0.09, "#d9a35a");
    bx(s, 0, 0.056, 0, 0.1, 0.012, 0.075, "#a86a2c");
    bx(s, 0, 0.044, 0.0, 0.15, 0.022, 0.1, "#f2b8b0");
    bx(s, 0, 0.066, 0.004, 0.15, 0.014, 0.1, "#e8a0a0");
    bx(s, 0, 0.076, 0.0, 0.14, 0.02, 0.095, "#7a2a50");
    // The crackling: amber chunks, with glints that run across them.
    const chunks: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      bx(
        s,
        -0.055 + i * 0.022,
        0.1 + (i % 2) * 0.012,
        -0.004 + (i % 3) * 0.008,
        0.024,
        0.026 + (i % 2) * 0.012,
        0.03,
        i % 2 ? "#d68a1c" : "#f0a830",
      );
      chunks.push(
        bx(s, -0.055 + i * 0.022, 0.116 + (i % 2) * 0.012, 0.012, 0.01, 0.008, 0.008, lit("#fff2b0")),
      );
    }
    bx(s, 0, 0.13, 0, 0.13, 0.04, 0.085, "#e8b96c");
    bx(s, 0, 0.152, 0, 0.1, 0.012, 0.07, "#f4cd86");
    bx(s, 0, -0.03, 0, 0.14, 0.06, 0.1, CREAM);
    bx(s, 0, 0.0, 0, 0.142, 0.01, 0.102, RED);
    bx(s, -0.04, 0.02, 0, 0.06, 0.04, 0.102, CREAM);
    tick((t) =>
      chunks.forEach((c, i) => {
        c.visible = (Math.floor(t * 4) + i * 3) % 6 < 2;
      }),
    );
  },
};
Object.assign(HELD_BUILDERS, HELD);

void WOOD;
