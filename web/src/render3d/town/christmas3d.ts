import {
  bulbHash,
  type DoorSpot,
  eveOn,
  GARLANDS,
  GIFT_TILES,
  garlandLit,
  giftsShown,
  type NisseSpot,
  nisseSpots,
  ORNAMENTS,
  ornamentsShown,
  progress,
  SNOWMEN,
  SQUARE_LAMPS,
  snowmenShown,
  starUp,
  TREE,
  wreathSpots,
} from "@tokenmaxxing/core/christmas.ts";
import type { FestiveNpc } from "@tokenmaxxing/core/festive.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { christmasNow, ownHearts } from "../../game/christmas.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { glow, liveModel, Model, toon } from "../kit/kit.ts";

const RED = "#b3262e";
const RED_DARK = "#8c1d24";
const CREAM = "#fbf7ef";
const GREEN = "#2f6b3a";
const GREEN_LIGHT = "#3f8a4c";
const GOLD = "#e8c44a";
const SILVER = "#c9d3dc";
const SNOW = "#f4f8ff";
const GREY = "#a9b1bb";
const INK = "#2b2433";
const BULB_HEX = ["#ff5a5a", "#f5d14a", "#5fd38a", "#6fb4ff"];

// MARK: Shapes

let heartGeo: THREE.BufferGeometry | null = null;
/** A julehjerte: a heart, 0.1 across, a little thick, facing +z. */
function heartGeometry(): THREE.BufferGeometry {
  if (heartGeo) return heartGeo;
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.5, 0.2);
  s.bezierCurveTo(-0.46, 0.5, -0.1, 0.55, 0, 0.25);
  s.bezierCurveTo(0.1, 0.55, 0.46, 0.5, 0.5, 0.2);
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  heartGeo = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }).center();
  return heartGeo;
}

/** A heart mesh `size` across at `at`, turned to face out at angle `a`. */
function hang(m: Model, color: string, size: number, at: [number, number, number], a: number): void {
  const mesh = new THREE.Mesh(heartGeometry(), toon(color));
  mesh.scale.set(size, size, size * 0.6);
  mesh.position.set(...at);
  mesh.rotation.y = a;
  mesh.castShadow = true;
  m.add(mesh);
}

/** A string through `points` as a chain of thin boxes (one merged geometry), world space. */
function cord(points: THREE.Vector3[], thick = 0.02): THREE.BufferGeometry {
  const out: THREE.BufferGeometry[] = [];
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const mat = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const g = new THREE.BoxGeometry(a.distanceTo(b), thick, thick);
    e.set(
      0,
      -Math.atan2(b.z - a.z, b.x - a.x),
      Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)),
      "YXZ",
    );
    mat.compose(a.clone().add(b).multiplyScalar(0.5), q.setFromEuler(e), one);
    g.applyMatrix4(mat);
    out.push(g);
  }
  const merged = mergeGeometries(out);
  for (const g of out) g.dispose();
  return merged;
}

// MARK: Models

/** The tree's foliage radius at fraction `h` (0 bottom .. 1 top) of its height, for hanging things on. */
const treeRadius = (h: number): number => (0.7 * (1 - h) + 0.04) * 0.93;
const treeY = (h: number): number => 0.5 + h * 1.65;

/** The tree: a red tub, a trunk, five tiers of pine with snow on their tips. Its middle at the origin. */
function treeBody(m: Model): void {
  m.cyl(0.3, 0.22, RED, [0, 0, 0], 0.27, 12);
  m.cyl(0.285, 0.03, SNOW, [0, 0.21, 0], 0.285, 12);
  m.cyl(0.07, 0.35, "#6b4a2a", [0, 0.2, 0], 0.06, 8);
  const tiers: [number, number, number, string][] = [
    [0.7, 0.55, 0.42, GREEN],
    [0.58, 0.5, 0.88, GREEN_LIGHT],
    [0.46, 0.46, 1.25, GREEN],
    [0.35, 0.42, 1.6, GREEN_LIGHT],
    [0.23, 0.4, 1.92, GREEN],
  ];
  for (const [r, h, y, c] of tiers) {
    m.cyl(r, h, c, [0, y, 0], r * 0.2, 12);
    // A lick of snow on the tier's rim.
    for (const a of [0.5, 2.2, 3.9, 5.4])
      m.ball(0.06, SNOW, [Math.sin(a) * r * 0.82, y + 0.05, Math.cos(a) * r * 0.82], [1.4, 0.6, 1.4], 6);
  }
}

/** The star: a flat gold ball and two crossed bars, glowing. At the origin; the caller lifts it onto the tip. */
function starModel(mat: THREE.Material): Model {
  const m = liveModel();
  m.ball(0.1, mat, [0, 0, 0], [1, 1, 0.4], 6);
  m.box([0.34, 0.05, 0.05], mat, [0, 0, 0], 0.005).rotation.z = Math.PI / 4;
  m.box([0.34, 0.05, 0.05], mat, [0, 0, 0], 0.005).rotation.z = -Math.PI / 4;
  m.box([0.34, 0.05, 0.05], mat, [0, 0, 0], 0.005);
  m.box([0.05, 0.34, 0.05], mat, [0, -0.17, 0], 0.005);
  return m;
}

/** A gift box in `colour` with a `ribbon` and a bow, `s` big, its base at `at`. */
function gift(
  m: Model,
  colour: string,
  ribbon: string,
  s: number,
  at: [number, number, number],
  turn: number,
): void {
  const p = m.part(at, turn);
  p.box([0.26 * s, 0.2 * s, 0.22 * s], colour, [0, 0, 0], 0.012);
  p.box([0.265 * s, 0.205 * s, 0.045 * s], ribbon, [0, 0, 0], 0.005);
  p.box([0.045 * s, 0.205 * s, 0.225 * s], ribbon, [0, 0, 0], 0.005);
  p.ball(0.045 * s, ribbon, [0, 0.22 * s, 0], [1.5, 0.7, 1], 6);
}

const GIFT_COLOURS: [string, string][] = [
  [RED, CREAM],
  [GREEN, GOLD],
  ["#4f8fe0", SILVER],
  [CREAM, RED],
  ["#e8772a", CREAM],
  ["#8a5ac8", GOLD],
];

/** A snowman, 1.1 tall, facing +z. */
function snowman(m: Model, at: [number, number], turn: number): void {
  const p = m.part([at[0], 0, at[1]], turn);
  p.ball(0.3, SNOW, [0, 0.25, 0], [1, 0.9, 1], 12);
  p.ball(0.22, SNOW, [0, 0.68, 0], [1, 1, 1], 12);
  p.ball(0.15, SNOW, [0, 1.0, 0], [1, 1, 1], 12);
  for (const x of [-0.055, 0.055]) p.ball(0.02, INK, [x, 1.05, 0.13], [1, 1, 0.6], 6);
  p.cyl(0.022, 0.15, "#e8772a", [0, 1.0, 0.15], 0.004, 5).rotation.x = Math.PI / 2;
  for (const y of [0.78, 0.66, 0.54]) p.ball(0.022, INK, [0, y, 0.2], [1, 1, 0.6], 6);
  p.cyl(0.17, 0.07, RED, [0, 0.82, 0], 0.17, 12);
  p.box([0.06, 0.2, 0.025], RED, [0.1, 0.62, 0.15], 0.005);
  p.cyl(0.18, 0.025, "#3a3546", [0, 1.12, 0], 0.18, 12);
  p.cyl(0.115, 0.15, "#3a3546", [0, 1.13, 0], 0.11, 12);
  for (const s of [-1, 1]) {
    const arm = p.part([s * 0.2, 0.74, 0]);
    arm.rotation.z = -s * 0.9;
    arm.box([0.34, 0.025, 0.025], "#6b4a2a", [s * 0.12, 0, 0], 0.004);
  }
}

/** The wreath: a pine ring, red berries and a bow, facing +z, about `r` across. Its middle at the origin. */
function wreath(m: Model, r: number): void {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.3, 6, 18), toon(GREEN));
  ring.castShadow = true;
  m.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.2, 6, 18), toon(GREEN_LIGHT));
  inner.rotation.z = 0.2;
  inner.position.z = r * 0.1;
  m.add(inner);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + 0.4;
    m.ball(r * 0.1, RED, [Math.cos(a) * r, Math.sin(a) * r, r * 0.28], [1, 1, 1], 5);
  }
  for (const s of [-1, 1]) {
    const w = m.part([s * r * 0.3, -r * 0.95, r * 0.34]);
    w.rotation.z = s * 0.5;
    w.box([r * 0.5, r * 0.28, r * 0.12], RED, [0, 0, 0], 0.004);
  }
  m.ball(r * 0.14, RED_DARK, [0, -r * 0.95, r * 0.38], [1, 1, 0.8], 6);
  for (const s of [-1, 1]) {
    const t = m.part([s * r * 0.1, -r * 1.05, r * 0.3]);
    t.rotation.z = s * 0.2;
    t.box([r * 0.16, r * 0.6, r * 0.05], RED, [0, -r * 0.55, 0], 0.004);
  }
}

/** A candle in a window: a cream stick and a flame, `s` big, at `at`. */
function candle(m: Model, flame: THREE.Material, at: [number, number, number]): void {
  m.cyl(0.025, 0.14, CREAM, at, 0.025, 8);
  m.ball(0.022, flame, [at[0], at[1] + 0.17, at[2]], [1, 1.7, 1], 6);
}

/**
 * A nisse, `h` tall: a grey coat, a white beard to the belt, a red pointed cap over his eyes and a pompom. Facing +z,
 * feet at the origin. `bowl` puts a bowl of risalamande in his hands. The static parts of Knud and of the doorstep ones.
 */
function nisse(m: Model, h: number, bowl: boolean): void {
  const k = h / 1.2;
  m.box([0.12 * k, 0.1 * k, 0.17 * k], INK, [-0.09 * k, 0, 0.02 * k], 0.02 * k);
  m.box([0.12 * k, 0.1 * k, 0.17 * k], INK, [0.09 * k, 0, 0.02 * k], 0.02 * k);
  m.cyl(0.27 * k, 0.56 * k, GREY, [0, 0.08 * k, 0], 0.2 * k, 14);
  m.cyl(0.272 * k, 0.045 * k, INK, [0, 0.42 * k, 0], 0.255 * k, 14);
  m.box([0.07 * k, 0.05 * k, 0.02 * k], GOLD, [0, 0.42 * k, 0.26 * k], 0.005 * k);
  // The arms and mittens.
  for (const s of [-1, 1]) {
    const arm = m.part([s * 0.24 * k, 0.56 * k, 0.02 * k]);
    arm.rotation.z = s * 0.3;
    arm.rotation.x = -0.5;
    arm.cyl(0.07 * k, 0.32 * k, GREY, [0, -0.28 * k, 0], 0.06 * k, 8);
    arm.ball(0.065 * k, INK, [0, -0.3 * k, 0], [1, 1, 1], 8);
  }
  // The head (a face under the cap), a great white beard from the cheeks down to the belt (a cone, wide at the chin), and a nose.
  m.ball(0.19 * k, "#f2c29b", [0, 0.88 * k, 0.02 * k], [1, 0.95, 0.95], 12);
  m.cyl(0.05 * k, 0.5 * k, CREAM, [0, 0.36 * k, 0.1 * k], 0.22 * k, 14).scale.z = 0.85;
  m.ball(0.2 * k, CREAM, [0, 0.8 * k, 0.1 * k], [1, 0.8, 0.8], 12);
  m.ball(0.045 * k, "#e8a888", [0, 0.9 * k, 0.21 * k], [1, 1, 1], 8);
  // The cap: a broad brim over his eyes, a cone, and the tip drooping back with a pompom.
  m.cyl(0.22 * k, 0.07 * k, RED_DARK, [0, 0.93 * k, 0], 0.22 * k, 14);
  m.cyl(0.2 * k, 0.28 * k, RED, [0, 0.96 * k, 0], 0.085 * k, 14);
  const tip = m.part([0, 1.22 * k, 0]);
  tip.rotation.x = -0.7;
  tip.cyl(0.085 * k, 0.24 * k, RED, [0, 0, 0], 0.01 * k, 10);
  tip.ball(0.05 * k, CREAM, [0, 0.25 * k, 0], [1, 1, 1], 8);
  if (bowl) {
    m.cyl(0.1 * k, 0.07 * k, CREAM, [0.0, 0.34 * k, 0.32 * k], 0.07 * k, 10);
    m.ball(0.04 * k, CREAM, [0, 0.42 * k, 0.32 * k], [1.6, 0.7, 1.6], 8);
    m.ball(0.022 * k, RED, [0.01, 0.46 * k, 0.32 * k], [1, 1, 1], 6);
  }
}

/** Nisse Knud (`NPC_MODELS.christmas`): a grey nisse about 1 tall, holding his bowl; he sways a little. */
export function knudModel(_npc: FestiveNpc): THREE.Object3D {
  const root = new THREE.Group();
  const still = new Model();
  still.position.set(50, 0, 50);
  nisse(still, 1.1, true);
  mergeStill(still);
  still.position.set(0, 0, 0);
  // A pompom and a sway: the whole nisse tilts about his boots.
  const body = new THREE.Group();
  body.add(still);
  root.add(body);
  root.userData.tick = (t: number) => {
    body.rotation.z = Math.sin(t * 1.3) * 0.025;
    body.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
  };
  return root;
}

// MARK: The scenery

/** Where each kind of door's wreath hangs, from its tile's middle: [z, y, size]. Tuned against the buildings. */
const WREATH: Record<DoorSpot["kind"], { z: number; y: number; r: number }> = {
  inn: { z: 0.08, y: 1.02, r: 0.3 },
  company: { z: -0.12, y: 0.82, r: 0.17 },
  shop: { z: 0.58, y: 0.95, r: 0.2 },
};

type Keys = { orn: string; gifts: number; snow: number; lights: string };

/**
 * Christmas in the 3D town (`core/src/christmas.ts` places it; the 2D town is `game/christmas.ts`): the tree with its
 * ornaments, the gift pile, wreaths and window candles at the doors, a nisse on each doorstep, candy-cane stripes on the
 * square's lamp posts, lights strung between them, and snowmen. Built the first frame the theme is on (not before),
 * merged into a few meshes; the parts that change through the days (ornaments, gifts, snowmen, lit bulbs) are rebuilt
 * when their count does, a handful of times a window. Everything is taken down when the window closes.
 */
export class Christmas3d {
  readonly group = new THREE.Group();
  private built = false;
  private parts = new Map<string, Model>();
  private keys: Keys = { orn: "", gifts: -1, snow: -1, lights: "" };
  private readonly bulbs = BULB_HEX.map((c) => ({ mat: glow(c), base: new THREE.Color(c) }));
  private readonly starMat = glow("#ffd45a");
  private readonly flameMat = glow("#ffd45a");
  private star: Model | null = null;
  private spots: { doors: DoorSpot[]; nisser: NisseSpot[] } | null = null;
  private lastF: object | null = null;
  private ownSeen = -1;
  private p = 0;

  constructor(
    private readonly map: GameMap,
    private readonly toWorld: (tx: number, ty: number) => [number, number],
  ) {
    this.group.name = "christmas";
    // It comes and goes with the calendar: the room's batching leaves it as it is.
    this.group.userData.nobatch = true;
    this.group.userData.noBake = true;
    this.group.visible = false;
  }

  update(t: number): void {
    const f = christmasNow();
    if (!f) {
      if (this.built) this.clear();
      this.group.visible = false;
      return;
    }
    if (!this.built) this.build();
    this.group.visible = true;
    const own = ownHearts();
    if (f !== this.lastF || own !== this.ownSeen) {
      this.lastF = f;
      this.ownSeen = own;
      this.p = progress(f);
      this.sync();
    }
    // The bulbs twinkle (a material a colour: four writes), the star pulses.
    for (const [i, b] of this.bulbs.entries()) {
      const k = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * 2.6 + i * 1.7));
      b.mat.color.copy(b.base).multiplyScalar(k);
    }
    const eve = eveOn(f);
    const pulse = 0.88 + 0.12 * Math.sin(t * 2.4);
    this.starMat.color.set("#ffd45a").multiplyScalar(eve ? 1.1 * pulse : pulse);
    this.flameMat.color.set("#ffd45a").multiplyScalar(0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3));
    if (this.star) this.star.scale.setScalar(ownHearts() >= 3 || eve ? 1.25 + 0.1 * Math.sin(t * 3) : 1);
  }

  private at(x: number, y: number): [number, number] {
    return this.toWorld(x, y);
  }

  private build(): void {
    this.built = true;
    this.spots = { doors: wreathSpots(this.map), nisser: nisseSpots(this.map) };
    const s = new Model();
    // The tree.
    const [tx, tz] = this.at(TREE.x, TREE.y);
    const tree = s.part([tx, 0, tz]);
    treeBody(tree);
    // The lamp posts, striped red and white like candy canes, with a bow.
    for (const [lx, ly] of SQUARE_LAMPS) {
      const [x, z] = this.at(lx, ly);
      const post = s.part([x, 0, z]);
      for (let i = 0; i < 6; i++)
        post.box([0.425, 0.152, 0.425], i % 2 ? CREAM : RED, [0, 0.13 + i * 0.155, 0], 0.005);
      const bow = post.part([0, 0.92, 0.23]);
      for (const side of [-1, 1]) {
        const w = bow.part([side * 0.07, 0, 0]);
        w.rotation.z = side * 0.4;
        w.box([0.1, 0.07, 0.03], RED_DARK, [0, 0, 0], 0.004);
      }
    }
    // Wreaths, window candles and a nisse at each door.
    for (const d of this.spots.doors) {
      const [x, z] = this.at(d.x, d.y);
      const c = WREATH[d.kind];
      const w = s.part([x, c.y, z + c.z]);
      wreath(w, c.r);
      const sill =
        d.kind === "inn" ? [-1.5, 1.5, -2.7, 2.7] : d.kind === "company" ? [-0.7, 0.7] : [-0.62, 0.62];
      for (const dx of sill)
        candle(s, this.flameMat, [
          x + dx,
          d.kind === "inn" ? 0.62 : 0.55,
          z + c.z + (d.kind === "shop" ? 0.05 : 0.14),
        ]);
    }
    for (const n of this.spots.nisser) {
      const [x, z] = this.at(n.x, n.y);
      const p = s.part([x, 0, z + 0.05], n.facing === "left" ? -0.5 : 0.5);
      nisse(p, 0.55, true);
    }
    this.group.add(s);
    mergeStill(s, (m) => m.userData.live === true);
    // The star lives on its own, to pulse.
    this.star = starModel(this.starMat);
    this.star.position.set(tx, 2.4, tz);
    this.group.add(this.star);
    this.group.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
  }

  /** Replaces the part called `name` with a freshly built one (merged), or removes it when `make` returns null. */
  private swap(name: string, make: (m: Model) => void): void {
    const old = this.parts.get(name);
    if (old) {
      this.group.remove(old);
      disposeObject(old);
    }
    const m = new Model();
    make(m);
    this.group.add(m);
    mergeStill(m);
    m.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    this.parts.set(name, m);
  }

  private sync(): void {
    const p = this.p;
    const n = ornamentsShown(p);
    const own = ownHearts();
    const orn = `${n}:${own}`;
    if (orn !== this.keys.orn) {
      this.keys.orn = orn;
      const [tx, tz] = this.at(TREE.x, TREE.y);
      this.swap("ornaments", (m) => {
        const tree = m.part([tx, 0, tz]);
        for (const [i, o] of ORNAMENTS.slice(0, n).entries()) {
          const r = treeRadius(o.h);
          const y = treeY(o.h);
          const x = Math.sin(o.a) * r;
          const z = Math.cos(o.a) * r;
          switch (o.set) {
            case "lightsLow":
            case "lightsUp":
              tree.ball(0.045, this.bulbs[o.hue]!.mat, [x * 1.04, y, z * 1.04], [1, 1, 1], 6);
              break;
            case "red":
            case "gold":
              tree.ball(0.06, o.set === "red" ? RED : GOLD, [x * 1.04, y, z * 1.04], [1, 1, 1], 8);
              break;
            case "hearts":
              hang(tree, i % 2 ? RED : CREAM, 0.15, [x * 1.08, y, z * 1.08 + 0.01], o.a);
              break;
            case "flags":
              tree.box(
                [0.09, 0.11, 0.012],
                i % 2 ? RED : CREAM,
                [x * 1.05, y - 0.05, z * 1.05],
                0.003,
              ).rotation.y = o.a;
              break;
            case "tinsel":
              tree.ball(0.032, SILVER, [x * 1.06, y, z * 1.06], [1.6, 0.5, 1.6], 6);
              break;
          }
        }
        for (let k = 0; k < own; k++) {
          const a = (k % 2 ? 1 : -1) * (0.25 + (k >> 1) * 0.35);
          const h = 0.16 + k * 0.085;
          hang(
            tree,
            "#ff4f6e",
            0.17,
            [Math.sin(a) * treeRadius(h) * 1.1, treeY(h), Math.cos(a) * treeRadius(h) * 1.1 + 0.02],
            a,
          );
        }
      });
    }
    if (this.star) this.star.visible = starUp(p);
    const gifts = giftsShown(p);
    if (gifts !== this.keys.gifts) {
      this.keys.gifts = gifts;
      this.swap("gifts", (m) => {
        for (let k = 0; k < gifts; k++) {
          const side = k % 2;
          const slot = k >> 1;
          const tile = GIFT_TILES[side]!;
          const [x, z] = this.at(tile.x, tile.y);
          const [cb, rb] = GIFT_COLOURS[k % GIFT_COLOURS.length]!;
          const dx = (side ? 0.05 : -0.05) + [0, 0.22, 0.04, -0.2][slot]! * (side ? 1 : -1);
          const dz = [0.25, 0.1, -0.1, 0.32][slot]!;
          const lift = slot === 2 ? 0.2 : slot === 3 ? 0 : 0;
          gift(m, cb, rb, 1 + (k % 3) * 0.12, [x + dx, lift, z + dz], k * 0.6);
        }
      });
    }
    const snow = snowmenShown(p);
    if (snow !== this.keys.snow) {
      this.keys.snow = snow;
      this.swap("snowmen", (m) => {
        for (const [i, s] of SNOWMEN.slice(0, snow).entries()) {
          const [x, z] = this.at(s.x, s.y);
          snowman(m, [x, z], i % 2 ? 0.5 : -0.5);
        }
      });
    }
    // The strings of lights between the lamps: which bulbs are lit is the day's.
    const lit = garlandLit(p);
    const key = GARLANDS.map(
      (g, gi) => this.garlandBulbs(g, gi).filter((b) => bulbHash(b.i) < lit).length,
    ).join(",");
    if (key !== this.keys.lights) {
      this.keys.lights = key;
      this.swap("lights", (m) => {
        for (const [gi, g] of GARLANDS.entries()) {
          const bulbs = this.garlandBulbs(g, gi);
          const path = bulbs.map((b) => b.at);
          const mesh = new THREE.Mesh(cord(path), toon(INK));
          m.add(mesh);
          for (const [k, b] of bulbs.entries()) {
            const on = bulbHash(b.i) < lit;
            m.ball(
              0.06,
              on ? this.bulbs[k % 4]!.mat : toon("#4a3f46"),
              [b.at.x, b.at.y - 0.07, b.at.z],
              [1, 1.25, 1],
              6,
            );
            if (k % 5 === 2) hang(m, k % 10 === 2 ? RED : CREAM, 0.18, [b.at.x, b.at.y - 0.2, b.at.z], 0);
          }
        }
      });
    }
  }

  /** The bulbs along a garland, from lamp head to lamp head, sagging in the middle. */
  private garlandBulbs(g: { from: number; to: number }, gi: number): { at: THREE.Vector3; i: number }[] {
    const [ax, ay] = SQUARE_LAMPS[g.from]!;
    const [bx, by] = SQUARE_LAMPS[g.to]!;
    const [x0, z0] = this.at(ax, ay);
    const [x1, z1] = this.at(bx, by);
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.55);
    return Array.from({ length: n + 1 }, (_, k) => {
      const t = k / n;
      return {
        at: new THREE.Vector3(x0 + (x1 - x0) * t, 1.55 - 0.5 * Math.sin(Math.PI * t), z0 + (z1 - z0) * t),
        i: k + gi * 40,
      };
    });
  }

  private clear(): void {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      disposeObject(c);
    }
    this.parts.clear();
    this.star = null;
    this.built = false;
    this.lastF = null;
    this.keys = { orn: "", gifts: -1, snow: -1, lights: "" };
  }

  dispose(): void {
    this.clear();
  }
}
