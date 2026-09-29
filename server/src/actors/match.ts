/**
 * One game being played. It runs the game's rules (core/src/games), keeps its
 * timers, sends each viewer their own view, and tells `arcade` how it ended.
 */
import { gameOf } from "@tokenmaxxing/core/games/index.ts";
import type { Split } from "@tokenmaxxing/core/games/payouts.ts";
import { type GameId, isRefused, type Options, type Outcome } from "@tokenmaxxing/core/games/types.ts";
import type { Frame, MatchInfo, Seat } from "@tokenmaxxing/core/games/wire.ts";
import { actor, UserError } from "rivetkit";
import type { registry } from "./registry.ts";
import {
  authenticate,
  type Caller,
  type ConnParams,
  internal,
  main,
  requireInternal,
  requireUser,
  type TokenCache,
} from "./shared.ts";

interface MatchInput {
  id: number;
  game: GameId;
  players: Seat[];
  stake: number;
  split: Split;
  options: Options;
  seed: number;
}

interface MatchState extends MatchInput {
  startedAt: number;
  betsCloseAt: number;
  state: unknown;
  outcome: Outcome | null;
  /** When each player was last connected; a held game forfeits whoever is gone too long. */
  seen: Record<number, number>;
  /** Side bets, as `arcade` last told us (for the frame). */
  bets: Record<number, number>;
  /** Players who left or lost their connection for too long. */
  forfeited: number[];
  /** `arcade` has settled it (retried until it has). */
  reported?: boolean;
}

/** Gone this long from a game that holds its players, and you forfeit. */
const AWAY_MS = 20_000;
/** A safety net: a held game still running after this is called off and refunded. */
const HELD_LIMIT_MS = 20 * 60_000;
const REPORT_RETRY_MS = 5_000;

const defOf = (s: { game: GameId }) => gameOf(s.game)!;

export const match = actor({
  createState: (_c, input: MatchInput): MatchState => {
    const now = Date.now();
    const def = defOf(input);
    const state = def.setup(
      input.players.map((p) => p.userId),
      input.seed,
      input.options,
      now,
    );
    return {
      ...input,
      startedAt: now,
      betsCloseAt: def.betsCloseAt(state),
      state,
      outcome: null,
      seen: Object.fromEntries(input.players.map((p) => [p.userId, now])),
      bets: {},
      forfeited: [],
    };
  },
  createVars: () => ({ tokens: new Map() as TokenCache }),
  createConnState: (c, params: ConnParams): Promise<Caller> =>
    authenticate(params, c.client(), c.vars.tokens),
  onConnect: (c): void => pushFrames(c),
  onDisconnect: (c): void => pushFrames(c),
  run: async (c): Promise<void> => {
    const def = defOf(c.state);
    while (!c.aborted && !c.state.reported) {
      if (c.state.outcome) {
        await report(c);
        if (!c.state.reported) await Bun.sleep(REPORT_RETRY_MS);
        continue;
      }
      await Bun.sleep(def.tickMs ?? 1000);
      const now = Date.now();
      let next = c.state.state;
      if (def.tick) next = def.tick(next, now);
      if (def.holdPlayers !== false) {
        const here = connectedPlayers(c);
        for (const p of c.state.players) {
          if (here.has(p.userId)) c.state.seen[p.userId] = now;
          else if (
            now - (c.state.seen[p.userId] ?? now) > AWAY_MS &&
            !c.state.forfeited.includes(p.userId) &&
            !def.outcome(next)
          ) {
            c.state.forfeited = [...c.state.forfeited, p.userId];
            next = def.forfeit(next, p.userId, now);
          }
        }
        if (now - c.state.startedAt > HELD_LIMIT_MS && !def.outcome(next)) {
          await finish(c, { void: "The game ran too long and was called off." });
          continue;
        }
      }
      if (next !== c.state.state) await apply(c, next);
    }
  },
  actions: {
    /** Your frame, when opening the game. */
    frame: (c): Frame => frameFor(c.state, viewerOf(c.state, c.conn.state), watchersOf(c)),

    move: async (c, move: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const player = requirePlayer(c.state, userId);
      if (c.state.outcome) throw new UserError("This game is over.", { code: "over" });
      const next = defOf(c.state).move(c.state.state, player, move, Date.now());
      if (isRefused(next)) throw new UserError(next.refused, { code: "refused" });
      await apply(c, next);
    },

    /** Give up: you're placed last, and your stake stays in the pot. */
    forfeit: async (c): Promise<void> => {
      const userId = requireUser(c.conn.state);
      requirePlayer(c.state, userId);
      if (c.state.outcome || c.state.forfeited.includes(userId)) return;
      c.state.forfeited = [...c.state.forfeited, userId];
      await apply(c, defOf(c.state).forfeit(c.state.state, userId, Date.now()));
    },

    // MARK: From `arcade`

    /** Side bets so far, for the frame. */
    bets: (c, bets: Record<number, number>): void => {
      requireInternal(c.conn.state);
      c.state.bets = bets;
      pushFrames(c);
    },

    /** After a player syncs (usage games): pull their tokens in the window. Returns until when to keep syncing fast. */
    usage: async (c, userId: number): Promise<number | null> => {
      requireInternal(c.conn.state);
      const def = defOf(c.state);
      const window = def.usageWindow?.(c.state.state);
      if (!def.usage || !window || c.state.outcome || !c.state.players.some((p) => p.userId === userId))
        return null;
      const used = await c
        .client()
        .player.get([String(userId)], internal)
        .tokensBetween(window.from, window.to);
      await apply(c, def.usage(c.state.state, userId, used, Date.now()));
      return window.until;
    },

    /** The arcade is done with it: the match and its state go. */
    close: (c): void => {
      requireInternal(c.conn.state);
      c.destroy();
    },

    info: (c): MatchInfo => {
      requireInternal(c.conn.state);
      return infoOf(c.state);
    },
  },
});

type MatchCtx = {
  state: MatchState;
  conns: Map<string, { state: unknown; send(name: string, ...args: unknown[]): void }>;
  client(): import("rivetkit/client").Client<typeof registry>;
};

const viewerOf = (s: MatchState, caller: unknown): number | null => {
  const c = caller as Caller;
  return c.kind === "user" && s.players.some((p) => p.userId === c.userId) ? c.userId : null;
};

function requirePlayer(s: MatchState, userId: number): number {
  if (!s.players.some((p) => p.userId === userId))
    throw new UserError("You're watching this game, not playing it.", { code: "not_playing" });
  return userId;
}

function connectedPlayers(c: MatchCtx): Set<number> {
  const out = new Set<number>();
  for (const conn of c.conns.values()) {
    const s = conn.state as Caller;
    if (s.kind === "user") out.add(s.userId);
  }
  return out;
}

function watchersOf(c: MatchCtx): number {
  const players = new Set(c.state.players.map((p) => p.userId));
  let n = 0;
  for (const conn of c.conns.values()) {
    const s = conn.state as Caller;
    if (s.kind === "user" && !players.has(s.userId)) n++;
  }
  return n;
}

const infoOf = (s: MatchState): MatchInfo => ({
  id: s.id,
  game: s.game,
  players: s.players,
  stake: s.stake,
  pot: s.stake * s.players.length,
  split: s.split,
  options: s.options,
  startedAt: s.startedAt,
  betsCloseAt: s.betsCloseAt,
  bets: s.bets,
  outcome: s.outcome,
});

const frameFor = (s: MatchState, you: number | null, watchers: number): Frame => ({
  info: infoOf(s),
  you,
  view: defOf(s).view(s.state, you, Date.now()),
  now: Date.now(),
  watchers,
});

/** Everyone connected gets their own view: players see their secrets, watchers don't. */
function pushFrames(c: MatchCtx): void {
  const watchers = watchersOf(c);
  for (const conn of c.conns.values()) {
    if ((conn.state as Caller).kind !== "user") continue;
    conn.send("frame", frameFor(c.state, viewerOf(c.state, conn.state), watchers));
  }
}

async function apply(c: MatchCtx, next: unknown): Promise<void> {
  const def = defOf(c.state);
  const before = c.state.state;
  c.state.state = next;
  const callouts = def.callouts?.(before, next) ?? [];
  const world = main(c.client()).world;
  for (const line of callouts) await world.callout(c.state.id, line.player, line.text).catch(() => {});
  pushFrames(c);
  await reportStatus(c);
  const out = def.outcome(next);
  if (out) await finish(c, out);
}

/** The live status over each player's head in the world, and the arena's scoreboard. */
async function reportStatus(c: MatchCtx): Promise<void> {
  const def = defOf(c.state);
  const now = Date.now();
  const status = Object.fromEntries(
    c.state.players.map((p) => [p.userId, def.status?.(c.state.state, p.userId, now) ?? null]),
  );
  await main(c.client())
    .world.gameStatus(c.state.id, {
      status,
      board: def.board?.(c.state.state, now) ?? null,
      watchers: watchersOf(c),
      headline: def.headline?.(c.state.state, now) ?? null,
      endsAt: def.endsAt?.(c.state.state) ?? null,
    })
    .catch(() => {});
}

async function finish(c: MatchCtx, outcome: Outcome): Promise<void> {
  if (c.state.outcome) return;
  c.state.outcome = outcome;
  pushFrames(c);
  await report(c);
}

/** Tells `arcade` how it ended, so it pays out. The run loop retries until it has. */
async function report(c: MatchCtx): Promise<void> {
  if (!c.state.outcome || c.state.reported) return;
  try {
    await main(c.client()).arcade.finished(c.state.id, c.state.outcome);
    c.state.reported = true;
  } catch (err) {
    console.warn(`[match ${c.state.id}] reporting the outcome: ${String(err)}`);
  }
}
