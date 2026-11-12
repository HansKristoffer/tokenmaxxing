/**
 * The move from RivetKit 2's store to RivetKit 3's (`src/migrate/from-v2.ts`), on real stores with both
 * engines. RivetKit 3 does not read the old store, so a start that skipped this would be an empty town.
 */
import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "rivetkit/client";
import type { registry as Registry } from "../src/actors/registry.ts";
import { stopEngine } from "../src/engine.ts";
import { MARKER, migrateFromV2, pending } from "../src/migrate/from-v2.ts";
import expected from "./fixtures/town-1.19.0-expected.json" with { type: "json" };

const dirs: string[] = [];
const ports: number[] = [];
afterAll(async () => {
  for (const port of ports) await stopEngine(port);
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

const canListen = (port: number) => {
  try {
    Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } }).stop(true);
    return true;
  } catch {
    return false;
  }
};
/** A free engine port: each engine takes +1 and +10 too, and RivetKit 2's sits 20 above ours while it is read. */
function enginePort(): number {
  for (;;) {
    const port = 10_000 + Math.floor(Math.random() * 20_000);
    if ([0, 1, 10, 20, 21, 30].every((o) => canListen(port + o))) {
      ports.push(port, port + 20);
      return port;
    }
  }
}
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "tokenmaxxing-migrate-"));
  dirs.push(dir);
  return join(dir, "rivet");
}

/** The real server on `storage`; `stop` ends it as a deploy would. */
async function serve(storage: string, engine: number) {
  let port = 0;
  do port = 10_000 + Math.floor(Math.random() * 20_000);
  while (!canListen(port));
  const server = Bun.spawn(["bun", join(import.meta.dir, "../src/main.ts")], {
    env: {
      ...process.env,
      PORT: String(port),
      TOKENMAXXING_HOST: "127.0.0.1",
      RIVET_RUN_ENGINE_PORT: String(engine),
      RIVETKIT_STORAGE_PATH: storage,
      RIVET_LOG_LEVEL: "error",
      GITHUB_STARS: "off",
      GRID_FEED: "off",
      STATUE_FEED: "off",
      PICNIC_OUTAGE: "off",
      FIRECRAWL_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GATEWAY_REQUESTS_PER_MIN: "1000000",
      GATEWAY_SOCKETS_PER_MIN: "1000000",
    },
    stdout: "ignore",
    stderr: "ignore",
  });
  const origin = `http://127.0.0.1:${port}`;
  let migrating = false;
  for (const end = Date.now() + 120_000; ; await Bun.sleep(100)) {
    const health = await fetch(`${origin}/health`).then(
      (r) => (r.ok ? (r.json() as Promise<{ migrating?: boolean }>) : null),
      () => null,
    );
    migrating ||= health?.migrating === true;
    if (health && !health.migrating) break;
    if (Date.now() > end || server.exitCode !== null) throw new Error("the server didn't start");
  }
  return {
    client: createClient<typeof Registry>({ endpoint: `${origin}/api/rivet` }),
    migrating,
    async stop() {
      server.kill("SIGTERM");
      await server.exited;
      await stopEngine(engine);
    },
  };
}

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
  players: string[];
  match: { moves: { n: number }[] };
  world: string;
}

/** `migrate-store.ts` on `storage`: what it holds, read by queries of its own. */
async function store(kit: "v2" | "v3", storage: string, port: number, write = false): Promise<Store> {
  const script = Bun.spawn(
    ["bun", join(import.meta.dir, "migrate-store.ts"), kit, String(port), ...(write ? ["write"] : [])],
    { env: { ...process.env, RIVETKIT_STORAGE_PATH: storage, RIVET_LOG_LEVEL: "error" }, stderr: "ignore" },
  );
  const out = await new Response(script.stdout).text();
  expect(await script.exited).toBe(0);
  return (JSON.parse(out.split("\n").find((l) => l.startsWith('{"store"'))!) as { store: Store }).store;
}

test("every value an actor can keep arrives as it was", async () => {
  const storage = scratch();
  const engine = enginePort();
  const before = await store("v2", storage, engine, true);
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
  expect(before.players[0]).toContain("never: Infinity");
  expect(before.players[0]).toContain("missing: undefined");

  // Three actors at a time: the old engine's list is read over several pages.
  const moved = await migrateFromV2(storage, engine, 3);
  expect(moved).toMatchObject({ actors: 9, rows: 15 + 1000 + 3000 + 1 + 1 });
  expect(await store("v3", storage, engine)).toEqual(before);
  // Nothing is moved twice.
  expect(await migrateFromV2(storage, engine)).toBeNull();
}, 180_000);

test("a move that fails leaves no half-made town, and the next start begins again", async () => {
  const storage = scratch();
  const engine = enginePort();
  await store("v2", storage, engine, true);
  // The export can't start: its engine's port is taken.
  const squatter = Bun.listen({ hostname: "127.0.0.1", port: engine + 20, socket: { data() {} } });
  await expect(migrateFromV2(storage, engine)).rejects.toThrow();
  squatter.stop(true);
  expect(existsSync(join(storage, ".rivetkit/var/engine/depot"))).toBe(false);
  expect(pending(storage)).toBe(true);
  expect(await migrateFromV2(storage, engine)).toMatchObject({ actors: 9 });
}, 180_000);

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
