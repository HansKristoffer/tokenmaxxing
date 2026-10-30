import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import {
  type Bunting,
  buntingStrings,
  CRITTERS,
  type Critter,
  type CritterKind,
  critterAt,
  EASTER_TREE,
  EGG_COLOURS,
  type Egg,
  eggKey,
  FARMER_TILE,
  type Flower,
  FROKOST,
  flowerSpots,
  noise,
  PAASKE_FARMER,
  STALL,
  shown,
} from "@tokenmaxxing/core/paaske.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { talkToFestiveNpc } from "../../game/festive-npc.ts";
import { eggsLeft, followerNow, paaskeLayout, paaskeNow, paaskeTick } from "../../game/paaske.ts";
import { skyNow } from "../../game/sky.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Model, toon } from "../kit/kit.ts";
import type { Sign } from "../rooms/rooms.ts";

/**
 * Påske in the 3D town (`core/src/paaske.ts`; the 2D one is `game/paaske.ts`, and both ask it what is out and what has
 * been found): flowers coming up in eight waves, the påskeris, Gudrun's stall, the påskefrokost table, pastel bunting between
 * the square's lamps, the day's hidden eggs, lambs, bunnies and chicks, and the chick that follows whoever found them all.
 *
 * Built lazily the first frame Påske is on, taken down (geometry and all) when it ends while the page stays open. The
 * still parts are merged into a few meshes per wave; only the eggs, critters and the follower are separate.
 */

const GREEN = "#4f9b3d";
const GREEN_D = "#3a7b2f";
const YELLOW = "#f7d23a";
const ORANGE = "#e8902a";
const WHITE = "#fbf7ef";
const PINK = "#ec6fa0";
const BIRCH = "#c9bba9";
const PASTEL = ["#f4a6c8", "#f7e27a", "#9ccff2", "#a6dc92", "#c8aaf0"];
/** Where the bunting's ends tie on the lamps. */
const LAMP_TOP = 2.35;

type Part = (m: Model, x: number, z: number) => void;

/** The flowers are drawn this much bigger than life: the town is seen from far off. */
const K = 1.7;

/** A påskelilje: a yellow star of petals round an orange trumpet, on a stem. */
const narcissus: Part = (m, x, z) => {
  const h = (0.26 + noise(x * 10, z * 10, 1) * 0.1) * K;
  m.cyl(0.013 * K, h, GREEN, [x, 0, z], 0.01 * K, 5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.ball(0.032 * K, YELLOW, [x + Math.cos(a) * 0.04 * K, h, z + Math.sin(a) * 0.04 * K], [1, 0.35, 1], 6);
  }
  m.cyl(0.026 * K, 0.045 * K, ORANGE, [x, h - 0.01 * K, z], 0.034 * K, 6);
};

/** A vintergæk: a white bell hanging from a bent stem. */
const vintergaek: Part = (m, x, z) => {
  m.cyl(0.01 * K, 0.2 * K, GREEN, [x, 0, z], 0.008 * K, 4);
  m.ball(0.026 * K, WHITE, [x + 0.03 * K, 0.18 * K, z], [0.85, 1.15, 0.85], 6);
  m.ball(0.012 * K, "#8cc87a", [x + 0.03 * K, 0.15 * K, z], [1, 0.7, 1], 5);
  m.ball(0.015 * K, GREEN, [x + 0.012 * K, 0.205 * K, z], [1, 1, 1], 4);
};

/** A tulip: a pink cup on a stem with a leaf. */
const tulip: Part = (m, x, z) => {
  m.cyl(0.012 * K, 0.24 * K, GREEN, [x, 0, z], 0.009 * K, 5);
  m.ball(0.04 * K, PINK, [x, 0.27 * K, z], [0.9, 1.2, 0.9], 7);
  m.ball(0.02 * K, "#f9a6c6", [x, 0.3 * K, z + 0.012 * K], [1, 1, 0.6], 5);
  m.ball(0.03 * K, GREEN_D, [x + 0.03 * K, 0.08 * K, z], [0.35, 1.8, 0.8], 5);
};

const BLOOM = { narcissus, vintergaek, tulip };

/** The flower clumps `from`..`to`, as one merged model in world units (`at` gives a tile's middle). */
function flowerWave(flowers: Flower[], at: (x: number, y: number) => [number, number]): Model {
  const m = new Model();
  for (const f of flowers) {
    const [cx, cz] = at(f.x, f.y);
    const n = f.kind === "tulip" ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const a = noise(f.x, f.y, i + 11) * Math.PI * 2;
      const r = 0.12 + noise(f.x, f.y, i + 21) * 0.28;
      BLOOM[f.kind](m, cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    }
  }
  return m;
}

/** A painted egg lying in the grass at (x, z). */
function eggModel(colour: number): THREE.Object3D {
  const [base, stripe] = EGG_COLOURS[colour % EGG_COLOURS.length]!;
  const m = new Model();
  m.ball(0.1, base, [0, 0.11, 0], [1, 1.28, 1], 10);
  m.cyl(0.092, 0.035, stripe, [0, 0.1, 0], 0.092, 10);
  m.cyl(0.07, 0.025, stripe, [0, 0.17, 0], 0.07, 10);
  m.ball(0.02, "#ffffff", [-0.04, 0.17, 0.07], [1, 1.2, 0.5], 5);
  return m;
}

// MARK: Still props

/** The påskeris: birch twigs in a blue-and-white vase, hung with feathers and painted eggs. */
function treeModel(): Model {
  const m = new Model();
  m.cyl(0.2, 0.5, "#eaf1fb", [0, 0, 0], 0.24, 14);
  m.cyl(0.21, 0.06, "#4a7bc4", [0, 0.14, 0], 0.21, 14);
  m.cyl(0.235, 0.06, "#4a7bc4", [0, 0.34, 0], 0.235, 14);
  const twigs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const lean = 0.22 + noise(i, 3, 4) * 0.28;
    const len = 1.5 + noise(i, 5, 6) * 0.45;
    const t = m.part([Math.cos(a) * 0.06, 0.5, Math.sin(a) * 0.06]);
    t.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    t.cyl(0.014, len, BIRCH, [0, 0, 0], 0.006, 4);
    // A side twig, and a bud at the tip.
    const side = t.part([0, len * 0.55, 0]);
    side.rotation.z = i % 2 ? 0.7 : -0.7;
    side.cyl(0.008, 0.5, BIRCH, [0, 0, 0], 0.004, 4);
    t.ball(0.025, "#8cc87a", [0, len, 0], [1, 1.4, 1], 5);
    twigs.push([Math.cos(a) * (lean * len * 0.9), len, Math.sin(a) * (lean * len * 0.9)]);
  }
  // Eggs and feathers hung along the twigs.
  for (let i = 0; i < 16; i++) {
    const a = noise(i, 1, 9) * Math.PI * 2;
    const y = 0.9 + noise(i, 2, 9) * 1.1;
    const r = 0.1 + (y - 0.5) * 0.28 * (0.6 + noise(i, 3, 9) * 0.5);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (i % 3 === 0) {
      m.box([0.035, 0.22, 0.01], PASTEL[i % PASTEL.length]!, [x, y - 0.22, z], 0.004).rotation.z = 0.15;
    } else {
      const [base, stripe] = EGG_COLOURS[i % EGG_COLOURS.length]!;
      m.cyl(0.004, 0.1, "#d9d3c6", [x, y, z], 0.004, 3);
      m.ball(0.052, base, [x, y - 0.06, z], [1, 1.28, 1], 8);
      m.cyl(0.05, 0.02, stripe, [x, y - 0.065, z], 0.05, 8);
    }
  }
  return m;
}

/** Gudrun's trestle: a plank on legs with paint pots, a brush and eggs drying. */
function stallModel(): Model {
  const m = new Model();
  m.box([0.9, 0.06, 0.55], "#d49c67", [0, 0.62, 0], 0.01);
  for (const x of [-0.38, 0.38])
    for (const z of [-0.2, 0.2]) m.box([0.06, 0.62, 0.06], "#8c5c36", [x, 0, z], 0.01);
  m.box([0.7, 0.04, 0.04], "#8c5c36", [0, 0.2, 0.2], 0.01);
  [
    ["#e8584f", -0.3],
    ["#f5d14a", -0.14],
    ["#5fa8e0", 0.02],
  ].forEach(([c, x]) => {
    m.cyl(0.055, 0.1, c as string, [x as number, 0.68, -0.08], 0.05, 8);
    m.cyl(0.05, 0.012, WHITE, [x as number, 0.775, -0.08], 0.05, 8);
  });
  m.cyl(0.008, 0.2, "#8c5c36", [0.1, 0.68, -0.05], 0.008, 4).rotation.z = 1.1;
  [0, 3, 1, 4].forEach((c, i) => {
    const [base, stripe] = EGG_COLOURS[c]!;
    m.ball(0.045, base, [0.2 + (i % 2) * 0.1, 0.73, -0.1 + Math.floor(i / 2) * 0.14], [1, 1.28, 1], 8);
    m.cyl(0.043, 0.014, stripe, [0.2 + (i % 2) * 0.1, 0.72, -0.1 + Math.floor(i / 2) * 0.14], 0.043, 8);
  });
  return m;
}

/** The påskefrokost table: white cloth, herring, eggs, rye bread, snaps and a jar of narcissi. Two tiles wide. */
function frokostModel(): Model {
  const m = new Model();
  m.box([1.9, 0.06, 0.8], "#d49c67", [0, 0.68, 0], 0.01);
  m.box([1.96, 0.025, 0.86], WHITE, [0, 0.74, 0], 0.01);
  m.box([1.96, 0.25, 0.012], "#e8e2d4", [0, 0.5, 0.43], 0.004);
  m.box([1.96, 0.25, 0.012], "#e8e2d4", [0, 0.5, -0.43], 0.004);
  for (let i = 0; i < 8; i++) {
    const x = -0.85 + i * 0.245;
    m.box([0.1, 0.07, 0.014], PASTEL[i % PASTEL.length]!, [x, 0.4, 0.44], 0.004);
    m.box([0.1, 0.07, 0.014], PASTEL[(i + 2) % PASTEL.length]!, [x, 0.4, -0.44], 0.004);
  }
  for (const x of [-0.85, 0.85])
    for (const z of [-0.3, 0.3]) m.box([0.07, 0.68, 0.07], "#8c5c36", [x, 0, z], 0.01);
  // Herring on a plate, with onion and dill.
  m.cyl(0.17, 0.03, "#4a7bc4", [-0.65, 0.76, 0], 0.17, 12);
  m.cyl(0.15, 0.022, "#eaf1fb", [-0.65, 0.79, 0], 0.15, 12);
  m.ball(0.06, "#b9c4cf", [-0.68, 0.83, 0.02], [2.2, 0.55, 0.8], 8);
  m.ball(0.04, "#9a4a8a", [-0.6, 0.83, -0.04], [1, 0.4, 1], 6);
  m.ball(0.025, GREEN, [-0.72, 0.84, -0.05], [1, 0.5, 1], 5);
  // Egg halves.
  for (let i = 0; i < 4; i++) {
    const x = -0.15 + i * 0.16;
    m.ball(0.052, WHITE, [x, 0.8, 0.1], [1, 0.8, 1.25], 8);
    m.ball(0.026, "#f5c842", [x, 0.835, 0.1], [1, 0.6, 1], 6);
  }
  // Rye bread with butter.
  m.box([0.34, 0.05, 0.2], "#6b4226", [0.55, 0.76, 0.12], 0.01);
  m.box([0.14, 0.03, 0.12], "#f5d14a", [0.62, 0.81, 0.12], 0.008);
  // The snaps: a bottle and glasses.
  m.cyl(0.04, 0.26, "#7fb89a", [0.15, 0.76, -0.22], 0.04, 8);
  m.cyl(0.015, 0.1, "#7fb89a", [0.15, 1.02, -0.22], 0.015, 6);
  for (const x of [0.32, 0.42]) m.cyl(0.02, 0.06, "#d6efe2", [x, 0.76, -0.2], 0.026, 6);
  // A jam jar of narcissi.
  m.cyl(0.05, 0.12, "#cde9f6", [0.85, 0.76, 0.1], 0.05, 8);
  for (const [dx, dh] of [
    [-0.02, 0.28],
    [0.02, 0.22],
    [0, 0.34],
  ] as const) {
    m.cyl(0.006, dh, GREEN, [0.85 + dx, 0.82, 0.1], 0.006, 4);
    m.ball(0.04, YELLOW, [0.85 + dx, 0.82 + dh, 0.1], [1, 0.5, 1], 6);
    m.ball(0.02, ORANGE, [0.85 + dx, 0.84 + dh, 0.12], [1, 1, 1], 5);
  }
  return m;
}

/** Strings of pastel bunting: a cord that sags and a pennant on it every third of a unit, one mesh each. */
function buntingModel(strings: { a: THREE.Vector3; b: THREE.Vector3; sag: number }[]): THREE.Group {
  const cords: THREE.BufferGeometry[] = [];
  const flags: THREE.BufferGeometry[] = [];
  const tri = new THREE.Shape();
  tri.moveTo(-0.11, 0);
  tri.lineTo(0.11, 0);
  tri.lineTo(0, -0.3);
  const flag = new THREE.ShapeGeometry(tri);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const colour = new THREE.Color();
  for (const s of strings) {
    const len = s.a.distanceTo(s.b);
    const at = (f: number): THREE.Vector3 =>
      s.a
        .clone()
        .lerp(s.b, f)
        .setY(s.a.y + (s.b.y - s.a.y) * f - 4 * s.sag * f * (1 - f));
    const segs = Math.max(6, Math.round(len * 3));
    for (let i = 0; i < segs; i++) {
      const p = at(i / segs);
      const n = at((i + 1) / segs);
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
    const yaw = Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z);
    const count = Math.max(2, Math.round(len / 0.34));
    for (let i = 1; i < count; i++) {
      const g = flag.clone();
      colour.set(PASTEL[i % PASTEL.length]!);
      const colours = new Float32Array(g.attributes.position!.count * 3);
      for (let k = 0; k < colours.length; k += 3) colours.set([colour.r, colour.g, colour.b], k);
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
  if (cord) group.add(new THREE.Mesh(cord, toon("#7a5a40")));
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

// MARK: Critters

const CHICK = "#ffe36a";

/** A chick, 0.25 high, facing +z. */
function chickModel(): Model {
  const m = new Model();
  m.ball(0.1, CHICK, [0, 0.12, 0], [1, 0.95, 1.05], 9);
  m.ball(0.065, CHICK, [0, 0.23, 0.06], [1, 1, 1], 8);
  m.cyl(0.02, 0.05, "#f08a2a", [0, 0.225, 0.1], 0.002, 4).rotation.x = Math.PI / 2;
  for (const x of [-0.03, 0.03]) m.ball(0.011, "#2b2433", [x, 0.25, 0.108], [1, 1, 1], 4);
  for (const x of [-0.04, 0.04]) m.cyl(0.006, 0.05, "#f08a2a", [x, 0, 0.01], 0.006, 3);
  m.ball(0.05, "#f2c230", [0, 0.13, -0.07], [1.5, 0.8, 0.8], 6);
  return m;
}

/** A bunny, 0.4 high with its ears, facing +z. */
function bunnyModel(): Model {
  const m = new Model();
  m.ball(0.12, "#f6f1e7", [0, 0.14, 0], [0.95, 0.9, 1.35], 10);
  m.ball(0.08, "#f6f1e7", [0, 0.24, 0.14], [1, 1, 1], 9);
  for (const s of [-1, 1]) {
    const ear = m.part([s * 0.035, 0.29, 0.13]);
    ear.rotation.z = -s * 0.2;
    ear.ball(0.028, "#f6f1e7", [0, 0.07, 0], [0.8, 3.4, 0.5], 6);
    ear.ball(0.016, "#f2a6b8", [0, 0.07, 0.01], [0.7, 3, 0.4], 5);
    m.ball(0.011, "#2b2433", [s * 0.042, 0.255, 0.205], [1, 1, 1], 4);
    m.ball(0.04, "#f6f1e7", [s * 0.08, 0.06, -0.06], [0.7, 1, 1.5], 6);
  }
  m.ball(0.014, "#f08aa0", [0, 0.235, 0.225], [1, 1, 1], 4);
  m.ball(0.05, WHITE, [0, 0.14, -0.17], [1, 1, 1], 6);
  return m;
}

/** A lamb, 0.45 high, facing +z: fluffy white, a dark face and legs. */
function lambModel(): Model {
  const m = new Model();
  m.ball(0.17, WHITE, [0, 0.3, 0], [0.9, 0.85, 1.3], 10);
  for (const [x, y, z] of [
    [0.08, 0.38, 0.1],
    [-0.08, 0.38, -0.1],
    [0.07, 0.36, -0.15],
    [-0.07, 0.37, 0.14],
  ] as const)
    m.ball(0.08, WHITE, [x, y, z], [1, 0.9, 1], 8);
  m.ball(0.07, "#4a3f48", [0, 0.36, 0.26], [0.9, 1.05, 1.15], 8);
  for (const s of [-1, 1]) {
    m.ball(0.03, "#4a3f48", [s * 0.075, 0.4, 0.24], [1.6, 0.5, 0.8], 5);
    m.ball(0.011, WHITE, [s * 0.035, 0.38, 0.32], [1, 1, 1], 4);
    for (const z of [-0.12, 0.12]) m.cyl(0.018, 0.2, "#4a3f48", [s * 0.07, 0, z], 0.016, 5);
  }
  return m;
}

const MODELS: Record<CritterKind, () => Model> = { chick: chickModel, bunny: bunnyModel, lamb: lambModel };
/** How high each hops, in units. */
const HOP: Record<CritterKind, number> = { chick: 0.05, bunny: 0.12, lamb: 0.025 };

interface Walker {
  c: Critter;
  root: THREE.Group;
}

// MARK: The scene

interface Built {
  map: GameMap;
  group: THREE.Group;
  waves: { from: number; model: Model }[];
  total: number;
  buntingLong: THREE.Object3D;
  buntingShort: THREE.Object3D;
  eggs: { day: string; root: THREE.Group; items: Map<string, THREE.Object3D> } | null;
  walkers: Walker[];
  follower: THREE.Group;
}

const WAVES = 8;

export class Paaske3d {
  readonly group = new THREE.Group();
  private built: Built | null = null;

  constructor(
    private readonly map: GameMap,
    private readonly toWorld: (tx: number, ty: number) => [number, number],
  ) {
    this.group.name = "paaske";
    this.group.userData.nobatch = true;
    this.group.visible = false;
  }

  update(t: number): void {
    const intensity = paaskeNow();
    if (intensity === null) {
      if (this.built) this.clear();
      this.group.visible = false;
      return;
    }
    if (!this.built) this.build();
    const b = this.built!;
    this.group.visible = true;
    paaskeTick();
    // Flowers come up wave by wave.
    const n = shown(b.total, intensity);
    for (const w of b.waves) w.model.visible = w.from < n;
    b.buntingShort.visible = intensity >= 0.45;
    this.eggs(b);
    const out = shown(b.walkers.length, intensity);
    const ms = skyNow();
    b.walkers.forEach((w, i) => {
      w.root.visible = i < out;
      if (i >= out) return;
      const p = critterAt(w.c, ms);
      const [x, z] = this.toWorld(p.x, p.y);
      w.root.position.set(x, p.hop * HOP[w.c.kind], z);
      w.root.rotation.y = p.right ? Math.PI / 2 : -Math.PI / 2;
    });
    const fol = followerNow(t * 1000);
    b.follower.visible = fol !== null;
    if (fol) {
      const [x, z] = this.toWorld(fol.x, fol.y);
      b.follower.position.set(x, fol.hop * HOP.chick, z);
      b.follower.rotation.y = fol.right ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  /** Gudrun's name over her head, a button that talks to her; only while she is there. */
  signs(): Sign[] {
    if (!this.built) return [];
    const [x, z] = this.toWorld(FARMER_TILE.x, FARMER_TILE.y);
    return [
      {
        key: "paaske-gudrun",
        at: [x, 1.95, z],
        kind: "label",
        text: `🥚 ${PAASKE_FARMER.name}`,
        cls: "gold",
        onClick: talkToFestiveNpc,
      },
    ];
  }

  /** The day's eggs still in the grass: rebuilt when the world day turns, hidden as they are found. */
  private eggs(b: Built): void {
    const day = paaskeLayout().day;
    if (b.eggs?.day !== day) {
      if (b.eggs) {
        this.group.remove(b.eggs.root);
        disposeObject(b.eggs.root);
      }
      const root = new THREE.Group();
      const items = new Map<string, THREE.Object3D>();
      for (const e of paaskeLayout().eggs) {
        const m = eggModel(e.colour);
        m.userData.egg = true;
        // Bigger than an egg: the town is seen from far off, and they are meant to be found.
        m.scale.setScalar(1.6);
        const [x, z] = this.toWorld(e.x, e.y);
        m.position.set(x + (noise(e.x, e.y, 3) - 0.5) * 0.4, 0, z + (noise(e.x, e.y, 4) - 0.5) * 0.3);
        m.rotation.set((noise(e.x, e.y, 5) - 0.5) * 0.5, noise(e.x, e.y, 6) * 6, 0.35);
        root.add(m);
        items.set(eggKey(e), m);
      }
      this.group.add(root);
      b.eggs = { day, root, items };
    }
    const left = new Set(eggsLeft().map((e: Egg) => eggKey(e)));
    for (const [k, o] of b.eggs.items) o.visible = left.has(k);
  }

  private build(): void {
    const { map, toWorld } = this;
    const group = new THREE.Group();
    group.name = "paaske-scene";
    const at = (x: number, y: number) => toWorld(x, y);
    // Flowers, in waves of the order they come up.
    const flowers = flowerSpots(map);
    const per = Math.ceil(flowers.length / WAVES);
    const waves: Built["waves"] = [];
    for (let i = 0; i < flowers.length; i += per) {
      const model = flowerWave(flowers.slice(i, i + per), at);
      group.add(model);
      waves.push({ from: i, model });
    }
    // The still props: placed in world space under one holder at the origin and merged together, like the flowers.
    const props = new Model();
    group.add(props);
    const still = (model: Model, x: number, z: number, turn = 0) => {
      model.position.set(x, 0, z);
      model.rotation.y = turn;
      props.add(model);
    };
    const [tx, tz] = toWorld(EASTER_TREE.x, EASTER_TREE.y);
    still(treeModel(), tx, tz);
    const [sx, sz] = toWorld(STALL.x, STALL.y);
    still(stallModel(), sx, sz);
    const [fx, fz] = toWorld(FROKOST.x, FROKOST.y);
    still(frokostModel(), fx + (FROKOST.w - 1) / 2, fz);
    mergeStill(props);
    // The waves merge too, in place (their parts are in world space).
    for (const w of waves) mergeStill(w.model);
    // Bunting.
    const strings = buntingStrings(map).map((s: Bunting) => {
      const [ax, az] = toWorld(s.ax, s.ay);
      const [bx, bz] = toWorld(s.bx, s.by);
      return { a: new THREE.Vector3(ax, LAMP_TOP, az), b: new THREE.Vector3(bx, LAMP_TOP, bz), sag: 0.5 };
    });
    const buntingLong = buntingModel(strings.slice(0, 2));
    const buntingShort = buntingModel(strings.slice(2));
    group.add(buntingLong, buntingShort);
    // The wanderers, and the follower.
    const walkers: Walker[] = CRITTERS.map((c) => {
      const root = new THREE.Group();
      root.add(MODELS[c.kind]());
      group.add(root);
      return { c, root };
    });
    const follower = new THREE.Group();
    follower.add(chickModel());
    follower.visible = false;
    group.add(follower);
    group.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    this.group.add(group);
    this.built = {
      map,
      group,
      waves,
      total: flowers.length,
      buntingLong,
      buntingShort,
      eggs: null,
      walkers,
      follower,
    };
  }

  private clear(): void {
    const b = this.built;
    if (!b) return;
    this.group.remove(b.group);
    disposeObject(b.group);
    if (b.eggs) {
      this.group.remove(b.eggs.root);
      disposeObject(b.eggs.root);
    }
    this.built = null;
  }

  dispose(): void {
    this.clear();
  }
}
