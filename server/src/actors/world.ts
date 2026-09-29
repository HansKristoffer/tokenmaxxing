import {
  CHAT_HISTORY,
  type ChatLine,
  type CompanyInfo,
  companyOfRoom,
  DIRS,
  type Houses,
  homeRoom,
  IDLE_MS,
  isFacing,
  type Moves,
  mapOf,
  mentionsIn,
  type Place,
  type PlayerInfo,
  type PlayerPos,
  type PlayerState,
  type PlayerView,
  portal,
  type RoomId,
  restSpot,
  type Snapshot,
  type StepResult,
  stepTarget,
  TICK_MS,
  takeStep,
  townSpawn,
  WORKING_MS,
} from "@tokenmaxxing/core/world.ts";
import { actor, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import { RateLimiter } from "../rate-limit.ts";
import { parseChatText } from "../validate.ts";
import type { registry } from "./registry.ts";
import {
  all,
  authenticate,
  type Caller,
  type ConnParams,
  forgetUser,
  internal,
  requireInternal,
  requireUser,
  type Sql,
  type TokenCache,
} from "./shared.ts";
import type { PlayerCore } from "./town.ts";

interface WorldPlayer extends PlayerCore, Place {
  state: PlayerState;
  lastInputAt: number;
  lastAgentAt: number;
  liveAgents: number;
  /** Where they were when sent to bed or desk, so they come back there. */
  back?: (Place & { state: "idle" | "sit" }) | null;
}

interface WorldState {
  seeded: boolean;
  players: Record<string, WorldPlayer>;
  companies: Record<string, CompanyInfo>;
}

type ConnState = Caller & { joined?: boolean };

const CHAT_KEEP = 200;
const REST_CHECK_EVERY = 10; // ticks

const view = (p: WorldPlayer, online: boolean): PlayerView => ({
  id: p.id,
  name: p.name,
  look: p.look,
  level: p.level,
  companyId: p.companyId,
  todayTokens: p.todayTokens,
  liveAgents: p.liveAgents,
  online,
  x: p.x,
  y: p.y,
  facing: p.facing,
  state: p.state,
});

const info = (p: WorldPlayer, online: boolean): PlayerInfo => {
  const { x: _x, y: _y, facing: _f, state: _s, ...rest } = view(p, online);
  return rest;
};

const pos = (p: WorldPlayer): PlayerPos => [p.id, p.x, p.y, p.facing, p.state];

export const world = actor({
  createConnState: (c, params: ConnParams): Promise<ConnState> =>
    authenticate(
      params,
      (userId, secret) =>
        c
          .client<typeof registry>()
          .player.get([String(userId)], internal)
          .verify(secret),
      c.vars.tokens,
    ),
  state: { seeded: false, players: {}, companies: {} } as WorldState,
  createVars: () => ({
    /** Open game connections per player. */
    online: new Map<number, number>(),
    /** Players that moved or changed room since the last tick. */
    dirty: new Set<number>(),
    /** The room each player was last announced in. */
    announced: new Map<number, RoomId>(),
    steps: new Map<number, { budget: number; at: number }>(),
    chat: new RateLimiter(20, 60_000),
    occupancy: "",
    /** The last `houses` sent to town, as JSON. */
    houses: "",
    tokens: new Map() as TokenCache,
  }),
  db: db({
    onMigrate: async (d) => {
      await d.execute(`CREATE TABLE IF NOT EXISTS chat (
        id INTEGER PRIMARY KEY, room TEXT NOT NULL, user_id INTEGER NOT NULL,
        name TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)`);
      await d.execute("CREATE INDEX IF NOT EXISTS chat_room ON chat (room, id)");
    },
  }),
  onWake: async (c) => {
    // First start (or a wiped world): load everyone from `town` and put them to bed.
    if (c.state.seeded) return;
    const seed = await c.client<typeof registry>().town.getOrCreate(["main"], internal).seed();
    for (const co of seed.companies) c.state.companies[co.id] = co;
    for (const p of seed.players) upsert(c.state, p, Date.now());
    c.state.seeded = true;
  },
  onDisconnect: (c, conn) => {
    const s = conn.state as ConnState;
    if (s.kind !== "user" || !s.joined) return;
    const left = (c.vars.online.get(s.userId) ?? 1) - 1;
    if (left > 0) return void c.vars.online.set(s.userId, left);
    c.vars.online.delete(s.userId);
    const p = c.state.players[s.userId];
    if (!p) return;
    rest(c.state, p, Date.now() - p.lastAgentAt < WORKING_MS ? "working" : "away");
    c.vars.dirty.add(p.id);
    c.broadcast("info", info(p, false));
  },
  run: async (c) => {
    let n = 0;
    while (!c.aborted) {
      await Bun.sleep(TICK_MS);
      if (++n % REST_CHECK_EVERY === 0) settle(c.state, c.vars, Date.now());
      flush(c);
    }
  },
  actions: {
    /** Called once per game connection: wakes you up and returns your room. */
    join: async (c): Promise<Snapshot> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p) throw new UserError("Unknown player.", { code: "not_found" });
      (c.conn.state as ConnState).joined = true;
      c.vars.online.set(userId, (c.vars.online.get(userId) ?? 0) + 1);
      p.lastInputAt = Date.now();
      if (wake(c.state, p)) c.vars.dirty.add(p.id);
      c.broadcast("info", info(p, true));
      return snapshot(c.state, c.vars.online, p, chatOf(c.db, p.room));
    },

    step: (c, rawDir: unknown): StepResult => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p || !isFacing(rawDir)) return null;
      const now = Date.now();
      p.lastInputAt = now;
      // Back from being away: the first key press returns them to where they were.
      if (wake(c.state, p)) {
        c.vars.dirty.add(p.id);
        return correction(p);
      }
      const s = c.vars.steps.get(userId) ?? { budget: 4, at: 0 };
      const budget = takeStep(s.budget, s.at, now);
      if (budget === null) return correction(p);
      c.vars.steps.set(userId, { budget, at: now });

      const wasSeated = p.state !== "idle";
      p.facing = rawDir;
      p.state = "idle";
      c.vars.dirty.add(p.id);
      const target = stepTarget(mapOf(p.room), p.x, p.y, rawDir);
      if (target.kind === "move") {
        p.x = target.x;
        p.y = target.y;
        return null;
      }
      if (target.kind === "blocked") return wasSeated ? correction(p) : null;
      const dest = portal(p.room, target.ch, p.companyId, plots(c.state));
      if ("notice" in dest) return { notice: dest.notice };
      Object.assign(p, dest);
      return correction(p);
    },

    /** Space while facing a free seat: sits you on it (beds lie you down). */
    sit: (c, facing: unknown): StepResult => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      if (!p) return null;
      p.lastInputAt = Date.now();
      if (isFacing(facing)) p.facing = facing;
      const [dx, dy] = DIRS[p.facing];
      const x = p.x + dx;
      const y = p.y + dy;
      const seat = mapOf(p.room).kind(x, y).seat;
      const taken = Object.values(c.state.players).some((o) => o.room === p.room && o.x === x && o.y === y);
      if (!seat) return null;
      if (taken) return { notice: "Someone's already there." };
      Object.assign(p, { x, y, state: "sit", facing: seat === "chair" ? "up" : "down" });
      c.vars.dirty.add(p.id);
      return correction(p);
    },

    say: async (c, rawText: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      const text = parseChatText(rawText);
      if (!p || !text) return;
      if (!c.vars.chat.take(String(userId), Date.now()))
        throw new UserError("Slow down a little.", { code: "rate_limited" });
      p.lastInputAt = Date.now();
      const at = Date.now();
      const [row] = await all<{ id: number }>(
        c.db,
        "INSERT INTO chat (room, user_id, name, text, at) VALUES (?, ?, ?, ?, ?) RETURNING id",
        p.room,
        userId,
        p.name,
        text,
        at,
      );
      await c.db.execute("DELETE FROM chat WHERE room = ? AND id <= ?", p.room, row!.id - CHAT_KEEP);
      const line: ChatLine = { id: row!.id, room: p.room, userId, name: p.name, text, at };
      sendToRoom(c, p.room, "chat", line);
      // People mentioned elsewhere hear about it; those in the room already see the line.
      const named = new Set(mentionsIn(text));
      if (named.size === 0) return;
      for (const conn of c.conns.values()) {
        const s = conn.state as ConnState;
        if (s.kind !== "user" || !s.joined || s.userId === userId) continue;
        const other = c.state.players[s.userId];
        if (other && other.room !== p.room && named.has(other.name)) conn.send("mention", line);
      }
    },

    /** Another room's recent chat, only for rooms you could walk into. */
    history: (c, room: unknown): Promise<ChatLine[]> => {
      const userId = requireUser(c.conn.state);
      const p = c.state.players[userId];
      const allowed =
        room === "town" || room === "inn" || (p?.companyId != null && room === `hq:${p.companyId}`);
      if (!allowed) throw new UserError("You can't read that room.", { code: "forbidden" });
      return chatOf(c.db, room as RoomId);
    },

    setPlayer: (c, core: PlayerCore): void => {
      requireInternal(c.conn.state);
      const before = c.state.players[core.id]?.companyId;
      const p = upsert(c.state, core, Date.now());
      const online = c.vars.online.has(p.id);
      if (before !== undefined && before !== p.companyId) {
        // Changed company: out of the old house, and resting players move to the new one.
        if (!online) rest(c.state, p, p.state === "working" ? "working" : "away");
        else if (p.room.startsWith("hq:") && p.room !== `hq:${p.companyId}`) Object.assign(p, townSpawn());
        c.vars.dirty.add(p.id);
      }
      c.broadcast("info", info(p, online));
    },

    setCompany: (c, company: CompanyInfo): void => {
      requireInternal(c.conn.state);
      c.state.companies[company.id] = company;
      c.broadcast("companies", Object.values(c.state.companies));
    },

    removeCompany: (c, id: number): void => {
      requireInternal(c.conn.state);
      delete c.state.companies[id];
      c.broadcast("companies", Object.values(c.state.companies));
    },

    /** From `player` on sign-out: forget cached tokens and close that user's open game tabs. */
    forget: (c, userId: number): void => {
      requireInternal(c.conn.state);
      forgetUser(c.vars.tokens, userId);
      for (const conn of c.conns.values()) {
        const s = conn.state as ConnState;
        if (s.kind === "user" && s.userId === userId) conn.disconnect("signed out");
      }
    },

    /** From `player` after an ingest: offline players work at their desk while agents run. */
    activity: (c, userId: number, lastAt: number, liveAgents: number): void => {
      requireInternal(c.conn.state);
      const p = c.state.players[userId];
      if (!p) return;
      p.lastAgentAt = Math.max(p.lastAgentAt, lastAt);
      p.liveAgents = liveAgents;
      const online = c.vars.online.has(userId);
      if (!online) {
        const want = Date.now() - p.lastAgentAt < WORKING_MS ? "working" : "away";
        if (p.state !== want) {
          rest(c.state, p, want);
          c.vars.dirty.add(p.id);
        }
      }
      c.broadcast("info", info(p, online));
    },
  },
});

// MARK: Helpers (plain functions over state, so the tick and the actions share them)

type Vars = {
  online: Map<number, number>;
  dirty: Set<number>;
  announced: Map<number, RoomId>;
  occupancy: string;
  houses: string;
};

function upsert(s: WorldState, core: PlayerCore, now: number): WorldPlayer {
  const existing = s.players[core.id];
  if (existing) return Object.assign(existing, core);
  const p: WorldPlayer = {
    ...core,
    ...townSpawn(),
    state: "idle",
    lastInputAt: now,
    lastAgentAt: 0,
    liveAgents: 0,
  };
  s.players[core.id] = p;
  rest(s, p, "away");
  p.back = null; // Nowhere to go back to: a new player wakes up at home.
  return p;
}

function plots(s: WorldState): Map<number, { id: number; name: string }> {
  const out = new Map<number, { id: number; name: string }>();
  for (const co of Object.values(s.companies)) if (co.plot !== null) out.set(co.plot, co);
  return out;
}

/** Sends `p` to their bed (`away`) or desk (`working`) at home, remembering where they were. */
function rest(s: WorldState, p: WorldPlayer, state: "away" | "working"): void {
  if (p.state === "idle" || p.state === "sit")
    p.back = { room: p.room, x: p.x, y: p.y, facing: p.facing, state: p.state };
  const hasPlot = p.companyId !== null && s.companies[p.companyId]?.plot != null;
  const room = homeRoom(p.companyId, hasPlot);
  const taken = new Set(
    Object.values(s.players)
      .filter((o) => o.id !== p.id && o.room === room)
      .map((o) => `${o.x},${o.y}`),
  );
  Object.assign(p, restSpot(room, state, taken), { state });
}

/**
 * Gets up a resting player: back where they were before resting, if they can
 * still be there (not a house they've left), else up where they lie. False if
 * they weren't resting.
 */
function wake(s: WorldState, p: WorldPlayer): boolean {
  if (p.state !== "away" && p.state !== "working") return false;
  const back = p.back;
  p.back = null;
  const house = back ? companyOfRoom(back.room) : null;
  const canGo = back && (house === null || (house === p.companyId && s.companies[house]?.plot != null));
  if (!canGo) {
    p.state = "idle";
    return true;
  }
  // Someone took their seat meanwhile: stand up there instead.
  const taken = Object.values(s.players).some(
    (o) => o.id !== p.id && o.room === back.room && o.x === back.x && o.y === back.y,
  );
  Object.assign(p, back, { state: back.state === "sit" && !taken ? "sit" : "idle" });
  return true;
}

/** Idle players go to bed; offline ones switch between desk and bed as their agents start and stop. */
function settle(s: WorldState, v: Vars, now: number): void {
  for (const p of Object.values(s.players)) {
    if (v.online.has(p.id)) {
      if ((p.state === "idle" || p.state === "sit") && now - p.lastInputAt > IDLE_MS) {
        rest(s, p, "away");
        v.dirty.add(p.id);
      }
      continue;
    }
    const want = now - p.lastAgentAt < WORKING_MS ? "working" : "away";
    if (p.state !== want) {
      rest(s, p, want);
      v.dirty.add(p.id);
    }
  }
}

const correction = (p: WorldPlayer): StepResult => ({
  x: p.x,
  y: p.y,
  facing: p.facing,
  state: p.state,
  room: p.room,
});

function occupancy(s: WorldState, online: Map<number, number>): Partial<Record<RoomId, number>> {
  const out: Partial<Record<RoomId, number>> = {};
  for (const id of online.keys()) {
    const room = s.players[id]?.room;
    if (room) out[room] = (out[room] ?? 0) + 1;
  }
  return out;
}

async function snapshot(
  s: WorldState,
  online: Map<number, number>,
  self: WorldPlayer,
  chat: Promise<ChatLine[]>,
): Promise<Snapshot> {
  return {
    room: self.room,
    selfId: self.id,
    players: Object.values(s.players)
      .filter((p) => p.room === self.room)
      .map((p) => view(p, online.has(p.id))),
    companies: Object.values(s.companies),
    occupancy: occupancy(s, online),
    chat: await chat,
    houses: self.room === "town" ? houses(s) : {},
  };
}

/** Everyone inside each company house, for drawing them through its walls from town. */
function houses(s: WorldState): Houses {
  const out: Houses = {};
  for (const p of Object.values(s.players)) {
    const companyId = companyOfRoom(p.room);
    if (companyId === null) continue;
    const list = out[companyId] ?? [];
    list.push({ id: p.id, name: p.name, level: p.level, look: p.look, state: p.state });
    out[companyId] = list;
  }
  return out;
}

async function chatOf(sql: Sql, room: RoomId) {
  const rows = await all<ChatLine>(
    sql,
    "SELECT id, room, user_id AS userId, name, text, at FROM chat WHERE room = ? ORDER BY id DESC LIMIT ?",
    room,
    CHAT_HISTORY,
  );
  return rows.reverse();
}

interface Sender {
  conns: Map<string, { state: unknown; send(name: string, ...args: unknown[]): void }>;
  state: WorldState;
}

function sendToRoom(c: Sender, room: RoomId, event: string, payload: unknown): void {
  for (const conn of c.conns.values()) {
    const s = conn.state as ConnState;
    if (s.kind === "user" && s.joined && c.state.players[s.userId]?.room === room) conn.send(event, payload);
  }
}

/** A player who changed room (a door, or sent to bed) gets the new room whole. */
async function sendSnapshot(c: Sender & { vars: Vars; db: Sql }, p: WorldPlayer): Promise<void> {
  const snap = await snapshot(c.state, c.vars.online, p, chatOf(c.db, p.room));
  for (const conn of c.conns.values()) {
    const s = conn.state as ConnState;
    if (s.kind === "user" && s.joined && s.userId === p.id) conn.send("snapshot", snap);
  }
}

/** One tick: batched moves per room, and head counts when they change. */
function flush(c: Sender & { vars: Vars; db: Sql; broadcast(name: string, ...args: unknown[]): void }): void {
  const { dirty, announced, online } = c.vars;
  if (dirty.size > 0) {
    const rooms = new Map<RoomId, Moves>();
    const at = (room: RoomId) => {
      const m = rooms.get(room) ?? { room, join: [], m: [], leave: [] };
      rooms.set(room, m);
      return m;
    };
    for (const id of dirty) {
      const p = c.state.players[id];
      if (!p) continue;
      const was = announced.get(id);
      if (was === p.room) {
        at(p.room).m.push(pos(p));
        continue;
      }
      if (was) at(was).leave.push(id);
      at(p.room).join.push(view(p, online.has(id)));
      announced.set(id, p.room);
      if (online.has(id)) void sendSnapshot(c, p);
    }
    dirty.clear();
    for (const [room, m] of rooms) sendToRoom(c, room, "moves", m);
  }
  const counts = JSON.stringify(occupancy(c.state, online));
  if (counts !== c.vars.occupancy) {
    c.vars.occupancy = counts;
    c.broadcast("occupancy", JSON.parse(counts));
  }
  // ponytail: recomputed every tick (a pass over all players) so renames and level-ups show too.
  // Track changes per house if the world gets big.
  const inside = JSON.stringify(houses(c.state));
  if (inside !== c.vars.houses) {
    c.vars.houses = inside;
    sendToRoom(c, "town", "houses", JSON.parse(inside));
  }
}
