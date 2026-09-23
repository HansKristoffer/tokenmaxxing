import { rm } from "node:fs/promises";
import {
  type AppState,
  type Command,
  LEADERBOARD_TOP,
  type Message,
  SOURCE_LABELS,
  type View,
} from "@tokenmaxxing/core/protocol.ts";
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
  readonly state: AppState;

  constructor(private readonly opts: HelperOptions) {
    this.state = {
      phase: "starting",
      version: opts.version,
      view: DEFAULT_VIEW,
      me: null,
      leaderboard: [],
      groups: [],
      sync: { syncing: false, lastSyncedAt: null, lastError: null, online: true },
      sources: this.sourceInfo(),
      update: null,
    };
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
    }
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

  /** Periodic work: send new local usage, then pick up everyone else's. */
  private async tick(): Promise<void> {
    await this.syncOnce();
    await this.refreshQuietly();
    this.emit();
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
    void rm(this.opts.statePath, { force: true });
    Object.assign(this.state, {
      phase: "onboarding",
      me: null,
      leaderboard: [],
      groups: [],
      view: DEFAULT_VIEW,
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
    const res = await this.call(() => this.api().api.ingest.$post({ json: { events } }));
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
    const me = (await meRes.json()) as { name: string; groups: AppState["groups"] };
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
    };
    this.state.leaderboard = lb.entries.slice(0, LEADERBOARD_TOP).map((e) => ({
      rank: e.rank,
      name: e.name,
      tokens: e.tokens,
      costUsd: e.costUsd,
      parallelism: e.parallelism,
      peakAgents: e.peakAgents,
      prs: e.prs,
      isMe: e.name === me.name,
    }));
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
