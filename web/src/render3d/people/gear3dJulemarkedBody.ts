/**
 * The Julemarked case's body gear in 3D (`core/src/case-julemarked.ts`): six outfits and two things worn on the back, in
 * the same cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dJulemarked.ts`, it adds its builders to
 * the shop's tables: outfits under their look index (`JULEMARKED_BASE + n`), back items under their names. Outfit colours
 * are in `data/gear.ts`. Wool, paper and candlelight: matte reds. Brief: `docs/cases/julemarked.md`.
 */
import { JULEMARKED_BASE } from "@tokenmaxxing/core/case-julemarked.ts";
import type * as THREE from "three";
import {
  BACK_BUILDERS,
  type BackBuilder,
  type BodyCtx,
  grid,
  marks,
  OUTFIT_BUILDERS,
  px,
  roll,
} from "./gear3dBody.ts";
import { heart, lit, shaped } from "./gear3dHead.ts";
import { U, Vx, vpart } from "./voxgear.ts";

const RED = "#b8302c";
const RED_DARK = "#8f2421";
const CREAM = "#f4ecd8";
const CREAM_DARK = "#d9cdb0";
const GREEN = "#2f5d3a";
const GOLD = "#f2c14e";
const WOOD = "#a06a3c";
const WOOD_DARK = "#7a4e2a";
const WHITE = "#ffffff";

/** A band of colour round an arm: a cuff, a stripe. */
const armBand = (c: BodyCtx, color: string, y: number, h: number, pad = 0) =>
  c.arms.forEach((arm) => {
    new Vx(vpart(arm)).b(-1.22 - pad, y, -1.22 - pad, 2.44 + 2 * pad, h, 2.44 + 2 * pad, color);
  });

/** A candle in a hand: a cream stub with a cartoon flame, held up from the fist. */
function handCandle(c: BodyCtx, flames: THREE.Mesh[]): void {
  c.arms.forEach((arm) => {
    const a = new Vx(vpart(arm));
    a.b(-0.5, -8.4, 0.5, 1.0, 2.6, 1.0, CREAM);
    a.b(-0.1, -5.9, 0.9, 0.2, 0.4, 0.2, "#3a2a1e");
    flames.push(a.b(-0.4, -5.6, 0.7, 0.8, 1.3, 0.6, lit("#ffd56a")));
  });
}

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Islandsk sweater: a cream jumper with a red and green yoke of diamonds, ribbed hem and cuffs, a red neck roll.
  0: (c) => {
    const yoke = (g: CanvasRenderingContext2D, w: number) => {
      px(g, RED, 0, 0, w, 3);
      px(g, GREEN, 0, 3, w, 3);
      px(g, GREEN, 0, 15, w, 3);
      px(g, RED, 0, 18, w, 3);
      for (const x of [6, 18, 30, 42]) {
        const d = (cx: number, col: string) => {
          for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) px(g, col, cx + dx * 3, 9 + dy * 3, 3, 3);
        };
        d(x + 3, RED);
        px(g, GREEN, x + 3, 9, 3, 3);
      }
      px(g, CREAM_DARK, 0, 22, w, 3);
    };
    marks(c, (g, w) => yoke(g, w), (g, w) => yoke(g, w));
    roll(c, RED, 1.2, 0.4);
    const v = grid(c);
    v.b(-3.9, -2.4, -2.3, 7.8, 1.2, 4.6, CREAM_DARK);
    for (let i = 0; i < 8; i++) v.b(-3.9 + i * 0.98, -2.45, -2.33, 0.45, 1.2, 4.66, "#c9bb98");
    armBand(c, RED, -6.4, 1.2);
    armBand(c, GREEN, -5.2, 0.5, 0.04);
  },
  // Bagerforklæde: a cream apron over a red shirt, flour smudges, a cinnamon-brown stain, a neck loop and a rope tie.
  1: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, CREAM, 15, 0, 27, 9);
        px(g, CREAM, 6, 9, 45, h - 9);
        px(g, CREAM_DARK, 9, 30, 39, 2);
        // The cinnamon swirl, a spiral of brown on cream.
        for (const [x, y, w, hh] of [[24, 14, 12, 3], [21, 17, 3, 9], [24, 26, 12, 3], [33, 17, 3, 6], [27, 20, 6, 3]] as const) px(g, "#8a4a26", x, y, w, hh);
        for (const [x, y, s] of [[10, 4, 3], [44, 6, 3], [12, 34, 3], [42, 35, 4], [36, 10, 3], [14, 20, 3]] as const) px(g, "#fffaf0", x, y, s, s);
      },
      (g, w) => {
        px(g, CREAM, 3, 22, w - 6, 3);
        px(g, CREAM, 18, 2, 3, 10);
        px(g, CREAM, 36, 2, 3, 10);
      },
    );
    const v = grid(c);
    v.b(-2.5, 0, 2, 5, 2.4, 0.3, CREAM);
    v.b(-2.9, -2.6, 1.9, 5.8, 2.6, 0.45, CREAM);
    v.b(-2.9, -2.6, 2.3, 5.8, 0.35, 0.1, CREAM_DARK);
    v.b(-1.6, -1.9, 2.3, 3.2, 1.1, 0.25, CREAM_DARK);
    for (const x of [-2.3, 1.7]) v.b(x, 8, -2, 0.6, 0.3, 4, WHITE);
    v.b(-3.7, 1.2, -2.25, 7.4, 0.7, 0.25, "#c9a36a");
    v.b(-3.7, 1.2, 2.0, 7.4, 0.7, 0.25, "#c9a36a");
    v.b(-1.3, 0.5, -2.7, 1, 1.9, 0.45, "#c9a36a");
    v.b(0.3, 0.3, -2.7, 1, 2.1, 0.45, "#c9a36a");
    v.b(-0.4, 1.0, -2.8, 0.9, 0.9, 0.55, "#a8814a");
    roll(c, WHITE, 0.8, 0.3);
    armBand(c, RED_DARK, -6.4, 1.0);
  },
  // Nissedragt: grey wool with a red collar and scarf, cream stripes at the cuffs, a leather belt.
  2: (c) => {
    const wool = (g: CanvasRenderingContext2D, w: number, h: number) => {
      for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) if ((x * 5 + y * 13) % 24 === 0) px(g, "#767b84", x, y, 3, 3);
    };
    marks(c, (g, w, h) => { wool(g, w, h); px(g, "#6b4a2e", 27, 12, 3, 30); }, wool);
    roll(c, RED, 1.6, 0.5);
    const v = grid(c);
    // The scarf: knotted at the throat, one end hanging down the chest, one down the back.
    v.b(-1.0, 3.4, 2.3, 2.0, 4.6, 0.5, RED);
    v.b(-1.0, 3.2, 2.7, 2.0, 0.6, 0.15, CREAM);
    v.b(-1.0, 1.6, 2.7, 2.0, 0.6, 0.15, CREAM);
    v.b(-3.2, 4.8, -2.7, 2.0, 3.6, 0.5, RED);
    v.b(-3.8, 0.4, -2.3, 7.6, 1.0, 4.6, "#5a3d24");
    v.b(-0.8, 0.3, 2.3, 1.6, 1.2, 0.3, GOLD);
    v.b(-3.9, -2.4, -2.3, 7.8, 2.8, 4.6, "#767b84");
    armBand(c, CREAM, -6.4, 0.8);
    armBand(c, RED, -5.4, 0.7, 0.04);
  },
  // Dannebrog-trøje: a red knit with the white offset Nordic cross on the chest, long arm to the right, ribbed cuffs.
  3: (c) => {
    marks(
      c,
      (g, w, h) => {
        px(g, WHITE, 0, 18, w, 6);
        px(g, WHITE, 15, 0, 6, h - 3);
        void h;
      },
      (g, w, h) => {
        for (let y = 0; y < h; y += 6) px(g, "#b00d28", 0, y, w, 3);
      },
    );
    roll(c, WHITE, 1.1, 0.35);
    const v = grid(c);
    v.b(-3.9, -2.4, -2.3, 7.8, 1.0, 4.6, "#a50c25");
    armBand(c, "#a50c25", -6.4, 1.2);
    armBand(c, WHITE, -5.2, 0.4, 0.04);
  },
  // Julemandsdragt: a nisse-red coat with cream trim, a black belt with a gold buckle, a white beard on the chest.
  4: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, CREAM, 24, 0, 9, h);
        px(g, "#2a2226", 24, 21, 9, 3);
      },
      (g, w, h) => {
        px(g, CREAM, 0, h - 6, w, 6);
      },
    );
    roll(c, CREAM, 1.5, 0.5);
    const v = grid(c);
    v.b(-3.95, 0.3, -2.3, 7.9, 1.2, 4.6, "#2a2226");
    v.b(-0.9, 0.2, 2.25, 1.8, 1.4, 0.35, GOLD);
    v.b(-0.4, 0.55, 2.55, 0.8, 0.7, 0.2, "#2a2226");
    v.b(-4.0, -2.8, -2.35, 8.0, 3.2, 4.7, RED);
    v.b(-4.05, -3.2, -2.4, 8.1, 0.9, 4.8, CREAM);
    // The white beard: baked into the chest, a bib that tapers.
    v.b(-2.0, 4.0, 2.2, 4.0, 3.4, 0.6, WHITE);
    v.b(-1.5, 2.4, 2.3, 3.0, 1.8, 0.6, WHITE);
    v.b(-0.9, 1.4, 2.4, 1.8, 1.2, 0.5, "#efe9db");
    armBand(c, CREAM, -6.4, 1.4);
    armBand(c, "#2a2226", -4.8, 0.45, 0.04);
  },
  // Lucia-tog: a long white gown, a red sash from shoulder to hip, a small candle in each hand.
  5: (c) => {
    marks(
      c,
      (g, w, h) => {
        px(g, "#e4ddcc", 0, h - 3, w, 3);
      },
      (g, w, h) => {
        px(g, "#e4ddcc", 0, h - 3, w, 3);
        void w;
      },
    );
    roll(c, "#ffffff", 0.8, 0.3);
    const v = grid(c);
    for (let i = 0; i < 6; i++) v.b(-2.9 + i * 1.0, 7.0 - i * 1.15, 2.4, 1.9, 1.5, 0.35, RED);
    for (let i = 0; i < 6; i++) v.b(-2.9 + i * 1.0, 7.0 - i * 1.15, 2.75, 1.9, 0.25, 0.1, RED_DARK);
    v.b(-3.9, -1.2, -2.3, 7.8, 1.5, 4.6, RED);
    v.b(-3.95, -1.0, -2.35, 7.9, 0.3, 4.7, RED_DARK);
    // The skirt of the gown, a little wider at the hem.
    v.b(-4.0, -4.6, -2.4, 8.0, 3.4, 4.8, c.main);
    v.b(-4.2, -4.9, -2.6, 8.4, 0.5, 5.2, "#e4ddcc");
    armBand(c, "#e4ddcc", -6.4, 1.2);
    const flames: THREE.Mesh[] = [];
    handCandle(c, flames);
    c.tick((t) =>
      flames.forEach((f, i) => {
        f.scale.set(1, 1 + Math.sin(t * 9 + i * 2.3) * 0.2, 1);
      }),
    );
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[JULEMARKED_BASE + Number(n)] = build;

// MARK: Back

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Gavesæk: a lumpy warm-brown sack on the back tied with a red cord, a green and red gift corner peeking out.
  Gavesæk: (b, tick) => {
    const v = new Vx(b);
    for (const s of [-1, 1]) {
      const x = s > 0 ? 1.8 : -2.8;
      v.b(x, -7, 4, 1, 7.2, 0.5, "#6b4a2e");
    }
    const sack = vpart(b, [0, 6.5 * U, -4.2 * U]);
    const sv = new Vx(sack);
    sv.b(-3.6, -9.6, -3.0, 7.2, 8.4, 5.0, WOOD);
    sv.b(-4.4, -9.0, -2.4, 8.8, 6.4, 4.2, WOOD);
    sv.b(-3.0, -10.4, -2.4, 6.0, 1.0, 4.0, WOOD_DARK);
    sv.b(-3.0, -1.4, -2.4, 6.0, 1.4, 4.0, "#b8814a");
    sv.b(-2.2, -0.2, -1.8, 4.4, 1.3, 3.0, WOOD);
    sv.b(-3.4, -3.1, -3.2, 6.8, 0.8, 5.4, RED);
    sv.b(-0.7, -4.0, 2.0, 1.4, 1.5, 0.5, RED);
    sv.b(-2.2, -5.5, -3.1, 1.0, 1.0, 0.4, "#b8814a");
    // A gift corner peeks out of the mouth.
    const gift = vpart(sack, [0, 0, 0]);
    const gv = new Vx(gift);
    gv.b(-1.6, 0.8, -1.2, 2.4, 2.4, 2.4, GREEN);
    gv.b(-0.7, 0.8, -1.25, 0.6, 2.45, 2.5, RED);
    gv.b(-1.65, 1.8, -0.1, 2.5, 0.6, 0.4, RED);
    gv.b(-0.9, 3.2, -0.4, 1.2, 0.8, 0.8, RED);
    tick((t, walking) => {
      sack.rotation.x = Math.sin(t * (walking ? 7 : 1.4)) * (walking ? 0.1 : 0.02);
      sack.rotation.z = Math.sin(t * (walking ? 5 : 1.1) + 1) * (walking ? 0.06 : 0.015);
    });
  },
  // Julehjerte-vinger: two wings of woven paper hearts, red and white, three to a wing, that flutter.
  "Julehjerte-vinger": (b, tick) => {
    const wings: ReturnType<typeof vpart>[] = [];
    for (const s of [-1, 1] as const) {
      const w = vpart(b, [s * 2.4 * U, 3 * U, -3.2 * U]);
      const hearts: [number, number, number, number][] = [
        [0.2, 0.14, 0.07, -0.25],
        [0.36, 0.0, 0.12, -0.45],
        [0.42, -0.2, -0.04, -0.7],
      ];
      for (const [i, [x, y, r, rot]] of hearts.entries()) {
        const sz = 0.42 - i * 0.05;
        const a = shaped(w, `jh-${i}-a`, heart(sz), 0.025, i % 2 ? CREAM : RED, [s * x, y, -0.02 * i]);
        a.rotation.z = s * rot * 1.0 + r * 0.0;
        const b2 = shaped(w, `jh-${i}-b`, heart(sz * 0.55), 0.028, i % 2 ? RED : CREAM, [s * x, y - 0.005, -0.02 * i + 0.012]);
        b2.rotation.z = a.rotation.z;
        // The weave: two woven strips across.
        const strip = shaped(w, `jh-${i}-c`, heart(sz * 0.3), 0.03, i % 2 ? CREAM : RED, [s * x, y - 0.008, -0.02 * i + 0.02]);
        strip.rotation.z = a.rotation.z;
      }
      wings.push(w);
    }
    tick((t, walking) => {
      wings.forEach((w, i) => {
        const side = i ? 1 : -1;
        w.rotation.y = side * (0.28 + Math.sin(t * (walking ? 9 : 2.4)) * (walking ? 0.28 : 0.1));
      });
    });
  },
};
Object.assign(BACK_BUILDERS, BACKS);
