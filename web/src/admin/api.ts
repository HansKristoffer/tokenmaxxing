import type { registry } from "@tokenmaxxing/server/registry";
import { createClient } from "rivetkit/client";

const TOKEN_KEY = "tokenmaxxing.admin";

// Over a connection, like the game (see net.ts): Chrome won't stream request bodies over plain HTTP/1.
const client = createClient<typeof registry>({ endpoint: `${location.origin}/api/rivet`, devtools: false });

export type AdminConn = ReturnType<ReturnType<typeof client.town.getOrCreate>["connect"]>;

/**
 * `/admin#token=…` saves the token for next time and takes it out of the URL and history; a
 * fragment never reaches the server, so it can't end up in a log. `?token=` works too, but it
 * does reach the server. Otherwise it's the one saved before, if any.
 */
export function savedToken(): string | null {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const token = fragment.get("token") ?? url.searchParams.get("token");
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    url.searchParams.delete("token");
    history.replaceState(null, "", url.pathname + url.search);
  }
  return localStorage.getItem(TOKEN_KEY);
}

export const saveToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const forgetToken = () => localStorage.removeItem(TOKEN_KEY);

export const connectAdmin = (token: string): AdminConn =>
  client.town.getOrCreate(["main"], { params: { admin: token } }).connect();

export const isUnauthorized = (err: unknown) => {
  const code = (err as { code?: string } | null)?.code;
  return code === "unauthorized" || code === "forbidden";
};

export const errorText = (err: unknown): string =>
  (err as { message?: string } | null)?.message?.replace(/^.*?: /, "") ?? "Something went wrong.";
