/**
 * All art is drawn in code: string grids for characters and furniture, a few
 * primitives for ground and buildings. Everything is baked once into canvases.
 */

export type Palette = Record<string, string>;

export class Pen {
  constructor(readonly g: CanvasRenderingContext2D) {}

  px(x: number, y: number, color: string): void {
    this.g.fillStyle = color;
    this.g.fillRect(x, y, 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.g.fillStyle = color;
    this.g.fillRect(x, y, w, h);
  }

  /** A filled circle, pixel-exact (no anti-aliasing). */
  disc(cx: number, cy: number, r: number, color: string): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
      this.rect(cx - half, cy + y, half * 2 + 1, 1, color);
    }
  }

  /** Paints a string grid; `.` and unknown characters are transparent. */
  grid(rows: readonly string[], pal: Palette, ox = 0, oy = 0, flip = false): void {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = pal[row[x]!];
        if (color) this.px(ox + (flip ? row.length - 1 - x : x), oy + y, color);
      }
    });
  }
}

export function bake(w: number, h: number, draw: (p: Pen) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(new Pen(canvas.getContext("2d")!));
  return canvas;
}

/** Memoizes a baked sprite by key. */
export function cached<A extends unknown[]>(
  key: (...args: A) => string,
  make: (...args: A) => HTMLCanvasElement,
): (...args: A) => HTMLCanvasElement {
  const cache = new Map<string, HTMLCanvasElement>();
  return (...args: A) => {
    const k = key(...args);
    const c = cache.get(k) ?? make(...args);
    cache.set(k, c);
    return c;
  };
}

/** Deterministic noise in [0, 1) for tile variation. */
export function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2147483647, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
