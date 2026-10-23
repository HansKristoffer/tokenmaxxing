/**
 * The modelling kit: every 3D asset is built in code from rounded boxes, cylinders and balls, shaded
 * with a few flat bands (toon), the way the 2D sprites are drawn from string grids. Textures (planks,
 * wallpaper, screens) are painted on small canvases and sampled without smoothing, so they stay pixel art.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type V3 = [number, number, number];
export type Paint = string | THREE.Material;

/** Three flat light bands: shadow, mid, lit. */
const BANDS = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 175, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

/**
 * Voxel (Plethora) style: the same bands become a smooth ramp, so every toon material shades like soft matte
 * diffuse paint. All toon materials share this one texture, so swapping its data swaps them all (and back).
 */
let smoothBands = false;
export function setSmoothBands(on: boolean): void {
  if (on === smoothBands) return;
  smoothBands = on;
  const n = on ? 128 : 3;
  const data = new Uint8Array(n);
  if (on) {
    for (let i = 0; i < n; i++) {
      const dotNL = (i / (n - 1)) * 2 - 1;
      data[i] = Math.round(255 * Math.min(1, Math.max(0, dotNL * 0.9 + 0.1)));
    }
  } else data.set([105, 175, 255]);
  BANDS.dispose();
  BANDS.image = { data, width: n, height: 1 };
  BANDS.minFilter = BANDS.magFilter = on ? THREE.LinearFilter : THREE.NearestFilter;
  BANDS.needsUpdate = true;
}

const toons = new Map<string, THREE.MeshToonMaterial>();
/** The one material most things use: a colour, lit in bands. */
export function toon(color: string): THREE.MeshToonMaterial {
  let m = toons.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: BANDS });
    toons.set(color, m);
  }
  return m;
}

/** Lit from inside: screens, lamps, neon. Ignores the lights. */
export function glow(color: string, map?: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: map ? "#ffffff" : color, map: map ?? null });
}

export function glass(color: string, opacity = 0.45): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: BANDS,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

/** A toon material with a painted texture. */
export function painted(map: THREE.Texture, color = "#ffffff"): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, map, gradientMap: BANDS });
}

const asMaterial = (p: Paint) => (typeof p === "string" ? toon(p) : p);

const geometries = new Map<string, THREE.BufferGeometry>();
function geometry(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

/** A group with shortcuts for the shapes assets are made of. Positions are bottom-centres unless noted. */
export class Model extends THREE.Group {
  protected put(mesh: THREE.Mesh, at: V3): THREE.Mesh {
    mesh.position.set(...at);
    mesh.castShadow = mesh.receiveShadow = true;
    this.add(mesh);
    return mesh;
  }

  /** A box with rounded edges, its bottom centre at `at`. */
  box(size: V3, paint: Paint, at: V3 = [0, 0, 0], r = 0.025): THREE.Mesh {
    const [w, h, d] = size;
    const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const g = geometry(`box${w},${h},${d},${radius}`, () => {
      const b = radius > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d);
      b.translate(0, h / 2, 0);
      return b;
    });
    return this.put(new THREE.Mesh(g, asMaterial(paint)), at);
  }

  /** A cylinder (or a cone, with `top`), its bottom centre at `at`. */
  cyl(radius: number, h: number, paint: Paint, at: V3 = [0, 0, 0], top = radius, seg = 14): THREE.Mesh {
    const g = geometry(`cyl${radius},${h},${top},${seg}`, () => {
      const c = new THREE.CylinderGeometry(top, radius, h, seg);
      c.translate(0, h / 2, 0);
      return c;
    });
    return this.put(new THREE.Mesh(g, asMaterial(paint)), at);
  }

  /** A ball, its centre at `at`, squashed by `scale`. */
  ball(radius: number, paint: Paint, at: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], seg = 14): THREE.Mesh {
    const g = geometry(
      `ball${radius},${seg}`,
      () => new THREE.SphereGeometry(radius, seg, Math.round(seg * 0.75)),
    );
    const m = this.put(new THREE.Mesh(g, asMaterial(paint)), at);
    m.scale.set(...scale);
    return m;
  }

  /** A flat picture facing +z, its centre at `at`. */
  plane(w: number, h: number, paint: Paint, at: V3 = [0, 0, 0]): THREE.Mesh {
    const g = geometry(`plane${w},${h}`, () => new THREE.PlaneGeometry(w, h));
    const m = this.put(new THREE.Mesh(g, asMaterial(paint)), at);
    m.castShadow = false;
    return m;
  }

  /** A child model at `at`, turned `turn` radians about y. */
  part(at: V3 = [0, 0, 0], turn = 0): Model {
    const m = new Model();
    m.position.set(...at);
    m.rotation.y = turn;
    this.add(m);
    return m;
  }
}

/** A canvas texture, painted once, sampled as pixels (or smoothly, for the big HD surfaces). */
export function canvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
  smooth = false,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (smooth) {
    t.anisotropy = 8;
    return t;
  }
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

/** A small deterministic noise, so painted textures look the same every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Moves `#rrggbb` towards white (`f` > 0) or black (`f` < 0). */
export function tint(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(f > 0 ? "#ffffff" : "#000000"), Math.abs(f));
  return `#${c.getHexString()}`;
}

/** Wood planks, one tile per 16 texels. */
export function planks(base: string, seed = 1): THREE.CanvasTexture {
  const rnd = seeded(seed);
  const t = canvasTexture(64, 64, (g) => {
    for (let row = 0; row < 8; row++) {
      let x = -Math.floor(rnd() * 24);
      while (x < 64) {
        const len = 18 + Math.floor(rnd() * 22);
        g.fillStyle = tint(base, (rnd() - 0.5) * 0.12);
        g.fillRect(x, row * 8, len, 8);
        g.fillStyle = tint(base, -0.08);
        for (let i = 0; i < 3; i++)
          g.fillRect(x + 2 + Math.floor(rnd() * (len - 4)), row * 8 + 2 + Math.floor(rnd() * 4), 3, 1);
        g.fillStyle = tint(base, -0.28);
        g.fillRect(x, row * 8, 1, 8);
        x += len;
      }
      g.fillStyle = tint(base, -0.22);
      g.fillRect(0, row * 8 + 7, 64, 1);
      g.fillStyle = tint(base, 0.1);
      g.fillRect(0, row * 8, 64, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Striped wallpaper with a dado rail, one tile wide per 16 texels. */
export function wallpaper(base: string, stripe: string): THREE.CanvasTexture {
  const t = canvasTexture(16, 48, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 16, 48);
    g.fillStyle = stripe;
    g.fillRect(3, 0, 2, 30);
    g.fillRect(11, 0, 2, 30);
    g.fillStyle = tint(stripe, -0.1);
    g.fillRect(0, 30, 16, 2);
    g.fillStyle = tint(base, -0.06);
    g.fillRect(0, 32, 16, 16);
    g.fillStyle = tint(base, -0.14);
    for (let x = 0; x < 16; x += 4) g.fillRect(x, 32, 1, 16);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** A checker of two colours, `n`×`n` squares over the texture. */
export function checker(a: string, b: string, n = 4): THREE.CanvasTexture {
  const t = canvasTexture(n * 4, n * 4, (g) => {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? a : b;
        g.fillRect(x * 4, y * 4, 4, 4);
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Something that moves on its own: a screen scrolling code, a fish swimming. */
export type Tick = (t: number) => void;
export const ticks: Tick[] = [];

const CODE_COLOURS = ["#ff7ab6", "#8fe3ff", "#ffe28a", "#a5d977", "#c9b6ff", "#e4f5fd"];
/** A monitor showing an agent writing code, scrolling a line at a time. */
export function codeScreen(seed: number, bg = "#1b1f2a"): THREE.CanvasTexture {
  const rnd = seeded(seed);
  const lines = Array.from({ length: 24 }, () => {
    const indent = Math.floor(rnd() * 4) * 2;
    const words = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({
      w: 2 + Math.floor(rnd() * 6),
      c: CODE_COLOURS[Math.floor(rnd() * CODE_COLOURS.length)]!,
    }));
    return { indent, words };
  });
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 20;
  const g = canvas.getContext("2d")!;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  let shown = -1;
  const speed = 2 + rnd() * 3;
  const draw = (top: number) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 32, 20);
    for (let i = 0; i < 6; i++) {
      const line = lines[(top + i) % lines.length]!;
      let x = 2 + line.indent;
      for (const w of line.words) {
        g.fillStyle = w.c;
        g.fillRect(x, 2 + i * 3, w.w, 1);
        x += w.w + 1;
      }
    }
    g.fillStyle = "#3ddc84";
    g.fillRect(2, 18, 6, 1);
    t.needsUpdate = true;
  };
  draw(0);
  ticks.push((time) => {
    const top = Math.floor(time * speed);
    if (top === shown) return;
    shown = top;
    draw(top);
  });
  return t;
}
