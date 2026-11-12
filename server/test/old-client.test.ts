import { expect, test } from "bun:test";
import type { Client } from "rivetkit/client";
import { createClient } from "rivetkit-v2/client";
import type { registry as Registry } from "../src/actors/registry.ts";
import { event, eventually, origin } from "./rivet.ts";

/**
 * The desktop app carries its own RivetKit client, and a tab stays open across a deploy: for a while after
 * the server moves to RivetKit 3, RivetKit 2 clients are who it talks to. (`rivetkit-v2` is here for the
 * migration; this test goes when it does, by which time the apps have updated.)
 */
test("a RivetKit 2 client signs up, syncs, joins the world and hears it, against this server", async () => {
  // Typed as today's client: the two RivetKits' registry types don't meet, the actions are the same.
  const old = createClient({ endpoint: `${origin}/api/rivet` }) as unknown as Client<typeof Registry>;
  const me = await old.town.getOrCreate(["main"]).signUp(`old${Date.now().toString(36)}`);
  const params = { token: me.token };
  expect((await old.town.getOrCreate(["main"], { params }).me()).name).toBe(me.name);

  // The app's sync, and its live connection.
  const player = old.player.get([String(me.userId)], { params });
  expect(await player.ingest([event()])).toMatchObject({ inserted: 1 });
  const app = player.connect();
  expect(await app.devices()).toHaveLength(1);

  // The game: a snapshot, then its own steps back as `moves`, as text.
  const world = old.world.getOrCreate(["main"], { params }).connect();
  const heard: unknown[] = [];
  world.on("moves", (m: unknown) => heard.push(m));
  const snap = await world.join(1);
  expect(snap.selfId).toBe(me.userId);
  await world.turn("left");
  await eventually(() => expect(heard.some((m) => typeof m === "string")).toBe(true));

  // A refusal arrives as the error the game shows.
  await expect(old.town.getOrCreate(["main"], { params }).buy("no.such.item")).rejects.toMatchObject({
    code: "not_found",
  });
  await world.dispose();
  await app.dispose();
});
