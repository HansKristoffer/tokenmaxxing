import type { Festive, FestiveId } from "@tokenmaxxing/core/festive.ts";
import { plural } from "@tokenmaxxing/core/format.ts";

/**
 * The festive themes' colours, shared by the 2D canvas (`sky.ts`) and the 3D town (`render3d/town/fx3d.ts`) so the two agree.
 * Pure: no DOM, no three. Each theme is graded in two places: the scene's tint (a multiply colour in 2D, the
 * hemisphere and sun colours in 3D) and the sky dome (3D only).
 */

export type RGB = readonly [number, number, number];

interface Grade {
  /** The tint's colour by day, at dusk and at night. */
  day: RGB;
  dusk: RGB;
  night: RGB;
  /** How far the tint goes by day, and how much more at dusk and night. */
  base: number;
  gain: number;
}

// The colour table: append a theme here (and in `SKY`, `festiveGreeting`, hud.css `[data-festive]`).
const GRADE: Record<FestiveId, Grade> = {
  // Violet gloom, orange at dusk.
  halloween: { day: [214, 196, 232], dusk: [255, 138, 62], night: [112, 70, 176], base: 0.2, gain: 0.55 },
  // Warm candle at dusk, cool blue-white at night.
  christmas: { day: [255, 245, 233], dusk: [255, 198, 122], night: [150, 186, 242], base: 0.08, gain: 0.42 },
  // Bonfire-orange dusk, a light day.
  sanktHans: { day: [255, 249, 236], dusk: [255, 146, 58], night: [150, 112, 150], base: 0.05, gain: 0.5 },
  // Deep blue night with gold at the edges.
  nytar: { day: [236, 240, 255], dusk: [255, 200, 110], night: [76, 96, 190], base: 0.1, gain: 0.5 },
  // Fresh pastel spring light, pink at dusk.
  paaske: { day: [255, 251, 222], dusk: [255, 214, 206], night: [176, 192, 232], base: 0.14, gain: 0.3 },
  // A quiet dusk blue with candle gold.
  befrielsen: { day: [244, 245, 250], dusk: [160, 176, 226], night: [120, 138, 206], base: 0.05, gain: 0.4 },
  // Clear warm light, a gold-and-rose dusk for the evening of the 17th.
  agustusan: { day: [255, 247, 234], dusk: [255, 170, 120], night: [190, 166, 208], base: 0.08, gain: 0.4 },
};

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * The theme's tint at this light: `rgb` to mix the scene's own tint toward by `k` (0..1, already scaled by the
 * intensity). `darkness` and `warmth` are the sun's (`Light`).
 */
export function festiveGrade(f: Festive, darkness: number, warmth: number): { rgb: RGB; k: number } {
  const g = GRADE[f.id];
  const m = Math.max(darkness, warmth);
  let rgb = mix(g.day, g.night, darkness);
  rgb = mix(rgb, g.dusk, warmth * (1 - darkness * 0.5));
  return { rgb, k: Math.min(1, f.intensity * (g.base + g.gain * m)) };
}

/** The sky dome's colours for the theme: top and horizon, at dusk and at night (hex, for three). */
export const SKY: Record<
  FestiveId,
  { duskTop: string; duskHor: string; nightTop: string; nightHor: string }
> = {
  halloween: { duskTop: "#45257a", duskHor: "#ff6f2a", nightTop: "#140a30", nightHor: "#4a2468" },
  christmas: { duskTop: "#5b6fb4", duskHor: "#ffc27c", nightTop: "#0b1636", nightHor: "#2c4378" },
  sanktHans: { duskTop: "#6a4a7e", duskHor: "#ff8a3a", nightTop: "#10122e", nightHor: "#53375a" },
  nytar: { duskTop: "#2c3a90", duskHor: "#f0b550", nightTop: "#050a3a", nightHor: "#26358f" },
  paaske: { duskTop: "#8aa0d8", duskHor: "#ffc9c0", nightTop: "#142048", nightHor: "#4c5f98" },
  befrielsen: { duskTop: "#3d4f94", duskHor: "#e8c070", nightTop: "#0a1236", nightHor: "#2a3c78" },
  agustusan: { duskTop: "#5f7cc0", duskHor: "#ffb07c", nightTop: "#0c1438", nightHor: "#3c3f78" },
};

/** How far the dome moves toward `SKY` (0..1): none by day, most at dusk and night. */
export const skyWeight = (f: Festive, darkness: number, warmth: number): number =>
  Math.min(1, f.intensity * 0.8 * Math.max(darkness, warmth));

/** The toast for the first visit of the day in a theme: "Happy Halloween", "6 sleeps to Christmas". */
export function festiveGreeting(f: Festive): string {
  switch (f.id) {
    case "halloween":
      return "🎃 Happy Halloween";
    case "christmas":
      if (f.days < 0) return `🎄 ${plural(-f.days, "sleep")} to Christmas`;
      return f.days === 0 ? "🎄 Merry Christmas Eve" : "🎄 Merry Christmas";
    case "sanktHans":
      return f.days < 0 ? "🔥 Sankt Hans tomorrow: bonfires on the beach" : "🔥 Glædelig Sankt Hans";
    case "nytar":
      return f.days < 0
        ? "🎆 Nytårsaften tomorrow"
        : f.days === 0
          ? "🎆 Godt nytår i aften"
          : "🎆 Godt nytår";
    case "paaske":
      return "🐣 Glædelig påske";
    case "befrielsen":
      return f.days === 0 ? "🕯️ Lys i vinduerne i aften, 4. maj" : "🕊️ Glædelig befrielsesdag";
    case "agustusan":
      return f.days === 0
        ? "🇮🇩 Selamat Hari Kemerdekaan! Dirgahayu RI, merdeka!"
        : `🇮🇩 ${f.days === -1 ? "Besok" : `${-f.days} hari lagi`}: 17 Agustus, Hari Kemerdekaan`;
  }
}
