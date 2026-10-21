import { describe, expect, test } from "bun:test";
import { BOTS } from "@tokenmaxxing/core/bots.ts";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import {
  cupsLeft,
  outsideDoor,
  type PlayerInfo,
  type Raiders,
  roomEntry,
  route,
} from "@tokenmaxxing/core/world.ts";
import { admit, as, event, eventually, signUp } from "./rivet.ts";
import { connect, walk } from "./world-client.ts";

describe("world", () => {
  test("a new player rests at the Inn and wakes up there", async () => {
    const a = await signUp("w");
    const { conn, snap } = await connect(a.token);
    expect(snap.room).toBe("inn");
    const me = snap.players.find((p) => p.id === a.userId)!;
    expect(me.state).toBe("idle");
    expect(me.online).toBe(true);
    await conn.dispose();
  });

  test("offline sleepers at the Inn are a head count; waking up joins the room, falling asleep leaves it", async () => {
    const sleeper = await signUp("inn");
    const viewer = await signUp("inn");
    const v = await connect(viewer.token);
    expect(v.snap.room).toBe("inn");
    expect(v.snap.players.map((p) => p.id)).not.toContain(sleeper.userId);
    expect(v.snap.asleep).toBeGreaterThan(0);

    const s = await connect(sleeper.token);
    const awake = await eventually(() => {
      const joined = v.events.moves.find((m) => m.join.some((p) => p.id === sleeper.userId));
      expect(joined?.asleep).toBeNumber();
      return joined!.asleep!;
    });
    await s.conn.dispose();
    await eventually(() => {
      const left = v.events.moves.find((m) => m.leave.includes(sleeper.userId));
      expect(left?.asleep).toBe(awake + 1);
    });
    await v.conn.dispose();
  });

  test("walking out of the Inn lands in town, next to its door", async () => {
    const a = await signUp("w");
    const { conn, events, snap } = await connect(a.token);
    const me = snap.players.find((p) => p.id === a.userId)!;
    const path = route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!;
    const results = await walk(conn, path);
    expect(results.at(-1)).toEqual({ ...outsideDoor("inn"), state: "idle" });
    await eventually(() => expect(events.snapshots.at(-1)!.room).toBe("town"));
    await conn.dispose();
  });

  test("reloading puts you back where you were, not in bed", async () => {
    const a = await signUp("back");
    const first = await connect(a.token);
    const me = first.snap.players.find((p) => p.id === a.userId)!;
    await walk(first.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    await walk(first.conn, ["left", "left"]);
    await Bun.sleep(150);
    // Closing the tab sends them to bed at the Inn...
    await first.conn.dispose();
    await Bun.sleep(300);
    // ...and opening it again gets them up where they left off.
    const again = await connect(a.token);
    const door = outsideDoor("inn");
    expect(again.snap.room).toBe("town");
    const back = again.snap.players.find((p) => p.id === a.userId)!;
    expect([back.x, back.y, back.state]).toEqual([door.x - 2, door.y, "idle"]);
    await again.conn.dispose();
  });

  test("steps into walls are refused; teleport-speed steps are corrected", async () => {
    const a = await signUp("w");
    const { conn } = await connect(a.token);
    const burst = await Promise.all(Array.from({ length: 8 }, () => conn.step("left")));
    expect(burst.some((r) => r !== null)).toBe(true);
    await conn.dispose();
  });

  test("coffee makes you shake, and more cups make it last longer", async () => {
    const a = await signUp("coffee");
    const { conn, snap } = await connect(a.token);
    const infos: PlayerInfo[] = [];
    conn.on("info", (i: PlayerInfo) => infos.push(i));
    const me = snap.players.find((p) => p.id === a.userId)!;
    const path = route(MAPS.inn, [me.x, me.y], MAPS.inn.find("o")[0]!)!;
    await walk(conn, path.slice(0, -1));
    expect(await conn.drink("down")).toBeNull(); // not facing the machine
    expect(await conn.drink(path.at(-1))).toEqual({ notice: expect.stringContaining("fresh cup") });
    expect(await conn.drink(path.at(-1))).toEqual({ notice: expect.stringContaining("Second cup") });
    await eventually(() => {
      const until = infos.filter((i) => i.id === a.userId).at(-1)?.coffeeUntil ?? 0;
      expect(cupsLeft(until, Date.now())).toBeGreaterThan(1.5);
    });
    await conn.dispose();
  });

  test("bots are up and about in town, and wander off", async () => {
    const a = await signUp("w");
    const { conn, events, snap } = await connect(a.token);
    const me = snap.players.find((p) => p.id === a.userId)!;
    await walk(conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    await eventually(() => expect(events.snapshots.at(-1)?.room).toBe("town"));
    const bot = events.snapshots.at(-1)!.players.find((p) => p.id === BOTS[0]!.id)!;
    expect(bot).toMatchObject({ name: BOTS[0]!.name, online: true, dozing: false, state: "idle" });
    await eventually(
      () => expect(events.moves.some((m) => m.m.some(([id]) => id === bot.id))).toBe(true),
      20_000,
    );
    await conn.dispose();
  }, 30_000);

  test("chat reaches the room, and only the room", async () => {
    const a = await signUp("chat");
    const b = await signUp("chat");
    const co = await a.town.createCompany("Chatters");
    await admit(a, b, co.id);
    const ca = await connect(a.token);
    const cb = await connect(b.token);
    await ca.conn.say("hello inn?");
    // a rests at the company house now, b too: same room, both hear it.
    expect(ca.snap.room).toBe(`hq:${co.id}`);
    await eventually(() => expect(cb.events.chat.map((l) => l.text)).toContain("hello inn?"));

    const outsider = await signUp("chat");
    const co2 = await connect(outsider.token);
    await ca.conn.say("members only");
    await Bun.sleep(200);
    expect(co2.events.chat.map((l) => l.text)).not.toContain("members only");
    await expect(outsider.town.me()).resolves.toBeDefined();
    for (const c of [ca, cb, co2]) await c.conn.dispose();
  });

  test("from town you see who is inside a house, names and levels, without going in", async () => {
    const member = await signUp("peek");
    const co = await member.town.createCompany("Glass House");
    const outsider = await signUp("peek");
    const o = await connect(outsider.token);
    // Freelancers wake at the Inn: walk out into town, where the houses are.
    const me = o.snap.players.find((p) => p.id === outsider.userId)!;
    await walk(o.conn, route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!);
    const town = await eventually(() => {
      const snap = o.events.snapshots.at(-1)!;
      expect(snap.room).toBe("town");
      return snap;
    });
    // The member is offline, so asleep in their house.
    expect(town.houses[co.id]).toEqual([
      { id: member.userId, name: member.name, level: 0, look: expect.any(Object), state: "away" },
    ]);
    await o.conn.dispose();
  });

  test("an @mention reaches someone in another room, once", async () => {
    const a = await signUp("ment");
    const co = await a.town.createCompany("Mentioners");
    const b = await signUp("ment"); // a freelancer: wakes up at the Inn, not in a's house
    const ca = await connect(a.token);
    const cb = await connect(b.token);
    expect(ca.snap.room).toBe(`hq:${co.id}`);
    expect(cb.snap.room).toBe("inn");
    await ca.conn.say(`hey @${b.name.toUpperCase()} and @${b.name} and @nobody`);
    await eventually(() =>
      expect(cb.events.mentions.map((l) => l.text)).toEqual([
        `hey @${b.name.toUpperCase()} and @${b.name} and @nobody`,
      ]),
    );
    expect(cb.events.chat).toHaveLength(0);
    expect(ca.events.mentions).toHaveLength(0);
    for (const c of [ca, cb]) await c.conn.dispose();
  });

  test("offline players work at a desk while agents run, and sleep otherwise", async () => {
    const a = await signUp("rest");
    const viewer = await signUp("rest");
    const v = await connect(viewer.token); // both freelancers: both at the Inn
    await as(a.token)
      .player(a.userId)
      .ingest([event({ timestamp: Date.now() - 60_000 })]);
    await eventually(() => {
      const moved = v.events.moves.flatMap((m) => [
        ...m.m,
        ...m.join.map((p) => [p.id, p.x, p.y, p.facing, p.state]),
      ]);
      expect(moved.filter((m) => m[0] === a.userId).at(-1)?.[4]).toBe("working");
    });
    await v.conn.dispose();
  });

  test("whoever has agents running is at a desk in the dungeon, wherever they are, busiest first", async () => {
    const busy = await signUp("raid");
    const calm = await signUp("raid");
    const viewer = await signUp("raid");
    const v = await connect(viewer.token);
    const raiders: Raiders[] = [];
    v.conn.on("raiders", (r: Raiders) => raiders.push(r));
    expect(await v.conn.enterDungeon()).toMatchObject({ ...roomEntry("dungeon"), state: "idle" });
    await eventually(() => expect(v.events.snapshots.at(-1)?.room).toBe("dungeon"));
    // Neither ever walks in: three agents at 3M tokens a minute together, and one at 1k.
    const at = Date.now() - 60_000;
    await as(busy.token)
      .player(busy.userId)
      .ingest(
        ["a", "b", "c"].map((s) => event({ sessionId: s, timestamp: at, inputTokens: 1e6, outputTokens: 0 })),
      );
    await as(calm.token)
      .player(calm.userId)
      .ingest([event({ timestamp: at, inputTokens: 10_000, outputTokens: 0 })]);
    await eventually(() => {
      const top = raiders.at(-1)?.top ?? [];
      const ids = top.map((r) => r.id);
      expect(ids.indexOf(busy.userId)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(busy.userId)).toBeLessThan(ids.indexOf(calm.userId));
      const b = top.find((r) => r.id === busy.userId)!;
      expect(b.agents).toBe(3);
      // 3M over the last 10 minutes, fading a little since that sync.
      expect(b.burn).toBeGreaterThan(250_000);
      expect(b.burn).toBeLessThanOrEqual(300_000);
      expect(top.find((r) => r.id === calm.userId)!.agents).toBe(1);
    });
    expect(v.events.snapshots.at(-1)!.raiders).not.toBeNull();
    await v.conn.dispose();
  });
});
