import type { AppType } from "@tokenmaxxing/server/app";
import { DetailedError, hc, type InferResponseType } from "hono/client";

export { parseResponse } from "hono/client";

/** Same-origin client; the session cookie set by /login authenticates it. */
export const client = hc<AppType>("/");

export type Me = InferResponseType<typeof client.api.me.$get, 200>;
export type Leaderboard = InferResponseType<typeof client.api.leaderboard.$get, 200>;
export type Entry = Leaderboard["entries"][number];
export type UserDetail = InferResponseType<(typeof client.api.users)[":name"]["$get"], 200>;

export const isUnauthorized = (err: unknown): boolean =>
  err instanceof DetailedError && err.statusCode === 401;
