import { CALM, CPH, presetWeather, type Weather, weatherFrom } from "@tokenmaxxing/core/sky.ts";

/** One fetch for the whole world: 4 requests an hour. Swap the source here (`fetchWeather`) if needed. */
export const WEATHER_EVERY_MS = 15 * 60_000;
const TIMEOUT_MS = 5_000;

const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${CPH.lat}&longitude=${CPH.lon}` +
  "&current=weather_code,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms";

/** Copenhagen's weather right now from Open-Meteo, or null if it can't be had. */
export async function fetchWeather(fetcher: typeof fetch = fetch): Promise<Weather | null> {
  try {
    const res = await fetcher(URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return weatherFrom(((await res.json()) as { current?: unknown }).current);
  } catch {
    return null;
  }
}

/** `SKY_WEATHER=rain` pins the weather (dev and screenshots); nothing is fetched then. */
export const pinnedWeather = (env: Record<string, string | undefined> = process.env): Weather | null =>
  env.SKY_WEATHER ? presetWeather(env.SKY_WEATHER) : null;

export const initialWeather = (): Weather => pinnedWeather() ?? CALM;
