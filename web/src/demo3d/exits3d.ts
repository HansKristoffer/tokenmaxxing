/**
 * The way out of every room, drawn one way so it reads at a glance. A door is a recessed frame in the wall with a
 * wooden leaf ajar on the light beyond (daylight outside, a lamp-lit hall inside), a brass handle, a lamp over the
 * lintel pooling on the floor, a mat on the threshold and a plate beside it. Stairs are stepped treads between
 * stringers with a handrail, a dark well in the wall and an arrow plate. Everything is static: nothing here ticks,
 * so the batching merges it.
 *
 * Doors stand on the wall tile they are in, their face at +z (into the room) and the mat on the tile in front.
 * Stairs stand on the tile the treads cover, the wall behind them at -z.
 */
import * as THREE from "three";
import { C } from "../art/palette.ts";
import { canvasTexture, glow, Model, tint, toon } from "./kit.ts";

/** The lamp's warm pool on the floor: one texture for every exit. */
let poolTexture: THREE.CanvasTexture | null = null;
function poolMaterial(): THREE.MeshBasicMaterial {
  poolTexture ??= canvasTexture(
    32,
    32,
    (g) => {
      const r = g.createRadialGradient(16, 16, 2, 16, 16, 16);
      r.addColorStop(0, "rgba(255,255,255,0.9)");
      r.addColorStop(0.6, "rgba(255,255,255,0.3)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 32, 32);
    },
    true,
  );
  return new THREE.MeshBasicMaterial({
    map: poolTexture,
    color: "#ffd9a0",
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const plates = new Map<string, THREE.MeshBasicMaterial>();
/**
 * A small sign plate: an arrow (`up`, `down`, `out`: forward) and a word, white on dark. One material per
 * text, so the atlas packs it once.
 */
function plateMaterial(text: string, arrow: "up" | "down" | "out" | null): THREE.MeshBasicMaterial {
  const key = `${arrow}:${text}`;
  let m = plates.get(key);
  if (m) return m;
  const W = 64;
  const H = 28;
  const tex = canvasTexture(W, H, (g) => {
    g.fillStyle = "#2b2433";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#4a4057";
    g.fillRect(1, 1, W - 2, H - 2);
    g.fillStyle = "#2b2433";
    g.fillRect(2, 2, W - 4, H - 4);
    g.fillStyle = "#fbf7ef";
    let left = 6;
    if (arrow) {
      g.beginPath();
      if (arrow === "up") {
        g.moveTo(8, 20);
        g.lineTo(14, 8);
        g.lineTo(20, 20);
      } else if (arrow === "down") {
        g.moveTo(8, 8);
        g.lineTo(14, 20);
        g.lineTo(20, 8);
      } else {
        g.moveTo(8, 8);
        g.lineTo(20, 14);
        g.lineTo(8, 20);
      }
      g.closePath();
      g.fill();
      left = 25;
    }
    g.font = "bold 12px ui-monospace, Menlo, monospace";
    g.textBaseline = "middle";
    g.fillText(text.slice(0, 6), left, H / 2 + 1);
  });
  m = glow("#fff", tex);
  plates.set(key, m);
  return m;
}

/** The plate on a wall: its centre at `at`, facing +z. */
export function exitPlate(m: Model, text: string, arrow: "up" | "down" | "out" | null, at: [number, number, number]): void {
  m.box([0.46, 0.2, 0.02], "#2b2433", [at[0], at[1] - 0.1, at[2] - 0.012], 0.004);
  m.plane(0.44, 0.19, plateMaterial(text, arrow), at);
}

/** A lamp over a lintel: the shade, the lit bulb and its pool on the floor in front. `at` is the shade's bottom centre. */
function lintelLamp(m: Model, at: [number, number, number], poolZ: number): void {
  m.box([0.34, 0.08, 0.2], C.metal, [at[0], at[1], at[2]], 0.01);
  m.box([0.26, 0.05, 0.14], glow("#ffe9b0"), [at[0], at[1] - 0.05, at[2] + 0.02], 0.004);
  const pool = m.plane(1.5, 1.1, poolMaterial(), [at[0], 0.045, poolZ]);
  pool.rotation.x = -Math.PI / 2;
  pool.receiveShadow = false;
}

export interface DoorwayOpts {
  /** The door opens on daylight (a way outside); else on a lamp-lit hall. */
  outside?: boolean;
  /** Draw the wall tile itself (tile-drawn rooms); a `Room` has a thin wall of its own. */
  block?: boolean;
  wall?: string;
  /** The leaf's wood, a shade lighter than the wall's trim so it stands out. */
  leaf?: string;
  /** The plate beside the door; null for none. */
  plate?: string | null;
}

/**
 * A door in a wall: standing on the wall tile, face at +z, the mat on the tile in front (z = 1). The leaf is ajar
 * into the room so the light beyond shows in the gap.
 */
export function exitDoorway(opts: DoorwayOpts = {}): Model {
  const m = new Model();
  const wall = opts.wall ?? C.wall;
  const trim = C.woodDark;
  const leafWood = opts.leaf ?? C.woodLight;
  if (opts.block) {
    m.box([1, 2.6, 1], wall, [0, 0, 0], 0);
    m.box([1.02, 0.1, 1.02], C.wallTop, [0, 2.6, 0], 0.01);
  }
  // The recess: dark returns round the opening, open at the back, and the light beyond as a plane facing the room
  // (daylight, or a hall with a lamp). An exit in the wall the camera cuts away is seen from behind: through the
  // open frame the leaf shows, so it is a door from either side.
  const dark = tint(wall, -0.45);
  for (const s of [-1, 1]) m.box([0.06, 2.08, 0.3], dark, [s * 0.42, 0, 0.36], 0.004);
  m.box([0.9, 0.06, 0.3], dark, [0, 2.02, 0.36], 0.004);
  const beyond = opts.outside ? "#bfe6ff" : "#fff1c9";
  m.plane(0.84, 2.02, glow(beyond), [0, 1.03, 0.5]);
  if (opts.outside) m.plane(0.84, 0.5, glow("#8fcff5"), [0, 1.74, 0.502]);
  // The frame through the wall: jambs, lintel, a step.
  for (const s of [-1, 1]) m.box([0.1, 2.12, 0.34], trim, [s * 0.47, 0, 0.38], 0.015);
  m.box([1.04, 0.12, 0.34], trim, [0, 2.12, 0.38], 0.015);
  m.box([0.94, 0.04, 0.2], tint(trim, -0.15), [0, 0, 0.5], 0.004);
  // The leaf, ajar on its left hinge into the room (not so far that it covers the threshold), panels and a brass handle.
  const leaf = m.part([-0.41, 0, 0.5], -0.5);
  leaf.box([0.8, 2.0, 0.05], leafWood, [0.4, 0.02, 0], 0.012);
  for (const y of [0.2, 1.12]) leaf.box([0.56, 0.72, 0.02], tint(leafWood, 0.1), [0.4, y, 0.03], 0.01);
  leaf.box([0.56, 0.03, 0.03], tint(leafWood, -0.25), [0.4, 0.98, 0.035], 0.004);
  leaf.ball(0.04, "#e9b73d", [0.7, 1.0, 0.06]);
  leaf.box([0.04, 0.16, 0.03], "#e9b73d", [0.7, 0.92, 0.05], 0.006);
  // The lamp over the lintel, the mat on the threshold, the plate beside.
  lintelLamp(m, [0, 2.32, 0.5], 1.0);
  m.box([0.84, 0.025, 0.56], C.rugLight, [0, 0, 1.0], 0.006);
  m.box([0.72, 0.03, 0.44], C.rug, [0, 0, 1.0], 0.006);
  if (opts.plate !== null) exitPlate(m, opts.plate ?? "EXIT", "out", [0.78, 1.82, 0.515]);
  return m;
}

export interface StairsOpts {
  /** Draw the wall tile behind the well (tile-drawn rooms). */
  block?: boolean;
  wall?: string;
  plate?: string | null;
}

/**
 * Stairs between rooms, standing on the tile their treads cover, the wall behind at -z. Up: the treads climb
 * toward a dark landing in the wall with a lamp over it. Down: the floor opens on a well, the treads fall
 * toward the wall and into the dark. Stringers each side, a handrail, an arrow plate on the wall.
 */
export function exitStairs(dir: "up" | "down", opts: StairsOpts = {}): Model {
  const m = new Model();
  const wall = opts.wall ?? C.wall;
  const wood = C.woodDark;
  const tread = "#be804e";
  const n = 5;
  if (opts.block) {
    m.box([1, 2.6, 1], wall, [0, 0, -1], 0);
    m.box([1.02, 0.1, 1.02], C.wallTop, [0, 2.6, -1], 0.01);
  }
  // The well in the wall: a dark plane facing the room (seen from behind, through the frame, the treads show),
  // with a lintel and jambs.
  m.plane(0.92, 2.1, glow("#1c1620"), [0, 1.05, -0.49]);
  for (const s of [-1, 1]) m.box([0.08, 2.14, 0.12], wood, [s * 0.47, 0, -0.44], 0.012);
  m.box([1.02, 0.1, 0.12], wood, [0, 2.14, -0.44], 0.012);
  if (dir === "up") {
    // Treads rising toward the wall; the landing beyond is lit.
    for (let i = 0; i < n; i++) {
      const h = 0.16 * (i + 1);
      const z = 0.4 - i * 0.2;
      m.box([0.84, h, 0.2], tint(tread, -0.18 + i * 0.03), [0, 0, z], 0.008);
      m.box([0.84, 0.025, 0.2], tint(tread, 0.12 + i * 0.03), [0, h, z], 0.004);
    }
    m.plane(0.84, 0.9, glow("#ffe0a0"), [0, 1.31, -0.47]);
    for (const s of [-1, 1]) {
      // A stringer that follows the rise, the newel post at the foot and the rail on it.
      const st = m.box([0.05, 0.14, 1.08], wood, [s * 0.44, 0.02, 0], 0.006);
      st.rotation.x = -0.66;
      st.position.y = 0.42;
      m.cyl(0.025, 0.95, wood, [s * 0.44, 0, 0.48], 0.025, 6);
      const rail = m.box([0.05, 0.05, 1.1], wood, [s * 0.44, 0, 0], 0.008);
      rail.rotation.x = -0.66;
      rail.position.y = 1.25;
    }
    lintelLamp(m, [0, 2.3, -0.42], 0.3);
  } else {
    // The well: the floor opens and the flight runs down through the wall. Inside the room only the top tread
    // and the dark opening show (the floor slab hides the rest); past the wall, where the camera cut it away, the
    // flight is seen going down and out, with its stringers and rails.
    m.box([0.92, 0.02, 1.0], "#14101a", [0, 0, 0], 0.003);
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const z = 0.36 - i * 0.22;
      const y = 0.02 - i * 0.15;
      m.box([0.84, 0.14, 0.22], tint(tread, -0.1 - i * 0.06), [0, y - 0.12, z], 0.004);
      m.box([0.84, 0.025, 0.22], tint(tread, 0.1 - i * 0.04), [0, y, z], 0.004);
    }
    for (const s of [-1, 1]) {
      // Low side walls round the opening, the newel posts, and the rail sloping down with the flight.
      m.box([0.06, 0.26, 1.0], tint(wall, -0.2), [s * 0.47, 0, 0], 0.008);
      m.cyl(0.025, 0.9, wood, [s * 0.47, 0.26, 0.46], 0.025, 6);
      const rail = m.box([0.05, 0.05, 1.7], wood, [s * 0.47, 0, 0], 0.008);
      rail.rotation.x = 0.6;
      rail.position.set(s * 0.47, 0.55, -0.35);
      const stringer = m.box([0.06, 0.16, 1.7], wood, [s * 0.47, 0, 0], 0.008);
      stringer.rotation.x = 0.6;
      stringer.position.set(s * 0.47, -0.55, -0.35);
    }
    m.plane(0.84, 0.6, glow("#6a5b8f"), [0, 0.32, -0.47]);
    lintelLamp(m, [0, 2.3, -0.42], 0.3);
  }
  if (opts.plate !== null)
    exitPlate(m, opts.plate ?? (dir === "up" ? "UP" : "DOWN"), dir, [0.8, 1.82, -0.345]);
  return m;
}

/** A plain toon colour, for callers that build on these. */
export const exitWallColour = (c: string): THREE.MeshToonMaterial => toon(c);
