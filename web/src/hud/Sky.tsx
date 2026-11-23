import {
  clockTime,
  compass,
  fogOf,
  iceOver,
  lightAt,
  moonPhase,
  pollenLevel,
  sunTimes,
  type WeatherKind,
} from "@tokenmaxxing/core/sky.ts";
import { seasonNow } from "../game/seasons.ts";
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

/** How far you can see, in words: metres up close, kilometres beyond. */
const distance = (m: number) => (m < 1_000 ? `${Math.round(m / 50) * 50} m` : `${Math.round(m / 1_000)} km`);

/**
 * The chip's next sun event: sunrise before dawn, sunset before dusk, and after dark the moon's phase with
 * tomorrow's sunrise.
 */
function nextSunEvent(now: number, sunrise: number, sunset: number, moonAge: number) {
  if (now < sunrise) return { icon: "🌅", text: `sunrise ${clockTime(sunrise)}` };
  if (now < sunset) return { icon: "☀️", text: `sunset ${clockTime(sunset)}` };
  return {
    icon: MOONS[Math.round(moonAge * 8) % 8]!,
    text: `sunrise ${clockTime(sunTimes(now + 86_400_000).sunrise)}`,
  };
}

/** World time and weather in the top bar: the next sun event, the temperature and the wind. Hover for the detail. */
export function Sky() {
  // Subscribing here redraws the chip when the weather changes.
  useHud((s) => s.weather);
  useTicker(30_000);
  const now = skyNow();
  const light = lightAt(now);
  const moon = moonPhase(now);
  const weather = weatherNow();
  const { sunrise, sunset } = sunTimes(now);
  const next = nextSunEvent(now, sunrise, sunset, moon.age);

  const wind = Math.round(weather.windMs);
  const temp = Math.round(weather.tempC);
  const pollen = pollenLevel(weather.pollen);
  const kindName = `${weather.kind.charAt(0).toUpperCase()}${weather.kind.slice(1)}`;
  const misty = fogOf(weather) > 0.05 && weather.kind !== "fog";
  const pollenLine = pollen === "none" ? [] : [`Pollen: ${pollen}${pollen === "high" ? " (achoo)" : ""}`];

  const detail = [
    `Season: ${seasonNow()}`,
    `Aarhus ${clockTime(now)}, ${light.phase}`,
    `Sunrise ${clockTime(sunrise)}, sunset ${clockTime(sunset)}`,
    `Moon: ${moon.name} (${Math.round(moon.lit * 100)}% lit)`,
    `${kindName}, cloud ${Math.round(weather.cloud * 100)}%`,
    `${temp} °C${iceOver(weather) ? ", the pond is frozen" : ""}`,
    `Wind ${weather.windMs} m/s from ${compass(weather.windDir)}`,
    `Visibility ${distance(weather.visibilityM)}${misty ? ", misty" : ""}`,
    ...pollenLine,
  ].join("\n");
  return (
    <span className="chip sky" title={detail} role="img" aria-label={detail.replaceAll("\n", ". ")}>
      <span aria-hidden>{next.icon}</span> {next.text}
      <span className="sep" aria-hidden>
        ·
      </span>
      <span aria-hidden>{WEATHER_ICON[weather.kind]}</span> {temp}° · {wind} m/s
    </span>
  );
}
