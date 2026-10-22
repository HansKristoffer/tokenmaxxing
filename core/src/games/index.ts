/** Every game there is. The lobby, the server and the client all read this list. */
import { isOneOf, isRecord } from "hanzio";
import { dice } from "./dice.ts";
import { hype } from "./hype.ts";
import { spr } from "./spr.ts";
import { sprint } from "./sprint.ts";
import { tokenmaxxing } from "./tokenmaxxing.ts";
import type { GameDef, GameId, Options } from "./types.ts";

// biome-ignore lint/suspicious/noExplicitAny: each game has its own state and view types
export const GAMES: Partial<Record<GameId, GameDef<any, any>>> = { spr, hype, dice, sprint, tokenmaxxing };

export const gameOf = (id: unknown) =>
  typeof id === "string" && id in GAMES ? GAMES[id as GameId] : undefined;

/** The host's options for `game`, each checked against its allowed values; anything else is the default. */
export function parseOptions(game: GameDef, raw: unknown): Options {
  const out: Options = {};
  const given: Record<string, unknown> = isRecord(raw) ? raw : {};
  for (const [key, allowed] of Object.entries(game.options ?? {})) {
    const value = given[key];
    out[key] = isOneOf(allowed, value) ? value : allowed[0]!;
  }
  return out;
}
