import {
  clockTime,
  compass,
  lightAt,
  moonPhase,
  sunTimes,
  type WeatherKind,
} from "@tokenmaxxing/core/sky.ts";
import { skyNow, weatherNow } from "../game/sky.ts";
import { useHud } from "../store.ts";
import { useTicker } from "./ui.tsx";

const MOONS = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
const WEATHER_ICON: Record<WeatherKind, string> = {
  clear: "💨",
  cloudy: "☁️",
  fog: "🌫️",
  drizzle: "🌦️",
  rain: "🌧️",
  storm: "⛈️",
  snow: "🌨️",
};

/** World time and weather in the top bar: the next sun event, and the wind. Hover for the detail. */
export function Sky() {
  useHud((s) => s.weather);
  useTicker(30_000);
  const now = skyNow();
  const light = lightAt(now);
  const moon = moonPhase(now);
  const weather = weatherNow();
  const { sunrise, sunset } = sunTimes(now);
  const next =
    now < sunrise
      ? { icon: "🌅", text: `sunrise ${clockTime(sunrise)}` }
      : now < sunset
        ? { icon: "☀️", text: `sunset ${clockTime(sunset)}` }
        : {
            icon: MOONS[Math.round(moon.age * 8) % 8]!,
            text: `sunrise ${clockTime(sunTimes(now + 86_400_000).sunrise)}`,
          };
  const wind = Math.round(weather.windMs);
  const detail = [
    `Aarhus ${clockTime(now)}, ${light.phase}`,
    `Sunrise ${clockTime(sunrise)}, sunset ${clockTime(sunset)}`,
    `Moon: ${moon.name} (${Math.round(moon.lit * 100)}% lit)`,
    `${weather.kind[0]!.toUpperCase()}${weather.kind.slice(1)}, cloud ${Math.round(weather.cloud * 100)}%`,
    `Wind ${weather.windMs} m/s from ${compass(weather.windDir)}`,
  ].join("\n");
  return (
    <span className="chip sky" title={detail} role="img" aria-label={detail.replaceAll("\n", ". ")}>
      <span aria-hidden>{next.icon}</span> {next.text}
      <span className="sep" aria-hidden>
        ·
      </span>
      <span aria-hidden>{WEATHER_ICON[weather.kind]}</span> {wind} m/s
    </span>
  );
}
