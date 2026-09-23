import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The cask in the tap is what `brew upgrade` installs, so it is the source of
 * truth: a GitHub release exists a few minutes before its cask is published.
 */
export const CASK_URL =
  "https://raw.githubusercontent.com/HansKristoffer/homebrew-tap/main/Casks/tokenmaxxing.rb";
export const RELEASES_URL = "https://github.com/HansKristoffer/tokenmaxxing/releases/latest";
export const UPDATE_CHECK_INTERVAL_MS = 6 * 3_600_000;

const BREW_PATHS = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
const CASKROOMS = ["/opt/homebrew/Caskroom/tokenmaxxing", "/usr/local/Caskroom/tokenmaxxing"];

export function parseCaskVersion(cask: string): string | null {
  return /^\s*version\s+"([^"]+)"/m.exec(cask)?.[1] ?? null;
}

/** True when `a` is a higher x.y.z version than `b`. Non-numeric parts count as 0. */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** The newer published version, or null. Network errors mean "no update known". */
export async function checkForUpdate(
  current: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(CASK_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const latest = parseCaskVersion(await res.text());
    return latest && isNewer(latest, current) ? latest : null;
  } catch {
    return null;
  }
}

/** Where brew lives, if this copy was installed with Homebrew. */
export function brewPath(): string | null {
  if (!CASKROOMS.some((p) => existsSync(p))) return null;
  return BREW_PATHS.find((p) => existsSync(p)) ?? null;
}

/** The .app this helper runs inside (…/Tokenmaxxing.app/Contents/Helpers/tokenmaxxing-helper). */
export function appBundlePath(execPath = process.execPath): string {
  const i = execPath.indexOf(".app/Contents/");
  return i >= 0 ? execPath.slice(0, i + 4) : "/Applications/Tokenmaxxing.app";
}

/**
 * Runs `brew upgrade` detached from the app: the cask quits the running app
 * mid-upgrade, which also ends this helper, so the upgrade must outlive both.
 * The new version is relaunched when it finishes.
 */
export function startBrewUpgrade(brew: string): void {
  const logDir = join(homedir(), "Library", "Logs", "Tokenmaxxing");
  mkdirSync(logDir, { recursive: true });
  const log = openSync(join(logDir, "update.log"), "a");
  // Relaunch this exact bundle by path; `open -a` could pick a dev build with the same name.
  const script = `"${brew}" update --quiet && "${brew}" upgrade --cask hanskristoffer/tap/tokenmaxxing; open "${appBundlePath()}"`;
  const child = spawn("/bin/sh", ["-c", script], {
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, HOMEBREW_NO_ENV_HINTS: "1", PATH: `${brew.replace(/\/brew$/, "")}:/usr/bin:/bin` },
  });
  child.unref();
}
