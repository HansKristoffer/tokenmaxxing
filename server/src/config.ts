export interface Config {
  port: number;
  host: string;
  version: string;
  development: boolean;
}

/** Parsed once at boot; a bad value fails fast instead of surfacing mid-request. */
export function loadConfig(env: Record<string, string | undefined>, version: string): Config {
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid PORT: ${env.PORT}`);
  return Object.freeze({
    port,
    host: env.TOKENMAXXING_HOST ?? "0.0.0.0",
    version,
    development: env.NODE_ENV !== "production",
  });
}
