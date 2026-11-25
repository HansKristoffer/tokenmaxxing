/**
 * The production entry point (Dockerfile): starts the Rivet engine itself, then `main.ts`, and
 * starts `main.ts` again when it exits while the engine is still up.
 *
 * Why: RivetKit 3.1.1 gives its envoy 30 s to be answered by the engine (`ENVOY_START_TIMEOUT`, not
 * configurable), and on Railway a cold engine took longer than that on 2026-11-25: every start
 * failed with "serverful envoy startup timed out". When RivetKit spawns the engine, it stops it on
 * that failure (and the engine dies with its parent), so each retry started cold again and the
 * container crash-looped for hours. An engine RivetKit finds already listening on its port is reused
 * and never stopped, so here the engine outlives a failed start of `main.ts` and the next attempt
 * meets a warm one.
 *
 * The engine's environment and config mirror what RivetKit 3.1.1 passes when it spawns it
 * (`engine_env` and `write_engine_config` in rivetkit-rust/packages/engine-process): check them on
 * every RivetKit upgrade. The engine's output goes to this process's, so it shows in Railway's logs.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// As in actors/registry.ts, which this doesn't import: that would load RivetKit and every actor here.
const ENGINE_PORT = Number(process.env.RIVET_RUN_ENGINE_PORT ?? 6420);
const ENGINE_TOKEN = "default";
/** Failed starts in a row before giving up and letting Railway restart the container. */
const MAX_ATTEMPTS = 10;

const storage = process.env.RIVETKIT_STORAGE_PATH;
if (!storage) throw new Error("set RIVETKIT_STORAGE_PATH to the data volume");

const root = join(storage, ".rivetkit");
const engineDir = join(root, "var/engine");
const depot = join(engineDir, "depot");
const endpoint = `http://127.0.0.1:${ENGINE_PORT}`;
const log = (msg: string) => console.log(`[start] ${msg}`);

/** The engine binary RivetKit would run: `@rivetkit/engine-cli` resolves the platform package. */
async function enginePath(): Promise<string> {
  const rivetkit = Bun.resolveSync("rivetkit", import.meta.dir);
  const cli = await import(Bun.resolveSync("@rivetkit/engine-cli", dirname(rivetkit)));
  return cli.getEnginePath();
}

function startEngine(binary: string) {
  mkdirSync(join(depot, "log"), { recursive: true });
  const config = join(engineDir, "config.json");
  // The topology, which the engine can't take from its environment.
  const topology = {
    topology: {
      datacenter_label: 1,
      datacenters: {
        default: {
          datacenter_label: 1,
          is_leader: true,
          public_url: `${endpoint}/`,
          peer_url: `http://127.0.0.1:${ENGINE_PORT + 1}`,
        },
      },
    },
  };
  writeFileSync(config, JSON.stringify(topology, null, 2));

  return Bun.spawn([binary, "--config", config], {
    env: {
      ...process.env,
      RIVET__AUTH__ADMIN_TOKEN: ENGINE_TOKEN,
      RIVET__GUARD__HOST: "127.0.0.1",
      RIVET__GUARD__PORT: String(ENGINE_PORT),
      RIVET__API_PEER__HOST: "127.0.0.1",
      RIVET__API_PEER__PORT: String(ENGINE_PORT + 1),
      RIVET__METRICS__HOST: "127.0.0.1",
      RIVET__METRICS__PORT: String(ENGINE_PORT + 10),
      RIVET__STORAGE__LOG_DIRECTORY: join(depot, "log"),
      RIVET__OBJECT_STORAGE__PRIMARY__FILE_SYSTEM__PATH: join(depot, "objects"),
      RIVET__STORAGE__BALANCING__ENABLED: "false",
      RIVET__STORAGE__AUTO_PROVISION_PARTITIONS: "1",
      RIVET__STORAGE__LOG_SHARD__MAX_DISK_BYTES: String(4 * 1024 ** 3),
      RIVET__STORAGE__COLD_STORE__DISK_CACHE_BYTES: "0",
      RIVET__STORAGE__WRITE_TO_COLD_AFTER_MS: "5000",
      RIVET__STORAGE__STOP_TIMEOUT_MS: "6000",
      RIVET__STORAGE__STOP_TEARDOWN_MS: "2000",
      RIVET__PEGBOARD__NODE_LOST_THRESHOLD: "7000",
      RIVET__RUNTIME__WORKER_SHUTDOWN_DURATION: "1",
      RIVET__RUNTIME__GUARD_SHUTDOWN_DURATION: "1",
      RIVET__RUNTIME__FORCE_SHUTDOWN_DURATION: "10",
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
}

/** Polls `url` until it answers 2xx; false if `alive` turns false first. */
async function waitFor(url: string, alive: () => boolean, headers: Record<string, string> = {}) {
  while (alive()) {
    const ok = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) }).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return true;
    await Bun.sleep(250);
  }
  return false;
}

let stopping = false;
let server: Bun.Subprocess | null = null;

const binary = await enginePath();
const started = performance.now();
const engine = startEngine(binary);
let engineUp = true;
void engine.exited.then((code) => {
  engineUp = false;
  if (stopping) return;
  // main.ts's watchdog stops the engine when it hangs; either way, Railway restarts the container.
  console.error(`[start] engine exited with ${code}, exiting`);
  server?.kill("SIGTERM");
  setTimeout(() => process.exit(1), 8_000);
  void server?.exited.finally(() => process.exit(1));
  if (!server) process.exit(1);
});

const seconds = () => ((performance.now() - started) / 1000).toFixed(1);
if (!(await waitFor(`${endpoint}/health`, () => engineUp))) process.exit(1);
log(`engine healthy after ${seconds()} s`);
// The probe RivetKit runs before it connects: the engine answers actor lookups.
const probe = `${endpoint}/actors?namespace=default&name=rivetkit-readiness-probe&key=probe`;
if (!(await waitFor(probe, () => engineUp, { authorization: `Bearer ${ENGINE_TOKEN}` }))) process.exit(1);
log(`engine ready after ${seconds()} s`);

async function shutdown(signal: NodeJS.Signals, code = 0) {
  if (stopping) return;
  stopping = true;
  // main.ts drains its actors and stops the engine on SIGTERM; this stops it if main.ts didn't.
  server?.kill(signal);
  await Promise.race([server?.exited, Bun.sleep(10_000)]);
  if (engineUp) engine.kill("SIGTERM");
  await Promise.race([engine.exited, Bun.sleep(15_000)]);
  if (engineUp) engine.kill("SIGKILL");
  process.exit(code);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

const main = join(import.meta.dir, "main.ts");
for (let attempt = 1; !stopping && engineUp; attempt++) {
  const at = performance.now();
  server = Bun.spawn([process.execPath, main], { stdio: ["ignore", "inherit", "inherit"] });
  const code = await server.exited;
  if (stopping || !engineUp) break;
  // A server that ran a while and then crashed starts over with a fresh count.
  if (performance.now() - at > 10 * 60_000) attempt = 1;
  if (attempt >= MAX_ATTEMPTS) {
    console.error(`[start] server exited with ${code}, ${attempt} times in a row: giving up`);
    await shutdown("SIGTERM", 1);
  }
  console.error(
    `[start] server exited with ${code} (attempt ${attempt}); starting it again on the running engine`,
  );
  await Bun.sleep(Math.min(attempt, 5) * 1_000);
}
