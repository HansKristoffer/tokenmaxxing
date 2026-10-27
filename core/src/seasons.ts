import { worldWall } from "./range.ts";

export type Season = "spring" | "summer" | "fall" | "winter";

/** Meteorological seasons on the town's Aarhus calendar. */
export function seasonAt(at: number): Season {
  const month = worldWall(at).m;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}
