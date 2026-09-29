import { describe, expect, test } from "bun:test";
import { GAMES, parseOptions } from "../../src/games/index.ts";
import { isRefused } from "../../src/games/types.ts";

const T0 = 1_000_000;

describe("every game", () => {
  for (const game of Object.values(GAMES)) {
    const players = Array.from({ length: game.players.max }, (_, i) => i + 1);
    const options = parseOptions(game, {});

    test(`${game.id}: seeded setup is deterministic and JSON-safe`, () => {
      const a = game.setup(players, 42, options, T0);
      expect(game.setup(players, 42, options, T0)).toEqual(a);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    });

    test(`${game.id}: not over at the start; a nonsense move is refused and changes nothing`, () => {
      const s = game.setup(players, 42, options, T0);
      expect(game.outcome(s)).toBeNull();
      const before = JSON.stringify(s);
      expect(isRefused(game.move(s, players[0]!, { nonsense: true }, T0 + 1))).toBe(true);
      expect(JSON.stringify(s)).toBe(before);
    });

    test(`${game.id}: everyone leaving at once still ends it, the last to leave first`, () => {
      let s = game.setup(players, 42, options, T0);
      for (const p of players) s = game.forfeit(s, p, T0 + 1);
      const out = game.outcome(s);
      expect(out && "places" in out ? out.places.flat().sort() : null).toEqual([...players].sort());
      expect(out && "places" in out ? out.places.every((g) => g.length > 0) : false).toBe(true);
    });

    test(`${game.id}: forfeiting down to one player ends it with them first`, () => {
      let s = game.setup(players, 42, options, T0);
      for (const p of players.slice(1)) s = game.forfeit(s, p, T0 + 1);
      const out = game.outcome(s);
      expect(out && "places" in out ? out.places[0] : null).toEqual([players[0]!]);
    });
  }
});
