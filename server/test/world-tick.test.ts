import { expect, test } from "bun:test";
import { type Moves, readMoves } from "@tokenmaxxing/core/world.ts";
import { world } from "../src/actors/world.ts";
import { eventually } from "./eventually.ts";

/**
 * What a tick costs must not grow with the room faster than the room does. `c.state`, `c.vars`, `c.conns`
 * and `conn.id` are each a call into RivetKit's native side, and an event is encoded for each connection it
 * is sent to: asked per connection and sent as an object, a full town is most of a tick. This runs the
 * world's own loop over a full room, in this process, and counts what a tick asks for.
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
    get state() {
      asked.connStates++;
      return { kind: "user", userId: id, via: "app", joined: true, text: id !== PEOPLE };
    },
    send: (event: string, payload: unknown) => {
      if (event === "moves") heard.get(id)!.push(payload);
    },
  }));
  const asked = { conns: 0, ids: 0, connStates: 0, vars: 0, state: 0 };
  const never = Number.POSITIVE_INFINITY;
  const vars = {
    ...(world.config as unknown as { createVars: () => Record<string, unknown> }).createVars(),
    online: new Map(ids.map((id) => [id, 1])),
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
  } as unknown as { dirty: Set<number> };
  const controller = new AbortController();
  const ctx = {
    get state() {
      asked.state++;
      return state;
    },
    get vars() {
      asked.vars++;
      return vars;
    },
    db: { execute: async () => [] },
    conns: {
      values: () => {
        asked.conns++;
        return conns.values();
      },
    },
    broadcast: () => {},
    abortSignal: controller.signal,
  };
  const running = (world.config.run as unknown as (c: typeof ctx) => Promise<void>)(ctx);
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
    await running;
  }

  // Three ticks: the connections once each, an id per connection, and who each is from memory.
  expect(asked.conns).toBe(3);
  expect(asked.ids).toBe(3 * PEOPLE);
  expect(asked.connStates).toBe(0);
  // The rest of a tick's reads are its own (a couple of dozen): not one per person in the room.
  expect(asked.vars / 3).toBeLessThan(PEOPLE);
  expect(asked.state / 3).toBeLessThan(PEOPLE);
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
  const db = {
    execute: async (sql: string) => {
      if (sql.startsWith("SELECT")) {
        reads++;
        await Bun.sleep(5);
        return [...said].reverse();
      }
      return sql.startsWith("INSERT") ? [{ id: nextId++ }] : [];
    },
  };
  const vars = (world.config as unknown as { createVars: () => object }).createVars();
  const ctx = (id: number) => ({
    state: { seeded: true, players, companies: {} },
    vars,
    db,
    conns: new Map(),
    conn: { id: `conn-${id}`, state: { kind: "user", userId: id, via: "app" }, send: () => {} },
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
