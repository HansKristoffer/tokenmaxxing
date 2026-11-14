// bun run qa:stop : stops this checkout's QA server (`bun run qa:serve`) and its Rivet engine, and nothing
// else: the pid comes from `.data/qa/server.json` and is checked to be this checkout's server. Its data stays.
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { isOurs, readState, STATE_FILE } from "./server.mjs";

/**
 * The engines RivetKit started on `storage`. Found by their data dir, never by port: after a crash the pid
 * file is stale, and by then its engine port may be another checkout's.
 */
function enginesOn(storage) {
  const pids = [];
  if (process.platform === "linux") {
    for (const pid of readdirSync("/proc")) {
      if (!/^\d+$/.test(pid)) continue;
      try {
        const env = `\0${readFileSync(`/proc/${pid}/environ`, "utf8")}`;
        if (
          env.includes(`\0RIVETKIT_STORAGE_PATH=${storage}\0`) &&
          readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("rivet-engine")
        )
          pids.push(Number(pid));
      } catch {} // gone, or someone else's
    }
    return pids;
  }
  // Elsewhere (macOS): `ps e` prints the environment after the command.
  const ps = Bun.spawnSync(["ps", "eww", "-A", "-o", "pid=,command="]).stdout.toString();
  for (const line of ps.split("\n"))
    if (line.includes("rivet-engine") && line.includes(`RIVETKIT_STORAGE_PATH=${storage} `))
      pids.push(Number(line.trim().split(/\s+/)[0]));
  return pids;
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Stops the server `qa:serve` started here, if it is still running. Returns its state, or null. */
export async function stopServer() {
  const state = readState();
  if (!state) return null;
  const wasRunning = isOurs(state.pid);
  if (wasRunning) {
    // SIGTERM is the server's clean way out: it drains the actors and stops its engine (8 s at most).
    process.kill(state.pid, "SIGTERM");
    for (const end = Date.now() + 12_000; Date.now() < end && isOurs(state.pid);) await Bun.sleep(100);
    if (isOurs(state.pid)) process.kill(state.pid, "SIGKILL");
  }
  // The engine is its own process: one left behind (a killed server) keeps its port and the data dir.
  const engines = enginesOn(state.storage);
  for (const pid of engines) if (alive(pid)) process.kill(pid, "SIGTERM");
  for (const end = Date.now() + 3_000; Date.now() < end && engines.some(alive);) await Bun.sleep(50);
  for (const pid of engines) if (alive(pid)) process.kill(pid, "SIGKILL");
  rmSync(STATE_FILE, { force: true });
  return wasRunning ? state : null;
}

if (import.meta.main) {
  const state = await stopServer();
  console.log(state ? `stopped ${state.origin} (pid ${state.pid})` : "no QA server was running here");
}
