import { expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { outsideDoor, route } from "@tokenmaxxing/core/world.ts";
import { signUp } from "./rivet.ts";
import { connect, step, walk } from "./world-client.ts";

test("pond casts require the bank; early reels, movement and duplicate claims do not award fish", async () => {
  const a = await signUp("angler");
  const v = await connect(a.token);
  try {
    expect((await v.conn.fishingCast("right")).ok).toBe(false);
    await expect(a.town.recordFish(a.userId, { fish: "golden", cm: 40 })).rejects.toThrow();
    const me = v.snap.players.find((p) => p.id === a.userId)!;
    await walk(v.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    const door = outsideDoor("inn");
    await walk(v.conn, route(MAPS.town, [door.x, door.y], [2, 12])!);
    expect((await v.conn.fishingCast("left")).ok).toBe(false);
    expect((await v.conn.fishingCast("nope")).ok).toBe(false);
    const first = await v.conn.fishingCast("right");
    expect(first.ok).toBe(true);
    expect(await v.conn.fishingReel()).toMatchObject({
      ok: false,
      message: "Too soon! Wait for the bobber to dip.",
    });
    expect(await a.town.fishingJournal()).toEqual([]);
    await Bun.sleep(1550);
    const cast = await v.conn.fishingCast("right");
    if (!cast.ok) throw Error(cast.message);
    // Repeated casts keep their original bite rather than rerolling the wait.
    expect(await v.conn.fishingCast("right")).toMatchObject({ ok: true, cast: cast.cast });
    await Bun.sleep(Math.max(0, cast.cast.biteAt - Date.now()) + 100);
    const replies = await Promise.all([v.conn.fishingReel(), v.conn.fishingReel()]);
    expect(replies.filter((r) => r.ok)).toHaveLength(1);
    const journal = await a.town.fishingJournal();
    expect(journal.reduce((n, e) => n + e.count, 0)).toBe(1);
    // A later cast is cancelled when the player walks along the bank.
    const next = await v.conn.fishingCast("right");
    expect(next.ok).toBe(true);
    await step(v.conn, "up");
    expect((await v.conn.fishingReel()).ok).toBe(false);
    expect(await a.town.fishingJournal()).toEqual(journal);
  } finally {
    await v.conn.dispose();
  }
}, 60_000);
