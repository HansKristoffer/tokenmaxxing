import type { Peek } from "@tokenmaxxing/core/world.ts";
import { C } from "../art/palette.ts";
import { BURST_MS } from "./emoji.ts";
import { type Avatar, gameTag, world } from "./world.ts";

/** Name chips under house signs this frame, in canvas (device) pixels. */
export const chipHits: { x: number; y: number; w: number; h: number; id: number }[] = [];

/** At most this many names show under a house's sign; the rest are a "+N". */
const CHIPS_MAX = 4;

/** One row of `💤 name Lv5` chips centred under a house's sign; clicking one opens their card. */
export function chips(g: CanvasRenderingContext2D, cx: number, y: number, people: Peek[], dpr: number): void {
  g.font = `600 ${10 * dpr}px ${FONT}`;
  const shown = people.slice(0, CHIPS_MAX);
  const texts = shown.map(
    (p) => `${p.state === "away" ? "💤 " : p.state === "working" ? "💻 " : ""}${p.name} Lv${p.level}`,
  );
  if (people.length > shown.length) texts.push(`+${people.length - shown.length}`);
  const pad = 5 * dpr;
  const gap = 3 * dpr;
  const h = 14 * dpr;
  const widths = texts.map((t) => g.measureText(t).width + pad * 2);
  let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)) / 2;
  g.textAlign = "left";
  g.textBaseline = "middle";
  for (const [i, text] of texts.entries()) {
    const w = widths[i]!;
    g.fillStyle = "rgba(27, 31, 42, 0.82)";
    g.beginPath();
    g.roundRect(x, y, w, h, 4 * dpr);
    g.fill();
    g.fillStyle = C.white;
    g.fillText(text, x + pad, y + h / 2 + 0.5 * dpr);
    const p = shown[i];
    if (p) chipHits.push({ x, y, w, h, id: p.id });
    x += w + gap;
  }
}

export const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

export function pill(
  g: CanvasRenderingContext2D,
  cx: number,
  y: number,
  text: string,
  dpr: number,
  bg: string,
  fg: string,
) {
  g.font = `600 ${11 * dpr}px ${FONT}`;
  const w = g.measureText(text).width + 10 * dpr;
  const h = 15 * dpr;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(cx - w / 2, y - h, w, h, 4 * dpr);
  g.fill();
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, cx, y - h / 2 + 0.5 * dpr);
  return { w, h };
}

export function sign(
  g: CanvasRenderingContext2D,
  cx: number,
  y: number,
  text: string,
  dpr: number,
  owned: boolean,
) {
  pill(
    g,
    cx,
    y,
    text,
    dpr,
    owned ? "rgba(251, 247, 239, 0.95)" : "rgba(43, 36, 51, 0.7)",
    owned ? C.ink : C.white,
  );
}

export function avatarLabels(
  g: CanvasRenderingContext2D,
  a: Avatar,
  cx: number,
  top: number,
  tile: string,
  now: number,
  dpr: number,
): void {
  if (a.warp?.out) return;
  const resting = a.state === "away" || a.state === "working";
  let y = top - (a.state === "away" || tile === "b" ? -2 : 4) * dpr;
  // Everyone else's name and level; you know your own.
  if (a.info.id !== world.selfId) {
    const tag = `${a.info.name} · Lv${a.info.level}`;
    const bg = a.info.online ? "rgba(27, 31, 42, 0.78)" : "rgba(27, 31, 42, 0.45)";
    y -= pill(g, cx, y, tag, dpr, bg, C.white).h + 2 * dpr;
  }
  if (a.state === "away") {
    const t = (now / 900) % 1;
    g.font = `700 ${(10 + t * 4) * dpr}px ${FONT}`;
    g.fillStyle = `rgba(255, 255, 255, ${1 - t})`;
    g.textAlign = "center";
    g.fillText("z", cx + (8 + t * 8) * dpr, y - t * 12 * dpr);
  } else if (a.state === "working") {
    y -=
      pill(g, cx, y, `💻 ×${Math.max(1, a.info.liveAgents)}`, dpr, "rgba(143, 227, 255, 0.95)", C.ink).h +
      2 * dpr;
  }
  const inGame = gameTag(a.info.id);
  if (inGame) y -= pill(g, cx, y, inGame, dpr, "rgba(233, 183, 61, 0.95)", C.ink).h + 2 * dpr;
  if (a.bubble && now < a.bubble.until && !resting)
    bubble(g, cx, y, a.bubble.text, dpr, a.bubble.until - now);
  if (a.burst && now - a.burst.at < BURST_MS) burst(g, cx, top, a.burst.emojis, now - a.burst.at, dpr);
}

const BURST_COUNT = 10;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Emoji popping out around someone's head and floating up: `BURST_COUNT` copies
 * (taking turns when there are several) fanned over the top half, a little
 * staggered, fading out at the end.
 */
function burst(
  g: CanvasRenderingContext2D,
  cx: number,
  top: number,
  emojis: string[],
  elapsed: number,
  dpr: number,
) {
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < BURST_COUNT; i++) {
    const delay = (i % 4) * 80;
    const t = Math.min(1, Math.max(0, (elapsed - delay) / (BURST_MS - 320)));
    if (t === 0) continue;
    const angle = -Math.PI / 2 + ((i + 0.5) / BURST_COUNT - 0.5) * Math.PI * 1.5;
    const reach = (14 + 38 * easeOut(t) + (i % 3) * 6) * dpr;
    const x = cx + Math.cos(angle) * reach;
    const y = top + 4 * dpr + Math.sin(angle) * reach * 0.8 - 22 * t * dpr;
    const pop = t < 0.15 ? t / 0.15 : 1;
    g.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    g.font = `${(12 + 8 * pop + (i % 2) * 3) * dpr}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.fillText(emojis[i % emojis.length]!, x, y);
  }
  g.globalAlpha = 1;
}

/** Bubble text wrapped into at most 3 lines, and its width; measured once per text, not every frame. */
const wraps = new Map<string, { shown: string[]; w: number }>();
function wrapped(g: CanvasRenderingContext2D, text: string, dpr: number) {
  const key = `${dpr}\0${text}`;
  const hit = wraps.get(key);
  if (hit) return hit;
  const maxW = 190 * dpr;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  const shown = lines.slice(0, 3);
  if (lines.length > 3) shown[2] = `${shown[2]!.slice(0, -1)}…`;
  const w = Math.min(maxW, Math.max(...shown.map((l) => g.measureText(l).width))) + 14 * dpr;
  if (wraps.size > 500) wraps.clear();
  wraps.set(key, { shown, w });
  return { shown, w };
}

export function bubble(
  g: CanvasRenderingContext2D,
  cx: number,
  bottom: number,
  text: string,
  dpr: number,
  left: number,
) {
  g.font = `500 ${12 * dpr}px ${FONT}`;
  const { shown, w } = wrapped(g, text, dpr);
  const lh = 15 * dpr;
  const h = shown.length * lh + 8 * dpr;
  const y = bottom - h - 6 * dpr;
  g.globalAlpha = Math.min(1, left / 400);
  g.fillStyle = C.white;
  g.strokeStyle = C.ink;
  g.lineWidth = 2 * dpr;
  g.beginPath();
  g.roundRect(cx - w / 2, y, w, h, 6 * dpr);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(cx - 5 * dpr, y + h);
  g.lineTo(cx, y + h + 6 * dpr);
  g.lineTo(cx + 5 * dpr, y + h);
  g.fill();
  g.fillStyle = C.ink;
  g.textAlign = "center";
  g.textBaseline = "top";
  for (const [i, l] of shown.entries()) g.fillText(l, cx, y + 5 * dpr + i * lh);
  g.globalAlpha = 1;
}
