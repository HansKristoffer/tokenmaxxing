/**
 * The town's ground, painted once on one canvas from the tile map: lawns, roads with kerbs, the square's paving
 * (setts in a brick border, light slabs along its two axes, a rosette round the fountain), the cobbled street
 * round it, flower beds set in the paving, the pond and its jetty. And the soil that shows on the island's edge.
 */

import { JULE_GATE_DOOR } from "@tokenmaxxing/core/julemarked.ts";
import { bakedLook } from "@tokenmaxxing/core/seasons.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { seasonGrass, seasonLitter, seasonLookNow } from "../../game/seasons.ts";
import { PLAZA, type TownMap } from "../data/town.ts";
import { canvasTexture, seeded } from "../kit/kit.ts";
import { SHOP_DOOR_CHAR } from "../shops/catalog.ts";

/** Grass tiles round the map's tree ring. */
export const MARGIN = 3;

export const hash = (x: number, y: number, k: number): number => seeded(x * 7919 + y * 104729 + k * 31)();

type Ground = "grass" | "path" | "plaza" | "flowers" | "water";
const GROUND: Record<string, Ground> = {
  ".": "grass",
  ",": "path",
  ":": "plaza",
  '"': "flowers",
  "~": "water",
};

/** What a tile's ground is made of: its own, or for a prop or a building what most of its neighbours are. */
function groundAt(map: TownMap, x: number, y: number): Ground {
  const ch = map.at(x, y);
  const own = GROUND[ch];
  if (own) return own;
  if ("IDA".includes(ch) || ch === JULE_GATE_DOOR || Object.values(SHOP_DOOR_CHAR).includes(ch))
    return "path";
  const counts = new Map<Ground, number>();
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [-1, 1],
  ] as const) {
    const g = GROUND[map.at(x + dx, y + dy)];
    if (g && g !== "water") counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "grass";
}

/**
 * What is painted on a tile. On top of its ground: `street` is a road that runs along paving (the cobbles round
 * the square), `bed` a flower tile set in paving, `jetty` a path with the pond on both sides of it.
 */
export type Surface = Ground | "street" | "bed" | "jetty";

const SIDES = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

export function surfaceAt(map: TownMap, x: number, y: number): Surface {
  const ground = map.contains(x, y) ? groundAt(map, x, y) : "grass";
  if (ground === "flowers")
    return SIDES.some(([dx, dy]) => map.at(x + dx, y + dy) === ":") ? "bed" : "flowers";
  if (ground !== "path") return ground;
  const wet = (dx: number, dy: number) => map.at(x + dx, y + dy) === "~";
  if ((wet(0, -1) && wet(0, 1)) || (wet(-1, 0) && wet(1, 0))) return "jetty";
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && map.contains(x + dx, y + dy) && groundAt(map, x + dx, y + dy) === "plaza")
        return "street";
  return "path";
}

/** Whether a jetty tile's boards run north to south (the pond is east and west of it). */
export const jettyRunsNorth = (map: TownMap, x: number, y: number): boolean =>
  map.at(x - 1, y) === "~" && map.at(x + 1, y) === "~";

// The paving's stone, warm so the lawns and the water sit well against it.
const SETT = ["#d9ccb0", "#cfc1a3", "#c6b797", "#d3c5a8"];
const SETT_JOINT = "#ad9f84";
const SLAB = ["#f1e8d4", "#ebe1cb", "#e5dac2"];
const SLAB_JOINT = "#cbbea4";
const WEAVE = ["#cdbb96", "#c2b08a", "#d4c3a0"];
const WEAVE_JOINT = "#a3947a";
const BRICK = ["#c58a6a", "#b97c5e", "#cf9777", "#ae7355"];
const BRICK_JOINT = "#8f5d45";
const COBBLE = ["#c3b7a3", "#b5a994", "#aa9e8a", "#bcb09c"];
const COBBLE_JOINT = "#8d8272";
const KERB = ["#e9e1cf", "#d3c9b4"];

/** The whole ground in one canvas, `px` pixels to the tile. */
export function groundTexture(map: TownMap, px: number): THREE.CanvasTexture {
  const { look } = seasonLookNow();
  const l = bakedLook(look);
  const grassColors = [seasonGrass(0, l, "#86c35e"), seasonGrass(0, l, "#80bd58")];
  const blades = [seasonGrass(1, l), seasonGrass(2, l)];
  const W = map.width + MARGIN * 2;
  const D = map.height + MARGIN * 2;
  // One pixel of the 2D game's 16 to a tile, never under one.
  const u = (n: number) => Math.max(1, Math.round((px * n) / 16));
  return canvasTexture(
    W * px,
    D * px,
    (g) => {
      const rnd = seeded(5);
      const surfaces: Surface[] = [];
      for (let cy = 0; cy < D; cy++)
        for (let cx = 0; cx < W; cx++)
          surfaces.push(surfaceAt(map, cx - MARGIN + map.x0, cy - MARGIN + map.y0));
      const at = (cx: number, cy: number): Surface =>
        cx < 0 || cy < 0 || cx >= W || cy >= D ? "grass" : surfaces[cy * W + cx]!;
      const soft = (s: Surface) => s === "grass" || s === "flowers";
      const paved = (s: Surface) => s === "plaza" || s === "bed";

      const leaves = (tx: number, ty: number, ox: number, oy: number, most: number) => {
        const n = Math.round(l.litter * most * hash(tx, ty, 60) * 2);
        for (let k = 0; k < n; k++) {
          g.fillStyle = seasonLitter(hash(tx, ty, 61 + k));
          g.fillRect(
            ox + hash(tx, ty, 70 + k) * px * 0.9,
            oy + hash(tx, ty, 80 + k) * px * 0.9,
            Math.max(1, px / 10),
            Math.max(1, px / 14),
          );
        }
      };
      /** Stones in courses `h` high and `w` long, every other course half a stone along. */
      const courses = (
        ox: number,
        oy: number,
        w: number,
        h: number,
        tones: readonly string[],
        joint: string,
        seed: number,
      ) => {
        g.fillStyle = joint;
        g.fillRect(ox, oy, px, px);
        const gap = px >= 24 ? 1 : 0;
        for (let r = 0; r * h < px; r++) {
          const off = r % 2 ? -w / 2 : 0;
          for (let x = off; x < px; x += w) {
            const x0 = Math.max(0, x);
            const x1 = Math.min(px, x + w);
            g.fillStyle =
              tones[Math.floor(hash(Math.round(ox + x), Math.round(oy + r * h), seed) * tones.length)]!;
            g.fillRect(ox + x0, oy + r * h, x1 - x0 - gap, Math.min(h, px - r * h) - gap);
          }
        }
      };
      /** A strip along one side of a tile: `side` 0 north, 1 south, 2 west, 3 east; `inset` in from the edge. */
      const strip = (ox: number, oy: number, side: number, inset: number, wide: number) => {
        if (side === 0) g.fillRect(ox, oy + inset, px, wide);
        else if (side === 1) g.fillRect(ox, oy + px - inset - wide, px, wide);
        else if (side === 2) g.fillRect(ox + inset, oy, wide, px);
        else g.fillRect(ox + px - inset - wide, oy, wide, px);
      };
      /** Kerb stones along one side of a tile, a light one and a darker one in turn. */
      const kerb = (ox: number, oy: number, side: number, wide: number) => {
        const n = 4;
        for (let i = 0; i < n; i++) {
          g.fillStyle = KERB[i % 2]!;
          const a = Math.round((i * px) / n);
          const len = Math.round(((i + 1) * px) / n) - a;
          if (side === 0) g.fillRect(ox + a, oy, len, wide);
          else if (side === 1) g.fillRect(ox + a, oy + px - wide, len, wide);
          else if (side === 2) g.fillRect(ox, oy + a, wide, len);
          else g.fillRect(ox + px - wide, oy + a, wide, len);
        }
      };

      for (let cy = 0; cy < D; cy++)
        for (let cx = 0; cx < W; cx++) {
          const tx = cx - MARGIN + map.x0;
          const ty = cy - MARGIN + map.y0;
          const kind = at(cx, cy);
          const ox = cx * px;
          const oy = cy * px;
          const around = SIDES.map(([dx, dy]) => at(cx + dx, cy + dy));
          if (kind === "grass" || kind === "flowers") {
            g.fillStyle = grassColors[(cx + cy) % 2]!;
            g.fillRect(ox, oy, px, px);
            for (let i = 0; i < px * 0.7; i++) {
              g.fillStyle = blades[rnd() < 0.5 ? 0 : 1]!;
              g.fillRect(ox + rnd() * px, oy + rnd() * px, Math.max(1, px / 14), Math.max(2, px / 8));
            }
            // Fallen leaves, more on the lawns than on the swept paths (the 2D ground's litter).
            leaves(tx, ty, ox, oy, 3);
            if (kind === "flowers" && hash(tx, ty, 9) >= l.dormant) {
              for (let k = 0; k < 4; k++) {
                const fx = ox + (2 + Math.floor(hash(tx, ty, 10 + k) * 11)) * (px / 16);
                const fy = oy + (2 + Math.floor(hash(tx, ty, 20 + k) * 11)) * (px / 16);
                g.fillStyle = [C.flowerRed, C.flowerYellow, C.flowerWhite][
                  Math.floor(hash(tx, ty, 30 + k) * 3)
                ]!;
                g.fillRect(fx - px / 16, fy, (px * 3) / 16, px / 16);
                g.fillRect(fx, fy - px / 16, px / 16, (px * 3) / 16);
              }
            }
          } else if (kind === "path") {
            g.fillStyle = C.path;
            g.fillRect(ox, oy, px, px);
            for (let i = 0; i < px * 0.8; i++) {
              g.fillStyle = rnd() < 0.5 ? C.pathDark : C.pathLight;
              g.fillRect(ox + rnd() * px, oy + rnd() * px, Math.max(1, px / 14), Math.max(1, px / 14));
            }
            // Kerb stones where it meets the lawn, and their shadow on the road.
            around.forEach((s, side) => {
              if (!soft(s)) return;
              g.fillStyle = C.pathDark;
              strip(ox, oy, side, u(1.5), u(1));
              kerb(ox, oy, side, u(1.5));
            });
            leaves(tx, ty, ox, oy, 1);
          } else if (kind === "street") {
            courses(ox, oy, px / 4, px / 4, COBBLE, COBBLE_JOINT, 41);
            around.forEach((s, side) => {
              if (soft(s)) kerb(ox, oy, side, u(1.5));
            });
            leaves(tx, ty, ox, oy, 1);
          } else if (kind === "plaza") {
            courses(ox, oy, px / 2, px / 4, SETT, SETT_JOINT, 42);
          } else if (kind === "bed") {
            g.fillStyle = "#6b4a33";
            g.fillRect(ox, oy, px, px);
            for (let i = 0; i < px * 1.2; i++) {
              g.fillStyle = rnd() < 0.35 ? "#5a3d2a" : blades[rnd() < 0.5 ? 0 : 1]!;
              g.fillRect(ox + rnd() * px, oy + rnd() * px, u(1), u(1.5));
            }
            around.forEach((s, side) => {
              if (s === "bed") return;
              g.fillStyle = "#b9ae9b";
              strip(ox, oy, side, u(2), u(0.5));
              kerb(ox, oy, side, u(2));
            });
          } else if (kind === "jetty") {
            const north = jettyRunsNorth(map, tx, ty);
            g.fillStyle = "#8a6238";
            g.fillRect(ox, oy, px, px);
            const boards = 4;
            for (let i = 0; i < boards; i++) {
              g.fillStyle = ["#c79a63", "#b98c58", "#cfa46e", "#bd9160"][
                Math.floor(hash(tx * 4 + i, ty, 43) * 4)
              ]!;
              const a = Math.round((i * px) / boards);
              const len = Math.round(((i + 1) * px) / boards) - a - 1;
              if (north) g.fillRect(ox + u(1.5), oy + a, px - u(3), len);
              else g.fillRect(ox + a, oy + u(1.5), len, px - u(3));
            }
          } else {
            g.fillStyle = "#3f89c9";
            g.fillRect(ox, oy, px, px);
            g.fillStyle = C.water;
            g.fillRect(ox + 1, oy + 1, px - 2, px - 2);
            // Shallows along the bank.
            around.forEach((s, side) => {
              if (s === "water" || s === "jetty") return;
              g.fillStyle = "#8ccbee";
              strip(ox, oy, side, 0, u(3));
              g.fillStyle = "#b9e2f6";
              strip(ox, oy, side, 0, u(1));
            });
            for (let i = 0; i < 4; i++) {
              g.fillStyle = C.waterDark;
              g.fillRect(ox + rnd() * px, oy + rnd() * px, px / 5, px / 16);
            }
          }
        }

      // Lighter and darker drifts across the lawns, so a block of grass is not one flat sheet.
      g.save();
      g.beginPath();
      for (let cy = 0; cy < D; cy++)
        for (let cx = 0; cx < W; cx++) if (soft(at(cx, cy))) g.rect(cx * px, cy * px, px, px);
      g.clip();
      const drifts = seeded(31);
      for (let i = 0; i < (W * D) / 5; i++) {
        const [x, y, r] = [drifts() * W * px, drifts() * D * px, (0.7 + drifts() * 1.8) * px];
        const shade = g.createRadialGradient(x, y, 0, x, y, r);
        const tone = drifts() < 0.5 ? "255,250,190" : "20,70,30";
        shade.addColorStop(0, `rgba(${tone},0.1)`);
        shade.addColorStop(1, `rgba(${tone},0)`);
        g.fillStyle = shade;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.restore();

      paveSquare(g, map, px, at, paved, u);
    },
    true,
  );
}

/**
 * The square's own paving, over its setts: a brick border along its edge, light slabs along the two axes
 * through the fountain, and a rosette of rings round it. Nothing here is a tile: people walk over all of it.
 */
function paveSquare(
  g: CanvasRenderingContext2D,
  map: TownMap,
  px: number,
  at: (cx: number, cy: number) => Surface,
  paved: (s: Surface) => boolean,
  u: (n: number) => number,
): void {
  const cxOf = (tx: number) => (tx - map.x0 + MARGIN) * px;
  const cyOf = (ty: number) => (ty - map.y0 + MARGIN) * px;
  const [left, top, right, bottom] = [PLAZA.left, PLAZA.top, PLAZA.right + 1, PLAZA.bottom + 1];
  // South of the lamps the paving runs on between the two lawns: bordered like the rest, and the axis reaches it.
  const south = bottom + 2;
  const fountain = map.find("F");
  if (!fountain.length) return;
  const fx = cxOf((Math.min(...fountain.map(([x]) => x)) + Math.max(...fountain.map(([x]) => x)) + 1) / 2);
  const fy = cyOf(
    (Math.min(...fountain.map(([, y]) => y)) + Math.max(...fountain.map(([, y]) => y)) + 1) / 2,
  );

  g.save();
  // Only the square's paving: not its planters and beds, not the gate's block north of it.
  g.beginPath();
  for (let ty = top; ty < south; ty++)
    for (let tx = left; tx < right; tx++) {
      const s = at(tx - map.x0 + MARGIN, ty - map.y0 + MARGIN);
      if (s === "plaza") g.rect(cxOf(tx), cyOf(ty), px, px);
    }
  g.clip();

  const slabs = (x: number, y: number, w: number, h: number, seed: number) => {
    const step = px / 2;
    g.fillStyle = SLAB_JOINT;
    g.fillRect(x, y, w, h);
    for (let sy = 0; sy < h; sy += step)
      for (let sx = 0; sx < w; sx += step) {
        g.fillStyle = SLAB[Math.floor(hash(Math.round(x + sx), Math.round(y + sy), seed) * SLAB.length)]!;
        g.fillRect(x + sx, y + sy, Math.min(step, w - sx) - 1, Math.min(step, h - sy) - 1);
      }
  };
  const line = u(1.5);
  // The axes: two tiles wide, edged in brick.
  g.fillStyle = BRICK[1]!;
  g.fillRect(fx - px - line, cyOf(top), px * 2 + line * 2, (south - top) * px);
  g.fillRect(cxOf(left), fy - px - line, (right - left) * px, px * 2 + line * 2);
  slabs(fx - px, cyOf(top), px * 2, (south - top) * px, 51);
  slabs(cxOf(left), fy - px, (right - left) * px, px * 2, 52);

  // A panel of basket weave in a brick frame in each quarter that has the room for one (the open paving south of
  // the fountain), a tile in from the quarter's edges. In canvas tiles.
  const [fxT, fyT] = [fx / px, fy / px];
  for (const [x0, x1] of [
    [cxOf(left) / px, fxT - 1],
    [fxT + 1, cxOf(right) / px],
  ] as const)
    for (const [y0, y1] of [
      [cyOf(top) / px, fyT - 1],
      [fyT + 1, cyOf(bottom) / px],
    ] as const) {
      const [w, h] = [x1 - x0 - 2, y1 - y0 - 2];
      if (w < 2 || h < 2) continue;
      const [ox, oy] = [(x0 + 1) * px, (y0 + 1) * px];
      const cell = px / 2;
      g.fillStyle = WEAVE_JOINT;
      g.fillRect(ox, oy, w * px, h * px);
      for (let j = 0; j < h * 2; j++)
        for (let i = 0; i < w * 2; i++) {
          const [x, y] = [ox + i * cell, oy + j * cell];
          for (let k = 0; k < 2; k++) {
            g.fillStyle = WEAVE[Math.floor(hash(Math.round(x) + k, Math.round(y), 54) * WEAVE.length)]!;
            if ((i + j) % 2) g.fillRect(x + (k * cell) / 2, y, cell / 2 - 1, cell - 1);
            else g.fillRect(x, y + (k * cell) / 2, cell - 1, cell / 2 - 1);
          }
        }
      g.strokeStyle = BRICK[1]!;
      g.lineWidth = line;
      g.strokeRect(ox, oy, w * px, h * px);
    }

  // The rosette, from the outside in: a brick ring, slabs cut like a fan, a ring of cobbles, the fountain's apron.
  const disc = (r: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(fx, fy, r * px, 0, Math.PI * 2);
    g.fill();
  };
  const spokes = (r0: number, r1: number, n: number, stroke: string, turn = 0) => {
    g.strokeStyle = stroke;
    g.lineWidth = Math.max(1, px / 16);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = turn + (i / n) * Math.PI * 2;
      g.moveTo(fx + Math.cos(a) * r0 * px, fy + Math.sin(a) * r0 * px);
      g.lineTo(fx + Math.cos(a) * r1 * px, fy + Math.sin(a) * r1 * px);
    }
    g.stroke();
  };
  const ring = (r: number, stroke: string, wide: number) => {
    g.strokeStyle = stroke;
    g.lineWidth = wide;
    g.beginPath();
    g.arc(fx, fy, r * px, 0, Math.PI * 2);
    g.stroke();
  };
  disc(3.12, BRICK_JOINT);
  disc(3.08, BRICK[0]!);
  spokes(2.84, 3.08, 56, BRICK_JOINT);
  disc(2.84, SLAB_JOINT);
  disc(2.8, SLAB[1]!);
  spokes(1.9, 2.8, 24, SLAB_JOINT);
  ring(2.35, SLAB_JOINT, Math.max(1, px / 16));
  spokes(2.35, 2.8, 24, SLAB_JOINT, Math.PI / 24);
  disc(1.9, COBBLE_JOINT);
  disc(1.86, COBBLE[1]!);
  spokes(1.42, 1.86, 40, COBBLE_JOINT);
  ring(1.64, COBBLE_JOINT, Math.max(1, px / 16));
  disc(1.42, BRICK_JOINT);
  disc(1.38, SLAB[0]!);
  g.restore();

  // The border: a course of bricks along every edge of the square's paving, a light line inside it.
  const band = u(4);
  for (let ty = top; ty < south; ty++)
    for (let tx = left; tx < right; tx++) {
      const [cx, cy] = [tx - map.x0 + MARGIN, ty - map.y0 + MARGIN];
      if (at(cx, cy) !== "plaza") continue;
      const [ox, oy] = [cx * px, cy * px];
      SIDES.forEach(([dx, dy], side) => {
        if (paved(at(cx + dx, cy + dy))) return;
        const n = 2;
        for (let i = 0; i < n; i++) {
          g.fillStyle = BRICK[Math.floor(hash(tx * 2 + i, ty * 2 + side, 53) * BRICK.length)]!;
          const a = Math.round((i * px) / n);
          const len = Math.round(((i + 1) * px) / n) - a - 1;
          if (side === 0) g.fillRect(ox + a, oy, len, band);
          else if (side === 1) g.fillRect(ox + a, oy + px - band, len, band);
          else if (side === 2) g.fillRect(ox, oy + a, band, len);
          else g.fillRect(ox + px - band, oy + a, band, len);
        }
        g.fillStyle = SLAB[0]!;
        if (side === 0) g.fillRect(ox, oy + band, px, u(1));
        else if (side === 1) g.fillRect(ox, oy + px - band - u(1), px, u(1));
        else if (side === 2) g.fillRect(ox + band, oy, u(1), px);
        else g.fillRect(ox + px - band - u(1), oy, u(1), px);
      });
    }
}

/**
 * The island's edge, seen from the side: turf hanging over the top, then soil in layers with stones in it,
 * darker towards the bottom. It repeats along the edge.
 */
export function soilTexture(): THREE.CanvasTexture {
  const { look } = seasonLookNow();
  const turf = seasonGrass(1, bakedLook(look));
  const [w, h] = [256, 128];
  const t = canvasTexture(
    w,
    h,
    (g) => {
      const rnd = seeded(77);
      const layers = ["#8a6240", "#7c5638", "#6e4c33", "#5e412d", "#4f3727"];
      layers.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(0, (i * h) / layers.length, w, h / layers.length + 1);
      });
      // The layers' edges wander a little.
      for (let i = 1; i < layers.length; i++)
        for (let x = 0; x < w; x += 8) {
          g.fillStyle = layers[i]!;
          g.fillRect(x, (i * h) / layers.length - Math.floor(rnd() * 5), 8, 6);
        }
      for (let i = 0; i < 160; i++) {
        g.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,230,190,0.1)";
        g.fillRect(Math.floor(rnd() * w), 12 + Math.floor(rnd() * (h - 12)), 2 + Math.floor(rnd() * 5), 2);
      }
      for (let i = 0; i < 26; i++) {
        const [x, y, r] = [rnd() * w, 22 + rnd() * (h - 30), 3 + rnd() * 5];
        g.fillStyle = rnd() < 0.5 ? "#a39a8e" : "#8b8378";
        g.beginPath();
        g.ellipse(x, y, r, r * 0.65, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.18)";
        g.fillRect(x - r * 0.5, y - r * 0.45, r, 1);
      }
      // Turf over the lip, in tufts.
      g.fillStyle = turf;
      g.fillRect(0, 0, w, 9);
      for (let x = 0; x < w; x += 4) g.fillRect(x, 9, 4, Math.floor(rnd() * 7));
    },
    true,
  );
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
