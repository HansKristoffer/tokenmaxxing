import {
  AGUSTUSAN_NPC,
  anniversary,
  BUNTING_ROWS,
  GAPURA,
  isUmbul,
  KERUPUK,
  PANJAT,
  PANJAT_TOP,
  SACK,
  type Spot,
  TUMPENG,
} from "@tokenmaxxing/core/agustusan.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { agustusanNow, climberHeight, kerupukBites } from "../../game/agustusan.ts";
import { skyNow } from "../../game/sky.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { canvasTexture, Model, toon } from "../kit/kit.ts";
import type { Sign } from "../rooms/rooms.ts";

const RED = "#d8283a";
const RED_D = "#a81d2c";
const WHITE = "#fbf7ef";
const BAMBOO = "#c9a95a";
const BAMBOO_D = "#9c7d3a";
const GOLD = "#f5c842";
const GOLD_D = "#c9971f";
const STONE = "#8e8a82";

type At = (tx: number, ty: number) => [number, number];

/** A bendera on a bamboo pole at `at` (world x, z): the red-over-white cloth, flying toward `turn`. */
function bendera(m: Model, at: [number, number], turn: number): void {
  const p = m.part([at[0], 0, at[1]], turn);
  p.cyl(0.05, 3.2, BAMBOO, [0, 0, 0], 0.035, 6);
  for (const y of [0.9, 1.8, 2.6]) p.cyl(0.056, 0.04, BAMBOO_D, [0, y, 0], 0.056, 6);
  p.ball(0.08, GOLD, [0, 3.25, 0], [1, 1, 1], 8);
  p.box([0.9, 0.27, 0.012], RED, [0.5, 2.73, 0], 0.002);
  p.box([0.9, 0.27, 0.012], WHITE, [0.5, 2.46, 0], 0.002);
}

/** An umbul-umbul: a taller pole with a crossbar and a long pennant hanging, red and white, narrowing to a tip. */
function umbul(m: Model, at: [number, number], turn: number): void {
  const p = m.part([at[0], 0, at[1]], turn);
  p.cyl(0.05, 3.7, BAMBOO, [0, 0, 0], 0.035, 6);
  p.box([0.6, 0.04, 0.04], BAMBOO_D, [0.25, 3.5, 0], 0.01);
  p.ball(0.07, GOLD, [0, 3.75, 0], [1, 1, 1], 8);
  for (let i = 0; i < 7; i++) {
    const w = 0.3 - i * 0.034;
    p.box([w, 0.34, 0.012], i % 2 ? WHITE : RED, [0.28 + (i % 2) * 0.004, 3.5 - (i + 1) * 0.34, 0], 0.002);
  }
}

/** Strings of red and white bunting between the tie points (world units), as a cord mesh and a pennant mesh. */
function bunting(strings: readonly { a: THREE.Vector3; b: THREE.Vector3; sag: number }[]): THREE.Group {
  const cords: THREE.BufferGeometry[] = [];
  const flags: THREE.BufferGeometry[] = [];
  const tri = new THREE.Shape();
  tri.moveTo(-0.1, 0);
  tri.lineTo(0.1, 0);
  tri.lineTo(0, -0.28);
  const flag = new THREE.ShapeGeometry(tri);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const m = new THREE.Matrix4();
  for (const s of strings) {
    const len = s.a.distanceTo(s.b);
    const at = (f: number, out = new THREE.Vector3()) =>
      out
        .copy(s.a)
        .lerp(s.b, f)
        .setY(s.a.y + (s.b.y - s.a.y) * f - 4 * s.sag * f * (1 - f));
    const segs = Math.max(6, Math.round(len * 3));
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < segs; i++) {
      at(i / segs, p);
      at((i + 1) / segs, n);
      const g = new THREE.BoxGeometry(p.distanceTo(n), 0.025, 0.025);
      e.set(
        0,
        -Math.atan2(n.z - p.z, n.x - p.x),
        Math.atan2(n.y - p.y, Math.hypot(n.x - p.x, n.z - p.z)),
        "YXZ",
      );
      m.compose(p.clone().add(n).multiplyScalar(0.5), q.setFromEuler(e), one);
      g.applyMatrix4(m);
      cords.push(g);
    }
    const count = Math.max(2, Math.round(len / 0.32));
    const yaw = Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z);
    for (let i = 1; i < count; i++) {
      const g = flag.clone();
      const red = i % 2 === 1;
      const colours = new Float32Array(g.attributes.position!.count * 3);
      const c = new THREE.Color(red ? RED : WHITE);
      for (let k = 0; k < colours.length; k += 3) colours.set([c.r, c.g, c.b], k);
      g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
      m.compose(at(i / count), q.setFromEuler(e.set(0, yaw, 0)), one);
      g.applyMatrix4(m);
      flags.push(g);
    }
  }
  flag.dispose();
  const group = new THREE.Group();
  const cord = mergeGeometries(cords);
  const pennants = mergeGeometries(flags);
  for (const g of [...cords, ...flags]) g.dispose();
  if (cord) group.add(new THREE.Mesh(cord, toon("#5e3d28")));
  if (pennants) {
    const mesh = new THREE.Mesh(
      pennants,
      new THREE.MeshToonMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        gradientMap: toon("#fff").gradientMap,
      }),
    );
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

/** The gate's plaque: DIRGAHAYU RI KE-N over 17 AGUSTUS 1945, white on red and red on white. */
function plaque(years: number): THREE.MeshBasicMaterial {
  const map = canvasTexture(
    512,
    160,
    (g) => {
      g.fillStyle = RED;
      g.fillRect(0, 0, 512, 96);
      g.fillStyle = WHITE;
      g.fillRect(0, 96, 512, 64);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "900 56px system-ui, sans-serif";
      g.fillStyle = WHITE;
      g.fillText(`DIRGAHAYU RI KE-${years}`, 256, 50);
      g.font = "800 40px system-ui, sans-serif";
      g.fillStyle = RED_D;
      g.fillText("17 AGUSTUS 1945", 256, 130);
      g.strokeStyle = GOLD;
      g.lineWidth = 6;
      g.strokeRect(5, 5, 502, 150);
    },
    true,
  );
  return new THREE.MeshBasicMaterial({ map });
}

/** The gapura: two striped posts with tiered roofs, a red beam with the plaque, a gold star, flags on top. */
function gapura(m: Model, left: [number, number], right: [number, number], years: number): void {
  const width = right[0] - left[0];
  const mid = (left[0] + right[0]) / 2;
  const z = left[1];
  for (const x of [left[0], right[0]]) {
    const p = m.part([x, 0, z]);
    p.box([0.62, 0.2, 0.62], STONE, [0, 0, 0], 0.02);
    for (let i = 0; i < 6; i++) p.box([0.5, 0.4, 0.5], i % 2 ? RED : WHITE, [0, 0.2 + i * 0.4, 0], 0.01);
    p.box([0.66, 0.1, 0.66], GOLD_D, [0, 2.6, 0], 0.01);
    p.cyl(0.42, 0.22, RED_D, [0, 2.7, 0], 0.26, 4).rotation.y = Math.PI / 4;
    p.cyl(0.25, 0.18, GOLD_D, [0, 2.9, 0], 0.1, 4).rotation.y = Math.PI / 4;
    p.ball(0.07, GOLD, [0, 3.12, 0], [1, 1, 1], 8);
  }
  // The beam and its plaque.
  m.box([width, 0.78, 0.36], RED_D, [mid, 2.55, z], 0.02);
  m.box([width - 0.5, 0.06, 0.4], GOLD, [mid, 3.3, z], 0.01);
  const board = plaque(years);
  const front = m.plane(width - 0.6, (width - 0.6) * 0.3125, board, [mid, 2.94, z + 0.19]);
  front.castShadow = false;
  const back = m.plane(width - 0.6, (width - 0.6) * 0.3125, board, [mid, 2.94, z - 0.19]);
  back.rotation.y = Math.PI;
  // The crest above the beam: a red disc with a gold star, and a little flag at each end.
  const crest = m.part([mid, 3.4, z]);
  crest.cyl(0.48, 0.1, RED, [0, 0.1, 0], 0.48, 20).rotation.x = Math.PI / 2;
  crest.ball(0.17, GOLD, [0, 0.58, 0.07], [1, 1, 0.3], 5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    crest.box(
      [0.07, 0.3, 0.05],
      GOLD,
      [Math.sin(a) * 0.2, 0.58 + Math.cos(a) * 0.2 - 0.15, 0.08],
      0.005,
    ).rotation.z = -a;
  }
  for (const s of [-1, 1]) {
    const f = m.part([mid + s * (width / 2 - 0.9), 3.3, z]);
    f.cyl(0.03, 0.9, BAMBOO_D, [0, 0, 0], 0.03, 6);
    f.box([0.5, 0.14, 0.012], RED, [0.27, 0.74, 0], 0.002);
    f.box([0.5, 0.14, 0.012], WHITE, [0.27, 0.6, 0], 0.002);
  }
}

/** The panjat pinang pole at `at`: dark wood, bright grease bands, a bamboo cross on top and the prizes hanging from it. */
function panjat(m: Model, at: [number, number]): void {
  const p = m.part([at[0], 0, at[1]]);
  p.cyl(0.19, 0.2, STONE, [0, 0, 0], 0.15, 10);
  p.cyl(0.1, 4.3, "#6d431f", [0, 0.1, 0], 0.085, 10);
  for (let i = 0; i < 8; i++)
    p.cyl(0.108, 0.1, i % 2 ? "#d8c25a" : "#a88a2a", [0, 0.5 + i * 0.5, 0], 0.108, 10);
  // The frame: a cross of bamboo with a ring of canes, and the prizes below it.
  const top = p.part([0, 4.4, 0]);
  top.box([1.3, 0.06, 0.06], BAMBOO, [0, 0, 0], 0.01);
  top.box([0.06, 0.06, 1.3], BAMBOO, [0, 0, 0], 0.01);
  top.cyl(0.03, 0.55, BAMBOO_D, [0, 0.05, 0], 0.025, 6);
  top.box([0.5, 0.13, 0.012], RED, [0.28, 0.45, 0], 0.002);
  top.box([0.5, 0.13, 0.012], WHITE, [0.28, 0.32, 0], 0.002);
  const rope = (x: number, z: number, len: number) =>
    top.box([0.012, len, 0.012], "#5e3d28", [x, -len, z], 0.002);
  // A sarong roll, a boxed fan, a sack of rice, a pair of sandals, a thermos, a gold trophy.
  rope(0.55, 0, 0.3);
  top.box([0.22, 0.3, 0.22], RED, [0.55, -0.62, 0], 0.03);
  rope(-0.55, 0, 0.3);
  top.box([0.3, 0.2, 0.2], WHITE, [-0.55, -0.52, 0], 0.03);
  top.box([0.3, 0.04, 0.2], RED, [-0.55, -0.4, 0], 0.01);
  rope(0, 0.55, 0.35);
  top.ball(0.14, "#c9a56a", [0, -0.5, 0.55], [1, 1.2, 0.9], 8);
  rope(0, -0.55, 0.3);
  top.cyl(0.06, 0.3, GOLD, [0, -0.62, -0.55], 0.06, 8);
  top.ball(0.09, GOLD, [0, -0.28, -0.55], [1, 0.8, 1], 8);
  // A bicycle wheel, hung by its spokes.
  rope(0.38, 0.38, 0.2);
  const wheel = top.cyl(0.18, 0.025, "#2b2433", [0.38, -0.56, 0.38], 0.18, 14);
  wheel.rotation.x = Math.PI / 2;
  const hub = top.cyl(0.14, 0.03, "#e0e6ee", [0.38, -0.56, 0.38], 0.14, 14);
  hub.rotation.x = Math.PI / 2;
}

/** The climber on the pole: a small figure hugging it, a red and white headband; moved up and down by the caller. */
function climber(): Model {
  const m = new Model();
  m.box([0.2, 0.26, 0.12], WHITE, [0, 0.18, 0], 0.03);
  m.ball(0.1, "#c68a5f", [0, 0.56, 0]);
  m.box([0.2, 0.04, 0.2], RED, [0, 0.55, 0], 0.005);
  m.box([0.2, 0.03, 0.2], WHITE, [0, 0.59, 0], 0.005);
  for (const s of [-1, 1]) {
    m.box([0.06, 0.28, 0.06], "#c68a5f", [s * 0.12, 0.3, -0.04], 0.01);
    m.box([0.07, 0.28, 0.07], RED_D, [s * 0.05, -0.05, -0.02], 0.01);
  }
  // It moves: nothing of it goes into a merged mesh.
  m.traverse((o) => {
    o.userData.live = true;
  });
  return m;
}

/** The kerupuk string: two bamboo posts, a cord, and three prawn crackers on strings (they swing, so `swing` keeps them). */
function kerupuk(m: Model, at: [number, number]): THREE.Object3D[] {
  const p = m.part([at[0], 0, at[1]]);
  for (const s of [-1, 1]) {
    p.cyl(0.05, 2.3, BAMBOO, [s * 0.46, 0, 0], 0.04, 6);
    p.ball(0.06, GOLD, [s * 0.46, 2.32, 0], [1, 1, 1], 8);
  }
  p.box([0.95, 0.02, 0.02], "#5e3d28", [0, 2.12, 0], 0.003);
  const swing: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const s = new Model();
    s.position.set(-0.3 + i * 0.3, 2.12, 0);
    s.box([0.01, 0.5 + (i % 2) * 0.1, 0.01], "#5e3d28", [0, -0.5 - (i % 2) * 0.1, 0], 0.002);
    const y = -0.72 - (i % 2) * 0.1;
    s.ball(0.12, "#e9c880", [0, y, 0], [1, 0.9, 0.22], 10);
    s.ball(0.095, "#fff0c8", [0, y, 0.015], [1, 0.9, 0.18], 10);
    // They swing: kept out of the merge (`mergeStill` leaves what is `live` as it is).
    s.traverse((o) => {
      o.userData.live = true;
    });
    p.add(s);
    swing.push(s);
  }
  return swing;
}

/** A flag on a pole by the lane: kind 0 the start (red pennant), 1 the finish (chequered). */
function laneFlag(m: Model, at: [number, number], kind: 0 | 1): void {
  const p = m.part([at[0], 0, at[1]]);
  p.cyl(0.05, 2.4, BAMBOO, [0, 0, 0], 0.035, 6);
  p.ball(0.08, GOLD, [0, 2.45, 0], [1, 1, 1], 8);
  if (kind === 0) {
    p.box([0.6, 0.42, 0.012], RED, [0.33, 1.95, 0], 0.003);
    p.box([0.34, 0.05, 0.016], WHITE, [0.3, 2.13, 0], 0.002);
    p.box([0.07, 0.05, 0.016], WHITE, [0.5, 2.18, 0], 0.002);
    p.box([0.07, 0.05, 0.016], WHITE, [0.5, 2.08, 0], 0.002);
  } else {
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 4; x++)
        p.box(
          [0.16, 0.14, 0.012],
          (x + y) % 2 ? WHITE : "#2b2433",
          [0.1 + x * 0.16, 1.95 + y * 0.14, 0],
          0.002,
        );
  }
  for (let i = 0; i < 2; i++) p.ball(0.2, "#c9a56a", [0.4 + i * 0.35, 0.14, 0.3 - i * 0.2], [1, 0.7, 0.8], 8);
}

/** The lane: red and white dashes along its two edges and a chequered strip at the end, on the ground. */
function lane(m: Model, y: number, x0: number, x1: number, toWorld: At): void {
  const [ax, az] = toWorld(x0, y);
  const [bx] = toWorld(x1, y);
  const dashes = Math.round((bx - ax) / 0.5) + 2;
  for (let i = 0; i < dashes; i++)
    for (const s of [-1, 1])
      m.box([0.3, 0.012, 0.05], i % 2 ? WHITE : RED, [ax - 0.5 + i * 0.5, 0.01, az + s * 0.42], 0.002);
  for (let k = 0; k < 6; k++)
    for (let j = 0; j < 2; j++)
      m.box(
        [0.12, 0.014, 0.12],
        (k + j) % 2 ? WHITE : "#2b2433",
        [bx + 0.35 + j * 0.12, 0.01, az - 0.36 + k * 0.144],
        0.002,
      );
}

/** The tumpeng on its table: a red cloth, a banana-leaf tray, the cone of yellow rice and the side dishes. */
function tumpeng(m: Model, at: [number, number]): void {
  const p = m.part([at[0], 0, at[1]]);
  p.box([0.92, 0.55, 0.92], "#8c5c36", [0, 0, 0], 0.03);
  p.box([0.98, 0.06, 0.98], RED, [0, 0.52, 0], 0.01);
  p.box([1.0, 0.1, 1.0], WHITE, [0, 0.45, 0], 0.01);
  p.cyl(0.4, 0.04, "#3f8c50", [0, 0.58, 0], 0.4, 20);
  p.cyl(0.33, 0.02, "#72bf52", [0, 0.62, 0], 0.33, 20);
  p.cyl(0.27, 0.6, "#f5d04c", [0, 0.62, 0], 0.025, 18);
  for (const [r, y] of [
    [0.2, 0.74],
    [0.14, 0.95],
  ] as const)
    p.cyl(r + 0.01, 0.025, "#e4b238", [0, y, 0], r, 18);
  // A chilli flower on the tip.
  p.ball(0.045, RED, [0, 1.25, 0], [1, 1.3, 1], 6);
  p.cyl(0.015, 0.1, "#3f8c50", [0.0, 1.2, 0.0], 0.01, 4);
  // The dishes round the foot: cucumber, boiled egg, tempeh, a red chilli.
  const dishes = ["#72bf52", WHITE, "#e0a24a", RED, "#72bf52", WHITE, "#e0a24a", RED];
  for (const [i, c] of dishes.entries()) {
    const a = (i / dishes.length) * Math.PI * 2;
    const r = 0.36;
    if (i % 4 === 1) p.ball(0.06, c, [Math.sin(a) * r, 0.66, Math.cos(a) * r], [1, 1.2, 1], 8);
    else p.box([0.1, 0.05, 0.1], c, [Math.sin(a) * r, 0.62, Math.cos(a) * r], 0.015);
  }
}

/** One build of the lot at the current stage. */
interface Built {
  root: THREE.Group;
  flags: THREE.Group | null;
  flagsUp: number;
  gate: THREE.Group;
  lomba: THREE.Group;
  tumpeng: THREE.Group;
  climber: Model;
  swing: THREE.Object3D[];
}

/**
 * Agustusan in the 3D town (`core/src/agustusan.ts` says where; the 2D town is `game/agustusan.ts`, and both ask
 * `agustusanNow`). Built lazily the first frame the theme is on, never in the constructor, and taken down (geometry
 * and all) when the theme ends while the page stays open. The flags are merged and rebuilt only when one more goes
 * up; the gate, the lomba props and the tumpeng come out at their days. Nothing here is pickable or a block (the
 * game's input blocks the prop tiles).
 */
export class Agustusan3d {
  readonly group = new THREE.Group();
  private built: Built | null = null;

  constructor(private readonly toWorld: At) {
    this.group.name = "agustusan";
    this.group.userData.nobatch = true;
    // Empty when the room is baked, it would be put to sleep (hidden, its matrices frozen) as a quiet group.
    this.group.userData.noBake = true;
    this.group.visible = false;
  }

  update(t: number): void {
    const a = agustusanNow();
    if (!a) {
      if (this.built) this.clear();
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.built ??= this.build();
    const b = this.built;
    if (b.flagsUp !== a.up) this.raise(b, a.flags, a.up);
    b.gate.visible = a.stand.gapura;
    b.lomba.visible = a.stand.lomba;
    b.tumpeng.visible = a.stand.tumpeng;
    b.climber.visible = false;
    if (!b.lomba.visible) return;
    const now = performance.now();
    const h = climberHeight(now);
    b.climber.visible = b.lomba.visible && h > 0;
    b.climber.position.y = 0.35 + (h / PANJAT_TOP) * 3.3;
    b.climber.rotation.z = Math.sin(t * 6) * 0.04;
    const biting = kerupukBites(now) > 0;
    for (const [i, s] of b.swing.entries())
      s.rotation.z = biting ? Math.sin(t * 7 + i * 1.7) * 0.28 : Math.sin(t * 1.2 + i) * 0.05;
  }

  private build(): Built {
    const root = new THREE.Group();
    const w = this.toWorld;
    const years = anniversary(skyNow());

    // The gate and the bunting that ties it to the poles.
    const gate = new THREE.Group();
    const gm = new Model();
    gapura(gm, w(GAPURA.left.x, GAPURA.left.y), w(GAPURA.right.x, GAPURA.right.y), years);
    gate.add(gm);
    mergeStill(gm);
    const tie = (s: Spot): THREE.Vector3 => {
      const [x, z] = w(s.x, s.y);
      const post = (s.x === GAPURA.left.x || s.x === GAPURA.right.x) && s.y === GAPURA.left.y;
      return new THREE.Vector3(post ? x + (s.x === GAPURA.left.x ? 0.3 : -0.3) : x, post ? 2.45 : 2.9, z);
    };
    gate.add(bunting(BUNTING_ROWS.map(([p, q]) => ({ a: tie(p), b: tie(q), sag: 0.28 }))));
    root.add(gate);

    // The lomba: pole, kerupuk string, the sack race.
    const lomba = new THREE.Group();
    const lm = new Model();
    panjat(lm, w(PANJAT.x, PANJAT.y));
    const swing = kerupuk(lm, w(KERUPUK.x, KERUPUK.y));
    laneFlag(lm, w(SACK.start.x, SACK.start.y), 0);
    laneFlag(lm, w(SACK.finish.x, SACK.finish.y), 1);
    lane(lm, SACK.y, SACK.laneX0, SACK.laneX1, w);
    lomba.add(lm);
    mergeStill(lm);
    root.add(lomba);
    // The climber is the root's, not the lomba's: shown only while somebody is on the pole.
    const c = climber();
    const [px, pz] = w(PANJAT.x, PANJAT.y);
    c.position.set(px, 0.35, pz + 0.17);
    c.visible = false;
    root.add(c);

    const tum = new THREE.Group();
    const tm = new Model();
    tumpeng(tm, w(TUMPENG.x, TUMPENG.y));
    tum.add(tm);
    mergeStill(tm);
    root.add(tum);

    root.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    this.group.add(root);
    return { root, flags: null, flagsUp: -1, gate, lomba, tumpeng: tum, climber: c, swing };
  }

  /** Puts `up` flags up (rebuilding the merged mesh): the square's first, then the streets'. */
  private raise(b: Built, flags: readonly Spot[], up: number): void {
    if (b.flags) {
      b.root.remove(b.flags);
      disposeObject(b.flags);
    }
    const g = new THREE.Group();
    const m = new Model();
    for (const [i, s] of flags.slice(0, up).entries()) {
      const at = this.toWorld(s.x, s.y);
      const turn = i % 2 ? Math.PI - 0.25 : 0.25;
      (isUmbul(i) ? umbul : bendera)(m, at, turn);
    }
    g.add(m);
    mergeStill(m);
    g.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    b.root.add(g);
    b.flags = g;
    b.flagsUp = up;
  }

  /** Pak Budi's name and the lomba's, over their tiles (the 2D town labels them the same). */
  signs(): Sign[] {
    const a = agustusanNow();
    if (!a || !this.built) return [];
    const at = (s: Spot, y: number): [number, number, number] => {
      const [x, z] = this.toWorld(s.x, s.y);
      return [x, y, z];
    };
    const out: Sign[] = [
      {
        key: "agustusan-npc",
        at: at(AGUSTUSAN_NPC, 1.7),
        kind: "label",
        text: AGUSTUSAN_NPC.name,
        cls: "gold",
      },
    ];
    if (a.stand.play)
      out.push(
        { key: "agustusan-panjat", at: at(PANJAT, 5.0), kind: "label", text: "🧗 Panjat pinang" },
        { key: "agustusan-kerupuk", at: at(KERUPUK, 2.6), kind: "label", text: "🍘 Makan kerupuk" },
        { key: "agustusan-karung", at: at(SACK.start, 2.7), kind: "label", text: "🏁 Balap karung" },
      );
    return out;
  }

  private clear(): void {
    if (this.built) {
      this.group.remove(this.built.root);
      disposeObject(this.built.root);
    }
    this.built = null;
  }

  dispose(): void {
    this.clear();
  }
}
