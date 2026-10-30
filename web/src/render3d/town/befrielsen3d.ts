/**
 * Befrielsen in the 3D town (the 2D one is `game/befrielsen.ts`; both ask `befrielsenOn` and `memorialCandles`):
 * a candle in every window (flames once the lamps are on), the memorial on the west lawn with its wall, stele,
 * wreath and candle tray, Dannebrog flagpoles round the square, and a soft glow on the ground at dusk.
 * Built lazily the first frame the theme is on, taken down (geometry and all) when it ends.
 */
import {
  CANDLE_SLOTS,
  FLAGPOLES,
  HENNING,
  MEMORIAL,
  MEMORIAL_PLAQUE,
} from "@tokenmaxxing/core/befrielsen.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { befrielsenOn, memorialCandles } from "../../game/befrielsen.ts";
import { candlesLit } from "../../game/halloween.ts";
import { lightsNow } from "../../game/sky.ts";
import { disposeObject } from "../engine/dispose.ts";
import { mergeStill } from "../engine/merge3d.ts";
import { canvasTexture, glow, Model } from "../kit/kit.ts";
import { henningModel } from "./henning3d.ts";

const GRANITE = "#8d8f98";
const GRANITE_LIGHT = "#b3b5bd";
const GRANITE_DARK = "#6a6c76";
const CREAM = "#f4efe4";
const FLAME = "#ffd45a";
const WHITE = "#fbf7ef";
const RED = "#c8102e";

type ToWorld = (tx: number, ty: number) => [number, number];

/** A window to put a candle in: where its sill is, and which way the wall faces. */
interface Sill {
  at: THREE.Vector3;
  normal: THREE.Vector3;
}

/** The soft round glow texture, white in the middle, nothing at the edge. */
function haloTexture(): THREE.CanvasTexture {
  return canvasTexture(
    64,
    64,
    (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.4)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    },
    true,
  );
}

/** The Dannebrog: red, with the white cross toward the hoist. */
function flagTexture(): THREE.CanvasTexture {
  return canvasTexture(
    74,
    56,
    (g) => {
      g.fillStyle = RED;
      g.fillRect(0, 0, 74, 56);
      g.fillStyle = WHITE;
      g.fillRect(20, 0, 10, 56);
      g.fillRect(0, 23, 74, 10);
    },
    true,
  );
}

function plaqueTexture(text: string): THREE.CanvasTexture {
  return canvasTexture(
    128,
    48,
    (g) => {
      g.fillStyle = "#3d3f4a";
      g.fillRect(0, 0, 128, 48);
      g.fillStyle = "#e6e0d0";
      g.font = "700 30px Georgia, serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, 64, 26);
    },
    true,
  );
}

/** Where 14 candles stand on the tray: two rows of seven, local to the memorial's middle. */
const trayAt = (i: number): [number, number] => [-1.05 + (i % 7) * 0.35, i < 7 ? 0.28 : 0.6];

export class Befrielsen3d {
  readonly group = new THREE.Group();
  private built: {
    root: THREE.Group;
    windowFlames: THREE.Mesh | null;
    windowHalos: THREE.Mesh | null;
    flames: THREE.Mesh[];
    pool: THREE.Mesh;
    flags: THREE.Object3D[];
  } | null = null;
  private readonly sills: Sill[] = [];

  /** `scene` is the town's group: its windows are found now, while they are still separate meshes. */
  constructor(
    scene: THREE.Object3D,
    private readonly toWorld: ToWorld,
  ) {
    this.group.name = "befrielsen";
    this.group.userData.nobatch = true;
    this.group.visible = false;
    scene.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh || !o.userData.officeWindow) return;
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(q));
      // Only walls that face along an axis (a roof pane would not have a sill).
      if (Math.abs(normal.y) > 0.3) return;
      this.sills.push({ at: o.getWorldPosition(new THREE.Vector3()), normal });
    });
  }

  update(t: number, now: number): void {
    const on = befrielsenOn();
    if (on && !this.built) this.build();
    if (!on && this.built) this.clear();
    this.group.visible = on;
    const b = this.built;
    if (!b || !on) return;
    const dark = candlesLit(now);
    const glowK = Math.min(1, lightsNow(now) * 1.4);
    if (b.windowFlames) b.windowFlames.visible = dark;
    if (b.windowHalos) {
      b.windowHalos.visible = dark;
      (b.windowHalos.material as THREE.MeshBasicMaterial).opacity = 0.5 * glowK;
    }
    (b.pool.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.4 * glowK;
    const { town, mine } = memorialCandles();
    for (const [i, f] of b.flames.entries()) {
      f.visible = i < town || i >= CANDLE_SLOTS - mine;
      f.scale.y = 1.5 + Math.sin(t * 8 + i * 1.9) * 0.3;
    }
    for (const [i, f] of b.flags.entries()) {
      f.rotation.y = Math.sin(t * 1.6 + i * 1.3) * 0.18;
      f.scale.x = 1 + Math.sin(t * 2.4 + i) * 0.04;
    }
  }

  private build(): void {
    const root = new THREE.Group();
    const still = new Model();
    const flames: THREE.Mesh[] = [];
    const flags: THREE.Object3D[] = [];
    const flagTex = flagTexture();
    const flagMat = new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide });

    // The memorial, local to the middle of its 3 x 2 tiles.
    const [x0, z0] = this.toWorld(MEMORIAL.x, MEMORIAL.y);
    const mem = still.part([x0 + (MEMORIAL.w - 1) / 2, 0, z0 + (MEMORIAL.h - 1) / 2]);
    mem.box([2.8, 0.55, 0.32], GRANITE, [0, 0, -0.55], 0.02);
    mem.box([2.9, 0.06, 0.4], GRANITE_LIGHT, [0, 0.55, -0.55], 0.015);
    mem.box([0.7, 1.9, 0.28], GRANITE, [0, 0, -0.55], 0.02);
    mem.box([0.8, 0.08, 0.36], GRANITE_LIGHT, [0, 1.9, -0.55], 0.015);
    mem.box([0.1, 1.9, 0.3], GRANITE_DARK, [0.3, 0, -0.55], 0.01);
    // The years on the wall, to each side of the stele.
    const left = mem.plane(
      0.75,
      0.28,
      new THREE.MeshBasicMaterial({ map: plaqueTexture(MEMORIAL_PLAQUE.slice(0, 4)) }),
      [-0.98, 0.3, -0.385],
    );
    const right = mem.plane(
      0.75,
      0.28,
      new THREE.MeshBasicMaterial({ map: plaqueTexture(MEMORIAL_PLAQUE.slice(5, 9)) }),
      [0.98, 0.3, -0.385],
    );
    left.castShadow = right.castShadow = false;
    // The wreath on the stele's face: a ring of leaves, a ribbon in red and white.
    const greens = ["#4f9b3d", "#3a7b2f", "#72bf52"];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      mem.ball(0.06, greens[i % 3]!, [Math.cos(a) * 0.22, 1.28 + Math.sin(a) * 0.22, -0.39], [1, 1, 0.8], 8);
    }
    mem.box([0.08, 0.2, 0.03], RED, [-0.04, 0.99, -0.37], 0.005).rotation.z = 0.2;
    mem.box([0.08, 0.2, 0.03], WHITE, [0.04, 0.99, -0.37], 0.005).rotation.z = -0.2;
    mem.ball(0.045, RED, [0, 1.07, -0.36]);
    // Small flags on the wall's ends.
    for (const sx of [-1, 1]) {
      mem.cyl(0.015, 0.95, WHITE, [sx * 1.32, 0.58, -0.55], 0.015, 6);
      const hinge = new THREE.Group();
      hinge.position.set(sx * 1.32, 1.35, -0.55);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.25), flagMat);
      cloth.position.x = sx * 0.17;
      cloth.userData.live = true;
      hinge.add(cloth);
      hinge.userData.live = true;
      mem.add(hinge);
      flags.push(hinge);
    }
    // The tray, and its fourteen candles.
    mem.box([2.5, 0.1, 0.8], "#a39f98", [0, 0, 0.44], 0.02);
    mem.box([2.56, 0.03, 0.86], "#c9c4bb", [0, 0.1, 0.44], 0.01);
    const flameMat = glow(FLAME);
    for (let i = 0; i < CANDLE_SLOTS; i++) {
      const [cx, cz] = trayAt(i);
      mem.cyl(0.04, 0.17, CREAM, [cx, 0.13, cz], 0.04, 8);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), flameMat);
      flame.position.set(cx, 0.35, cz);
      flame.userData.live = true;
      flame.visible = false;
      mem.add(flame);
      flames.push(flame);
    }
    // Flowers laid at the foot of the wall.
    for (const [fx, c] of [
      [-1.2, RED],
      [-0.7, WHITE],
      [0.6, RED],
      [1.1, WHITE],
      [1.3, RED],
    ] as const)
      mem.ball(0.05, c, [fx, 0.05, -0.28], [1, 0.8, 1], 8);

    // Flagpoles, as tall as a house, the Dannebrog streaming from the top.
    for (const [i, { x, y }] of FLAGPOLES.entries()) {
      const [px, pz] = this.toWorld(x, y);
      const pole = still.part([px, 0, pz]);
      pole.cyl(0.035, 3.3, WHITE, [0, 0, 0], 0.03, 8);
      pole.ball(0.06, "#e9b73d", [0, 3.34, 0], [1, 1, 1], 8);
      const hinge = new THREE.Group();
      hinge.position.set(0, 2.95, 0);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.82), flagMat);
      cloth.position.x = 0.55;
      cloth.userData.live = true;
      hinge.add(cloth);
      hinge.userData.live = true;
      hinge.rotation.y = i * 0.7;
      pole.add(hinge);
      flags.push(hinge);
    }
    // Henning, at his tile, looking along the memorial (as `HENNING.facing`).
    const [hx, hz] = this.toWorld(HENNING.x, HENNING.y);
    const henning = henningModel();
    henning.position.set(hx, 0, hz);
    henning.rotation.y = -Math.PI / 2;
    henning.scale.setScalar(0.8);
    still.add(henning);
    root.add(still);
    mergeStill(still);

    // The ground glow at the memorial: a warm pool for dusk.
    const halo = haloTexture();
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 4),
      new THREE.MeshBasicMaterial({
        map: halo,
        color: "#ffb45a",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x0 + (MEMORIAL.w - 1) / 2, 0.04, z0 + 0.8);
    pool.userData.live = true;
    root.add(pool);

    // A candle in every window.
    const bodies = new Model();
    const flameGeos: THREE.BufferGeometry[] = [];
    const haloGeos: THREE.BufferGeometry[] = [];
    for (const { at, normal } of this.sills) {
      const sx = at.x + normal.x * 0.1;
      const sz = at.z + normal.z * 0.1;
      const sy = at.y - 0.2;
      bodies.cyl(0.04, 0.17, CREAM, [sx, sy + 0.03, sz], 0.04, 8);
      bodies.cyl(0.065, 0.025, "#cfc6aa", [sx, sy, sz], 0.065, 8);
      flameGeos.push(new THREE.SphereGeometry(0.036, 6, 5).scale(1, 1.6, 1).translate(sx, sy + 0.24, sz));
      const h = new THREE.PlaneGeometry(0.7, 0.7);
      h.rotateY(Math.atan2(normal.x, normal.z));
      haloGeos.push(h.translate(sx + normal.x * 0.05, sy + 0.24, sz + normal.z * 0.05));
    }
    root.add(bodies);
    mergeStill(bodies);
    let windowFlames: THREE.Mesh | null = null;
    let windowHalos: THREE.Mesh | null = null;
    if (flameGeos.length) {
      const fg = mergeGeometries(flameGeos);
      for (const g of flameGeos) g.dispose();
      windowFlames = new THREE.Mesh(fg, glow(FLAME));
      windowFlames.userData.live = true;
      root.add(windowFlames);
      const hg = mergeGeometries(haloGeos);
      for (const g of haloGeos) g.dispose();
      windowHalos = new THREE.Mesh(
        hg,
        new THREE.MeshBasicMaterial({
          map: halo,
          color: "#ffc45e",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      windowHalos.userData.live = true;
      root.add(windowHalos);
    }
    root.traverse((o) => {
      o.userData.nopick = true;
      o.userData.noBlock = true;
    });
    this.group.add(root);
    this.built = { root, windowFlames, windowHalos, flames, pool, flags };
  }

  private clear(): void {
    if (!this.built) return;
    this.group.remove(this.built.root);
    disposeObject(this.built.root);
    this.built = null;
  }

  dispose(): void {
    this.clear();
  }
}
