import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { compact, describeDayResults, describeMoment, type Moment } from "@tokenmaxxing/core/moments.ts";
import {
  type AppState,
  type ChatItem,
  type Command,
  LEADERBOARD_TOP,
  type Message,
  SOURCE_LABELS,
  type SortKey,
  type View,
} from "@tokenmaxxing/core/protocol.ts";
import { DAY_MS } from "@tokenmaxxing/core/range.ts";
import { emptyState, loadState } from "@tokenmaxxing/core/sync/state.ts";
import { sync } from "@tokenmaxxing/core/sync/sync.ts";
import { SOURCES, type Source, type SyncState, type TokenEvent } from "@tokenmaxxing/core/types.ts";
import type { AppType } from "@tokenmaxxing/server/app";
import { hc } from "hono/client";
import {
  brewPath,
  checkForUpdate,
  RELEASES_URL,
  startBrewUpgrade,
  UPDATE_CHECK_INTERVAL_MS,
} from "./update.ts";

export const SYNC_INTERVAL_MS = 5 * 60_000;
export const CHAT_POLL_MS = 5_000;
/** Notifications per rolling 24 h, not counting the morning recap and last call. */
export const NOTIFY_CAP = 3;
const LAST_CALL_HOUR = 21;

/**
 * What the helper has already shown. Kept apart from SyncState: `sync()` saves
 * its own copy of that, which would overwrite a cursor moved meanwhile.
 */
interface FeedState {
  /** Newest moment seen; null until the first poll, which notifies nothing. */
  cursor: number | null;
  /** Newest chat message I've had on screen. */
  chatReadId: number;
  /** Local date of the last "last call" notification. */
  lastCallDay: string | null;
}

const emptyFeed = (): FeedState => ({ cursor: null, chatReadId: 0, lastCallDay: null });

const localDateKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const sortValue = (
  sort: SortKey,
  e: { tokens: number; costUsd: number; parallelism: number | null; prs: number },
) =>
  sort === "tokens" ? e.tokens : sort === "cost" ? e.costUsd : sort === "prs" ? e.prs : (e.parallelism ?? 0);

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface HelperOptions {
  statePath: string;
  version: string;
  write: (msg: Message) => void;
  log?: (msg: string) => void;
  fetch?: typeof fetch;
  now?: () => number;
}

/** A failed call with a stable code the shell can map to a message. */
class ApiError extends Error {}

type Client = ReturnType<typeof hc<AppType>>;

const DEFAULT_VIEW: View = { range: "today", groupId: null, sort: "tokens" };

export class Helper {
  private client: Client | null = null;
  private serverUrl = "";
  private enabled = new Set<Source>(SOURCES);
  private syncState: SyncState | null = null;
  private syncing: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private chatTimer: ReturnType<typeof setInterval> | null = null;
  private feed: FeedState = emptyFeed();
  private polling: Promise<void> | null = null;
  private saves = 0;
  /** When recent notifications went out, for the cap. In memory: a restart resets it. */
  private sentAt: number[] = [];
  readonly state: AppState;

  constructor(private readonly opts: HelperOptions) {
    this.state = {
      phase: "starting",
      version: opts.version,
      view: DEFAULT_VIEW,
      me: null,
      progress: null,
      leaderboard: [],
      groups: [],
      sync: { syncing: false, lastSyncedAt: null, lastError: null, online: true },
      sources: this.sourceInfo(),
      chat: { open: false, groupId: null, timeline: [], unread: 0 },
      update: null,
    };
  }

  /** `state.json` → `state.feed.json`, next to the sync state. */
  private get feedPath(): string {
    return this.opts.statePath.replace(/(\.json)?$/, ".feed.json");
  }

  /** Handles one command and always replies, so the shell can await every call. */
  async handle(cmd: Command): Promise<void> {
    try {
      const result = await this.run(cmd);
      this.opts.write({ id: cmd.id, ok: true, result: result ?? null });
    } catch (err) {
      const error = err instanceof ApiError ? err.message : "internal";
      if (!(err instanceof ApiError)) this.log(`command ${cmd.cmd} failed: ${String(err)}`);
      this.opts.write({ id: cmd.id, ok: false, error });
    }
    this.emit();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopChatPolling();
  }

  /** Publishes a newer cask version (if any) in `state.update`. */
  async checkUpdate(): Promise<void> {
    if (this.state.update?.installing) return;
    const version = await checkForUpdate(this.opts.version, this.opts.fetch);
    const next = version ? { version, viaBrew: brewPath() !== null, installing: false } : null;
    if (JSON.stringify(next) === JSON.stringify(this.state.update)) return;
    this.state.update = next;
    this.emit();
  }

  private async run(cmd: Command): Promise<unknown> {
    switch (cmd.cmd) {
      case "init":
        this.serverUrl = cmd.serverUrl.replace(/\/+$/, "");
        this.state.view = cmd.view;
        this.enabled = new Set(cmd.enabledSources);
        this.state.sources = this.sourceInfo();
        this.syncState = await loadState(this.opts.statePath);
        this.feed = await this.loadFeed();
        this.state.sync.lastSyncedAt = this.syncState.lastSyncedAt;
        this.updateTimer ??= setInterval(() => void this.checkUpdate(), UPDATE_CHECK_INTERVAL_MS);
        this.updateTimer.unref?.();
        void this.checkUpdate();
        if (cmd.token) await this.signIn(cmd.token);
        else this.state.phase = "onboarding";
        return;
      case "signUp": {
        const res = await this.call(() => this.anonClient().api.users.$post({ json: { name: cmd.name } }));
        if (res.status === 409) throw new ApiError("name_taken");
        if (res.status === 400) throw new ApiError("invalid_name");
        if (res.status === 429) throw new ApiError("rate_limited");
        const body = (await res.json()) as { name: string; token: string };
        this.opts.write({ event: "token", token: body.token });
        await this.signIn(body.token);
        return { name: body.name };
      }
      case "rename": {
        const res = await this.call(() => this.api().api.me.$patch({ json: { name: cmd.name } }));
        if (res.status === 409) throw new ApiError("name_taken");
        if (res.status === 400) throw new ApiError("invalid_name");
        await this.expectOk(res);
        await this.refresh();
        return res.json();
      }
      case "createGroup": {
        const res = await this.call(() => this.api().api.groups.$post({ json: { name: cmd.name } }));
        await this.expectOk(res);
        await this.refresh();
        return res.json();
      }
      case "joinGroup": {
        const res = await this.call(() => this.api().api.groups.join.$post({ json: { code: cmd.code } }));
        await this.expectOk(res);
        await this.refresh();
        return res.json();
      }
      case "leaveGroup": {
        const res = await this.call(() =>
          this.api().api.groups[":id"].members[":member"].$delete({
            param: { id: String(cmd.groupId), member: "me" },
          }),
        );
        await this.expectOk(res);
        if (this.state.view.groupId === cmd.groupId) this.state.view = { ...this.state.view, groupId: null };
        await this.refresh();
        return;
      }
      case "rotateCode": {
        const res = await this.call(() =>
          this.api().api.groups[":id"].code.$post({ param: { id: String(cmd.groupId) } }),
        );
        await this.expectOk(res);
        await this.refresh();
        return res.json();
      }
      case "setView":
        this.state.view = cmd.view;
        await this.refresh();
        return;
      case "setSources":
        this.enabled = new Set(cmd.enabledSources);
        this.state.sources = this.sourceInfo();
        return;
      case "syncNow":
        await this.syncOnce();
        return;
      case "refresh":
        await this.refresh();
        return;
      case "openDashboard": {
        const res = await this.call(() => this.api().api.sessions.$post());
        await this.expectOk(res);
        const { code } = (await res.json()) as { code: string };
        return { url: `${this.serverUrl}/login?code=${encodeURIComponent(code)}` };
      }
      case "installUpdate": {
        const brew = brewPath();
        if (!brew || !this.state.update) return { url: RELEASES_URL };
        this.state.update = { ...this.state.update, installing: true };
        startBrewUpgrade(brew);
        return;
      }
      case "signOut":
        this.signOut();
        return;
      case "sendMessage": {
        const res = await this.call(() =>
          this.api().api.groups[":id"].messages.$post({
            param: { id: String(cmd.groupId) },
            json: { text: cmd.text },
          }),
        );
        if (res.status === 400) throw new ApiError("invalid_message");
        if (res.status === 429) throw new ApiError("rate_limited");
        await this.expectOk(res);
        await this.loadTimeline();
        return;
      }
      case "deleteMessage": {
        const res = await this.call(() =>
          this.api().api.feed[":id"].$delete({ param: { id: String(cmd.momentId) } }),
        );
        await this.expectOk(res);
        await this.loadTimeline();
        return;
      }
      case "react": {
        const res = await this.call(() =>
          this.api().api.feed[":id"].reactions.$post({
            param: { id: String(cmd.momentId) },
            json: { emoji: cmd.emoji },
          }),
        );
        if (res.status === 429) throw new ApiError("rate_limited");
        await this.expectOk(res);
        const { reactions } = (await res.json()) as { reactions: ChatItem["reactions"] };
        const item = this.state.chat.timeline.find((i) => i.id === cmd.momentId);
        if (item) item.reactions = reactions;
        return;
      }
      case "setChatOpen":
        this.state.chat.open = cmd.open;
        this.state.chat.groupId = cmd.groupId ?? null; // Swift omits nil fields
        this.stopChatPolling();
        if (!cmd.open) return;
        await this.loadTimeline();
        this.chatTimer = setInterval(() => {
          void this.loadTimeline()
            .catch((err) => this.log(`chat poll: ${String(err)}`))
            .then(() => this.emit());
        }, CHAT_POLL_MS);
        return;
    }
  }

  private stopChatPolling(): void {
    if (this.chatTimer) clearInterval(this.chatTimer);
    this.chatTimer = null;
  }

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private async signIn(token: string): Promise<void> {
    const fetchImpl = this.opts.fetch ?? fetch;
    this.client = hc<AppType>(this.serverUrl, {
      headers: { authorization: `Bearer ${token}` },
      fetch: fetchImpl,
    });
    this.state.phase = "ready";
    this.state.sync.lastSyncedAt = this.syncState?.lastSyncedAt ?? null;
    this.timer ??= setInterval(() => void this.tick(), SYNC_INTERVAL_MS);
    void this.tick();
    await this.refreshQuietly();
  }

  /** Periodic work: send new local usage, then pick up everyone else's and what happened. */
  async tick(): Promise<void> {
    await this.syncOnce();
    await this.refreshQuietly();
    // Offline shows up via refresh; a missed poll just waits for the next tick.
    await this.pollFeed().catch((err) => this.log(`feed: ${String(err)}`));
    this.emit();
  }

  /** New moments since the cursor → unread count and (capped) notifications. One poll at a time. */
  pollFeed(): Promise<void> {
    this.polling ??= this.pollFeedOnce().finally(() => {
      this.polling = null;
    });
    return this.polling;
  }

  private async pollFeedOnce(): Promise<void> {
    const me = this.state.me?.name;
    if (!this.client || !me) return;
    const after = this.feed.cursor;
    const res = await this.call(() =>
      this.api().api.feed.$get({
        query: after === null ? { limit: "1" } : { after: String(after), limit: "100" },
      }),
    );
    await this.expectOk(res);
    const body = (await res.json()) as { moments: Moment[]; cursor: number };
    this.feed.cursor = body.cursor;
    if (after !== null) {
      const unseen = body.moments.filter((m) => !(m.kind === "chat" && m.id <= this.feed.chatReadId));
      this.state.chat.unread += unseen.filter((m) => m.kind === "chat" && m.actor !== me).length;
      this.notifyAbout(unseen, me);
    }
    await this.saveFeed();
  }

  private notifyAbout(moments: Moment[], me: string): void {
    // The morning recap: one per group, outside the cap.
    const recaps = new Map<number, Moment[]>();
    for (const m of moments.filter((m) => m.kind === "day_title" && m.groupId !== null)) {
      recaps.set(m.groupId!, [...(recaps.get(m.groupId!) ?? []), m]);
    }
    for (const titles of recaps.values())
      this.opts.write({ event: "notify", ...describeDayResults(titles, me) });

    const worth = moments
      .filter((m) => m.kind !== "day_title")
      .map((m) => describeMoment(m, me))
      .filter((d) => d.notify)
      .sort((a, b) => b.priority - a.priority);
    const now = this.now();
    this.sentAt = this.sentAt.filter((t) => t > now - DAY_MS);
    const room = NOTIFY_CAP - this.sentAt.length;
    if (worth.length === 0 || room <= 0) return;
    // More than two at once collapse into the most important one.
    const out =
      worth.length > 2
        ? [{ title: worth[0]!.title, body: `${worth[0]!.body} …and ${worth.length - 1} more` }]
        : worth.slice(0, room);
    for (const n of out) {
      this.opts.write({ event: "notify", title: n.title, body: n.body });
      this.sentAt.push(now);
    }
  }

  /** The open group's latest items; marks them read. */
  private async loadTimeline(): Promise<void> {
    const me = this.state.me?.name;
    const groupId = this.state.chat.groupId;
    if (!this.client || !me || groupId === null || !this.state.chat.open) return;
    const res = await this.call(() =>
      this.api().api.feed.$get({ query: { group: String(groupId), limit: "50" } }),
    );
    await this.expectOk(res);
    const { moments } = (await res.json()) as { moments: Moment[] };
    if (this.state.chat.groupId !== groupId) return; // switched groups meanwhile
    this.state.chat.timeline = moments.map((m) => {
      const chat = m.kind === "chat";
      const d = describeMoment(m, me);
      return {
        id: m.id,
        author: chat ? m.actor : "",
        text: chat ? d.body : d.title,
        isMe: chat && m.actor === me,
        isSystem: !chat,
        createdAt: m.createdAt,
        reactions: m.reactions,
      };
    });
    const newest = moments.at(-1)?.id ?? 0;
    this.state.chat.unread = 0;
    if (newest > this.feed.chatReadId) {
      this.feed.chatReadId = newest;
      await this.saveFeed();
    }
  }

  private async loadFeed(): Promise<FeedState> {
    try {
      return { ...emptyFeed(), ...((await Bun.file(this.feedPath).json()) as Partial<FeedState>) };
    } catch {
      return emptyFeed();
    }
  }

  private async saveFeed(): Promise<void> {
    await mkdir(dirname(this.feedPath), { recursive: true });
    // Unique per write: the feed poll, the chat poll and last call can save at the same time.
    const tmp = `${this.feedPath}.${++this.saves}.tmp`;
    await writeFile(tmp, JSON.stringify(this.feed));
    await rename(tmp, this.feedPath);
  }

  /** Refresh where failure is expected (offline); the error shows in `sync.lastError`. */
  private async refreshQuietly(): Promise<void> {
    try {
      await this.refresh();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      this.state.sync.lastError = err.message;
    }
  }

  /** Forgets the account and the sync offsets: the next account starts from a clean slate. */
  private signOut(): void {
    this.stop();
    this.client = null;
    this.syncState = emptyState();
    this.feed = emptyFeed();
    void rm(this.opts.statePath, { force: true });
    void rm(this.feedPath, { force: true });
    Object.assign(this.state, {
      phase: "onboarding",
      me: null,
      progress: null,
      leaderboard: [],
      groups: [],
      view: DEFAULT_VIEW,
      chat: { open: false, groupId: null, timeline: [], unread: 0 },
    } satisfies Partial<AppState>);
  }

  /** Parse new local events and send them; one run at a time. */
  syncOnce(): Promise<void> {
    if (!this.client || !this.syncState) return Promise.resolve();
    this.syncing ??= (async () => {
      this.state.sync.syncing = true;
      this.emit();
      try {
        const r = await sync(this.syncState!, {
          statePath: this.opts.statePath,
          enabled: this.enabled,
          send: (events) => this.send(events),
          onError: (err, where) => this.log(`${where}: ${String(err)}`),
          ...(this.opts.now ? { now: this.opts.now } : {}),
        });
        this.syncState = r.state;
        this.state.sync = { ...this.state.sync, lastSyncedAt: r.state.lastSyncedAt, lastError: null };
      } catch (err) {
        // Offsets up to the last acked batch are already saved; the next run picks up there.
        this.syncState = await loadState(this.opts.statePath);
        this.state.sync.lastError = err instanceof ApiError ? err.message : String(err);
        this.log(`sync failed: ${String(err)}`);
      } finally {
        this.state.sync.syncing = false;
        this.syncing = null;
      }
    })();
    return this.syncing;
  }

  private async send(events: TokenEvent[]) {
    const res = await this.call(() =>
      this.api().api.ingest.$post({ json: { events }, query: { tz: timeZone() } }),
    );
    await this.expectOk(res);
    return (await res.json()) as { inserted: number; duplicates: number };
  }

  /** Reloads groups, the leaderboard for the current view, and my row. */
  async refresh(): Promise<void> {
    if (!this.client) return;
    const { range, groupId, sort } = this.state.view;
    const [meRes, lbRes] = await Promise.all([
      this.call(() => this.api().api.me.$get()),
      this.call(() =>
        this.api().api.leaderboard.$get({
          query: {
            range,
            sort,
            tz: String(new Date().getTimezoneOffset()),
            ...(groupId !== null ? { group: String(groupId) } : {}),
          },
        }),
      ),
    ]);
    if (lbRes.status === 404 && groupId !== null) {
      // The group is gone (left elsewhere, deleted by its owner): fall back to all groups.
      this.state.view = { ...this.state.view, groupId: null };
      return this.refresh();
    }
    await this.expectOk(meRes);
    await this.expectOk(lbRes);
    const me = (await meRes.json()) as {
      name: string;
      groups: AppState["groups"];
      progress: Omit<NonNullable<AppState["progress"]>, "achievements"> & {
        achievements: { emoji: string }[];
      };
    };
    const lb = (await lbRes.json()) as {
      entries: {
        rank: number;
        name: string;
        tokens: number;
        costUsd: number;
        parallelism: number | null;
        peakAgents: number;
        tokensPerActiveHour: number | null;
        prs: number;
        titles: string[];
        delta: number | null;
        level: number;
      }[];
    };
    this.state.groups = me.groups.map(({ id, name, code, memberCount, isOwner }) => ({
      id,
      name,
      code,
      memberCount,
      isOwner,
    }));
    const mine = lb.entries.find((e) => e.name === me.name);
    const above = mine && lb.entries.find((e) => e.rank === mine.rank - 1);
    const p = me.progress;
    this.state.progress = {
      level: p.level,
      levelTitle: p.levelTitle,
      lifetimeTokens: p.lifetimeTokens,
      daysWon30: p.daysWon30,
      winStreak: p.winStreak,
      activeStreak: p.activeStreak,
      achievements: p.achievements.map((a) => a.emoji),
    };
    this.state.me = {
      name: me.name,
      rank: mine?.rank ?? null,
      of: lb.entries.length,
      tokens: mine?.tokens ?? 0,
      costUsd: mine?.costUsd ?? 0,
      parallelism: mine?.parallelism ?? null,
      peakAgents: mine?.peakAgents ?? 0,
      tokensPerActiveHour: mine?.tokensPerActiveHour ?? null,
      prs: mine?.prs ?? 0,
      above: mine && above ? { name: above.name, gap: sortValue(sort, above) - sortValue(sort, mine) } : null,
      delta: mine?.delta ?? null,
      titles: mine?.titles ?? [],
    };
    if (range === "today" && mine) this.maybeLastCall(mine, lb.entries);
    this.state.leaderboard = lb.entries.slice(0, LEADERBOARD_TOP).map((e) => ({
      rank: e.rank,
      name: e.name,
      tokens: e.tokens,
      costUsd: e.costUsd,
      parallelism: e.parallelism,
      peakAgents: e.peakAgents,
      prs: e.prs,
      isMe: e.name === me.name,
      titles: e.titles,
      delta: e.delta,
      level: e.level,
    }));
  }

  /** After 21:00, #2 or #3 and within 20% of #1 on tokens today: one nudge per day. */
  private maybeLastCall(mine: { tokens: number }, entries: { name: string; tokens: number }[]): void {
    const now = this.now();
    const today = localDateKey(now);
    if (new Date(now).getHours() < LAST_CALL_HOUR || this.feed.lastCallDay === today) return;
    const leader = entries.reduce((a, b) => (b.tokens > a.tokens ? b : a));
    const rank = 1 + entries.filter((e) => e.tokens > mine.tokens).length;
    const gap = leader.tokens - mine.tokens;
    if (rank < 2 || rank > 3 || gap > leader.tokens * 0.2) return;
    this.feed.lastCallDay = today;
    void this.saveFeed();
    this.opts.write({
      event: "notify",
      title: "Last call",
      body: `${compact(gap)} behind ${leader.name} for #1 today. One more session?`,
    });
  }

  private api(): Client {
    if (!this.client) throw new ApiError("signed_out");
    return this.client;
  }

  private anonClient(): Client {
    return hc<AppType>(this.serverUrl, { fetch: this.opts.fetch ?? fetch });
  }

  /** Network failures become `offline`; a rejected token signs out. */
  private async call<T extends { status: number }>(fn: () => Promise<T>): Promise<T> {
    let res: T;
    try {
      res = await fn();
    } catch {
      this.state.sync.online = false;
      throw new ApiError("offline");
    }
    this.state.sync.online = true;
    if (res.status === 401 && this.client) {
      this.signOut();
      this.opts.write({ event: "token", token: null });
      throw new ApiError("unauthorized");
    }
    return res;
  }

  private async expectOk(res: { ok: boolean; status: number; json(): Promise<unknown> }): Promise<void> {
    if (res.ok) return;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `http_${res.status}`);
  }

  private sourceInfo(): AppState["sources"] {
    return SOURCES.map((id) => ({ id, label: SOURCE_LABELS[id], enabled: this.enabled.has(id) }));
  }

  private emit(): void {
    this.opts.write({ event: "state", state: structuredClone(this.state) });
  }

  private log(msg: string): void {
    (this.opts.log ?? ((m) => console.error(m)))(msg);
  }
}
