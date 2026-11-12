/**
 * For `migrate-v2.test.ts`: `bun migrate-store.ts <v2|v3> <engine port> [write]`, with RIVETKIT_STORAGE_PATH
 * on a store. `write` first fills it with the awkward cases (on RivetKit 2, before the move); either way it
 * prints what the store holds, read with queries that share nothing with the courier's own.
 */
import { deserialize, serialize } from "bun:jsc";
import { stopEngine } from "../src/engine.ts";

const [kit, port, write] = process.argv.slice(2);
const from = kit === "v2" ? "rivetkit-v2" : "rivetkit";
const { actor, setup } = (await import(from)) as typeof import("rivetkit");
const { createClient } = (await import(`${from}/client`)) as typeof import("rivetkit/client");
const { db } = (await import(`${from}/db`)) as typeof import("rivetkit/db");

const PLAYERS = 7;
/** What JSON can't carry, which RivetKit's state can. (Not -0: RivetKit 3 keeps it as 0, whoever writes it.) */
const stateOf = (i: number) => ({
  userId: i,
  never: Number.POSITIVE_INFINITY,
  missing: undefined,
  nothing: null,
  deep: { list: [1, "two", { three: [3.5, 1e21] }], text: `it's "quoted" æøå 🐟\nnext line` },
});

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
const scribe = () =>
  actor({
    state: {} as Record<string, unknown>,
    db: db(),
    actions: {
      fill: async (c: Ctx, sql: string[]) => {
        for (const s of sql) await c.db.execute(s);
      },
      become: (c: Ctx, i: number) => {
        c.state = stateOf(i);
      },
      read: async (c: Ctx, queries: Record<string, string>) => ({
        state: Buffer.from(serialize(plain(c.state))).toString("base64"),
        rows: Object.fromEntries(
          await Promise.all(Object.entries(queries).map(async ([k, q]) => [k, await c.db.execute(q)])),
        ),
      }),
      sweep: () => {},
    },
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
if (write) {
  const town = await client.town.create(["main"]);
  await town.fill(TOWN_SQL);
  for (const i of ids) await (await client.player.create([String(i)])).become(i);
  await (
    await client.match.create(["12"])
  ).fill(["CREATE TABLE moves (n INTEGER)", "INSERT INTO moves VALUES (1)"]);
}
const town = await client.town.get(["main"]).read(TOWN_READS);
const players = [];
for (const i of ids) {
  const p = await client.player.get([String(i)]).read({});
  players.push(Bun.inspect(deserialize(Buffer.from(p.state, "base64")), { depth: 9, sorted: true }));
}
const match = await client.match.get(["12"]).read({ moves: "SELECT n FROM moves" });
// The world and the arcade were never created: they must not exist afterwards either.
const world = await client.world
  .get(["main"])
  .read({})
  .then(
    () => "exists",
    () => "missing",
  );
console.log(JSON.stringify({ store: { town: town.rows, players, match: match.rows, world } }));
await registry.shutdown().catch(() => {});
await stopEngine();
process.exit(0);
