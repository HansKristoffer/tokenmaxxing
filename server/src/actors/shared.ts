import { UserError } from "rivetkit";
import type { Client } from "rivetkit/client";
import { randomToken, sha256 } from "../crypto.ts";
import { PricingCache } from "../pricing.ts";
import type { registry } from "./registry.ts";

/**
 * Actors call each other with this in their connection params. Every actor runs
 * in this process, so a key made at boot never leaves it.
 */
export const INTERNAL_KEY = randomToken();
export const internal = { params: { internal: INTERNAL_KEY } };

/** The `main` actors, as another actor calls them. */
export const main = (client: Client<typeof registry>) => ({
  town: client.town.getOrCreate(["main"], internal),
  world: client.world.getOrCreate(["main"], internal),
  arcade: client.arcade.getOrCreate(["main"], internal),
});

/** One match, as another actor calls it. */
export const matchOf = (client: Client<typeof registry>, id: number) =>
  client.match.get([String(id)], internal);

/** One cache for every actor; `main.ts` refreshes it daily. */
export const pricing = new PricingCache();

export interface ConnParams {
  token?: string;
  internal?: string;
}

/** Who is calling: a player (device app or browser session), another actor, or nobody yet. */
export type Caller =
  | { kind: "internal" }
  | { kind: "user"; userId: number; via: "device" | "session" }
  | { kind: "anonymous" };

/** Tokens are `<userId>.<secret>`; the player actor stores sha256(secret). */
export function splitToken(token: unknown): { userId: number; secret: string } | null {
  if (typeof token !== "string") return null;
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{16,128})$/.exec(token);
  return m ? { userId: Number(m[1]), secret: m[2]! } : null;
}

export const makeToken = (userId: number) => {
  const secret = randomToken();
  return { token: `${userId}.${secret}`, hash: sha256(secret) };
};

export const unauthorized = () => new UserError("Sign in from the menu bar app.", { code: "unauthorized" });

const TOKEN_CACHE_MS = 60_000;
const TOKEN_CACHE_MAX = 10_000;
export type TokenCache = Map<string, { caller: Caller; until: number }>;

/**
 * Connection auth for actors other than `player`: internal callers by key,
 * users by asking their `player` actor (cached for a minute), anonymous otherwise.
 */
export async function authenticate(
  params: ConnParams | undefined,
  client: Client<typeof registry>,
  cache: TokenCache,
): Promise<Caller> {
  if (params?.internal === INTERNAL_KEY) return { kind: "internal" };
  if (params?.token === undefined) return { kind: "anonymous" };
  const now = Date.now();
  const hit = cache.get(params.token);
  if (hit && hit.until > now) return hit.caller;
  const t = splitToken(params.token);
  const via = t
    ? await client.player
        .get([String(t.userId)], internal)
        .verify(t.secret)
        .catch(() => null)
    : null;
  if (!t || !via) throw unauthorized();
  const caller: Caller = { kind: "user", userId: t.userId, via };
  if (cache.size > TOKEN_CACHE_MAX) cache.clear();
  cache.set(params.token, { caller, until: now + TOKEN_CACHE_MS });
  return caller;
}

export function requireUser(caller: Caller): number {
  if (caller.kind !== "user") throw unauthorized();
  return caller.userId;
}

export function requireInternal(caller: Caller): void {
  if (caller.kind !== "internal") throw new UserError("Not allowed.", { code: "forbidden" });
}

/** Runs `fn` after every earlier call on the same chain: SQLite work that must not interleave. */
export function serial() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

/** The part of `c.db` the helpers need, so they can live outside an actor definition. */
export interface Sql {
  execute(sql: string, ...args: unknown[]): Promise<unknown[]>;
}

export const all = <T>(sql: Sql, query: string, ...args: unknown[]): Promise<T[]> =>
  sql.execute(query, ...args) as Promise<T[]>;

export const one = async <T>(sql: Sql, query: string, ...args: unknown[]): Promise<T | undefined> =>
  (await all<T>(sql, query, ...args))[0];
