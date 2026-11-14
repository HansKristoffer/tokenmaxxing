// bun run qa:serve [--fresh] : starts this checkout's game server for the QA scripts, in the background, and
// prints its origin (stdout: the origin alone). Run it again after every change to `web/` or `server/`: the
// game is bundled when the server starts, so it stops the one it started before and starts the new code on the
// same port and data. `--fresh` empties the data first. `bun run qa:stop` stops it.
//
// The port is free and this checkout's own (kept in `.data/qa/server.json`, which `scripts/qa/lib.mjs` reads),
// so worktrees never share a server. The environment is passed through, on top of quiet defaults: no outside
// feeds, clear weather, an open raid, shops that sell from anywhere and an admin token.
import { spawn } from "node:child_process";
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { MARK, ROOT, readState, STATE_DIR, STATE_FILE } from "./server.mjs";
import { stopServer } from "./stop.mjs";

const fresh = process.argv.includes("--fresh");
const host = process.env.TOKENMAXXING_HOST ?? "127.0.0.1";
const storage = join(STATE_DIR, "rivet");
const log = join(STATE_DIR, "server.log");

const canListen = (port) =>
  new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, host, () => probe.close(() => resolve(true)));
  });
const allFree = async (port, offsets) => {
  for (const o of offsets) if (!(await canListen(port + o))) return false;
  return true;
};
/** The first port from `from` on that is free, with each `port + offset` free too. */
const freeFrom = async (from, offsets = [0]) => {
  for (let port = from; ; port++) if (await allFree(port, offsets)) return port;
};

// A checkout starts looking at a port of its own (from its path), so it tends to keep one origin for life.
let hash = 0;
for (const ch of ROOT) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
const previous = readState();
await stopServer();
if (fresh) {
  rmSync(storage, { recursive: true, force: true });
  // The player `qa:modals` seeded lived in that data.
  rmSync(join(STATE_DIR, "hero.json"), { force: true });
}
mkdirSync(STATE_DIR, { recursive: true });

// This week's Monday (UTC): a raid that is open now.
const monday = new Date();
monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
const adminToken = process.env.ADMIN_TOKEN ?? previous?.adminToken ?? crypto.randomUUID().repeat(2);

let from = previous?.port ?? 4700 + (hash % 2000);
for (let attempt = 1; ; attempt++) {
  const port = await freeFrom(from);
  // RivetKit puts the engine's peer API on +1 and its metrics on +10.
  const enginePort = await freeFrom(port + 10_000, [0, 1, 10]);
  const out = openSync(log, "w");
  // From `server/` as `src/main.ts`: a `pkill -f server/src/main.ts` in another checkout misses it.
  const server = spawn("bun", ["src/main.ts", MARK], {
    cwd: join(ROOT, "server"),
    env: {
      RIVET_LOG_LEVEL: "error",
      RIVET__GUARD__TCP_NODELAY: "true",
      GATEWAY_REQUESTS_PER_MIN: "1000000",
      GATEWAY_SOCKETS_PER_MIN: "1000000",
      GRID_FEED: "off",
      STATUE_FEED: "off",
      LAUNCH_FEED: "off",
      PICNIC_OUTAGE: "off",
      GITHUB_STARS: "480",
      SKY_WEATHER: "clear",
      RAID_START_WEEK: monday.toISOString().slice(0, 10),
      SHOPS_ANYWHERE: "1",
      MARKET_ANY_AGE: "1",
      FIRECRAWL_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      ...process.env,
      PORT: String(port),
      TOKENMAXXING_HOST: host,
      RIVET_RUN_ENGINE_PORT: String(enginePort),
      RIVETKIT_STORAGE_PATH: storage,
      ADMIN_TOKEN: adminToken,
    },
    stdio: ["ignore", out, out],
    detached: true,
  });
  server.unref();
  const origin = `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`;
  const state = { pid: server.pid, port, enginePort, origin, adminToken, storage, log };
  writeFileSync(
    STATE_FILE,
    `${JSON.stringify({ ...state, startedAt: new Date().toISOString() }, null, 2)}\n`,
  );

  let up = false;
  for (const end = Date.now() + 120_000; Date.now() < end && server.exitCode === null; await Bun.sleep(200)) {
    up = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(5_000) }).then(
      (r) => r.ok,
      () => false,
    );
    if (up) break;
  }
  // Answering is not enough: another server may have taken the port first. Ours must still be running.
  if (up && server.exitCode === null) {
    console.error(`[qa] pid ${server.pid}, log ${log}, admin token in ${STATE_FILE}`);
    console.log(origin);
    process.exit(0);
  }
  await stopServer();
  const why = readFileSync(log, "utf8").trim().split("\n").slice(-15).join("\n");
  // Taken between the check and the server's own listen (two checkouts starting at once): the next one.
  if (attempt < 5 && /EADDRINUSE|address already in use/i.test(why)) {
    from = port + 1;
    continue;
  }
  console.error(`[qa] the server did not start:\n${why}`);
  process.exit(1);
}
