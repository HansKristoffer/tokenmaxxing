/**
 * A tiny voxel sculptor for the pets: paint cells into a `Grid` (boxes, ellipsoids, curves), colour them by
 * position, then `bake` the lot into ONE mesh with the hidden faces culled, per-corner ambient occlusion, a
 * little face shading and a per-voxel colour jitter baked into vertex colours. A pet is a handful of such
 * meshes (body, head, legs, ears, tails), so it is cheap to draw, and being a plain BufferGeometry it is
 * left alone by the Voxel style's primitive swap (`blocky.ts`): it is already blocks.
 */
import * as THREE from "three";
import { toon, type V3 } from "../kit/kit.ts";

/** Voxel edge in world units (a character's blocks are about the same). */
export const VOX = 0.024;

export type Rgb = string;
/** A colour, or a function of the cell. */
export type Paint = Rgb | ((p: Cell) => Rgb | undefined);

export interface Cell {
  x: number;
  y: number;
  z: number;
  /** Across the part's length (0 at its low z, 1 at its high z), up its height, and out from its middle. */
  u: number;
  t: number;
  s: number;
  c: Rgb;
}

const key = (x: number, y: number, z: number) => ((x + 128) << 16) | ((y + 128) << 8) | (z + 128);

/** A repeatable hash in [0, 1). */
export function hash(x: number, y: number, z: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1) for blobs and patches. */
export function noise(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const f = (a: number) => a * a * (3 - 2 * a);
  const fx = f(x - xi);
  const fy = f(y - yi);
  const fz = f(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
    l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  );
}

const rgbCache = new Map<string, THREE.Color>();
export function color(c: string): THREE.Color {
  let r = rgbCache.get(c);
  if (!r) {
    r = new THREE.Color(c);
    rgbCache.set(c, r);
  }
  return r;
}

const mixScratch = new THREE.Color();

/** `a` mixed towards `b` by `k`. */
export function mix(a: string, b: string, k: number): string {
  return `#${mixScratch.copy(color(a)).lerp(color(b), k).getHexString(THREE.SRGBColorSpace)}`;
}
export const lighten = (c: string, k: number) => mix(c, "#ffffff", k);
export const darken = (c: string, k: number) => mix(c, "#0c0a12", k);

/** A sparse grid of coloured cells; cell (x, y, z) is the unit cube centred on those integers. */
export class Grid {
  readonly cells = new Map<number, Rgb>();

  set(x: number, y: number, z: number, c: Rgb): this {
    this.cells.set(key(Math.round(x), Math.round(y), Math.round(z)), c);
    return this;
  }
  get(x: number, y: number, z: number): Rgb | undefined {
    return this.cells.get(key(x, y, z));
  }
  has(x: number, y: number, z: number): boolean {
    return this.cells.has(key(x, y, z));
  }
  del(x: number, y: number, z: number): this {
    this.cells.delete(key(x, y, z));
    return this;
  }
  get size(): number {
    return this.cells.size;
  }

  /** Every cell as [x, y, z, colour]. */
  each(fn: (x: number, y: number, z: number, c: Rgb) => void): void {
    for (const [k, c] of this.cells) fn((k >> 16) - 128, ((k >> 8) & 255) - 128, (k & 255) - 128, c);
  }

  /** A solid box, corners inclusive. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: Paint): this {
    for (let x = Math.round(x0); x <= Math.round(x1); x++) {
      for (let y = Math.round(y0); y <= Math.round(y1); y++) {
        for (let z = Math.round(z0); z <= Math.round(z1); z++) this.fill(x, y, z, p);
      }
    }
    return this;
  }

  /** A (super)ellipsoid centred on (cx, cy, cz) with radii in cells; `p` 2 is round, more is boxier. */
  ell(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, p: Paint, pow = 2.4): this {
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
      for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
        for (let z = Math.ceil(cz - rz); z <= Math.floor(cz + rz); z++) {
          const d =
            Math.abs((x - cx) / rx) ** pow + Math.abs((y - cy) / ry) ** pow + Math.abs((z - cz) / rz) ** pow;
          // The 0.0001 keeps the cells on the surface in, against float error.
          if (d <= 1.0001) this.fill(x, y, z, p);
        }
      }
    }
    return this;
  }

  /** A tube of ellipsoids along a polyline, radius easing from `r0` to `r1`; `p` is given t along it in `u`. */
  tube(pts: V3[], r0: number, r1: number, p: Paint, pow = 2.2): this {
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const step = pts[i]!.map((v, j) => v - pts[i - 1]![j]!);
      total += Math.hypot(...step);
    }
    const n = Math.max(2, Math.ceil(total * 2));
    for (let i = 0; i <= n; i++) {
      const f = (i / n) * (pts.length - 1);
      const a = pts[Math.min(pts.length - 2, Math.floor(f))]!;
      const b = pts[Math.min(pts.length - 1, Math.floor(f) + 1)]!;
      const k = f - Math.floor(f);
      const r = r0 + (r1 - r0) * (i / n);
      const t = i / n;
      const at = (j: number) => a[j]! + (b[j]! - a[j]!) * k;
      this.ell(at(0), at(1), at(2), r, r, r, typeof p === "string" ? p : (c) => p({ ...c, u: t }), pow);
    }
    return this;
  }

  private fill(x: number, y: number, z: number, p: Paint): void {
    if (typeof p === "string") {
      this.cells.set(key(x, y, z), p);
      return;
    }
    const c = p({ x, y, z, u: 0, t: 0, s: 0, c: this.get(x, y, z) ?? "#ff00ff" });
    if (c) this.cells.set(key(x, y, z), c);
  }

  bounds(): { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } {
    let x0 = 1e9;
    let y0 = 1e9;
    let z0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    let z1 = -1e9;
    this.each((x, y, z) => {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    });
    return { x0, x1, y0, y1, z0, z1 };
  }

  /** Recolours every cell by position: `u` along z, `t` up y, `s` out from x = 0 (all 0 to 1, s signed). */
  paint(fn: (c: Cell) => Rgb | undefined): this {
    const b = this.bounds();
    const du = Math.max(1, b.z1 - b.z0);
    const dt = Math.max(1, b.y1 - b.y0);
    const ds = Math.max(1, Math.max(Math.abs(b.x0), Math.abs(b.x1)));
    for (const [k, c] of this.cells) {
      const x = (k >> 16) - 128;
      const y = ((k >> 8) & 255) - 128;
      const z = (k & 255) - 128;
      const n = fn({ x, y, z, u: (z - b.z0) / du, t: (y - b.y0) / dt, s: x / ds, c });
      if (n) this.cells.set(k, n);
    }
    return this;
  }

  /** The highest z of the column at (x, y), or undefined. */
  front(x: number, y: number): number | undefined {
    let best: number | undefined;
    this.each((cx, cy, cz) => {
      if (cx === x && cy === y && (best === undefined || cz > best)) best = cz;
    });
    return best;
  }
  /** The highest y of the column at (x, z). */
  top(x: number, z: number): number | undefined {
    let best: number | undefined;
    this.each((cx, cy, cz) => {
      if (cx === x && cz === z && (best === undefined || cy > best)) best = cy;
    });
    return best;
  }

  /** Grows a fuzz of extra cells off the surface (not downwards), copying (and varying) the colour beneath. */
  fluff(
    prob: number,
    seed = 1,
    light = 0.06,
    dirs: V3[] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ],
  ): this {
    const add: [number, V3, Rgb][] = [];
    this.each((x, y, z, c) => {
      for (const d of dirs) {
        const nx = x + d[0];
        const ny = y + d[1];
        const nz = z + d[2];
        if (this.has(nx, ny, nz)) continue;
        if (hash(nx, ny, nz, seed) >= prob) continue;

        const tone = hash(x, y, z, seed + 7) < 0.5 ? lighten(c, light) : c;
        add.push([key(nx, ny, nz), [nx, ny, nz], tone]);
      }
    });
    for (const [k, , c] of add) if (!this.cells.has(k)) this.cells.set(k, c);
    return this;
  }

  merge(o: Grid, dx = 0, dy = 0, dz = 0): this {
    o.each((x, y, z, c) => {
      this.set(x + dx, y + dy, z + dz, c);
    });
    return this;
  }

  /** A copy flipped across x = 0. */
  mirrored(): Grid {
    const g = new Grid();
    this.each((x, y, z, c) => {
      g.set(-x, y, z, c);
    });
    return g;
  }

  /** A copy moved. */
  shifted(dx: number, dy: number, dz: number): Grid {
    return new Grid().merge(this, dx, dy, dz);
  }

  /** Both x and -x for every cell with x > 0 already set (a half-sculpt made whole). */
  symmetric(): this {
    this.each((x, y, z, c) => {
      if (x > 0 && !this.has(-x, y, z)) this.set(-x, y, z, c);
    });
    return this;
  }
}

/** `Grid.box` with its corners in either order, for a mirrored limb whose x range runs backwards. */
export const slab = (
  g: Grid,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  p: string,
) =>
  g.box(
    Math.min(x0, x1),
    Math.max(x0, x1),
    Math.min(y0, y1),
    Math.max(y0, y1),
    Math.min(z0, z1),
    Math.max(z0, z1),
    p,
  );

// MARK: Baking

const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], w: [0, 0, 1], shade: 0.9 },
  { n: [-1, 0, 0], u: [0, 0, 1], w: [0, 1, 0], shade: 0.84 },
  { n: [0, 1, 0], u: [0, 0, 1], w: [1, 0, 0], shade: 1.07 },
  { n: [0, -1, 0], u: [1, 0, 0], w: [0, 0, 1], shade: 0.68 },
  { n: [0, 0, 1], u: [1, 0, 0], w: [0, 1, 0], shade: 0.98 },
  { n: [0, 0, -1], u: [0, 1, 0], w: [1, 0, 0], shade: 0.78 },
] as const;
// Occlusion at a corner by how many of its three neighbours are solid: 0 open (1), 3 closed in (0.66).
const AO = [0.66, 0.8, 0.92, 1];

let vertexToon: THREE.MeshToonMaterial | undefined;
const glassToons = new Map<number, THREE.MeshToonMaterial>();
let litBasic: THREE.MeshBasicMaterial | undefined;

function bodyMaterial(opacity: number): THREE.MeshToonMaterial {
  if (!vertexToon) {
    vertexToon = toon("#ffffff").clone();
    vertexToon.vertexColors = true;
  }
  if (opacity >= 1) return vertexToon;
  let g = glassToons.get(opacity);
  if (!g) {
    g = vertexToon.clone();
    g.transparent = true;
    g.opacity = opacity;
    g.depthWrite = false;
    g.userData.shared = true;
    glassToons.set(opacity, g);
  }
  return g;
}

export interface BakeOpts {
  /** Where the mesh's origin sits, in cells (its position is then the pivot). */
  origin?: V3;
  /** Varies the colour jitter between parts. */
  seed?: number;
  /** Below 1: see-through (ghosts). */
  opacity?: number;
  /** How much a voxel's colour varies (0.045 default). */
  jitter?: number;
  /** Skip the baked occlusion and face shading (for glints, flames). */
  flat?: boolean;
}

// Entries live only while meshes own them; identical legs, eyes and pets share immutable buffers.
const surfaces = new Map<string, { solid: THREE.BufferGeometry; lit?: THREE.BufferGeometry; refs: number }>();

const CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** Cells whose colour starts with "*" glow (unlit); everything else is shaded. */
export function bake(g: Grid, o: BakeOpts = {}): THREE.Mesh {
  const [ox, oy, oz] = o.origin ?? [0, 0, 0];
  const seed = o.seed ?? 0;
  const jit = o.jitter ?? 0.045;
  const flat = o.flat ?? false;
  const cells = g.cells;
  let cacheKey = `${ox},${oy},${oz},${seed},${jit},${flat ? 1 : 0},${cells.size}`;
  for (const [ck, cc] of cells) cacheKey += `|${ck}:${cc}`;
  const cached = surfaces.get(cacheKey);
  if (cached) return ownSurface(cacheKey, cached, o.opacity ?? 1);
  const solid = { p: [] as number[], c: [] as number[], n: [] as number[], i: [] as number[] };
  const lit = { p: [] as number[], c: [] as number[], n: [] as number[], i: [] as number[] };
  const aoVals = [1, 1, 1, 1];
  for (const [ck, raw] of cells) {
    const x = (ck >> 16) - 128;
    const y = ((ck >> 8) & 255) - 128;
    const z = (ck & 255) - 128;
    const glow = raw.charCodeAt(0) === 42; // '*'
    const base = color(glow ? raw.slice(1) : raw);
    const br = base.r;
    const bg = base.g;
    const bb = base.b;
    const out = glow ? lit : solid;
    const vj = hash(x, y, z, seed + 3) * 2 - 1;
    const unlit = glow || flat;
    for (let fi = 0; fi < FACES.length; fi++) {
      const f = FACES[fi]!;
      const nx = f.n[0];
      const ny = f.n[1];
      const nz = f.n[2];
      const bx = x + nx;
      const by = y + ny;
      const bz = z + nz;
      if (cells.has(key(bx, by, bz))) continue;
      const fj = hash(x, y, z, seed + 11 + nx * 2 + ny * 3 + nz * 5) * 2 - 1;
      // The face's shade, then the colour jitter: 65% from the voxel and 35% from the face.
      const k = (unlit ? 1 : f.shade) * (1 + jit * (0.65 * vj + 0.35 * fj));
      const ux = f.u[0];
      const uy = f.u[1];
      const uz = f.u[2];
      const wx = f.w[0];
      const wy = f.w[1];
      const wz = f.w[2];
      if (unlit) {
        aoVals[0] = aoVals[1] = aoVals[2] = aoVals[3] = 1;
      } else {
        for (let ci = 0; ci < 4; ci++) {
          const su = CORNERS[ci]![0];
          const sw = CORNERS[ci]![1];
          const side1 = cells.has(key(bx + su * ux, by + su * uy, bz + su * uz)) ? 1 : 0;
          const side2 = cells.has(key(bx + sw * wx, by + sw * wy, bz + sw * wz)) ? 1 : 0;
          if (side1 && side2) {
            aoVals[ci] = AO[0]!;
          } else {
            const diagonal = cells.has(
              key(bx + su * ux + sw * wx, by + su * uy + sw * wy, bz + su * uz + sw * wz),
            )
              ? 1
              : 0;
            aoVals[ci] = AO[3 - (side1 + side2 + diagonal)]!;
          }
        }
      }
      const first = out.p.length / 3;
      // Split the quad along the diagonal that keeps the occlusion gradient smooth.
      if (aoVals[0]! + aoVals[2]! < aoVals[1]! + aoVals[3]!) {
        out.i.push(first + 1, first + 2, first + 3, first + 1, first + 3, first);
      } else {
        out.i.push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
      const cx0 = x - ox + 0.5 * nx;
      const cy0 = y - oy + 0.5 * ny;
      const cz0 = z - oz + 0.5 * nz;
      for (let ci = 0; ci < 4; ci++) {
        const su = CORNERS[ci]![0];
        const sw = CORNERS[ci]![1];
        out.p.push(
          (cx0 + 0.5 * (su * ux + sw * wx)) * VOX,
          (cy0 + 0.5 * (su * uy + sw * wy)) * VOX,
          (cz0 + 0.5 * (su * uz + sw * wz)) * VOX,
        );
        out.n.push(nx, ny, nz);
        const s = k * aoVals[ci]!;
        out.c.push(br * s, bg * s, bb * s);
      }
    }
  }
  const geo = (d: typeof solid) => {
    const bg = new THREE.BufferGeometry();
    bg.setIndex(d.i);
    bg.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
    bg.setAttribute("normal", new THREE.Float32BufferAttribute(d.n, 3));
    bg.setAttribute("color", new THREE.Float32BufferAttribute(d.c, 3));
    return bg;
  };
  const surface = { solid: geo(solid), lit: lit.p.length ? geo(lit) : undefined, refs: 0 };
  surface.solid.userData.shared = true;
  if (surface.lit) surface.lit.userData.shared = true;
  surfaces.set(cacheKey, surface);
  return ownSurface(cacheKey, surface, o.opacity ?? 1);
}

function ownSurface(
  cacheKey: string,
  surface: { solid: THREE.BufferGeometry; lit?: THREE.BufferGeometry; refs: number },
  opacity: number,
): THREE.Mesh {
  surface.refs++;
  const mesh = new THREE.Mesh(surface.solid, bodyMaterial(opacity));
  mesh.castShadow = mesh.receiveShadow = true;
  if (surface.lit) {
    litBasic ??= new THREE.MeshBasicMaterial({ vertexColors: true });
    litBasic.userData.shared = true;
    const l = new THREE.Mesh(surface.lit, litBasic);
    l.castShadow = false;
    mesh.add(l);
  }
  mesh.userData.onDispose = () => {
    if (--surface.refs > 0) return;
    surfaces.delete(cacheKey);
    surface.solid.dispose();
    surface.lit?.dispose();
  };
  return mesh;
}

/** The world position of a cell's centre for a mesh baked with `origin`. */
export const at = (x: number, y: number, z: number): V3 => [x * VOX, y * VOX, z * VOX];

/** What a builder hands back: the moving parts and where gear goes. */
export interface Rig {
  head: THREE.Group;
  /** Squashed shut when asleep. */
  eyes: THREE.Mesh[];
  fore: THREE.Mesh[];
  hind: THREE.Mesh[];
  tails: THREE.Object3D[];
  /** Gear anchors, in the head's own space: the neck's middle (and its radius) and the top of the head. */
  neck: V3;
  neckR: number;
  top: V3;
  /** Quadrupeds sit back on their haunches; the rest just settle. */
  tilt: boolean;
  /** How much its fore legs stretch to reach the ground when it sits back (about 0.6 x zF / leg height). */
  sitStretch?: number;
  /** Hover height for the ones that float. */
  float?: number;
  /** Hip-to-nose length, to centre the pet on its tile. */
  span: number;
  /** Own animation (flames, fins, props). */
  fx?: (t: number, moving: boolean) => void;
}

/** A small eye mesh from rows of colours (top row first, "" is empty); pivots on its middle so it squashes shut. */
export function eye(rows: string[][]): THREE.Mesh {
  const g = new Grid();
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, j) => {
    row.forEach((c, i) => {
      if (c) g.set(i, h - 1 - j, 0, c);
    });
  });
  const m = bake(g, { origin: [(w - 1) / 2, (h - 1) / 2, 0], flat: true, jitter: 0 });
  m.scale.z = 0.4;
  m.userData.sy = 1;
  m.castShadow = false;
  return m;
}
