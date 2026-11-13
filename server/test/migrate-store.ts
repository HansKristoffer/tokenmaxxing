/**
 * For `migrate-v2.test.ts`: `bun migrate-store.ts <v2|v3> <engine port> [write|write-bad|mend]`, with
 * RIVETKIT_STORAGE_PATH on a store. `write` first fills it with the awkward cases (on RivetKit 2, before
 * the move); `write-bad` too, with a state JSON can't hold for the last player, which `mend` puts right.
 * Then it prints what the store holds, read with queries that share nothing with the courier's own: state
 * from RivetKit 2's `c.state`, and on RivetKit 3 from the rows it was moved into.
 */
import { stopEngine } from "../src/engine.ts";
import { again } from "../src/migrate/courier.ts";

const [kit, port, mode] = process.argv.slice(2);
const v2 = kit === "v2";
const from = kit === "v2" ? "rivetkit-v2" : "rivetkit";
const { actor, setup } = (await import(from)) as typeof import("rivetkit");
const { createClient } = (await import(`${from}/client`)) as typeof import("rivetkit/client");
const { db } = (await import(`${from}/db`)) as typeof import("rivetkit/db");

const PLAYERS = 7;
/** What JSON carries, at its edges. `missing` and `-0` it doesn't: a missing key and `0` after the move. */
const stateOf = (i: number) => ({
  userId: i,
  missing: undefined,
  nothing: null,
  zero: -0,
  deep: {
    list: [1, "two", { three: [3.5, 1e21, Number.MAX_SAFE_INTEGER, -2.5e-7] }, []],
    text: `it's "quoted" æøå 🐟\nnext line\u0000 and a NUL`,
    "a/key with 'both'": {},
  },
  // One row past a frame (256 KB).
  big: `${i}:${"x".repeat(300_000)}`,
});
/** A state with a row for each entry under `players` (`KEPT_BY_ENTRY`). */
const WORLD = {
  seeded: true,
  players: { 1: { name: "ada", x: 3 }, 22: { name: "it's bob", x: -4.5 } },
  companies: { 5: { name: "Æble & Søn" } },
};

const TOWN_SQL = [
  `CREATE TABLE typed (id INTEGER PRIMARY KEY AUTOINCREMENT, v, label TEXT NOT NULL DEFAULT '')`,
  `INSERT INTO typed (v, label) VALUES
    (9223372036854775807, 'max'), (-9223372036854775808, 'min'), (9007199254740993, 'past a double'),
    (0.1, 'tenth'), (1e300, 'huge'), (-2.5e-7, 'tiny'), (3.0, 'a whole real'),
    ('it''s "quoted"', 'quotes'), ('line one' || char(10) || 'line two', 'newline'), ('æøå 🐟', 'unicode'),
    ('', 'empty'), (NULL, 'null'), (x'00ff10', 'blob'), (x'', 'empty blob'), ('(1,2),(3', 'looks like rows')`,
  // The highest ids are gone: the counter remembers them, the rows don't.
  `INSERT INTO typed (v, label) VALUES (1, 'gone'), (2, 'gone')`,
  `DELETE FROM typed WHERE label = 'gone'`,
  `CREATE TABLE emptied (id INTEGER PRIMARY KEY AUTOINCREMENT, v)`,
  `INSERT INTO emptied (v) VALUES (1), (2), (3)`,
  `DELETE FROM emptied`,
  `CREATE TABLE pairs (a INTEGER NOT NULL, b TEXT NOT NULL, v REAL, PRIMARY KEY (b, a)) WITHOUT ROWID`,
  `INSERT INTO pairs WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1000)
    SELECT i, 'k' || (i % 7), i / 3.0 FROM n`,
  `CREATE TABLE big (id INTEGER PRIMARY KEY, body TEXT NOT NULL)`,
  // Past one frame (256 KB) and several pages.
  `INSERT INTO big WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 3000)
    SELECT i * 7, printf('%d:', i) || hex(randomblob(150)) FROM n`,
  `CREATE INDEX big_body ON big (body)`,
  `CREATE TABLE "odd ""name""" ("a column" TEXT, "select" INTEGER)`,
  `INSERT INTO "odd ""name""" VALUES ('x', 1)`,
  `CREATE TABLE log (note TEXT)`,
  `CREATE TRIGGER typed_log AFTER INSERT ON typed BEGIN INSERT INTO log VALUES ('typed ' || new.id); END`,
  `PRAGMA user_version = 42`,
];

/** Each value by its type and exact form, without `quote`: the courier's digests are made with that. */
const exact = (column: string) =>
  `typeof(${column}) || ':' || CASE typeof(${column})
     WHEN 'real' THEN printf('%!.17g', ${column}) WHEN 'null' THEN '' WHEN 'integer' THEN CAST(${column} AS TEXT)
     ELSE hex(${column}) END`;
const TOWN_READS = {
  typed: `SELECT id, ${exact("v")} AS v, label FROM typed ORDER BY id`,
  pairs: `SELECT count(*) AS n, sum(a) AS a, group_concat(DISTINCT b) AS b, printf('%!.17g', sum(v)) AS v FROM pairs`,
  big: `SELECT count(*) AS n, sum(id) AS ids, sum(length(body)) AS bytes, min(body) AS first, max(body) AS last FROM big`,
  odd: `SELECT * FROM "odd ""name"""`,
  log: `SELECT count(*) AS n FROM log`,
  emptied: `SELECT count(*) AS n FROM emptied`,
  sequences: `SELECT name, seq FROM sqlite_sequence ORDER BY name`,
  schema: `SELECT type, name, tbl_name, sql FROM sqlite_master
           WHERE name NOT LIKE '\\_rivet\\_%' ESCAPE '\\' AND tbl_name NOT LIKE '\\_rivet\\_%' ESCAPE '\\' ORDER BY name`,
  version: `PRAGMA user_version`,
};

interface Ctx {
  state: unknown;
  db: { execute(sql: string, ...args: unknown[]): Promise<unknown[]> };
}
const plain = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(plain)
    : v !== null && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
      : v;
/** What a state says once it has been JSON, keys in order: the same string for the same state. */
const said = (v: unknown): string =>
  JSON.stringify(v, (_, x: unknown) =>
    x !== null && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  );
/** Its state as a string, and the names of the rows it is kept in (none on RivetKit 2). */
async function kept(c: Ctx): Promise<{ state: string; rows: string[] }> {
  if (v2) return { state: said(plain(c.state)), rows: [] };
  const has = await c.db.execute("SELECT 1 FROM sqlite_master WHERE name = 'kept'");
  if (!has.length) return { state: said({}), rows: [] };
  const rows = (await c.db.execute("SELECT name, json FROM kept ORDER BY name")) as {
    name: string;
    json: string;
  }[];
  const state: Record<string, unknown> = {};
  for (const { name, json } of rows) {
    const [key, entry] = name.split(/\/(.*)/s) as [string, string | undefined];
    if (entry === undefined) state[key] = JSON.parse(json);
    else state[key] = { ...(state[key] as object), [entry]: JSON.parse(json) };
  }
  return { state: said(state), rows: rows.map((r) => r.name) };
}
/** What `read` found kept: actors run in this process, and a state here is past what a message may be. */
let found: Awaited<ReturnType<typeof kept>> = { state: "", rows: [] };
const STATES = {
  player: stateOf,
  bad: (i: number) => ({ userId: i, never: [1, Number.POSITIVE_INFINITY] }),
  world: () => WORLD,
};
const actions = {
  fill: async (c: Ctx, sql: string[]) => {
    for (const s of sql) await c.db.execute(s);
  },
  become: (c: Ctx, what: keyof typeof STATES, i: number) => {
    c.state = STATES[what](i);
  },
  read: async (c: Ctx, queries: Record<string, string>) => {
    found = await kept(c);
    return Object.fromEntries(
      await Promise.all(Object.entries(queries).map(async ([k, q]) => [k, await c.db.execute(q)])),
    ) as Record<string, unknown[]>;
  },
  sweep: () => {},
};
// State is RivetKit 2's: on RivetKit 3 the scribe has none, as the real actors have none.
const scribe = () =>
  actor({ ...(v2 ? { state: {} } : {}), db: db(), actions } as {
    db: ReturnType<typeof db>;
    actions: typeof actions;
  });

const registry = setup({
  use: { town: scribe(), world: scribe(), player: scribe(), arcade: scribe(), match: scribe() },
  startEngine: true,
  token: "default",
  engineHost: "127.0.0.1",
  enginePort: Number(port),
  startServices: false,
  noWelcome: true,
  logging: { level: "error" },
  shutdown: { gracePeriodMs: 5_000, disableSignalHandlers: true },
});
registry.start();
await registry.startAndWait();
const client = createClient<typeof registry>({
  endpoint: `http://127.0.0.1:${port}`,
  token: "default",
  disableMetadataLookup: true,
});

const ids = Array.from({ length: PLAYERS }, (_, i) => i + 1);
if (mode === "write" || mode === "write-bad") {
  const town = await client.town.create(["main"]);
  await town.fill(TOWN_SQL);
  await (await client.world.create(["main"])).become("world", 0);
  for (const i of ids)
    await (
      await client.player.create([String(i)])
    ).become(mode === "write-bad" && i === PLAYERS ? "bad" : "player", i);
  await (
    await client.match.create(["12"])
  ).fill(["CREATE TABLE moves (n INTEGER)", "INSERT INTO moves VALUES (1)"]);
}
// After a move that failed, the old engine was stopped without warning: its actors take a while to come back.
if (mode === "mend") await again(() => client.player.get([String(PLAYERS)]).become("player", PLAYERS));
const town = await again(() => client.town.get(["main"]).read(TOWN_READS));
const townRows = found.rows;
const players = [];
for (const i of ids) {
  await client.player.get([String(i)]).read({});
  players.push(found);
}
await client.world.get(["main"]).read({});
const world = found;
const match = await client.match.get(["12"]).read({ moves: "SELECT n FROM moves" });
// The arcade was never created: it must not exist afterwards either.
const arcade = await client.arcade
  .get(["main"])
  .read({})
  .then(
    () => "exists",
    () => "missing",
  );
console.log(
  JSON.stringify({
    store: { town, players: players.map((p) => p.state), world: world.state, match, arcade },
    rows: { players: players.map((p) => p.rows), world: world.rows, town: townRows },
  }),
);
await registry.shutdown().catch(() => {});
await stopEngine();
process.exit(0);
