/**
 * A server of its own for a test that has to stop and start it, on a store the test chooses: the real
 * `main.ts` in a subprocess, with its engine. (`rivet.ts` is the one server every other test shares.)
 */
import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "rivetkit/client";
import type { registry as Registry } from "../src/actors/registry.ts";
import { stopEngine } from "../src/engine.ts";

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
export function enginePort(): number {
  for (;;) {
    const port = 10_000 + Math.floor(Math.random() * 20_000);
    if ([0, 1, 10, 20, 21, 30].every((o) => canListen(port + o))) {
      ports.push(port, port + 20);
      return port;
    }
  }
}
export function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "tokenmaxxing-migrate-"));
  dirs.push(dir);
  return join(dir, "rivet");
}

/** The real server on `storage`; `stop` ends it as a deploy would, `crash` as a machine that lost power. */
export async function serve(storage: string, engine: number) {
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
    async crash() {
      server.kill("SIGKILL");
      await server.exited;
      await stopEngine(engine, 0);
    },
  };
}
