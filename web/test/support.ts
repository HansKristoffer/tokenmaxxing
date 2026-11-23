import { expect } from "bun:test";
import type * as THREE from "three";
import { Pen } from "../src/art/pixels.ts";

/** Every row is a line of `pal`'s characters (or `.`), no wider than `width` (16, the character's frame). */
export const checkRows = (what: string, rows: readonly string[], pal: Record<string, string>, width = 16) => {
  for (const [y, row] of rows.entries()) {
    expect(row.length, `${what} row ${y} is ${row.length} wide`).toBeLessThanOrEqual(width);
    for (const c of row)
      if (c !== ".") expect(pal[c], `${what} row ${y}: "${c}" is not in the palette`).toBeDefined();
  }
};

/** A pen that records every paint and whether it lands inside a `w` by `h` canvas, so a sprite can be checked without one. */
export const recorder = (w: number, h: number) => {
  const bad: string[] = [];
  const colors = new Set<string>();
  let painted = 0;
  const g = {
    fillStyle: "",
    fillRect(x: number, y: number, rw: number, rh: number) {
      if (rw <= 0 || rh <= 0) return;
      painted++;
      colors.add(this.fillStyle);
      if (![x, y, rw, rh].every(Number.isInteger) || x < 0 || y < 0 || x + rw > w || y + rh > h)
        bad.push(`${x},${y} ${rw}x${rh}`);
    },
  };
  return { pen: new Pen(g as unknown as CanvasRenderingContext2D), bad, painted: () => painted, colors };
};

/** How many meshes `o` holds, hidden ones included. */
export const countMeshes = (o: THREE.Object3D): number => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) n++;
  });
  return n;
};
