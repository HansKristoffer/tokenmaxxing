/**
 * Small pieces the Clothes shop is dressed with: price tags with a rarity bar and a lock, the padlock itself,
 * the shop sign, and the speech bubble over the shopkeeper.
 */
import * as THREE from "three";
import { canvasTexture, glow, Model, painted } from "../kit/kit.ts";
import { isLocked, metaOf, RARITY_HEX, type ShopItem } from "./clothes-items.ts";

export const INK = "#2a2230";
export const GOLD = "#f5c842";
export const PLUM = "#6b3f6e";
export const PINK = "#e8789a";
export const CREAM = "#fbf4ea";

/** Word-wraps `text` to `max` pixels. Two lines at most: `priceTag` has room for two under the rarity bar. */
const fit = (ctx: CanvasRenderingContext2D, text: string, max: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
};

/** A padlock glyph drawn on the canvas: a shackle over a body, with a keyhole in INK. */
function lockGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + size * 0.45, size, size * 0.55);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.16);
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size * 0.45, size * 0.28, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(x + size * 0.44, y + size * 0.62, size * 0.12, size * 0.2);
}

/** What a tag says about how to get the item. */
export function priceLine(item: ShopItem): string {
  const meta = metaOf.get(item.id);
  if (meta?.boss) return `${meta.boss} drop`;
  if (item.level !== undefined) return `Lv ${item.level}`;
  return item.price === 0 ? "Free" : String(item.price);
}

/** A tag `w` x `h` world units: the rarity bar, the name, the price (a coin) or the lock with its level or boss. */
export function priceTag(item: ShopItem, w = 0.8, h = 0.3): Model {
  const px = 200;
  const rarity = RARITY_HEX[metaOf.get(item.id)?.rarity ?? "common"];
  const locked = isLocked(item.id);
  const tag = new Model();
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);

  const tex = canvasTexture(
    cw,
    ch,
    (ctx) => {
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = rarity;
      ctx.fillRect(0, 0, cw, Math.round(ch * 0.2));

      ctx.fillStyle = INK;
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(ch * 0.2)}px system-ui, sans-serif`;
      const lines = fit(ctx, item.name, cw - 12);
      for (const [index, line] of lines.entries()) ctx.fillText(line, 6, ch * (0.36 + index * 0.19), cw - 10);

      const y = ch * 0.8;
      ctx.font = `900 ${Math.round(ch * 0.26)}px system-ui, sans-serif`;
      if (locked) {
        lockGlyph(ctx, 6, y - ch * 0.15, ch * 0.28, item.level !== undefined ? GOLD : "#d23c3c");
        ctx.fillStyle = INK;
        ctx.fillText(priceLine(item), 8 + ch * 0.34, y, cw - ch * 0.4);
      } else {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(6 + ch * 0.12, y, ch * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#b8901a";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.fillText(priceLine(item), 10 + ch * 0.26, y);
      }
    },
    true,
  );

  tag.box([w + 0.03, h + 0.03, 0.025], INK, [0, 0, 0], 0.006);
  tag.plane(w, h, painted(tex), [0, (h + 0.03) / 2, 0.014]);
  return tag;
}

/** A padlock about a tenth of a tile across: gold for a level reward, red for a boss drop. */
export function padlock(color: string): Model {
  const m = new Model();
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.012, 6, 10, Math.PI),
    new THREE.MeshToonMaterial({ color: "#c9ced6" }),
  );
  arc.position.set(0, 0.09, 0);
  m.add(arc);
  m.box([0.13, 0.1, 0.05], color, [0, 0, 0], 0.012);
  m.box([0.02, 0.04, 0.012], INK, [0, 0.03, 0.03], 0.003);
  return m;
}

export function lockFor(id: string): Model {
  return padlock(metaOf.get(id)?.boss ? "#d23c3c" : GOLD);
}

/** A hanging board: a lit sign in the shop's pink and gold. */
export function signBoard(
  text: string,
  w: number,
  h: number,
  opts: { sub?: string; lit?: boolean } = {},
): Model {
  const px = 120;
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);

  const tex = canvasTexture(
    cw,
    ch,
    (ctx) => {
      ctx.fillStyle = PLUM;
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = Math.max(3, ch * 0.05);
      ctx.strokeRect(ch * 0.08, ch * 0.08, cw - ch * 0.16, ch * 0.84);

      ctx.fillStyle = "#ffe9b0";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${Math.round(ch * (opts.sub ? 0.4 : 0.5))}px Georgia, serif`;
      ctx.fillText(text, cw / 2, ch * (opts.sub ? 0.42 : 0.52), cw * 0.9);

      if (opts.sub) {
        ctx.fillStyle = PINK;
        ctx.font = `800 ${Math.round(ch * 0.2)}px system-ui, sans-serif`;
        ctx.fillText(opts.sub, cw / 2, ch * 0.76, cw * 0.9);
      }
    },
    true,
  );

  const board = new Model();
  board.box([w + 0.1, h + 0.1, 0.08], INK, [0, 0, 0], 0.02);
  board.plane(w, h, opts.lit ? glow("#fff", tex) : painted(tex), [0, (h + 0.1) / 2, 0.045]);
  return board;
}

/** A speech bubble that always faces the camera. */
export function bubble(lines: string[], name: string): { sprite: THREE.Sprite; say: (line: string) => void } {
  const cw = 360;
  const ch = 110;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const draw = (line: string) => {
    ctx.clearRect(0, 0, cw, ch);

    // The rounded body, then the tail pointing down at the shopkeeper.
    ctx.fillStyle = "#fffaf0";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(4, 4, cw - 8, 78, 16);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cw / 2 - 12, 80);
    ctx.lineTo(cw / 2, 106);
    ctx.lineTo(cw / 2 + 12, 80);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(cw / 2 - 10, 78, 20, 6);

    ctx.fillStyle = PINK;
    ctx.font = "800 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, cw / 2, 28);

    ctx.fillStyle = INK;
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillText(line, cw / 2, 60, cw - 28);
    tex.needsUpdate = true;
  };

  draw(lines[0] ?? "Welcome!");
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(1.5, 1.5 * (ch / cw), 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;
  return { sprite, say: draw };
}
