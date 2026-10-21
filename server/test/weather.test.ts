import { describe, expect, test } from "bun:test";
import { fetchWeather, pinnedWeather } from "../src/weather.ts";

const reply = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe("weather", () => {
  test("reads Open-Meteo's current block", async () => {
    const w = await fetchWeather(
      reply({
        current: {
          weather_code: 61,
          precipitation: 1,
          cloud_cover: 90,
          wind_speed_10m: 6,
          wind_direction_10m: 250,
        },
      }),
    );
    expect(w?.kind).toBe("rain");
    expect(w?.windDir).toBe(250);
  });

  test("failure gives null, so the last good weather stays", async () => {
    expect(await fetchWeather(reply({}, false))).toBeNull();
    expect(await fetchWeather(reply({ current: {} }))).toBeNull();
    expect(
      await fetchWeather((async () => Promise.reject(new Error("down"))) as unknown as typeof fetch),
    ).toBeNull();
  });

  test("SKY_WEATHER pins it", () => {
    expect(pinnedWeather({ SKY_WEATHER: "snow" })?.kind).toBe("snow");
    expect(pinnedWeather({})).toBeNull();
    expect(pinnedWeather({ SKY_WEATHER: "nope" })).toBeNull();
  });
});
