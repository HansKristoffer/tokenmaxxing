/**
 * The move from RivetKit 2's store to RivetKit 3's (`src/migrate/from-v2.ts`), on real stores with both
 * engines. RivetKit 3 does not read the old store, so a start that skipped this would be an empty town.
 */
import { expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { MARKER, migrateFromV2, pending } from "../src/migrate/from-v2.ts";
import expected from "./fixtures/town-1.19.0-expected.json" with { type: "json" };
import { enginePort, scratch, serve } from "./own-server.ts";

/** What a player sees of their own, as the fixture's server was asked before it stopped. */
async function answers(client: Awaited<ReturnType<typeof serve>>["client"], token: string, userId: number) {
  const town = client.town.getOrCreate(["main"], { params: { token } });
  const world = client.world.getOrCreate(["main"], { params: { token } }).connect();
  const snap = await world.join(1);
  await world.dispose();
  const devices = await client.player.get([String(userId)], { params: { token } }).devices();
  return {
    me: await town.me(),
    balance: (await town.wallet()).balance,
    bag: await town.bag(),
    devices: devices.map(({ id, kind, name, platform, createdAt }) => ({
      id,
      kind,
      name,
      platform,
      createdAt,
    })),
    chat: snap.chat,
  };
}

test("a town written by release 1.19.0 on RivetKit 2 answers the same on RivetKit 3, and is moved once", async () => {
  // The fixture: `main.ts` of v1.19.0 (rivetkit 2.3.21), three players who signed up, founded and joined a
  // company, bought a pet, talked and synced usage; its answers were written down before it stopped. (The
  // tokens next to them are those three players': they open that town and nothing else.)
  const storage = scratch();
  const engineDir = join(storage, ".rivetkit/var/engine");
  mkdirSync(engineDir, { recursive: true });
  const fixture = join(import.meta.dir, "fixtures/town-1.19.0-rivetkit-2.3.21.tgz");
  expect(Bun.spawnSync(["tar", "-xzf", fixture, "-C", engineDir]).exitCode).toBe(0);
  expect(pending(storage)).toBe(true);

  const engine = enginePort();
  const first = await serve(storage, engine);
  // The healthcheck was answered while the town moved: a deploy isn't failed for taking its time.
  expect(first.migrating).toBe(true);
  for (const user of expected)
    expect(await answers(first.client, user.token, user.userId)).toEqual(user.answers as never);
  // The old store is where it was: the previous release would still find its town.
  expect(existsSync(join(engineDir, "db/CURRENT"))).toBe(true);
  expect(existsSync(join(engineDir, MARKER))).toBe(true);
  expect(pending(storage)).toBe(false);

  // What happens after the move is kept: the next start doesn't move the old town in again over it.
  const late = await first.client.town.getOrCreate(["main"]).signUp("late_arrival");
  await first.stop();
  const second = await serve(storage, engine);
  expect(second.migrating).toBe(false);
  const me = await second.client.town.getOrCreate(["main"], { params: { token: late.token } }).me();
  expect(me.name).toBe("late_arrival");
  await second.stop();
}, 180_000);

interface Store {
  town: {
    typed: { id: number; v: string; label: string }[];
    pairs: [{ n: number; a: number; b: string }];
    big: [{ n: number; bytes: number }];
    emptied: [{ n: number }];
    sequences: { name: string; seq: number }[];
    schema: { type: string; name: string }[];
    version: [{ user_version: number }];
  };
  /** Each one's state, and the world's, as JSON with its keys in order. */
  players: string[];
  world: string;
  match: { moves: { n: number }[] };
  arcade: string;
}
/** The names of the rows each state is kept in, on RivetKit 3. */
interface Rows {
  players: string[][];
  world: string[];
  town: string[];
}

/** `migrate-store.ts` on `storage`: what it holds, read by queries of its own. */
async function store(
  kit: "v2" | "v3",
  storage: string,
  port: number,
  mode?: "write" | "write-bad" | "mend",
): Promise<{ store: Store; rows: Rows }> {
  const script = Bun.spawn(
    ["bun", join(import.meta.dir, "migrate-store.ts"), kit, String(port), ...(mode ? [mode] : [])],
    { env: { ...process.env, RIVETKIT_STORAGE_PATH: storage, RIVET_LOG_LEVEL: "error" }, stderr: "ignore" },
  );
  const out = await new Response(script.stdout).text();
  expect(await script.exited).toBe(0);
  return JSON.parse(out.split("\n").find((l) => l.startsWith('{"store"'))!) as { store: Store; rows: Rows };
}

/** The rows the cases are: `town`'s tables and the match's one move, and each state's rows. */
const TABLE_ROWS = 15 + 1000 + 3000 + 1 + 1;
const PLAYER_ROWS = ["big", "deep", "nothing", "userId", "zero"];
const WORLD_ROWS = ["companies", "players/1", "players/22", "seeded"];

test("every value an actor can keep arrives as it was, its state in the rows the actors read", async () => {
  const storage = scratch();
  const engine = enginePort();
  const { store: before } = await store("v2", storage, engine, "write");
  // The cases are there to begin with, so "the same after" says something.
  expect(before.town.typed.map((r) => r.v)).toContain("integer:9223372036854775807");
  expect(before.town.typed.map((r) => r.v)).toContain("integer:9007199254740993");
  expect(before.town.typed.map((r) => r.v)).toContain("real:0.10000000000000001");
  expect(before.town.typed.map((r) => r.v)).toContain("blob:00FF10");
  expect(before.town.pairs[0].n).toBe(1000);
  expect(before.town.big[0]).toMatchObject({ n: 3000 });
  expect(before.town.big[0].bytes).toBeGreaterThan(900_000);
  // Ids 16 and 17 were given out and deleted, and `emptied` gave out three: the next ids must not be theirs.
  expect(before.town.sequences).toEqual([
    { name: "emptied", seq: 3 },
    { name: "typed", seq: 17 },
  ]);
  expect(before.town.version).toEqual([{ user_version: 42 }]);
  expect(before.players).toHaveLength(7);
  expect(before.players[0]).toContain('"text":"it\'s \\"quoted\\" æøå 🐟\\nnext line\\u0000 and a NUL"');
  expect(before.players[0]!.length).toBeGreaterThan(300_000);
  expect(JSON.parse(before.world)).toMatchObject({ players: { 22: { name: "it's bob", x: -4.5 } } });

  // Three actors at a time: the old engine's list is read over several pages.
  const moved = await migrateFromV2(storage, engine, 3);
  expect(moved).toMatchObject({ actors: 10, rows: TABLE_ROWS + 7 * PLAYER_ROWS.length + WORLD_ROWS.length });
  const after = await store("v3", storage, engine);
  expect(after.store).toEqual(before);
  // A row for each key, and for each of the world's players; an actor with no state has no table for it.
  expect(after.rows).toEqual({ players: before.players.map(() => PLAYER_ROWS), world: WORLD_ROWS, town: [] });
  // Nothing is moved twice.
  expect(await migrateFromV2(storage, engine)).toBeNull();
}, 180_000);

test("a state JSON can't hold stops the move with no half-made town, and once it is put right the next start moves it", async () => {
  const storage = scratch();
  const engine = enginePort();
  await store("v2", storage, engine, "write-bad");
  // The last player keeps an `Infinity`. By then `town`, the world and six players are in the new store.
  await expect(migrateFromV2(storage, engine)).rejects.toThrow();
  expect(existsSync(join(storage, ".rivetkit/var/engine/depot"))).toBe(false);
  expect(pending(storage)).toBe(true);
  // The old town is as it was: RivetKit 2 still serves it.
  const { store: mended } = await store("v2", storage, engine, "mend");
  expect(await migrateFromV2(storage, engine)).toMatchObject({ actors: 10 });
  expect((await store("v3", storage, engine)).store).toEqual(mended);
}, 240_000);

test("a RivetKit 3 store that no move made is never deleted", async () => {
  // Both stores and no marker: a volume restored by halves, or a marker someone removed. Moving the old
  // town in again would delete everything since.
  const storage = scratch();
  const engineDir = join(storage, ".rivetkit/var/engine");
  mkdirSync(join(engineDir, "db"), { recursive: true });
  mkdirSync(join(engineDir, "depot"));
  await Bun.write(join(engineDir, "db/CURRENT"), "MANIFEST-000005\n");
  await Bun.write(join(engineDir, "depot/town"), "everyone since the move");
  await expect(migrateFromV2(storage, 1)).rejects.toThrow(/didn't make/);
  expect(await Bun.file(join(engineDir, "depot/town")).text()).toBe("everyone since the move");
});
