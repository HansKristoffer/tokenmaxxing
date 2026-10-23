/**
 * Things worn on the body in 3D: outfit marks and patterns for every outfit that has them, company merch, the
 * ten things held in a hand and the seven worn on the back (`core/src/wardrobe.ts`, `loot.ts`; 2D art in
 * `web/src/art/wardrobe.ts`, `loot.ts`, `merch.ts`).
 *
 * The torso is a 0.3 × 0.26 × 0.2 box (floor-up: 0.22 to 0.48, the belt on its lowest 0.05). Marks are painted on
 * a small canvas (58 × 42 texels, a little under the chest's size) and hung just off its front and back.
 */
import * as THREE from "three";
import { dome, lit, mesh, ring, see, shaped, sign } from "./gear3dHead.ts";
import { canvasTexture, glow, type Model, seeded, tint, toon } from "./kit.ts";

export const NECK = 0.52;
const CHEST_W = 58;
const CHEST_H = 42;
const CHEST_Y = 0.375;
const CHEST_PLANE: [number, number] = [0.29, 0.21];

export interface BodyCtx {
  /** The avatar's body: floor at y 0, +z the front. */
  body: Model;
  /** Both arms (the second is the one that holds things), the shoulder at their origin. */
  arms: [Model, Model];
  /** The outfit's colours and trousers. */
  main: string;
  dark: string;
  pants: string;
  /** Registers something that moves. */
  tick(fn: (t: number, walking: boolean) => void): void;
  /** Changes what colour the sleeves are. */
  sleeves(color: string): void;
}

type Paint2D = (g: CanvasRenderingContext2D, w: number, h: number) => void;
const px = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};
const gradient = toon("#ffffff").gradientMap;

function chestMaterial(draw: Paint2D): THREE.Material {
  const t = canvasTexture(CHEST_W, CHEST_H, (g) => draw(g, CHEST_W, CHEST_H));
  return new THREE.MeshToonMaterial({ map: t, transparent: true, alphaTest: 0.4, gradientMap: gradient, polygonOffset: true, polygonOffsetFactor: -2 });
}
/** Paints marks on the chest, and (when given) the back. `lightIt` makes them shine. */
function marks(b: Model, front?: Paint2D, back?: Paint2D, lightIt = false): void {
  if (front) {
    const m = lightIt ? glowMaterial(front) : chestMaterial(front);
    b.plane(CHEST_PLANE[0], CHEST_PLANE[1], m, [0, CHEST_Y, 0.1015]);
  }
  if (back) {
    const p = b.plane(CHEST_PLANE[0], CHEST_PLANE[1], chestMaterial(back), [0, CHEST_Y, -0.1015]);
    p.rotation.y = Math.PI;
  }
}
function glowMaterial(draw: Paint2D): THREE.Material {
  const t = canvasTexture(CHEST_W, CHEST_H, (g) => draw(g, CHEST_W, CHEST_H));
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3 });
}

/** A hood hanging down the back of the neck. */
function hood(c: BodyCtx, color: string, inner: string): void {
  const h = c.body.part([0, NECK - 0.05, -0.1]);
  h.ball(0.115, color, [0, -0.02, -0.01], [1.35, 0.85, 0.75], 12);
  h.ball(0.09, inner, [0, 0.02, 0.012], [1.2, 0.5, 0.4], 10);
}

/** A sleeve stripe: a thin strip down the outside of each arm. */
function sleeveStripes(c: BodyCtx, color: string): void {
  c.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    const sleeve = arm.children[0] as THREE.Object3D | undefined;
    const stripe = arm.box([0.012, 0.15, 0.094], color, [s * 0.04, -0.235, 0], 0.003);
    stripe.rotation.z = s * 0.08;
    void sleeve;
  });
}

const plaid = (g: CanvasRenderingContext2D, w: number, h: number, base: string, a: string, b: string) => {
  px(g, base, 0, 0, w, h);
  for (let x = 0; x < w; x += 12) px(g, a, x, 0, 3, h);
  for (let y = 0; y < h; y += 10) px(g, a, 0, y, w, 3);
  for (let x = 6; x < w; x += 12) px(g, b, x, 0, 1, h);
  for (let y = 5; y < h; y += 10) px(g, b, 0, y, w, 1);
};

const text = (g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string) => {
  g.fillStyle = color;
  g.font = `700 ${size}px ui-monospace, Menlo, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(s, x, y);
};

// MARK: Outfits

type OutfitBuilder = (c: BodyCtx) => void;

// biome-ignore format: a catalogue reads best one to a line
export const OUTFIT_BUILDERS: Record<number, OutfitBuilder> = {
  // Hacker hoodie: green drawstrings, a pouch and a hood.
  8: (c) => {
    marks(c.body, (g) => {
      for (const x of [21, 35]) { px(g, "#3ddc84", x, 0, 2, 13); px(g, "#3ddc84", x - 1, 13, 4, 3); }
      g.strokeStyle = "#3ddc84"; g.lineWidth = 1;
      g.strokeRect(12.5, 22.5, 33, 19);
      text(g, "</>", 29, 31, 11, "#3ddc84");
    });
    hood(c, c.dark, "#101814");
  },
  // Sharp suit: white shirt, lapels and a tie.
  9: (c) => {
    marks(c.body, (g) => {
      g.fillStyle = "#f4f4f0"; g.beginPath(); g.moveTo(19, 0); g.lineTo(39, 0); g.lineTo(29, 24); g.fill();
      g.fillStyle = "#14161f"; g.beginPath(); g.moveTo(14, 0); g.lineTo(21, 0); g.lineTo(29, 26); g.lineTo(23, 30); g.fill();
      g.beginPath(); g.moveTo(44, 0); g.lineTo(37, 0); g.lineTo(29, 26); g.lineTo(35, 30); g.fill();
      px(g, "#c23a3a", 27, 4, 4, 18); px(g, "#a82a2a", 27, 3, 4, 3);
      px(g, "#14161f", 28, 30, 2, 2); px(g, "#14161f", 28, 36, 2, 2);
    });
  },
  // Galaxy jacket: stars on violet, pink trim and zip.
  10: (c) => {
    const rnd = seeded(10);
    marks(c.body, (g, w, h) => {
      for (let i = 0; i < 26; i++) px(g, i % 3 ? "#ffd1f4" : "#ffffff", Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
      px(g, "#e86bd8", 28, 0, 2, h);
      px(g, "#e86bd8", 0, 38, w, 4);
      for (const [x, y] of [[10, 10], [44, 18], [18, 28]] as const) { px(g, "#fff", x, y - 1, 1, 3); px(g, "#fff", x - 1, y, 3, 1); }
    }, (g, w, h) => {
      for (let i = 0; i < 40; i++) px(g, i % 3 ? "#ffd1f4" : "#ffffff", Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
      g.fillStyle = "#7a4fe0"; g.beginPath(); g.ellipse(29, 20, 12, 8, 0, 0, 7); g.fill();
    });
  },
  // Gold suit: a lighter shirt, dark-gold lapels, buttons and a shine.
  11: (c) => {
    marks(c.body, (g, _w, h) => {
      g.fillStyle = "#fff0b0"; g.beginPath(); g.moveTo(20, 0); g.lineTo(38, 0); g.lineTo(29, 22); g.fill();
      g.fillStyle = "#b98a1f"; g.beginPath(); g.moveTo(13, 0); g.lineTo(21, 0); g.lineTo(29, 24); g.lineTo(22, 30); g.fill();
      g.beginPath(); g.moveTo(45, 0); g.lineTo(37, 0); g.lineTo(29, 24); g.lineTo(36, 30); g.fill();
      for (const y of [28, 35]) px(g, "#fff0b0", 28, y, 3, 3);
      g.fillStyle = "rgba(255,255,255,0.28)"; g.beginPath(); g.moveTo(40, 0); g.lineTo(47, 0); g.lineTo(30, h); g.lineTo(23, h); g.fill();
    });
  },
  // Server-rack armour: seams, rivets and blinking lights.
  12: (c) => {
    marks(c.body, (g, w, h) => {
      px(g, "#8a93a1", 3, 4, w - 6, 3); px(g, "#8a93a1", 3, 18, w - 6, 2); px(g, "#8a93a1", 3, 32, w - 6, 3);
      px(g, "#3a3f4b", 28, 0, 2, h);
      for (const x of [6, 50]) for (const y of [11, 25, 38]) px(g, "#c4ccd6", x, y, 2, 2);
    }, (g, w, _h) => {
      px(g, "#8a93a1", 3, 6, w - 6, 3); px(g, "#8a93a1", 3, 20, w - 6, 3);
      for (let x = 8; x < w - 8; x += 8) px(g, "#3a3f4b", x, 26, 4, 10);
    });
    const leds = [[-0.09, "#3ddc84"], [-0.03, "#f5c842"], [0.03, "#3ddc84"], [0.09, "#ff5a4f"]] as const;
    const boxes = leds.map(([x, col], i) => c.body.box([0.022, 0.022, 0.01], lit(col), [x, 0.31 + (i % 2) * 0.05, 0.1], 0.004));
    c.tick((t) => boxes.forEach((b, i) => { b.scale.setScalar(Math.sin(t * 4 + i * 1.7) > 0.2 ? 1.2 : 0.55); }));
  },
  // Hoodie of infinite context: a glowing infinity on the chest, hood down the back.
  13: (c) => {
    const lemniscate = (g: CanvasRenderingContext2D, w: number, h: number, lw: number, col: string) => {
      g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round"; g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const d = 1 + Math.sin(a) ** 2;
        const x = w / 2 + (17 * Math.cos(a)) / d;
        const y = h / 2 + 2 + (17 * Math.sin(a) * Math.cos(a)) / d;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    };
    marks(c.body, undefined, undefined);
    marks(c.body, (g, w, h) => { lemniscate(g, w, h, 5, "rgba(127,232,255,0.35)"); lemniscate(g, w, h, 2.4, "#7fe8ff"); }, undefined, true);
    marks(c.body, undefined, (g, w) => { px(g, "#4a3d82", 6, 0, w - 12, 5); });
    hood(c, "#4a3d82", "#2a2150");
  },
  // Rain jacket: a zip, drawstrings and a hood.
  14: (c) => {
    marks(c.body, (g, _w, h) => {
      px(g, "#8a6a10", 28, 0, 2, h);
      for (const x of [22, 36]) { px(g, "#f4efe4", x, 0, 1, 11); px(g, "#f4efe4", x - 1, 11, 3, 3); }
      px(g, "#c99a1a", 6, 20, 16, 2); px(g, "#c99a1a", 36, 20, 16, 2);
    }, (g, w) => { px(g, "#c99a1a", 6, 0, w - 12, 4); px(g, "#c99a1a", 4, 20, w - 8, 2); });
    hood(c, "#c99a1a", "#8a6a10");
  },
  // Lab coat: open over a blue shirt, a red pen in the pocket.
  15: (c) => {
    marks(c.body, (g, _w, h) => {
      px(g, "#6fa8dc", 22, 0, 14, h);
      g.fillStyle = "#cfd3d6"; g.beginPath(); g.moveTo(19, 0); g.lineTo(22, 0); g.lineTo(23, h); g.lineTo(20, h); g.fill();
      g.beginPath(); g.moveTo(39, 0); g.lineTo(36, 0); g.lineTo(35, h); g.lineTo(38, h); g.fill();
      g.strokeStyle = "#cfd3d6"; g.lineWidth = 1; g.strokeRect(6.5, 22.5, 11, 12);
      px(g, "#e0584f", 9, 18, 2, 9); px(g, "#3a3f4b", 13, 19, 2, 8);
    }, (g, _w, h) => { px(g, "#e2e4e2", 28, 0, 2, h); });
  },
  // Flannel shirt: red checks.
  16: (c) => {
    marks(c.body, (g, w, h) => { plaid(g, w, h, "#c43b3b", "#8a2424", "#4a1214"); px(g, "#4a1214", 28, 0, 2, h); for (const y of [6, 16, 26, 36]) px(g, "#f4efe4", 28, y, 2, 2); },
      (g, w, h) => plaid(g, w, h, "#c43b3b", "#8a2424", "#4a1214"));
  },
  // Founder vest: grey fleece over a blue shirt, a tiny logo.
  17: (c) => {
    c.sleeves("#7fb0e6");
    marks(c.body, (g, w, h) => {
      px(g, "#7fb0e6", 0, 0, 4, h); px(g, "#7fb0e6", w - 4, 0, 4, h);
      px(g, "#7fb0e6", 22, 0, 14, 4);
      px(g, "#3a3f46", 28, 4, 2, h); px(g, "#7fb0e6", 40, 10, 6, 6); px(g, "#f4f1ea", 42, 12, 2, 2);
    }, (g, w) => { px(g, "#7fb0e6", 0, 0, 4, 42); px(g, "#7fb0e6", w - 4, 0, 4, 42); });
  },
  // Merge-conflict sweater: a red and white zigzag, and the markers across the chest.
  18: (c) => {
    marks(c.body, (g, w, _h) => {
      for (let x = 0; x < w; x += 4) { px(g, x % 8 ? "#f4efe4" : "#e0584f", x, 12 + (x % 8 ? 0 : 3), 4, 4); }
      text(g, "<<<", 29, 30, 12, "#f4efe4");
    }, (g, w) => { for (let x = 0; x < w; x += 4) px(g, x % 8 ? "#f4efe4" : "#e0584f", x, 14 + (x % 8 ? 0 : 3), 4, 4); });
  },
  // Tuxedo: a white shirt and a bow tie.
  19: (c) => {
    marks(c.body, (g) => {
      g.fillStyle = "#f4f4f0"; g.beginPath(); g.moveTo(20, 0); g.lineTo(38, 0); g.lineTo(34, 30); g.lineTo(24, 30); g.fill();
      g.fillStyle = "#3a3a44"; g.beginPath(); g.moveTo(15, 0); g.lineTo(21, 0); g.lineTo(25, 32); g.lineTo(19, 24); g.fill();
      g.beginPath(); g.moveTo(43, 0); g.lineTo(37, 0); g.lineTo(33, 32); g.lineTo(39, 24); g.fill();
      for (const y of [8, 15, 22]) px(g, "#14121a", 28, y, 2, 2);
    });
    const tie = c.body.part([0, NECK - 0.035, 0.1]);
    for (const s of [-1, 1]) tie.box([0.045, 0.04, 0.02], "#e0584f", [s * 0.03, -0.02, 0], 0.01).rotation.z = s * 0.2;
    tie.ball(0.015, "#a82a2a", [0, 0, 0.01]);
  },
  // Space suit: an orange collar ring, a chest panel of lights.
  20: (c) => {
    marks(c.body, (g, w, _h) => {
      px(g, "#3a3f4b", 18, 11, 22, 14);
      px(g, "#b8bec8", 4, 30, w - 8, 2);
      px(g, "#e0584f", 5, 4, 8, 5); px(g, "#4f8fe0", 5, 4, 3, 5); px(g, "#fbf7ef", 8, 6, 5, 1);
    }, (g, w, _h) => { px(g, "#9aa3b0", 12, 4, w - 24, 26); px(g, "#6a7380", 14, 7, w - 28, 20); });
    const ring2 = ring(c.body, "#f08a3c", 0.12, 0.025, [0, NECK - 0.03, 0.005]);
    ring2.scale.set(1.1, 1.1, 1);
    const lights = [[-0.045, "#3ddc84"], [0.0, "#e0584f"], [0.045, "#8fe3ff"]] as const;
    const boxes = lights.map(([x, col]) => c.body.box([0.024, 0.024, 0.01], lit(col), [x, 0.34, 0.1], 0.004));
    c.tick((t) => boxes.forEach((b, i) => { b.scale.setScalar(Math.sin(t * 3 + i * 2.1) > 0 ? 1.15 : 0.6); }));
  },
  // Retro tracksuit: white stripes down the sleeves, a white collar and zip.
  21: (c) => {
    marks(c.body, (g, w, h) => {
      px(g, "#f4f4f0", 28, 0, 2, h); g.fillStyle = "#f4f4f0"; g.beginPath(); g.moveTo(17, 0); g.lineTo(41, 0); g.lineTo(29, 9); g.fill();
      px(g, "#2fa39a", 22, 0, 14, 2);
      px(g, "#f4f4f0", 0, 0, 2, h); px(g, "#f4f4f0", w - 2, 0, 2, h);
    }, (g, w, h) => { px(g, "#f4f4f0", 0, 0, 2, h); px(g, "#f4f4f0", w - 2, 0, 2, h); px(g, "#f4f4f0", 14, 0, w - 28, 3); });
    sleeveStripes(c, "#f4f4f0");
  },
  // Denim overalls over a white tee, two brass buttons.
  22: (c) => {
    marks(c.body, (g, _w, _h) => {
      px(g, "#3f6fb0", 11, 8, 36, 34); px(g, "#3f6fb0", 11, 0, 5, 8); px(g, "#3f6fb0", 42, 0, 5, 8);
      g.strokeStyle = "#2c5088"; g.lineWidth = 1; g.strokeRect(21.5, 20.5, 15, 11);
      px(g, "#f5c842", 12, 8, 3, 3); px(g, "#f5c842", 43, 8, 3, 3);
      px(g, "#2c5088", 11, 8, 36, 1);
    }, (g, w) => { px(g, "#3f6fb0", 11, 14, w - 22, 28); px(g, "#3f6fb0", 11, 0, 5, 14); px(g, "#3f6fb0", 42, 0, 5, 14); });
  },
  // Prompt wizard robe: gold stars, and long enough to hide the trousers.
  23: (c) => {
    const rnd = seeded(23);
    const stars = (g: CanvasRenderingContext2D, w: number, h: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const x = 3 + Math.floor(rnd() * (w - 6)), y = 3 + Math.floor(rnd() * (h - 6));
        px(g, "#f5d14a", x, y, 1, 1);
        if (i % 3 === 0) { px(g, "#f5d14a", x - 1, y, 3, 1); px(g, "#f5d14a", x, y - 1, 1, 3); }
      }
    };
    marks(c.body, (g, w, h) => { stars(g, w, h, 12); px(g, "#f5d14a", 0, 38, w, 3); }, (g, w, h) => stars(g, w, h, 14));
    const skirt = c.body.cyl(0.19, 0.24, c.main, [0, 0.05, 0], 0.155, 16);
    c.body.cyl(0.195, 0.025, "#f5d14a", [0, 0.05, 0], 0.195, 16);
    void skirt;
  },
  // Hazard vest: reflective strips.
  24: (c) => {
    marks(c.body, (g, w, h) => {
      px(g, "#e8eef2", 8, 0, 6, h); px(g, "#e8eef2", w - 14, 0, 6, h); px(g, "#e8eef2", 8, 27, w - 16, 5);
      px(g, "#b9c2c8", 8, 29, w - 16, 1);
    }, (g, w, h) => {
      g.strokeStyle = "#e8eef2"; g.lineWidth = 5;
      g.beginPath(); g.moveTo(10, 2); g.lineTo(w - 10, h - 6); g.moveTo(w - 10, 2); g.lineTo(10, h - 6); g.stroke();
    });
  },
  // Golden regalia: an ermine collar, a ruby brooch and a purple sash with a gold buckle.
  25: (c) => {
    marks(c.body, (g, w, h) => {
      g.strokeStyle = "#7a4fb8"; g.lineWidth = 8; g.beginPath(); g.moveTo(8, -2); g.lineTo(w - 6, h - 6); g.stroke();
      g.strokeStyle = "#5a3590"; g.lineWidth = 1; g.beginPath(); g.moveTo(11, -4); g.lineTo(w - 3, h - 9); g.stroke();
      px(g, "#fff1a8", 36, 24, 6, 6); px(g, "#b07a12", 37, 25, 4, 4);
      px(g, "#e0405a", 14, 9, 5, 5); px(g, "#ffb3c0", 15, 10, 1, 1);
      px(g, "#d99a16", 0, 38, w, 4);
    }, (g, w, h) => {
      g.strokeStyle = "#7a4fb8"; g.lineWidth = 8; g.beginPath(); g.moveTo(w - 8, -2); g.lineTo(6, h - 6); g.stroke();
    });
    const collar = c.body.part([0, NECK - 0.05, 0]);
    ring(collar, "#fbf7ef", 0.125, 0.035).scale.set(1.15, 1.15, 1);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      collar.box([0.012, 0.012, 0.012], "#1c1a24", [Math.sin(a) * 0.145, 0.034, Math.cos(a) * 0.13], 0.003);
    }
    collar.ball(0.024, "#e0405a", [0, -0.05, 0.14], [1, 1, 0.6], 8);
  },
  // Compacting… scarf: a cream jumper and a striped scarf with its end hanging.
  26: (c) => {
    const scarf = c.body.part([0, NECK - 0.045, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      scarf.ball(0.045, i % 2 ? "#e0584f" : "#f4efe4", [Math.sin(a) * 0.115, 0, Math.cos(a) * 0.1], [1.2, 0.9, 1.2], 8);
    }
    for (let i = 0; i < 4; i++) scarf.box([0.06, 0.04, 0.025], i % 2 ? "#e0584f" : "#f4efe4", [0.06, -0.06 - i * 0.04, 0.115], 0.01);
    marks(c.body, (g, w) => { for (let x = 0; x < w; x += 6) px(g, "#c9c0ad", x, 24, 1, 18); });
  },
  // Two-tone suit: ours on the left, theirs on the right.
  27: (c) => {
    marks(c.body, (g, _w, h) => {
      px(g, "#e0584f", 29, 0, 29, h);
      px(g, "#14161f", 28, 0, 2, h);
      for (const y of [14, 24]) px(g, "#f4f4f0", 25, y, 2, 2);
      g.fillStyle = "#f4f4f0"; g.beginPath(); g.moveTo(22, 0); g.lineTo(36, 0); g.lineTo(29, 14); g.fill();
    }, (g, _w, h) => { px(g, "#e0584f", 29, 0, 29, h); px(g, "#14161f", 28, 0, 2, h); });
    c.arms[0]!.children[0]!.visible = true;
    (c.arms[1]!.children[0] as THREE.Mesh).material = toon("#e0584f");
  },
  // Shimmering cape: violet and teal round the shoulders and down the back, a gold clasp.
  28: (c) => {
    const cape = c.body.part([0, NECK - 0.04, -0.1]);
    const tex = canvasTexture(32, 40, (g) => {
      const rnd = seeded(28);
      const grd = g.createLinearGradient(0, 0, 32, 40);
      grd.addColorStop(0, "#b57cff"); grd.addColorStop(0.5, "#5b3fbf"); grd.addColorStop(1, "#5ff0d0");
      g.fillStyle = grd; g.fillRect(0, 0, 32, 40);
      for (let i = 0; i < 18; i++) px(g, "#ffd35c", Math.floor(rnd() * 32), Math.floor(rnd() * 40), 1, 1);
    });
    const sheet = cape.plane(0.34, 0.36, new THREE.MeshToonMaterial({ map: tex, side: THREE.DoubleSide, gradientMap: gradient }), [0, -0.17, -0.012]);
    sheet.castShadow = true;
    sheet.rotation.x = 0.1;
    cape.box([0.36, 0.045, 0.1], "#5b3fbf", [0, -0.02, 0.07], 0.02);
    for (const s of [-1, 1]) cape.ball(0.05, "#5b3fbf", [s * 0.17, -0.02, 0.05], [1, 0.6, 1.2], 8);
    cape.ball(0.022, "#ffd35c", [0, -0.03, 0.18], [1, 1, 0.6], 8);
    c.tick((t, walking) => {
      const sway = walking ? 0.3 + Math.abs(Math.sin(t * 11)) * 0.25 : 0.1 + Math.sin(t * 1.6) * 0.04;
      sheet.rotation.x = sway;
      sheet.position.y = -0.17 * Math.cos(sway);
    });
  },
};

// MARK: Company merch

export interface MerchLook {
  main: string;
  shade: string;
  accent: string;
  initials: string;
  /** What its people drew: rows of 4×3-to-wide pixel strings with `a` accent, `w` white, `k` ink; absent: the initials. */
  design?: string[] | null;
}

/** A tee or hoodie in the company's colours with its logo on the chest. */
export function merchTop(c: BodyCtx, m: MerchLook, hoodie: boolean): void {
  marks(c.body, (g, _w, _h) => {
    const logo = (cx: number, cy: number, scale: number) => {
      if (m.design?.length) {
        const rows = m.design;
        const pal: Record<string, string> = { a: m.accent, w: "#fbf7ef", k: "#2b2433" };
        rows.forEach((row, y) => {
          [...row].forEach((ch, x) => {
            if (pal[ch]) px(g, pal[ch]!, Math.round(cx - (row.length * scale) / 2 + x * scale), Math.round(cy + y * scale), scale, scale);
          });
        });
      } else text(g, m.initials, cx, cy + 4, hoodie ? 11 : 14, m.accent);
    };
    logo(29, hoodie ? 8 : 12, 1);
    if (hoodie) {
      px(g, m.shade, 12, 26, 34, 2); px(g, m.shade, 12, 26, 2, 16); px(g, m.shade, 44, 26, 2, 16);
      px(g, "#fbf7ef", 22, 0, 1, 10); px(g, "#fbf7ef", 35, 0, 1, 10);
    }
  }, hoodie ? (g, w) => px(g, m.shade, 4, 0, w - 8, 3) : undefined);
  if (hoodie) hood(c, m.main, m.shade);
}

export function merchCap(h: Model, m: MerchLook): void {
  dome(h, m.main, 0.275, 0.03, 0.42);
  h.box([0.34, 0.025, 0.2], m.shade, [0, 0.11, 0.24], 0.01).rotation.x = -0.12;
  h.ball(0.025, m.shade, [0, 0.3, 0]);
  sign(h, 0.1, 0.07, (g, w, hh) => {
    g.fillStyle = m.accent;
    g.fillRect(2, 2, w - 4, hh - 4);
    g.fillStyle = m.shade;
    g.font = `700 ${hh * 0.6}px ui-monospace, Menlo, monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(m.initials.slice(0, 2), w / 2, hh / 2 + 1);
  }, [0, 0.19, 0.262], 80);
}

// MARK: Held

type HeldBuilder = (h: Model, tick: (fn: (t: number) => void) => void) => void;

/** Sits in the hand, a little in front of it. Origin: the hand; +y up; +z away from the body. */
// biome-ignore format: a catalogue reads best one to a line
export const HELD_BUILDERS: Record<string, HeldBuilder> = {
  "Coffee mug": (h, tick) => {
    h.cyl(0.04, 0.085, "#f4efe4", [0, 0.0, 0.06], 0.045, 14);
    h.cyl(0.0415, 0.025, "#e0584f", [0, 0.03, 0.06], 0.0415, 14);
    ring(h, "#f4efe4", 0.026, 0.008, [0.05, 0.04, 0.06], false);
    h.cyl(0.036, 0.004, "#5b3a24", [0, 0.083, 0.06], 0.036, 12);
    const puffs = [0, 1, 2].map(() => h.ball(0.014, see("#ffffff", 0.6, true), [0, 0.1, 0.06]));
    tick((t) => puffs.forEach((p, i) => {
      const k = (t * 0.7 + i / 3) % 1;
      p.position.set(Math.sin(k * 9 + i) * 0.01, 0.1 + k * 0.12, 0.06);
      p.scale.setScalar(1 - k * 0.6);
    }));
  },
  "Rubber duck": (h) => {
    h.ball(0.055, "#f5d14a", [0, 0.04, 0.06], [1, 0.85, 1.15]);
    h.ball(0.04, "#f5d14a", [0, 0.1, 0.08]);
    h.box([0.04, 0.015, 0.035], "#f08a3c", [0, 0.085, 0.12], 0.006);
    for (const s of [-1, 1]) h.ball(0.007, "#2b2433", [s * 0.02, 0.115, 0.108], [1, 1, 0.6], 5);
    h.ball(0.03, "#d9a92a", [0, 0.05, 0.02], [1.2, 1, 0.7]);
  },
  "Laptop with stickers": (h) => {
    h.box([0.2, 0.014, 0.14], "#aab3bf", [0, 0.0, 0.07], 0.005);
    const lid = h.part([0, 0.014, 0.0]);
    lid.rotation.x = -1.7;
    lid.box([0.2, 0.012, 0.14], "#aab3bf", [0, 0, 0.0], 0.005).position.z = -0.0;
    const stick = [["#e0584f", -0.06, 0.04], ["#4f8fe0", 0.0, 0.07], ["#f5c842", 0.05, 0.035], ["#3ddc84", -0.03, 0.1]] as const;
    for (const [col, x, z] of stick) lid.box([0.035, 0.004, 0.035], col, [x, 0.0075, z - 0.07], 0.004);
    h.position.z += 0;
  },
  "Bubble tea": (h) => {
    h.cyl(0.035, 0.11, see("#f6ece0", 0.55), [0, 0.0, 0.06], 0.045, 12);
    h.cyl(0.034, 0.075, "#d9a46a", [0, 0.005, 0.06], 0.041, 12);
    for (let i = 0; i < 6; i++) h.ball(0.008, "#3a2e24", [Math.sin(i * 1.3) * 0.02, 0.012 + (i % 2) * 0.008, 0.06 + Math.cos(i * 1.3) * 0.02], [1, 1, 1], 5);
    h.cyl(0.047, 0.012, "#e86bd8", [0, 0.11, 0.06], 0.047, 12);
    const straw = h.cyl(0.011, 0.14, "#e86bd8", [0.01, 0.06, 0.06], 0.011, 6);
    straw.rotation.z = -0.15;
  },
  "Mechanical keyboard": (h) => {
    h.box([0.22, 0.03, 0.09], "#2b2433", [0, 0.0, 0.07], 0.01);
    const cols = ["#f4efe4", "#3ddc84", "#f4efe4", "#4f8fe0", "#f4efe4", "#e0584f"];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) h.box([0.028, 0.012, 0.022], cols[(i + r) % 6]!, [-0.088 + i * 0.035, 0.03, 0.04 + r * 0.027], 0.004);
  },
  "Pizza slice": (h) => {
    const wedge2 = new THREE.Shape();
    wedge2.moveTo(0, 0.1); wedge2.lineTo(-0.065, -0.07); wedge2.lineTo(0.065, -0.07); wedge2.closePath();
    const cheese = shaped(h, "pizza", wedge2, 0.014, "#f5d14a", [0, 0.03, 0.09]);
    cheese.rotation.x = -Math.PI / 2;
    cheese.rotation.z = Math.PI;
    h.box([0.15, 0.022, 0.02], "#c98e3c", [0, 0.0, 0.145], 0.008).position.y = 0.02;
    for (const [x, z] of [[0, 0.1], [-0.025, 0.065], [0.03, 0.07]] as const) h.cyl(0.017, 0.008, "#e0584f", [x, 0.04, z], 0.017, 10);
  },
  "Energy drink": (h) => {
    h.cyl(0.032, 0.11, "#3ddc84", [0, 0.0, 0.06], 0.032, 14);
    h.cyl(0.0325, 0.012, "#aab3bf", [0, 0.0, 0.06], 0.0325, 14);
    h.cyl(0.0325, 0.012, "#aab3bf", [0, 0.1, 0.06], 0.0325, 14);
    sign(h, 0.05, 0.07, (g, w, hh) => { g.fillStyle = "#f5f542"; g.beginPath(); g.moveTo(w * 0.6, 0); g.lineTo(w * 0.2, hh * 0.55); g.lineTo(w * 0.48, hh * 0.55); g.lineTo(w * 0.35, hh); g.lineTo(w * 0.85, hh * 0.4); g.lineTo(w * 0.55, hh * 0.4); g.fill(); }, [0, 0.055, 0.0925], 80);
  },
  "Magnifying glass": (h) => {
    const g = h.part([0, 0.0, 0.05]);
    g.rotation.x = -0.35;
    g.cyl(0.011, 0.1, "#7a4f2c", [0, -0.04, 0.0], 0.011, 6);
    ring(g, "#5a3a1e", 0.055, 0.01, [0, 0.12, 0], false);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.052, 18), see("#a8d8f0", 0.5));
    lens.position.set(0, 0.12, 0.002);
    g.add(lens);
  },
  "Fire extinguisher": (h) => {
    h.cyl(0.045, 0.16, "#e0473f", [0, -0.02, 0.06], 0.045, 14);
    h.ball(0.045, "#e0473f", [0, 0.14, 0.06], [1, 0.6, 1], 10);
    h.cyl(0.018, 0.04, "#2b2433", [0, 0.16, 0.06], 0.018, 8);
    h.box([0.1, 0.018, 0.02], "#2b2433", [0.03, 0.2, 0.06], 0.006);
    ring(h, "#2b2433", 0.04, 0.007, [0.05, 0.12, 0.06], false).rotation.y = Math.PI / 2;
    h.box([0.07, 0.05, 0.005], "#f4f4f0", [0, 0.06, 0.1075], 0.002);
  },
  "Baguette": (h) => {
    const b = h.part([0, 0.0, 0.05]);
    b.rotation.z = -0.5;
    b.rotation.x = -0.2;
    b.cyl(0.03, 0.34, "#e8b464", [0, -0.1, 0.0], 0.03, 10);
    b.ball(0.03, "#e8b464", [0, 0.24, 0], [1, 0.7, 1], 8);
    for (let i = 0; i < 4; i++) b.box([0.052, 0.008, 0.012], "#a86e2a", [0, 0.01 + i * 0.065, 0.026], 0.003).rotation.z = 0.5;
  },
};

// MARK: Back

type BackBuilder = (b: Model, tick: (fn: (t: number, walking: boolean) => void) => void) => void;

const PIXEL_WING: [number, number, number, number][] = [
  // x offset, y, width, height (a staircase of feathers).
  [0.0, 0.0, 0.07, 0.05],
  [0.06, 0.05, 0.07, 0.05],
  [0.12, 0.09, 0.07, 0.06],
  [0.17, 0.14, 0.06, 0.06],
  [0.2, 0.2, 0.04, 0.06],
];

/** Origin: the middle of the back, on the torso's back face (z = -0.1). */
// biome-ignore format: a catalogue reads best one to a line
export const BACK_BUILDERS: Record<string, BackBuilder> = {
  "Cape": (b, tick) => {
    const pivot = b.part([0, 0.1, -0.01]);
    pivot.box([0.32, 0.36, 0.02], "#d23c3c", [0, -0.36, -0.02], 0.01);
    pivot.box([0.05, 0.36, 0.012], "#962626", [0.06, -0.36, -0.032], 0.003);
    pivot.box([0.05, 0.36, 0.012], "#962626", [-0.07, -0.36, -0.032], 0.003);
    for (const s of [-1, 1]) pivot.ball(0.025, "#f5c842", [s * 0.15, 0.0, 0.05], [1, 1, 0.6], 8);
    tick((t, walking) => {
      pivot.rotation.x = walking ? 0.25 + Math.abs(Math.sin(t * 11)) * 0.3 : 0.08 + Math.sin(t * 1.7) * 0.03;
      pivot.rotation.z = walking ? Math.sin(t * 11) * 0.05 : 0;
    });
  },
  "Jetpack": (b, tick) => {
    b.box([0.2, 0.18, 0.04], "#7c8592", [0, -0.1, -0.025], 0.01);
    const flames: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const x = s * 0.06;
      b.cyl(0.045, 0.2, "#c4ccd6", [x, -0.15, -0.06], 0.045, 12);
      b.ball(0.045, "#e0473f", [x, 0.05, -0.06], [1, 0.8, 1], 10);
      b.cyl(0.035, 0.03, "#3a3f4b", [x, -0.18, -0.06], 0.025, 10);
      const f = b.cyl(0.032, 0.14, glow("#ff8a3c"), [x, -0.32, -0.06], 0.004, 8);
      f.rotation.x = Math.PI;
      f.position.y = -0.18;
      f.castShadow = false;
      flames.push(f);
      const core = b.cyl(0.016, 0.1, glow("#ffe066"), [x, -0.28, -0.06], 0.003, 6);
      core.rotation.x = Math.PI;
      core.position.y = -0.18;
      core.castShadow = false;
      flames.push(core);
    }
    tick((t, walking) => flames.forEach((f, i) => {
      f.scale.y = (walking ? 1.1 : 0.45) + Math.sin(t * 40 + i * 2) * 0.2;
    }));
  },
  "Backpack": (b) => {
    b.box([0.24, 0.3, 0.1], "#4f8fe0", [0, -0.16, -0.03], 0.04);
    b.box([0.18, 0.12, 0.04], "#2f5aa0", [0, -0.14, -0.1], 0.02);
    b.box([0.03, 0.03, 0.015], "#f5c842", [0, -0.01, -0.095], 0.005);
    for (const s of [-1, 1]) {
      b.box([0.03, 0.2, 0.012], "#2f5aa0", [s * 0.075, -0.18, 0.205], 0.004).position.set(s * 0.075, -0.2, 0.208);
      b.box([0.03, 0.03, 0.2], "#2f5aa0", [s * 0.075, 0.0, 0.1], 0.004);
    }
  },
  "Pixel wings": (b, tick) => {
    const wings: Model[] = [];
    for (const s of [-1, 1]) {
      const w = b.part([s * 0.05, 0.0, -0.08]);
      w.scale.setScalar(1.7);
      for (const [x, y, ww, hh] of PIXEL_WING) {
        w.box([ww, hh, 0.02], "#ffffff", [s * (x + ww / 2 + 0.02), y - 0.1, 0], 0.006);
        w.box([ww, 0.012, 0.022], "#cfe0f4", [s * (x + ww / 2 + 0.02), y - 0.1, 0], 0.003);
      }
      wings.push(w);
    }
    tick((t, walking) => wings.forEach((w, i) => {
      const flap = Math.sin(t * (walking ? 12 : 2.5)) * (walking ? 0.5 : 0.1);
      w.rotation.y = (i ? 1 : -1) * (0.5 + flap);
    }));
  },
  "Guitar": (b) => {
    const g = b.part([0.0, -0.17, -0.07]);
    g.rotation.z = 0.7;
    g.ball(0.085, "#d9832e", [0, 0, 0], [1, 1.1, 0.4]);
    g.ball(0.065, "#d9832e", [0, 0.1, 0], [1, 1, 0.4]);
    g.cyl(0.026, 0.02, "#3a2e2a", [0, 0.0, -0.025], 0.026, 10).rotation.x = Math.PI / 2;
    g.box([0.03, 0.3, 0.02], "#6b4226", [0, 0.12, -0.005], 0.006);
    g.box([0.045, 0.06, 0.02], "#6b4226", [0, 0.42, -0.005], 0.008);
    g.box([0.08, 0.012, 0.018], "#a85e1c", [0, -0.06, 0.0], 0.004);
    // The strap over the chest.
    const strap2 = b.box([0.025, 0.4, 0.01], "#3a2e2a", [0.0, -0.2, 0.205], 0.003);
    strap2.rotation.z = -0.7;
  },
  "Yoga mat": (b) => {
    const m = b.cyl(0.07, 0.34, "#9b6fd6", [0, -0.14, -0.08], 0.07, 14);
    m.rotation.z = Math.PI / 2;
    m.position.set(0.17, -0.1, -0.08);
    b.cyl(0.071, 0.012, "#d8c2f4", [0, 0, 0], 0.071, 14);
    for (const s of [-1, 1]) {
      const cap = b.cyl(0.0705, 0.01, "#7852ad", [0, 0, 0], 0.0705, 14);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(s * 0.17, -0.1, -0.08);
    }
    b.box([0.35, 0.012, 0.012], "#5a3f8a", [0, -0.05, -0.15], 0.003);
    b.box([0.025, 0.14, 0.012], "#5a3f8a", [0.1, -0.22, -0.145], 0.003);
  },
  "Katana": (b) => {
    const k = b.part([0, -0.2, -0.06]);
    k.rotation.z = 0.85;
    k.box([0.03, 0.46, 0.03], "#2a2a35", [0, -0.1, 0], 0.01);
    k.box([0.034, 0.012, 0.034], "#f5c842", [0, 0.36, 0], 0.004);
    k.box([0.028, 0.1, 0.028], "#c23a3a", [0, 0.372, 0], 0.01);
    k.ball(0.016, "#f5c842", [0, 0.48, 0], [1, 1, 1], 6);
    k.box([0.06, 0.008, 0.045], "#f5c842", [0, 0.36, 0], 0.003);
  },
};

// Helpers the entry point needs.
export { glow, mesh, tint };
