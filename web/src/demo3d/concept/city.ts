/**
 * Block-city generator: a grid of 1-cell streets and 4x4-cell blocks. Every block is a stack of volumes
 * (podium, tower, setback, lattice garden platform, cantilever, bridge) and each volume has a facade kind.
 * `buildCity` turns volumes into meshes: facades, floor bands, balconies, stairs, scaffolding lattice, green
 * roofs with voxel trees, wind turbines, solar and machinery, and records "slots" (roof cells, facade
 * spots) for landmarks, signs, characters and pets to attach to.
 */
import { seeded } from "../kit.ts";
import { Batch, type V3 } from "./batch.ts";

export const C = 3; // cell size
export const FL = 1.8; // floor height
export const PITCH = 5; // cells per block incl. street

export type Kind = "glass" | "concrete" | "white" | "dark" | "wood" | "green" | "open" | "lattice" | "bridge" | "walk" | "steel";
export type Roof = "garden" | "plaza" | "crops" | "tech" | "solar" | "bare" | "none";
export type Theme = "day" | "dusk" | "cyber";

export interface Vol {
  id: number;
  i0: number;
  j0: number;
  i1: number;
  j1: number;
  f0: number;
  f1: number;
  kind: Kind;
  roof: Roof;
  /** Exterior stairs on exposed faces. */
  stairs?: boolean;
  /** Reserved: the generator leaves the roof bare for a landmark. */
  reserve?: boolean;
  /** Share of lit windows at night. */
  lit?: number;
  /** A tint for the walls (hex), overriding the kind's own. */
  wall?: string;
  tag?: string;
}

export interface RoofSlot {
  x: number;
  y: number;
  z: number;
  vol: Vol;
  i: number;
  j: number;
  free: boolean;
  /** Nothing built on it: people can stand here. */
  clear?: boolean;
  /** Which of its four sides drop away (+x, -x, +z, -z). */
  edge: [boolean, boolean, boolean, boolean];
}

export interface FaceSlot {
  x: number;
  y: number;
  z: number;
  /** Outward normal. */
  nx: number;
  nz: number;
  vol: Vol;
  f: number;
}

export interface City {
  vols: Vol[];
  W: number;
  D: number;
  /** meshes: [lit, glow, glass] */
  lit: Batch;
  glow: Batch;
  glass: Batch;
  roofs: RoofSlot[];
  faces: FaceSlot[];
  occ: (i: number, j: number, f: number) => Vol | undefined;
  top: (i: number, j: number) => number;
  cx: (i: number) => number;
  cz: (j: number) => number;
}

const GREENS = ["#8fdc4c", "#62c34b", "#46a948", "#b0e45c", "#3b9a46"];
const DAY_GREEN = "#3fcf63";

interface Pal {
  wall: string;
  band: string;
  frame: string;
  glass: string;
  glassLit: string;
}
const PAL: Record<Kind, Pal> = {
  glass: { wall: "#5b7a82", band: "#e9e6dc", frame: "#f1efe6", glass: "#668a92", glassLit: "#a4c8cc" },
  concrete: { wall: "#dcd4c4", band: "#f4f0e6", frame: "#6a7276", glass: "#4a5f66", glassLit: "#8fb0b6" },
  white: { wall: "#efebe1", band: "#fbf9f3", frame: "#566268", glass: "#43606b", glassLit: "#86adb6" },
  dark: { wall: "#6f7471", band: "#4f5553", frame: "#2c3436", glass: "#35525d", glassLit: "#6c98a6" },
  wood: { wall: "#cfa670", band: "#ecdfc5", frame: "#4d4033", glass: "#4a5f66", glassLit: "#8fb0b6" },
  green: { wall: "#6e8a63", band: "#d8d1c2", frame: "#2f3b34", glass: "#4d7686", glassLit: "#86b6c6" },
  open: { wall: "#e4ddcf", band: "#efeadf", frame: "#59666b", glass: "#58808f", glassLit: "#8fc0cf" },
  lattice: { wall: "#2a2420", band: "#b98a57", frame: "#b98a57", glass: "#58808f", glassLit: "#8fc0cf" },
  bridge: { wall: "#cfd6d4", band: "#f1efe6", frame: "#f1efe6", glass: "#6aa8bb", glassLit: "#a8dbe6" },
  walk: { wall: "#cfd6d4", band: "#e8e4d8", frame: "#f1efe6", glass: "#6aa8bb", glassLit: "#a8dbe6" },
  steel: { wall: "#4a5058", band: "#2b3036", frame: "#262b30", glass: "#2e4450", glassLit: "#6ab0c4" },
};

const hash3 = (a: number, b: number, c: number, d = 0) => seeded((a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761))();

export function buildCity(vols: Vol[], W: number, D: number, theme: Theme, seed = 7): City {
  const night = theme === "cyber";
  const lit = new Batch();
  const glow = new Batch();
  const glass = new Batch();
  lit.jitter = night ? 0.05 : 0.045;
  const cx = (i: number) => (i - W / 2 + 0.5) * C;
  const cz = (j: number) => (j - D / 2 + 0.5) * C;

  // Occupancy
  const col = new Map<number, Vol[]>();
  for (const v of vols)
    for (let j = v.j0; j <= v.j1; j++)
      for (let i = v.i0; i <= v.i1; i++) {
        const k = j * 1000 + i;
        (col.get(k) ?? col.set(k, []).get(k)!).push(v);
      }
  const occ = (i: number, j: number, f: number): Vol | undefined => col.get(j * 1000 + i)?.find((v) => f >= v.f0 && f < v.f1);
  const top = (i: number, j: number): number => Math.max(0, ...(col.get(j * 1000 + i) ?? []).map((v) => v.f1));
  const roofs: RoofSlot[] = [];
  const faces: FaceSlot[] = [];

  // Colour treatment per theme.
  const dim = (c: string): string => {
    if (!night) return c;
    return shade(c, 0.34, [0.85, 0.92, 1.12]);
  };
  const warm = theme === "dusk";

  const NX = [1, -1, 0, 0] as const;
  const NZ = [0, 0, 1, -1] as const;
  const TX = [0, 0, -1, 1] as const;
  const TZ = [1, -1, 0, 0] as const;

  /** A box on a cell face. u: along the face, `inner`: from the face plane outwards, y: bottom. */
  const fb = (b: Batch, x: number, z: number, s: number, u: number, inner: number, y: number, w: number, h: number, t: number, c: string, gain = 1) => {
    const n = C / 2 + inner + t / 2;
    const px = x + NX[s]! * n + TX[s]! * u;
    const pz = z + NZ[s]! * n + TZ[s]! * u;
    if (s < 2) b.box(px, y, pz, t, h, w, c, gain);
    else b.box(px, y, pz, w, h, t, c, gain);
  };

  const windowColour = (v: Vol, r: number, pal: Pal): { c: string; on: boolean } => {
    if (night) {
      const p = (v.lit ?? 0.35) * 0.42;
      if (r < p) {
        const k = (r / p) * 7.3 % 1;
        const cols = ["#ffd27a", "#ffc46b", "#ffe8b0", "#7fe9ff", "#ff5ad8", "#a98bff", "#ffd27a", "#8affc7"];
        return { c: cols[Math.floor(k * cols.length) % cols.length]!, on: true };
      }
      return { c: "#101c28", on: false };
    }
    if (warm && r < (v.lit ?? 0.2) * 0.8) return { c: "#ffd48a", on: true };
    return { c: r > 0.7 ? pal.glassLit : pal.glass, on: false };
  };

  // ———————————————————————————— volumes ————————————————————————————
  for (const v of vols) {
    const pal = PAL[v.kind];
    const wallC = dim(v.wall ?? pal.wall);
    const bandC = dim(pal.band);
    const frameC = dim(pal.frame);
    const isOpen = v.kind === "open";
    const isLat = v.kind === "lattice";
    const isThin = v.kind === "walk";
    const y0 = v.f0 * FL;
    const y1 = v.f1 * FL;

    for (let j = v.j0; j <= v.j1; j++)
      for (let i = v.i0; i <= v.i1; i++) {
        const x = cx(i);
        const z = cz(j);
        const exposed = (f: number) => [0, 1, 2, 3].map((s) => !occ(i + NX[s]!, j + NZ[s]!, f));

        // Core volume
        if (isThin) {
          // an open walkway: only a slab and rails
        } else if (isLat) {
          lit.box(x, y0, z, C - 0.35, y1 - y0, C - 0.35, "#241d19");
          for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
            lit.box(x + dx * (C / 2 - 0.08), y0, z + dz * (C / 2 - 0.08), 0.16, y1 - y0, 0.16, "#b98a57");
        } else if (isOpen) {
          // cutaway floors drawn below
        } else {
          lit.box(x, y0, z, C, y1 - y0, C, wallC);
        }

        for (let f = v.f0; f < v.f1; f++) {
          const ex = exposed(f);
          const fy = f * FL;
          // Floor slab band
          for (let s = 0; s < 4; s++) {
            if (!ex[s]) continue;
            const r = hash3(v.id, i * 7 + s, j * 13, f);
            if (!isLat && !isThin) {
              fb(lit, x, z, s, 0, -0.02, fy, C, 0.17, 0.13, bandC);
            }
            // Facade
            switch (v.kind) {
              case "glass":
              case "bridge": {
                for (const u of [-0.75, 0.75]) {
                  const w = windowColour(v, hash3(v.id, i * 5 + s, j * 3 + (u > 0 ? 1 : 0), f), pal);
                  fb(w.on ? glow : glass, x, z, s, u, -0.01, fy + 0.2, 1.3, FL - 0.38, 0.06, w.c, w.on && night ? 1.35 : 1);
                }
                fb(lit, x, z, s, 0, 0, fy + 0.17, 0.07, FL - 0.17, 0.09, frameC);
                fb(lit, x, z, s, -C / 2 + 0.03, 0, fy + 0.17, 0.07, FL - 0.17, 0.09, frameC);
                break;
              }
              case "concrete":
              case "white":
              case "wood":
              case "dark":
              case "steel":
              case "green": {
                const narrow = v.kind === "white";
                const wide = v.kind === "dark" || v.kind === "steel";
                const us = narrow ? [-0.95, -0.32, 0.32, 0.95] : [-0.75, 0.75];
                if (hash3(v.id, i + s * 3, j, f >> 2) < 0.1) break;
                for (let k = 0; k < us.length; k++) {
                  const w = windowColour(v, hash3(v.id, i * 5 + s, j * 3 + k, f), pal);
                  const ww = narrow ? 0.36 : wide ? 1.15 : 0.9;
                  const hh = narrow ? FL - 0.45 : wide ? 0.75 : 0.85;
                  const wy = fy + (narrow ? 0.28 : 0.42);
                  fb(lit, x, z, s, us[k]!, -0.02, wy - 0.06, ww + 0.14, hh + 0.12, 0.05, frameC);
                  fb(w.on ? glow : lit, x, z, s, us[k]!, 0, wy, ww, hh, 0.04, w.c, w.on && night ? 1.35 : 1);
                }
                if (v.kind === "green" && r < 0.85) {
                  for (let k = 0; k < 7; k++) {
                    const gr = hash3(v.id, i, j, f * 9 + k + s * 99);
                    fb(lit, x, z, s, (gr - 0.5) * 2.7, 0, fy + 0.1 + hash3(f, k, s, i) * 1.4, 0.3 + gr * 0.4, 0.25 + hash3(k, f, j, s) * 0.5, 0.12 + gr * 0.14, GREENS[k % GREENS.length]!);
                  }
                }
                  if ((v.kind === "concrete" || v.kind === "white" || v.kind === "wood") && r < 0.2 && f > v.f0) {
                    fb(lit, x, z, s, 0, 0, fy, 2.2, 0.12, 0.85, bandC);
                    fb(lit, x, z, s, 0, 0.78, fy + 0.12, 2.2, 0.5, 0.05, frameC);
                    fb(lit, x, z, s, 0.9, 0.2, fy + 0.12, 0.45, 0.4, 0.4, GREENS[(f + i) % GREENS.length]!);
                    if (r < 0.08) fb(lit, x, z, s, -0.5, 0.25, fy + 0.12, 0.5, 0.35, 0.3, ["#e86a5a", "#f2c14e", "#5aa0e8"][(f + j) % 3]!);
                  }
                break;
              }
              case "open": {
                // A cutaway floor: slab, interior, columns, maybe a glass front
                const fr = hash3(v.id, i + s * 17, j, f);
                if (fr < 0.5) {
                  const w = windowColour(v, fr * 2, pal);
                  fb(w.on ? glow : glass, x, z, s, 0, -0.01, fy + 0.2, C - 0.3, FL - 0.4, 0.05, w.c, w.on && night ? 1.35 : 1);
                  fb(lit, x, z, s, 0, 0, fy + 0.17, 0.07, FL - 0.17, 0.08, frameC);
                } else {
                  fb(lit, x, z, s, 0, -0.1, fy + 0.17, C - 0.25, 0.4, 0.06, frameC);
                }
                break;
              }
              case "lattice": {
                const t = 0.06;
                for (let k = -3; k <= 3; k++) fb(lit, x, z, s, k * 0.42, -0.05, fy, t, FL, t, "#b98a57");
                for (let k = 0; k < 4; k++) fb(lit, x, z, s, 0, -0.01, fy + k * (FL / 4), C, t, t, "#a97c4b");
                if (r < 0.4) fb(lit, x, z, s, 0, -0.08, fy, C, 0.05, 0.05, "#d9b078");
                if (r < 0.4) lit.beam([x + NX[s]! * (C / 2) - TX[s]! * (C / 2) , fy, z + NZ[s]! * (C / 2) - TZ[s]! * (C / 2)], [x + NX[s]! * (C / 2) + TX[s]! * (C / 2), fy + FL, z + NZ[s]! * (C / 2) + TZ[s]! * (C / 2)], 0.07, "#a97c4b");
                break;
              }
              case "walk":
                break;
            }
            if (s === 0 || s === 2) if (r < 0.04) faces.push({ x: x + NX[s]! * C / 2, y: fy + FL / 2, z: z + NZ[s]! * C / 2, nx: NX[s]!, nz: NZ[s]!, vol: v, f });
          }
          // Open interiors and floors
          if (isOpen) {
            lit.box(x, fy, z, C, 0.16, C, bandC);
            for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
              lit.box(x + dx * (C / 2 - 0.1), fy + 0.16, z + dz * (C / 2 - 0.1), 0.2, FL - 0.16, 0.2, frameC);
            const r = hash3(v.id, i, j, f + 500);
            // back wall on a closed side
            for (let s = 0; s < 4; s++)
              if (!ex[s] || hash3(v.id, i, j * 3 + s, f) < 0.15) continue;
            const props: [string, number, number, number][] = [
              ["#e57f6a", 1.0, 0.55, 0.6],
              ["#6a8fd9", 0.9, 0.5, 0.9],
              ["#f1c75a", 0.5, 0.9, 0.5],
              ["#8c6a4a", 1.1, 0.5, 0.7],
              ["#f4f1ea", 0.8, 0.45, 0.5],
            ];
            for (let k = 0; k < 2; k++) {
              const p = props[Math.floor(hash3(v.id, i + k, j, f + 9) * props.length)]!;
              const ox = (hash3(i, j, f, k + 3) - 0.5) * (C - 1.4);
              const oz = (hash3(j, i, f, k + 8) - 0.5) * (C - 1.4);
              lit.box(x + ox, fy + 0.16, z + oz, p[1], p[2], p[3], dim(p[0]));
            }
            if (night && r < (v.lit ?? 0.4)) glow.box(x, fy + FL - 0.22, z, C - 0.5, 0.06, C - 0.5, hash3(i, j, f, 4) < 0.7 ? "#ffd69a" : "#8ff0ff");
          }
          if (isThin) {
            lit.box(x, fy, z, C, 0.2, C, bandC);
          }
        }
        // Underside plate for floating volumes is the core.
        // ——— Roof ———
        const covered = !!occ(i, j, v.f1);
        if (!covered) {
          const ex = exposed(v.f1);
          // Is the neighbour's roof at the same height? Then it's not an edge.
          const edge = [0, 1, 2, 3].map((s) => {
            const nb = [i + NX[s]!, j + NZ[s]!] as const;
            if (occ(nb[0], nb[1], v.f1 - 1) && !occ(nb[0], nb[1], v.f1)) return false; // flush roof
            return ex[s]!;
          }) as [boolean, boolean, boolean, boolean];
          const topC = v.roof === "garden" || v.roof === "crops" ? (theme === "cyber" ? "#2a5a3c" : theme === "dusk" ? "#3dbd5a" : DAY_GREEN) : v.roof === "plaza" ? dim("#c9c0ae") : dim("#a8a9a4");
          const lipC = dim(v.kind === "dark" || v.kind === "steel" ? "#8a8f8c" : "#e7e2d4");
          {
            lit.box(x, y1, z, C + 0.0, 0.2, C + 0.0, lipC);
            const mx = edge[0] ? 0.07 : 0;
            const nxx = edge[1] ? 0.07 : 0;
            const mz = edge[2] ? 0.07 : 0;
            const nz = edge[3] ? 0.07 : 0;
            if (v.roof !== "none")
              lit.box(x + (nxx - mx) / 2, y1 + 0.2, z + (nz - mz) / 2, C - mx - nxx, 0.04, C - mz - nz, topC);
          }
          roofs.push({ x, y: y1 + 0.24, z, vol: v, i, j, free: !v.reserve, edge });
          // Railings
          for (let s = 0; s < 4; s++) {
            if (!edge[s]) continue;
            fb(lit, x, z, s, 0, -0.1, y1 + 0.24, C - 0.1, 0.05, 0.05, dim("#eef2ee"));
            fb(lit, x, z, s, 0, -0.1, y1 + 0.24, C - 0.1, 0.03, 0.04, dim("#eef2ee"), 1);
            fb(lit, x, z, s, -C / 2 + 0.1, -0.1, y1 + 0.24, 0.05, 0.5, 0.05, dim("#eef2ee"));
            fb(lit, x, z, s, C / 2 - 0.1, -0.1, y1 + 0.24, 0.05, 0.5, 0.05, dim("#eef2ee"));
            fb(lit, x, z, s, 0, -0.1, y1 + 0.24 + 0.5, C - 0.1, 0.04, 0.06, dim("#eef2ee"));
            fb(glass, x, z, s, 0, -0.08, y1 + 0.3, C - 0.2, 0.44, 0.02, night ? "#4a7a96" : "#9fd0dc");
          }
        }
      }
  }

  // ———————————————————————————— stairs ————————————————————————————
  const stairColour = night ? "#5b4a3a" : "#d8a468";
  for (const v of vols) {
    if (!v.stairs) continue;
    for (let j = v.j0; j <= v.j1; j++)
      for (let i = v.i0; i <= v.i1; i++) {
        for (let s = 0; s < 4; s++) {
          if (occ(i + NX[s]!, j + NZ[s]!, v.f0)) continue;
          if (hash3(v.id, i * 11 + s, j * 7, 5) > 0.34) continue;
          const x = cx(i);
          const z = cz(j);
          let dirflip = hash3(i, j, s, 9) < 0.5;
          for (let f = v.f0; f < v.f1; f++) {
            if (occ(i + NX[s]!, j + NZ[s]!, f)) break;
            const n = 6;
            for (let k = 0; k < n; k++) {
              const u0 = -C / 2 + 0.3 + (k / n) * (C - 0.6);
              const u = dirflip ? -u0 : u0;
              fb(lit, x, z, s, u, 0.02, f * FL + ((k + 1) * FL) / n - 0.1, (C - 0.6) / n + 0.02, 0.1, 0.8, dim(stairColour));
            }
            fb(lit, x, z, s, dirflip ? -C / 2 + 0.15 : C / 2 - 0.15, 0.02, f * FL + FL - 0.12, 0.3, 0.1, 0.8, dim(stairColour));
            const a: V3 = [x + NX[s]! * (C / 2 + 0.85) + TX[s]! * (dirflip ? C / 2 - 0.3 : -C / 2 + 0.3), f * FL + 0.9, z + NZ[s]! * (C / 2 + 0.85) + TZ[s]! * (dirflip ? C / 2 - 0.3 : -C / 2 + 0.3)];
            const b2: V3 = [x + NX[s]! * (C / 2 + 0.85) + TX[s]! * (dirflip ? -C / 2 + 0.3 : C / 2 - 0.3), f * FL + 0.9 + FL, z + NZ[s]! * (C / 2 + 0.85) + TZ[s]! * (dirflip ? -C / 2 + 0.3 : C / 2 - 0.3)];
            lit.beam(a, b2, 0.05, dim("#f2efe6"));
            dirflip = !dirflip;
          }
        }
      }
  }

  // ———————————————————————————— roof decor ————————————————————————————
  const rr = seeded(seed * 31 + 5);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rr() * xs.length)]!;
  const treeCluster = (x: number, y: number, z: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const w = 0.5 + rr() * 0.5;
      const h = 1.0 + rr() * 1.5;
      const px = x + (rr() - 0.5) * (C - 0.9);
      const pz = z + (rr() - 0.5) * (C - 0.9);
      lit.box(px, y, pz, 0.12, 0.3, 0.12, "#6b4a2f");
      const c = night ? shade(pick(GREENS), 0.5, [0.7, 1.1, 1]) : pick(GREENS);
      lit.box(px, y + 0.25, pz, w, h, w * (0.8 + rr() * 0.4), c);
      if (rr() < 0.5) lit.box(px, y + 0.25 + h * 0.7, pz, w * 0.7, h * 0.5, w * 0.7, night ? shade(pick(GREENS), 0.5, [0.7, 1.1, 1]) : pick(GREENS));
    }
  };
  const turbine = (x: number, y: number, z: number, hgt: number) => {
    lit.box(x, y, z, 0.06, hgt, 0.06, dim("#f4f4f0"));
    lit.box(x, y + hgt, z, 0.14, 0.12, 0.2, dim("#f4f4f0"));
    const a0 = rr() * 6.28;
    const yaw = rr() * 3.14;
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * Math.PI * 2) / 3;
      const dx = Math.cos(a) * 0.5;
      const dy = Math.sin(a) * 0.5;
      lit.beam([x, y + hgt + 0.06, z + 0.12], [x + dx * Math.cos(yaw), y + hgt + 0.06 + dy, z + 0.12 + dx * Math.sin(yaw)], 0.045, dim("#ffffff"));
    }
  };
  for (const r of roofs) {
    if (!r.free) continue;
    const v = r.vol;
    const k = hash3(v.id, r.i, r.j, 77);
    const { x, y, z } = r;
    r.clear = (v.roof === "plaza" && k >= 0.75) || (v.roof === "garden" && k >= 0.9) || v.roof === "bare";
    switch (v.roof) {
      case "garden":
        if (k < 0.72) treeCluster(x, y, z, 3 + Math.floor(rr() * 5));
        else if (k < 0.84) {
          turbine(x + (rr() - 0.5), y, z + (rr() - 0.5), 1.0 + rr() * 0.7);
          if (rr() < 0.6) treeCluster(x + 0.3, y, z + 0.3, 1);
        } else if (k < 0.9) {
          // flower bed and a bench
          for (let a = 0; a < 5; a++) lit.box(x + (rr() - 0.5) * 2, y, z + (rr() - 0.5) * 2, 0.35, 0.22 + rr() * 0.15, 0.35, pick(night ? ["#b04a9a", "#4a8ab0", "#c08a3a"] : ["#ee6b9a", "#5b8fe8", "#f2c14e", "#f4f1ea"]));
        } else {
          lit.box(x, y, z, 1.2, 0.35, 0.4, dim("#9b7a52"));
          treeCluster(x + 0.8, y, z - 0.8, 1);
        }
        break;
      case "crops": {
        lit.box(x, y, z, C - 0.4, 0.14, C - 0.4, dim("#7a5a3a"));
        for (let a = -3; a <= 3; a++) lit.box(x + a * 0.36, y + 0.14, z, 0.18, 0.3 + (a % 2 ? 0.1 : 0), C - 0.7, night ? "#3c7a46" : (a % 3 === 0 ? "#e0c050" : "#58b84a"));
        break;
      }
      case "plaza": {
        if (k < 0.35) {
          lit.box(x, y, z, 0.06, 1.0, 0.06, dim("#e8e4d8"));
          lit.box(x, y + 1.0, z, 1.5, 0.12, 1.5, pick(night ? ["#a43c78", "#2c8aa0"] : ["#e8584a", "#4a90d8", "#f2c14e", "#f4f1ea"]));
          lit.box(x + 0.7, y, z + 0.6, 0.5, 0.45, 0.5, dim("#8c6a4a"));
          lit.box(x - 0.7, y, z - 0.6, 0.5, 0.45, 0.5, dim("#8c6a4a"));
        } else if (k < 0.6) treeCluster(x, y, z, 2);
        else if (k < 0.75) {
          lit.box(x, y, z, 1.8, 0.35, 0.6, dim("#d9d3c2"));
          for (let a = 0; a < 4; a++) lit.box(x - 0.7 + a * 0.46, y + 0.35, z, 0.36, 0.3, 0.45, pick(GREENS));
        }
        break;
      }
      case "tech": {
        if (k < 0.3) {
          lit.box(x - 0.5, y, z, 1.0, 0.7, 0.8, dim("#c7ccce"));
          lit.box(x + 0.6, y, z + 0.4, 0.7, 0.9, 0.7, dim("#9aa3a6"));
          for (let a = 0; a < 5; a++) lit.box(x - 0.9 + a * 0.2, y + 0.7, z, 0.04, 0.05, 0.8, dim("#6a7476"));
        } else if (k < 0.5) {
          lit.box(x, y + 0.4, z, 0.7, 0.9, 0.7, dim("#b9805a"));
          for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) lit.box(x + dx, y, z + dz, 0.06, 0.4, 0.06, dim("#4a4a4a"));
        } else if (k < 0.65) {
          lit.box(x, y, z, 0.05, 2.0 + rr(), 0.05, dim("#cfd4d6"));
          glow.box(x, y + 2.1 + rr() * 0.5, z, 0.08, 0.08, 0.08, "#ff3b3b", night ? 2.4 : 0.9);
        } else if (k < 0.8) {
          lit.tilted(x, y + 0.5, z, 0.9, 0.06, 0.9, -0.9, 0.5, 0, dim("#e8e8e4"));
          lit.box(x, y, z, 0.06, 0.5, 0.06, dim("#b0b4b4"));
        } else turbine(x, y, z, 1.2 + rr() * 0.6);
        break;
      }
      case "solar": {
        for (let a = -1; a <= 1; a++) lit.tilted(x + a * 0.9, y + 0.35, z, 0.8, 0.05, 1.3, -0.5, 0, 0, dim("#2a4b7a"));
        break;
      }
      default:
        break;
    }
    if (k > 0.8 && v.roof !== "none" && v.roof !== "crops") turbine(x + (rr() - 0.5) * 2, y, z + (rr() - 0.5) * 2, 1.0 + rr() * 0.6);
  }

  return { vols, W, D, lit, glow, glass, roofs, faces, occ, top, cx, cz };
}

/** Darken/tint a hex colour: `k` scales it, `tint` multiplies r, g, b. */
export function shade(hex: string, k: number, tint: [number, number, number] = [1, 1, 1]): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (v: number, t: number) => Math.max(0, Math.min(255, Math.round(v * k * t)));
  const r = ch((n >> 16) & 255, tint[0]);
  const g = ch((n >> 8) & 255, tint[1]);
  const b = ch(n & 255, tint[2]);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
