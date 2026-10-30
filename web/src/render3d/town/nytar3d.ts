import { COSTUME_BASE } from "@tokenmaxxing/core/costumes.ts";
import { type FestiveNpc, festiveNpcOf } from "@tokenmaxxing/core/festive.ts";
import {
  midnightOf,
  NYTAR_CHAIR,
  NYTAR_CLOCK,
  NYTAR_LAMPS,
  NYTAR_NPC_TILE,
  NYTAR_TABLE,
  nytarCaption,
} from "@tokenmaxxing/core/nytar.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { festiveNow } from "../../game/festive.ts";
import { talkToFestiveNpc } from "../../game/festive-npc.ts";
import {
  CONFETTI_COLOURS,
  CONFETTI_MAX,
  confetti,
  hoppedInto,
  nytarOn,
  nytarTick,
} from "../../game/nytar.ts";
import { skyNow } from "../../game/sky.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { canvasTexture, glass, glow, Model } from "../kit/kit.ts";
import { avatarFor } from "../people/gear3d.ts";
import type { LiveFrame, Sign } from "../rooms/rooms.ts";

/**
 * Nytårsaften in the 3D town (2D: `game/nytar.ts`, `art/nytar.ts`; the numbers are `core/src/nytar.ts`): the Nytårsur
 * with a hand on every side, the buffet with its kransekage tower and champagne, the jumping chair, balloons,
 * party lights between the square's corner lamps, and the confetti. Built the first frame the theme is on, merged
 * into a few meshes (the hands, bulbs, balloons and confetti stay live), and taken down when the window ends.
 */

const NAVY = "#26356b";
const NAVY_D = "#1a2552";
const GOLD = "#f4c95d";
const STONE = "#d6d1c7";
const STONE_D = "#b4aea3";
const CREAM = "#f3e2bd";
const CREAM_D = "#e0c98f";

/** The tower is drawn at this share of its model's size (it is five units tall, a person about one). */
const CLOCK_SCALE = 0.66;

const BULB_COLOURS = ["#ffd35a", "#ff6e82", "#6edcff", "#be96ff", "#96ffa0"] as const;
/** The lamp heads are this high (`lanternPillar`), and the strings sag between them. */
const LAMP_Y = 1.45;

type ToWorld = (tx: number, ty: number) => [number, number];

/** The hands of one dial: each turns about its pivot (set in `update`). */
interface Hands {
  hour: THREE.Object3D;
  min: THREE.Object3D;
  sec: THREE.Object3D;
}

/** A face of the clock: a lit dial with its ticks and three hands, facing +z in its own space. */
function dial(m: Model, hands: Hands[]): void {
  const d = m.cyl(0.54, 0.03, glow("#fff3d0"), [0, 0, 0], 0.54, 28);
  d.rotation.x = Math.PI / 2;
  const ring = m.cyl(0.62, 0.04, GOLD, [0, 0, -0.03], 0.62, 28);
  ring.rotation.x = Math.PI / 2;
  for (let h = 0; h < 12; h++) {
    const q = h % 3 === 0;
    const len = q ? 0.12 : 0.06;
    // The dial turns about z (`part` turns about y).
    const tick = m.part([0, 0, 0.02]);
    tick.rotation.z = (-h / 12) * Math.PI * 2;
    tick.box([q ? 0.05 : 0.03, len, 0.02], q ? NAVY_D : "#a98225", [0, 0.47 - len, 0], 0.004);
  }
  const pivot = (len: number, w: number, z: number, colour: string) => {
    const g = new THREE.Group();
    g.position.set(0, 0, z);
    const b = new Model();
    b.box([w, len, 0.015], colour, [0, -0.04, 0], 0.003).userData.live = true;
    g.add(b);
    m.add(g);
    return g;
  };
  hands.push({
    hour: pivot(0.3, 0.07, 0.03, NAVY_D),
    min: pivot(0.43, 0.05, 0.045, NAVY_D),
    sec: pivot(0.47, 0.02, 0.06, "#d8283a"),
  });
}

/** The year on a navy plate, gold digits. */
function yearPlate(year: number): THREE.CanvasTexture {
  return canvasTexture(64, 20, (g) => {
    g.fillStyle = NAVY;
    g.fillRect(0, 0, 64, 20);
    g.fillStyle = "#3d52a0";
    g.fillRect(0, 0, 64, 2);
    g.fillStyle = GOLD;
    g.font = "700 15px ui-monospace, Menlo, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(year), 32, 11);
  });
}

/** The tower: plinth, shaft, the clock room with a dial on each side, a navy roof and a spire. Origin at its foot. */
function clockModel(year: number): { model: Model; hands: Hands[] } {
  const m = new Model();
  const hands: Hands[] = [];
  m.box([1.3, 0.3, 1.3], STONE_D, [0, 0, 0], 0.03);
  m.box([1.1, 0.1, 1.1], STONE, [0, 0.3, 0], 0.02);
  m.box([0.96, 1.5, 0.96], STONE, [0, 0.4, 0], 0.03);
  for (const y of [0.9, 1.4]) m.box([0.98, 0.03, 0.98], STONE_D, [0, y, 0], 0.005);
  const plateMat = new THREE.MeshBasicMaterial({ map: yearPlate(year) });
  for (const [z, ry] of [
    [0.49, 0],
    [-0.49, Math.PI],
  ] as const) {
    const p = m.plane(0.8, 0.25, plateMat, [0, 1.05, z]);
    p.rotation.y = ry;
    p.userData.live = true;
  }
  m.box([1.5, 0.12, 1.5], GOLD, [0, 1.85, 0], 0.02);
  m.box([1.4, 1.55, 1.4], STONE, [0, 1.95, 0], 0.03);
  m.box([1.5, 0.12, 1.5], GOLD, [0, 3.45, 0], 0.02);
  for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const side = m.part([0, 2.72, 0], ry);
    dial(side.part([0, 0, 0.705]), hands);
  }
  // The roof: a navy pyramid, a gold spire, a red pennant.
  const roof = m.cyl(1.2, 1.1, NAVY, [0, 3.57, 0], 0.05, 4);
  roof.rotation.y = Math.PI / 4;
  m.cyl(0.04, 0.6, GOLD, [0, 4.6, 0], 0.03, 6);
  m.ball(0.09, GOLD, [0, 5.2, 0]);
  m.box([0.34, 0.2, 0.02], "#d8283a", [0.2, 4.9, 0], 0.005);
  return { model: m, hands };
}

/** The buffet: a navy cloth with a gold hem, a kransekage tower, champagne and flutes. Origin: its middle, on the floor. */
function tableModel(): Model {
  const m = new Model();
  m.box([2.0, 0.78, 0.86], NAVY, [0, 0, 0], 0.03);
  m.box([2.02, 0.1, 0.88], GOLD, [0, 0.02, 0], 0.01);
  m.box([2.06, 0.05, 0.9], "#f6f1e6", [0, 0.78, 0], 0.01);
  for (let i = 0; i < 9; i++) m.box([0.05, 0.3, 0.012], "#3d52a0", [-0.8 + i * 0.2, 0.3, 0.436], 0.003);
  // The kransekage tower, on a plate: rings, smallest on top, a flag.
  m.cyl(0.34, 0.025, "#fbf7ef", [-0.5, 0.83, 0], 0.34, 20);
  for (let i = 0; i < 9; i++) {
    const r = 0.3 - i * 0.027;
    m.cyl(r, 0.1, i % 2 ? CREAM_D : CREAM, [-0.5, 0.855 + i * 0.092, 0], r * 0.95, 16);
  }
  m.cyl(0.01, 0.34, "#8c5c36", [-0.5, 1.68, 0], 0.01, 5);
  m.box([0.2, 0.13, 0.012], "#d8283a", [-0.4, 1.86, 0], 0.003);
  m.box([0.2, 0.024, 0.014], "#fbf7ef", [-0.4, 1.92, 0], 0.002);
  m.box([0.024, 0.13, 0.014], "#fbf7ef", [-0.46, 1.86, 0], 0.002);
  // The bottle and the flutes.
  m.cyl(0.085, 0.34, "#1f5f3a", [0.2, 0.83, 0], 0.085, 14);
  m.cyl(0.085, 0.07, "#1f5f3a", [0.2, 1.17, 0], 0.035, 14);
  m.cyl(0.035, 0.14, "#1f5f3a", [0.2, 1.24, 0], 0.033, 10);
  m.cyl(0.04, 0.1, GOLD, [0.2, 1.3, 0], 0.04, 10);
  m.cyl(0.088, 0.12, CREAM, [0.2, 0.9, 0], 0.088, 14);
  const flute = glass("#dff0ff", 0.55);
  const fizz = glow("#fbe9a6");
  for (const x of [0.55, 0.75, 0.95]) {
    m.cyl(0.035, 0.2, flute, [x, 0.83, 0.05], 0.05, 10);
    m.cyl(0.022, 0.13, fizz, [x, 0.84, 0.05], 0.034, 8);
    m.cyl(0.03, 0.01, "#dff0ff", [x, 0.82, 0.05], 0.03, 8);
  }
  return m;
}

/** The chair to jump from, facing +z: wood, a navy cushion, a gold streamer tied to the back. */
function chairModel(): Model {
  const m = new Model();
  for (const [x, z] of [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ] as const)
    m.box([0.06, 0.42, 0.06], "#8c5c36", [x, 0, z], 0.01);
  m.box([0.52, 0.05, 0.52], "#b57c4b", [0, 0.42, 0], 0.01);
  m.box([0.46, 0.06, 0.46], NAVY, [0, 0.47, 0], 0.02);
  m.box([0.52, 0.5, 0.05], "#b57c4b", [0, 0.47, -0.25], 0.01);
  for (const x of [-0.15, 0, 0.15]) m.box([0.04, 0.4, 0.03], "#8c5c36", [x, 0.52, -0.25], 0.005);
  m.box([0.04, 0.35, 0.02], GOLD, [0.22, 0.6, -0.27], 0.005).rotation.z = 0.15;
  return m;
}

/** A bunch of three balloons on strings, the knot at the origin. */
function balloons(colours: readonly string[]): Model {
  const m = new Model();
  m.userData.live = true;
  for (const [i, c] of colours.entries()) {
    const a = (i / colours.length) * Math.PI * 2;
    const x = Math.cos(a) * 0.22;
    const z = Math.sin(a) * 0.22;
    const top = 1.45 + i * 0.12;
    const string = m.cyl(0.004, top, "#6b6578", [0, 0, 0], 0.004, 4);
    string.rotation.set(Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15);
    const b = m.ball(0.17, c, [x * 1.1, top, z * 1.1], [1, 1.25, 1], 12);
    b.userData.live = true;
  }
  return m;
}

/** Strings of party lights between the lamps: the bulbs a mesh per colour (so they can twinkle), and the cord. */
function lights(toWorld: ToWorld): { group: THREE.Group; bulbs: THREE.MeshBasicMaterial[] } {
  const group = new THREE.Group();
  const per: THREE.BufferGeometry[][] = BULB_COLOURS.map(() => []);
  const cord: THREE.BufferGeometry[] = [];
  const strings: [[number, number], [number, number], number][] = [
    [[NYTAR_LAMPS.left, NYTAR_LAMPS.top], [NYTAR_LAMPS.right, NYTAR_LAMPS.top], 0.6],
    [[NYTAR_LAMPS.left, NYTAR_LAMPS.bottom], [NYTAR_LAMPS.right, NYTAR_LAMPS.bottom], 0.5],
  ];
  const n = 26;
  for (const [a, b, sag] of strings) {
    const [x0, z0] = toWorld(...a);
    const [x1, z1] = toWorld(...b);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const y = LAMP_Y - 4 * sag * t * (1 - t);
      per[i % BULB_COLOURS.length]!.push(new THREE.BoxGeometry(0.1, 0.14, 0.1).translate(x, y - 0.08, z));
      if (i < n) {
        const t2 = (i + 1) / n;
        const y2 = LAMP_Y - 4 * sag * t2 * (1 - t2);
        const len = Math.hypot((x1 - x0) / n, y2 - y);
        const seg = new THREE.BoxGeometry(len, 0.02, 0.02);
        seg.rotateZ(Math.atan2(y2 - y, (x1 - x0) / n));
        seg.translate((x + x0 + (x1 - x0) * t2) / 2, (y + y2) / 2, z);
        cord.push(seg);
      }
    }
  }
  const bulbs: THREE.MeshBasicMaterial[] = [];
  for (const [i, geoms] of per.entries()) {
    const mat = new THREE.MeshBasicMaterial({ color: BULB_COLOURS[i]! });
    bulbs.push(mat);
    const mesh = new THREE.Mesh(mergeGeometries(geoms), mat);
    mesh.userData.live = true;
    mesh.userData.nopick = true;
    group.add(mesh);
    for (const g of geoms) g.dispose();
  }
  const cordMesh = new THREE.Mesh(mergeGeometries(cord), new THREE.MeshBasicMaterial({ color: "#3b3548" }));
  cordMesh.userData.live = true;
  group.add(cordMesh);
  for (const g of cord) g.dispose();
  return { group, bulbs };
}

/** What is built while the theme is on, so it can be torn down whole. */
interface Built {
  root: THREE.Group;
  hands: Hands[];
  year: number;
  bulbs: THREE.MeshBasicMaterial[];
  bunches: THREE.Object3D[];
  confetti: THREE.InstancedMesh;
  clockAt: [number, number];
  npcAt: [number, number];
}

const BASE_BULB = BULB_COLOURS.map((c) => new THREE.Color(c));

export class Nytar3d {
  readonly group = new THREE.Group();
  private built: Built | null = null;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private readonly hex = CONFETTI_COLOURS.map((c) => new THREE.Color(c));

  constructor(private readonly toWorld: ToWorld) {
    this.group.name = "nytar";
    // It comes and goes with the calendar: the room's batching leaves it as it is.
    this.group.userData.nobatch = true;
    // Built after the town is baked: the bake must not put it to sleep (`perf/bake.ts`).
    this.group.userData.live = true;
    this.group.visible = false;
  }

  private build(year: number): Built {
    const { toWorld } = this;
    const root = new THREE.Group();
    const stills: Model[] = [];
    // Each still piece stands in a holder at its place, itself at the holder's origin: the merge is done off the
    // origin (the batching splits at multiples of 100), and the piece goes back to the holder's origin after.
    const place = (m: Model, at: [number, number], scale = 1) => {
      const holder = new THREE.Group();
      holder.position.set(at[0], 0, at[1]);
      holder.scale.setScalar(scale);
      holder.add(m);
      root.add(holder);
      stills.push(m);
    };
    // The clock (rebuilt at midnight, for the new year's plate).
    const { model: clock, hands } = clockModel(year);
    place(clock, toWorld(NYTAR_CLOCK.x, NYTAR_CLOCK.y), CLOCK_SCALE);
    const [t0x, t0z] = toWorld(NYTAR_TABLE[0]!.x, NYTAR_TABLE[0]!.y);
    const [t1x] = toWorld(NYTAR_TABLE[1]!.x, NYTAR_TABLE[1]!.y);
    place(tableModel(), [(t0x + t1x) / 2, t0z]);
    place(chairModel(), toWorld(NYTAR_CHAIR.x, NYTAR_CHAIR.y));
    // The watchman's lantern on a staff beside his tile.
    const lantern = new Model();
    lantern.cyl(0.025, 1.5, "#6b4a2e", [0, 0, 0], 0.025, 6);
    lantern.box([0.2, 0.26, 0.2], glow("#ffd37a"), [0, 1.4, 0], 0.03);
    lantern.cyl(0.14, 0.06, "#2b2433", [0, 1.66, 0], 0.01, 4).rotation.y = Math.PI / 4;
    lantern.box([0.24, 0.04, 0.24], "#2b2433", [0, 1.36, 0], 0.01);
    const [nx, nz] = toWorld(NYTAR_NPC_TILE.x, NYTAR_NPC_TILE.y);
    place(lantern, [nx + 0.32, nz + 0.42]);
    for (const m of stills) {
      m.position.set(50, 0, 50);
      mergeStill(m);
      m.position.set(0, 0, 0);
    }
    // The balloons sway.
    const bunches = [
      balloons(["#f4c95d", "#ff5d73", "#5ee0ff"]),
      balloons(["#b18cff", "#fbf7ef", "#f4c95d"]),
    ];
    const [cx, cz] = toWorld(NYTAR_CLOCK.x, NYTAR_CLOCK.y);
    bunches[0]!.position.set(cx + 0.85, 0, cz + 0.9);
    bunches[1]!.position.set(toWorld(NYTAR_CHAIR.x, NYTAR_CHAIR.y)[0] - 0.1, 0, t0z + 1.0);
    root.add(...bunches);
    // The party lights.
    const strung = lights(toWorld);
    root.add(strung.group);
    // The confetti: one instanced mesh of flakes, set each frame from the pool the 2D canvas draws too.
    const flakes = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.11, 0.07),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
      CONFETTI_MAX,
    );
    flakes.frustumCulled = false;
    flakes.userData.live = true;
    flakes.userData.nopick = true;
    flakes.setColorAt(0, this.tint.set("#ffffff"));
    flakes.count = 0;
    root.add(flakes);
    root.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    this.group.add(root);
    return {
      root,
      hands,
      year,
      bulbs: strung.bulbs,
      bunches,
      confetti: flakes,
      clockAt: toWorld(NYTAR_CLOCK.x, NYTAR_CLOCK.y),
      npcAt: toWorld(NYTAR_NPC_TILE.x, NYTAR_NPC_TILE.y),
    };
  }

  private clear(): void {
    if (this.built) {
      this.group.remove(this.built.root);
      disposeObject(this.built.root);
    }
    this.built = null;
    this.group.visible = false;
  }

  update(f: LiveFrame): void {
    if (!nytarOn()) {
      if (this.built) this.clear();
      return;
    }
    const sky = skyNow();
    const year = midnightOf(sky).year;
    if (this.built && this.built.year !== year) this.clear();
    if (!this.built) this.built = this.build(year);
    const b = this.built;
    this.group.visible = true;
    nytarTick(f.now);
    // The hands on the real time.
    const w = worldWall(sky);
    const s = w.second + (sky % 1000) / 1000;
    const m = w.minute + s / 60;
    const h = (w.hour % 12) + m / 60;
    for (const hand of b.hands) {
      hand.hour.rotation.z = -(h / 12) * Math.PI * 2;
      hand.min.rotation.z = -(m / 60) * Math.PI * 2;
      hand.sec.rotation.z = -(s / 60) * Math.PI * 2;
    }
    if (!f.calm) {
      for (const [i, mat] of b.bulbs.entries())
        mat.color.copy(BASE_BULB[i]!).multiplyScalar(0.65 + 0.35 * Math.sin(f.t * 3.2 + i * 1.7));
      for (const [i, g] of b.bunches.entries()) {
        g.rotation.z = Math.sin(f.t * 1.1 + i * 2) * 0.06;
        g.rotation.x = Math.cos(f.t * 0.9 + i) * 0.05;
      }
    }
    this.setFlakes(b.confetti);
  }

  /** The pool, as instances: each flake spins about a different axis as it falls. */
  private setFlakes(mesh: THREE.InstancedMesh): void {
    const c = confetti;
    const d = this.dummy;
    const [ox, oz] = this.toWorld(0, 0);
    for (let i = 0; i < c.n; i++) {
      const spin = c.age[i]! * 6 + c.phase[i]!;
      d.position.set(ox + c.x[i]!, Math.max(0.02, c.h[i]!), oz + c.y[i]!);
      d.rotation.set(spin, spin * 0.7, c.phase[i]!);
      const fade = Math.min(1, (c.life[i]! - c.age[i]!) * 2);
      d.scale.setScalar(fade);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, this.hex[c.colour[i]!]!);
    }
    mesh.count = c.n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** The clock's sign, and the watchman's name (a button: it talks). */
  signs(): Sign[] {
    const b = this.built;
    const npc = festiveNpcOf(festiveNow());
    if (!b) return [];
    const sky = skyNow();
    const out: Sign[] = [
      {
        key: "nytar-clock",
        at: [b.clockAt[0], 5.4 * CLOCK_SCALE, b.clockAt[1]],
        kind: "label",
        cls: "gold",
        text: nytarCaption(sky) + (hoppedInto(b.year) ? " · ✓ hoppet" : ""),
      },
    ];
    if (npc)
      out.push({
        key: "nytar-npc",
        at: [b.npcAt[0], 2.3, b.npcAt[1]],
        kind: "label",
        text: npc.name,
        onClick: talkToFestiveNpc,
      });
    return out;
  }

  dispose(): void {
    this.clear();
  }
}

// MARK: The watchman

/** The registry entry (`NPC_MODELS.nytar`): Nattevagt Niels in a navy coat, the Midnight top hat, a gold scarf. */
export function nytarNpcModel(_npc: FestiveNpc): THREE.Object3D {
  const avatar = avatarFor({ style: 0, skin: 1, hair: 4, outfit: 5, hat: COSTUME_BASE + 56 });
  const root = new THREE.Group();
  root.add(avatar.root);
  let last = 0;
  root.userData.tick = (t: number) => {
    avatar.update(Math.min(0.1, Math.max(0, t - last)), t);
    last = t;
  };
  // A gold scarf round the neck.
  const scarf = new Model();
  scarf.box([0.42, 0.1, 0.34], GOLD, [0, 0, 0], 0.03);
  scarf.box([0.1, 0.34, 0.04], GOLD, [0.12, -0.3, 0.17], 0.01);
  scarf.position.y = avatar.height - 0.55;
  root.add(scarf);
  return root;
}
