import * as THREE from "three";

/**
 * Small painted textures (a sign, a price tag, a poster: 16 to 256 px, sampled without smoothing) folded into one
 * atlas per batch, so a room's textured props merge into one draw call per material setup instead of one per
 * picture. Close-ups keep nearest sampling; independently painted mip levels smooth distant pictures without
 * bleeding. Only unrepeated, unrotated canvases whose UVs stay inside 0..1 are folded. A texture that repaints
 * often (a screen) is left alone (`userData.animated`).
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
  smooth?: boolean;
  align: number;
}

const MAX_EDGE = 256;
const MAX_ATLAS = 2048;
const MIP_LEVELS = 4;
const SMOOTH_MIP_LEVELS = 3;
// Sampling within each mip needs slots aligned through the smallest level.
const ALIGNMENT = 2 ** (MIP_LEVELS - 1);
const SMOOTH_ALIGNMENT = 2 ** (SMOOTH_MIP_LEVELS - 1);
const PADDING = 1;
const alignTo = (n: number, align: number): number => Math.ceil(n / align) * align;

interface Canvasish {
  width: number;
  height: number;
  getContext?: unknown;
}

function atlasableCommon(t: THREE.Texture | null | undefined): t is THREE.Texture {
  const isVideo = (t as unknown as { isVideoTexture?: boolean } | null | undefined)?.isVideoTexture;
  if (!t?.isTexture || t.userData.animated || isVideo) return false;
  const img = t.image as Canvasish | null;
  if (!img || typeof img.getContext !== "function" || !(img.width > 0) || !(img.height > 0)) return false;
  if (img.width > MAX_EDGE || img.height > MAX_EDGE) return false;
  return (
    t.colorSpace === THREE.SRGBColorSpace &&
    t.flipY &&
    t.offset.x === 0 &&
    t.offset.y === 0 &&
    t.repeat.x === 1 &&
    t.repeat.y === 1 &&
    t.rotation === 0
  );
}

export function atlasable(t: THREE.Texture | null | undefined): t is THREE.Texture {
  return (
    atlasableCommon(t) &&
    t.magFilter === THREE.NearestFilter &&
    t.minFilter === THREE.NearestFilter &&
    !t.generateMipmaps
  );
}

/**
 * Small smooth canvas textures (shop price tags, labels, placards): packed into a separate linear-filtered atlas.
 */
export function atlasableSmooth(t: THREE.Texture | null | undefined): t is THREE.Texture {
  return (
    atlasableCommon(t) &&
    !t.userData.pixelSurface &&
    t.magFilter === THREE.LinearFilter &&
    t.minFilter === THREE.LinearMipmapLinearFilter &&
    t.generateMipmaps
  );
}

const uvBounds = new WeakMap<THREE.BufferGeometry, boolean>();
/**
 * Whether a geometry's UVs stay inside the picture (a tiled floor does not: it needs the texture's own wrap).
 */
export function uvInside(g: THREE.BufferGeometry): boolean {
  let ok = uvBounds.get(g);
  if (ok === undefined) {
    const uv = g.getAttribute("uv");
    ok = !!uv;
    if (uv) {
      for (let i = 0; i < uv.count && ok; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) ok = false;
      }
    }
    uvBounds.set(g, ok);
  }
  return ok;
}

/** Packs the textures along a skyline, tallest then widest first; returns null when fewer than two fit. */
export function packAtlas(textures: THREE.Texture[], opts: { smooth?: boolean } = {}): Atlas | null {
  const smooth = !!opts.smooth;
  const mipLevels = smooth ? SMOOTH_MIP_LEVELS : MIP_LEVELS;
  const align = smooth ? SMOOTH_ALIGNMENT : ALIGNMENT;
  const list = [...new Set(textures)].sort(
    (a, b) =>
      (b.image as Canvasish).height - (a.image as Canvasish).height ||
      (b.image as Canvasish).width - (a.image as Canvasish).width,
  );
  if (list.length < 2) return null;

  const total = list.reduce(
    (n, t) =>
      n +
      alignTo((t.image as Canvasish).width + PADDING * 2, align) *
        alignTo((t.image as Canvasish).height + PADDING * 2, align),
    0,
  );

  const tryWidth = (maxW: number, maxH: number) => {
    const rects = new Map<THREE.Texture, Rect>();
    const skyline = new Uint16Array(Math.floor(maxW / align));
    let fit = true;
    for (const t of list) {
      const { width: w, height: h } = t.image as Canvasish;
      const columns = alignTo(w + PADDING * 2, align) / align;
      const slotH = alignTo(h + PADDING * 2, align);
      if (columns > skyline.length) {
        fit = false;
        break;
      }
      // Skyline packing: the slot goes where the skyline is lowest, leftmost on a tie.
      let x = 0;
      let y = maxH;
      for (let start = 0; start + columns <= skyline.length; start++) {
        let top = 0;
        for (let i = start; i < start + columns; i++) top = Math.max(top, skyline[i]!);
        if (top < y) {
          x = start;
          y = top;
        }
      }
      if (y + slotH > maxH) {
        fit = false;
        break;
      }
      rects.set(t, { x: x * align + PADDING, y: y + PADDING, w, h });
      skyline.fill(y + slotH, x, x + columns);
    }
    let usedW = 1;
    let usedH = 1;
    for (const r of rects.values()) {
      usedW = Math.max(usedW, r.x - PADDING + alignTo(r.w + PADDING * 2, align));
      usedH = Math.max(usedH, r.y - PADDING + alignTo(r.h + PADDING * 2, align));
    }
    const width = Math.min(maxW, alignTo(usedW, align));
    const height = Math.min(maxH, alignTo(usedH, align));
    return { rects, fit, width, height };
  };

  let best: ReturnType<typeof tryWidth> | null = null;
  // Test power-of-two widths plus a tight square-ish width to minimize dead right-hand slack.
  const candidates = new Set<number>();
  let side = 128;
  while (side * side < total && side < MAX_ATLAS) side *= 2;
  candidates.add(side);
  if (side < MAX_ATLAS) candidates.add(Math.min(MAX_ATLAS, side * 2));
  const sq = Math.min(MAX_ATLAS, Math.max(128, alignTo(Math.ceil(Math.sqrt(total * 1.06)), align)));
  candidates.add(sq);
  const widest = alignTo((list[0]!.image as Canvasish).width + PADDING * 2, align);
  for (const cols of [4, 5, 6, 7]) {
    const w = cols * widest;
    if (w >= 128 && w <= MAX_ATLAS) candidates.add(w);
  }
  for (const w of candidates) {
    const res = tryWidth(w, MAX_ATLAS);
    if (res.rects.size < 2) continue;
    if (
      !best ||
      res.rects.size > best.rects.size ||
      (res.rects.size === best.rects.size && res.width * res.height < best.width * best.height)
    ) {
      best = res;
    }
  }
  if (!best || best.rects.size < 2) return null;
  const { rects, width, height } = best;
  const levels = Array.from({ length: mipLevels }, (_, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = width / 2 ** i;
    canvas.height = height / 2 ** i;
    return canvas;
  });
  const seen = new Map<THREE.Texture, number>();
  for (const [t, r] of rects) {
    paintTile(levels, t, r, align);
    seen.set(t, t.version);
  }
  const texture = new THREE.CanvasTexture(levels[0]);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (smooth) {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = 4;
  } else {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapLinearFilter;
  }
  // Stop before neighbouring slots merge. Immutable WebGL storage clamps sampling to these allocated levels.
  texture.mipmaps = levels;
  texture.generateMipmaps = false;
  return { texture, width, height, rects, seen, repaints: 0, smooth, align };
}

/** Rebuild each tile's mip levels from its own image, including an extruded border at every level. */
function paintTile(levels: HTMLCanvasElement[], texture: THREE.Texture, r: Rect, align: number): void {
  const image = texture.image as CanvasImageSource;
  const tile = document.createElement("canvas");
  tile.width = alignTo(r.w + PADDING * 2, align);
  tile.height = alignTo(r.h + PADDING * 2, align);
  const g = tile.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const xs = [0, PADDING, PADDING + r.w, tile.width];
  const ys = [0, PADDING, PADDING + r.h, tile.height];
  // The picture's middle, and one pixel of each edge stretched out into the padding round it.
  const sx = [0, 0, r.w - 1];
  const sy = [0, 0, r.h - 1];
  const sw = [1, r.w, 1];
  const sh = [1, r.h, 1];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      g.drawImage(
        image,
        sx[x]!,
        sy[y]!,
        sw[x]!,
        sh[y]!,
        xs[x]!,
        ys[y]!,
        xs[x + 1]! - xs[x]!,
        ys[y + 1]! - ys[y]!,
      );
    }
  }

  // Resample a complete tile, so fractional content edges cannot leave seams between drawImage calls.
  for (let level = 0; level < levels.length; level++) {
    const scale = 2 ** level;
    const dest = levels[level]!.getContext("2d")!;
    const x = (r.x - PADDING) / scale;
    const y = (r.y - PADDING) / scale;
    const w = tile.width / scale;
    const h = tile.height / scale;
    dest.clearRect(x, y, w, h);
    dest.imageSmoothingEnabled = level > 0;
    dest.drawImage(tile, x, y, w, h);
  }
}

/** The atlas version of a picture's UVs: keeps nearest or bilinear sampling strictly inside its own slot. */
export function remapUv(g: THREE.BufferGeometry, r: Rect, atlas: Atlas): void {
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  // Linear sampling blends half a texel outward; nearest only needs a tiny margin inside the slot's edge.
  const margin = atlas.smooth ? 0.5 : 0.001;
  const ex = Math.min(r.w * 0.5, margin);
  const ey = Math.min(r.h * 0.5, margin);
  for (let i = 0; i < uv.count; i++) {
    const px = Math.min(r.w - ex, Math.max(ex, uv.getX(i) * r.w));
    const py = Math.min(r.h - ey, Math.max(ey, (1 - uv.getY(i)) * r.h));
    uv.setXY(i, (r.x + px) / atlas.width, 1 - (r.y + py) / atlas.height);
  }
  uv.needsUpdate = true;
}

/** Paints in whatever a member texture repainted since; returns how many did. */
export function syncAtlas(a: Atlas): number {
  let n = 0;
  for (const [t, r] of a.rects) {
    if (a.seen.get(t) === t.version) continue;
    a.seen.set(t, t.version);
    paintTile(a.texture.mipmaps as HTMLCanvasElement[], t, r, a.align);
    n++;
  }
  if (n) {
    a.texture.needsUpdate = true;
    a.repaints += n;
  }
  return n;
}
