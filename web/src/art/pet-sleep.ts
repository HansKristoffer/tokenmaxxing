import { compact } from "hanzio";
import { C, hexOf } from "./palette.ts";
import { bake } from "./pixels.ts";

/**
 * A pet asleep, made from the pet's own frame, so every pet (and every variation of one) has a sleeping
 * pose without its own art: the sprite is squashed down into a round, curled lump with its eyes shut, a
 * gentle breathing bob, and a few "z"s rising above it. The squashing is on plain colour grids
 * (`curl`), so it can be tested without a canvas; `sleepingFrame` is the canvas around it.
 */

/** A sprite as rows of "#rrggbb" colours, null where it's clear. */
export type Grid = (string | null)[][];

/** Sleeping frames are this big: room for the z's above a curled pet up to 12 wide. */
export const SLEEP_W = 16;
export const SLEEP_H = 24;
/** Ticks in a breath, and in the life of a z. */
export const BREATH_TICKS = 4;
export const Z_TICKS = 8;

const CHEEK = "#f29aa0";
const Z_FILL = "#eef4ff";
const Z_SHADE = "#6a77b3";

// Pixel art reads as a grid.
// prettier-ignore
const Z_SMALL = ["###", "..#", ".#.", "###"];
// Pixel art reads as a grid.
// prettier-ignore
const Z_BIG = ["####", "...#", "..#.", ".#..", "####"];

/** `n` taken modulo `period`, kept in 0 to `period - 1` even when `n` is negative. */
const wrap = (n: number, period: number) => ((n % period) + period) % period;

const opaque = (g: Grid, x: number, y: number): boolean => g[y]?.[x] != null;

/** Where the eyes are: ink pixels inside the sprite, hemmed in by colour (the outline has clear air on one side). */
export function eyesOf(g: Grid): [number, number][] {
  const out: [number, number][] = [];
  for (const [y, row] of g.entries())
    row.forEach((c, x) => {
      if (c !== C.ink) return;

      const around = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const;
      const filled = around.filter(([ax, ay]) => opaque(g, ax, ay) && g[ay]![ax] !== C.ink).length;
      if (filled >= 3) out.push([x, y]);
    });
  return out;
}

/** The colour most of it is. Ink counts 0.4 of a pixel, so the outline loses to the fill it borders. */
function dominant(colors: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const c of colors) counts.set(c, (counts.get(c) ?? 0) + (c === C.ink ? 0.4 : 1));

  const byWeight = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return byWeight[0]![0];
}

/**
 * How many separate pieces row `y` is made of. A lone pixel at either end beside a wide piece is a tail
 * tip, not a leg, so it doesn't count (a thin dog's body row has one).
 */
const runs = (g: Grid, y: number): number => {
  const pieces: [number, number][] = [];
  for (const [x, c] of g[y]!.entries()) {
    if (c === null) continue;
    if (g[y]![x - 1] == null) pieces.push([x, 1]);
    else pieces[pieces.length - 1]![1]++;
  }

  // A piece of five pixels or more is body, so a lone pixel at the row's end beside one is a tail tip.
  const wide = pieces.some(([, n]) => n >= 5);
  const isTailTip = (n: number, i: number) => n === 1 && (i === 0 || i === pieces.length - 1);
  return pieces.filter(([, n], i) => !(wide && isTailTip(n, i))).length;
};

/** The column indexes where `keep` holds, across all rows. */
const columnsWhere = <T>(rows: readonly (readonly T[])[], keep: (cell: T) => boolean): number[] =>
  rows.flatMap((row) => row.flatMap((cell, x) => (keep(cell) ? [x] : [])));

/**
 * The sprite curled up: its legs tucked away, the rest squashed to about two thirds of its height with
 * a fresh outline round it, eyes shut, sitting on the bottom row of a `SLEEP_W × SLEEP_H` grid.
 * `breath` (0 or 1) lifts the back a row. `left` is where it faces; the sprite's already drawn that way.
 */
export function curl(src: Grid, left: boolean, breath: number): Grid {
  const out: Grid = Array.from({ length: SLEEP_H }, () => Array<string | null>(SLEEP_W).fill(null));
  const used = src.flatMap((row, y) => (row.some((c) => c !== null) ? [y] : []));
  if (!used.length) return out;

  const eyes = eyesOf(src);

  // Legs are the bottom rows made of separate pieces.
  let bottom = used[used.length - 1]!;
  while (bottom > used[0]! + 3 && runs(src, bottom) > 1) bottom--;
  const top = used[0]!;
  const h = bottom - top + 1;

  const cols = columnsWhere(src, (c) => c !== null);
  const minX = Math.min(...cols);
  const maxX = Math.max(...cols);
  const w = maxX - minX + 1;

  // Squash by a block per target pixel: tall animals more, round ones (the orb) hardly.
  const th = Math.max(7, Math.round(h * (h > w * 0.7 ? 0.7 : 0.9))) + breath;
  const ox = Math.floor((SLEEP_W - w) / 2) - minX;
  const oy = SLEEP_H - th;
  const block = (tx: number, ty: number): (string | null)[] => {
    const from = top + Math.floor((ty * h) / th);
    const to = Math.max(from, top + Math.ceil(((ty + 1) * h) / th) - 1);
    const cells: (string | null)[] = [];
    for (let y = from; y <= to; y++) cells.push(src[y]?.[tx - ox] ?? null);
    return cells;
  };

  const mask: boolean[][] = [];
  const fill: (string | null)[][] = [];
  const inked: boolean[][] = [];
  for (let ty = 0; ty < th; ty++) {
    mask.push([]);
    fill.push([]);
    inked.push([]);
    for (let x = 0; x < SLEEP_W; x++) {
      const cells = block(x, ty);
      const on = compact(cells);
      const bodyColors = on.filter((c) => c !== C.ink);
      mask[ty]!.push(on.length * 2 >= cells.length);
      fill[ty]!.push(on.length ? dominant(bodyColors.length ? bodyColors : on) : null);
      inked[ty]!.push(on.includes(C.ink));
    }
  }

  // The tail is tucked in: thin columns at the back (opposite the face) go.
  for (let n = 0; n < 2; n++) {
    const xs = columnsWhere(mask, (m) => m);
    const back = left ? Math.max(...xs) : Math.min(...xs);
    const front = left ? Math.min(...xs) : Math.max(...xs);
    const height = (x: number) => mask.filter((r) => r[x]).length;
    if (height(back) <= 3 && height(front) > 3) {
      for (const r of mask) r[back] = false;
    }
  }

  // Curled up has no spikes: clip to a rounded box (ears and tails lose their tips).
  const cols2 = columnsWhere(mask, (m) => m);
  const cx = (Math.min(...cols2) + Math.max(...cols2)) / 2;
  const hw = (Math.max(...cols2) - Math.min(...cols2) + 1) / 2;
  for (const [ty, row] of mask.entries()) {
    row.forEach((m, x) => {
      const nx = Math.abs(x - cx) / (hw + 0.2);
      const ny = Math.abs(ty - (th - 1) / 2) / (th / 2 + 0.2);
      if (m && nx ** 3 + ny ** 3 > 1.15) row[x] = false;
    });
  }

  // Round the bottom corners off, then outline whatever has air beside it.
  const rowsOn = (ty: number) => mask[ty]!.flatMap((m, x) => (m ? [x] : []));
  const last = rowsOn(th - 1);
  if (last.length > 4) {
    mask[th - 1]![last[0]!] = false;
    mask[th - 1]![last[last.length - 1]!] = false;
  }

  // The underside is one unbroken line: the tucked-in legs leave no gaps.
  const under = rowsOn(th - 1);
  for (let x = under[0]!; x <= under[under.length - 1]!; x++) mask[th - 1]![x] = true;

  const inMask = (x: number, y: number) => mask[y]?.[x] === true;
  const grid: Grid = mask.map((row, ty) =>
    row.map((m, x) => {
      if (!m) return null;

      const edge = !inMask(x - 1, ty) || !inMask(x + 1, ty) || !inMask(x, ty - 1) || !inMask(x, ty + 1);
      const body = fill[ty]![x] ?? C.ink;
      if (edge && inked[ty]![x]) return C.ink;
      if (body === C.ink && !edge) return nearestBody(fill, ty, x);
      return body;
    }),
  );

  // Shut eyes: a dash where each was, with a blush under it.
  const side = left ? 1 : -1;
  for (const [ex, ey] of eyes) {
    if (ey - top >= h * 0.6) continue; // lower down is a gap between legs, not an eye

    const ty = Math.min(th - 2, Math.floor(((ey - top) * th) / h));
    const x = ex + ox;
    for (const dx of [0, side]) {
      if (inMask(x + dx, ty)) grid[ty]![x + dx] = C.ink;
    }

    const blushY = ty + 1;
    const blushHere = inMask(x, blushY) && blushY < th - 1 && grid[blushY]![x] !== C.ink;
    if (blushHere) grid[blushY]![x] = CHEEK;
  }

  for (let ty = 0; ty < th; ty++) {
    for (let x = 0; x < SLEEP_W; x++) out[oy + ty]![x] = grid[ty]![x]!;
  }
  return out;
}

/** The nearest body colour that isn't ink, for an ink pixel in the middle of the lump. */
function nearestBody(fill: (string | null)[][], y: number, x: number): string {
  for (let r = 1; r < 4; r++)
    for (const [dx, dy] of [
      [-r, 0],
      [r, 0],
      [0, -r],
      [0, r],
    ] as const) {
      const c = fill[y + dy]?.[x + dx];
      if (c && c !== C.ink) return c;
    }
  return C.ink;
}

/** The z's for this tick: each rises and drifts away from the face over `Z_TICKS`, the next half a life behind. */
export function zs(left: boolean, tick: number): { x: number; y: number; big: boolean }[] {
  const out: { x: number; y: number; big: boolean }[] = [];
  for (const offset of [0, Z_TICKS / 2]) {
    const age = (tick + offset) % Z_TICKS;
    if (age >= Z_TICKS - 2) continue;

    const drift = Math.floor(age / 2);
    out.push({ x: left ? 3 - drift : SLEEP_W - 7 + drift, y: 10 - age * 2, big: age >= 3 });
  }
  return out;
}

/** Everything as one grid: the curled pet and its z's. */
export function sleeping(src: Grid, left: boolean, tick: number): Grid {
  const phase = wrap(tick, BREATH_TICKS);
  const out = curl(src, left, phase === 1 || phase === 2 ? 1 : 0);
  for (const z of zs(left, wrap(tick, Z_TICKS))) {
    const glyph = z.big ? Z_BIG : Z_SMALL;
    for (const [gy, row] of glyph.entries()) {
      [...row].forEach((ch, gx) => {
        if (ch !== "#") return;

        const x = z.x + gx;
        const y = z.y + gy;
        if (out[y]?.[x] === null) out[y]![x] = Z_FILL;

        // The shade falls one pixel down and right, except where the z itself is drawn.
        const shadeIsFree = glyph[gy + 1]?.[gx + 1] !== "#";
        if (out[y + 1]?.[x + 1] === null && shadeIsFree) out[y + 1]![x + 1] = Z_SHADE;
      });
    }
  }
  return out;
}

/** Per source frame: its pixels, read once, and the sleeping frames made from them. */
const cache = new WeakMap<HTMLCanvasElement, { grid: Grid; frames: Map<number, HTMLCanvasElement> }>();

function readGrid(canvas: HTMLCanvasElement): Grid {
  const { width, height } = canvas;
  const d = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const i = (y * width + x) * 4;
      // Under half opacity counts as clear, so soft anti-aliased edges drop out of the grid.
      return d[i + 3]! < 128 ? null : hexOf(d[i]!, d[i + 1]!, d[i + 2]!);
    }),
  );
}

/**
 * The pet in `source` (its normal frame, facing `left` or right) asleep, `SLEEP_W × SLEEP_H`, bottom
 * aligned. `tick` steps the breathing and the z's (about 2 a second); null when there's no pet.
 */
export function sleepingFrame(
  source: HTMLCanvasElement | null,
  left: boolean,
  tick: number,
): HTMLCanvasElement | null {
  if (!source) return null;

  const t = wrap(tick, Z_TICKS);
  let made = cache.get(source);
  if (!made) {
    made = { grid: readGrid(source), frames: new Map() };
    cache.set(source, made);
  }

  const { frames } = made;
  const key = t * 2 + (left ? 1 : 0);
  let frame = frames.get(key);
  if (!frame) {
    const grid = sleeping(made.grid, left, t);
    frame = bake(SLEEP_W, SLEEP_H, (p) => {
      for (const [y, row] of grid.entries()) {
        for (const [x, c] of row.entries()) {
          if (c) p.px(x, y, c);
        }
      }
    });
    frames.set(key, frame);
  }
  return frame;
}
