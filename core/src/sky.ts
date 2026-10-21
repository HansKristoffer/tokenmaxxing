/**
 * The sky over Copenhagen: where the sun and moon are, and what the weather is doing. Pure maths and
 * tables, no network: the server fetches the weather (`server/src/weather.ts`), the client draws all of it.
 */
import { dayKey, pad2, worldWall } from "./range.ts";

export const CPH = { lat: 55.6761, lon: 12.5683 } as const;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => clamp01(x) * clamp01(x) * (3 - 2 * clamp01(x));

// MARK: The sun

/** Julian centuries since J2000 (NOAA's `T`). */
const centuries = (ms: number) => (ms / DAY_MS + 2440587.5 - 2451545) / 36525;

/** The sun's declination (radians) and the equation of time (minutes) at `ms`: NOAA's solar calculator. */
function solar(ms: number): { decl: number; eqTime: number } {
  const T = centuries(ms);
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * RAD;
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M) * 0.000289;
  const omega = (125.04 - 1934.136 * T) * RAD;
  const lambda = (L0 + C - 0.00569 - 0.00478 * Math.sin(omega)) * RAD;
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * RAD;
  const y = Math.tan(eps / 2) ** 2;
  const l0 = L0 * RAD;
  const eqTime =
    4 *
    (180 / Math.PI) *
    (y * Math.sin(2 * l0) -
      2 * e * Math.sin(M) +
      4 * e * y * Math.sin(M) * Math.cos(2 * l0) -
      0.5 * y * y * Math.sin(4 * l0) -
      1.25 * e * e * Math.sin(2 * M));
  return { decl: Math.asin(Math.sin(eps) * Math.sin(lambda)), eqTime };
}

/** The sun's height above the horizon in degrees (negative below), and whether it's still morning. */
function sunElevation(ms: number, lat = CPH.lat, lon = CPH.lon): { elevation: number; morning: boolean } {
  const { decl, eqTime } = solar(ms);
  const utcMin = (((ms / 60_000) % 1440) + 1440) % 1440;
  const hourAngle = ((((utcMin + eqTime + 4 * lon) % 1440) + 1440) % 1440) / 4 - 180;
  const sin =
    Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(hourAngle * RAD);
  return { elevation: Math.asin(Math.min(1, Math.max(-1, sin))) / RAD, morning: hourAngle < 0 };
}

/** The sun's centre is 0.833° below the horizon at sunrise and sunset (refraction and its radius). */
const RISE_DEG = 90.833;

/** Sunrise and sunset (ms) on the Copenhagen day `ms` falls in. */
export function sunTimes(ms: number, lat = CPH.lat, lon = CPH.lon): { sunrise: number; sunset: number } {
  const [y, m, d] = dayKey(ms).split("-").map(Number);
  const noon = Date.UTC(y!, m! - 1, d!, 12);
  let rise = noon - 6 * 3_600_000;
  let set = noon + 6 * 3_600_000;
  // One pass at the day's own noon, then refined at the times it found.
  for (let i = 0; i < 2; i++) {
    const at = (t: number, sign: 1 | -1) => {
      const { decl, eqTime } = solar(t);
      const cosH =
        Math.cos(RISE_DEG * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) -
        Math.tan(lat * RAD) * Math.tan(decl);
      const ha = Math.acos(Math.min(1, Math.max(-1, cosH))) / RAD;
      const min = 720 - 4 * (lon + sign * ha) - eqTime;
      return Date.UTC(y!, m! - 1, d!) + min * 60_000;
    };
    rise = at(rise, 1);
    set = at(set, -1);
  }
  return { sunrise: rise, sunset: set };
}

type Phase = "night" | "dawn" | "day" | "dusk";

export interface Light {
  phase: Phase;
  /** Degrees above the horizon. */
  elevation: number;
  /** 0 full daylight .. 1 full night, smooth through twilight. */
  darkness: number;
  /** 0..1, how orange the light is: peaks as the sun meets the horizon. */
  warmth: number;
}

/** Full light from this elevation up; full night from `NIGHT_DEG` down; civil twilight blends between. */
const DAY_DEG = 6;
const NIGHT_DEG = -10;

export function lightAt(ms: number): Light {
  const { elevation, morning } = sunElevation(ms);
  const darkness = smooth((DAY_DEG - elevation) / (DAY_DEG - NIGHT_DEG));
  const warmth = smooth(1 - Math.abs(elevation - 1) / 9);
  const phase: Phase = elevation > DAY_DEG ? "day" : elevation < -6 ? "night" : morning ? "dawn" : "dusk";
  return { phase, elevation, darkness, warmth };
}

// MARK: The moon

const SYNODIC = 29.530588853;
/** A known new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const MOON_NAMES = [
  "new moon",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full moon",
  "waning gibbous",
  "last quarter",
  "waning crescent",
];

/** Where the moon is in its cycle: `age` 0..1 (0 new, .5 full), the lit share and a name. */
export function moonPhase(ms: number): { age: number; lit: number; waxing: boolean; name: string } {
  const days = (ms - NEW_MOON) / DAY_MS;
  const age = (((days / SYNODIC) % 1) + 1) % 1;
  return {
    age,
    lit: (1 - Math.cos(2 * Math.PI * age)) / 2,
    waxing: age < 0.5,
    name: MOON_NAMES[Math.round(age * 8) % 8]!,
  };
}

// MARK: Time

/** `HH:MM` on the Copenhagen clock (DST-correct). */
export function clockTime(ms: number): string {
  const { hour, minute } = worldWall(ms);
  return `${pad2(hour)}:${pad2(minute)}`;
}

// MARK: Weather

export type WeatherKind = "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "storm" | "snow";

/** All the weather the game knows: small enough to ride along in every snapshot. */
export interface Weather {
  kind: WeatherKind;
  /** 0..1: how hard it falls (or how thick the fog is). */
  intensity: number;
  /** Wind speed in m/s. */
  windMs: number;
  /** Degrees the wind comes from (0 north, 90 east). */
  windDir: number;
  /** Cloud cover 0..1. */
  cloud: number;
}

export const CALM: Weather = { kind: "clear", intensity: 0, windMs: 1.5, windDir: 270, cloud: 0.1 };

const PRESETS: Record<WeatherKind, Weather> = {
  clear: CALM,
  cloudy: { kind: "cloudy", intensity: 0.7, windMs: 4, windDir: 250, cloud: 0.8 },
  fog: { kind: "fog", intensity: 0.8, windMs: 1, windDir: 200, cloud: 0.9 },
  drizzle: { kind: "drizzle", intensity: 0.35, windMs: 3, windDir: 240, cloud: 0.8 },
  rain: { kind: "rain", intensity: 0.7, windMs: 7, windDir: 260, cloud: 0.9 },
  storm: { kind: "storm", intensity: 1, windMs: 14, windDir: 250, cloud: 1 },
  snow: { kind: "snow", intensity: 0.7, windMs: 4, windDir: 330, cloud: 0.9 },
};

/** Presets for `SKY_WEATHER=rain` and `?weather=rain`. */
export const presetWeather = (kind: string): Weather | null =>
  Object.hasOwn(PRESETS, kind) ? { ...PRESETS[kind as WeatherKind] } : null;

/** WMO weather interpretation codes → kind and how hard (https://open-meteo.com/en/docs). */
const CODES: Record<number, [WeatherKind, number]> = {
  0: ["clear", 0],
  1: ["clear", 0],
  2: ["cloudy", 0.5],
  3: ["cloudy", 0.9],
  45: ["fog", 0.6],
  48: ["fog", 0.85],
  51: ["drizzle", 0.2],
  53: ["drizzle", 0.35],
  55: ["drizzle", 0.5],
  56: ["drizzle", 0.35],
  57: ["drizzle", 0.55],
  61: ["rain", 0.35],
  63: ["rain", 0.65],
  65: ["rain", 0.95],
  66: ["rain", 0.5],
  67: ["rain", 0.85],
  71: ["snow", 0.3],
  73: ["snow", 0.6],
  75: ["snow", 0.9],
  77: ["snow", 0.3],
  80: ["rain", 0.4],
  81: ["rain", 0.7],
  82: ["rain", 1],
  85: ["snow", 0.5],
  86: ["snow", 0.9],
  95: ["storm", 0.8],
  96: ["storm", 0.9],
  99: ["storm", 1],
};

/** Open-Meteo's `current` block reduced to a `Weather`; null if it isn't one. */
export function weatherFrom(current: unknown): Weather | null {
  const c = current as Record<string, unknown> | null;
  const num = (k: string) => (typeof c?.[k] === "number" && Number.isFinite(c[k]) ? (c[k] as number) : null);
  const code = num("weather_code");
  if (code === null) return null;
  const [kind, base] = CODES[code] ?? ["clear", 0];
  const precip = num("precipitation");
  const falls = kind === "rain" || kind === "drizzle" || kind === "snow";
  // Measured rain nudges the code's guess: a "light rain" code with 3 mm an hour is not light.
  const intensity =
    falls && precip !== null && precip > 0 ? clamp01((base + Math.min(1, precip / 4)) / 2) : base;
  const cloud = clamp01((num("cloud_cover") ?? 0) / 100);
  return {
    kind,
    intensity: Math.round(Math.max(intensity, falls ? 0.15 : 0) * 100) / 100,
    windMs: Math.round(Math.min(40, Math.max(0, num("wind_speed_10m") ?? 0)) * 10) / 10,
    windDir: ((Math.round(num("wind_direction_10m") ?? 0) % 360) + 360) % 360,
    cloud: kind === "rain" || kind === "snow" || kind === "storm" ? Math.max(cloud, 0.6) : cloud,
  };
}

// MARK: Winter

/**
 * Winter on the Copenhagen calendar (1 is January). In these months the town is snowy by default:
 * delete this and `winterSnow` (and its one call in `web/src/game/sky.ts`) to switch it off.
 */
export const WINTER_MONTHS: readonly number[] = [12, 1, 2];

const monthOf = (ms: number) => Number(dayKey(ms).slice(5, 7));
export const isWinter = (ms: number): boolean => WINTER_MONTHS.includes(monthOf(ms));

/**
 * What the sky shows at `ms`: in winter, rain and storms fall as snow, and a dry day gets a light, gentle
 * snowfall (its cloud cover stays, so a clear day keeps its sun). Fog stays fog. Outside winter, as it is.
 */
export function winterSnow(weather: Weather, ms: number): Weather {
  if (!isWinter(ms)) return weather;
  switch (weather.kind) {
    case "drizzle":
    case "rain":
    case "storm":
      return { ...weather, kind: "snow", intensity: Math.max(0.3, weather.intensity * 0.8) };
    case "clear":
    case "cloudy":
      return { ...weather, kind: "snow", intensity: 0.25 };
    default:
      return weather;
  }
}

/** Whether the ground should be white: while it snows, and all winter (fog included). */
export const snowCover = (weather: Weather, ms: number): boolean => weather.kind === "snow" || isWinter(ms);

export const sameWeather = (a: Weather, b: Weather): boolean =>
  a.kind === b.kind &&
  a.intensity === b.intensity &&
  a.windMs === b.windMs &&
  a.windDir === b.windDir &&
  a.cloud === b.cloud;

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number): string => COMPASS[Math.round(deg / 45) % 8]!;

/** `2026-10-21T22:30` read as Copenhagen wall time → ms (for `?sky=` and tests); null if it isn't one. */
export function copenhagenToMs(text: string): number | null {
  const m = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)$/.exec(text);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const shown = (ms: number) => {
    const w = worldWall(ms);
    return Date.UTC(w.y, w.m - 1, w.d, w.hour, w.minute);
  };
  // Off by the zone's offset at that moment; one more round covers the DST edge.
  const first = guess - (shown(guess) - guess);
  return first - (shown(first) - guess);
}
