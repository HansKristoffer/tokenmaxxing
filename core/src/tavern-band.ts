import { worldWall } from "./range.ts";

export const BAND_START = 16;
export const BAND_NAME = "The Bit & Barrel";
/** The stage's tiles in the Tavern plan; its front faces east. */
export const MUSICIANS = [
  { x: 1, y: 10, instrument: "lute" },
  { x: 1, y: 12, instrument: "flute" },
] as const;
export type TavernSet = "hearth-jig" | "lantern-reel";

/** Every evening, 16:00 until midnight, on the town's Copenhagen clock. */
export function tavernSet(at: number): TavernSet | null {
  const { hour, minute } = worldWall(at);
  if (hour < BAND_START) return null;

  // The two sets take turns every five minutes from 16:00, so the band is never still for long.
  const minutesIntoEvening = (hour - BAND_START) * 60 + minute;
  const fiveMinuteSlot = Math.floor(minutesIntoEvening / 5);
  return fiveMinuteSlot % 2 === 0 ? "hearth-jig" : "lantern-reel";
}
