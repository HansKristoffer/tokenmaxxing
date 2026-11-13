import * as THREE from "three";
import { canvasTexture, glow, Model, tint, type V3 } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import { nightGlow } from "./props.ts";

/**
 * The Julemarked's shared 3D pieces (`core/src/julemarked.ts`) and its gate for the town: two red-brick gate huts under
 * snow-white roofs with a red stripe, a timber beam with the JULEMARKED sign, a wreath, red-and-white bunting, fairy
 * lights and a glimpse of the market through the opening. The market room itself is `rooms/julemarked3d.ts`, which
 * reuses the strings, the wreath and the palette from here. Warm and woolly: nisse red, cream, forest green, candle gold.
 */

export const RED = "#b8302c";
export const RED_D = "#8c2420";
export const DANNEBROG = "#c8102e";
export const CREAM = "#f4ecd8";
export const SNOW = "#ffffff";
export const SNOW_SHADE = "#dfe9f3";
export const GREEN = "#2f5d3a";
export const GREEN_L = "#437a4d";
export const GOLD = "#f2c14e";
export const WOOD = "#a06a3c";
export const WOOD_D = "#6e4526";
export const WOOD_L = "#c08850";
export const BRICK = "#9a4335";
export const BRICK_D = "#7c3428";
export const WIRE = "#2b2433";

const BULBS = ["#ffd36b", "#ff8a6b", "#fff2b0", "#ffd36b", "#9fd8ff"];

/** A thin dark wire between two points. */
export function wire(m: Model, a: V3, b: V3, color = WIRE, w = 0.016): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const s = m.box([w, w, len], color, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], 0.002);
  s.rotation.order = "YXZ";
  s.rotation.y = Math.atan2(dx, dz);
  s.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
  s.castShadow = false;
}

/** A point `u` (0 to 1) along a string from `a` to `b` that sags `sag` in the middle. */
export const along = (a: V3, b: V3, u: number, sag: number): V3 => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u),
  a[2] + (b[2] - a[2]) * u,
];

/** One lit bulb: a small ball that shines on the town's lamp schedule (`nightGlow`) and is warm gold by day. */
function bulb(m: Model, at: V3, i: number): void {
  const c = BULBS[i % BULBS.length]!;
  const b = m.ball(0.04, tint(c, -0.1), at, [1, 1.2, 1], 6);
  b.castShadow = false;
  nightGlow(b, c);
}

/** A string of fairy lights from `a` to `b`, sagging by `sag`: a wire in short runs, a bulb every ~0.28 units. */
export function fairyString(m: Model, a: V3, b: V3, sag = 0.12): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(2, Math.round(len / 0.28));
  const segs = Math.max(2, Math.round(len / 0.7));
  for (let i = 0; i < segs; i++) wire(m, along(a, b, i / segs, sag), along(a, b, (i + 1) / segs, sag));
  for (let i = 0; i < n; i++) bulb(m, along(a, b, (i + 0.5) / n, sag), i);
}

/** A string of red-and-white pennants from `a` to `b`, sagging by `sag`. */
export function buntingString(m: Model, a: V3, b: V3, sag = 0.2): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const segs = Math.max(3, Math.round(len / 0.5));
  for (let i = 0; i < segs; i++) wire(m, along(a, b, i / segs, sag), along(a, b, (i + 1) / segs, sag));
  const n = Math.max(3, Math.round(len / 0.3));
  const dir = Math.atan2(b[0] - a[0], b[2] - a[2]);
  for (let i = 0; i < n; i++) {
    const p = along(a, b, (i + 0.5) / n, sag);
    const flag = m.box([0.16, 0.2, 0.012], i % 2 ? SNOW : DANNEBROG, [p[0], p[1] - 0.2, p[2]], 0.002);
    flag.rotation.y = dir + Math.PI / 2;
    flag.rotation.z = 0.0;
    flag.castShadow = false;
  }
}

/** A round wreath of spruce with a red bow, hanging with its centre at `at`, facing +z. */
export function wreath3(m: Model, at: V3, r = 0.3): void {
  // A square frame of blocks (a torus would read round next to the voxel look).
  const t = r * 0.5;
  const frame = (col: string, k: number, dz: number) => {
    const e = r * k;
    for (const s of [-1, 1]) {
      m.box([e * 2 + t, t, t], col, [at[0], at[1] + s * e - t / 2, at[2] + dz], 0.004);
      m.box([t, e * 2 - t, t], col, [at[0] + s * e, at[1] - e + t / 2, at[2] + dz], 0.004);
    }
  };
  frame(GREEN, 1, 0);
  frame(GREEN_L, 1.02, r * 0.06);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    m.box(
      [r * 0.16, r * 0.16, r * 0.1],
      GOLD,
      [at[0] + Math.sign(Math.cos(a)) * r, at[1] + Math.sign(Math.sin(a)) * r - r * 0.08, at[2] + r * 0.28],
      0.004,
    );
  }
  for (const s of [-1, 1]) {
    const loop = m.box(
      [r * 0.5, r * 0.28, r * 0.12],
      DANNEBROG,
      [at[0] + s * r * 0.3, at[1] - r - r * 0.05, at[2] + r * 0.3],
      0.01,
    );
    loop.rotation.z = s * 0.35;
  }
  m.box([r * 0.2, r * 0.22, r * 0.14], RED_D, [at[0], at[1] - r - r * 0.05, at[2] + r * 0.32], 0.01);
}

/** A red pitched hut roof in tiers: snow white with a red stripe at the eave, from `y`, `w` x `d` at its base. */
export function snowRoof(m: Model, at: V3, w: number, d: number, tiers = 3, stripe = true): number {
  let [x, y, z] = at;
  let tw = w;
  let td = d;
  const h = 0.28;
  for (let i = 0; i < tiers; i++) {
    m.box([tw, h, td], SNOW, [x, y, z], 0.03);
    if (i === 0 && stripe) {
      m.box([tw + 0.02, 0.09, td + 0.02], DANNEBROG, [x, y + 0.02, z], 0.01);
      m.box([tw + 0.02, 0.03, td + 0.02], SNOW_SHADE, [x, y + 0.1, z], 0.005);
    }
    y += h - 0.03;
    tw *= 0.68;
    td *= 0.68;
  }
  return y;
}

/** The sign over the gate: JULEMARKED in cream on a red board with gold studs. */
function gateSign(): Model {
  return panel(
    2.1,
    0.5,
    (g, w, h) => {
      g.fillStyle = RED;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#d24a44";
      g.fillRect(0, 0, w, 3);
      g.fillStyle = CREAM;
      g.font = `900 ${Math.round(h * 0.62)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("JULEMARKED", w / 2, h * 0.54, w * 0.92);
      g.fillStyle = GOLD;
      for (const x of [8, w - 8]) {
        g.beginPath();
        g.arc(x, h / 2, 3, 0, Math.PI * 2);
        g.fill();
      }
    },
    { frame: "#5a3a20", px: 40, smooth: true },
  );
}

/** What you glimpse through the gate: a dusk sky going to candle glow, stall roofs, a tree and a haze of lights. */
function glimpse(): THREE.CanvasTexture {
  return canvasTexture(
    256,
    192,
    (g, w = 256, h = 192) => {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#2a2a4c");
      sky.addColorStop(0.5, "#4a3a5c");
      sky.addColorStop(1, "#f2b36a");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      // Stall roofs in silhouette, white with red stripes.
      for (const [x, y, rw] of [
        [14, 96, 70],
        [172, 100, 70],
      ] as const) {
        g.fillStyle = "#6b3a3a";
        g.fillRect(x, y + 14, rw, 70);
        g.fillStyle = "#f1f1f4";
        g.fillRect(x - 4, y, rw + 8, 16);
        g.fillStyle = DANNEBROG;
        for (let i = 0; i < rw + 8; i += 20) g.fillRect(x - 4 + i, y, 10, 16);
      }
      // A tree.
      g.fillStyle = "#1f4a2c";
      for (let i = 0; i < 4; i++) {
        const half = 14 + i * 10;
        g.beginPath();
        g.moveTo(w / 2, 56 + i * 24);
        g.lineTo(w / 2 - half, 84 + i * 24);
        g.lineTo(w / 2 + half, 84 + i * 24);
        g.fill();
      }
      g.fillStyle = GOLD;
      g.beginPath();
      g.arc(w / 2, 52, 5, 0, Math.PI * 2);
      g.fill();
      // Haze and bulbs.
      for (let i = 0; i < 46; i++) {
        const x = (i * 97) % w;
        const y = 40 + ((i * 53) % 120);
        g.fillStyle = i % 3 ? "rgba(255,226,138,0.85)" : "rgba(255,255,255,0.9)";
        g.fillRect(x, y, 3, 3);
      }
      const glowAt = g.createRadialGradient(w / 2, h, 4, w / 2, h, h * 0.9);
      glowAt.addColorStop(0, "rgba(255,200,120,0.55)");
      glowAt.addColorStop(1, "rgba(255,200,120,0)");
      g.fillStyle = glowAt;
      g.fillRect(0, 0, w, h);
    },
    true,
  );
}

/** One gate hut: a red-brick body on a stone plinth with a lit window, under tiered snow roofs and a gold finial. */
function hut(m: Model, x: number): void {
  const w = 1.8;
  const d = 1.9;
  m.box([w + 0.1, 0.22, d + 0.1], "#8a8682", [x, 0, 0], 0.02);
  m.box([w, 2.2, d], BRICK, [x, 0.2, 0], 0.03);
  for (const y of [0.55, 0.95, 1.35, 1.75, 2.15])
    m.box([w + 0.02, 0.04, d + 0.02], BRICK_D, [x, y, 0], 0.005);
  // The lit window with a cream frame, facing the street.
  m.box([0.78, 0.86, 0.06], CREAM, [x, 0.95, d / 2 + 0.02], 0.01);
  const pane = m.box([0.62, 0.7, 0.05], "#ffd98a", [x, 1.03, d / 2 + 0.05], 0.005);
  nightGlow(pane, "#fff2c0");
  m.box([0.05, 0.7, 0.06], CREAM, [x, 1.03, d / 2 + 0.07], 0.004);
  m.box([0.62, 0.05, 0.06], CREAM, [x, 1.33, d / 2 + 0.07], 0.004);
  m.box([0.9, 0.08, 0.14], SNOW, [x, 0.84, d / 2 + 0.08], 0.01);
  const top = snowRoof(m, [x, 2.38, 0], w + 0.5, d + 0.5, 3);
  m.cyl(0.03, 0.22, WOOD_D, [x, top - 0.02, 0], 0.03, 6);
  const star = m.ball(0.07, GOLD, [x, top + 0.26, 0], [1, 1, 1], 6);
  nightGlow(star, "#fff2b0");
}

/**
 * The festive gate for the town: origin at the middle of the front edge of its 7 by 3 tiles, the gate behind it (negative z).
 * The opening between the huts is the three door tiles; a lit glimpse of the market hangs behind it.
 */
export function julemarkedGate3d(): Model {
  const m = new Model();
  const hx = 2.5;
  const z = -1.55;
  const g = m.part([0, 0, z]);
  hut(g, -hx);
  hut(g, hx);
  // The paving of the passage and the lit backdrop.
  g.box([3.2, 0.06, 2.9], "#cfc8ba", [0, 0.0, -0.1], 0.01);
  for (const dx of [-1.0, 0, 1.0]) g.box([0.04, 0.07, 2.9], "#b0a898", [dx, 0.0, -0.1], 0.005);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.5), glow("#fff", glimpse()));
  back.position.set(0, 1.35, -1.25);
  g.add(back);
  // The beam across the opening, with its snow cap and the sign.
  g.box([3.6, 0.4, 0.62], WOOD, [0, 2.2, 0.1], 0.03);
  g.box([3.6, 0.05, 0.62], WOOD_L, [0, 2.55, 0.1], 0.01);
  g.box([3.7, 0.16, 0.74], SNOW, [0, 2.55, 0.1], 0.04);
  for (const s of [-1, 1]) g.box([0.22, 2.2, 0.32], WOOD_D, [s * 1.55, 0.1, 0.55], 0.02);
  const sign = gateSign();
  sign.position.set(0, 2.17, 0.42);
  g.add(sign);
  // The wreath under the sign, bunting across the front, fairy lights along the beam and down the posts.
  wreath3(g, [0, 1.65, 0.52], 0.3);
  buntingString(g, [-hx, 3.42, 0.2], [hx, 3.42, 0.2], 0.6);
  fairyString(g, [-1.75, 2.0, 0.62], [-0.1, 2.0, 0.62], 0.16);
  fairyString(g, [0.1, 2.0, 0.62], [1.75, 2.0, 0.62], 0.16);
  for (const s of [-1, 1]) fairyString(g, [s * 1.55, 2.08, 0.77], [s * 1.55, 0.2, 0.77], 0.03);
  for (const s of [-1, 1])
    fairyString(g, [s * hx - s * 0.9, 2.42, 1.27], [s * hx + s * 0.9, 2.42, 1.27], 0.1);
  return m;
}
