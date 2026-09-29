import { describe, expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { type ChatLine, type Moves, outsideDoor, route, type Snapshot } from "@tokenmaxxing/core/world.ts";
import { admit, as, event, signUp } from "./rivet.ts";

async function connect(token: string) {
  const conn = as(token).world.connect();
  const events = {
    moves: [] as Moves[],
    chat: [] as ChatLine[],
    snapshots: [] as Snapshot[],
    mentions: [] as ChatLine[],
  };
  conn.on("mention", (l: ChatLine) => events.mentions.push(l));
  conn.on("moves", (m: Moves) => events.moves.push(m));
  conn.on("chat", (l: ChatLine) => events.chat.push(l));
  conn.on("snapshot", (s: Snapshot) => events.snapshots.push(s));
  const snap = await conn.join();
  return { conn, snap, events };
}

/** Walks `dirs` one step at a time, at running pace. */
async function walk(conn: Awaited<ReturnType<typeof connect>>["conn"], dirs: string[]) {
  const results = [];
  for (const d of dirs) {
    results.push(await conn.step(d));
    await Bun.sleep(140);
  }
  return results;
}

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

  test("walking out of the Inn lands in town, next to its door", async () => {
    const a = await signUp("w");
    const { conn, events, snap } = await connect(a.token);
    const me = snap.players.find((p) => p.id === a.userId)!;
    const path = route(MAPS.inn, [me.x, me.y], MAPS.inn.find("x")[0]!)!;
    const results = await walk(conn, path);
    expect(results.at(-1)).toEqual({ ...outsideDoor("I"), state: "idle" });
    await Bun.sleep(150);
    expect(events.snapshots.at(-1)!.room).toBe("town");
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
    const door = outsideDoor("I");
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

  test("chat reaches the room, and only the room", async () => {
    const a = await signUp("chat");
    const b = await signUp("chat");
    const co = await a.town.createCompany("Chatters");
    await admit(a, b, co.id);
    const ca = await connect(a.token);
    const cb = await connect(b.token);
    await ca.conn.say("hello inn?");
    await Bun.sleep(200);
    // a rests at the company house now, b too: same room, both hear it.
    expect(ca.snap.room).toBe(`hq:${co.id}`);
    expect(cb.events.chat.map((l) => l.text)).toContain("hello inn?");

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
    await Bun.sleep(200);
    const town = o.events.snapshots.at(-1)!;
    expect(town.room).toBe("town");
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
    await Bun.sleep(200);
    expect(cb.events.mentions.map((l) => l.text)).toEqual([
      `hey @${b.name.toUpperCase()} and @${b.name} and @nobody`,
    ]);
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
    await Bun.sleep(300);
    const moved = v.events.moves.flatMap((m) => [
      ...m.m,
      ...m.join.map((p) => [p.id, p.x, p.y, p.facing, p.state]),
    ]);
    const last = moved.filter((m) => m[0] === a.userId).at(-1);
    expect(last?.[4]).toBe("working");
    await v.conn.dispose();
  });
});
