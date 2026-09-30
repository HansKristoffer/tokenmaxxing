import { describe, expect, test } from "bun:test";
import { admin, admit, as, client, event, origin, rich, signUp } from "./rivet.ts";

describe("the admin page", () => {
  test("is served at /admin", async () => {
    const res = await fetch(`${origin}/admin`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<script");
  });

  test("only the admin token gets in", async () => {
    const u = await signUp("notadmin");
    await expect(
      client.town
        .getOrCreate(["main"], { params: { admin: "wrong-token-wrong-token-wrong-token" } })
        .adminUsers(),
    ).rejects.toThrow();
    await expect(u.town.adminUsers()).rejects.toThrow();
    await expect(u.town.adminSetCoins(u.userId, 1_000_000)).rejects.toThrow();
    await expect(client.town.getOrCreate(["main"]).adminOverview()).rejects.toThrow();
    // …and it's no player: player actions still want a player.
    await expect(admin().me()).rejects.toThrow();
  });

  // One event: 100M input tokens and 50 output, worth √100 = 10 coins.
  test("lists users and companies, and adds them up", async () => {
    const owner = await signUp("adlist");
    await as(owner.token)
      .player(owner.userId)
      .ingest([event({ inputTokens: 100e6, timestamp: Date.now() })]);
    const co = await owner.town.createCompany("Admin Listed");
    const users = await admin().adminUsers();
    const me = users.find((u) => u.id === owner.userId)!;
    expect(me).toMatchObject({ name: owner.name, balance: 10, tokensToday: 100e6 + 50 });
    expect(me.company).toEqual({ id: co.id, name: "Admin Listed", isOwner: true });
    const listed = (await admin().adminCompanies()).find((c) => c.id === co.id)!;
    expect(listed).toMatchObject({ owner: { id: owner.userId, name: owner.name }, tokensToday: 100e6 + 50 });
    expect(listed.members).toEqual([{ id: owner.userId, name: owner.name }]);
    const o = await admin().adminOverview();
    expect(o.users).toBeGreaterThanOrEqual(1);
    expect(o.tokensToday).toBeGreaterThanOrEqual(100e6);
  });

  test("sets a balance, which the player can spend", async () => {
    const u = await rich("adcoins", 10);
    expect(await admin().adminSetCoins(u.userId, 250)).toBe(250);
    expect((await u.town.wallet()).balance).toBe(250);
    await admin().adminSetCoins(u.userId, 0);
    expect((await u.town.wallet()).balance).toBe(0);
    await expect(admin().adminSetCoins(u.userId, -5)).rejects.toThrow();
    await expect(admin().adminSetCoins(u.userId, 1.5)).rejects.toThrow();
    await expect(admin().adminSetCoins(99_999_999, 5)).rejects.toThrow();
  });

  test("renames people and companies", async () => {
    const u = await signUp("adren");
    const co = await u.town.createCompany("Before");
    await admin().adminRenameUser(u.userId, `${u.name}z`);
    await admin().adminRenameCompany(co.id, "After");
    const me = await u.town.me();
    expect(me.name).toBe(`${u.name}z`);
    expect(me.company?.name).toBe("After");
    const taken = await signUp("adtaken");
    await expect(admin().adminRenameUser(u.userId, taken.name)).rejects.toThrow("taken");
  });

  test("takes someone out of a company, or closes it", async () => {
    const owner = await signUp("adown");
    const mate = await signUp("admate");
    const co = await owner.town.createCompany("Closing Time");
    await admit(owner, mate, co.id);
    await admin().adminRemoveFromCompany(mate.userId);
    expect((await mate.town.me()).company).toBeNull();
    await admit(owner, mate, co.id);
    await admin().adminCloseCompany(co.id);
    expect((await owner.town.me()).company).toBeNull();
    expect((await mate.town.me()).company).toBeNull();
    expect((await admin().adminCompanies()).some((c) => c.id === co.id)).toBe(false);
  });

  test("deletes an account: signed out, out of the world, and the id isn't reused", async () => {
    const gone = await signUp("adgone");
    const heir = await signUp("adheir");
    const co = await gone.town.createCompany("Handover");
    await admit(gone, heir, co.id);
    const watcher = await signUp("adwatch");
    await as(gone.token).world.join();

    await admin().adminDeleteUser(gone.userId);
    await expect(as(gone.token).player(gone.userId).mintLoginCode()).rejects.toThrow();
    await expect(gone.town.me()).rejects.toThrow();
    expect((await admin().adminUsers()).some((u) => u.id === gone.userId)).toBe(false);
    // The company carries on under whoever joined next.
    expect((await heir.town.me()).company?.isOwner).toBe(true);
    const snap = await as(watcher.token).world.join();
    expect(snap.players.some((p) => p.id === gone.userId)).toBe(false);
    await expect(admin().adminDeleteUser(gone.userId)).rejects.toThrow();

    const newest = await signUp("adnewest");
    await admin().adminDeleteUser(newest.userId);
    expect((await signUp("adnext")).userId).toBe(newest.userId + 1);
  });
});
