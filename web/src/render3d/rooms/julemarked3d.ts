import {
  JULE_EXIT_X,
  JULE_TREE_AT,
  JULEMARKED_H,
  JULEMARKED_W,
  STALL_H,
  STALL_W,
  STALLS,
  type StallId,
} from "@tokenmaxxing/core/julemarked.ts";
import * as THREE from "three";
import { canvasTexture, Model, painted, seeded, toon, type V3 } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import {
  BRICK,
  BRICK_D,
  buntingString,
  CREAM,
  DANNEBROG,
  fairyString,
  GOLD,
  GREEN,
  GREEN_L,
  RED,
  RED_D,
  SNOW,
  SNOW_SHADE,
  WIRE,
  WOOD,
  WOOD_D,
  WOOD_L,
  wreath3,
} from "../town/julemarked-parts.ts";
import { lanternPillar, nightGlow } from "../town/props.ts";
import { wallEase } from "./walls.ts";
import type { RoomSkin } from "./world.ts";

/**
 * The Julemarked's courtyard (`core/src/julemarked.ts`), outdoors: cobbles under a dusting of snow, a low red-brick wall all round with
 * a way out in the south, four stalls under snow-white roofs with red stripes (Nissens bod, Julegodter, Julepynt, Den varme bod), a tall
 * Christmas tree in the middle, lamp posts, and strings of fairy lights and bunting over the lot. The skin sits at the map's own origin:
 * a tile (x, y) is the world point (x, z). The walls on the camera's side go down, like a room's; the rest stays up.
 */

// MARK: The ground

/** The courtyard's cobbles, with snow lying in the joints and along the walls, as one painted slab. */
function ground(W: number, D: number): THREE.Mesh {
  const px = 16;
  const rnd = seeded(7731);
  const tex = canvasTexture(W * px, D * px, (g) => {
    for (let y = 0; y < D; y++)
      for (let x = 0; x < W; x++) {
        const a = (x + y) % 2 ? "#d9d3c6" : "#cfc8ba";
        g.fillStyle = a;
        g.fillRect(x * px, y * px, px, px);
        // Cobbles: four stones to a tile with dark joints.
        g.fillStyle = "#aea597";
        g.fillRect(x * px, y * px + 7, px, 1);
        g.fillRect(x * px + 7, y * px, 1, 8);
        g.fillRect(x * px + 3, y * px + 8, 1, 8);
        g.fillRect(x * px + 12, y * px + 8, 1, 8);
        if (rnd() < 0.4) {
          g.fillStyle = "#ebe6dc";
          g.fillRect(x * px + 1 + Math.floor(rnd() * 12), y * px + 1 + Math.floor(rnd() * 12), 3, 2);
        }
      }
    // Snow along the walls and in drifts.
    g.fillStyle = "rgba(255,255,255,0.8)";
    for (let x = 0; x < W * px; x += 3) {
      g.fillRect(x, 2 * px, 3, 4 + Math.floor(rnd() * 5));
      g.fillRect(x, D * px - px - 4 - Math.floor(rnd() * 5), 3, 5);
    }
    for (let y = 2 * px; y < (D - 1) * px; y += 3) {
      g.fillRect(px, y, 4 + Math.floor(rnd() * 6), 3);
      g.fillRect((W - 1) * px - 4 - Math.floor(rnd() * 6), y, 5, 3);
    }
    g.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 90; i++)
      g.fillRect(2 * px + rnd() * (W - 4) * px, 3 * px + rnd() * (D - 5) * px, 6 + rnd() * 8, 3 + rnd() * 3);
  });
  const side = toon("#8f8a80");
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.35, D), [side, side, painted(tex), side, side, side]);
  slab.position.set(W / 2, -0.175, D / 2);
  slab.receiveShadow = true;
  return slab;
}

// MARK: The wall

/** A run of snow-capped brick wall, `w` by `d`, from (x, z) at the model's floor, `h` high. */
function wallRun(m: Model, x: number, z: number, w: number, d: number, h: number): void {
  m.box([w, h, d], BRICK, [x + w / 2, 0, z + d / 2], 0.02);
  const courses = Math.floor(h / 0.3);
  for (let i = 1; i < courses; i++) m.box([w + 0.01, 0.035, d + 0.01], BRICK_D, [x + w / 2, i * 0.3, z + d / 2], 0.004);
  m.box([w + 0.12, 0.14, d + 0.12], SNOW, [x + w / 2, h, z + d / 2], 0.05);
  m.box([w + 0.14, 0.05, d + 0.14], SNOW_SHADE, [x + w / 2, h - 0.03, z + d / 2], 0.01);
}

// MARK: Stalls

const sign = (text: string, w = 1.9): Model =>
  panel(
    w,
    0.34,
    (g, cw, ch) => {
      g.fillStyle = GREEN;
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = GREEN_L;
      g.fillRect(0, 0, cw, 3);
      g.fillStyle = CREAM;
      g.font = `900 ${Math.round(ch * 0.6)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, cw / 2, ch * 0.54, cw * 0.92);
    },
    { frame: "#3a2a1a", px: 40, smooth: true },
  );

/** A paper heart (two lobes and a point) hanging at `at`. */
function heart(m: Model, at: V3, a: string, b: string): void {
  m.box([0.1, 0.1, 0.02], a, [at[0] - 0.05, at[1], at[2]], 0.01);
  m.box([0.1, 0.1, 0.02], b, [at[0] + 0.05, at[1], at[2]], 0.01);
  const tip = m.box([0.1, 0.1, 0.02], a, [at[0], at[1] - 0.05, at[2]], 0.01);
  tip.rotation.z = Math.PI / 4;
}

/** A mug at `at`: a cream cylinder with a wine-dark top. */
function mug(m: Model, at: V3, c = CREAM): void {
  m.cyl(0.07, 0.14, c, at, 0.065, 10);
  m.cyl(0.058, 0.01, "#7a2a35", [at[0], at[1] + 0.135, at[2]], 0.058, 10);
}

/** What each stall has on its counter and hanging behind it. `c` is the counter's top, the middle of its length (x 0), at z. */
const WARES: Record<StallId, (m: Model, top: number, z: number) => void> = {
  nissen: (m, top, z) => {
    // Case boxes: wrapped chests with gold ribbons, stacked, and a nisse keeping an eye on them.
    for (const [x, c, s] of [
      [-1.7, RED, 0.5],
      [-1.0, GREEN, 0.4],
      [1.6, RED, 0.45],
    ] as const) {
      m.box([s, s * 0.8, s], c, [x, top, z], 0.02);
      m.box([s + 0.02, s * 0.14, s + 0.02], GOLD, [x, top + s * 0.33, z], 0.005);
      m.box([s * 0.14, s * 0.8 + 0.02, s + 0.02], GOLD, [x, top, z], 0.005);
      m.ball(s * 0.14, GOLD, [x, top + s * 0.8 + 0.04, z], [1.6, 1, 1], 6);
    }
    m.box([0.46, 0.34, 0.46], RED, [-1.35, top + 0.4, z - 0.05], 0.02);
    // The nisse: grey jacket, cream beard, round nose and a tall slumped red hat.
    const n = m.part([0.55, top, z - 0.05]);
    n.box([0.38, 0.42, 0.34], "#6d7a8a", [0, 0, 0], 0.006);
    n.ball(0.17, "#e9b99a", [0, 0.56, 0], [1, 1, 1], 10);
    n.ball(0.16, CREAM, [0, 0.46, 0.06], [1.1, 0.9, 0.9], 10);
    n.ball(0.045, "#e08a7a", [0, 0.56, 0.17], [1, 1, 1], 6);
    n.box([0.34, 0.2, 0.32], RED, [0, 0.6, 0], 0.006);
    n.box([0.22, 0.2, 0.2], RED, [0.02, 0.8, 0], 0.006);
    n.box([0.1, 0.16, 0.1], RED, [0.05, 1.0, 0], 0.006);
    n.box([0.1, 0.1, 0.1], CREAM, [0.05, 1.14, 0], 0.004);
    // A scroll of price tags and a lantern.
    m.cyl(0.06, 0.2, "#d8b684", [-0.2, top, z + 0.1], 0.06, 8);
  },
  godter: (m, top, z) => {
    // A big pot of gløgg with a ladle, cups, a plate of æbleskiver under powdered sugar, a bag of burnt almonds.
    m.box([0.68, 0.5, 0.68], "#8a93a1", [-1.55, top, z], 0.006);
    m.box([0.62, 0.02, 0.62], "#7a2a35", [-1.55, top + 0.49, z], 0.003);
    m.box([0.76, 0.06, 0.76], "#5d6470", [-1.55, top + 0.5, z], 0.004);
    m.box([0.03, 0.4, 0.03], WOOD, [-1.35, top + 0.5, z], 0.005).rotation.z = -0.6;
    for (const [x, dz] of [
      [-0.7, 0.05],
      [-0.5, -0.1],
      [-0.3, 0.1],
      [-0.1, -0.05],
    ] as const)
      mug(m, [x, top, z + dz]);
    m.box([0.64, 0.03, 0.64], CREAM, [0.9, top, z], 0.003);
    for (let i = 0; i < 4; i++) {
      const ox = (i % 2 ? 1 : -1) * 0.14;
      const oz = (i < 2 ? 1 : -1) * 0.14;
      m.box([0.2, 0.14, 0.2], "#c28a4a", [0.9 + ox, top + 0.03, z + oz], 0.005);
      m.box([0.13, 0.04, 0.13], SNOW, [0.9 + ox, top + 0.17, z + oz], 0.003);
    }
    m.box([0.2, 0.14, 0.2], "#c28a4a", [0.9, top + 0.15, z], 0.005);
    m.box([0.22, 0.3, 0.14], "#d8b684", [1.7, top, z], 0.02);
    // A string of dried orange slices behind the counter.
    for (let i = 0; i < 9; i++)
      m.box([0.14, 0.015, 0.14], "#e09a3a", [-1.8 + i * 0.45, top + 1.45, z - 0.7], 0.003).rotation.x =
        Math.PI / 2;
  },
  pynt: (m, top, z) => {
    // Paper hearts and straw stars on strings from a beam, a wreath on the counter and a row of little nisser.
    for (let i = 0; i < 7; i++) {
      const x = -2.0 + i * 0.66;
      m.box([0.012, 0.5, 0.012], WIRE, [x, top + 1.0, z - 0.6], 0.001);
      heart(m, [x, top + 0.95, z - 0.58], i % 2 ? DANNEBROG : SNOW, i % 2 ? SNOW : DANNEBROG);
    }
    for (const x of [-1.7, 0.0, 1.7]) {
      m.box([0.012, 0.5, 0.012], WIRE, [x, top + 1.5, z - 0.4], 0.001);
      const star = m.box([0.22, 0.04, 0.22], GOLD, [x, top + 1.45, z - 0.4], 0.005);
      star.rotation.x = Math.PI / 2;
      m.box([0.22, 0.04, 0.22], GOLD, [x, top + 1.45, z - 0.4], 0.005).rotation.set(Math.PI / 2, 0, Math.PI / 4);
    }
    wreath3(m, [-1.55, top + 0.4, z - 0.05], 0.28);
    for (const x of [-0.6, 0.1, 0.8, 1.5]) {
      m.cyl(0.1, 0.22, "#6d7a8a", [x, top, z], 0.09, 8);
      m.cyl(0.1, 0.22, RED, [x, top + 0.2, z], 0.02, 8);
      m.ball(0.04, "#e9b99a", [x, top + 0.2, z + 0.08], [1, 1, 1], 6);
    }
  },
  varme: (m, top, z) => {
    // Knitted hats and mittens on a line, scarves folded on the counter, a mug of cocoa.
    m.box([4.2, 0.02, 0.02], WIRE, [0, top + 1.35, z - 0.55], 0.002);
    for (let i = 0; i < 6; i++) {
      const x = -1.8 + i * 0.72;
      const a = i % 2 ? RED : CREAM;
      const b = i % 2 ? CREAM : RED;
      m.box([0.26, 0.2, 0.26], a, [x, top + 1.12, z - 0.55], 0.004);
      m.box([0.3, 0.04, 0.3], b, [x, top + 1.2, z - 0.55], 0.003);
      m.ball(0.05, b, [x, top + 1.34, z - 0.55], [1, 1, 1], 6);
    }
    for (let i = 0; i < 4; i++) {
      const x = -1.5 + i * 0.9;
      for (let k = 0; k < 3; k++)
        m.box([0.5, 0.05, 0.3], (k + i) % 2 ? RED : GREEN, [x, top + k * 0.05, z], 0.01);
      m.box([0.5, 0.012, 0.31], CREAM, [x, top + 0.06, z], 0.002);
    }
    mug(m, [1.8, top, z + 0.05], "#7a4a2a");
  },
};

/** One stall: back wall, counter with a checked cloth, four posts, a striped snow roof, fairy lights and its name. */
function stallModel(id: StallId, name: string): Model {
  const m = new Model();
  const w = STALL_W - 0.4;
  const back = -STALL_H / 2 + 0.2;
  const front = STALL_H / 2 - 0.4;
  // The back wall and a shelf.
  m.box([w, 2.1, 0.1], WOOD_D, [0, 0, back], 0.02);
  for (let i = 0; i < 8; i++) m.box([0.02, 2.0, 0.11], "#5a3a20", [-w / 2 + 0.3 + i * (w / 8), 0.05, back], 0.002);
  // The counter: wood with a red-and-white cloth across its front.
  const cz = front - 0.4;
  m.box([w, 0.95, 0.8], WOOD, [0, 0, cz], 0.03);
  m.box([w + 0.1, 0.06, 0.9], WOOD_L, [0, 0.95, cz], 0.02);
  const cloth = Math.round(w / 0.4);
  for (let i = 0; i < cloth; i++)
    m.box([w / cloth, 0.55, 0.03], i % 2 ? SNOW : DANNEBROG, [-w / 2 + (i + 0.5) * (w / cloth), 0.3, cz + 0.41], 0.003);
  WARES[id](m, 1.01, cz);
  // Posts at the four corners.
  for (const sx of [-1, 1])
    for (const z of [back + 0.1, front]) m.box([0.14, 2.35, 0.14], WOOD_D, [sx * (w / 2 - 0.05), 0, z], 0.02);
  // The roof: two snow-white slopes with red stripes, a ridge cap and a scalloped front edge.
  const slope = (zc: number, tilt: number) => {
    const r = m.part([0, 2.55, zc]);
    r.rotation.x = tilt;
    r.box([w + 0.5, 0.1, 1.95], SNOW, [0, 0, 0], 0.02);
    for (let x = -w / 2 - 0.1; x < w / 2 + 0.3; x += 1.0)
      r.box([0.45, 0.03, 1.96], DANNEBROG, [x + 0.25, 0.09, 0], 0.003);
    return r;
  };
  slope(front - 0.8, 0.34);
  slope(back + 0.55, -0.34);
  m.box([w + 0.5, 0.16, 0.34], SNOW, [0, 2.84, (back + front) / 2 - 0.05], 0.05);
  // The valance: alternating red and white tabs hanging from the front eave.
  const tabs = Math.round((w + 0.5) / 0.4);
  const ez = front + 0.18;
  for (let i = 0; i < tabs; i++) {
    const tx = -(w + 0.5) / 2 + (i + 0.5) * ((w + 0.5) / tabs);
    m.box([(w + 0.5) / tabs - 0.01, 0.26, 0.04], i % 2 ? SNOW : DANNEBROG, [tx, 2.06, ez + 0.02], 0.004);
  }
  // The name board, hung under the valance, and the lights along it.
  const board = sign(name.toUpperCase(), Math.max(1.6, name.length * 0.15 + 0.5));
  board.position.set(0, 1.62, ez + 0.1);
  m.add(board);
  fairyString(m, [-w / 2 - 0.1, 2.0, ez + 0.06], [w / 2 + 0.1, 2.0, ez + 0.06], 0.14);
  return m;
}

// MARK: The tree

/** The market's Christmas tree: tiers of snowy spruce, a spiral of fairy lights, baubles, a star and gifts. Origin at the foot. */
function christmasTree(): Model {
  const m = new Model();
  m.box([1.0, 0.4, 1.0], RED, [0, 0, 0], 0.01);
  m.box([1.1, 0.08, 1.1], RED_D, [0, 0.38, 0], 0.006);
  m.box([0.26, 0.6, 0.26], WOOD_D, [0, 0.45, 0], 0.01);
  const tiers: [number, number, number][] = [
    [1.05, 1.1, 0.9],
    [0.85, 1.9, 0.85],
    [0.65, 2.65, 0.8],
    [0.45, 3.35, 0.75],
  ];
  for (const [r, y, h] of tiers) {
    m.cyl(r, h, GREEN, [0, y, 0], 0.04, 16);
    // A cap of snow on the upper part of each tier.
    m.cyl(r * 0.72, h * 0.6, SNOW, [0, y + h * 0.42, 0], 0.03, 16);
  }
  // The star.
  const star = m.ball(0.14, GOLD, [0, 4.25, 0], [1, 1, 1], 8);
  nightGlow(star, "#fff2b0");
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const ray = m.box([0.06, 0.2, 0.06], GOLD, [Math.sin(a) * 0.19, 4.25 + Math.cos(a) * 0.19 - 0.1, 0], 0.005);
    ray.rotation.z = -a;
  }
  // A spiral of lights, and baubles around the tiers.
  const bulbs = ["#ffd36b", "#ff8a6b", "#fff2b0", "#9fd8ff"];
  for (let i = 0; i < 34; i++) {
    const u = i / 34;
    const a = u * Math.PI * 2 * 4;
    const y = 1.25 + u * 2.85;
    const r = 1.05 * (1 - u) + 0.15;
    const b = m.ball(0.045, bulbs[i % bulbs.length]!, [Math.cos(a) * r, y, Math.sin(a) * r], [1, 1.2, 1], 6);
    b.castShadow = false;
    nightGlow(b, bulbs[i % bulbs.length]!);
  }
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    const u = (i + 0.5) / 12;
    const r = 0.95 * (1 - u) + 0.1;
    m.ball(0.07, i % 3 === 0 ? GOLD : i % 3 === 1 ? RED : DANNEBROG, [Math.cos(a) * r, 1.15 + u * 2.6, Math.sin(a) * r], [1, 1, 1], 7);
  }
  // Gifts at its foot.
  for (const [x, z, c, s] of [
    [0.85, 0.7, RED, 0.28],
    [-0.9, 0.6, GOLD, 0.24],
    [0.2, 1.0, "#bcd8e8", 0.22],
    [-0.5, 0.95, DANNEBROG, 0.2],
  ] as const) {
    m.box([s, s, s], c, [x, 0.0, z], 0.02);
    m.box([s * 0.16, s + 0.01, s + 0.01], c === GOLD ? RED : GOLD, [x, 0, z], 0.003);
  }
  return m;
}

// MARK: The exit

/** The way out: two brick posts with snow caps and a lantern each, a plate "UD" and a string of lights over the gap. */
function exitGate(m: Model, x: number, z: number): void {
  for (const s of [-1, 1]) {
    const px = x + s * 0.75;
    m.box([0.5, 1.7, 0.5], BRICK, [px, 0, z], 0.03);
    m.box([0.62, 0.14, 0.62], SNOW, [px, 1.7, z], 0.05);
    const lamp = m.box([0.2, 0.26, 0.2], "#f5d98a", [px, 1.86, z], 0.02);
    nightGlow(lamp, "#ffe28a");
    m.cyl(0.14, 0.12, WIRE, [px, 2.12, z], 0.02, 4);
  }
  m.box([1.7, 0.16, 0.4], WOOD_D, [x, 1.6, z], 0.02);
  m.box([1.76, 0.1, 0.46], SNOW, [x, 1.76, z], 0.03);
  buntingString(m, [x - 0.8, 1.5, z - 0.2], [x + 0.8, 1.5, z - 0.2], 0.18);
}

// MARK: The room

const lampAt: readonly (readonly [number, number])[] = [
  [8, 5],
  [15, 5],
  [8, 12],
  [15, 12],
];

/**
 * The market room as a skin on `MAPS.julemarked`. The `facing` hook lowers the wall on the side the camera looks through,
 * as a room's walls do, so the courtyard is never hidden behind its own wall.
 */
export function buildJulemarkedRoom(): RoomSkin {
  const W = JULEMARKED_W;
  const D = JULEMARKED_H;
  const g = new THREE.Group();
  g.add(ground(W, D));
  // The walls, by side: the back wall stays up, the other three go down on the camera's side.
  const sides = {
    n: { m: new Model(), normal: new THREE.Vector3(0, 0, 1) },
    s: { m: new Model(), normal: new THREE.Vector3(0, 0, -1) },
    w: { m: new Model(), normal: new THREE.Vector3(1, 0, 0) },
    e: { m: new Model(), normal: new THREE.Vector3(-1, 0, 0) },
  };
  for (const s of Object.values(sides)) {
    s.m.userData.rigid = true;
    g.add(s.m);
  }
  wallRun(sides.n.m, 0, 0, W, 2, 1.55);
  wallRun(sides.w.m, 0, 2, 1, D - 2, 0.95);
  wallRun(sides.e.m, W - 1, 2, 1, D - 2, 0.95);
  wallRun(sides.s.m, 1, D - 1, JULE_EXIT_X - 1 - 0.0, 1, 0.95);
  wallRun(sides.s.m, JULE_EXIT_X + 1, D - 1, W - 1 - (JULE_EXIT_X + 1), 1, 0.95);
  // Fairy lights along the back wall, a string between the stalls' roofs, and bunting across the middle.
  const lights = new Model();
  g.add(lights);
  fairyString(lights, [1.2, 1.9, 2.15], [W - 1.2, 1.9, 2.15], 0.35);
  // The stalls.
  const stalls = new Model();
  g.add(stalls);
  for (const s of STALLS) {
    const st = stallModel(s.id, s.name);
    st.position.set(s.x + STALL_W / 2, 0, s.y + STALL_H / 2);
    stalls.add(st);
  }
  // The tree.
  const tree = christmasTree();
  tree.position.set(JULE_TREE_AT[0] + 1, 0, JULE_TREE_AT[1] + 1);
  g.add(tree);
  // Lamp posts, and festoons of lights and bunting strung between them and the stalls.
  for (const [x, y] of lampAt) {
    const lamp = lanternPillar();
    lamp.position.set(x + 0.5, 0, y + 0.5);
    g.add(lamp);
  }
  const head = (x: number, y: number): V3 => [x + 0.5, 1.55, y + 0.5];
  fairyString(lights, head(8, 5), head(15, 5), 0.5);
  fairyString(lights, head(8, 12), head(15, 12), 0.5);
  buntingString(lights, head(8, 5), head(8, 12), 0.4);
  buntingString(lights, head(15, 5), head(15, 12), 0.4);
  buntingString(lights, [JULE_TREE_AT[0] + 1, 4.1, JULE_TREE_AT[1] + 1], head(8, 5), 0.6);
  buntingString(lights, [JULE_TREE_AT[0] + 1, 4.1, JULE_TREE_AT[1] + 1], head(15, 5), 0.6);
  const way = new Model();
  exitGate(way, JULE_EXIT_X + 0.5, D - 0.5);
  g.add(way);
  return {
    group: g,
    offset: [0, 0],
    facing: (view) => {
      for (const s of [sides.s, sides.w, sides.e]) {
        const front = s.normal.dot(view) < -0.01;
        const target = front ? 0.06 : 1;
        s.m.scale.y += (target - s.m.scale.y) * wallEase.k;
        s.m.visible = s.m.scale.y > 0.02;
      }
    },
    extra: null,
  };
}

