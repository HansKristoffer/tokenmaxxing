/**
 * One game being played. It runs the game's rules (core/src/games), keeps its
 * timers, sends each viewer their own view, and tells `arcade` it moved on and how it ended.
 */
import { gameOf, publicStatus } from "@tokenmaxxing/core/games/index.ts";
import type { Split } from "@tokenmaxxing/core/games/payouts.ts";
import { type GameId, isRefused, type Options, type Outcome } from "@tokenmaxxing/core/games/types.ts";
import type { Frame, MatchChatLine, MatchInfo, Seat } from "@tokenmaxxing/core/games/wire.ts";
import type { Battle } from "@tokenmaxxing/core/protocol.ts";
import { CHAT_HISTORY } from "@tokenmaxxing/core/world.ts";
import { actor, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import { RateLimiter } from "../rate-limit.ts";
import { parseChatText } from "../validate.ts";
import { KEPT_TABLE, Kept, saveAfterActions } from "./kept.ts";
import type { registry } from "./registry.ts";
import {
  authenticate,
  background,
  type Caller,
  type Callers,
  type ConnParams,
  callerOf,
  fromInside,
  internal,
  main,
  requireInternal,
  requireUser,
  waitForTick,
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
  /** The match's own chat, newest last (missing on matches from before it had one). */
  chat?: MatchChatLine[];
}

/** Gone this long from a game that holds its players, and you forfeit. */
const AWAY_MS = 20_000;
/** A safety net: a held game still running after this is called off and refunded. */
const HELD_LIMIT_MS = 20 * 60_000;
const REPORT_RETRY_MS = 5_000;
const CHAT_PER_MIN = 20;

const defOf = (s: { game: GameId }) => gameOf(s.game)!;

export const match = actor({
  db: db({ onMigrate: (d) => d.execute(KEPT_TABLE).then(() => {}) }),
  onCreate: async (c, raw: MatchInput & { internal: string }) => {
    const input = fromInside<MatchInput>(raw);
    const now = Date.now();
    const def = defOf(input);
    const state = def.setup(
      input.players.map((p) => p.userId),
      input.seed,
      input.options,
      now,
    );
    const first: MatchState = {
      ...input,
      startedAt: now,
      betsCloseAt: def.betsCloseAt(state),
      state,
      outcome: null,
      seen: Object.fromEntries(input.players.map((p) => [p.userId, now])),
      bets: {},
      forfeited: [],
    };
    await Kept.create(c.db, first);
  },
  createVars: async (c) => {
    const kept = await Kept.load<MatchState>(c.db);
    return {
      /** The game and how it stands: saved after every action and every turn of the loop. */
      state: kept.value,
      kept,
      callers: new Map() as Callers,
      loop: null as Promise<void> | null,
      chat: new RateLimiter(CHAT_PER_MIN, 60_000),
    };
  },
  // Only a person watching changes what the frames show (the watcher count). Other actors' calls,
  // like each app's battle poll, connect too.
  onConnect: async (c, conn) => {
    const caller = await authenticate(conn.params as ConnParams | undefined, c.client());
    c.vars.callers.set(conn.id, caller);
    if (caller.kind === "user") pushFrames(c);
  },
  onDisconnect: (c, conn) => {
    const caller = c.vars.callers.get(conn.id);
    c.vars.callers.delete(conn.id);
    if (caller?.kind === "user") pushFrames(c);
  },
  onWake: (c) => {
    const signal = c.abortSignal;
    c.vars.loop = background(`match ${c.vars.state.id}`, async () => {
      while (!signal.aborted && !c.vars.state.reported) {
        const on = await turn(c, signal);
        await c.vars.kept.save();
        if (!on) return;
      }
    });
  },
  onSleep: async (c) => {
    await c.vars.loop;
    await c.vars.kept.save();
  },
  actions: {
    /** Your frame, when opening the game. */
    frame: (c): Frame => {
      const s = plain(c.vars.state);
      return frameFor(s, viewerOf(s, callerOf(c)), watchersOf(c, s));
    },

    move: async (c, move: unknown): Promise<void> => {
      const userId = requireUser(callerOf(c));
      const s = plain(c.vars.state);
      const player = requirePlayer(s, userId);
      if (s.outcome) throw new UserError("This game is over.", { code: "over" });
      const next = defOf(s).move(s.state, player, move, Date.now());
      if (isRefused(next)) throw new UserError(next.refused, { code: "refused" });
      if (next !== s.state) await apply(c, next, s.state);
    },

    /** Give up: you're placed last, and your stake stays in the pot. */
    forfeit: async (c): Promise<void> => {
      const userId = requireUser(callerOf(c));
      const s = plain(c.vars.state);
      requirePlayer(s, userId);
      if (s.outcome || s.forfeited.includes(userId)) return;
      c.vars.state.forfeited = [...s.forfeited, userId];
      await apply(c, defOf(s).forfeit(s.state, userId, Date.now()), s.state);
    },

    /** The match's chat so far, when opening the game. */
    chat: (c): MatchChatLine[] => {
      requireUser(callerOf(c));
      return c.vars.state.chat ?? [];
    },

    /** A line in the match's chat: its players and everyone watching see it. */
    say: async (c, rawText: unknown): Promise<void> => {
      const userId = requireUser(callerOf(c));
      const text = parseChatText(rawText);
      if (!text) return;
      if (!c.vars.chat.take(String(userId), Date.now()))
        throw new UserError("Slow down a little.", { code: "rate_limited" });
      const name =
        c.vars.state.players.find((p) => p.userId === userId)?.name ??
        (await main(c.client()).town.names([userId]))[userId] ??
        "?";
      const chat = c.vars.state.chat ?? [];
      const line: MatchChatLine = { id: (chat.at(-1)?.id ?? 0) + 1, userId, name, text, at: Date.now() };
      c.vars.state.chat = [...chat, line].slice(-CHAT_HISTORY);
      for (const [id, caller] of c.vars.callers)
        if (caller.kind === "user") c.conns.get(id)?.send("chat", line);
    },

    // MARK: From `arcade`

    /** Side bets so far, for the frame. */
    bets: (c, bets: Record<number, number>): void => {
      requireInternal(callerOf(c));
      c.vars.state.bets = bets;
      pushFrames(c);
    },

    /** After a player syncs (usage games): pull their tokens in the window. Returns until when to keep syncing fast. */
    usage: async (c, userId: number): Promise<Battle | null> => {
      requireInternal(callerOf(c));
      const s = plain(c.vars.state);
      const def = defOf(s);
      const window = def.usageWindow?.(s.state);
      if (!window || !def.usage || !standing(s, userId)) return null;
      const used = await c
        .client()
        .player.get([String(userId)], internal)
        .tokensBetween(window.from, window.to);
      // Another sync or tick may have updated the match while the player query was running.
      const current = plain(c.vars.state);
      if (!standing(current, userId)) return null;
      const next = def.usage(current.state, userId, used, Date.now());
      if (next !== current.state) await apply(c, next, current.state);
      return standing(plain(c.vars.state), userId);
    },

    /**
     * Where a player stands, from the last pull. For the app's poll: each sync already pulls (`usage`),
     * so this reads nothing, and a slow player database can't pile polls up here.
     */
    standing: (c, userId: number): Battle | null => {
      requireInternal(callerOf(c));
      return standing(plain(c.vars.state), userId);
    },

    /** The arcade is done with it: the match and its state go. */
    close: (c): void => {
      requireInternal(callerOf(c));
      c.destroy();
    },

    info: (c): MatchInfo => {
      requireInternal(callerOf(c));
      return infoOf(plain(c.vars.state));
    },
  },
});

saveAfterActions(match);

type MatchCtx = {
  vars: { state: MatchState; callers: Callers };
  conns: Map<string, { send(name: string, ...args: unknown[]): void }>;
  client(): import("rivetkit/client").Client<typeof registry>;
  keepAwake<T>(promise: Promise<T>): Promise<T>;
};

/**
 * One turn of the match's loop: the rules' own clock, who has been gone too long, and telling `arcade`
 * how it ended until it has heard. False when the actor is going to sleep.
 */
async function turn(c: MatchCtx, signal: AbortSignal): Promise<boolean> {
  const def = defOf(c.vars.state);
  // Look every turn, not only after a change: a restart between saving the final state and
  // finishing left a game over but never paid out, as nothing changed after it.
  const ended = c.vars.state.outcome ? null : def.outcome(plainState(c.vars.state));
  if (ended) {
    await c.keepAwake(finish(c, ended));
    return true;
  }
  if (c.vars.state.outcome) {
    await c.keepAwake(report(c));
    if (signal.aborted) return false;
    return c.vars.state.reported || (await waitForTick(signal, REPORT_RETRY_MS));
  }
  if (!(await waitForTick(signal, def.tickMs ?? 1000))) return false;
  const now = Date.now();
  const current = plain(c.vars.state);
  let next = current.state;
  if (def.tick) next = def.tick(next, now);
  if (def.holdPlayers !== false) {
    const here = connectedPlayers(c);
    for (const p of current.players) {
      if (here.has(p.userId)) c.vars.state.seen[p.userId] = now;
      else if (
        now - (c.vars.state.seen[p.userId] ?? now) > AWAY_MS &&
        !c.vars.state.forfeited.includes(p.userId) &&
        !def.outcome(next)
      ) {
        c.vars.state.forfeited = [...c.vars.state.forfeited, p.userId];
        next = def.forfeit(next, p.userId, now);
      }
    }
    if (now - c.vars.state.startedAt > HELD_LIMIT_MS && !def.outcome(next)) {
      await c.keepAwake(finish(c, { void: "The game ran too long and was called off." }));
      return true;
    }
  }
  if (next !== current.state) await c.keepAwake(apply(c, next, current.state));
  return true;
}

function standing(s: MatchState, userId: number): Battle | null {
  const def = defOf(s);
  const window = def.usageWindow?.(s.state);
  if (!def.usage || !window || s.outcome || !s.players.some((p) => p.userId === userId)) return null;
  const board = def.board?.(s.state, Date.now()) ?? [];
  const place = board.findIndex((r) => r.player === userId);
  return {
    name: def.name,
    place: place < 0 || !board[place]!.value ? null : place + 1,
    players: s.players.length,
    tokens: board[place]?.value ?? 0,
    endsAt: window.to,
    until: window.until,
  };
}

const viewerOf = (s: MatchState, c: Caller): number | null =>
  c.kind === "user" && s.players.some((p) => p.userId === c.userId) ? c.userId : null;

function requirePlayer(s: MatchState, userId: number): number {
  if (!s.players.some((p) => p.userId === userId))
    throw new UserError("You're watching this game, not playing it.", { code: "not_playing" });
  return userId;
}

function connectedPlayers(c: MatchCtx): Set<number> {
  const out = new Set<number>();
  for (const caller of c.vars.callers.values()) if (caller.kind === "user") out.add(caller.userId);
  return out;
}

function watchersOf(c: MatchCtx, s: MatchState): number {
  const players = new Set(s.players.map((p) => p.userId));
  let n = 0;
  for (const caller of c.vars.callers.values())
    if (caller.kind === "user" && !players.has(caller.userId)) n++;
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
function pushFrames(c: MatchCtx, copy?: MatchState): void {
  const viewers = [...c.vars.callers].filter(([, caller]) => caller.kind === "user");
  if (!viewers.length) return;
  const s = copy ?? plain(c.vars.state);
  const watchers = watchersOf(c, s);
  for (const [id, caller] of viewers)
    c.conns.get(id)?.send("frame", frameFor(s, viewerOf(s, caller), watchers));
}

/**
 * Game rules and views read a copy, so nothing they do to it (a sort in place, say) reaches what the
 * match keeps: only `apply` and the loop write that. A no-op compares against its own copy.
 */
const plain = (s: MatchState): MatchState => {
  // Nothing that reads it needs the chat, which is most of it.
  const { chat: _, ...rest } = s;
  return JSON.parse(JSON.stringify(rest));
};

/** Just the game's state, copied as `plain` copies it. */
const plainState = (s: MatchState): unknown => JSON.parse(JSON.stringify(s.state));

/** `before`: the copy `next` came from. */
async function apply(c: MatchCtx, next: unknown, before: unknown): Promise<void> {
  const def = defOf(c.vars.state);
  c.vars.state.state = next;
  const callouts = def.callouts?.(before, next) ?? [];
  const { world, arcade } = main(c.client());
  for (const line of callouts) await world.callout(c.vars.state.id, line.player, line.text).catch(() => {});
  // One copy for the frames and the world.
  const s = plain(c.vars.state);
  pushFrames(c, s);
  await reportStatus(c, s);
  // `arcade` calls off a held game that stops moving on.
  if (def.holdPlayers !== false) await arcade.moved(c.vars.state.id).catch(() => {});
  const out = def.outcome(next);
  if (out) await finish(c, out);
}

/** The live status over each player's head in the world, and the arena's scoreboard. */
async function reportStatus(c: MatchCtx, s: MatchState): Promise<void> {
  const def = defOf(s);
  const update = publicStatus(
    def,
    s.state,
    s.players.map((p) => p.userId),
    watchersOf(c, s),
    Date.now(),
  );
  await main(c.client())
    .world.gameStatus(s.id, update)
    .catch(() => {});
}

async function finish(c: MatchCtx, outcome: Outcome): Promise<void> {
  if (c.vars.state.outcome) return;
  c.vars.state.outcome = outcome;
  pushFrames(c);
  await report(c);
}

/** Tells `arcade` how it ended, so it pays out. The run loop retries until it has. */
async function report(c: MatchCtx): Promise<void> {
  if (!c.vars.state.outcome || c.vars.state.reported) return;
  try {
    const s = plain(c.vars.state);
    await main(c.client()).arcade.finished(s.id, s.outcome!);
    c.vars.state.reported = true;
  } catch (err) {
    console.warn(`[match ${c.vars.state.id}] reporting the outcome: ${String(err)}`);
  }
}
