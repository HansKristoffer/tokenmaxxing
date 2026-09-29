import { blockOf, type GameMap, PLOT_H, PLOT_W, plotId } from "@tokenmaxxing/core/maps.ts";
import { type Peek, TILE } from "@tokenmaxxing/core/world.ts";
import type { Pane } from "../art/buildings.ts";
import { characterFrame, sleeperFrame } from "../art/characters.ts";
import { world } from "./world.ts";

/** Faces in house windows this frame, in world pixels, so clicks can find them. */
export const peekHits: { x: number; y: number; w: number; h: number; id: number }[] = [];

interface Building {
  /** Footprint in tiles; the door is on the bottom row. */
  x: number;
  y: number;
  w: number;
  h: number;
  plot: number | null;
}

const buildingCache = new WeakMap<GameMap, Building[]>();

/** Company houses (7×5, door in the middle of the bottom row) and the Inn (7×4), from the town grid. */
export function buildings(map: GameMap): Building[] {
  let list = buildingCache.get(map);
  if (list) return list;
  list = [];
  if (map.id === "town") {
    for (const [dx, dy] of map.find("D"))
      list.push({ x: dx - 3, y: dy - 4, w: PLOT_W, h: PLOT_H, plot: plotId(...blockOf(dx, dy)) });
    const [ix, iy] = map.find("I")[0]!;
    list.push({ x: ix - 3, y: iy - 3, w: 7, h: 4, plot: null });
  }
  buildingCache.set(map, list);
  return list;
}

export const buildingAt = (x: number, y: number): Building | undefined =>
  buildings(world.map).find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);

export function companyOnPlot(plot: number) {
  for (const c of world.companies.values()) if (c.plot === plot) return c;
  return undefined;
}

const logos = new Map<string, HTMLCanvasElement | null>();

/**
 * A company logo shrunk to fit a `w`×`h` plaque. Downscaled once with smoothing, then
 * drawn 1:1 in world pixels, so it comes out pixelated like the rest of the town.
 * Null until it has loaded (or if it never does).
 */
export function logoSprite(src: string, w: number, h: number): HTMLCanvasElement | null {
  const key = `${src} ${w}x${h}`;
  if (logos.has(key)) return logos.get(key)!;
  logos.set(key, null);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(w / (img.naturalWidth || w), h / (img.naturalHeight || h));
    const dw = Math.max(1, Math.round((img.naturalWidth || w) * scale));
    const dh = Math.max(1, Math.round((img.naturalHeight || h) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext("2d")!;
    c.imageSmoothingQuality = "high";
    c.drawImage(img, Math.floor((w - dw) / 2), Math.floor((h - dh) / 2), dw, dh);
    logos.set(key, canvas);
  };
  img.src = src;
  return null;
}

/** Someone inside, seen through a window: their face against a lit room, or asleep in the dark. */
export function drawFace(
  g: CanvasRenderingContext2D,
  p: Peek,
  x: number,
  y: number,
  pane: Pane,
  now: number,
): void {
  const asleep = p.state === "away";
  g.save();
  g.beginPath();
  g.rect(x, y, pane.w, pane.h);
  g.clip();
  g.fillStyle = asleep ? "#2e3a5c" : p.state === "working" ? "#bfe9ff" : "#ffe9b0";
  g.fillRect(x, y, pane.w, pane.h);
  const frame = asleep ? sleeperFrame(p.look) : characterFrame(p.look, "down", "stand");
  // Working: the head bobs along with the typing, like at the desk.
  const bob = p.state === "working" && Math.floor(now / 180) % 2 === 0 ? 1 : 0;
  g.drawImage(frame, x + Math.floor((pane.w - TILE) / 2), y - 1 + (asleep ? 2 : bob));
  // Glass: a glint, and the frame's cross bar at the top.
  g.fillStyle = "rgba(255, 255, 255, 0.35)";
  g.fillRect(x, y, pane.w, 1);
  g.fillRect(x + pane.w - 3, y + 1, 2, 1);
  g.restore();
}
