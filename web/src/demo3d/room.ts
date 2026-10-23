/**
 * A room on a tile grid, Habbo-style: a floor slab floating in the dark, walls on all four sides, and the
 * two between the camera and the room lowered to a skirting so you can see in. Furniture is placed by
 * tile and turn; the grid knows what's blocked, and finds walking paths round it.
 */
import * as THREE from "three";
import { C } from "../art/palette.ts";
import type { Asset } from "./furniture.ts";
import { canvasTexture, glow, Model, painted, planks, tint, toon, wallpaper } from "./kit.ts";

export type Turn = 0 | 1 | 2 | 3;
export interface Placed {
  asset: Asset;
  x: number;
  z: number;
  turn: Turn;
  model: Model;
}

const WALL_H = 2.6;
const WALL_T = 0.15;

/** The sky through a window, by day or night. */
const skyTexture = (night: boolean) =>
  canvasTexture(8, 16, (g) => {
    const s = g.createLinearGradient(0, 0, 0, 16);
    s.addColorStop(0, night ? "#151a33" : "#7cc2f0");
    s.addColorStop(1, night ? "#2d2f5e" : "#d3eefc");
    g.fillStyle = s;
    g.fillRect(0, 0, 8, 16);
    g.fillStyle = night ? "#fbf7ef" : "#ffffff";
    // Two stars, or a cloud.
    for (const [x, y, w] of night
      ? [
          [5, 3, 1],
          [2, 7, 1],
        ]
      : [
          [1, 4, 4],
          [2, 3, 2],
        ])
      g.fillRect(x!, y!, w!, 1);
  });
const DAY_SKY = glow("#fff", skyTexture(false));
const NIGHT_SKY = glow("#fff", skyTexture(true));
const windows: THREE.Mesh[] = [];

export function setRoomNight(night: boolean): void {
  for (const w of windows) w.material = night ? NIGHT_SKY : DAY_SKY;
}

/** A window on a wall's inner face; `at` is its bottom centre. */
function windowOn(wall: Model, x: number): void {
  const w = wall.part([x, 1.2, WALL_T / 2 + 0.01]);
  const pane = w.plane(0.9, 0.85, DAY_SKY, [0, 0.45, 0]);
  windows.push(pane);
  w.box([1.02, 0.07, 0.07], C.white, [0, -0.04, 0], 0.015);
  w.box([1.02, 0.07, 0.05], C.white, [0, 0.86, 0], 0.015);
  for (const s of [-1, 0, 1]) w.box([0.06, 0.88, 0.05], C.white, [s * 0.48, 0.01, 0], 0.012);
  w.box([0.96, 0.04, 0.04], C.white, [0, 0.43, 0]);
  w.box([1.2, 0.05, 0.16], C.white, [0, -0.08, 0.05], 0.015);
  for (const s of [-1, 1]) w.box([0.22, 1.0, 0.04], "#6d7fc4", [s * 0.6, -0.08, 0.04], 0.02);
  w.box([1.4, 0.04, 0.06], C.woodDark, [0, 1.0, 0.04]);
}

function doorOn(wall: Model, x: number): void {
  const d = wall.part([x, 0, WALL_T / 2 + 0.01]);
  d.box([0.95, 2.05, 0.06], C.white, [0, 0, 0], 0.02);
  d.box([0.8, 1.95, 0.05], C.woodDark, [0, 0, 0.02], 0.02);
  for (const y of [0.2, 1.1]) d.box([0.6, 0.7, 0.02], C.wood, [0, y, 0.045], 0.02);
  d.ball(0.04, "#e9b73d", [0.3, 1.0, 0.09]);
}

export class Room {
  readonly group = new THREE.Group();
  readonly placed: Placed[] = [];
  private readonly grid: (Placed | null)[];
  private readonly walls: { model: Model; normal: THREE.Vector3 }[] = [];

  constructor(
    readonly W: number,
    readonly D: number,
    opts: { floor?: string; wall?: string; stripe?: string; bare?: boolean } = {},
  ) {
    this.grid = Array(W * D).fill(null);
    const floor = planks(opts.floor ?? C.floor, 4);
    floor.repeat.set(W / 4, D / 4);
    const side = toon(tint(opts.floor ?? C.floor, -0.35));
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.35, D), [
      side,
      side,
      painted(floor),
      side,
      side,
      side,
    ]);
    slab.position.set(W / 2, -0.175, D / 2);
    slab.receiveShadow = true;
    this.group.add(slab);

    const paper = wallpaper(opts.wall ?? C.wall, opts.stripe ?? C.wallDark);
    const wall = (length: number, at: [number, number], turn: number, normal: [number, number]) => {
      const m = new Model();
      m.position.set(at[0], 0, at[1]);
      m.rotation.y = turn;
      const tex = paper.clone();
      tex.repeat.set(length, 1);
      tex.needsUpdate = true;
      const face = m.box([length, WALL_H, WALL_T], painted(tex), [0, 0, 0], 0);
      face.castShadow = false;
      m.box([length + 0.02, 0.12, WALL_T + 0.04], C.woodDark, [0, 0, 0.01], 0.01);
      m.box([length + 0.04, 0.08, WALL_T + 0.06], C.wallTop, [0, WALL_H, 0], 0.01);
      this.group.add(m);
      this.walls.push({ model: m, normal: new THREE.Vector3(normal[0], 0, normal[1]) });
      return m;
    };
    const north = wall(W + WALL_T * 2, [W / 2, -WALL_T / 2], 0, [0, 1]);
    const west = wall(D, [-WALL_T / 2, D / 2], Math.PI / 2, [1, 0]);
    wall(W + WALL_T * 2, [W / 2, D + WALL_T / 2], Math.PI, [0, -1]);
    wall(D, [W + WALL_T / 2, D / 2], -Math.PI / 2, [-1, 0]);
    // Windows and the door, in each wall's own coordinates (x along it, from its centre).
    if (opts.bare) return;
    windowOn(north, 3 - W / 2);
    windowOn(north, 10.5 - W / 2);
    doorOn(north, 7.5 - W / 2);
    windowOn(west, D / 2 - 5.5);
    windowOn(west, D / 2 - 8.5);
  }

  /** Lowers the walls between the camera and the room; `view` points from the room to the camera. */
  facing(view: THREE.Vector3): void {
    for (const w of this.walls) {
      const front = w.normal.dot(view) < -0.01;
      const target = front ? 0.06 : 1;
      w.model.scale.y += (target - w.model.scale.y) * 0.25;
      w.model.visible = w.model.scale.y > 0.02;
    }
  }

  static footprint(asset: Asset, turn: Turn): [number, number] {
    return turn % 2 ? [asset.d, asset.w] : [asset.w, asset.d];
  }

  at(x: number, z: number): Placed | null {
    if (x < 0 || z < 0 || x >= this.W || z >= this.D) return null;
    return this.grid[z * this.W + x]!;
  }

  inside(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.W && z < this.D;
  }

  /** Whether you can walk on (`x`, `z`): rugs are flat. */
  open(x: number, z: number): boolean {
    if (!this.inside(x, z)) return false;
    const p = this.grid[z * this.W + x];
    return !p || p.asset.id === "rug";
  }

  fits(asset: Asset, x: number, z: number, turn: Turn): boolean {
    const [w, d] = Room.footprint(asset, turn);
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++) {
        if (!this.inside(x + i, z + j)) return false;
        const p = this.grid[(z + j) * this.W + x + i];
        if (p && p.asset.id !== "rug" && asset.id !== "rug") return false;
        if (p && p.asset.id === "rug" && asset.id === "rug") return false;
      }
    return true;
  }

  place(asset: Asset, x: number, z: number, turn: Turn = 0, model = asset.build()): Placed {
    const [w, d] = Room.footprint(asset, turn);
    model.position.set(x + w / 2, 0, z + d / 2);
    model.rotation.y = (turn * Math.PI) / 2;
    this.group.add(model);
    const p: Placed = { asset, x, z, turn, model };
    this.placed.push(p);
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++) {
        const cell = (z + j) * this.W + x + i;
        // A rug stays under whatever is put on it.
        if (asset.id !== "rug" || !this.grid[cell]) this.grid[cell] = p;
      }
    return p;
  }

  /** Something hung on a wall: `x` along the north wall, `y` up it. */
  hang(model: Model, x: number, y: number): void {
    model.position.set(x, y, 0.01);
    this.group.add(model);
  }

  /** Where a seat's sitter goes, and which way they face. */
  seatOf(p: Placed): { at: THREE.Vector3; turn: number } | null {
    if (!p.asset.seat) return null;
    p.model.updateMatrixWorld();
    return {
      at: p.model.localToWorld(new THREE.Vector3(...p.asset.seat.at)),
      turn: p.model.rotation.y + p.asset.seat.turn,
    };
  }

  bedOf(p: Placed): { at: THREE.Vector3; turn: number } | null {
    if (!p.asset.bed) return null;
    p.model.updateMatrixWorld();
    return { at: p.model.localToWorld(new THREE.Vector3(...p.asset.bed)), turn: p.model.rotation.y };
  }

  /** The shortest walk from one tile to another (8 ways, no cutting corners), or null. `goal` may be a seat. */
  path(from: [number, number], goal: [number, number]): [number, number][] | null {
    const key = (x: number, z: number) => z * this.W + x;
    const prev = new Map<number, number>([[key(...from), -1]]);
    const queue: [number, number][] = [from];
    const target = key(...goal);
    while (queue.length) {
      const [x, z] = queue.shift()!;
      if (key(x, z) === target) break;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const nx = x + dx;
        const nz = z + dz;
        const k = key(nx, nz);
        if (!this.inside(nx, nz) || prev.has(k)) continue;
        if (!this.open(nx, nz) && k !== target) continue;
        if (dx && dz && (!this.open(x + dx, z) || !this.open(x, z + dz))) continue;
        prev.set(k, key(x, z));
        queue.push([nx, nz]);
      }
    }
    if (!prev.has(target)) return null;
    const out: [number, number][] = [];
    for (let k = target; k !== -1; k = prev.get(k)!) out.unshift([k % this.W, Math.floor(k / this.W)]);
    return out;
  }
}
