/** Signage: day boards and night neon, all through panel() so they're canvas-textured and lit. */
import type * as THREE from "three";
import { glow, Model } from "../kit.ts";
import { type Panel, panel } from "../panel.ts";
import type { Theme } from "./city.ts";

export interface SignOpts {
  fg: string;
  bg?: string;
  /** Second colour for a neon outline / underline. */
  alt?: string;
  font?: string;
  /** A little glyph (emoji-free pixel icon): drawn by the callback on the left. */
  icon?: (g: CanvasRenderingContext2D, h: number, colour: string) => void;
  theme: Theme;
  frame?: string;
  vertical?: boolean;
}

export function sign(text: string, w: number, h: number, o: SignOpts): Panel {
  const neon = o.theme === "cyber";
  const px = 40;
  const draw = (g: CanvasRenderingContext2D, cw: number, ch: number) => {
    g.fillStyle = neon ? (o.bg ?? "#0b0716") : (o.bg ?? "#2b2433");
    g.fillRect(0, 0, cw, ch);
    if (neon) {
      const grad = g.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, "rgba(255,255,255,0.06)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, cw, ch);
    }
    const pad = Math.round(ch * 0.1);
    g.strokeStyle = o.alt ?? o.fg;
    g.lineWidth = Math.max(3, ch * 0.05);
    if (neon) {
      g.shadowColor = o.alt ?? o.fg;
      g.shadowBlur = ch * 0.25;
    }
    g.strokeRect(pad, pad, cw - pad * 2, ch - pad * 2);
    g.shadowBlur = 0;
    let x0 = 0;
    if (o.icon) {
      o.icon(g, ch, o.fg);
      x0 = ch * 0.9;
    }
    g.fillStyle = o.fg;
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (o.vertical) {
      const chars = [...text];
      const sz = Math.min(cw * 0.62, (ch * 0.86) / chars.length);
      g.font = `900 ${sz}px Impact, 'Arial Black', system-ui, sans-serif`;
      chars.forEach((c, k) => {
        const yy = ch * 0.07 + sz * 0.5 + (k * (ch * 0.86)) / chars.length + ((ch * 0.86) / chars.length - sz) / 2 + sz * 0.1;
        if (neon) {
          g.shadowColor = o.fg;
          g.shadowBlur = cw * 0.14;
          g.fillText(c, cw / 2, yy);
          g.shadowBlur = 0;
          g.fillStyle = "#fff";
          g.globalAlpha = 0.5;
          g.fillText(c, cw / 2, yy);
          g.globalAlpha = 1;
          g.fillStyle = o.fg;
        } else g.fillText(c, cw / 2, yy);
      });
      return;
    }
    const size = Math.floor(ch * 0.52);
    g.font = `900 ${size}px ${o.font ?? "Impact, 'Arial Black', system-ui, sans-serif"}`;
    let s = size;
    while (g.measureText(text).width > cw - x0 - pad * 3 && s > 8) {
      s -= 2;
      g.font = `900 ${s}px ${o.font ?? "Impact, 'Arial Black', system-ui, sans-serif"}`;
    }
    if (neon) {
      g.shadowColor = o.fg;
      g.shadowBlur = ch * 0.16;
      g.fillText(text, x0 + (cw - x0) / 2, ch * 0.54);
      g.fillText(text, x0 + (cw - x0) / 2, ch * 0.54);
      g.shadowBlur = 0;
      g.fillStyle = "#ffffff";
      g.globalAlpha = 0.55;
      g.fillText(text, x0 + (cw - x0) / 2, ch * 0.54);
      g.globalAlpha = 1;
    } else g.fillText(text, x0 + (cw - x0) / 2, ch * 0.54);
  };
  return panel(w, h, draw, { frame: o.frame ?? (neon ? "#14101f" : "#3a2a1c"), px, lit: neon, smooth: true });
}

/** Place a model on a wall: `nx, nz` the outward normal; the model's +z faces out. */
export function onWall(parent: THREE.Object3D, m: THREE.Object3D, x: number, y: number, z: number, nx: number, nz: number): void {
  m.position.set(x, y, z);
  m.rotation.y = Math.atan2(nx, nz);
  parent.add(m);
}

/** Pixel-art blocks from a string grid, unlit or glowing. */
export function pixels(rows: string[], cell: number, colours: Record<string, string>, lit = true): Model {
  const m = new Model();
  const h = rows.length;
  rows.forEach((row, ry) => {
    for (let cx = 0; cx < row.length; cx++) {
      const c = colours[row[cx]!];
      if (!c) continue;
      m.box([cell, cell, 0.12], lit ? glow(c) : c, [(cx - row.length / 2 + 0.5) * cell, (h - 1 - ry) * cell, 0], 0);
    }
  });
  return m;
}
