import { TILE } from "@tokenmaxxing/core/world.ts";
import { world } from "./world.ts";

/** The current view, kept for turning clicks into tiles. */
export const camera = { x: 0, y: 0, scale: 1, dpr: 1 };

const ZOOM_KEY = "tokenmaxxing.zoom";

/**
 * Zoom is device pixels per world pixel, always a whole number so the pixel art
 * stays crisp. `null` follows the window size; the player's choice is saved.
 */
let chosenScale: number | null = Number(localStorage.getItem(ZOOM_KEY)) || null;

const zoomRange = { min: 1, max: 12 };

/** The scale on screen, easing towards the chosen one: zooming glides instead of jumping. */
let shown: number | null = null;
let shownAt = 0;
/** How quickly the view catches up with a zoom: about 90% of the way in a quarter second. */
const ZOOM_EASE_MS = 110;

/**
 * This frame's scale. It eases towards the target, which is always a whole number, so the art is only
 * in between sizes while it moves and crisp again once it settles.
 */
export function zoomScale(dpr: number, w: number, h: number, now: number): number {
  const target = targetScale(dpr, w, h);
  if (shown === null || Math.abs(target - shown) < 0.01) shown = target;
  else shown += (target - shown) * (1 - Math.exp(-(now - shownAt) / ZOOM_EASE_MS));
  shownAt = now;
  return shown;
}

function targetScale(dpr: number, w: number, h: number): number {
  const map = world.map;
  const auto = Math.max(2, Math.min(5, Math.round(window.innerHeight / (TILE * 13)))) * dpr;
  // Out: until the whole map fits, but never above the default (small rooms fit early).
  // In: twice the old closest view.
  const fit = Math.min(Math.floor(w / (map.width * TILE)), Math.floor(h / (map.height * TILE)));
  zoomRange.min = Math.max(1, Math.min(fit, auto));
  zoomRange.max = Math.round(10 * dpr);
  return Math.max(zoomRange.min, Math.min(zoomRange.max, chosenScale ?? auto));
}

/** Zooms one step in (+1) or out (-1), or back to following the window (0). */
export function zoom(step: 1 | -1 | 0): void {
  if (step === 0) chosenScale = null;
  else
    chosenScale = Math.max(
      zoomRange.min,
      Math.min(
        zoomRange.max,
        Math.round(chosenScale ?? camera.scale) + step * Math.max(1, Math.round(camera.dpr)),
      ),
    );
  if (chosenScale === null) localStorage.removeItem(ZOOM_KEY);
  else localStorage.setItem(ZOOM_KEY, String(chosenScale));
}
