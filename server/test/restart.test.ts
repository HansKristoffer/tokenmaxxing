/**
 * What the actors keep (`src/actors/kept.ts`) on the real server and engine: it is all in memory while
 * they run, so what is on disk shows only after a stop nobody saw coming.
 */
import { expect, test } from "bun:test";
import { MOVES_TEXT } from "@tokenmaxxing/core/world.ts";
import { enginePort, scratch, serve } from "./own-server.ts";

test("a crash loses nothing an action answered for, and at most a second of where people stood", async () => {
  const storage = scratch();
  const engine = enginePort();
  const first = await serve(storage, engine);
  const ada = await first.client.town.getOrCreate(["main"]).signUp("ada_restarts");
  const auth = { params: { token: ada.token } };

  // The world: a few steps from where she woke up.
  const world = first.client.world.getOrCreate(["main"], auth).connect();
  const woke = await world.join(MOVES_TEXT);
  const where = (snap: typeof woke) => {
    const me = snap.players.find((p) => p.id === ada.userId)!;
    return { room: snap.room, x: me.x, y: me.y };
  };
  let at = where(woke);
  for (const dir of ["down", "down", "right", "left", "up"] as const) {
    const moved = await world.step(dir);
    if (moved && "x" in moved) at = { room: moved.room, x: moved.x, y: moved.y };
  }
  expect(at).not.toEqual(where(woke));
  // The arcade: a table waiting for players.
  const table = (await first.client.arcade.getOrCreate(["main"], auth).open("spr", { stake: 0 })).me.table!;
  // The world saves once a second.
  await Bun.sleep(1_500);
  // Her player: a browser session, made the moment before.
  const player = first.client.player.get([String(ada.userId)], auth);
  const session = await first.client.player
    .get([String(ada.userId)])
    .redeemLoginCode(await player.mintLoginCode());
  await first.crash();

  const second = await serve(storage, engine);
  try {
    const browser = { params: { token: session } };
    expect((await second.client.town.getOrCreate(["main"], browser).me()).name).toBe("ada_restarts");
    expect(await second.client.player.get([String(ada.userId)], auth).devices()).toHaveLength(1);
    expect((await second.client.arcade.getOrCreate(["main"], browser).lobby()).me.table).toBe(table);
    const back = second.client.world.getOrCreate(["main"], browser).connect();
    expect(where(await back.join(MOVES_TEXT))).toEqual(at);
    // A deploy, the moment after a step: a stop the world hears of saves on its way out.
    let stepped = at;
    for (const dir of ["down", "left", "down", "right", "right"] as const) {
      const moved = await back.step(dir);
      if (moved && "x" in moved) stepped = { room: moved.room, x: moved.x, y: moved.y };
    }
    expect(stepped).not.toEqual(at);
    await second.stop();
    const third = await serve(storage, engine);
    try {
      const again = third.client.world.getOrCreate(["main"], browser).connect();
      expect(where(await again.join(MOVES_TEXT))).toEqual(stepped);
      await again.dispose();
    } finally {
      await third.stop();
    }
  } finally {
    await second.stop();
  }
}, 240_000);
