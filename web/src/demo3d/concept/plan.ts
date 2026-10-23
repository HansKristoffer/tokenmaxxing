/** Lays the town out as a 4x4 grid of blocks and fills each with stacked volumes. */
import { seeded } from "../kit.ts";
import { C, FL, type Kind, PITCH, type Roof, type Vol } from "./city.ts";

export const OX = 4; // blocks of surrounding city behind and beside the core town
export const OZ = 4;
export const BX = 6 + OX;
export const BZ = 4 + OZ;
export const BLOCKS = 6;
export const GRID_X = BX * PITCH + 1;
export const GRID_Z = BZ * PITCH + 1;

export interface Plan {
  vols: Vol[];
  W: number;
  D: number;
  /** Named volumes landmarks hang off. */
  marks: Record<string, Vol>;
  /** Cells kept open at ground level (plazas). */
  plaza: { i0: number; j0: number; i1: number; j1: number }[];
  /** Block cells reserved for landmarks: name -> block coords. */
  blocks: { bx: number; bz: number; i0: number; j0: number; podium: number }[];
}

type Rect = { i0: number; j0: number; i1: number; j1: number };

type Add = (v: Omit<Vol, "id">) => Vol;
type Role = (i0: number, j0: number, add: Add, marks: Record<string, Vol>, rnd: () => number) => void;

/** The landmark blocks, by block coordinates. */
const ROLES: Record<string, Role> = {
  // THE TAVERN TOWER: timber, warm windows, a beer garden on a lattice-propped terrace
  "5,2": (i, j, add, marks) => {
    add({ i0: i, j0: j, i1: i + 3, j1: j + 3, f0: 0, f1: 3, kind: "wood", roof: "plaza", stairs: true, lit: 0.8, wall: "#b98a5a" });
    add({ i0: i + 1, j0: j, i1: i + 3, j1: j + 2, f0: 3, f1: 7, kind: "wood", roof: "plaza", stairs: true, lit: 0.85, wall: "#c49563" });
    add({ i0: i + 1, j0: j, i1: i + 2, j1: j + 1, f0: 7, f1: 11, kind: "concrete", roof: "garden", lit: 0.9, wall: "#e6d6b4" });
    add({ i0: i + 1, j0: j, i1: i + 1, j1: j + 1, f0: 11, f1: 15, kind: "wood", roof: "plaza", lit: 0.9, wall: "#b98a5a" });
    marks.tavern = add({ i0: i + 1, j0: j + 1, i1: i + 1, j1: j + 1, f0: 15, f1: 19, kind: "wood", roof: "none", lit: 1, wall: "#a47848" });
  },
  // THE HQ ZIGGURAT: company houses on the rims, biggest on top
  "4,2": (i, j, add, marks) => {
    marks.hq0 = add({ i0: i, j0: j, i1: i + 3, j1: j + 3, f0: 0, f1: 5, kind: "concrete", roof: "garden", reserve: true, lit: 0.6, wall: "#d9d1bf", stairs: true });
    marks.hq1 = add({ i0: i, j0: j, i1: i + 1, j1: j + 1, f0: 5, f1: 11, kind: "white", roof: "garden", reserve: true, lit: 0.7 });
    add({ i0: i, j0: j, i1: i, j1: j, f0: 11, f1: 22, kind: "glass", roof: "garden", lit: 0.8 });
    add({ i0: i, j0: j, i1: i, j1: j, f0: 22, f1: 31, kind: "white", roof: "garden", lit: 0.7 });
    marks.hqTop = add({ i0: i, j0: j, i1: i, j1: j, f0: 31, f1: 34, kind: "steel", roof: "tech", lit: 1 });
  },
  // SHOPS: a stack of storefront floors, each a different trade
  "4,3": (i, j, add, marks) => {
    marks.shops = add({ i0: i, j0: j, i1: i + 3, j1: j + 3, f0: 0, f1: 2, kind: "concrete", roof: "plaza", lit: 0.9, wall: "#e9dcc4" });
    marks.shops2 = add({ i0: i, j0: j, i1: i + 3, j1: j + 2, f0: 2, f1: 4, kind: "concrete", roof: "plaza", lit: 0.9, wall: "#f0d9c0" });
    marks.shops3 = add({ i0: i, j0: j, i1: i + 1, j1: j + 1, f0: 4, f1: 9, kind: "wood", roof: "garden", lit: 0.9 });
  },
  // THE BASEMENT: a wide purple arcade podium with a big pixel-invader on its roof
  "3,3": (i, j, add, marks) => {
    marks.arcade = add({ i0: i, j0: j, i1: i + 3, j1: j + 3, f0: 0, f1: 3, kind: "dark", roof: "plaza", lit: 1, wall: "#4b3a78" });
    add({ i0: i, j0: j, i1: i + 2, j1: j + 2, f0: 3, f1: 4, kind: "dark", roof: "plaza", lit: 1, wall: "#4b3a78" });
    add({ i0: i, j0: j, i1: i + 1, j1: j + 2, f0: 4, f1: 8, kind: "steel", roof: "garden", lit: 0.9 });
  },
  // THE RAID GATE: a dark keep
  "2,0": (i, j, add, marks) => {
    marks.raid = add({ i0: i, j0: j, i1: i + 3, j1: j + 1, f0: 0, f1: 26, kind: "steel", roof: "bare", lit: 0.35, wall: "#3a3640" });
    add({ i0: i, j0: j + 2, i1: i + 3, j1: j + 3, f0: 0, f1: 16, kind: "dark", roof: "plaza", lit: 0.35, wall: "#46404f" });
    add({ i0: i + 1, j0: j, i1: i + 2, j1: j + 1, f0: 26, f1: 38, kind: "steel", roof: "bare", lit: 0.3, wall: "#34303c" });
    marks.raidTop = add({ i0: i + 1, j0: j, i1: i + 1, j1: j, f0: 38, f1: 45, kind: "steel", roof: "tech", lit: 0.5, wall: "#2c2834" });
  },
};

const HS: Record<string, number> = { "3,2": 4, "2,2": 4, "2,3": 4, "1,3": 5, "0,3": 6, "4,1": 11, "3,1": 12, "2,1": 15, "3,0": 22, "5,1": 13, "1,2": 8, "0,2": 10, "1,1": 14 };

export function planCity(seed = 11): Plan {
  const rnd = seeded(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const vols: Vol[] = [];
  const marks: Record<string, Vol> = {};
  const blocks: Plan["blocks"] = [];
  let id = 1;
  const add = (v: Omit<Vol, "id">): Vol => {
    const full = { id: id++, ...v };
    vols.push(full);
    return full;
  };
  const plaza: Plan["plaza"] = [];

  const BODY: Kind[] = ["concrete", "concrete", "white", "glass", "dark", "wood", "open", "green", "concrete", "steel", "white", "wood"];
  const ROOF: Roof[] = ["garden", "garden", "garden", "garden", "plaza", "crops", "tech", "garden", "solar"];

  for (let bz = 0; bz < BZ; bz++)
    for (let bx = 0; bx < BX; bx++) {
      const i0 = bx * PITCH + 1;
      const j0 = bz * PITCH + 1;
      const dist = BX - 1 - bx + (BZ - 1 - bz); // 0 at the front corner
      if (bx === BX - 1 && bz === BZ - 1) {
        plaza.push({ i0, j0, i1: i0 + 3, j1: j0 + 3 });
        blocks.push({ bx, bz, i0, j0, podium: 0 });
        continue;
      }
      const role = ROLES[`${bx - OX},${bz - OZ}`];
      if (role) {
        blocks.push({ bx, bz, i0, j0, podium: 0 });
        role(i0, j0, add, marks, rnd);
        continue;
      }
      const hs = HS[`${bx - OX},${bz - OZ}`] ?? Math.min(40, 5 + dist * 2.5 + rnd() * 5);
      const podiumH = 2 + Math.floor(rnd() * 4) + (dist > 5 ? 2 : 0);
      blocks.push({ bx, bz, i0, j0, podium: podiumH });
      const lat = rnd() < 0.8;
      const flipX = rnd() < 0.5;
      const flipZ = rnd() < 0.5;
      const rect = (a: number, b: number, c: number, d: number): Rect => ({
        i0: i0 + (flipX ? 3 - c : a),
        i1: i0 + (flipX ? 3 - a : c),
        j0: j0 + (flipZ ? 3 - d : b),
        j1: j0 + (flipZ ? 3 - b : d),
      });
      const podK = pick<Kind>(["concrete", "wood", "white", "dark", "concrete"]);
      const latW = rnd() < 0.5 ? 2 : 1;
      const latD = 1 + Math.floor(rnd() * 2);
      // used[b][a] in unflipped coordinates
      const used = Array.from({ length: 4 }, () => Array<boolean>(4).fill(false));
      if (lat) {
        const L = podiumH + 3 + Math.floor(rnd() * 6);
        add({ ...rect(0, 0, latW, latD), f0: 0, f1: L, kind: "lattice", roof: pick(["garden", "garden", "crops", "plaza"]), stairs: rnd() < 0.4 });
        for (let a = 0; a <= latW; a++) for (let b = 0; b <= latD; b++) used[b]![a] = true;
        // podium: whatever is left
        for (let b = 0; b < 4; b++) {
          let a = 0;
          while (a < 4) {
            if (used[b]![a]) {
              a++;
              continue;
            }
            let e = a;
            while (e + 1 < 4 && !used[b]![e + 1]) e++;
            add({ ...rect(a, b, e, b), f0: 0, f1: podiumH, kind: podK, roof: "garden", stairs: rnd() < 0.3 });
            a = e + 1;
          }
        }
      } else {
        add({ i0, j0, i1: i0 + 3, j1: j0 + 3, f0: 0, f1: podiumH, kind: podK, roof: "garden", stairs: rnd() < 0.5 });
      }
      const towerUsed = Array.from({ length: 4 }, () => Array<boolean>(4).fill(false));
      for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) towerUsed[b]![a] = used[b]![a]!;
      const nt = 3 + Math.floor(rnd() * 3);
      for (let n = 0; n < nt; n++) {
        for (let tries = 0; tries < 14; tries++) {
          const w = 1 + Math.floor(rnd() * 2.6);
          const d = 1 + Math.floor(rnd() * 3);
          const a = Math.floor(rnd() * (5 - w));
          const b = Math.floor(rnd() * (5 - d));
          let ok = true;
          for (let p = a; p < a + w; p++) for (let q = b; q < b + d; q++) if (towerUsed[q]![p]) ok = false;
          if (!ok) continue;
          for (let p = a; p < a + w; p++) for (let q = b; q < b + d; q++) towerUsed[q]![p] = true;
          let r = rect(a, b, a + w - 1, b + d - 1);
          let f = podiumH;
          const total = Math.max(3, Math.round(hs * (0.4 + rnd() * 0.65)));
          const fEnd = podiumH + total;
          let kind = pick(BODY);
          let first = true;
          while (f < fEnd) {
            const seg = Math.min(fEnd - f, 3 + Math.floor(rnd() * 7));
            const last = f + seg >= fEnd;
            const v = add({ ...r, f0: f, f1: f + seg, kind, roof: last ? pick(ROOF) : pick(["garden", "garden", "plaza", "crops"]), stairs: rnd() < 0.38 && kind !== "glass" && kind !== "open" });
            if (first && last === false) first = false;
            f += seg;
            if (last) {
              if (!marks.tallest || v.f1 > marks.tallest.f1) marks.tallest = v;
              break;
            }
            // setback: lose a row or column when the rect allows
            const cw = r.i1 - r.i0 + 1;
            const cd = r.j1 - r.j0 + 1;
            const opts: number[] = [];
            if (cw > 1) opts.push(0, 1);
            if (cd > 1) opts.push(2, 3);
            if (opts.length && rnd() < 0.78) {
              const o = pick(opts);
              r = { ...r };
              if (o === 0) r.i0++;
              else if (o === 1) r.i1--;
              else if (o === 2) r.j0++;
              else r.j1--;
            }
            if (rnd() < 0.7) kind = pick(BODY);
          }
          break;
        }
      }
      // annexes: a lattice-supported house block on a free podium cell
      for (let b = 0; b < 4; b++)
        for (let a = 0; a < 4; a++) {
          if (towerUsed[b]![a] || rnd() > 0.45) continue;
          const r = rect(a, b, a, b);
          towerUsed[b]![a] = true;
          const k = 2 + Math.floor(rnd() * 3);
          add({ ...r, f0: podiumH, f1: podiumH + k, kind: "lattice", roof: "none" });
          add({ ...r, f0: podiumH + k, f1: podiumH + k + 2 + Math.floor(rnd() * 2), kind: pick<Kind>(["wood", "open", "concrete"]), roof: pick(["garden", "garden", "tech"]), stairs: rnd() < 0.4 });
        }
    }
  for (const v of vols) v.lit = 0.18 + rnd() * 0.5;
  return { vols, W: GRID_X, D: GRID_Z, marks, plaza, blocks };
}

/** Sky bridges and walkways across the streets, where both sides are built. */
export function addBridges(plan: Plan, seed = 5): void {
  const rnd = seeded(seed);
  const col = new Map<number, Vol[]>();
  for (const v of plan.vols)
    for (let j = v.j0; j <= v.j1; j++)
      for (let i = v.i0; i <= v.i1; i++) {
        const k = j * 1000 + i;
        if (!col.has(k)) col.set(k, []);
        col.get(k)!.push(v);
      }
  const occ = (i: number, j: number, f: number) => col.get(j * 1000 + i)?.some((v) => f >= v.f0 && f < v.f1) ?? false;
  let id = 1000;
  const used = new Set<string>();
  const tryBridge = (i: number, j: number, di: number, dj: number) => {
    // along (di, dj): cells (i - di, j - dj) and (i + di, j + dj) must be built at floor f
    for (let t = 0; t < 8; t++) {
      const f = 3 + Math.floor(rnd() * 30);
      if (occ(i - di, j - dj, f) && occ(i + di, j + dj, f) && occ(i - di, j - dj, f + 1) && occ(i + di, j + dj, f + 1) && !occ(i, j, f)) {
        // keep spacing between bridges in a street cell
        const key = `${i},${j}`;
        let clash = false;
        for (let g = -2; g <= 2; g++) if (used.has(`${key},${f + g}`)) clash = true;
        if (clash) continue;
        used.add(`${key},${f}`);
        const kind: Kind = rnd() < 0.5 ? "bridge" : "walk";
        const v: Vol = { id: id++, i0: i, j0: j, i1: i, j1: j, f0: f, f1: f + (kind === "walk" ? 1 : 1), kind, roof: "bare", lit: 0.7 };
        plan.vols.push(v);
        return;
      }
    }
  };
  for (let a = 0; a < BX; a++)
    for (let b = 0; b < BZ; b++) {
      const i0 = a * PITCH + 1;
      const j0 = b * PITCH + 1;
      // street to the east (cell i0+4), run along z
      if (a < BX - 1) for (const dj of [1, 2]) if (rnd() < 0.8) tryBridge(i0 + 4, j0 + dj, 1, 0);
      if (b < BZ - 1) for (const di of [1, 2]) if (rnd() < 0.8) tryBridge(i0 + di, j0 + 4, 0, 1);
    }
}
export { C, FL };
