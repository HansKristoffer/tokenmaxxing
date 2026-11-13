/**
 * The Julemarked case's body gear in 3D (`core/src/case-julemarked.ts`): six outfits and two things worn on the back, in
 * the same cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dJulemarked.ts`, it adds its builders to
 * the shop's tables: outfits under their look index (`JULEMARKED_BASE + n`), back items under their names. Outfit colours
 * are in `data/gear.ts`. Sharp and blocky: boxes only. These are the case's showpieces: knit and fur you can see, ribbed
 * hems, glints, flour, a train and a beard that sway, candles that glow. Brief: `docs/cases/julemarked.md`.
 */
import { JULEMARKED_BASE } from "@tokenmaxxing/core/case-julemarked.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
import { lit, see } from "./gear3dHead.ts";
import { U, type VoxModel, Vx, vpart } from "./voxgear.ts";

const RED = "#b8302c";
const RED_DARK = "#8f2421";
const CREAM = "#f4ecd8";
const CREAM_DARK = "#d9cdb0";
const GREEN = "#2f5d3a";
const GOLD = "#f2c14e";
const WOOD = "#a06a3c";
const WOOD_DARK = "#7a4e2a";
const WHITE = "#ffffff";
const BLACK = "#2a2226";
const BROWN = "#6b4a2e";

/** A band of colour round an arm: a cuff, a stripe. */
const armBand = (c: BodyCtx, color: string, y: number, h: number, pad = 0) =>
  c.arms.forEach((arm) => {
    new Vx(vpart(arm)).b(-1.22 - pad, y, -1.22 - pad, 2.44 + 2 * pad, h, 2.44 + 2 * pad, color);
  });

/** A ribbed cuff: a thick band with darker ribs standing proud of it. */
function ribCuff(c: BodyCtx, color: string, rib: string, y: number, h: number): void {
  armBand(c, color, y, h, 0.1);
  c.arms.forEach((arm) => {
    const v = new Vx(vpart(arm));
    for (let i = 0; i < 4; i++) {
      v.b(-1.34 + i * 0.7, y, -1.4, 0.3, h, 2.8, rib);
    }
  });
}

/** A flame (two layers) with a halo, on a part. Returns what to animate. */
function flame(
  p: VoxModel,
  x: number,
  y: number,
  z: number,
  s = 1,
): { f: THREE.Mesh; g: THREE.Mesh; h: THREE.Mesh } {
  const v = new Vx(p);
  const h = v.b(x - 1.2 * s, y - 0.6 * s, z - 1.2 * s, 2.4 * s, 3.2 * s, 2.4 * s, see("#ffcf70", 0.08, true));
  const f = v.b(x - 0.45 * s, y, z - 0.45 * s, 0.9 * s, 1.6 * s, 0.9 * s, lit("#ff9c2e"));
  const g = v.b(x - 0.25 * s, y, z - 0.25 * s, 0.5 * s, 1.0 * s, 0.5 * s, lit("#fff3b0"));
  for (const o of [f, g, h]) o.geometry.translate(0, 0, 0);
  return { f, g, h };
}

/** A candle in each hand, held up from the fist, each with a flickering flame and a halo. */
function handCandles(c: BodyCtx): void {
  const flames: ReturnType<typeof flame>[] = [];
  c.arms.forEach((arm) => {
    const a = new Vx(vpart(arm));
    a.b(-0.65, -8.6, 0.4, 1.3, 3.4, 1.3, CREAM);
    a.b(-0.75, -5.3, 0.3, 1.5, 0.4, 1.5, CREAM_DARK);
    a.b(-0.1, -5.2, 0.9, 0.2, 0.5, 0.2, "#3a2a1e");
    flames.push(flame(vpart(arm), 0, -4.9, 1.05, 1.15));
  });
  c.tick((t) =>
    flames.forEach(({ f, g, h }, i) => {
      const k = 1 + Math.sin(t * 9 + i * 2.3) * 0.2 + Math.sin(t * 17 + i) * 0.08;
      f.scale.set(1.1 - k * 0.1, k, 1.1 - k * 0.1);
      g.scale.set(1, 1 + (k - 1) * 1.2, 1);
      h.scale.setScalar(0.9 + (k - 1) * 0.9);
    }),
  );
}

/** Blocks that sparkle: lit cubes at the given spots that flash out of time. */
function glints(c: BodyCtx, spots: [number, number, number][], size = 0.4): void {
  const v = grid(c);
  const list = spots.map(([x, y, z]) => v.b(x - size / 2, y - size / 2, z, size, size, size, lit(WHITE)));
  c.tick((t) =>
    list.forEach((g, i) => {
      g.scale.setScalar(Math.max(0.05, Math.sin(t * 2.6 + i * 2.1) ** 5 * 2.2));
    }),
  );
}

/** A cell-level paint: cols are 3 px wide on the chest patch (19 by 14). */
const cell = (g: CanvasRenderingContext2D, color: string, c: number, r: number, w = 1, h = 1) =>
  px(g, color, c * 3, r * 3, w * 3, h * 3);

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Islandsk sweater: a bold red yoke with three big white snowflakes, a thick roll neck, ribbed hem and cuffs, twinkling.
  0: (c) => {
    const yoke = (flakes: boolean) => (g: CanvasRenderingContext2D) => {
      for (let col = 0; col < 19; col++) {
        cell(g, col % 2 ? CREAM : CREAM_DARK, col, 0);
        cell(g, GREEN, col, 1);
        cell(g, GREEN, col, 12);
        cell(g, col % 2 ? CREAM : CREAM_DARK, col, 13);
        for (let r = 2; r < 12; r++) cell(g, RED, col, r);
      }
      if (!flakes) return;
      const flake = ["00100", "10101", "01110", "10101", "00100"];
      for (const x0 of [1, 7, 13])
        flake.forEach((row, r) => {
          for (const [i, v] of [...row].entries()) if (v === "1") cell(g, WHITE, x0 + i, 4 + r);
        });
      for (const x of [6, 12]) {
        cell(g, GREEN, x, 5);
        cell(g, GREEN, x, 6, 1, 2);
        cell(g, GREEN, x, 8);
      }
    };
    marks(c, yoke(true), yoke(true));
    roll(c, RED, 2.0, 0.55);
    roll(c, "#c9403a", 0.8, 0.7, 6.9);
    const v = grid(c);
    // The ribbed hem: a thick band with ribs standing proud of it, and a stripe above.
    v.b(-4.0, -3.0, -2.4, 8.0, 2.2, 4.8, CREAM_DARK);
    for (let i = 0; i < 9; i++) v.b(-4.0 + i * 0.89, -3.05, -2.5, 0.42, 2.2, 5.0, "#bfb08a");
    v.b(-4.05, -0.8, -2.45, 8.1, 0.45, 4.9, RED);
    v.b(-4.05, -0.35, -2.45, 8.1, 0.3, 4.9, GREEN);
    ribCuff(c, CREAM_DARK, "#bfb08a", -7.2, 1.8);
    armBand(c, RED, -5.4, 0.8, 0.06);
    armBand(c, GREEN, -4.6, 0.4, 0.06);
    armBand(c, CREAM, -4.2, 0.4, 0.06);
    glints(c, [
      [-2.0, 4.8, 2.5],
      [0, 4.8, 2.5],
      [2.0, 4.8, 2.5],
    ]);
  },
  // Bagerforklæde: a cream apron over a red shirt, a spoon in the pocket, flour puffing off it, a bow tied behind.
  1: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, CREAM, 15, 0, 27, 9);
        px(g, CREAM, 6, 9, 45, h - 9);
        px(g, CREAM_DARK, 9, 30, 39, 2);
        for (const [x, y, w, hh] of [
          [24, 14, 12, 3],
          [21, 17, 3, 9],
          [24, 26, 12, 3],
          [33, 17, 3, 6],
          [27, 20, 6, 3],
        ] as const)
          px(g, "#8a4a26", x, y, w, hh);
        for (const [x, y, s] of [
          [10, 4, 3],
          [44, 6, 3],
          [12, 34, 3],
          [42, 35, 4],
          [36, 10, 3],
          [14, 20, 3],
          [18, 30, 3],
          [30, 33, 3],
        ] as const)
          px(g, "#fffaf0", x, y, s, s);
      },
      (g, w) => {
        px(g, CREAM, 3, 22, w - 6, 3);
        px(g, CREAM, 18, 2, 3, 10);
        px(g, CREAM, 36, 2, 3, 10);
      },
    );
    const v = grid(c);
    v.b(-2.5, 0, 2, 5, 2.4, 0.3, CREAM);
    v.b(-3.0, -3.4, 1.9, 6.0, 3.4, 0.45, CREAM);
    v.b(-3.0, -3.4, 2.3, 6.0, 0.4, 0.15, CREAM_DARK);
    // The pocket, with a wooden spoon standing in it.
    v.b(-2.0, -2.8, 2.3, 4.0, 1.5, 0.25, CREAM_DARK);
    v.b(-2.0, -1.5, 2.3, 4.0, 0.2, 0.3, "#c9bb98");
    v.b(0.9, -2.2, 2.45, 0.5, 4.4, 0.4, WOOD);
    v.b(0.55, 1.6, 2.45, 1.2, 1.4, 0.4, WOOD_DARK);
    v.b(0.75, 1.9, 2.8, 0.8, 0.8, 0.1, "#8a5a32");
    for (const x of [-2.3, 1.7]) v.b(x, 8, -2, 0.6, 0.3, 4, WHITE);
    v.b(-3.7, 1.2, -2.25, 7.4, 0.8, 0.25, "#c9a36a");
    v.b(-3.7, 1.2, 2.0, 7.4, 0.8, 0.25, "#c9a36a");
    // The bow tied at the back: two loops and two tails that swing.
    const bow = vpart(c.body, [0, 1.6 * U, -2.7 * U]);
    const bv = new Vx(bow);
    bv.b(-2.7, -0.7, -0.2, 2.3, 1.6, 0.7, "#c9a36a");
    bv.b(0.4, -0.7, -0.2, 2.3, 1.6, 0.7, "#c9a36a");
    bv.b(-2.2, -0.4, -0.35, 1.1, 0.9, 0.5, "#a8814a");
    bv.b(1.1, -0.4, -0.35, 1.1, 0.9, 0.5, "#a8814a");
    bv.b(-0.55, -0.75, -0.3, 1.1, 1.5, 0.9, "#a8814a");
    const tails = [-1, 1].map((s) => {
      const t = vpart(bow, [s * 0.5 * U, -0.7 * U, 0]);
      new Vx(t).b(s > 0 ? 0 : -1.0, -3.4, -0.2, 1.0, 3.4, 0.5, "#c9a36a");
      return t;
    });
    // Flour, puffing up off the apron.
    const dust = Array.from({ length: 5 }, (_, i) => {
      const mat = see(WHITE, 0.6, true);
      return {
        mat: mat as THREE.MeshBasicMaterial,
        o: new Vx(c.body).b(-0.4, 0, 2.8, 0.8, 0.8, 0.8, mat),
        i,
      };
    });
    c.tick((t, walking) => {
      tails.forEach((p, i) => {
        p.rotation.z = (i ? 1 : -1) * (0.1 + Math.sin(t * (walking ? 8 : 1.8) + i) * 0.1);
      });
      bow.rotation.z = Math.sin(t * 1.4) * 0.03;
      for (const { mat, o, i } of dust) {
        const k = (t * 0.4 + i / 5) % 1;
        o.position.set(
          (Math.sin(i * 2.7) * 2.2 + Math.sin(k * 5 + i) * 0.4) * U,
          (-2.2 + k * 6.4) * U + 0.4 * U,
          0,
        );
        o.scale.setScalar(0.5 + k * 2.2);
        mat.opacity = 0.6 * Math.sin(Math.PI * k);
      }
    });
    roll(c, WHITE, 0.8, 0.3);
    ribCuff(c, RED_DARK, "#a8301c", -6.6, 1.4);
    armBand(c, WHITE, -5.0, 0.4, 0.06);
  },
  // Nissedragt: grey wool in patches, a pointed hood with a swinging tassel, a red scarf, a wide belt.
  2: (c) => {
    const wool = (g: CanvasRenderingContext2D, w: number, h: number) => {
      for (let y = 0; y < h; y += 3)
        for (let x = 0; x < w; x += 3) if ((x * 5 + y * 13) % 24 === 0) px(g, "#6a6f78", x, y, 3, 3);
      for (let y = 0; y < h; y += 3)
        for (let x = 0; x < w; x += 3) if ((x * 7 + y * 11) % 30 === 3) px(g, "#a3a8b0", x, y, 3, 3);
    };
    marks(
      c,
      (g, w, h) => {
        wool(g, w, h);
        px(g, "#6b4a2e", 27, 12, 3, 30);
      },
      wool,
    );
    roll(c, RED, 1.8, 0.55);
    const v = grid(c);
    // The scarf: knotted at the throat, one end down the chest.
    v.b(-1.2, 2.8, 2.3, 2.4, 5.2, 0.5, RED);
    for (const y of [3.4, 2.2, 1.0]) v.b(-1.2, y, 2.7, 2.4, 0.5, 0.15, CREAM);
    // Wool patches, stitched on.
    v.b(-3.0, 1.5, 2.2, 1.8, 1.8, 0.25, "#b06a3a");
    v.b(-2.8, 1.7, 2.45, 1.4, 0.15, 0.1, CREAM);
    v.b(-2.8, 2.95, 2.45, 1.4, 0.15, 0.1, CREAM);
    v.b(1.9, 4.2, 2.2, 1.6, 1.6, 0.25, "#4a6a8a");
    v.b(2.1, 4.4, 2.45, 1.2, 0.12, 0.1, CREAM);
    v.b(-3.3, 5.6, -2.5, 2.0, 2.0, 0.25, RED_DARK);
    // The hood, pointed, hanging down the back with a tassel.
    const hood = vpart(c.body, [0, 7.4 * U, -2.4 * U]);
    const hv = new Vx(hood);
    hv.b(-3.4, -1.0, -0.9, 6.8, 1.2, 1.3, RED);
    hv.b(-2.9, -2.4, -0.9, 5.8, 1.4, 1.3, RED_DARK);
    hv.b(-2.2, -3.8, -0.9, 4.4, 1.4, 1.3, RED);
    hv.b(-1.5, -5.0, -0.9, 3.0, 1.2, 1.3, RED_DARK);
    hv.b(-0.8, -6.0, -0.9, 1.6, 1.0, 1.3, RED);
    const tassel = vpart(hood, [0, -6.0 * U, -0.2 * U]);
    new Vx(tassel).b(-0.5, -1.6, -0.2, 1.0, 1.6, 1.0, CREAM);
    new Vx(tassel).b(-0.8, -2.8, -0.4, 1.6, 1.4, 1.4, CREAM);
    v.b(-3.9, 0.3, -2.4, 7.8, 1.9, 4.8, "#5a3d24");
    v.b(-3.95, 1.9, -2.45, 7.9, 0.3, 4.9, "#3e2916");
    v.b(-1.3, 0.1, 2.35, 2.6, 2.3, 0.4, GOLD);
    v.b(-0.7, 0.7, 2.6, 1.4, 1.1, 0.3, "#5a3d24");
    v.b(-3.95, -2.8, -2.4, 7.9, 3.2, 4.8, "#767b84");
    // Fluffy cream cuffs and a pair of toe-curl-like trim at the hem.
    ribCuff(c, CREAM, "#e7dcc0", -6.6, 1.2);
    armBand(c, RED, -5.2, 0.8, 0.06);
    glints(c, [[-2.1, 2.4, 2.6]], 0.3);
    c.tick((t, walking) => {
      tassel.rotation.x =
        (walking ? 0.3 : 0.08) + Math.sin(t * (walking ? 9 : 2.2)) * (walking ? 0.25 : 0.09);
      tassel.rotation.z = Math.sin(t * 1.9) * 0.1;
    });
  },
  // Dannebrog-trøje: a red knit with the white Nordic cross, a gleam that sweeps over it, ribbed hem and cuffs.
  3: (c) => {
    marks(
      c,
      (g, w, h) => {
        px(g, WHITE, 0, 18, w, 6);
        px(g, WHITE, 15, 0, 6, h - 3);
        for (let x = 0; x < w; x += 6) px(g, "#c41230", x, 6, 3, 3);
        for (let x = 3; x < w; x += 6) px(g, "#c41230", x, 30, 3, 3);
      },
      (g, w, h) => {
        for (let y = 0; y < h; y += 6) px(g, "#b00d28", 0, y, w, 3);
      },
    );
    roll(c, WHITE, 1.6, 0.5);
    const v = grid(c);
    v.b(-4.0, -3.0, -2.4, 8.0, 2.2, 4.8, "#a50c25");
    for (let i = 0; i < 9; i++) v.b(-4.0 + i * 0.89, -3.05, -2.5, 0.42, 2.2, 5.0, "#8a0a1f");
    v.b(-4.05, -0.8, -2.45, 8.1, 0.4, 4.9, WHITE);
    ribCuff(c, "#a50c25", "#8a0a1f", -7.0, 1.6);
    armBand(c, WHITE, -5.2, 0.5, 0.06);
    // The raised cross, so it catches the light.
    v.b(-1.55, 2.2, 2.3, 0.7, 4.9, 0.2, WHITE);
    v.b(-3.2, 4.2, 2.3, 6.4, 0.7, 0.2, "#f4f4f4");
    // A gleam slides across the chest every few seconds.
    const gleam = v.b(-0.4, 2.2, 2.55, 0.8, 5.0, 0.2, see(WHITE, 0.5, true));
    c.tick((t) => {
      const k = (t * 0.35) % 1;
      gleam.visible = k < 0.4;
      gleam.position.x = (-3.6 + (k / 0.4) * 7.2) * U;
      gleam.scale.set(1 + Math.sin((k / 0.4) * Math.PI) * 1.2, 1, 1);
    });
  },
  // Julemandsdragt: a red coat edged with fur, a wide belt with a gold buckle, a big white beard that sways, a sack strap.
  4: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, CREAM, 24, 0, 9, h);
      },
      (g, w, h) => {
        px(g, CREAM, 0, h - 6, w, 6);
      },
    );
    roll(c, CREAM, 2.2, 0.65);
    const v = grid(c);
    // The belt, wide and black, with a big gold buckle that glints.
    v.b(-4.05, -0.6, -2.45, 8.1, 2.1, 4.9, BLACK);
    v.b(-1.4, -0.9, 2.3, 2.8, 2.7, 0.5, GOLD);
    v.b(-0.8, -0.3, 2.7, 1.6, 1.5, 0.3, BLACK);
    v.b(-1.5, 1.4, 2.5, 3.0, 0.3, 0.3, "#fff0a8");
    // The coat skirt and its fur: a thick bumpy hem.
    v.b(-4.05, -3.6, -2.45, 8.1, 3.0, 4.9, RED);
    v.b(-4.2, -4.2, -2.6, 8.4, 1.3, 5.2, CREAM);
    for (let i = 0; i < 9; i++)
      v.b(-4.2 + i * 0.93, -4.7, -2.65 + (i % 2) * 0.1, 0.9, 0.7, 5.3, i % 2 ? WHITE : CREAM);
    for (let i = 0; i < 4; i++) {
      v.b(-4.2, 2.8 - i * 1.4, -2.2, 0.35, 1.0, 0.8, CREAM);
    }
    // The strap of the sack, across the chest and back, and the sack hanging at the hip.
    for (let i = 0; i < 6; i++) {
      v.b(-3.3 + i * 1.1, 7.0 - i * 1.5, 2.45, 1.7, 1.7, 0.3, BROWN);
      v.b(-3.3 + i * 1.1, 7.0 - i * 1.5, -2.75, 1.7, 1.7, 0.3, BROWN);
    }
    v.b(-3.0, 6.4, 2.75, 0.6, 0.6, 0.1, GOLD);
    const sack = vpart(c.body, [-2.6 * U, 1.4 * U, -2.6 * U]);
    const sv = new Vx(sack);
    sv.b(-2.0, -4.6, -1.2, 4.0, 4.4, 2.2, WOOD);
    sv.b(-2.4, -3.8, -1.0, 4.8, 2.8, 1.8, WOOD);
    sv.b(-1.6, -0.2, -0.8, 3.2, 0.6, 1.6, RED);
    sv.b(-1.2, 0.4, -0.5, 2.4, 0.8, 1.0, WOOD_DARK);
    // The beard: a big white bib, tier on tier, that sways.
    const beard = vpart(c.body, [0, 7.8 * U, 2.35 * U]);
    const bv = new Vx(beard);
    bv.b(-3.2, -2.2, 0, 6.4, 2.2, 0.7, WHITE);
    bv.b(-2.7, -4.2, 0.1, 5.4, 2.0, 0.7, "#efe9db");
    bv.b(-2.1, -5.8, 0.15, 4.2, 1.6, 0.7, WHITE);
    bv.b(-1.4, -7.0, 0.2, 2.8, 1.2, 0.7, "#efe9db");
    bv.b(-0.7, -8.0, 0.25, 1.4, 1.0, 0.6, WHITE);
    bv.b(-2.4, -1.4, 0.5, 1.4, 0.8, 0.4, "#fffdf6");
    bv.b(1.0, -1.4, 0.5, 1.4, 0.8, 0.4, "#fffdf6");
    ribCuff(c, CREAM, WHITE, -7.0, 1.8);
    armBand(c, BLACK, -5.0, 0.5, 0.06);
    c.tick((t, walking) => {
      beard.rotation.x =
        (walking ? 0.12 : 0.02) + Math.sin(t * (walking ? 9 : 1.6)) * (walking ? 0.09 : 0.04);
      sack.rotation.x = Math.sin(t * (walking ? 7 : 1.3) + 1) * (walking ? 0.16 : 0.03);
    });
    glints(c, [[0, 0.4, 2.9]], 0.5);
  },
  // Lucia-tog: a long white gown with a train that streams out behind, a red sash, glowing candles in the hands.
  5: (c) => {
    marks(
      c,
      (g, w, h) => {
        px(g, "#e4ddcc", 0, h - 3, w, 3);
        for (let x = 3; x < w; x += 12) px(g, GOLD, x, 6, 3, 3);
      },
      (g, w, h) => {
        px(g, "#e4ddcc", 0, h - 3, w, 3);
      },
    );
    roll(c, "#ffffff", 1.4, 0.5);
    const v = grid(c);
    for (let i = 0; i < 6; i++) v.b(-2.9 + i * 1.0, 7.0 - i * 1.15, 2.4, 2.1, 1.7, 0.35, RED);
    for (let i = 0; i < 6; i++) v.b(-2.9 + i * 1.0, 7.0 - i * 1.15, 2.75, 2.1, 0.3, 0.1, GOLD);
    v.b(-4.0, -1.4, -2.4, 8.0, 1.8, 4.8, RED);
    v.b(-4.05, -1.0, -2.45, 8.1, 0.35, 4.9, GOLD);
    v.b(-4.0, -5.4, -2.4, 8.0, 4.2, 4.8, c.main);
    v.b(-4.3, -6.0, -2.7, 8.6, 0.7, 5.4, "#e4ddcc");
    v.b(-4.4, -6.2, -2.8, 8.8, 0.3, 5.6, GOLD);
    ribCuff(c, "#e4ddcc", "#d4ccb8", -7.0, 1.6);
    // The train: three segments hung from the back of the sash, each lagging the last.
    const segs: VoxModel[] = [];
    let parent = vpart(c.body, [0, -0.6 * U, -2.6 * U]);
    const root = parent;
    for (let i = 0; i < 3; i++) {
      const w = 6.4 - i * 0.6;
      new Vx(parent).b(-w / 2, -3.4, -0.4, w, 3.4, 0.6, i % 2 ? "#e4ddcc" : c.main);
      new Vx(parent).b(-w / 2, -3.4, -0.45, w, 0.4, 0.7, i === 2 ? GOLD : "#d4ccb8");
      segs.push(parent);
      parent = vpart(parent, [0, -3.4 * U, 0]);
    }
    handCandles(c);
    c.tick((t, walking) => {
      const a = walking ? 0.28 : 0.07;
      segs.forEach((s, i) => {
        s.rotation.x = a + Math.sin(t * (walking ? 7 : 1.6) - i * 0.9) * (walking ? 0.2 : 0.06);
      });
      root.rotation.z = Math.sin(t * 1.5) * 0.04;
    });
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[JULEMARKED_BASE + Number(n)] = build;

// MARK: Back

/** A pixel pattern as blocks, row 0 at the top, in two colours merged into one mesh each. */
function pixels(
  parent: VoxModel,
  rows: string[],
  cell: number,
  pick: (r: number, c: number) => string,
  depth: number,
): void {
  const w = rows[0]!.length;
  const by = new Map<string, THREE.BufferGeometry[]>();
  rows.forEach((row, r) => {
    for (let c = 0; c < w; c++) {
      if (row[c] !== "1") continue;
      const g = new THREE.BoxGeometry(cell, cell, depth)
        .translate((c - (w - 1) / 2) * cell, -(r - (rows.length - 1) / 2) * cell, 0)
        .toNonIndexed();
      const k = pick(r, c);
      by.set(k, [...(by.get(k) ?? []), g]);
    }
  });
  for (const [color, list] of by) {
    const m = new THREE.Mesh(mergeAll(list), new THREE.MeshToonMaterial({ color }));
    m.userData.noBlock = true;
    m.castShadow = true;
    parent.add(m);
  }
}
const mergeAll = (l: THREE.BufferGeometry[]) => mergeGeometries(l)!;

const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
const MINI = ["101", "111", "010"];

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Gavesæk: a huge lumpy overflowing sack on the back, a gift with a bow and a candy cane peeking out, a glint.
  Gavesæk: (b, tick) => {
    const v = new Vx(b);
    for (const s of [-1, 1]) {
      const x = s > 0 ? 1.8 : -2.8;
      v.b(x, -7, 4, 1, 7.2, 0.5, BROWN);
    }
    const sack = vpart(b, [0, 0.5 * U, -5.4 * U]);
    const sv = new Vx(sack);
    sv.b(-4.4, -11.4, -3.6, 8.8, 9.6, 6.4, WOOD);
    sv.b(-5.2, -10.2, -3.0, 10.4, 7.2, 5.2, WOOD);
    sv.b(-3.4, -12.2, -3.0, 6.8, 1.2, 5.0, WOOD_DARK);
    // Lumps: bulging gifts under the cloth.
    for (const [x, y, z, w, h, d, col] of [
      [-5.8, -9.0, -1.8, 1.2, 2.6, 2.4, "#8a5a32"],
      [4.6, -8.0, -1.4, 1.2, 2.8, 2.2, "#8a5a32"],
      [-2.0, -6.0, 2.4, 3.0, 2.6, 0.8, "#b8814a"],
      [1.4, -9.6, 2.6, 2.6, 2.4, 0.8, "#b8814a"],
      [-4.8, -4.0, -0.8, 2.2, 1.6, 1.6, WOOD],
    ] as const)
      sv.b(x, y, z, w, h, d, col);
    // The mouth of the sack, gathered and tied with a red cord.
    sv.b(-4.2, -2.2, -3.0, 8.4, 1.6, 5.0, "#b8814a");
    sv.b(-3.2, -0.8, -2.4, 6.4, 1.4, 3.8, WOOD);
    sv.b(-4.4, -3.2, -3.2, 8.8, 0.9, 5.6, RED);
    sv.b(-0.8, -4.2, 2.2, 1.6, 2.0, 0.5, RED);
    sv.b(-2.4, -3.8, 2.3, 1.2, 1.0, 0.4, RED);
    // What spills out: a gift with a ribbon and bow, a blue gift, a candy cane and a star.
    const gift = vpart(sack, [0, 0, 0]);
    const gv = new Vx(gift);
    gv.b(-2.6, 0.6, -1.6, 3.4, 3.2, 3.2, GREEN);
    gv.b(-1.2, 0.6, -1.65, 0.8, 3.3, 3.3, RED);
    gv.b(-2.65, 1.8, -0.4, 3.5, 0.8, 0.8, RED);
    gv.b(-1.9, 3.8, -0.8, 1.6, 1.0, 1.0, RED);
    gv.b(-0.4, 3.8, -0.8, 1.6, 1.0, 1.0, RED);
    gv.b(-0.8, 3.6, -0.5, 0.8, 1.0, 0.8, RED_DARK);
    gv.b(1.3, 0.6, -1.2, 2.6, 2.4, 2.4, "#4a78c8");
    gv.b(2.2, 0.6, -1.25, 0.6, 2.5, 2.5, WHITE);
    for (let i = 0; i < 5; i++) gv.b(3.2, 0.5 + i * 1.0, -0.4, 0.8, 1.0, 0.8, i % 2 ? WHITE : RED);
    gv.b(2.4, 5.0, -0.4, 0.8, 0.8, 0.8, RED);
    gv.b(1.6, 5.8, -0.4, 1.6, 0.8, 0.8, WHITE);
    const star = gv.b(-4.4, 3.6, -0.5, 1.4, 1.4, 1.0, lit("#ffe27a"));
    gv.b(-4.0, 3.2, -0.5, 0.6, 2.2, 1.0, lit("#ffe27a"));
    gv.b(-4.8, 4.0, -0.5, 2.2, 0.6, 1.0, lit("#ffe27a"));
    const glint = sv.b(-3.4, -5.0, 2.6, 0.7, 0.7, 0.4, lit(WHITE));
    tick((t, walking) => {
      sack.rotation.x = Math.sin(t * (walking ? 7 : 1.4)) * (walking ? 0.1 : 0.02);
      sack.rotation.z = Math.sin(t * (walking ? 5 : 1.1) + 1) * (walking ? 0.06 : 0.015);
      gift.rotation.z = Math.sin(t * (walking ? 9 : 2) + 2) * (walking ? 0.08 : 0.025);
      star.scale.setScalar(0.8 + Math.max(0, Math.sin(t * 3)) * 0.5);
      glint.scale.setScalar(Math.max(0.05, Math.sin(t * 2.4) ** 5 * 2));
    });
  },
  // Julehjerte-vinger: big woven paper-heart wings, red and white, that flap, with little hearts drifting off.
  "Julehjerte-vinger": (b, tick) => {
    const wings: VoxModel[] = [];
    for (const s of [-1, 1] as const) {
      const w = vpart(b, [s * 1.2 * U, 0 * U, -3.4 * U]);
      const hearts: [number, number, number, number][] = [
        [0.3, 0.2, 0.046, 0.15],
        [0.58, 0.04, 0.038, -0.2],
        [0.78, -0.22, 0.028, -0.45],
      ];
      for (const [i, [x, y, cs, rot]] of hearts.entries()) {
        const p = vpart(w, [s * x, y, -0.015 * i]);
        p.rotation.z = s * rot;
        pixels(p, HEART, cs, (r, c) => ((r + c + i) % 2 ? CREAM : RED), 0.02);
        const back = vpart(p, [0, 0, -0.012]);
        pixels(back, HEART, cs, (r, c) => ((r + c + i) % 2 ? RED : "#ffffff"), 0.01);
      }
      wings.push(w);
    }
    // Hearts drifting up and away.
    const drift = [0, 1, 2, 3].map((i) => {
      const p = vpart(b, [0, 0, -0.15]);
      pixels(p, MINI, 0.045, () => (i % 2 ? RED : CREAM), 0.04);
      return p;
    });
    tick((t, walking) => {
      wings.forEach((w, i) => {
        const side = i ? 1 : -1;
        w.rotation.y = side * (0.34 + Math.sin(t * (walking ? 9 : 2.4)) * (walking ? 0.4 : 0.16));
        w.rotation.z = side * Math.sin(t * (walking ? 9 : 2.4) + 1) * -0.05;
      });
      drift.forEach((p, i) => {
        const k = (t * 0.3 + i / 4) % 1;
        const dir = i % 2 ? 1 : -1;
        p.position.set(dir * (0.3 + k * 0.4 + (i % 3) * 0.06), 0.1 + k * 0.5, -0.15 - k * 0.1);
        p.rotation.z = dir * k * 0.8;
        p.scale.setScalar(Math.sin(Math.PI * k) * 1.2 + 0.01);
      });
    });
  },
};
Object.assign(BACK_BUILDERS, BACKS);
