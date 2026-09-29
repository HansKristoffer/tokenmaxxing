/** Every game there is. The lobby, the server and the client all read this list. */
import { dice } from "./dice.ts";
import { hype } from "./hype.ts";
import { spr } from "./spr.ts";
import type { GameDef, GameId, Options } from "./types.ts";

// biome-ignore lint/suspicious/noExplicitAny: each game has its own state and view types
export const GAMES: Partial<Record<GameId, GameDef<any, any>>> = { spr, hype, dice };

export const gameOf = (id: unknown) =>
  typeof id === "string" && id in GAMES ? GAMES[id as GameId] : undefined;

/** The host's options for `game`, each checked against its allowed values; anything else is the default. */
export function parseOptions(game: GameDef, raw: unknown): Options {
  const out: Options = {};
  const given = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  for (const [key, allowed] of Object.entries(game.options ?? {}))
    out[key] = allowed.includes(given[key] as never) ? (given[key] as string | number) : allowed[0]!;
  return out;
}
