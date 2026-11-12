import { readdirSync, readFileSync } from "node:fs";

/** Sends `signal` to `pid`; false if it's gone. Signal 0 only asks whether it's there. */
const send = (pid: number, signal: NodeJS.Signals | 0) => {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
};

/** What a command printed, or nothing if this machine doesn't have it. */
const output = (cmd: string[]): string => {
  try {
    return Bun.spawnSync(cmd).stdout.toString();
  } catch {
    return "";
  }
};

interface Engine {
  pid: number;
  parent: number;
  /** The port its gateway listens on, where that can be read. */
  port: number | null;
}

/** Every engine process on this machine. From `/proc` on Linux: the server image has neither `ps` nor `lsof`. */
function engines(): Engine[] {
  if (process.platform !== "linux")
    return output(["ps", "-A", "-o", "pid=,ppid=,command="])
      .split("\n")
      .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
      .filter((m): m is RegExpMatchArray => !!m && m[3]!.includes("rivet-engine"))
      .map((m) => ({ pid: Number(m[1]), parent: Number(m[2]), port: null }));
  const found: Engine[] = [];
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      if (!readFileSync(`/proc/${entry}/cmdline`, "utf8").includes("rivet-engine")) continue;
      // After the command (which may hold spaces): state, then the parent's pid.
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const parent = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      const port = /(?:^|\0)RIVET__GUARD__PORT=(\d+)\0/.exec(readFileSync(`/proc/${entry}/environ`, "utf8"));
      found.push({ pid: Number(entry), parent, port: port ? Number(port[1]) : null });
    } catch {} // gone, or someone else's
  }
  return found;
}

/**
 * RivetKit starts the engine as a child in its own process group, so it doesn't die with this
 * process: it would be left running (and holding its port and data dir) after an exit. Only engines
 * that are direct children of this process, or that listen on `port`, are touched.
 */
export function engineChildren(port?: number): number[] {
  const all = engines();
  const pids = all.filter((e) => e.parent === process.pid).map((e) => e.pid);
  // An engine left by a server that was SIGKILLed is no child of ours, but a restart reuses it:
  // the one listening on our engine port.
  if (port) {
    const listening =
      process.platform === "linux"
        ? all.filter((e) => e.port === port).map((e) => e.pid)
        : output(["lsof", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"])
            .split("\n")
            .map(Number)
            .filter((pid) => all.some((e) => e.pid === pid));
    for (const pid of listening) if (!pids.includes(pid)) pids.push(pid);
  }
  return pids;
}

/** SIGTERM the engine, SIGKILL whatever is still there after `graceMs`. */
export async function stopEngine(port?: number, graceMs = 3_000) {
  const pids = engineChildren(port);
  for (const pid of pids) send(pid, "SIGTERM");
  for (const end = Date.now() + graceMs; Date.now() < end && pids.some((p) => send(p, 0));)
    await Bun.sleep(50);
  for (const pid of pids) if (send(pid, 0)) send(pid, "SIGKILL");
}
