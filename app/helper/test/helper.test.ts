import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppState, Command, Message } from "@tokenmaxxing/core/protocol.ts";
import { buildApp } from "@tokenmaxxing/server/app";
import { openDb } from "../../../server/src/db/db.ts";
import { PricingCache } from "../../../server/src/pricing.ts";
import { Helper } from "../src/helper.ts";

let dir: string;

/** Distributes over the union, so each command keeps its own fields. */
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "tm-helper-"));
  process.env.CLAUDE_CONFIG_DIR = join(dir, "claude");
  process.env.CODEX_HOME = join(dir, "codex");
  process.env.CURSOR_DATA_DIR = join(dir, "cursor");
  process.env.CURSOR_PROJECTS_DIR = join(dir, "cursor-projects");
  process.env.TOKENMAXXING_CLAUDE_COWORK_DIR = join(dir, "cowork");
  await mkdir(join(dir, "claude", "projects", "p"), { recursive: true });
  await writeFile(
    join(dir, "claude", "projects", "p", "s1.jsonl"),
    `${JSON.stringify({
      type: "assistant",
      sessionId: "s1",
      timestamp: new Date().toISOString(),
      message: {
        id: "m1",
        model: "claude-haiku-4-5-20251001",
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    })}\n`,
  );
});

afterEach(async () => {
  for (const k of [
    "CLAUDE_CONFIG_DIR",
    "CODEX_HOME",
    "CURSOR_DATA_DIR",
    "CURSOR_PROJECTS_DIR",
    "TOKENMAXXING_CLAUDE_COWORK_DIR",
  ]) {
    delete process.env[k];
  }
  await rm(dir, { recursive: true, force: true });
});

function harness(now?: () => number) {
  const app = buildApp({
    db: openDb(":memory:"),
    pricing: new PricingCache(),
    version: "t",
    secureCookies: false,
  });
  const messages: Message[] = [];
  const helper = new Helper({
    statePath: join(dir, "state.json"),
    version: "t",
    write: (m) => messages.push(m),
    log: () => {},
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => app.request(input, init)) as typeof fetch,
    ...(now ? { now } : {}),
  });
  let id = 0;
  const send = async (cmd: WithoutId<Command>) => {
    const withId = { ...cmd, id: ++id } as Command;
    await helper.handle(withId);
    return messages.find((m) => "id" in m && m.id === withId.id) as Extract<Message, { id: number }>;
  };
  const lastState = () =>
    (messages.filter((m) => "event" in m && m.event === "state").at(-1) as { state: AppState }).state;
  return { helper, messages, send, lastState, app };
}

const init = (token: string | null) => ({
  cmd: "init" as const,
  token,
  serverUrl: "http://tm.test",
  view: { range: "today" as const, groupId: null, sort: "tokens" as const },
  enabledSources: ["claude_code" as const],
});

describe("helper", () => {
  test("onboarding → sign up → sync → leaderboard shows my usage", async () => {
    const { helper, messages, send, lastState } = harness();
    await send(init(null));
    expect(lastState().phase).toBe("onboarding");

    const r = await send({ cmd: "signUp", name: "alice" });
    expect(r.ok).toBe(true);
    const tokenMsg = messages.find((m) => "event" in m && m.event === "token") as { token: string };
    expect(tokenMsg.token.length).toBeGreaterThan(20);

    await helper.syncOnce();
    await helper.refresh();
    expect(helper.state.phase).toBe("ready");
    expect(helper.state.me).toMatchObject({ name: "alice", rank: 1, tokens: 15 });
    expect(helper.state.leaderboard[0]).toMatchObject({ name: "alice", isMe: true });
    helper.stop();
  });

  test("groups: create, then a friend joins with the code and sees both", async () => {
    const a = harness();
    await a.send(init(null));
    await a.send({ cmd: "signUp", name: "alice" });
    const created = await a.send({ cmd: "createGroup", name: "Friends" });
    const code = (created as { result: { code: string } }).result.code;
    expect(a.helper.state.groups).toHaveLength(1);
    a.helper.stop();

    // Second helper, same server.
    const messages: Message[] = [];
    const bob = new Helper({
      statePath: join(dir, "bob.json"),
      version: "t",
      write: (m) => messages.push(m),
      log: () => {},
      fetch: ((i: RequestInfo | URL, init2?: RequestInit) => a.app.request(i, init2)) as typeof fetch,
    });
    await bob.handle({ id: 1, ...init(null) });
    await bob.handle({ id: 2, cmd: "signUp", name: "bob" });
    await bob.handle({ id: 3, cmd: "joinGroup", code: code.toLowerCase() });
    expect(bob.state.groups[0]).toMatchObject({ name: "Friends", memberCount: 2, isOwner: false });
    expect(bob.state.me?.of).toBe(2);
    await bob.handle({ id: 4, cmd: "leaveGroup", groupId: bob.state.groups[0]!.id });
    expect(bob.state.groups).toHaveLength(0);
    bob.stop();
  });

  test("errors come back as stable codes", async () => {
    const { send, helper } = harness();
    await send(init(null));
    await send({ cmd: "signUp", name: "alice" });
    helper.stop();
    const h2 = harness();
    // separate server: name free there; test invalid input + bad code instead
    await h2.send(init(null));
    expect(await h2.send({ cmd: "signUp", name: "!" })).toMatchObject({ ok: false, error: "invalid_name" });
    await h2.send({ cmd: "signUp", name: "carol" });
    expect(await h2.send({ cmd: "joinGroup", code: "AAAA-AAAA-AA" })).toMatchObject({
      ok: false,
      error: "not_found",
    });
    h2.helper.stop();
  });

  test("rename updates my name in state; a taken name comes back as name_taken", async () => {
    const { send, helper } = harness();
    await send(init(null));
    await send({ cmd: "signUp", name: "alice" });
    expect(await send({ cmd: "rename", name: "!" })).toMatchObject({ ok: false, error: "invalid_name" });
    expect(await send({ cmd: "rename", name: "alicia" })).toMatchObject({
      ok: true,
      result: { name: "alicia" },
    });
    expect(helper.state.me?.name).toBe("alicia");
    await send({ cmd: "signOut" });
    await send({ cmd: "signUp", name: "bob" });
    expect(await send({ cmd: "rename", name: "alicia" })).toMatchObject({ ok: false, error: "name_taken" });
    helper.stop();
  });

  test("a rejected token signs out and tells the shell to forget it", async () => {
    const { send, messages, lastState } = harness();
    await send(init("not-a-real-token"));
    expect(lastState().phase).toBe("onboarding");
    expect(messages).toContainEqual({ event: "token", token: null });
  });

  test("openDashboard returns a single-use login URL", async () => {
    const { send, helper } = harness();
    await send(init(null));
    await send({ cmd: "signUp", name: "alice" });
    const r = (await send({ cmd: "openDashboard" })) as { result: { url: string } };
    expect(r.result.url).toMatch(/^http:\/\/tm\.test\/login\?code=/);
    helper.stop();
  });
});

/** A second signed-up user on the same server; returns their helper and API token. */
async function friend(app: ReturnType<typeof harness>["app"], name: string) {
  const messages: Message[] = [];
  const helper = new Helper({
    statePath: join(dir, `${name}.json`),
    version: "t",
    write: (m) => messages.push(m),
    log: () => {},
    fetch: ((i: RequestInfo | URL, init2?: RequestInit) => app.request(i, init2)) as typeof fetch,
  });
  let id = 100;
  const send = (cmd: WithoutId<Command>) => helper.handle({ ...cmd, id: ++id } as Command);
  await send({ ...init(null), enabledSources: [] }); // don't sync the shared fixture log
  await send({ cmd: "signUp", name });
  const token = (messages.find((m) => "event" in m && m.event === "token") as { token: string }).token;
  return { helper, send, token };
}

const notifications = (messages: Message[]) =>
  messages.filter((m): m is Extract<Message, { event: "notify" }> => "event" in m && m.event === "notify");

describe("feed", () => {
  test("first poll only sets the cursor; bursts collapse; the cap holds; opening chat marks it read", async () => {
    const a = harness();
    await a.send(init(null));
    await a.send({ cmd: "signUp", name: "alice" });
    const g = (await a.send({ cmd: "createGroup", name: "Friends" })) as {
      result: { id: number; code: string };
    };
    const bob = await friend(a.app, "bob");
    await bob.send({ cmd: "joinGroup", code: g.result.code });
    const say = (text: string) => bob.send({ cmd: "sendMessage", groupId: g.result.id, text });

    await say("before alice ever looked");
    await a.helper.pollFeed();
    expect(notifications(a.messages)).toHaveLength(0);

    for (let i = 0; i < 4; i++) await say(`@alice ${i}`);
    await a.helper.pollFeed();
    expect(notifications(a.messages)).toEqual([
      { event: "notify", title: "bob in Friends", body: "@alice 0 …and 3 more" },
    ]);
    expect(a.helper.state.chat.unread).toBe(4);

    for (let i = 0; i < 3; i++) {
      await say(`@alice again ${i}`);
      await a.helper.pollFeed();
    }
    expect(notifications(a.messages)).toHaveLength(3); // 1 collapsed + 2 more, then the cap

    await a.send({ cmd: "setChatOpen", open: true, groupId: g.result.id });
    expect(a.helper.state.chat.unread).toBe(0);
    expect(a.helper.state.chat.timeline.map((i) => i.text).at(-1)).toBe("@alice again 2");
    const last = a.helper.state.chat.timeline.at(-1)!;
    await a.send({ cmd: "react", momentId: last.id, emoji: "🔥" });
    expect(a.helper.state.chat.timeline.at(-1)!.reactions).toEqual([{ emoji: "🔥", count: 1, mine: true }]);
    await a.send({ cmd: "setChatOpen", open: false, groupId: null });
    a.helper.stop();
    bob.helper.stop();
  });

  test("last call: after 21:00, close behind #1, once a day", async () => {
    const at22 = new Date(2026, 8, 23, 22).getTime();
    const a = harness(() => at22);
    await a.send(init(null));
    await a.send({ cmd: "signUp", name: "alice" });
    const g = (await a.send({ cmd: "createGroup", name: "Friends" })) as { result: { code: string } };
    const bob = await friend(a.app, "bob");
    await bob.send({ cmd: "joinGroup", code: g.result.code });
    await a.app.request("/api/ingest", {
      method: "POST",
      headers: { authorization: `Bearer ${bob.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            source: "claude_code",
            sessionId: "b",
            agentId: null,
            messageId: "b1",
            requestId: null,
            timestamp: Date.now(),
            model: "claude-haiku-4-5-20251001",
            messageType: "assistant",
            inputTokens: 16,
            outputTokens: 2,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            reasoningTokens: null,
          },
        ],
      }),
    });
    await a.helper.syncOnce(); // alice: 15 tokens, bob: 18
    await a.helper.refresh();
    await a.helper.refresh();
    expect(a.helper.state.me?.above).toEqual({ name: "bob", gap: 3 });
    expect(notifications(a.messages)).toEqual([
      { event: "notify", title: "Last call", body: "3 behind bob for #1 today. One more session?" },
    ]);
    a.helper.stop();
    bob.helper.stop();
  });
});
