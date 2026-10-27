import { CASE_BASE } from "@tokenmaxxing/core/case.ts";
import { bake, cached, type Pen } from "./pixels.ts";

/**
 * The Night Market case's four legendary auras in 2D (`core/src/case.ts`, slot "aura"; 3D in
 * `render3d/people/gear3dAura.ts`). Like the level aura (`aura.ts`) each is a frame drawn behind the character:
 * `CA_W`×`CA_H` with the 16×16 character at (`CA_X`, `CA_Y`) inside it. Eight frames loop, `CA_MS` apiece.
 */
export const CA_X = 6;
export const CA_Y = 6;
export const CA_W = 28;
export const CA_H = 28;
const FRAMES = 8;
export const CA_MS = 170;
const CX = CA_X + 8;
const CY = CA_Y + 8;
const TAU = Math.PI * 2;

type Draw = (p: Pen, f: number) => void;

// Lantern Sky: four paper lanterns on a slow ring, glowing.
// prettier-ignore
const LANTERN = [
  ".d.",
  "ooo",
  "oyo",
  "ooo",
  ".d.",
];
const LANTERN_PAL = { d: "#6b2418", o: "#ff8a3c", y: "#ffe7a8" };
const lanterns: Draw = (p, f) => {
  for (let i = 0; i < 4; i++) {
    const a = (f / FRAMES) * TAU + (i * TAU) / 4;
    const x = Math.round(CX + Math.cos(a) * 11) - 1;
    const y = Math.round(CY - 1 + Math.sin(a) * 3.5 + (i % 2 ? -5 : 3)) - 2;
    p.disc(x + 1, y + 2, 4, "rgba(255, 170, 70, 0.22)");
    p.grid(LANTERN, LANTERN_PAL, x, y);
  }
};

// Sakura Storm: petals whirl up round the body and fall away.
const petals: Draw = (p, f) => {
  const cols = ["#ffb3cf", "#ff8fb8", "#ffd1e2", "#f77aa6"];
  for (let i = 0; i < 10; i++) {
    const k = (f / FRAMES + i / 10) % 1;
    const lift = k < 0.5 ? Math.sin((k / 0.5) * (Math.PI / 2)) : 1 - ((k - 0.5) / 0.5) ** 1.5;
    const a = k * 8 + i * 1.9;
    const r = 8 + (i % 3) * 1.6;
    const x = Math.round(CX + Math.cos(a) * r);
    const y = Math.round(CA_Y + 16 - lift * 18);
    p.px(x, y, cols[i % 4]!);
    if (i % 2 === 0) p.px(x + (Math.sin(a) > 0 ? 1 : -1), y, cols[(i + 1) % 4]!);
  }
};

// Firefly Swarm: green-gold specks that wander and blink.
const fireflies: Draw = (p, f) => {
  for (let i = 0; i < 11; i++) {
    const u = f / FRAMES + i * 0.37;
    const x = Math.round(CX + Math.sin(u * TAU * 0.5 + i * 2.1) * (7 + (i % 4)));
    const y = Math.round(CY + 1 + Math.cos(u * TAU * 0.5 + i * 1.3) * (8 + (i % 3)));
    const on = (f + i * 3) % 5 < 3;
    if (!on) continue;
    const col = i % 3 ? "#d8ff5a" : "#ffe45e";
    if ((f + i * 3) % 5 === 1) {
      p.px(x - 1, y, "rgba(190, 255, 90, 0.4)");
      p.px(x + 1, y, "rgba(190, 255, 90, 0.4)");
      p.px(x, y - 1, "rgba(190, 255, 90, 0.4)");
      p.px(x, y + 1, "rgba(190, 255, 90, 0.4)");
    }
    p.px(x, y, col);
  }
};

// Koi Current: a ribbon of koi circling on a tilted ring, tails flicking.
const koi: Draw = (p, f) => {
  const skins = [
    ["#ff7a2a", "#fff1e0"],
    ["#fff4e8", "#e8452a"],
    ["#ffb03a", "#fff4e8"],
  ] as const;
  for (let i = 0; i < 7; i++) {
    const a = (f / FRAMES) * TAU - i * 0.55;
    const x = Math.round(CX + Math.cos(a) * 11.5);
    const y = Math.round(CY + 1 + Math.sin(a) * 5 + Math.sin(a * 2) * 2);
    const [main, patch] = skins[i % 3]!;
    const dir = -Math.sin(a) >= 0 ? 1 : -1;
    p.px(x, y, main);
    p.px(x - dir, y, patch);
    p.px(x + dir, y, main);
    p.px(x - dir * 2, y + ((f + i) % 2 ? 1 : -1), patch);
    p.px(x + dir, y - 1, "rgba(159, 233, 255, 0.5)");
  }
};

const DRAWS: Record<number, Draw> = {
  [CASE_BASE + 0]: lanterns,
  [CASE_BASE + 1]: petals,
  [CASE_BASE + 2]: fireflies,
  [CASE_BASE + 3]: koi,
};

const frame = cached(
  (index: number, f: number) => `${index}:${f}`,
  (index: number, f: number) => bake(CA_W, CA_H, (p) => DRAWS[index]?.(p, f)),
);

/** The case aura `index` (`look.aura`) at time `now`, to draw behind a character at (x − `CA_X`, y − `CA_Y`); null if it isn't one. */
export const caseAuraFrame = (index: number, now: number): HTMLCanvasElement | null =>
  DRAWS[index] ? frame(index, Math.floor(now / CA_MS) % FRAMES) : null;

/** One aura on its own, for the bag and the shelf when the 3D icon isn't there. */
export const caseAuraIcon = (index: number): HTMLCanvasElement | null => (DRAWS[index] ? frame(index, 3) : null);
