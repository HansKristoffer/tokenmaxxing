export interface Config {
  port: number;
  host: string;
  version: string;
  development: boolean;
  /** Per client IP, at the gateway (`proxy.ts`). */
  gateway: { ipHeader: string; requestsPerMin: number; socketsPerMin: number };
}

function positiveInt(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const n = Number(env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`invalid ${name}: ${env[name]}`);
  return n;
}

/** Parsed once at boot; a bad value fails fast instead of surfacing mid-request. */
export function loadConfig(env: Record<string, string | undefined>, version: string): Config {
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid PORT: ${env.PORT}`);
  // It opens every account to whoever has it, so no short ones.
  if (env.ADMIN_TOKEN && env.ADMIN_TOKEN.length < 32)
    throw new Error("ADMIN_TOKEN is too short: use at least 32 characters (openssl rand -hex 32)");
  return Object.freeze({
    port,
    host: env.TOKENMAXXING_HOST ?? "0.0.0.0",
    version,
    development: env.NODE_ENV !== "production",
    gateway: Object.freeze({
      // Railway's edge sets it to the client's address.
      ipHeader: (env.CLIENT_IP_HEADER ?? "x-real-ip").toLowerCase(),
      requestsPerMin: positiveInt(env, "GATEWAY_REQUESTS_PER_MIN", 1200),
      socketsPerMin: positiveInt(env, "GATEWAY_SOCKETS_PER_MIN", 300),
    }),
  });
}
