import { describe, expect, test } from "bun:test";
import { createClient } from "rivetkit/client";
import type { registry as Registry } from "../src/actors/registry.ts";
import { origin, signUp } from "./rivet.ts";

// Browsers and the app reach the server by its public name, so RivetKit's client doesn't add the
// engine's token the way it does for localhost. `token: ""` makes this client do the same.
const remote = createClient<typeof Registry>({ endpoint: `${origin}/api/rivet`, token: "" });

describe("the gateway, as a remote client reaches it", () => {
  test("HTTP actions get past the engine to our actors", async () => {
    await expect(remote.town.getOrCreate(["main"]).me()).rejects.toThrow("Sign in from the menu bar app.");
    const user = await signUp("remote");
    const me = await remote.town.getOrCreate(["main"], { params: { token: user.token } }).me();
    expect(me.name).toBe(user.name);
  });

  test("WebSocket connections get through too", async () => {
    const user = await signUp("remotews");
    const conn = remote.world.getOrCreate(["main"], { params: { token: user.token } }).connect();
    const snapshot = await conn.join();
    expect(snapshot.selfId).toBe(user.userId);
    await conn.dispose();
  });
});
