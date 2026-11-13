import { expect, test } from "bun:test";
import { type Moves, readMoves } from "@tokenmaxxing/core/world.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { world } from "../src/actors/world.ts";
import { eventually } from "./eventually.ts";

/** A database with nothing in it, and `town` with nobody: what a fake world wakes on. */
const db: TxSql = {
  execute: async () => [],
  transaction: (fn) => fn(db),
};
const main = {
  getOrCreate: () => ({
    seed: async () => ({ companies: [], players: [], offices: {}, drops: [] }),
    pokerRelease: async () => 0,
    rouletteRefund: async () => 0,
  }),
};
const client = () => ({ town: main, world: main, arcade: main });
const createVars = (
  world.config as unknown as { createVars: (c: object) => Promise<Record<string, unknown>> }
).createVars;

/**
 * What a tick costs must not grow with the room faster than the room does. `c.vars`, `c.conns` and
 * `conn.id` are each a call into RivetKit's native side (`c.conns` builds a handle for every connection),
 * and an event is encoded for each connection it is sent to: asked per connection and sent as an object,
 * a full town is most of a tick. This wakes the world over a full room, in this process, and counts what
 * its loop asks for in a tick.
 */
test("a tick asks RivetKit a fixed number of things, and writes a room's moves once for everyone who reads text", async () => {
  const PEOPLE = 80;
  const ids = Array.from({ length: PEOPLE }, (_, i) => i + 1);
  const players = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        id,
        name: `p${id}`,
        look: {},
        level: 1,
        companyId: null,
        todayTokens: 0,
        liveAgents: 0,
        lastAgentAt: 0,
      },
    ]),
  ) as Record<number, Record<string, unknown>>;
  for (const id of ids)
    Object.assign(players[id]!, { room: "town", x: 10 + id, y: 20, facing: "down", state: "idle" });
  const state = { seeded: true, players, companies: {}, statue: { nextAt: Number.POSITIVE_INFINITY } };

  // Everyone has one tab; the last is from before `moves` were text.
  const heard = new Map<number, unknown[]>(ids.map((id) => [id, []]));
  const conns = ids.map((id) => ({
    get id() {
      asked.ids++;
      return `conn-${id}`;
    },
    send: (event: string, payload: unknown) => {
      if (event === "moves") heard.get(id)!.push(payload);
    },
  }));
  const asked = { conns: 0, ids: 0, vars: 0 };
  const never = Number.POSITIVE_INFINITY;
  const vars = {
    ...(await createVars({ db })),
    state,
    online: new Map(ids.map((id) => [id, 1])),
    // As `join` leaves them.
    tabs: new Map(
      conns.map((conn, i) => [`conn-${ids[i]}`, { conn, userId: ids[i], text: ids[i] !== PEOPLE }]),
    ),
    // Already told they are in town, so a step is a plain move; nothing is read from outside meanwhile.
    announced: new Map(ids.map((id) => [id, "town"])),
    outageAt: never,
    launchesAt: never,
    keynotesAt: never,
    barrelAt: never,
    weatherAt: never,
    pollenAt: never,
    gridAt: never,
    starsAt: never,
  } as unknown as { dirty: Set<number>; loop: Promise<void> | null };
  const controller = new AbortController();
  const ctx = {
    get vars() {
      asked.vars++;
      return vars;
    },
    db,
    conns: {
      values: () => {
        asked.conns++;
        return conns.values();
      },
    },
    client,
    broadcast: () => {},
    abortSignal: controller.signal,
  };
  await world.config.onWake!(ctx as never);
  // Waking put the bots in town, and whoever stood in a wall beside it. Without the bots and back in
  // their row, a tick's moves are the ones made here.
  for (const id of Object.keys(players)) if (Number(id) < 0) delete players[Number(id)];
  for (const id of ids) Object.assign(players[id]!, { x: 10 + id, y: 20 });
  try {
    // Four ticks, everyone a step to the right in each. The first is the world's first too (the poker table
    // is told to the Tavern once), so the count starts after it.
    for (let step = 1; step <= 4; step++) {
      for (const id of ids) {
        players[id]!.x = 10 + id + step;
        vars.dirty.add(id);
      }
      await eventually(() => expect(heard.get(1)!.length).toBe(step));
      if (step === 1) for (const k of Object.keys(asked) as (keyof typeof asked)[]) asked[k] = 0;
    }
  } finally {
    controller.abort();
    await vars.loop;
  }

  // Three ticks: who is connected, and who each is, from memory. RivetKit isn't asked.
  expect(asked.conns).toBe(0);
  expect(asked.ids).toBe(0);
  // The rest of a tick's reads are its own (a few dozen): not one per person in the room.
  expect(asked.vars / 3).toBeLessThan(PEOPLE);
  for (let tick = 0; tick < 4; tick++) {
    const text = heard.get(1)![tick];
    expect(typeof text).toBe("string");
    // The same string, not an equal one: it was written once.
    for (const id of ids.slice(0, -1)) expect(heard.get(id)![tick]).toBe(text);
    const moves = readMoves(text as string);
    expect(moves.m).toHaveLength(PEOPLE);
    expect(moves.m[0]).toEqual([1, 12 + tick, 20, "down", "idle"]);
    expect(moves.m.at(-1)).toEqual([PEOPLE, 11 + PEOPLE + tick, 20, "down", "idle"]);
    // The old tab was told the same, as the object.
    const old = heard.get(PEOPLE)![tick] as Moves;
    expect(typeof old).toBe("object");
    expect(old).toEqual(moves);
  }
});

test("many joins at once read the room's chat from SQLite once, and a line said later reaches the next snapshot", async () => {
  // A deploy: everyone reconnects together. A read of the chat for each snapshot overflowed SQLite's queue.
  const PEOPLE = 60;
  const ids = Array.from({ length: PEOPLE }, (_, i) => i + 1);
  const players = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        ...{
          id,
          name: `p${id}`,
          look: {},
          level: 1,
          companyId: null,
          todayTokens: 0,
          liveAgents: 0,
          lastAgentAt: 0,
        },
        ...{ room: "town", x: 10 + id, y: 20, facing: "down", state: "idle" },
      },
    ]),
  );
  const said = [{ id: 7, room: "town", userId: 1, name: "p1", text: "before", at: 1 }];
  let reads = 0;
  let nextId = 8;
  const chat = {
    execute: async (sql: string) => {
      if (sql.startsWith("SELECT")) {
        reads++;
        await Bun.sleep(5);
        return [...said].reverse();
      }
      return sql.startsWith("INSERT") ? [{ id: nextId++ }] : [];
    },
  };
  const vars = {
    ...(await createVars({ db })),
    state: { seeded: true, players, companies: {} },
    callers: new Map(ids.map((id) => [`conn-${id}`, { kind: "user", userId: id, via: "app" }])),
  };
  const ctx = (id: number) => ({
    vars,
    db: chat,
    conns: new Map(),
    conn: { id: `conn-${id}`, send: () => {} },
    client: () => ({ town: { getOrCreate: () => ({ questEvent: async () => {} }) } }),
  });
  const actions = world.config.actions as unknown as {
    join: (c: object) => Promise<{ chat: { text: string }[] }>;
    say: (c: object, text: string) => Promise<void>;
  };
  const snapshots = await Promise.all(ids.map((id) => actions.join(ctx(id))));
  expect(reads).toBe(1);
  for (const snap of snapshots) expect(snap.chat.map((l) => l.text)).toEqual(["before"]);

  await actions.say(ctx(2), "after");
  expect((await actions.join(ctx(3))).chat.map((l) => l.text)).toEqual(["before", "after"]);
  expect(reads).toBe(1);
});
