/**
 * Street life for the 3D town (2D: `art/cop.ts`, `art/cart.ts`, `art/picnic.ts`, `art/street.ts`,
 * `game/street.ts`, `game/race.ts`): Officer 429 with his siren, the roaming merchant's cart, the outage
 * picnic with its bunting and the "touched grass" moment, the build snail and its goal flag, the paperboy
 * and his papers, the Sprint Race round the square, and the pølsevogn's sign. `fx3d.ts` drives it.
 */

import { bannerFor } from "@tokenmaxxing/core/picnic.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { clockMinutes, PAPER, POLSE, SNAIL, snailAt } from "@tokenmaxxing/core/street.ts";
import * as THREE from "three";
import { Avatar, type Look, type Pose, personLook } from "./avatar.ts";
import { light } from "./furniture.ts";
import { canvasTexture, glow, Model, painted, seeded, ticks, tint, toon, type V3 } from "./kit.ts";
import { car } from "./props.ts";

export interface FxLabelHandle {
  el: HTMLDivElement;
  remove: () => void;
}

export interface FxStageRef {
  name: string;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  target: THREE.Vector3;
}

/** What `main.ts` lends the effects: its stages, labels and the player. */
export interface FxHost {
  stages: FxStageRef[];
  town: FxStageRef;
  /** The stage being shown. */
  current: () => string;
  show: (name: string) => void;
  label: (stage: FxStageRef, text: string, cls: string, at: () => THREE.Vector3) => FxLabelHandle;
  /** The player on the stage being shown. */
  me: () => {
    avatar: Avatar;
    top: () => THREE.Vector3;
    go: (x: number, z: number, arrive?: () => void) => void;
  } | null;
  /** Lamps and windows on or off (the part of night that is a switch, not a dimmer). */
  applyNight: (on: boolean) => void;
}

export interface FxCtx {
  host: FxHost;
  burst: (emojis: string[], at: () => THREE.Vector3, stage?: FxStageRef) => void;
  toast: (text: string) => void;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// MARK: Actors

/** Someone who walks a path, for the cop, the merchant and the racers. */
export class Actor {
  readonly avatar: Avatar;
  private path: THREE.Vector3[] = [];
  private arrive?: () => void;
  speed = 1.6;
  constructor(
    readonly scene: THREE.Scene,
    look: Look,
  ) {
    this.avatar = new Avatar(look);
    scene.add(this.avatar.root);
  }
  get pos(): THREE.Vector3 {
    return this.avatar.root.position;
  }
  get walking(): boolean {
    return this.path.length > 0;
  }
  top(extra = 0): THREE.Vector3 {
    const lift = this.avatar.pose === "sit" ? 1.0 : this.avatar.pose === "sleep" ? 0.55 : 1.2;
    return this.pos.clone().add(v3(0, lift + extra, 0));
  }
  at(x: number, z: number, pose: Pose = "stand", turn = 0, y = 0): this {
    this.pos.set(x, y, z);
    this.avatar.root.rotation.y = turn;
    this.avatar.pose = pose;
    return this;
  }
  face(x: number, z: number): void {
    this.avatar.root.rotation.y = Math.atan2(x - this.pos.x, z - this.pos.z);
  }
  go(points: THREE.Vector3[], arrive?: () => void): void {
    this.path = points;
    this.arrive = arrive;
    this.pos.y = 0;
    if (points.length) this.avatar.pose = "walk";
  }
  update(dt: number, t: number): void {
    const next = this.path[0];
    if (next) {
      const d = next.clone().sub(this.pos).setY(0);
      const step = this.speed * dt;
      if (d.length() <= step) {
        this.pos.set(next.x, this.pos.y, next.z);
        this.path.shift();
        if (!this.path.length) {
          this.avatar.pose = "stand";
          this.arrive?.();
        }
      } else {
        this.pos.add(d.normalize().multiplyScalar(step));
        const want = Math.atan2(d.x, d.z);
        const r = this.avatar.root.rotation;
        r.y += Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y)) * Math.min(1, dt * 14);
      }
    }
    this.avatar.update(dt, t);
  }
  dispose(): void {
    this.scene.remove(this.avatar.root);
  }
}

const lookOf = (outfit: [string, string], pants: string, rnd: number, extra: Partial<Look> = {}): Look =>
  personLook({
    skin: ["#f4d0b0", "#e0a97a", "#b9784a", "#7a4b2e"][rnd % 4]!,
    hair: ["#2b2433", "#5a3a22", "#c9853a", "#a8a8b8"][rnd % 4]!,
    style: rnd % 5,
    outfit,
    pants,
    hat: "none",
    ...extra,
  });

// MARK: Models

const ink = "#2b2433";

/** Officer 429's cap, badge, belt, notepad and siren, put on an `Avatar`. Returns the siren's parts. */
export function dressCop(a: Avatar) {
  // The voxel officer already has the cap, buttons and badge; this adds the light bar on top and the notepad.
  const cap = a.head.part([0, 0.4, 0]);
  cap.scale.setScalar(0.7);
  cap.box([0.2, 0.05, 0.07], ink, [0, 0.04, 0], 0.015);
  const red = new THREE.MeshBasicMaterial({ color: "#ff4a4a" });
  const blue = new THREE.MeshBasicMaterial({ color: "#4a9bff" });
  const l = cap.box([0.085, 0.06, 0.06], red, [-0.052, 0.08, 0], 0.01);
  const r = cap.box([0.085, 0.06, 0.06], blue, [0.052, 0.08, 0], 0.01);
  const b = a.body;
  const pad = new Model();
  pad.box([0.13, 0.17, 0.02], "#fbf7ef", [0, 0, 0], 0.01);
  pad.box([0.1, 0.01, 0.005], "#8fb3d9", [0, 0.06, 0.012]);
  pad.box([0.1, 0.01, 0.005], "#8fb3d9", [0, 0.1, 0.012]);
  pad.position.set(0.1, 0.55, 0.2);
  pad.rotation.x = -0.4;
  pad.visible = false;
  b.add(pad);
  const pencil = new Model();
  pencil.box([0.012, 0.11, 0.012], "#f0b53c", [0, 0, 0]);
  pencil.box([0.012, 0.02, 0.012], "#f19a8b", [0, 0.11, 0]);
  pencil.visible = false;
  b.add(pencil);
  return { red, blue, l, r, pad, pencil };
}

function checkerSign(): THREE.CanvasTexture {
  return canvasTexture(16, 4, (g) => {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 16; x++) {
        g.fillStyle = (x + y) % 2 ? ink : "#fbf7ef";
        g.fillRect(x, y, 1, 1);
      }
  });
}

/** A gingham picnic blanket `w`×`d`, red or blue. */
export function blanketModel(w: number, d: number, i: number): Model {
  const [main, mix] = i % 2 ? ["#6f7fc9", "#b3bde6"] : ["#e2443a", "#ec9c8f"];
  const tex = canvasTexture(8, 8, (g) => {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const a = Math.floor(x / 2) % 2 === 0;
        const b = Math.floor(y / 2) % 2 === 0;
        g.fillStyle = a && b ? main! : a || b ? mix! : "#fbf7ef";
        g.fillRect(x, y, 1, 1);
      }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w * 1.5, d * 1.5);
  const m = new Model();
  m.box([w, 0.03, d], painted(tex), [0, 0, 0], 0.008);
  // A plate of sandwiches and a cup of juice, in a front corner where nobody sits.
  const sx = i % 2 ? -1 : 1;
  m.cyl(0.13, 0.02, "#e8e4da", [sx * (w / 2 - 0.35), 0.03, d / 2 - 0.3], 0.13, 14);
  for (const o of [-0.05, 0.05]) {
    m.box([0.09, 0.012, 0.09], "#e6cc98", [sx * (w / 2 - 0.35) + o, 0.05, d / 2 - 0.3]);
    m.box([0.09, 0.01, 0.09], "#a5d977", [sx * (w / 2 - 0.35) + o, 0.062, d / 2 - 0.3]);
    m.box([0.09, 0.012, 0.09], "#cfae73", [sx * (w / 2 - 0.35) + o, 0.072, d / 2 - 0.3]);
  }
  m.cyl(0.04, 0.1, "#fbf7ef", [sx * (w / 2 - 0.7), 0.03, d / 2 - 0.3], 0.036, 10);
  m.cyl(0.036, 0.04, "#f0a53c", [sx * (w / 2 - 0.7), 0.09, d / 2 - 0.3], 0.036, 10);
  return m;
}

export function basketModel(): Model {
  const m = new Model();
  m.box([0.42, 0.26, 0.3], "#c9a36a", [0, 0, 0], 0.04);
  for (const y of [0.06, 0.14, 0.22]) m.box([0.43, 0.012, 0.31], "#a87648", [0, y, 0]);
  m.box([0.34, 0.03, 0.22], "#fbf7ef", [0, 0.26, 0]);
  m.box([0.05, 0.05, 0.05], "#e2443a", [-0.08, 0.28, 0.03]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 12, Math.PI), toon("#a87648"));
  handle.position.set(0, 0.26, 0);
  handle.rotation.y = Math.PI / 2;
  m.add(handle);
  const baguette = m.cyl(0.035, 0.34, "#cfae73", [0.1, 0.24, 0], 0.035, 8);
  baguette.rotation.z = -0.3;
  return m;
}

const PENNANT = ["#e2443a", "#f5d14a", "#6f7fc9", "#a5d977", "#fbf7ef", "#f2a6c8"];

/** A string of bunting from `a` to `b`, sagging in the middle, a pennant every ~0.35. */
export function buntingModel(a: V3, b: V3, sag = 0.3): THREE.Group {
  const g = new THREE.Group();
  const A = v3(...a);
  const B = v3(...b);
  const len = A.distanceTo(B);
  const at = (f: number) =>
    A.clone()
      .lerp(B, f)
      .add(v3(0, -4 * sag * f * (1 - f), 0));
  const segs = Math.max(6, Math.round(len * 3));
  const cord = toon("#5e3d28");
  const seg = new THREE.BoxGeometry(1, 0.02, 0.02);
  for (let i = 0; i < segs; i++) {
    const p = at(i / segs);
    const q = at((i + 1) / segs);
    const m = new THREE.Mesh(seg, cord);
    m.position.copy(p.clone().add(q).multiplyScalar(0.5));
    m.scale.x = p.distanceTo(q);
    m.rotation.z = Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z));
    m.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
    m.rotation.order = "YXZ";
    g.add(m);
  }
  const tri = new THREE.Shape();
  tri.moveTo(-0.1, 0);
  tri.lineTo(0.1, 0);
  tri.lineTo(0, -0.26);
  const geo = new THREE.ShapeGeometry(tri);
  const flags: THREE.Mesh[] = [];
  const n = Math.max(2, Math.round(len / 0.36));
  const dir = Math.atan2(B.x - A.x, B.z - A.z) - Math.PI / 2;
  for (let i = 1; i < n; i++) {
    const mat = new THREE.MeshToonMaterial({
      color: PENNANT[i % PENNANT.length]!,
      side: THREE.DoubleSide,
      gradientMap: toon("#fff").gradientMap,
    });
    const f = new THREE.Mesh(geo, mat);
    f.position.copy(at(i / n));
    f.rotation.y = dir + Math.PI / 2;
    f.castShadow = true;
    flags.push(f);
    g.add(f);
  }
  ticks.push((t) =>
    flags.forEach((f, i) => {
      f.rotation.x = Math.sin(t * 2.2 + i * 1.3) * 0.12;
    }),
  );
  return g;
}

/** A patch of grass that comes with the "Touched grass" badge: turf, tufts and a few daisies. */
export function grassPatch(): Model {
  const m = new Model();
  m.box([1.4, 0.08, 1.0], "#6cbf4e", [0, 0, 0], 0.04);
  const rnd = seeded(77);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 1.25;
    const z = (rnd() - 0.5) * 0.85;
    m.cyl(0.03, 0.16 + rnd() * 0.1, rnd() < 0.5 ? "#4fa544" : "#86c35e", [x, 0.06, z], 0.004, 4);
  }
  for (const [x, z] of [
    [-0.4, 0.1],
    [0.3, -0.2],
    [0.1, 0.3],
  ] as const) {
    m.cyl(0.012, 0.18, "#4fa544", [x, 0.06, z], 0.012, 4);
    m.ball(0.05, "#fbf7ef", [x, 0.27, z], [1, 0.5, 1], 8);
    m.ball(0.025, "#f5d14a", [x, 0.29, z], [1, 0.6, 1], 6);
  }
  return m;
}

const ALL_FLAT = (s: THREE.Group) =>
  s.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });

function gingham(c: string): THREE.CanvasTexture {
  return canvasTexture(
    16,
    4,
    (g) => {
      for (let x = 0; x < 16; x++) {
        g.fillStyle = Math.floor(x / 2) % 2 ? "#fbf7ef" : c;
        g.fillRect(x, 0, 1, 4);
      }
    },
    false,
  );
}

/** The traveling merchant's wagon: striped awning, curtain, goods on the counter, an LTD board, a lantern. Faces +z. */
export function merchantCart(goods: readonly string[] = ["#c9b6ff", "#f5d14a", "#8fe3ff", "#ff7ab6"]): {
  model: Model;
  flame: THREE.Mesh;
  halo: THREE.Mesh;
} {
  const m = new Model();
  const W = 1.9;
  const D = 0.95;
  // The wheels, on the sides.
  for (const s of [-1, 1]) {
    const wheel = m.part([s * (W / 2 + 0.05), 0.3, 0.05]);
    const rim = wheel.cyl(0.3, 0.07, "#5e3d28", [0, -0.035, 0], 0.3, 18);
    rim.rotation.z = Math.PI / 2;
    const hub = wheel.cyl(0.12, 0.1, "#2b2433", [0, -0.05, 0], 0.12, 10);
    hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const sp = wheel.box([0.035, 0.54, 0.03], "#a87648", [0, -0.27, 0], 0.005);
      const pivot = new THREE.Group();
      wheel.add(pivot);
      pivot.add(sp);
      pivot.rotation.x = (i * Math.PI) / 4;
    }
  }
  // Body: a wooden box with a lid line, the board on the front.
  m.box([W, 0.5, D], "#a87648", [0, 0.22, 0], 0.03);
  m.box([W + 0.06, 0.06, D + 0.06], "#c9a36a", [0, 0.72, 0], 0.02);
  for (const y of [0.34, 0.5]) m.box([W + 0.01, 0.02, D + 0.01], "#8a5f38", [0, y, 0]);
  const board = canvasTexture(
    60,
    28,
    (g) => {
      g.fillStyle = ink;
      g.fillRect(0, 0, 60, 28);
      g.fillStyle = "#5e3d28";
      g.fillRect(2, 2, 56, 24);
      g.fillStyle = "#f5d14a";
      g.font = "900 18px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("LTD", 30, 15);
    },
    true,
  );
  m.plane(0.62, 0.3, glow("#fff", board), [0, 0.47, D / 2 + 0.012]);
  // Posts, curtain and awning.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      m.cyl(0.035, 1.12, "#5e3d28", [sx * (W / 2 - 0.05), 0.75, sz * (D / 2 - 0.05)], 0.035, 8);
  m.box([W - 0.1, 0.95, 0.04], "#4b3f7a", [0, 0.75, -D / 2 + 0.05], 0.01);
  for (let x = -0.8; x <= 0.81; x += 0.2) m.box([0.025, 0.9, 0.05], "#6a5aa8", [x, 0.78, -D / 2 + 0.06]);
  const stripes = gingham("#e2443a");
  stripes.wrapS = THREE.RepeatWrapping;
  stripes.repeat.set(2, 1);
  const awn = m.box([W + 0.3, 0.06, D + 0.35], painted(stripes), [0, 1.86, 0.08], 0.01);
  awn.rotation.x = 0.1;
  const val = canvasTexture(
    32,
    6,
    (g) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? "#fbf7ef" : "#e2443a";
        g.fillRect(i * 4, 0, 4, 4);
        g.fillRect(i * 4 + 1, 4, 2, 1);
        g.fillRect(i * 4 + 1, 4, 2, 2);
      }
    },
    false,
  );
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.3, 0.24),
    new THREE.MeshToonMaterial({
      map: val,
      transparent: true,
      alphaTest: 0.5,
      gradientMap: toon("#fff").gradientMap,
    }),
  );
  front.position.set(0, 1.72, D / 2 + 0.26);
  front.castShadow = true;
  m.add(front);
  // Bunting across the curtain.
  const bunt = buntingModel([-W / 2 + 0.1, 1.55, -D / 2 + 0.12], [W / 2 - 0.1, 1.55, -D / 2 + 0.12], 0.12);
  ALL_FLAT(bunt);
  m.add(bunt);
  // Goods on the counter.
  const shelf = [
    () =>
      m.box([0.2, 0.05, 0.14], goods[0]!, [-0.7, 0.75, 0.05], 0.01) &&
      m.box([0.17, 0.05, 0.12], "#fbf7ef", [-0.7, 0.8, 0.05], 0.01),
    () =>
      m.cyl(0.1, 0.06, goods[1]!, [-0.25, 0.75, 0.05], 0.1, 12) &&
      m.cyl(0.06, 0.1, goods[1]!, [-0.25, 0.81, 0.05], 0.03, 12),
    () => m.cyl(0.05, 0.2, goods[2]!, [0.2, 0.75, 0.05], 0.05, 10),
    () => m.ball(0.09, goods[3]!, [0.65, 0.84, 0.05]),
  ];
  for (const f of shelf) f();
  // The lantern on the right post.
  const post = m.part([W / 2 - 0.05, 1.3, D / 2 - 0.05]);
  post.box([0.02, 0.1, 0.02], ink, [0, 0.0, 0]);
  post.box([0.14, 0.02, 0.14], ink, [0, -0.2, 0], 0.005);
  const flame = post.box([0.09, 0.14, 0.09], glow("#ffe28a"), [0, -0.19, 0], 0.02);
  post.box([0.15, 0.02, 0.15], ink, [0, -0.06, 0], 0.005);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 14, 10),
    new THREE.MeshBasicMaterial({
      color: "#ffe28a",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.set(W / 2 - 0.05, 1.2, D / 2 - 0.05);
  m.add(halo);
  light(m, [W / 2 - 0.05, 1.2, D / 2 - 0.05], "#ffd27a", 3, 5);
  return { model: m, flame, halo };
}

/** The pitch while the cart is away: a little signpost with a cart on it. */
export function signpost(): Model {
  const m = new Model();
  m.cyl(0.04, 1.0, "#5e3d28", [0, 0, 0], 0.04, 8);
  const tex = canvasTexture(
    32,
    20,
    (g) => {
      g.fillStyle = ink;
      g.fillRect(0, 0, 32, 20);
      g.fillStyle = "#c9a36a";
      g.fillRect(1, 1, 30, 18);
      g.fillStyle = "#e2443a";
      g.fillRect(8, 5, 16, 4);
      g.fillStyle = "#5e3d28";
      g.fillRect(9, 9, 14, 5);
      g.fillStyle = ink;
      g.fillRect(10, 14, 3, 3);
      g.fillRect(19, 14, 3, 3);
    },
    false,
  );
  m.box([0.7, 0.4, 0.05], "#5e3d28", [0, 0.7, 0], 0.02);
  m.plane(0.62, 0.34, painted(tex), [0, 0.9, 0.03]);
  return m;
}

/** The build snail, facing +x, with a sign stick out of its shell. */
export function snailModel(): { model: Model; body: Model; sign: Model } {
  const m = new Model();
  const body = m.part();
  body.ball(0.13, "#b9c7a3", [0.02, 0.1, 0], [2.3, 0.55, 0.9]);
  body.ball(0.09, "#b9c7a3", [0.3, 0.16, 0], [1, 1.1, 0.9]);
  for (const z of [-0.04, 0.04]) {
    body.cyl(0.008, 0.12, "#b9c7a3", [0.34, 0.22, z], 0.008, 4);
    body.ball(0.022, ink, [0.34, 0.35, z]);
  }
  const shell = body.part([-0.05, 0.22, 0]);
  shell.ball(0.17, "#d98b45", [0, 0.05, 0], [1, 1, 0.9], 12);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 14), toon("#f3c27a"));
  ring.position.set(0, 0.05, 0.14);
  shell.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 12), toon("#f3c27a"));
  ring2.position.set(0, 0.05, 0.16);
  shell.add(ring2);
  const sign = m.part([-0.05, 0.38, 0]);
  sign.cyl(0.012, 0.4, "#5e3d28", [0, 0, 0], 0.012, 5);
  return { model: m, body, sign };
}

/** The goal flag at the end of the snail's run: chequered, on a pole. */
export function goalFlag(): Model {
  const m = new Model();
  m.cyl(0.03, 1.5, "#cfd3da", [0, 0, 0], 0.03, 8);
  m.ball(0.05, "#cfd3da", [0, 1.5, 0]);
  const flag = m.part([0.28, 1.2, 0]);
  const tex = canvasTexture(8, 6, (g) => {
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? ink : "#fbf7ef";
        g.fillRect(x, y, 1, 1);
      }
  });
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.36),
    new THREE.MeshToonMaterial({ map: tex, side: THREE.DoubleSide, gradientMap: toon("#fff").gradientMap }),
  );
  cloth.castShadow = true;
  flag.add(cloth);
  ticks.push((t) => {
    cloth.rotation.y = Math.sin(t * 2.4) * 0.25;
  });
  return m;
}

const PAPERBOY: Look = personLook({
  skin: "#f4d0b0",
  hair: "#c9853a",
  style: 1,
  outfit: ["#f0b53c", "#c9971f"],
  pants: "#3c4454",
  hat: "beanie",
});

/** The paperboy's bike, facing +x. */
export function bikeModel(): { model: Model; wheels: THREE.Object3D[] } {
  const m = new Model();
  const wheels: THREE.Object3D[] = [];
  for (const x of [-0.34, 0.34]) {
    const w = new THREE.Group();
    w.position.set(x, 0.22, 0);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 20), toon(ink));
    tyre.castShadow = true;
    w.add(tyre);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.012), toon("#cfd3da"));
    w.add(spoke);
    const spoke2 = spoke.clone();
    spoke2.rotation.z = Math.PI / 2;
    w.add(spoke2);
    // The wheels turn about z: the bike is seen side-on.
    m.add(w);
    wheels.push(w);
  }
  const red = "#d8343c";
  const bar = (a: V3, b: V3, c = red) => {
    const A = v3(...a);
    const B = v3(...b);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(A.distanceTo(B), 0.03, 0.03), toon(c));
    mesh.position.copy(A.clone().add(B).multiplyScalar(0.5));
    mesh.rotation.z = Math.atan2(B.y - A.y, B.x - A.x);
    mesh.castShadow = true;
    m.add(mesh);
  };
  bar([-0.34, 0.22, 0], [-0.04, 0.22, 0]);
  bar([-0.04, 0.22, 0], [-0.12, 0.5, 0]);
  bar([-0.12, 0.5, 0], [0.26, 0.48, 0]);
  bar([0.26, 0.48, 0], [0.34, 0.22, 0]);
  bar([-0.04, 0.22, 0], [0.26, 0.48, 0]);
  bar([0.26, 0.48, 0], [0.22, 0.62, 0], "#cfd3da");
  m.box([0.04, 0.03, 0.28], "#cfd3da", [0.22, 0.62, 0], 0.01);
  m.box([0.18, 0.04, 0.1], ink, [-0.14, 0.52, 0], 0.02);
  // Sack of papers on the rack.
  m.box([0.16, 0.2, 0.2], "#c9b48a", [-0.42, 0.34, 0.14], 0.04);
  m.box([0.1, 0.06, 0.1], "#fbf7ef", [-0.42, 0.54, 0.14], 0.01);
  return { model: m, wheels };
}

/** A rolled paper held with a red rubber band. */
export function paperModel(): Model {
  const m = new Model();
  const roll = m.cyl(0.05, 0.3, "#fbf7ef", [0, 0.05, 0], 0.05, 10);
  roll.rotation.z = Math.PI / 2;
  roll.position.x = -0.15;
  m.cyl(0.056, 0.05, "#d8343c", [0, 0.05, 0], 0.056, 10).rotation.z = Math.PI / 2;
  m.box([0.1, 0.012, 0.05], "#8a8d99", [-0.1, 0.1, 0]);
  return m;
}

// MARK: Controller

const SIREN_MS = 170;
const WALK_Z = 17.9;
const PLAZA = { l: 11.4, r: 24.6, t: 3.0, b: 10.4 };

function mansionDoors(): [number, number][] {
  // Door of each house (front face, +z): from `town.ts`.
  return [
    [6.8, 8.6],
    [5.8, 16.42],
    [11.7, 16.38],
    [21.5, 16.2],
  ];
}

export class TownFx {
  readonly group = new THREE.Group();
  private readonly ctx: FxCtx;
  private readonly scene: THREE.Scene;
  /** 0..1 how much the lights shine. */
  glow = 0;

  // Cop
  private cop!: {
    actor: Actor;
    parts: ReturnType<typeof dressCop>;
    light: THREE.PointLight;
    pool: THREE.Mesh;
  };
  private copSay!: FxLabelHandle;
  private copState: "patrol" | "chase" | "ticket" | "return" = "patrol";
  private copUntil = 0;
  private copSayUntil = 0;
  private speeder: Actor | null = null;
  private patrolAt = 0;
  private siren = false;

  // Merchant
  private cart!: ReturnType<typeof merchantCart>;
  private cartRoot = new THREE.Group();
  private merchant!: Actor;
  private sign!: Model;
  private merchantTag!: FxLabelHandle;
  private merchantState: "away" | "arriving" | "here" | "leaving" = "away";
  private cartZ = 12.4;
  private merchantForced: boolean | null = null;
  readonly pitch = { x: 18, z: 22.25 };

  // Picnic
  private picnicOn = false;
  private picnicGroup = new THREE.Group();
  private picnicPeople: Actor[] = [];
  private banner!: FxLabelHandle;
  private grass = new THREE.Group();
  private grassAt = Infinity;

  // Street
  private snail!: ReturnType<typeof snailModel>;
  private trail!: THREE.Mesh;
  private snailTag!: FxLabelHandle;
  private lastSnailMinute: number | null = null;
  private flag!: Model;
  private bike!: ReturnType<typeof bikeModel>;
  private rider!: Actor;
  private bikeRoot = new THREE.Group();
  private rideStart = -1;
  private rideForced = false;
  private papers: { m: Model; door: [number, number]; thrown: number; fromZ: number }[] = [];
  private polseTag!: FxLabelHandle;
  private polseOpen: boolean | null = null;

  // Race
  private race: {
    runners: { a: Actor; tag: FxLabelHandle; laps: number; speed: number; lane: number; done: boolean }[];
    start: number;
    line: THREE.Mesh;
    winner?: string;
  } | null = null;

  constructor(ctx: FxCtx) {
    this.ctx = {
      ...ctx,
      // Bursts belong to the town's scene, wherever you are looking.
      burst: (emojis, at) => ctx.burst(emojis, at, ctx.host.town),
      toast: (text) => ctx.host.current() === "Town" && ctx.toast(text),
    };
    this.scene = ctx.host.town.scene;
    this.scene.add(this.group);
    this.buildCop();
    this.buildMerchant();
    this.buildPicnic();
    this.buildStreet();
  }

  private tag(text: string, cls: string, at: () => THREE.Vector3): FxLabelHandle {
    return this.ctx.host.label(this.ctx.host.town, text, cls, at);
  }

  // ——— Cop ———
  private buildCop(): void {
    const actor = new Actor(this.scene, lookOf(["#33498f", "#24336b"], "#24336b", 1, { job: "officer" }));
    const parts = dressCop(actor.avatar);
    actor.at(8.5, WALK_Z, "stand", Math.PI / 2);
    actor.speed = 1.2;
    const l = new THREE.PointLight("#ff4a4a", 0, 6, 1.4);
    l.position.set(0, 1.4, 0);
    actor.avatar.root.add(l);
    // Red and blue washed over the ground round him.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 24),
      new THREE.MeshBasicMaterial({
        color: "#4a9bff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.11;
    actor.avatar.root.add(pool);
    this.cop = { actor, parts, light: l, pool };
    this.tag("Officer 429 · Lv9", "tag", () => actor.top());
    this.copSay = this.tag("", "bubble", () => actor.top(0.35));
    this.copSay.el.style.display = "none";
  }

  /** Sets the siren (red and blue in turns) on or off. */
  private sirenOn(on: boolean): void {
    this.siren = on;
    if (!on) {
      this.cop.light.intensity = 0;
      (this.cop.pool.material as THREE.MeshBasicMaterial).opacity = 0;
      this.cop.parts.l.material = new THREE.MeshBasicMaterial({ color: "#7a2a2e" });
      this.cop.parts.r.material = new THREE.MeshBasicMaterial({ color: "#25406e" });
    }
  }

  private copSays(text: string, t: number, secs = 4): void {
    this.copSay.el.textContent = text;
    this.copSay.el.style.display = "";
    this.copSayUntil = t + secs;
  }

  /** The chase: a speeder bolts along the pavement, Officer 429 turns his siren on and pulls them over. */
  pullOver(t: number): void {
    if (this.copState !== "patrol" && this.copState !== "return") return;
    this.ctx.host.show("Town");
    const names = ["maja", "theo", "ada", "kai"];
    const name = names[Math.floor(Math.random() * names.length)]!;
    const s = new Actor(this.scene, lookOf(["#e25d5d", "#b8443f"], "#3c4454", Math.floor(Math.random() * 9)));
    s.at(2.5, WALK_Z + 0.2);
    s.speed = 3.3;
    s.avatar.expression = "surprised";
    this.speeder = s;
    const tag = this.tag(`${name} · Lv6`, "tag", () => s.top());
    const stopX = 20;
    s.go([v3(stopX, 0, WALK_Z + 0.2)], () => {
      s.avatar.expression = "surprised";
    });
    this.cop.actor.at(stopX - 6, WALK_Z - 0.1, "stand", Math.PI / 2);
    this.cop.actor.speed = 3.4;
    this.cop.actor.go([v3(stopX - 1, 0, WALK_Z - 0.1)], () => {
      this.copState = "ticket";
      this.copUntil = performance.now() / 1000 + 6;
      this.cop.actor.face(s.pos.x, s.pos.z);
      this.cop.parts.pad.visible = true;
      this.cop.parts.pencil.visible = true;
      this.copSays(
        `🚨 ${["429 Too Many Requests!", "Do you know how fast you were burning?"][Math.floor(Math.random() * 2)]} @${name}`,
        performance.now() / 1000,
        4,
      );
      this.ctx.burst(["🚨"], () => this.cop.actor.top(0.3));
      this.ctx.toast(`🚨 Officer 429 pulled @${name} over: 240M tokens/hour in a residential zone.`);
    });
    this.copState = "chase";
    this.copSays(`🚨 429 Too Many Requests! Pull over, @${name}!`, t, 3);
    this.sirenOn(true);
    this.speederTag = tag;
  }
  private speederTag: FxLabelHandle | null = null;

  private updateCop(dt: number, t: number): void {
    const { actor, parts, light, pool } = this.cop;
    // Patrol: now and then wander the north pavement.
    if (this.copState === "patrol" && !actor.walking && t > this.patrolAt) {
      this.patrolAt = t + 4 + Math.random() * 6;
      actor.speed = 1.2;
      const x = 3 + Math.random() * 28;
      actor.go([v3(x, 0, WALK_Z - 0.2)]);
    }
    if (this.copState === "ticket") {
      // The pencil scribbles; then they part.
      const k = Math.floor(t * 6) % 2;
      parts.pencil.position.set(0.1 + k * 0.012, 0.31, 0.205);
      parts.pencil.rotation.x = -0.4;
      if (t > this.copUntil) {
        this.copState = "return";
        parts.pad.visible = false;
        parts.pencil.visible = false;
        this.sirenOn(false);
        this.copSays("Retry-After: one donut.", t, 3);
        actor.speed = 1.2;
        actor.go([v3(8.5, 0, WALK_Z - 0.2)], () => {
          this.copState = "patrol";
        });
        const s = this.speeder;
        if (s) {
          s.avatar.expression = "neutral";
          s.speed = 1.0;
          s.go([v3(33, 0, WALK_Z + 0.2)], () => {
            s.dispose();
            this.speederTag?.remove();
            this.speederTag = null;
            this.speeder = null;
          });
        }
      }
    }
    if (this.siren) {
      const red = Math.floor((t * 1000) / SIREN_MS) % 2 === 0;
      parts.l.material = new THREE.MeshBasicMaterial({ color: red ? "#ff4a4a" : "#7a2a2e" });
      parts.r.material = new THREE.MeshBasicMaterial({ color: red ? "#25406e" : "#4a9bff" });
      light.color.set(red ? "#ff4a4a" : "#4a9bff");
      light.intensity = 9;
      (pool.material as THREE.MeshBasicMaterial).color.set(red ? "#4a9bff" : "#ff4a4a");
      (pool.material as THREE.MeshBasicMaterial).opacity = 0.32;
    }
    if (t > this.copSayUntil) this.copSay.el.style.display = "none";
    actor.update(dt, t);
    this.speeder?.update(dt, t);
    this.copSayUntil = Math.max(this.copSayUntil, 0);
  }

  // ——— Merchant ———
  private buildMerchant(): void {
    this.cart = merchantCart();
    this.cartRoot.add(this.cart.model);
    this.cartRoot.visible = false;
    this.group.add(this.cartRoot);
    const hat = (a: Avatar) => {
      const h = a.head.part([0, 0.18, 0]);
      h.scale.setScalar(0.63);
      h.cyl(0.42, 0.035, "#7a3b6e", [0, 0.0, 0], 0.42, 20);
      h.cyl(0.24, 0.17, "#5a2a52", [0, 0.03, 0], 0.22, 16);
      h.cyl(0.245, 0.04, "#e9b73d", [0, 0.04, 0], 0.245, 16);
      const f = h.box([0.025, 0.2, 0.05], "#e8584f", [0.2, 0.1, 0.02], 0.01);
      f.rotation.z = -0.7;
      h.box([0.02, 0.15, 0.04], "#f5d14a", [0.24, 0.13, 0.0], 0.01).rotation.z = -0.9;
    };
    this.merchant = new Actor(
      this.scene,
      personLook({
        skin: "#e0a97a",
        hair: "#a8a8b8",
        style: 0,
        outfit: ["#7a3b6e", "#5a2a52"],
        pants: "#3c4454",
        hat: "none",
        age: "senior",
        beard: 1,
      }),
    );
    hat(this.merchant.avatar);
    this.merchant.avatar.root.visible = false;
    this.merchant.speed = 1.1;
    this.merchantTag = this.tag("🛒 Traveling merchant", "tag", () => this.merchant.top());
    this.merchantTag.el.style.display = "none";
    this.sign = signpost();
    this.sign.position.set(this.pitch.x, 0, this.pitch.z - 0.1);
    this.group.add(this.sign);
  }

  /** Whether the weekly cart is in town on the Aarhus clock: Thursday 08:00 to Monday 08:00. */
  private merchantScheduled(ms: number): boolean {
    const w = worldWall(ms);
    const h = w.hour + w.minute / 60;
    const day = w.weekday;
    if (day === 4) return h >= 8;
    if (day === 5 || day === 6 || day === 0) return true;
    return day === 1 && h < 8;
  }

  setMerchant(on: boolean | null): void {
    this.merchantForced = on;
  }

  private updateMerchant(dt: number, t: number, ms: number): void {
    const here = this.merchantForced ?? this.merchantScheduled(ms);
    const { x, z } = this.pitch;
    const m = this.merchant;
    if (here && this.merchantState === "away") {
      this.merchantState = "arriving";
      this.cartRoot.visible = true;
      m.avatar.root.visible = true;
      this.merchantTag.el.style.display = "";
      this.cartZ = 12.4;
      this.cartRoot.rotation.y = 0;
      m.at(x - 0.9, this.cartZ + 1.4, "walk", 0);
      m.go([v3(x - 0.9, 0, z + 0.95)], () => {
        m.avatar.pose = "wave";
      });
    }
    if (!here && (this.merchantState === "here" || this.merchantState === "arriving")) {
      this.merchantState = "leaving";
      m.avatar.pose = "stand";
      m.go([v3(x, 0, 14)], () => {});
    }
    if (this.merchantState === "arriving") {
      this.cartZ = Math.min(z, this.cartZ + dt * 1.1);
      if (this.cartZ >= z && !m.walking) {
        this.merchantState = "here";
        this.ctx.burst(["🛒", "✨"], () => this.cartRoot.position.clone().setY(1.4));
        this.ctx.toast("🛒 The traveling merchant's cart is in town: this week's editions are out.");
      }
    } else if (this.merchantState === "leaving") {
      this.cartZ -= dt * 1.1;
      if (this.cartZ < 12.4) {
        this.merchantState = "away";
        this.cartRoot.visible = false;
        m.avatar.root.visible = false;
        this.merchantTag.el.style.display = "none";
      }
    }
    if (this.merchantState === "arriving" || this.merchantState === "leaving") {
      this.cartRoot.position.set(x, 0, this.cartZ);
      this.cartRoot.rotation.y = this.merchantState === "leaving" ? Math.PI : 0;
    } else if (this.merchantState === "here") {
      this.cartRoot.position.set(x, 0, z);
      this.cartRoot.rotation.y = 0;
    }
    this.sign.visible = this.merchantState === "away";
    // The lantern flickers between two flames; its halo follows the lights.
    const flick = Math.floor(t * 7) % 2 === 0;
    (this.cart.flame.material as THREE.MeshBasicMaterial).color.set(flick ? "#ffd04a" : "#ffe9a8");
    (this.cart.halo.material as THREE.MeshBasicMaterial).opacity =
      (0.08 + this.glow * 0.18) * (flick ? 1 : 0.85);
    if (this.merchantState === "away" && this.merchantTag) this.merchantTag.el.style.display = "none";
    m.update(dt, t);
    if (this.merchantState === "here" && !m.walking) {
      m.at(x - 0.9, z + 0.95, "wave", 0);
      m.avatar.expression = "happy";
    }
  }

  // ——— Picnic ———
  private buildPicnic(): void {
    const blankets: [number, number, number, number, number][] = [
      [14.0, 8.9, 2.4, 1.5, 0],
      [22.2, 8.9, 2.4, 1.5, 1],
    ];
    for (const [x, z, w, d, i] of blankets) {
      const b = blanketModel(w, d, i);
      b.position.set(x, 0.045, z);
      this.picnicGroup.add(b);
    }
    const basket = basketModel();
    basket.position.set(23.7, 0.05, 8.6);
    basket.rotation.y = -0.4;
    this.picnicGroup.add(basket);
    // Bunting between the square's lanterns.
    this.picnicGroup.add(buntingModel([11.6, 1.45, 3.1], [24.4, 1.45, 3.1], 0.5));
    this.picnicGroup.add(buntingModel([11.6, 1.45, 10.5], [24.4, 1.45, 10.5], 0.5));
    this.picnicGroup.add(buntingModel([11.6, 1.45, 3.1], [11.6, 1.45, 10.5], 0.4));
    this.picnicGroup.add(buntingModel([24.4, 1.45, 3.1], [24.4, 1.45, 10.5], 0.4));
    this.picnicGroup.visible = false;
    this.group.add(this.picnicGroup);
    this.grass.visible = false;
    const patch = grassPatch();
    patch.position.set(18, 0.0, 9.25);
    this.grass.add(patch);
    this.group.add(this.grass);
    this.banner = this.tag("", "tag", () => v3(18, 2.6, 6.8));
    this.banner.el.style.display = "none";
  }

  setPicnic(on: boolean): void {
    if (on === this.picnicOn) return;
    this.picnicOn = on;
    this.picnicGroup.visible = on;
    this.banner.el.style.display = on ? "" : "none";
    this.banner.el.textContent = `🧺 ${bannerFor({ down: ["Claude"], since: 0 })}`;
    if (on) {
      this.ctx.host.show("Town");
      this.ctx.toast("Claude is down. Touch grass.");
      const spots: [number, number, number][] = [
        [13.5, 8.8, 0.8],
        [14.5, 9.2, -2.4],
        [21.7, 8.7, 0.3],
        [22.8, 9.1, -2.8],
      ];
      spots.forEach(([x, z, turn], i) => {
        const a = new Actor(this.scene, lookOf(["#58b36a", "#3f8f3a"], "#3c4454", i * 3 + 1));
        a.at(18 + (i - 1.5), 12.3, "walk");
        a.speed = 1.6 + i * 0.2;
        a.go([v3(x + Math.sign(turn) * 0.8, 0, z + 1.2), v3(x, 0, z)], () => {
          a.at(x, z, "sit", turn, 0.06);
          a.avatar.expression = i % 2 ? "happy" : "wink";
        });
        this.picnicPeople.push(a);
      });
    } else {
      for (const a of this.picnicPeople) a.dispose();
      this.picnicPeople = [];
      this.grass.visible = false;
    }
  }

  /** The reward: sit on a blanket (you, or whoever is nearest), and a patch of grass sprouts. */
  touchGrass(): void {
    this.setPicnic(true);
    const me = this.ctx.host.me();
    this.grass.visible = true;
    const patch = this.grass.children[0]!;
    patch.scale.setScalar(0.01);
    this.grassAt = Infinity;
    const onSat = () => {
      this.ctx.burst(["🌱", "🌿", "✨", "🧺", "🌼"], () => (me ? me.top() : v3(18, 1.2, 9)));
      this.ctx.toast(
        "🌱 Touched grass. A patch from an outage picnic: the agents stopped, and you went outside.",
      );
      this.grassAt = performance.now() / 1000;
    };
    if (me) {
      me.go(15.3, 9.4, () => {
        me.avatar.pose = "sit";
        me.avatar.root.position.y = 0.06;
        me.avatar.root.rotation.y = 0.8;
        onSat();
        setTimeout(() => {
          me.avatar.pose = "stand";
          me.avatar.root.position.y = 0;
        }, 5000);
      });
    } else onSat();
  }

  // ——— Street life ———
  private buildStreet(): void {
    // The pølsevogn's sign.
    this.polseTag = this.tag("🌭 Gratis pølser", "tag", () => v3(13.4, 1.8, 22.2));
    // The snail and its goal flag along the lower walk of the square.
    this.snail = snailModel();
    this.snail.model.position.set(SNAIL_X, 0, SNAIL_Z0);
    this.snail.model.rotation.y = -Math.PI / 2;
    this.snail.model.scale.setScalar(1.9);
    this.group.add(this.snail.model);
    this.flag = goalFlag();
    this.flag.position.set(SNAIL_X + 0.35, 0, SNAIL_Z1 + 0.45);
    this.group.add(this.flag);
    this.trail = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.012, 1),
      new THREE.MeshBasicMaterial({ color: "#ebf0fa", transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.trail.position.y = 0.075;
    this.group.add(this.trail);
    this.snailTag = this.tag("queued", "tag", () => this.snail.model.position.clone().add(v3(0, 1.1, 0)));
    // The paperboy.
    this.bike = bikeModel();
    this.bikeRoot.add(this.bike.model);
    this.rider = new Actor(this.scene, PAPERBOY);
    this.scene.remove(this.rider.avatar.root);
    this.rider.avatar.pose = "sit";
    this.rider.avatar.root.scale.setScalar(0.85);
    this.rider.avatar.root.position.set(-0.1, 0.28, 0);
    this.rider.avatar.root.rotation.y = Math.PI / 2;
    this.bikeRoot.add(this.rider.avatar.root);
    this.bikeRoot.visible = false;
    this.group.add(this.bikeRoot);
    for (const door of mansionDoors()) {
      const p = paperModel();
      p.visible = false;
      this.group.add(p);
      this.papers.push({ m: p, door, thrown: -1, fromZ: 0 });
    }
  }

  /** Sends the paperboy round now, whatever the clock says. */
  paperboy(t: number): void {
    this.ctx.host.show("Town");
    this.rideStart = t;
    this.rideForced = true;
    for (const p of this.papers) p.thrown = -1;
    for (const p of this.papers) p.m.visible = false;
  }

  clearPapers(): void {
    for (const p of this.papers) {
      p.m.visible = false;
      p.thrown = -1;
    }
  }

  private updateStreet(dt: number, t: number, ms: number): void {
    const m = clockMinutes(ms);
    // Pølsevogn.
    const open = m >= POLSE.opens && m < POLSE.closes;
    if (open !== this.polseOpen) {
      this.polseOpen = open;
      this.polseTag.el.textContent = open ? "🌭 Gratis pølser" : "🌭 Lukket · 11-14";
      this.polseTag.el.style.background = open ? "rgba(216, 52, 60, 0.95)" : "";
    }
    // The snail, by the clock.
    const s = snailAt(ms);
    const f = (s.x - SNAIL.from) / (SNAIL.to - SNAIL.from);
    const z = SNAIL_Z0 + (SNAIL_Z1 - SNAIL_Z0) * f;
    this.snail.model.position.z = z;
    const inch = s.phase === "deploying" && Math.floor(t / 0.9) % 2 === 0;
    this.snail.body.scale.x = inch ? 1.12 : 1;
    this.snail.body.position.y = inch ? 0 : 0.01;
    this.trail.visible = z > SNAIL_Z0 + 0.05;
    this.trail.scale.z = Math.max(0.01, z - SNAIL_Z0);
    this.trail.position.z = (z + SNAIL_Z0) / 2;
    this.trail.position.x = SNAIL_X;
    this.snailTag.el.textContent =
      s.phase === "queued" ? "queued" : s.phase === "deploying" ? "deploying..." : "✓ deployed";
    // The build finishing while you watch.
    if (
      this.lastSnailMinute !== null &&
      this.lastSnailMinute < SNAIL.arrives &&
      m >= SNAIL.arrives &&
      m - this.lastSnailMinute < 5
    ) {
      this.ctx.burst(["🎉", "✨", "✅"], () => this.snail.model.position.clone().setY(0.6));
      this.ctx.toast("🐌 Build succeeded. The snail has deployed to production.");
    }
    this.lastSnailMinute = m;
    // The paperboy: on the clock from 07:00 (a ride takes `len / 4` seconds), or sent now.
    const len = 32 - 2.5;
    const dur = len / 4;
    let ride = -1;
    if (this.rideStart >= 0) {
      const e = t - this.rideStart;
      if (e >= dur) {
        this.rideStart = -1;
        this.rideForced = false;
      } else ride = e / dur;
    }
    const secsSince = (m - PAPER.at) * 60;
    if (ride < 0 && !this.rideForced && secsSince >= 0 && secsSince < dur) ride = secsSince / dur;
    this.bikeRoot.visible = ride >= 0;
    if (ride >= 0) {
      const bx = 2.5 + ride * len;
      this.bikeRoot.position.set(bx, 0, WALK_Z + 0.55);
      for (const w of this.bike.wheels) w.rotation.z -= dt * 10;
      this.rider.update(dt, t);
      this.rider.avatar.pose = "sit";
      this.rider.avatar.root.position.set(-0.1, 0.34 + Math.abs(Math.sin(t * 8)) * 0.01, 0);
      // Throw a paper to each door he passes.
      for (const p of this.papers) {
        const dx = p.door[0] + 0.7;
        if (p.thrown < 0 && bx >= dx - 0.6) {
          p.thrown = t;
          p.fromZ = WALK_Z + 0.55;
          p.m.visible = true;
        }
      }
    }
    // A throw is a short arc from the road to the door's grass.
    for (const p of this.papers) {
      if (p.thrown < 0) {
        if (m >= PAPER.at && secsSince > dur && !this.rideForced) {
          // On the clock after the round: every paper lies by its door.
          p.m.visible = true;
          p.m.position.set(p.door[0] + 0.7, 0.06, p.door[1] + 0.55);
        }
        continue;
      }
      const k = Math.min(1, (t - p.thrown) / 0.7);
      const tz = p.door[1] + 0.55;
      p.m.position.set(
        p.door[0] + 0.7 + 0.5 * (1 - k),
        0.06 + Math.sin(k * Math.PI) * 0.7,
        p.fromZ + (tz - p.fromZ) * k,
      );
      p.m.rotation.y = k * 6;
    }
  }

  // ——— Sprint Race ———
  startRace(t: number): void {
    if (this.race) return;
    this.ctx.host.show("Town");
    const names = ["ada", "noah", "maja", "kai"];
    const colours: [string, string][] = [
      ["#e25d5d", "#b8443f"],
      ["#4f8fe0", "#3567b0"],
      ["#58b36a", "#3f8f3a"],
      ["#f0b53c", "#c9971f"],
    ];
    const n = 4;
    const runners = names.map((name, i) => {
      const a = new Actor(this.scene, lookOf(colours[i]!, "#3c4454", i * 2 + 1));
      a.avatar.pose = "walk";
      const tag = this.tag(`${name} 🏁`, "tag", () => a.top());
      return { a, tag, laps: 0, speed: 0.058 + Math.random() * 0.02, lane: 0.35 + i * 0.4, done: false };
    });
    const tex = checkerSign();
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.35 + (n - 1) * 0.4 + 0.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.PI / 2;
    line.position.set(18, 0.075, PLAZA.t + 0.35 + ((n - 1) * 0.4) / 2);
    line.scale.set(1, 1, 1);
    tex.repeat.set(2, 6);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.group.add(line);
    this.race = { runners, start: t, line };
    this.ctx.toast("🏁 Sprint Race: racers run laps of the square, a lap for every 400 characters typed.");
  }

  private lapPoint(laps: number, o: number): { x: number; z: number; turn: number } {
    const l = PLAZA.l + o;
    const r = PLAZA.r - o;
    const tp = PLAZA.t + o;
    const b = PLAZA.b - o;
    const w = r - l;
    const h = b - tp;
    let d = ((((laps % 1) + 1) % 1) * 2 * (w + h) + w / 2) % (2 * (w + h));
    if (d < w) return { x: l + d, z: tp, turn: Math.PI / 2 };
    d -= w;
    if (d < h) return { x: r, z: tp + d, turn: 0 };
    d -= h;
    if (d < w) return { x: r - d, z: b, turn: -Math.PI / 2 };
    return { x: l, z: b - (d - w), turn: Math.PI };
  }

  private updateRace(dt: number, t: number): void {
    const rc = this.race;
    if (!rc) return;
    let allDone = true;
    for (const r of rc.runners) {
      if (!r.done) {
        r.laps += r.speed * dt * (1 + 0.25 * Math.sin(t * 2 + r.lane * 9));
        const p = this.lapPoint(r.laps, r.lane);
        r.a.at(p.x, p.z, "walk", p.turn);
        if (r.laps >= 1.6) {
          r.done = true;
          r.a.avatar.pose = "dance";
          r.a.avatar.expression = "laugh";
          if (!rc.winner) {
            rc.winner = r.tag.el.textContent ?? "";
            r.tag.el.textContent = `🏆 ${rc.winner.replace(" 🏁", "")}`;
            this.ctx.burst(["🏆", "🎉", "🏁"], () => r.a.top(0.3));
          }
        }
      }
      allDone &&= r.done;
      r.a.update(dt, t);
    }
    // Faster feet while they run.
    if (allDone && t - rc.start > 6 && rc.runners.every((r) => r.done)) {
      rc.start = Math.min(rc.start, t - 6);
      if (!(rc as { endAt?: number }).endAt) (rc as { endAt?: number }).endAt = t + 4;
      if (t > (rc as { endAt?: number }).endAt!) this.endRace();
    }
  }

  endRace(): void {
    const rc = this.race;
    if (!rc) return;
    for (const r of rc.runners) {
      r.a.dispose();
      r.tag.remove();
    }
    this.group.remove(rc.line);
    this.race = null;
  }

  // ——— Frame ———
  update(dt: number, t: number, ms: number, glow: number): void {
    this.glow = glow;
    this.updateCop(dt, t);
    this.updateMerchant(dt, t, ms);
    this.updateStreet(dt, t, ms);
    this.updateRace(dt, t);
    for (const a of this.picnicPeople) a.update(dt, t);
    if (this.grass.visible) {
      // Sprouts with a little overshoot once it has been touched.
      const k = Math.min(1, Math.max(0, (t - this.grassAt) / 0.6)) - 1;
      const e = this.grassAt === Infinity ? -1 : 1 + 2.7 * k ** 3 + 1.7 * k ** 2;
      this.grass.children[0]!.scale.setScalar(Math.max(0.01, e));
    }
  }

  /** Sprint Race / picnic / merchant / cop / paper states, for the debug panel. */
  state(): Record<string, boolean> {
    return {
      cop: this.siren,
      merchant: this.merchantState !== "away",
      picnic: this.picnicOn,
      race: !!this.race,
      paper: this.rideStart >= 0,
    };
  }
}

/** The snail's run: down the square's left column, from the lantern to the goal flag. */
const SNAIL_X = 12.6;
const SNAIL_Z0 = 4.5;
const SNAIL_Z1 = 9.4;

// MARK: Catalogue

const asset = (id: string, name: string, w: number, d: number, build: () => Model) => ({
  id,
  name,
  price: 0,
  w,
  d,
  build,
});

/** The street-life pieces as assets, for the catalogue. */
export const FX_ASSETS = [
  asset("fx:merchant-cart", "Merchant cart", 2, 1, () => merchantCart().model),
  asset("fx:signpost", "Merchant signpost", 1, 1, signpost),
  asset("fx:picnic-blanket", "Picnic blanket", 3, 2, () => blanketModel(2.4, 1.5, 0)),
  asset("fx:picnic-basket", "Picnic basket", 1, 1, basketModel),
  asset("furn.g", "Touched grass", 2, 1, grassPatch),
  asset("fx:snail", "Build snail", 1, 1, () => snailModel().model),
  asset("fx:goal-flag", "Goal flag", 1, 1, goalFlag),
  asset("fx:paperboy-bike", "Paperboy's bike", 1, 1, () => bikeModel().model),
  asset("fx:paper", "Morning paper", 1, 1, paperModel),
  asset("fx:cop-car", "Patrol car", 2, 1, () => car("#2f4f9f")),
] as const;

void tint;
