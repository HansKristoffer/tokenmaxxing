import type { FestiveNpc } from "@tokenmaxxing/core/festive.ts";
import { CANDY_COLORS, type StoneKind } from "@tokenmaxxing/core/spooky.ts";
import * as THREE from "three";
import { mergeStill } from "../engine/merge3d.ts";
import { canvasTexture, glass, glow, Model, painted } from "../kit/kit.ts";

/**
 * Halloween's 3D models (`halloween3d.ts`; the 2D sprites are `art/spooky.ts`), built with the Model kit in tiles
 * (a person is about 1.7 tall). The still parts are merged; the parts that move (wings, bubbles, flames, the
 * lantern) stay their own meshes with `userData.live`.
 */

const BLACK = "#14091f";
const CLOAK = "#4b2a78";
const CLOAK_DARK = "#2a1646";
const ORANGE = "#e8772a";
const ECTO = "#7CFC5A";

/** A soft round glow texture, white at the middle: one for everything that glows on the ground or in the air. */
let blob: THREE.CanvasTexture | undefined;
export function glowTexture(): THREE.CanvasTexture {
  blob ??= canvasTexture(
    64,
    64,
    (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.4)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    },
    true,
  );
  blob.userData.shared = true;
  return blob;
}

/** A flat additive pool of light on the ground (lying down), or a glowing sprite-plane when stood up. */
export function pool(color: string, size: number, opacity: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      color,
      map: glowTexture(),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.userData.live = true;
  m.renderOrder = 2;
  return m;
}

/** A glow that always faces the camera: additive, no depth write. */
export function sprite(color: string, size: number, opacity: number): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color,
      map: glowTexture(),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  s.scale.set(size, size, 1);
  s.userData.live = true;
  return s;
}

// MARK: Bat

export interface BatRig {
  root: Model;
  wings: [THREE.Object3D, THREE.Object3D];
}

/** A bat: a black body, ears and red eyes, two wings of two segments each that the caller flaps about z. */
export function batModel(): BatRig {
  const root = new Model();
  root.userData.live = true;
  root.ball(0.07, BLACK, [0, 0, 0], [1, 1.2, 1], 8);
  root.ball(0.05, BLACK, [0, 0.09, 0.02], [1, 1, 1], 8);
  for (const s of [-1, 1]) {
    root.cyl(0.025, 0.07, BLACK, [s * 0.03, 0.12, 0.02], 0.002, 4);
    root.ball(0.012, glow("#ff3030"), [s * 0.02, 0.1, 0.06], [1, 1, 1], 5);
  }
  const wing = (s: number): Model => {
    const w = root.part([s * 0.05, 0.02, 0]);
    w.box([0.22, 0.012, 0.13], BLACK, [s * 0.11, 0, 0], 0.002);
    const tip = w.part([s * 0.22, 0, 0]);
    tip.box([0.14, 0.012, 0.09], BLACK, [s * 0.05, -0.005, 0.015], 0.002);
    w.userData.live = true;
    return w;
  };
  const [l, r] = [wing(-1), wing(1)];
  return { root, wings: [l, r] };
}

// MARK: Ghost

export interface GhostRig {
  root: Model;
  mats: THREE.Material[];
}

/** A ghost, blocky like the rest: a see-through sheet with a stepped hem, two dark eyes and an "oooh". `scale` makes a baby one. */
export function ghostModel(hue: "white" | "blue", scale: number): GhostRig {
  const root = new Model();
  root.userData.live = true;
  const sheet = glass(hue === "blue" ? "#bff0ff" : "#eef2ff", 0.68);
  const inner = new THREE.MeshBasicMaterial({
    color: hue === "blue" ? "#9be8ff" : "#cfd6ff",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const dark = new THREE.MeshBasicMaterial({ color: "#1b1f2a", transparent: true, opacity: 0.85 });
  // Stacked blocks: a cap, the head and body, a wider skirt, and a checkerboard of teeth for the hem.
  root.box([0.36, 0.08, 0.36], sheet, [0, 0.98, 0], 0.015);
  root.box([0.52, 0.56, 0.5], sheet, [0, 0.42, 0], 0.015);
  root.box([0.58, 0.2, 0.54], sheet, [0, 0.22, 0], 0.015);
  for (const x of [-1, 0, 1])
    for (const z of [-1, 0, 1])
      if ((x + z) % 2 === 0) root.box([0.16, 0.14, 0.16], sheet, [x * 0.21, 0.08, z * 0.19], 0.01);
  for (const s of [-1, 1]) root.box([0.12, 0.14, 0.14], sheet, [s * 0.33, 0.55, 0.08], 0.015);
  root.box([0.38, 0.4, 0.36], inner, [0, 0.5, 0], 0.01);
  for (const s of [-1, 1]) root.box([0.07, 0.11, 0.02], dark, [s * 0.1, 0.74, 0.25], 0.004);
  root.box([0.09, 0.12, 0.02], dark, [0, 0.54, 0.25], 0.004);
  root.scale.setScalar(scale);
  return { root, mats: [sheet, inner, dark] };
}

// MARK: Cauldron

export interface CauldronRig {
  root: Model;
  bubbles: THREE.Mesh[];
  flames: THREE.Mesh[];
}

/** The cauldron: an iron pot on three legs over a little fire, green brew, bubbles that rise. */
export function cauldronModel(): CauldronRig {
  const root = new Model();
  const still = new Model();
  const iron = "#2b2b34";
  still.ball(0.4, iron, [0, 0.44, 0], [1, 0.85, 1], 14);
  still.cyl(0.34, 0.06, "#1d1d24", [0, 0.68, 0], 0.34, 16);
  still.cyl(0.36, 0.03, "#46465a", [0, 0.72, 0], 0.36, 16);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    still.cyl(0.05, 0.17, "#1d1d24", [Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26], 0.04, 6);
  }
  // Logs under it.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 1.1;
    const log = still.part([Math.cos(a) * 0.12, 0.03, Math.sin(a) * 0.12], a);
    log.cyl(0.04, 0.4, "#4f321b", [0, 0.02, 0], 0.04, 5).rotation.z = Math.PI / 2;
  }
  root.add(still);
  mergeStill(still);
  root.cyl(0.31, 0.01, glow(ECTO), [0, 0.73, 0], 0.31, 16).userData.live = true;
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const b = root.ball(0.05, glow("#b8ff9a"), [0, 0.8, 0], [1, 1, 1], 6);
    b.userData.live = true;
    bubbles.push(b);
  }
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const f = root.cyl(
      0.09,
      0.3,
      glow(i % 2 ? "#ffb43a" : "#e8582a"),
      [Math.cos(a) * 0.14, 0.03, Math.sin(a) * 0.14],
      0.01,
      5,
    );
    f.userData.live = true;
    flames.push(f);
  }
  const light = pool(ECTO, 2.6, 0.5);
  light.position.y = 0.04;
  root.add(light);
  return { root, bubbles, flames };
}

// MARK: Tombstones, candy, cobwebs

/** An unclaimed tombstone: a round, a cross or a leaning slab, a word on it, on a mound. Faces +z. */
export function extraStoneModel(kind: StoneKind, text: string): Model {
  const m = new Model();
  const stone = "#aeaaa5";
  const dark = "#8a8682";
  m.box([0.84, 0.05, 0.62], "#6b4a33", [0, 0, 0.08], 0.02);
  if (kind === "cross") {
    const c = m.part([0, 0.04, -0.06]);
    c.box([0.13, 0.72, 0.11], stone, [0, 0, 0], 0.02);
    c.box([0.42, 0.13, 0.11], stone, [0, 0.42, 0], 0.02);
    c.rotation.z = 0.1;
  } else if (kind === "slab") {
    const s = m.part([0, 0.04, -0.04]);
    s.box([0.7, 0.5, 0.1], dark, [0, 0, 0], 0.02);
    s.rotation.x = -0.22;
    s.rotation.z = -0.05;
  } else {
    m.box([0.7, 0.08, 0.22], dark, [0, 0.04, -0.06], 0.01);
    m.box([0.56, 0.5, 0.14], stone, [0, 0.1, -0.06], 0.02);
    m.box([0.46, 0.08, 0.14], stone, [0, 0.6, -0.06], 0.02);
    m.box([0.3, 0.06, 0.14], stone, [0, 0.68, -0.06], 0.02);
  }
  if (kind !== "cross") {
    const face = canvasTexture(
      64,
      32,
      (g) => {
        g.fillStyle = kind === "slab" ? dark : stone;
        g.fillRect(0, 0, 64, 32);
        g.fillStyle = "#2b2433";
        g.font = "900 14px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(text, 32, 16, 60);
      },
      true,
    );
    const p = m.plane(0.46, 0.23, painted(face), kind === "slab" ? [0, 0.32, 0.04] : [0, 0.4, 0.011]);
    if (kind === "slab") {
      p.rotation.x = -0.22;
      p.rotation.z = -0.05;
    }
  }
  // A tuft of grass at its foot.
  for (const x of [-0.25, 0.22]) m.cyl(0.012, 0.09, "#3a7b2f", [x, 0.05, 0.25], 0.004, 4);
  return m;
}

/** A wrapped sweet in one of `CANDY_COLORS`, lying down, in `into`. */
export function candyInto(into: Model, c: number, at: [number, number, number], turn: number): void {
  const color = CANDY_COLORS[c % CANDY_COLORS.length]!;
  const s = into.part(at, turn);
  s.ball(0.04, color, [0, 0.035, 0], [1.3, 0.8, 0.8], 6);
  for (const k of [-1, 1])
    s.cyl(0.003, 0.02, "#fbf7ef", [k * 0.065, 0.035, 0], 0.03, 4).rotation.z = (k * Math.PI) / 2;
}

/** The cobweb material: spokes and sagging threads hanging from the top-left corner of a see-through plane. Shared. */
let webMat: THREE.MeshBasicMaterial | undefined;
export function cobwebMaterial(): THREE.MeshBasicMaterial {
  if (webMat) return webMat;
  const webTex = canvasTexture(
    64,
    64,
    (g) => {
      g.strokeStyle = "rgba(232,230,248,0.95)";
      g.lineWidth = 2;
      g.beginPath();
      for (const a of [0, 0.3, 0.6, 0.9, 1.2, 1.57]) {
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * 64, Math.sin(a) * 64);
      }
      g.stroke();
      g.lineWidth = 1.4;
      for (const r of [14, 26, 40, 56]) {
        g.beginPath();
        g.moveTo(r, 0);
        for (let i = 1; i <= 5; i++) {
          const a = (i / 5) * (Math.PI / 2);
          const rr = r - (i % 2 ? 2 : 0) - Math.sin((i / 5) * Math.PI) * 4;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.stroke();
      }
    },
    true,
  );
  webTex.userData.shared = true;
  webMat = new THREE.MeshBasicMaterial({
    map: webTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  webMat.userData.shared = true;
  return webMat;
}

// MARK: Gerda

/**
 * Gerda, the gravekeeper: a hooded purple cloak with an orange hem, a wrinkly face, grey hair, and a crook with
 * a lantern that sways and flickers. Stands on y = 0 facing +z (`NPC_MODELS`, `festive-npc3d.ts`).
 */
export function gerdaModel(_npc: FestiveNpc): THREE.Object3D {
  const root = new Model();
  const body = new Model();
  body.cyl(0.43, 1.0, CLOAK, [0, 0, 0], 0.2, 14);
  body.cyl(0.44, 0.07, ORANGE, [0, 0.02, 0], 0.44, 14);
  body.cyl(0.3, 0.22, CLOAK_DARK, [0, 0.1, -0.06], 0.18, 10);
  body.ball(0.23, CLOAK, [0, 1.0, 0], [1.2, 0.6, 1], 12);
  // Boots peeking out.
  for (const s of [-1, 1]) body.box([0.12, 0.08, 0.2], BLACK, [s * 0.12, 0, 0.36], 0.03);
  // The hood, a point drooping back, and the face in it.
  body.ball(0.22, CLOAK, [0, 1.3, -0.02], [1, 1.1, 1.05], 14);
  body.cyl(0.17, 0.32, CLOAK, [0, 1.38, -0.12], 0.02, 8).rotation.x = -0.6;
  body.ball(0.15, "#e8c39e", [0, 1.27, 0.07], [1, 1.1, 0.9], 12);
  for (const s of [-1, 1]) {
    body.ball(0.04, "#d8d4e8", [s * 0.14, 1.25, 0.06], [0.7, 1.7, 0.7], 6);
    body.box([0.03, 0.04, 0.02], BLACK, [s * 0.055, 1.28, 0.19], 0.005);
    body.box([0.07, 0.014, 0.02], "#b87a6a", [0, 1.18, 0.195], 0.004);
  }
  body.ball(0.035, "#e8c39e", [0, 1.24, 0.2], [1, 1.2, 1], 6);
  // Her free hand, and the crook she holds, a staff taller than she is.
  body.ball(0.05, "#e8c39e", [-0.36, 0.72, 0.1], [1, 1, 1], 6);
  body.box([0.1, 0.4, 0.1], CLOAK, [-0.34, 0.6, 0.02], 0.03).rotation.z = 0.35;
  body.cyl(0.025, 1.55, "#6b4a34", [0.4, 0, 0.12], 0.025, 6);
  body.cyl(0.02, 0.18, "#6b4a34", [0.33, 1.5, 0.12], 0.02, 6).rotation.z = 1.2;
  body.box([0.1, 0.4, 0.1], CLOAK, [0.34, 0.62, 0.03], 0.03).rotation.z = -0.3;
  body.ball(0.05, "#e8c39e", [0.38, 0.8, 0.12], [1, 1, 1], 6);
  root.add(body);
  mergeStill(body);
  // The lantern, swaying from the crook's end: frame and flame.
  const lantern = new THREE.Group();
  lantern.position.set(0.27, 1.47, 0.12);
  const frame = new Model();
  frame.cyl(0.075, 0.015, BLACK, [0, 0.15, 0], 0.075, 8);
  frame.cyl(0.07, 0.015, BLACK, [0, -0.02, 0], 0.07, 8);
  for (const [x, z] of [
    [0.06, 0.06],
    [-0.06, 0.06],
    [0.06, -0.06],
    [-0.06, -0.06],
  ] as const)
    frame.box([0.012, 0.16, 0.012], BLACK, [x, 0, z], 0.002);
  frame.userData.live = true;
  lantern.add(frame);
  const flame = new Model();
  flame.ball(0.055, glow("#ffc23a"), [0, 0.07, 0], [1, 1.3, 1], 8);
  flame.userData.live = true;
  lantern.add(flame);
  const halo = sprite("#ffaa3c", 0.6, 0.4);
  halo.position.set(0, 0.07, 0);
  lantern.add(halo);
  root.add(lantern);
  const ground = pool("#ffaa3c", 1.8, 0.2);
  ground.position.set(0.2, 0.03, 0.1);
  root.add(ground);
  root.userData.tick = (t: number) => {
    lantern.rotation.z = Math.sin(t * 1.4) * 0.08;
    lantern.rotation.x = Math.sin(t * 1.1 + 1) * 0.04;
    const k = 1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
    flame.scale.setScalar(k);
    halo.material.opacity = 0.32 + (k - 1) * 1.2;
  };
  return root;
}
