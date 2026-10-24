import { describe, expect, test } from "bun:test";
import { hqMap } from "@tokenmaxxing/core/office.ts";
import { roomEntry, route } from "@tokenmaxxing/core/world.ts";
import { admin, admit, eventually, signUp, veteran } from "./rivet.ts";
import { asleep, connect, step, walk } from "./world-client.ts";

// Offices and their doors.
describe("world", () => {
  test("a level-10 member's door is in the building; colleagues walk through it unless it's closed", async () => {
    const owner = await signUp("door");
    const co = await owner.town.createCompany("Doors");
    await veteran(owner);
    const mate = await signUp("door");
    await admit(owner, mate, co.id);
    const room = `office:${owner.userId}` as const;
    // Only the owner has a door: the colleague is level 0.
    const m = await connect(mate.token);
    expect(m.snap.room).toBe(`hq:${co.id}`);
    const door = { userId: owner.userId, name: owner.name, open: true, x: 1, y: -2 };
    expect(m.snap.doors).toEqual([door]);
    const me = m.snap.players.find((p) => p.id === mate.userId)!;
    const path = route(hqMap(m.snap.doors), [me.x, me.y], [door.x, door.y])!;
    expect((await walk(m.conn, path)).at(-1)).toMatchObject({ room });
    // Out again: below the door.
    expect(await step(m.conn, "down")).toEqual({
      room: `hq:${co.id}`,
      x: 1,
      y: -1,
      facing: "down",
      state: "idle",
    });

    await owner.town.setOfficeOpen(false);
    await eventually(() => expect(m.events.snapshots.at(-1)!.doors).toEqual([{ ...door, open: false }]));
    expect(await step(m.conn, "up")).toEqual({ notice: `🔒 ${owner.name}'s office is closed.` });
    const o = await connect(owner.token);
    const at = o.snap.players.find((p) => p.id === owner.userId)!;
    const own = await walk(o.conn, route(hqMap(o.snap.doors), [at.x, at.y], [door.x, door.y])!);
    expect(own.at(-1)).toMatchObject({ room });
    await o.conn.dispose();

    // Leaving the company takes the door; the colleague in its hallway goes back to the entry.
    await owner.town.leaveCompany();
    const after = await eventually(() => {
      const snap = m.events.snapshots.at(-1)!;
      expect(snap.doors).toEqual([]);
      return snap;
    });
    const { x, y } = roomEntry(`hq:${co.id}`);
    expect(after.players.find((p) => p.id === mate.userId)).toMatchObject({ x, y });
    await m.conn.dispose();
  });

  test("anyone visits an open office from its owner's card; a closed one lets only its owner in", async () => {
    const owner = await signUp("office");
    await owner.town.createCompany("Tower");
    await veteran(owner);
    const guest = await signUp("office");
    const g = await connect(guest.token);
    const room = `office:${owner.userId}` as const;
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room });
    const inside = await eventually(() => {
      const snap = g.events.snapshots.at(-1)!;
      expect(snap.room).toBe(room);
      return snap;
    });
    // Level 10 put a desk and a chair on its floor.
    expect(inside.drops).toMatchObject([
      { item: "furn.d", x: 5, y: 3, by: owner.userId },
      { item: "furn.c", x: 5, y: 4, by: owner.userId },
    ]);
    expect(inside.owner).toEqual({ id: owner.userId, name: owner.name, open: true, tier: 1 }); // a veteran: level 25 to 39
    // Only its owner opens or closes it: anyone else's call is about their own, and they have none.
    await expect(guest.town.setOfficeOpen(false)).rejects.toMatchObject({ code: "not_found" });
    expect((await guest.town.profile(owner.userId, "7d")).office).toBe("open");
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room });

    await owner.town.setOfficeOpen(false);
    expect(await g.conn.visit(owner.userId)).toEqual({ notice: `🔒 ${owner.name}'s office is closed.` });
    expect((await guest.town.profile(owner.userId, "7d")).office).toBe("closed");
    const o = await connect(owner.token);
    expect(await o.conn.visit(owner.userId)).toMatchObject({ room });
    await o.conn.dispose();

    // Deleted, their office goes from the world too, furniture and all; the guest still inside sees a bare one.
    await admin().adminDeleteUser(owner.userId);
    const again = await connect(guest.token);
    expect(again.snap).toMatchObject({ room, drops: [] });
    for (const c of [g, again]) await c.conn.dispose();
  });

  test("a wallpaper is bought once and shows to visitors; the open list counts them, not the owner", async () => {
    const owner = await signUp("decor");
    await owner.town.createCompany("Walls");
    await veteran(owner);
    await admin().adminSetCoins(owner.userId, 500);
    const guest = await signUp("decor");
    await expect(owner.town.setDecor("wall", "nyhavn")).rejects.toMatchObject({ code: "not_owned" });
    await owner.town.buyDecor("wall", "nyhavn");
    await owner.town.setDecor("wall", "nyhavn");
    expect(await owner.town.decorOwned()).toContain("wall.nyhavn");
    await expect(guest.town.setDecor("wall", null)).rejects.toMatchObject({ code: "not_found" });

    const g = await connect(guest.token);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room: `office:${owner.userId}` });
    const inside = await eventually(() => {
      const snap = g.events.snapshots.at(-1)!;
      expect(snap.owner).toMatchObject({ id: owner.userId, tier: 1, wall: "nyhavn" });
      return snap;
    });
    expect(inside.owner!.floor).toBeUndefined();

    // Changing it while someone is inside sends them the room again.
    await owner.town.setDecor("wall", null);
    await eventually(() => expect(g.events.snapshots.at(-1)!.owner?.wall).toBeUndefined());

    // The owner going in doesn't count, the guest does (the list is cached for 5 s).
    const o = await connect(owner.token);
    expect(await o.conn.visit(owner.userId)).toMatchObject({ room: `office:${owner.userId}` });
    const row = await eventually(async () => {
      const mine = (await guest.town.openOffices()).find((r) => r.id === owner.userId);
      expect(mine).toMatchObject({ company: "Walls", tier: 1, visitors: 1 });
      return mine!;
    }, 8_000);
    expect(row.inside).toBeGreaterThanOrEqual(1);
    await owner.town.setOfficeOpen(false);
    await eventually(async () => {
      expect((await guest.town.openOffices()).some((r) => r.id === owner.userId)).toBe(false);
    }, 8_000);
    for (const c of [g, o]) await c.conn.dispose();
  });

  test("an office that closed while you slept isn't where you wake up", async () => {
    const owner = await signUp("shut");
    await owner.town.createCompany("Shutters");
    await veteran(owner);
    const guest = await signUp("shut");
    const g = await connect(guest.token);
    const w = await connect(owner.token);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room: `office:${owner.userId}` });
    // Closing the tab remembers the office...
    await asleep(g, w, guest.userId);
    await owner.town.setOfficeOpen(false);
    // ...but it's closed now, so they're up in their bed at the Inn.
    const again = await connect(guest.token);
    expect(again.snap.room).toBe("inn");
    for (const c of [w, again]) await c.conn.dispose();
  });

  test("nor is the office of someone who left their company", async () => {
    const owner = await signUp("left");
    await owner.town.createCompany("Leavers");
    await veteran(owner);
    const guest = await signUp("left");
    const g = await connect(guest.token);
    const w = await connect(owner.token);
    expect(await g.conn.visit(owner.userId)).toMatchObject({ room: `office:${owner.userId}` });
    await asleep(g, w, guest.userId);
    await owner.town.leaveCompany(); // still open, but no office without a company
    const again = await connect(guest.token);
    expect(again.snap.room).toBe("inn");
    for (const c of [w, again]) await c.conn.dispose();
  });
});
