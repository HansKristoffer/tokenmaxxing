/**
 * A vertex-coloured box batch: thousands of blocks (floors, windows, lattice beams, stairs, trees) go into
 * a few typed arrays and become ONE mesh per material, so a whole megacity renders as a handful of draw calls.
 * Lit batches use a toon material that shares kit.ts's band texture (so Voxel (Plethora) mode's smooth
 * ramp applies); glow batches are unlit (windows, neon).
 */
import * as THREE from "three";
import { toon } from "../kit.ts";

export type V3 = [number, number, number];

const colourCache = new Map<string, THREE.Color>();
export function rgb(c: string): THREE.Color {
  let v = colourCache.get(c);
  if (!v) {
    v = new THREE.Color(c);
    colourCache.set(c, v);
  }
  return v;
}

class Grow {
  a = new Float32Array(1 << 16);
  n = 0;
  push(...v: number[]): void {
    if (this.n + v.length > this.a.length) {
      const b = new Float32Array(this.a.length * 2);
      b.set(this.a);
      this.a = b;
    }
    for (const x of v) this.a[this.n++] = x;
  }
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const FACES: { n: V3; c: V3[] }[] = [
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];

export class Batch {
  private pos = new Grow();
  private nor = new Grow();
  private col = new Grow();
  private idx: number[] = [];
  private verts = 0;
  /** Per-box colour jitter, for a hand-painted look. */
  jitter = 0.035;
  private seed = 1;
  count = 0;

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** An axis-aligned box: x/z are the centre, y the bottom. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, colour: string, gain = 1): void {
    this.raw(x, y + h / 2, z, w, h, d, 0, 0, 0, colour, gain);
  }

  /** A box turned by Euler angles about its centre (x, y, z are the centre). */
  tilted(x: number, y: number, z: number, w: number, h: number, d: number, rx: number, ry: number, rz: number, colour: string, gain = 1): void {
    this.raw(x, y, z, w, h, d, rx, ry, rz, colour, gain);
  }

  /** A square-section beam from `a` to `b`, `t` thick. */
  beam(a: V3, b: V3, t: number, colour: string, gain = 1): void {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    v.set(dx / len, dy / len, dz / len);
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v);
    this.rawQ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, t, t, len, q, colour, gain);
  }

  private raw(x: number, y: number, z: number, w: number, h: number, d: number, rx: number, ry: number, rz: number, colour: string, gain: number): void {
    e.set(rx, ry, rz, "YXZ");
    q.setFromEuler(e);
    this.rawQ(x, y, z, w, h, d, q, colour, gain);
  }

  private rawQ(x: number, y: number, z: number, w: number, h: number, d: number, quat: THREE.Quaternion, colour: string, gain: number): void {
    const c = rgb(colour);
    const j = 1 + (this.rand() - 0.5) * 2 * this.jitter;
    const r = c.r * j * gain;
    const g = c.g * j * gain;
    const b = c.b * j * gain;
    m4.compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(w / 2, h / 2, d / 2));
    const el = m4.elements;
    const identity = quat.x === 0 && quat.y === 0 && quat.z === 0;
    for (const f of FACES) {
      let nx = f.n[0];
      let ny = f.n[1];
      let nz = f.n[2];
      if (!identity) {
        v.set(nx, ny, nz).applyQuaternion(quat);
        nx = v.x;
        ny = v.y;
        nz = v.z;
      }
      for (const cc of f.c) {
        this.pos.push(
          el[0]! * cc[0] + el[4]! * cc[1] + el[8]! * cc[2] + el[12]!,
          el[1]! * cc[0] + el[5]! * cc[1] + el[9]! * cc[2] + el[13]!,
          el[2]! * cc[0] + el[6]! * cc[1] + el[10]! * cc[2] + el[14]!,
        );
        this.nor.push(nx, ny, nz);
        this.col.push(r, g, b);
      }
      const o = this.verts;
      this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      this.verts += 4;
    }
    this.count++;
  }

  /** Bake into one mesh. `glow` = unlit; `opacity` < 1 makes it see-through (glass, holograms). */
  build(opts: { glow?: boolean; opacity?: number; additive?: boolean; shadows?: boolean } = {}): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos.a.slice(0, this.pos.n), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nor.a.slice(0, this.nor.n), 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col.a.slice(0, this.col.n), 3));
    g.setIndex(this.verts > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    let mat: THREE.Material;
    if (opts.glow) {
      mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    } else {
      const base = toon("#ffffff");
      mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: base.gradientMap });
    }
    if (opts.opacity !== undefined || opts.additive) {
      mat.transparent = true;
      (mat as THREE.MeshBasicMaterial).opacity = opts.opacity ?? 1;
      mat.depthWrite = false;
      if (opts.additive) mat.blending = THREE.AdditiveBlending;
    }
    const mesh = new THREE.Mesh(g, mat);
    const solid = !opts.glow && opts.opacity === undefined;
    mesh.castShadow = opts.shadows ?? solid;
    mesh.receiveShadow = solid;
    mesh.userData.noBlock = true;
    return mesh;
  }
}
