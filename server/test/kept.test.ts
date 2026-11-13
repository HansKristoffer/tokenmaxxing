import { expect, test } from "bun:test";
import { KEPT_TABLE, Kept, saveAfterActions } from "../src/actors/kept.ts";
import type { TxSql } from "../src/actors/shared.ts";
import { memorySql } from "./memory-sql.ts";

interface Town {
  seeded: boolean;
  players: Record<string, { name: string; x: number }>;
  stars?: { count: number };
}
const fresh = (): Town => ({ seeded: false, players: {} });

/** A database with the table, and every statement run on it since. */
async function database() {
  const { db, sql } = memorySql();
  await sql.execute(KEPT_TABLE);
  const ran: string[] = [];
  const counted: TxSql = {
    execute: (q, ...args) => {
      ran.push(
        `${q.split(/\s+/, 1)[0]} ${args.filter((_, i) => i % 2 === 0 || q.startsWith("DELETE")).join(",")}`,
      );
      return sql.execute(q, ...args);
    },
    transaction: (fn) => sql.transaction(() => fn(counted)),
  };
  const rows = () =>
    Object.fromEntries(
      (db.query("SELECT name, json FROM kept ORDER BY name").all() as { name: string; json: string }[]).map(
        (r) => [r.name, JSON.parse(r.json)],
      ),
    );
  return { sql: counted, ran, rows };
}

test("what an actor keeps is read back as it was saved, a row for each key and for each player", async () => {
  const { sql, rows } = await database();
  const kept = await Kept.load<Town>(sql, ["players"], fresh);
  // Nothing is written until something is saved.
  expect(rows()).toEqual({});
  kept.value.seeded = true;
  kept.value.players[7] = { name: "ada", x: 3 };
  kept.value.players[12] = { name: "it's bob 🐟", x: -4.5 };
  await kept.save();
  expect(rows()).toEqual({
    seeded: true,
    "players/7": { name: "ada", x: 3 },
    "players/12": { name: "it's bob 🐟", x: -4.5 },
  });
  expect((await Kept.load<Town>(sql, ["players"])).value).toEqual(kept.value);
});

test("a save writes only what changed since the last, and takes out what is gone", async () => {
  const { sql, ran, rows } = await database();
  const kept = await Kept.load<Town>(sql, ["players"], fresh);
  for (let id = 1; id <= 450; id++) kept.value.players[id] = { name: `p${id}`, x: id };
  kept.value.stars = { count: 1 };
  await kept.save();
  // 452 rows, 200 to a statement.
  expect(ran.filter((q) => q.startsWith("INSERT"))).toHaveLength(3);

  ran.length = 0;
  await kept.save();
  expect(ran).toEqual([]);

  kept.value.players[3]!.x = 99;
  delete kept.value.players[4];
  delete kept.value.stars;
  await kept.save();
  expect(ran).toEqual(["INSERT players/3", "DELETE players/4,stars"]);
  expect(rows()["players/3"]).toEqual({ name: "p3", x: 99 });
  const again = await Kept.load<Town>(sql, ["players"]);
  expect(again.value).toEqual(kept.value);
  expect(Object.keys(again.value.players)).toHaveLength(449);
});

test("an actor whose players have all gone still wakes with a place for them", async () => {
  const { sql } = await database();
  const kept = await Kept.load<Town>(sql, ["players"], fresh);
  kept.value.seeded = true;
  await kept.save();
  expect((await Kept.load<Town>(sql, ["players"])).value).toEqual({ seeded: true, players: {} });
});

test("saves asked for together are one write, and a change during a save is in the next", async () => {
  const { sql, ran, rows } = await database();
  const kept = await Kept.load<Town>(sql, ["players"], fresh);
  kept.value.players[1] = { name: "a", x: 0 };
  const first = kept.save();
  // Asked again before the first has started: the same save.
  expect(kept.save()).toBe(first);
  await Promise.resolve();
  await Promise.resolve();
  // The first is writing now. This change missed it, and the save asked for here writes it after.
  kept.value.players[1]!.x = 5;
  const second = kept.save();
  expect(second).not.toBe(first);
  await Promise.all([first, second]);
  expect(rows()["players/1"]).toEqual({ name: "a", x: 5 });
  expect(ran.filter((q) => q.startsWith("INSERT")).length).toBeLessThanOrEqual(2);
});

test("a save that fails is tried again by the next, and loses nothing", async () => {
  const { sql, rows } = await database();
  let down = true;
  const flaky: TxSql = {
    execute: sql.execute,
    transaction: (fn) => (down ? Promise.reject(new Error("disk full")) : sql.transaction(fn)),
  };
  const kept = await Kept.load<Town>(flaky, ["players"], fresh);
  kept.value.seeded = true;
  await expect(kept.save()).rejects.toThrow("disk full");
  expect(rows()).toEqual({});
  down = false;
  await kept.save();
  expect(rows()).toEqual({ seeded: true });
});

test("a new actor's first value is there when it wakes, and an actor that kept nothing can't wake as one that did", async () => {
  const { sql } = await database();
  await expect(Kept.load<Town>(sql)).rejects.toThrow("nothing was kept");
  await Kept.create(sql, { userId: 7, devices: [{ id: 1 }], missing: undefined });
  expect((await Kept.load<object>(sql)).value).toEqual({ userId: 7, devices: [{ id: 1 }] });
});

test("a key with a slash is refused: read back, it would be an entry under another key", async () => {
  const { sql, rows } = await database();
  const kept = await Kept.load<Record<string, unknown>>(sql, [], () => ({ "a/b": 1 }));
  await expect(kept.save()).rejects.toThrow("slash");
  expect(rows()).toEqual({});
});

test("an action's changes are on disk before it answers, also when it throws halfway", async () => {
  const { sql, rows } = await database();
  const kept = await Kept.load<Town>(sql, ["players"], fresh);
  const c = { vars: { kept, state: kept.value } };
  const definition = {
    config: {
      actions: {
        arrive: (ctx: typeof c, id: number) => {
          ctx.vars.state.players[id] = { name: "ada", x: 1 };
          return id * 2;
        },
        stumble: async (ctx: typeof c) => {
          ctx.vars.state.seeded = true;
          throw new Error("halfway");
        },
      },
    },
  };
  saveAfterActions(definition);
  const { arrive, stumble } = definition.config.actions;
  expect(await arrive(c, 7)).toBe(14);
  expect(rows()).toEqual({ seeded: false, "players/7": { name: "ada", x: 1 } });
  await expect(stumble(c)).rejects.toThrow("halfway");
  expect(rows().seeded).toBe(true);
});
