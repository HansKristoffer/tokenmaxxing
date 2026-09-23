import { join } from "node:path";

export interface Config {
  port: number;
  host: string;
  dbPath: string;
  version: string;
  /** Off only for plain-HTTP local dev. */
  secureCookies: boolean;
  development: boolean;
}

/** Parsed once at boot; a bad value fails fast instead of surfacing mid-request. */
export function loadConfig(env: Record<string, string | undefined>, version: string): Config {
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid PORT: ${env.PORT}`);
  const development = env.NODE_ENV !== "production";
  const dataDir = env.TOKENMAXXING_DATA_DIR ?? (development ? join(process.cwd(), ".data") : "/data");
  return Object.freeze({
    port,
    host: env.TOKENMAXXING_HOST ?? "0.0.0.0",
    dbPath: env.TOKENMAXXING_DB ?? join(dataDir, "tokenmaxxing.sqlite"),
    version,
    secureCookies: !development,
    development,
  });
}
