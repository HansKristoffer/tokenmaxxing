import type { FestiveNpc } from "@tokenmaxxing/core/festive.ts";
import { blanketCount, flagCount, wormAt, wormCount } from "@tokenmaxxing/core/midsommer.ts";
import { BONFIRE } from "@tokenmaxxing/core/sankthans.ts";
import * as THREE from "three";
import { BALTALER_LOOK, heksSprite } from "../../art/midsommer.ts";
import { festiveNow } from "../../game/festive.ts";
import { heksFlight, spotsNow } from "../../game/midsommer.ts";
import { bonfireNow } from "../../game/sankthans.ts";
import { lightsNow } from "../../game/sky.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { Model, painted } from "../kit/kit.ts";
import { Avatar } from "../people/avatar.ts";
import { lookFrom2D } from "../people/gear3d.ts";
import { basketModel, blanketModel } from "./fx3d-town.ts";

const RED = "#c8102e";
const WHITE = "#fbf7ef";
const LEAF = ["#4f9b3d", "#72bf52", "#3a7b2f"];
const BLOOM = ["#e8584f", "#fbf7ef", "#f5d14a", "#6d9cf0"];

/** A Dannebrog pole: white, gold ball on top. The cloth is `flagCloth`, hung from it. */
function pole(): Model {
  const m = new Model();
  m.cyl(0.05, 0.06, "#8a8682", [0, 0, 0], 0.07, 8);
  m.cyl(0.028, 3.1, "#efe9dc", [0, 0.05, 0], 0.024, 8);
  m.ball(0.05, "#f5c842", [0, 3.18, 0]);
  return m;
}

let clothTexture: THREE.CanvasTexture | null = null;
/** The Dannebrog as a 37 x 28 picture (the cross set toward the pole), crisp like the rest of the town. */
function dannebrog(): THREE.CanvasTexture {
  if (clothTexture) return clothTexture;
  const c = document.createElement("canvas");
  c.width = 37;
  c.height = 28;
  const g = c.getContext("2d")!;
  g.fillStyle = RED;
  g.fillRect(0, 0, 37, 28);
  g.fillStyle = WHITE;
  g.fillRect(12, 0, 5, 28);
  g.fillRect(0, 11, 37, 5);
  clothTexture = new THREE.CanvasTexture(c);
  clothTexture.magFilter = THREE.NearestFilter;
  clothTexture.colorSpace = THREE.SRGBColorSpace;
  return clothTexture;
}

/** The cloth: a thin slab painted with the flag, its hoist edge at the origin. It hangs still (the town is not windy). */
function flagCloth(): Model {
  const m = new Model();
  m.box([1.3, 1.0, 0.04], painted(dannebrog()), [0.65, -0.5, 0], 0.005);
  return m;
}

/** A door wreath: a ring of birch leaves with flowers and a red bow, in the XY plane facing +z. */
function wreath(): Model {
  const m = new Model();
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [x, y] = [Math.cos(a) * 0.26, Math.sin(a) * 0.26];
    m.ball(0.075, LEAF[i % 3]!, [x, y, 0], [1, 1, 0.8], 8);
    if (i % 3 === 0) m.ball(0.04, BLOOM[(i / 3) % 4]!, [x * 1.05, y * 1.05, 0.06], [1, 1, 1], 6);
  }
  m.box([0.08, 0.1, 0.03], RED, [-0.07, -0.34, 0.05], 0.01).rotation.z = 0.5;
  m.box([0.08, 0.1, 0.03], RED, [0.07, -0.34, 0.05], 0.01).rotation.z = -0.5;
  m.ball(0.035, "#8e0c20", [0, -0.26, 0.07], [1, 1, 0.8], 6);
  return m;
}

let heksTextures: THREE.CanvasTexture[] | null = null;
/** The 2D heks (`art/midsommer.ts`) as two textures (her flapping frames): she flies as a billboard, like in the sky. */
function heksFrames(): THREE.CanvasTexture[] {
  heksTextures ??= [0, 1].map((f) => {
    const t = new THREE.CanvasTexture(heksSprite(f));
    t.magFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  return heksTextures;
}

/** A glowing dot that always faces the camera: a spark, a glow-worm. */
function dot(color: string): THREE.Sprite {
  const m = new THREE.Sprite(
    new THREE.SpriteMaterial({ color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  m.userData.live = true;
  return m;
}

/**
 * The Sankt Hans theme's scenery in the 3D town (the 2D one is `game/midsommer.ts`, and both ask the same questions):
 * Dannebrog poles, picnic blankets with a basket, door wreaths, glow-worms drifting over the lawn, sparks over the lit
 * bonfire, and the little straw heks you send to Bloksbjerg. Built lazily the first frame the theme is on, in three
 * tiers that show as the 23rd comes on (each merged once), and taken down (geometry and all) when it ends.
 */
export class Midsommer3d {
  readonly group = new THREE.Group();
  private built = false;
  private tiers: THREE.Group[] = [];
  private worms: THREE.Sprite[] = [];
  private sparks: THREE.Sprite[] = [];
  private tail: THREE.Sprite[] = [];
  private heks: THREE.Sprite | null = null;
  private fire: [number, number, number] = [0, 0, 0];

  constructor(private readonly toWorld: (tx: number, ty: number) => [number, number]) {
    this.group.name = "midsommer";
    // Empty until the theme is on, and the room's batching hides and puts to sleep any subtree with nothing live in
    // it, for good: so it is marked live.
    this.group.userData.nobatch = true;
    this.group.userData.live = true;
  }

  private build(): void {
    const s = spotsNow();
    const at = (tx: number, ty: number) => this.toWorld(tx, ty);
    // Tier 0 stands the whole window; 1 and 2 are added as it nears the bonfire.
    for (let tier = 0; tier < 3; tier++) {
      const g = new THREE.Group();
      const still = new Model();
      for (const [i, [x, y]] of s.flags.entries()) {
        if (Math.floor(i / 2) !== tier) continue;
        const [wx, wz] = at(x, y);
        const p = pole();
        p.position.set(wx, 0, wz);
        still.add(p);
        const cloth = flagCloth();
        cloth.position.set(wx + 0.04, 3.02, wz);
        still.add(cloth);
      }
      const blanket = s.blankets[tier];
      if (blanket) {
        const [wx, wz] = at(blanket[0], blanket[1]);
        const b = blanketModel(2, 1, 0);
        b.position.set(wx + 0.5, 0.02, wz);
        still.add(b);
        const basket = basketModel();
        basket.position.set(wx + 1.1, 0.05, wz - 0.2);
        basket.rotation.y = 0.3 + tier;
        still.add(basket);
      }
      if (tier === 0)
        for (const [x, y] of s.wreaths) {
          const [wx, wz] = at(x, y);
          const w = wreath();
          w.position.set(wx, 1.95, wz + 0.2);
          still.add(w);
        }
      g.add(still);
      mergeStill(still);
      this.tiers.push(g);
      this.group.add(g);
    }
    for (let i = 0; i < 14; i++) {
      const m = dot(i % 2 ? "#ffb43a" : "#ffe27a");
      this.sparks.push(m);
      this.group.add(m);
    }
    for (let i = 0; i < wormCount(1); i++) {
      const m = dot("#c8ff5a");
      this.worms.push(m);
      this.group.add(m);
    }
    for (let i = 0; i < 12; i++) {
      const m = dot(i % 2 ? "#ffd75e" : "#ff8a3a");
      m.visible = false;
      this.tail.push(m);
      this.group.add(m);
    }
    this.heks = new THREE.Sprite(new THREE.SpriteMaterial({ map: heksFrames()[0], fog: false }));
    this.heks.userData.live = true;
    this.heks.visible = false;
    this.heks.scale.set(2.6, 1.6, 1);
    this.group.add(this.heks);
    const [fx, fz] = this.toWorld(BONFIRE.x, BONFIRE.y);
    this.fire = [fx + (BONFIRE.w - 1) / 2, 0.8, fz];
    this.group.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    this.built = true;
  }

  private clear(): void {
    for (const t of this.tiers) {
      this.group.remove(t);
      disposeObject(t);
    }
    for (const o of [...this.sparks, ...this.worms, ...this.tail, ...(this.heks ? [this.heks] : [])]) {
      this.group.remove(o);
      disposeObject(o);
    }
    this.tiers = [];
    this.worms = [];
    this.sparks = [];
    this.tail = [];
    this.heks = null;
    this.built = false;
  }

  /** The heks's place `t` (0..1) into her flight: up off the fire, then away south-west. */
  private heksAt(t: number): THREE.Vector3 {
    const [fx, fy, fz] = this.fire;
    const ease = t * t * (3 - 2 * t);
    return new THREE.Vector3(
      fx - ease * 26,
      fy + 0.8 + Math.sin(Math.min(1, t * 1.25) * Math.PI) * 3.5 + ease * 3,
      fz + ease * 12,
    );
  }

  update(t: number, now: number): void {
    const f = festiveNow();
    const on = f?.id === "sanktHans";
    if (!on) {
      if (this.built) this.clear();
      return;
    }
    if (!this.built) this.build();
    const k = f.intensity;
    const flags = Math.ceil(flagCount(k) / 2);
    const blankets = blanketCount(k);
    for (const [i, g] of this.tiers.entries()) g.visible = i < Math.max(flags, blankets);
    const lit = bonfireNow() === "lit";
    for (const [i, m] of this.sparks.entries()) {
      m.visible = lit;
      if (!lit) continue;
      const p = (t / 2.2 + i / this.sparks.length) % 1;
      m.position.set(
        this.fire[0] + Math.sin(i * 12.9 + p * 5) * (0.2 + 0.5 * p),
        this.fire[1] + 0.5 + p * 3.4,
        this.fire[2] + Math.cos(i * 7.7 + p * 4) * (0.2 + 0.4 * p),
      );
      m.scale.setScalar(0.16 * Math.max(0.2, 1 - p));
    }
    const night = 0.25 + 0.75 * Math.min(1, lightsNow(now) * 1.6);
    const count = wormCount(k);
    for (const [i, m] of this.worms.entries()) {
      const [x, y, blink] = wormAt(i, t);
      const [wx, wz] = this.toWorld(x - 0.5, y - 0.5);
      m.visible = i < count && blink > 0.05;
      m.position.set(wx + 0.5, 0.35 + 0.3 * Math.sin(t * 0.6 + i), wz + 0.5);
      m.scale.setScalar(0.34 * blink * night);
    }
    const flight = heksFlight();
    if (this.heks) {
      this.heks.visible = flight !== null;
      if (flight !== null) {
        this.heks.position.copy(this.heksAt(flight));
        (this.heks.material as THREE.SpriteMaterial).map = heksFrames()[Math.floor(t * 6) % 2]!;
        for (const [i, m] of this.tail.entries()) {
          const back = Math.max(0, flight - (i + 1) * 0.012);
          m.visible = true;
          m.position.copy(this.heksAt(back));
          m.position.x += 1.2 + Math.sin(i * 7.1 + t * 11) * 0.12;
          m.position.y += Math.cos(i * 5.3 + t * 9) * 0.12;
          m.scale.setScalar(0.2 * Math.max(0.2, 1 - i / this.tail.length));
        }
      } else for (const m of this.tail) m.visible = false;
    }
  }

  dispose(): void {
    this.clear();
  }
}

/** Birgit, the båltaler: a long-haired woman in a long dress with a flower wreath, a sheet of speech in her hand. */
export function baltalerModel(_npc: FestiveNpc): THREE.Object3D {
  const root = new THREE.Group();
  const av = new Avatar(lookFrom2D(BALTALER_LOOK), "voxel");
  av.expression = "happy";
  av.pose = "wave";
  root.add(av.root);
  // Her speaker's stump beside her, with the day's speech on it.
  const stump = new Model();
  stump.cyl(0.3, 0.45, "#8c5c36", [0.7, 0, 0.1], 0.27, 12);
  stump.cyl(0.29, 0.03, "#d49c67", [0.7, 0.45, 0.1], 0.29, 12);
  stump.box([0.26, 0.012, 0.34], WHITE, [0.7, 0.48, 0.1], 0.004).rotation.y = 0.4;
  root.add(stump);
  mergeStill(stump);
  let last = 0;
  root.userData.tick = (t: number) => {
    av.talking = Math.floor(t / 4) % 3 === 0;
    av.update(Math.min(0.1, Math.max(0, t - last)), t);
    last = t;
  };
  return root;
}
