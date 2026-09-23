import { describe, expect, test } from "bun:test";
import { event, testApp } from "./helpers.ts";

describe("accounts", () => {
  test("sign up returns a token once; names are unique and normalized", async () => {
    const { req } = testApp();
    const a = await req("POST", "/api/users", { body: { name: "  Alice " } });
    expect(a.status).toBe(201);
    expect(a.body.name).toBe("alice");
    expect(typeof a.body.token).toBe("string");
    expect((await req("POST", "/api/users", { body: { name: "alice" } })).status).toBe(409);
    expect((await req("POST", "/api/users", { body: { name: "x" } })).status).toBe(400);
    expect((await req("POST", "/api/users", { body: { name: "bad name!" } })).status).toBe(400);
  });

  test("the api needs a valid token", async () => {
    const { req, signUp } = testApp();
    expect((await req("GET", "/api/me")).status).toBe(401);
    expect((await req("GET", "/api/me", { token: "nope" })).status).toBe(401);
    const token = await signUp("alice");
    expect((await req("GET", "/api/me", { token })).body).toEqual({ name: "alice", groups: [] });
  });

  test("sign up is rate limited per IP", async () => {
    const { req } = testApp();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await req("POST", "/api/users", { body: { name: `user${i}` }, ip: "9.9.9.9" })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  test("login code opens a browser session exactly once", async () => {
    const { req, signUp, app } = testApp();
    const token = await signUp("alice");
    const { code } = (await req("POST", "/api/sessions", { token })).body;
    const login = await app.request(`/login?code=${code}`);
    expect(login.status).toBe(302);
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const me = await app.request("/api/me", { headers: { cookie } });
    expect(((await me.json()) as { name: string }).name).toBe("alice");
    const again = await app.request(`/login?code=${code}`);
    expect(again.headers.get("location")).toBe("/?login=expired");
  });
});

describe("ingest", () => {
  test("dedups re-sent events and skips invalid ones", async () => {
    const { signUp, ingest } = testApp();
    const token = await signUp("alice");
    const evs = [event(), event()];
    expect((await ingest(token, evs)).body).toEqual({ inserted: 2, duplicates: 0, skipped: 0 });
    expect((await ingest(token, evs)).body).toEqual({ inserted: 0, duplicates: 2, skipped: 0 });
    const bad = { ...event(), inputTokens: -1 };
    expect((await ingest(token, [bad, event()])).body).toEqual({ inserted: 1, duplicates: 0, skipped: 1 });
  });

  test("rejects oversized batches", async () => {
    const { signUp, ingest } = testApp();
    const token = await signUp("alice");
    const evs = Array.from({ length: 1001 }, () => event());
    expect((await ingest(token, evs)).status).toBe(400);
  });
});

describe("groups", () => {
  test("create, join by code in any format, idempotent join", async () => {
    const { req, signUp } = testApp();
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const g = (await req("POST", "/api/groups", { token: alice, body: { name: "Friends" } })).body;
    expect(g.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/);
    expect(g.isOwner).toBe(true);
    const code = `Join my tokenmaxxing group: ${g.code.toLowerCase()}`;
    const joined = await req("POST", "/api/groups/join", { token: bob, body: { code } });
    expect(joined.status).toBe(200);
    expect(joined.body).toMatchObject({ id: g.id, memberCount: 2, isOwner: false });
    expect(
      (await req("POST", "/api/groups/join", { token: bob, body: { code: g.code } })).body.memberCount,
    ).toBe(2);
    expect(
      (await req("POST", "/api/groups/join", { token: bob, body: { code: "AAAA-AAAA-AA" } })).status,
    ).toBe(404);
  });

  test("rotated code: old fails, new works, members stay", async () => {
    const { req, signUp } = testApp();
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const carol = await signUp("carol");
    const g = (await req("POST", "/api/groups", { token: alice, body: { name: "G" } })).body;
    await req("POST", "/api/groups/join", { token: bob, body: { code: g.code } });
    expect((await req("POST", `/api/groups/${g.id}/code`, { token: bob })).status).toBe(403);
    const { code } = (await req("POST", `/api/groups/${g.id}/code`, { token: alice })).body;
    expect((await req("POST", "/api/groups/join", { token: carol, body: { code: g.code } })).status).toBe(
      404,
    );
    expect((await req("POST", "/api/groups/join", { token: carol, body: { code } })).status).toBe(200);
    expect((await req("GET", "/api/me", { token: bob })).body.groups).toHaveLength(1);
  });

  test("owner leaving hands over to the earliest member; last one out deletes the group", async () => {
    const { req, signUp, db } = testApp();
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const g = (await req("POST", "/api/groups", { token: alice, body: { name: "G" } })).body;
    await req("POST", "/api/groups/join", { token: bob, body: { code: g.code } });
    await req("DELETE", `/api/groups/${g.id}/members/me`, { token: alice });
    expect((await req("GET", "/api/me", { token: bob })).body.groups[0]).toMatchObject({
      owner: "bob",
      isOwner: true,
    });
    await req("DELETE", `/api/groups/${g.id}/members/bob`, { token: bob });
    expect(db.query("SELECT COUNT(*) AS n FROM groups").get()).toEqual({ n: 0 });
  });

  test("only the owner can remove members, rename or delete; outsiders get 404", async () => {
    const { req, signUp } = testApp();
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const eve = await signUp("eve");
    const g = (await req("POST", "/api/groups", { token: alice, body: { name: "G" } })).body;
    await req("POST", "/api/groups/join", { token: bob, body: { code: g.code } });
    expect((await req("DELETE", `/api/groups/${g.id}/members/alice`, { token: bob })).status).toBe(403);
    expect((await req("PATCH", `/api/groups/${g.id}`, { token: eve, body: { name: "X" } })).status).toBe(404);
    expect((await req("GET", `/api/groups/${g.id}/members`, { token: eve })).status).toBe(404);
    expect((await req("PATCH", `/api/groups/${g.id}`, { token: alice, body: { name: "New" } })).status).toBe(
      200,
    );
    expect((await req("DELETE", `/api/groups/${g.id}/members/bob`, { token: alice })).status).toBe(200);
    expect((await req("GET", "/api/me", { token: bob })).body.groups).toHaveLength(0);
    expect((await req("DELETE", `/api/groups/${g.id}`, { token: alice })).status).toBe(200);
  });
});

describe("visibility (the privacy rule)", () => {
  test("no groups → only yourself", async () => {
    const { signUp, names } = testApp();
    const alice = await signUp("alice");
    await signUp("bob");
    expect(await names(alice)).toEqual(["alice"]);
  });

  test("groups A and B → the union, each person once", async () => {
    const { req, signUp, names } = testApp();
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const carol = await signUp("carol");
    const dave = await signUp("dave");
    const a = (await req("POST", "/api/groups", { token: alice, body: { name: "A" } })).body;
    const b = (await req("POST", "/api/groups", { token: alice, body: { name: "B" } })).body;
    await req("POST", "/api/groups/join", { token: bob, body: { code: a.code } });
    await req("POST", "/api/groups/join", { token: bob, body: { code: b.code } });
    await req("POST", "/api/groups/join", { token: carol, body: { code: b.code } });
    expect(await names(alice)).toEqual(["alice", "bob", "carol"]);
    expect(await names(alice, `&group=${a.id}`)).toEqual(["alice", "bob"]);
    expect(await names(dave)).toEqual(["dave"]);
    // carol shares only B with alice and bob
    expect(await names(carol)).toEqual(["alice", "bob", "carol"]);
  });

  test("filtering by a group you're not in, or viewing a user you can't see → 404", async () => {
    const { req, signUp } = testApp();
    const alice = await signUp("alice");
    const eve = await signUp("eve");
    const a = (await req("POST", "/api/groups", { token: alice, body: { name: "A" } })).body;
    expect((await req("GET", `/api/leaderboard?group=${a.id}`, { token: eve })).status).toBe(404);
    expect((await req("GET", "/api/users/alice", { token: eve })).status).toBe(404);
    expect((await req("GET", "/api/users/alice", { token: alice })).status).toBe(200);
  });

  test("a member who leaves disappears from the others' leaderboards", async () => {
    const { req, signUp, names } = testApp();
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const g = (await req("POST", "/api/groups", { token: alice, body: { name: "G" } })).body;
    await req("POST", "/api/groups/join", { token: bob, body: { code: g.code } });
    expect(await names(alice)).toEqual(["alice", "bob"]);
    await req("DELETE", `/api/groups/${g.id}/members/me`, { token: bob });
    expect(await names(alice)).toEqual(["alice"]);
  });
});
