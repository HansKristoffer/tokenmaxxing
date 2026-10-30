import {
  type Festive,
  type FestivePin,
  festiveKey,
  festiveWith,
  parseFestivePin,
} from "@tokenmaxxing/core/festive.ts";
import { graphics } from "../settings/graphics.ts";
import { hud } from "../store.ts";
import { skyNow } from "./sky.ts";

/**
 * The festive theme in play (`core/src/festive.ts`): Halloween, Christmas, or none. Every renderer, music and HUD
 * hook asks this, never `near()`, so the pins and the player's setting reach them all:
 *
 *   URL pin (`?theme=christmas&day=12-22`, `?theme=halloween&day=10-31T21:00`, `?theme=off`)
 *   > the player's "Seasonal effects" setting off
 *   > the server's `THEME_PIN` (in the snapshot)
 *   > the clock (`skyNow()`, so `?sky=` moves it too).
 *
 * A pinned time keeps ticking, like `?sky=`. Pins are visual only: shops stay on the real clock. Worked out once
 * a minute (the intensity moves over hours), and at once when the setting or the server's pin changes.
 */

const query = new URLSearchParams(location.search);
const loaded = Date.now();

/** The page URL's pin, if it has a good one: `?theme=` with an optional `&day=`. */
const urlText = ((): string | null => {
  const theme = query.get("theme");
  if (!theme) return null;
  const day = query.get("day");
  return theme === "off" || !day ? theme : `${theme}@${day}`;
})();
const urlPin = urlText === null ? null : parseFestivePin(urlText, loaded);

/** Whether the page URL pins the theme (QA and dev): the toast then shows every load. */
export const festiveUrlPinned = urlPin !== null;

/** Whether the player has seasonal effects on (default). */
export const seasonalOn = (): boolean => graphics.get().overrides.seasonal !== false;

/** A pin moved on by the time since it was made, so a pinned evening goes on into the night. */
const ticking = (pin: FestivePin, since: number): FestivePin =>
  pin && pin !== "off" ? { id: pin.id, ms: pin.ms + (Date.now() - since) } : pin;

let serverText: string | null | undefined;
let serverPin: FestivePin = null;
let serverSince = 0;

let shown: { minute: number; key: string; festive: Festive | null } | null = null;

/** The theme now, or null: the one function the game asks (cached for the minute). */
export function festiveNow(): Festive | null {
  const text = hud.get().festivePin;
  if (text !== serverText) {
    serverText = text;
    serverPin = text ? parseFestivePin(text, Date.now()) : null;
    serverSince = Date.now();
  }
  const on = seasonalOn();
  const at = skyNow();
  const minute = Math.floor(at / 60_000);
  const key = `${on}|${text ?? ""}`;
  if (shown?.minute === minute && shown.key === key) return shown.festive;
  const pin = urlPin ? ticking(urlPin, loaded) : !on ? "off" : ticking(serverPin, serverSince);
  shown = { minute, key, festive: festiveWith(pin, at) };
  return shown.festive;
}

/** The theme's intensity now, 0 when there is none. */
export const intensityNow = (): number => festiveNow()?.intensity ?? 0;

/** `festiveKey` of now, for a bake key (use sparingly: overlays first). */
export const festiveKeyNow = (): string => festiveKey(festiveNow());
