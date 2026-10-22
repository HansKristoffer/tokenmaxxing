import { homedir } from "node:os";
import path from "node:path";

/**
 * Where the app, the helper and the CLI keep their files on each OS. Every function takes the platform,
 * environment and home directory so the tests can ask about all three from any machine.
 *
 *   macOS    ~/Library/Application Support/Tokenmaxxing, ~/Library/Logs/Tokenmaxxing (unchanged since the
 *            Swift app, so upgrades keep their state)
 *   Windows  %APPDATA%\Tokenmaxxing, %LOCALAPPDATA%\Tokenmaxxing\Logs
 *   Linux    $XDG_STATE_HOME/tokenmaxxing (~/.local/state), with the logs in its `logs` directory
 *
 * The Rust side (`paths.rs`) computes the same directories.
 */

export interface Where {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
}

const resolve = (where: Where) => {
  const platform = where.platform ?? process.platform;
  const env = where.env ?? process.env;
  const home = where.home ?? homedir();
  const p = platform === "win32" ? path.win32 : path.posix;
  return { platform, env, home, join: p.join };
};

type Resolved = ReturnType<typeof resolve>;

/** `$XDG_CONFIG_HOME`, or `~/.config` without one. */
export const configHome = (where: Where = {}): string => {
  const { env, home, join } = resolve(where);
  return env.XDG_CONFIG_HOME || join(home, ".config");
};

/** `$XDG_STATE_HOME`, or `~/.local/state` without one. */
export const stateHome = (where: Where = {}): string => {
  const { env, home, join } = resolve(where);
  return env.XDG_STATE_HOME || join(home, ".local", "state");
};

/** %APPDATA% (roaming), or where Windows puts it without the variable. */
const roaming = ({ env, home, join }: Resolved) => env.APPDATA || join(home, "AppData", "Roaming");

/** %LOCALAPPDATA%, or where Windows puts it without the variable. */
const local = ({ env, home, join }: Resolved) => env.LOCALAPPDATA || join(home, "AppData", "Local");

/** The desktop app's sync state (and the token file, where there's no keychain to hold it). */
export function appStateDir(where: Where = {}): string {
  const r = resolve(where);
  if (r.platform === "darwin") return r.join(r.home, "Library", "Application Support", "Tokenmaxxing");
  if (r.platform === "win32") return r.join(roaming(r), "Tokenmaxxing");
  return r.join(stateHome(where), "tokenmaxxing");
}

/** The helper's and the CLI service's logs. */
export function logDir(where: Where = {}): string {
  const r = resolve(where);
  if (r.platform === "darwin") return r.join(r.home, "Library", "Logs", "Tokenmaxxing");
  if (r.platform === "win32") return r.join(local(r), "Tokenmaxxing", "Logs");
  return r.join(stateHome(where), "tokenmaxxing", "logs");
}

/** The CLI's token and read positions, unless `TOKENMAXXING_CLI_DIR` says. */
export function cliConfigDir(where: Where = {}): string {
  const r = resolve(where);
  if (r.env.TOKENMAXXING_CLI_DIR) return r.env.TOKENMAXXING_CLI_DIR;
  if (r.platform === "darwin") return r.join(r.home, "Library", "Application Support", "Tokenmaxxing CLI");
  if (r.platform === "win32") return r.join(roaming(r), "Tokenmaxxing CLI");
  return r.join(configHome(where), "tokenmaxxing");
}
