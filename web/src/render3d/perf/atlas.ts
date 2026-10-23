import * as THREE from "three";

/**
 * Small painted textures (a sign, a price tag, a poster: 16 to 256 px, sampled without smoothing) folded into one
 * atlas per batch, so a room's textured props merge into one draw call per material setup instead of one per picture.
 * Only what is exact is folded: nearest-filtered, unrepeated, unrotated canvases whose UVs stay inside 0..1; a
 * texture that repaints often (a screen) is left alone (`userData.animated`).
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
  rects: Map<THREE.Texture, Rect>;
  /** The version each member had when it was painted in, to notice a repaint. */
  seen: Map<THREE.Texture, number>;
  repaints: number;
}

const MAX_EDGE = 256;
const MAX_ATLAS = 2048;

interface Canvasish {
  width: number;
  height: number;
  getContext?: unknown;
}

export function atlasable(t: THREE.Texture | null | undefined): t is THREE.Texture {
  if (!t || !t.isTexture || t.userData.animated || (t as unknown as { isVideoTexture?: boolean }).isVideoTexture) return false;
  const img = t.image as Canvasish | null;
  if (!img || typeof img.getContext !== "function" || !(img.width > 0) || !(img.height > 0)) return false;
  if (img.width > MAX_EDGE || img.height > MAX_EDGE) return false;
  return (
    t.magFilter === THREE.NearestFilter &&
    t.minFilter === THREE.NearestFilter &&
    !t.generateMipmaps &&
    t.colorSpace === THREE.SRGBColorSpace &&
    t.flipY &&
    t.offset.x === 0 &&
    t.offset.y === 0 &&
    t.repeat.x === 1 &&
    t.repeat.y === 1 &&
    t.rotation === 0
  );
}

const uvBounds = new WeakMap<THREE.BufferGeometry, boolean>();
/** Whether a geometry's UVs stay inside the picture (a tiled floor does not: it needs the texture's own wrap). */
export function uvInside(g: THREE.BufferGeometry): boolean {
  let ok = uvBounds.get(g);
  if (ok === undefined) {
    const uv = g.getAttribute("uv");
    ok = !!uv;
    if (uv)
      for (let i = 0; i < uv.count && ok; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) ok = false;
      }
    uvBounds.set(g, ok);
  }
  return ok;
}

/** Packs the textures in shelves, largest first; returns null when fewer than two fit (nothing to gain). */
export function packAtlas(textures: THREE.Texture[]): Atlas | null {
  const list = [...new Set(textures)].sort((a, b) => (b.image as Canvasish).height - (a.image as Canvasish).height);
  if (list.length < 2) return null;
  let side = 128;
  const total = list.reduce((n, t) => n + ((t.image as Canvasish).width + 1) * ((t.image as Canvasish).height + 1), 0);
  while (side * side < total * 1.25 && side < MAX_ATLAS) side *= 2;
  const rects = new Map<THREE.Texture, Rect>();
  for (;; side *= 2) {
    rects.clear();
    let x = 0;
    let y = 0;
    let row = 0;
    let fit = true;
    for (const t of list) {
      const { width: w, height: h } = t.image as Canvasish;
      if (x + w > side) {
        x = 0;
        y += row + 1;
        row = 0;
      }
      if (y + h > side) {
        fit = false;
        break;
      }
      rects.set(t, { x, y, w, h });
      x += w + 1;
      row = Math.max(row, h);
    }
    // Whatever does not fit in the biggest atlas keeps its own texture.
    if (fit || side >= MAX_ATLAS) break;
  }
  if (rects.size < 2) return null;
  let h = 1;
  for (const r of rects.values()) h = Math.max(h, r.y + r.h);
  const height = Math.min(side, 2 ** Math.ceil(Math.log2(h)));
  const width = side;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d")!;
  const seen = new Map<THREE.Texture, number>();
  for (const [t, r] of rects) {
    g.drawImage(t.image as CanvasImageSource, r.x, r.y);
    seen.set(t, t.version);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return { texture, width, height, rects, seen, repaints: 0 };
}

/** The atlas version of a picture's UVs, exact: nearest sampling lands on the same texel. */
export function remapUv(g: THREE.BufferGeometry, r: Rect, atlas: Atlas): void {
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const e = 0.001;
  for (let i = 0; i < uv.count; i++) {
    const px = Math.min(r.w - e, Math.max(e, uv.getX(i) * r.w));
    const py = Math.min(r.h - e, Math.max(e, (1 - uv.getY(i)) * r.h));
    uv.setXY(i, (r.x + px) / atlas.width, 1 - (r.y + py) / atlas.height);
  }
  uv.needsUpdate = true;
}

/** Paints in whatever a member texture repainted since; returns how many did. */
export function syncAtlas(a: Atlas): number {
  let n = 0;
  let g: CanvasRenderingContext2D | null = null;
  for (const [t, r] of a.rects) {
    if (a.seen.get(t) === t.version) continue;
    a.seen.set(t, t.version);
    g ??= (a.texture.image as HTMLCanvasElement).getContext("2d")!;
    g.clearRect(r.x, r.y, r.w, r.h);
    g.drawImage(t.image as CanvasImageSource, r.x, r.y);
    n++;
  }
  if (n) {
    a.texture.needsUpdate = true;
    a.repaints += n;
  }
  return n;
}
