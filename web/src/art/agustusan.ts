import { C } from "./palette.ts";
import { bake, cached, once } from "./pixels.ts";

/**
 * Agustusan's scenery in pixels (`game/agustusan.ts` draws it; `core/src/agustusan.ts` says where): the merah putih
 * flag and umbul-umbul on bamboo poles, bunting, the gapura gate, the panjat pinang pole with its prizes, the tumpeng,
 * the kerupuk string and the sack-race flags. Red on top, white below, as on the flag that Fatmawati sewed.
 */

export const RED = "#d8283a";
export const RED_D = "#a81d2c";
export const WHITE = "#fbf7ef";
export const WHITE_D = "#ddd5c6";
const BAMBOO = "#c9a95a";
const BAMBOO_D = "#9c7d3a";
const GOLD = "#f5c842";
const GOLD_D = "#c9971f";

// MARK: Flags

/** The flag pole sprite: 24 wide with the pole 6 px in, 44 tall; tips at the top. */
export const FLAG_PX = { w: 24, h: 44, pole: 6 } as const;
/** Where bunting ties on, from the sprite's top, and the pole's x. */
export const FLAG_TIE = 8;

/** A bendera (kind 0): the red-over-white flag, waving over two frames. An umbul-umbul (kind 1): a long tapering pennant. */
export const flagSprite = cached(
  (kind: 0 | 1, frame: 0 | 1) => `${kind}.${frame}`,
  (kind: 0 | 1, frame: 0 | 1) =>
    bake(FLAG_PX.w, FLAG_PX.h, (p) => {
      p.rect(3, 41, 7, 2, C.shadow);
      const x = FLAG_PX.pole;
      p.rect(x, 3, 2, 40, BAMBOO);
      p.rect(x + 1, 3, 1, 40, BAMBOO_D);
      for (const y of [12, 22, 32]) p.rect(x, y, 2, 1, BAMBOO_D);
      p.disc(x + 1, 2, 2, GOLD);
      p.px(x + 1, 1, WHITE);
      if (kind === 0) {
        for (let i = 0; i < 15; i++) {
          const dy = Math.round(Math.sin(i * 0.7 + frame * Math.PI) * (0.4 + i * 0.08));
          p.rect(x + 2 + i, 5 + dy, 1, 5, RED);
          p.rect(x + 2 + i, 10 + dy, 1, 5, WHITE);
          p.px(x + 2 + i, 15 + dy, WHITE_D);
        }
        p.rect(x + 2, 5, 1, 10, RED_D);
      } else {
        // The crossbar, and the long pennant hanging from it: red, white, red, white, narrowing to a tip.
        p.rect(x - 1, 4, 9, 1, BAMBOO_D);
        for (let row = 0; row < 30; row++) {
          const w = Math.max(2, 7 - Math.floor(row / 5));
          const sway = Math.round(Math.sin(row * 0.3 + frame * Math.PI) * 1.3 * (row / 30));
          p.rect(x + 1 + sway, 5 + row, w, 1, Math.floor(row / 5) % 2 === 0 ? RED : WHITE);
        }
        p.rect(x + 1, 5, 7, 1, RED_D);
      }
    }),
);

/** A string of bunting `w` px wide: a cord that sags `sag` px in the middle, red and white flags along it. */
export const buntingSprite = cached(
  (w: number, sag: number) => `${w}.${sag}`,
  (w: number, sag: number) =>
    bake(w, sag + 8, (p) => {
      const at = (x: number) => Math.round(4 * sag * (x / w) * (1 - x / w));
      for (let x = 0; x < w; x++) p.px(x, at(x), "#5e3d28");
      for (let x = 3, i = 0; x < w - 2; x += 5, i++) {
        const y = at(x) + 1;
        const c = i % 2 === 0 ? RED : WHITE;
        p.rect(x - 1, y, 4, 1, c);
        p.rect(x, y + 1, 2, 1, c);
        p.px(x, y + 2, c);
        if (c === WHITE) p.rect(x - 1, y, 4, 1, WHITE_D);
        if (c === WHITE) p.rect(x, y + 1, 2, 1, WHITE);
      }
    }),
);

// MARK: The gapura

/** The gate over the four tiles between the posts and the posts themselves: 64 wide, 64 tall, bottom at the posts' feet. */
export const GAPURA_PX = { w: 64, h: 64 } as const;
/** Where bunting ties on, from the sprite's top and each post's centre x. */
export const GAPURA_TIE = { y: 14, left: 4, right: 59 } as const;

export const gapuraSprite = once(() =>
  bake(GAPURA_PX.w, GAPURA_PX.h, (p) => {
    const post = (x0: number) => {
      // Painted red and white in broad bands, on a stone plinth, a little tiered roof on top.
      p.rect(x0 + 1, 62, 8, 2, C.shadow);
      p.rect(x0, 54, 10, 8, "#8e8a82");
      p.rect(x0, 54, 10, 1, "#b9b4a8");
      for (let y = 14; y < 54; y += 8) {
        p.rect(x0 + 1, y, 8, 4, WHITE);
        p.rect(x0 + 1, y + 4, 8, 4, RED);
      }
      p.rect(x0 + 1, 14, 1, 40, WHITE_D);
      p.rect(x0 + 8, 14, 1, 40, RED_D);
      p.rect(x0 - 1, 10, 12, 4, GOLD_D);
      p.rect(x0 - 1, 10, 12, 1, GOLD);
      p.rect(x0 + 1, 6, 8, 4, RED_D);
      p.rect(x0 + 3, 3, 4, 3, GOLD_D);
      p.px(x0 + 4, 2, GOLD);
      p.px(x0 + 5, 1, GOLD);
    };
    post(0);
    post(54);
    // The beam: a red board with a white edge on top of the posts, DIRGAHAYU RI over a white strip.
    p.rect(9, 14, 46, 14, C.ink);
    p.rect(10, 15, 44, 12, RED);
    p.rect(10, 15, 44, 1, "#ee5666");
    p.text("DIRGAHAYU", 14, 17, WHITE);
    p.px(12, 20, GOLD);
    p.px(51, 20, GOLD);
    p.rect(9, 28, 46, 7, C.ink);
    p.rect(10, 28, 44, 6, WHITE);
    p.text("17 AGUSTUS", 13, 29, RED_D);
    // The crest above: a gold star in a red disc, flanked by two little flags.
    p.disc(32, 8, 8, C.ink);
    p.disc(32, 8, 7, RED);
    p.rect(32, 3, 1, 3, GOLD);
    p.rect(30, 6, 5, 2, GOLD);
    p.rect(31, 8, 3, 3, GOLD);
    p.px(30, 11, GOLD);
    p.px(34, 11, GOLD);
    for (const x of [14, 46]) {
      p.rect(x, 4, 1, 10, BAMBOO_D);
      p.rect(x + 1, 4, 5, 2, RED);
      p.rect(x + 1, 6, 5, 2, WHITE);
    }
    // Bamboo sills of the gate's inside, with a swag of flowers.
    for (const x of [14, 22, 30, 38, 46]) p.rect(x, 35, 2, 2, x % 16 === 14 ? RED : WHITE);
  }),
);

// MARK: The panjat pinang

/** The greased pole: 16 wide, 60 tall (three and a half tiles, with the prizes on top). */
export const POLE_PX = { w: 16, h: 60 } as const;
/** Where the climber's feet are at the bottom and at the top, from the sprite's top. */
export const POLE_CLIMB = { bottom: 54, top: 17 } as const;

export const poleSprite = once(() =>
  bake(POLE_PX.w, POLE_PX.h, (p) => {
    p.rect(3, 57, 10, 2, C.shadow);
    // The pole: dark wood, shiny grease bands.
    p.rect(6, 12, 4, 46, "#7a4a22");
    p.rect(6, 12, 1, 46, "#9a6234");
    p.rect(9, 12, 1, 46, "#5a3416");
    for (let y = 20; y < 54; y += 6) {
      p.rect(6, y, 4, 2, "#b8a03c");
      p.rect(6, y, 2, 1, "#f2e08a");
    }
    p.rect(5, 54, 6, 4, "#8e8a82");
    // The frame on top: a bamboo cross with the prizes hanging from it.
    p.rect(1, 8, 14, 2, BAMBOO);
    p.rect(1, 9, 14, 1, BAMBOO_D);
    p.rect(7, 4, 2, 8, BAMBOO);
    // A bendera on the very top.
    p.rect(9, 1, 1, 5, BAMBOO_D);
    p.rect(10, 0, 5, 2, RED);
    p.rect(10, 2, 5, 2, WHITE);
    // The prizes: a red sarong roll, a boxed fan, a white sack of rice, a bicycle wheel.
    p.rect(2, 10, 1, 2, C.ink);
    p.rect(1, 12, 4, 5, RED);
    p.rect(1, 12, 4, 1, "#ee5666");
    p.rect(12, 10, 1, 2, C.ink);
    p.rect(11, 12, 4, 6, WHITE);
    p.rect(11, 12, 4, 1, WHITE_D);
    p.rect(11, 15, 4, 1, RED);
    p.rect(4, 10, 1, 3, C.ink);
    p.disc(4, 15, 2, C.ink);
    p.disc(4, 15, 1, "#e0e6ee");
    p.px(4, 15, C.ink);
    p.rect(10, 10, 1, 2, C.ink);
    p.rect(9, 12, 2, 3, GOLD);
  }),
);

/** The climber, 8 wide, 9 tall: arms and legs round the pole, a red and white headband. */
export const climberSprite = cached(
  (frame: 0 | 1) => String(frame),
  (frame: 0 | 1) =>
    bake(10, 11, (p) => {
      p.rect(3, 0, 4, 1, RED);
      p.rect(3, 1, 4, 1, WHITE);
      p.rect(3, 2, 4, 3, "#c68a5f");
      p.px(4, 3, C.ink);
      p.px(6, 3, C.ink);
      p.rect(2, 5, 6, 3, WHITE);
      p.rect(2, 5, 6, 1, WHITE_D);
      p.rect(1, 5 + frame, 2, 2, "#c68a5f");
      p.rect(7, 6 - frame, 2, 2, "#c68a5f");
      p.rect(3, 8, 2, 2 + frame, RED_D);
      p.rect(5, 8, 2, 3 - frame, RED_D);
    }),
);

// MARK: The tumpeng

/** The tumpeng on its table: 16 wide, 22 tall. */
export const TUMPENG_PX = { w: 16, h: 22 } as const;

export const tumpengSprite = once(() =>
  bake(TUMPENG_PX.w, TUMPENG_PX.h, (p) => {
    // The table, a red cloth with a white border.
    p.rect(0, 16, 16, 6, RED);
    p.rect(0, 16, 16, 1, WHITE);
    p.rect(0, 20, 16, 2, RED_D);
    for (let x = 1; x < 16; x += 3) p.rect(x, 21, 2, 1, WHITE);
    // The banana-leaf tray and the cone of yellow rice.
    p.rect(1, 14, 14, 3, "#3f8c50");
    p.rect(2, 14, 12, 1, "#72bf52");
    for (let row = 0; row < 11; row++) {
      const half = Math.floor(row * 0.45) + 1;
      const y = 3 + row;
      p.rect(8 - half, y, half * 2, 1, row % 4 === 3 ? "#e4b238" : "#f5d04c");
      p.px(8 - half, y, "#c9971f");
      p.px(7 + half, y, "#c9971f");
    }
    p.px(6, 7, "#fff0a8");
    p.px(7, 9, "#fff0a8");
    // A chilli flower on the tip, the side dishes round the foot: cucumber, egg, a red chilli.
    p.rect(8, 1, 1, 3, RED);
    p.px(7, 1, "#e8584f");
    p.px(9, 2, "#e8584f");
    for (const [x, c] of [
      [2, "#72bf52"],
      [4, WHITE],
      [11, "#e0a24a"],
      [13, RED],
    ] as const)
      p.rect(x, 13, 2, 2, c);
  }),
);

// MARK: Makan kerupuk

/** The kerupuk string between two bamboo posts: 16 wide, 30 tall, three crackers that swing. */
export const KERUPUK_PX = { w: 16, h: 30 } as const;

export const kerupukSprite = cached(
  (frame: 0 | 1) => String(frame),
  (frame: 0 | 1) =>
    bake(KERUPUK_PX.w, KERUPUK_PX.h, (p) => {
      p.rect(2, 27, 12, 2, C.shadow);
      for (const x of [0, 14]) {
        p.rect(x, 6, 2, 23, BAMBOO);
        p.rect(x + (x ? 1 : 0), 6, 1, 23, BAMBOO_D);
      }
      // The string across the top, sagging.
      for (let x = 1; x < 15; x++) p.px(x, 6 + Math.round(Math.sin((x / 15) * Math.PI)), "#5e3d28");
      for (const [i, x] of [3, 8, 12].entries()) {
        const sw = frame === 0 ? (i % 2 ? 1 : -1) : i % 2 ? -1 : 1;
        p.rect(x, 8, 1, 6 + (i % 2), "#5e3d28");
        const y = 14 + (i % 2);
        // A prawn cracker: round, pale with a tan rim.
        p.rect(x - 2 + sw, y, 5, 4, "#e9c880");
        p.rect(x - 1 + sw, y - 1, 3, 1, "#e9c880");
        p.rect(x - 1 + sw, y + 4, 3, 1, "#e9c880");
        p.rect(x - 1 + sw, y + 1, 3, 2, "#fff0c8");
        p.px(x + sw, y + 1, "#f5d890");
      }
    }),
);

// MARK: The sack race

/** A flag on a pole at the start (kind 0) or the finish (kind 1) of the lane: 16 wide, 26 tall. */
export const FLAGLINE_PX = { w: 16, h: 26 } as const;

export const laneFlagSprite = cached(
  (kind: 0 | 1) => String(kind),
  (kind: 0 | 1) =>
    bake(FLAGLINE_PX.w, FLAGLINE_PX.h, (p) => {
      p.rect(4, 24, 8, 1, C.shadow);
      p.rect(7, 3, 2, 22, BAMBOO);
      p.rect(8, 3, 1, 22, BAMBOO_D);
      p.disc(8, 2, 2, GOLD);
      if (kind === 0) {
        // The start: a red pennant with a white arrow, and a sack at its foot.
        p.rect(9, 5, 7, 8, RED);
        p.rect(10, 8, 4, 1, WHITE);
        p.px(13, 7, WHITE);
        p.px(13, 9, WHITE);
      } else {
        // The finish: chequered.
        for (let y = 0; y < 3; y++)
          for (let x = 0; x < 3; x++) p.rect(9 + x * 2, 5 + y * 3, 2, 3, (x + y) % 2 ? WHITE : C.ink);
        p.rect(9, 5, 6, 1, C.ink);
      }
      // A burlap sack on the ground by it.
      p.rect(2, 19, 5, 5, "#c9a56a");
      p.rect(2, 19, 5, 1, "#a8844a");
      p.rect(3, 18, 3, 1, "#a8844a");
      p.rect(2, 22, 5, 1, "#a8844a");
    }),
);
