/**
 * Aarhus for the 3D demo: where the sun is over Aarhus, and the weather there right now (Open-Meteo, no key).
 * `core/src/sky.ts` is hard-wired to Copenhagen and shared with the 2D game, so the demo does its own sun here
 * and reuses the rest of core's sky (moon, weather presets, `weatherFrom`'s WMO rules). Aarhus shares
 * Copenhagen's zone (`Europe/Copenhagen`), so the core wall-clock helpers still read Aarhus time.
 */

import { type Light, type Weather, weatherFrom } from "@tokenmaxxing/core/sky.ts";
import { clamp } from "hanzio";
import { storage } from "../storage.ts";

export const AARHUS = { lat: 56.1629, lon: 10.2039 } as const;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** The sun's declination (radians) and the equation of time (minutes): NOAA's solar calculator. */
function solar(ms: number): { decl: number; eqTime: number } {
  const T = (ms / DAY_MS + 2440587.5 - 2451545) / 36525;
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

const DAY_DEG = 6;
const NIGHT_DEG = -10;

/** The light over Aarhus at `ms` (same shape and twilight curve as core's `lightAt`). */
export function lightAt(ms: number): Light {
  const { decl, eqTime } = solar(ms);
  const utcMin = (((ms / 60_000) % 1440) + 1440) % 1440;
  const hourAngle = ((((utcMin + eqTime + 4 * AARHUS.lon) % 1440) + 1440) % 1440) / 4 - 180;
  const sin =
    Math.sin(AARHUS.lat * RAD) * Math.sin(decl) +
    Math.cos(AARHUS.lat * RAD) * Math.cos(decl) * Math.cos(hourAngle * RAD);
  const elevation = Math.asin(clamp(sin, -1, 1)) / RAD;
  const morning = hourAngle < 0;
  const darkness = smooth((DAY_DEG - elevation) / (DAY_DEG - NIGHT_DEG));
  const warmth = smooth(1 - Math.abs(elevation - 1) / 9);
  const phase = elevation > DAY_DEG ? "day" : elevation < -6 ? "night" : morning ? "dawn" : "dusk";
  return { phase, elevation, darkness, warmth };
}

// MARK: Live weather

const REFRESH_MS = 10 * 60_000;
const TIMEOUT_MS = 6_000;
const CACHE_KEY = "demo3d.aarhus.weather";
const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${AARHUS.lat}&longitude=${AARHUS.lon}` +
  "&current=temperature_2m,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day" +
  "&wind_speed_unit=ms";

export interface LiveWeather {
  weather: Weather;
  tempC: number | null;
  /** When it was fetched (ms). */
  at: number;
  /** Words for the readout, e.g. "light rain". */
  label: string;
  /** "Open-Meteo" or "cached" (from the last visit). */
  source: "Open-Meteo" | "cached";
}

const WMO_WORDS: Record<number, string> = {
  0: "clear",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "rime fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  56: "freezing drizzle",
  57: "freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light showers",
  81: "showers",
  82: "heavy showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm, hail",
  99: "thunderstorm, hail",
};

function parse(json: unknown, at: number, source: LiveWeather["source"]): LiveWeather | null {
  const current = (json as { current?: Record<string, unknown> } | null)?.current;
  const weather = weatherFrom(current);
  if (!weather || !current) return null;
  const t = current.temperature_2m;
  const code = current.weather_code as number;
  return {
    weather,
    tempC: typeof t === "number" && Number.isFinite(t) ? t : null,
    at,
    label: WMO_WORDS[code] ?? weather.kind,
    source,
  };
}

/** Aarhus's weather from Open-Meteo, kept fresh every 10 minutes, cached in localStorage; offline keeps the last. */
export class AarhusWeather {
  latest: LiveWeather | null = null;
  /** True once a fetch has failed and nothing newer replaced it. */
  offline = false;
  private onChange: () => void;

  constructor(onChange: () => void) {
    this.onChange = onChange;
    try {
      const raw = storage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { at: number; json: unknown };
        this.latest = parse(c.json, c.at, "cached");
      }
    } catch {
      // No storage, or a bad cache: start without one.
    }
    void this.refresh();
    setInterval(() => void this.refresh(), REFRESH_MS);
  }

  async refresh(): Promise<void> {
    try {
      const res = await fetch(URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const at = Date.now();
      const live = parse(json, at, "Open-Meteo");
      if (!live) throw new Error("no weather");
      this.latest = live;
      this.offline = false;
      try {
        storage.setItem(CACHE_KEY, JSON.stringify({ at, json }));
      } catch {
        // Cache is a nicety.
      }
    } catch {
      this.offline = true;
    }
    this.onChange();
  }

  /** "Aarhus · 7°C · light rain" */
  line(): string {
    const l = this.latest;
    if (!l) return this.offline ? "Aarhus · weather offline" : "Aarhus · fetching weather…";
    const t = l.tempC === null ? "" : ` · ${Math.round(l.tempC)}°C`;
    return `Aarhus${t} · ${l.label}`;
  }

  /** "Open-Meteo · updated 14:05" (or "cached 14:05, offline"). */
  sourceLine(wall: (ms: number) => string): string {
    const l = this.latest;
    if (!l) return "Open-Meteo";
    const when = wall(l.at);
    return this.offline || l.source === "cached"
      ? `Open-Meteo · cached ${when}${this.offline ? " (offline)" : ""}`
      : `Open-Meteo · updated ${when}`;
  }
}
