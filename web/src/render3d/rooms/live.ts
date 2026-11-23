import { GAMES } from "@tokenmaxxing/core/games/index.ts";
import { LEFT_PLATES, plaqueOf, plateText, REGULARS_TOP, tabLine } from "@tokenmaxxing/core/regulars.ts";
import { isLanParty, specialOn } from "@tokenmaxxing/core/tavern.ts";
import { roundName } from "@tokenmaxxing/core/tournament.ts";
import { TUNES } from "@tokenmaxxing/core/tunes.ts";
import type { WorldGame } from "@tokenmaxxing/core/world.ts";
import { clockFaces } from "../../game/clocks.ts";
import { left } from "../../game/raid.ts";
import { askRegulars, regularsBoard } from "../../game/regulars.ts";
import { skyNow } from "../../game/sky.ts";
import { world } from "../../game/world.ts";
import { refreshTournament, town } from "../../net.ts";
import { hud } from "../../store.ts";
import { setLanParty } from "../kit/livescreen.ts";
import type { BasementScene, BoardPairing, MatchRow, ScreenFeed } from "./basement3d.ts";
import {
  type ClocksModel,
  type ClocksShown,
  setBarTab,
  setOfficeBoard,
  setPlaque,
  setSpecial,
  type TavernRoom,
} from "./tavern3d.ts";

/**
 * The real game's data on the rooms' boards: the Tavern's bar tab, plaques, easel and jukebox, and the
 * basement's livestream screen, tournament board and wall terminals. Each returns a function to call every
 * frame; it repaints a board only when what it shows has changed (a repaint is a canvas upload).
 */

/** A board that repaints when its value changes. */
function watch<T>(paint: (v: T) => void): (v: T) => void {
  let last: string | null = null;
  return (v) => {
    const key = JSON.stringify(v);
    if (key === last) return;
    last = key;
    paint(v);
  };
}

const OFFICES_EVERY_MS = 30_000;
let openOffices: string[] | null = null;
let officesAt = -Infinity;

/**
 * The names of the offices left open, asked for again every half minute (the server keeps its own for a while too).
 * A failed request keeps the last list, so the board does not blank out on a dropped connection.
 */
function officesOpen(now: number): string[] | null {
  if (now - officesAt > OFFICES_EVERY_MS) {
    officesAt = now;
    town.openOffices().then(
      (rows) => {
        openOffices = rows.map((r) => r.name);
      },
      () => {},
    );
  }
  return openOffices;
}

/**
 * The Tavern: this week's regulars on the bar tab and the plaques, the day's special on the easel, the world clocks,
 * and the jukebox on or off.
 */
export function liveTavern(inn: TavernRoom): (t: number) => void {
  const tab = inn.by.get("tile:J")?.[0];
  const plaques = [inn.by.get("tile:P")?.[0], inn.by.get("tavern:plaque-2")?.[0]];
  const easel = inn.by.get("tile:K")?.[0];
  const paintBoard = watch<{
    rows: { rank: number; name: string; minutes: number }[];
    last: number | null;
    ids: number[];
  }>(({ rows, last, ids }) => {
    if (tab) {
      setBarTab(
        tab,
        rows.map((r) => tabLine(r)),
        ids.indexOf(last ?? -1),
      );
    }

    for (const [i, plaque] of plaques.entries()) {
      if (!plaque) continue;
      const first = i === 0 ? 1 : LEFT_PLATES + 1;
      const lastRank = i === 0 ? LEFT_PLATES : REGULARS_TOP;
      const names: string[] = [];
      for (let rank = first; rank <= lastRank; rank++) {
        const row = rows.find((q) => q.rank === rank && plaqueOf(q.rank) === i);
        names.push(row ? plateText(row) : "");
      }
      setPlaque(plaque, names);
    }
  });
  const paintSpecial = watch<string>((s) => {
    if (easel) setSpecial(easel, s);
  });
  const officeBoard = inn.by.get("tile:w")?.[0];
  const paintOffices = watch<string[] | null>((names) => {
    if (officeBoard) setOfficeBoard(officeBoard, names);
  });
  const clocks = inn.by.get("tile:◷")?.[0] as ClocksModel | undefined;
  const paintClocks = watch<ClocksShown>((s) => clocks?.show(s));
  return () => {
    askRegulars();

    const { rows, last } = regularsBoard();
    paintBoard({ rows: [...rows], last, ids: rows.map((r) => r.userId) });
    paintSpecial(specialOn(new Date()));
    paintOffices(officesOpen(Date.now()));

    const { hands, lit } = clockFaces();
    paintClocks({ hands, lit });

    const playing = hud.get().jukebox;
    inn.jukebox.playing = playing !== null;
    if (playing) {
      const tune = TUNES.find((t) => t.id === playing.track);
      inn.jukebox.track = tune?.name ?? playing.track;
    }
  };
}

/** The matches the big screen lists, oldest first (as the 2D screen does). */
const FEED_ROWS = 3;
const feedOf = (games: Iterable<WorldGame>): WorldGame[] =>
  [...games].sort((a, b) => a.id - b.id).slice(0, FEED_ROWS);

const nameOf = (id: number): string => {
  const lobbyPlayer = hud
    .get()
    .lobby?.matches.flatMap((m) => m.players)
    .find((p) => p.userId === id);
  return lobbyPlayer?.name ?? world.avatars.get(id)?.info.name ?? "?";
};

function matchRow(game: WorldGame): MatchRow {
  const def = GAMES[game.game]!;
  const endsInMin = game.endsAt ? Math.max(0, Math.ceil((game.endsAt - Date.now()) / 60_000)) : null;

  return {
    emoji: def.emoji,
    name: def.name,
    headline: game.headline,
    players: game.players.map(nameOf),
    watchers: game.watchers,
    endsInMin,
  };
}

/**
 * The basement: the livestream screen (or the running bracket), the tournament board, the terminals and the LAN
 * party.
 */
export function liveBasement(b: BasementScene): (t: number) => void {
  const showScreen = watch<ScreenFeed>((f) => b.screen.show(f));
  const showBoard = watch<Parameters<typeof b.board.show>[0]>((v) => b.board.show(v));
  const showTop = watch<{ tokens: number }[]>((rows) => b.terminals[0].show(rows));
  const showRaid = watch<number | null>((share) => b.terminals[1].show(share));
  return () => {
    setLanParty(isLanParty(skyNow()));
    void refreshTournament();

    const tournament = hud.get().tournament;
    const running =
      tournament?.current?.status === "running" && tournament.current.bracket ? tournament.current : null;
    if (running) {
      const rounds = running.bracket!;

      // The first round with an open match; findIndex gives -1 when none is open, and the first round stays up.
      const shownRound = Math.max(
        0,
        rounds.findIndex((round) => round.some((m) => m.winner === null)),
      );
      const playerName = (id: number | null) =>
        id === null ? null : (running.players.find((p) => p.id === id)?.name ?? "?");
      const side = (m: { a: number | null; b: number | null; winner: number | null }): "a" | "b" | null => {
        if (m.winner === null) return null;
        return m.winner === m.a ? "a" : "b";
      };

      const openMatches = rounds[shownRound]!.filter((m) => m.a !== null || m.b !== null)
        .slice(0, FEED_ROWS)
        .map((m) => ({ a: playerName(m.a), b: playerName(m.b), winner: side(m) }));
      showScreen({
        matches: [],
        bracket: {
          game: GAMES[running.game]!.name,
          round: roundName(rounds.length, shownRound),
          matches: openMatches,
        },
      });
      showBoard({
        rounds: rounds.map((round): BoardPairing[] =>
          round.map((m) => ({ a: playerName(m.a), b: playerName(m.b), winner: side(m) })),
        ),
        champion: tournament?.champion?.name ?? null,
      });
    } else {
      showScreen({ matches: feedOf(world.games.values()).map(matchRow), total: world.games.size });
      const champion = tournament?.champion;
      showBoard(champion ? { rounds: null, champion: champion.name } : { rounds: null });
    }

    const topTokens = hud
      .get()
      .board.filter((r) => r.tokens > 0)
      .slice(0, 3)
      .map((r) => ({ tokens: r.tokens }));
    showTop(topTokens);

    const raid = hud.get().raid;
    const raidIsUp = raid && !raid.prelaunch && !raid.closed && raid.hp > 0;
    showRaid(raidIsUp ? left(raid) / raid.hp : null);
  };
}
