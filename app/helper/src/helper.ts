import { rm } from "node:fs/promises";
import { type AppState, type Command, type Message, SOURCE_LABELS } from "@tokenmaxxing/core/protocol.ts";
import { emptyState, loadState } from "@tokenmaxxing/core/sync/state.ts";
import { sync } from "@tokenmaxxing/core/sync/sync.ts";
import { SOURCES, type Source, type SyncState, type TokenEvent } from "@tokenmaxxing/core/types.ts";
import type { registry } from "@tokenmaxxing/server/registry";
import { createClient } from "rivetkit/client";
import {
  brewPath,
  checkForUpdate,
  RELEASES_URL,
  startBrewUpgrade,
  UPDATE_CHECK_INTERVAL_MS,
} from "./update.ts";

/** Often enough that your character sits down at the desk soon after your agents start. */
export const SYNC_INTERVAL_MS = 2 * 60_000;

export interface HelperOptions {
  statePath: string;
  version: string;
  write: (msg: Message) => void;
  log?: (msg: string) => void;
  /** Only for the update check. */
  fetch?: typeof fetch;
  now?: () => number;
}

/** A failed call with a stable code the shell can map to a message. */
class ApiError extends Error {}

type Client = ReturnType<typeof createClient<typeof registry>>;

/** Actor errors carry a code; anything without one is the network. */
function apiError(err: unknown): ApiError {
  const code = (err as { code?: unknown } | null)?.code;
  return new ApiError(typeof code === "string" && code !== "internal_error" ? code : "offline");
}

export class Helper {
  private client: Client | null = null;
  private token: string | null = null;
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
      me: null,
      leaderboard: [],
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
        // No metadata lookup: our server is the endpoint, and the lookup retries forever when offline.
        this.client = createClient<typeof registry>({
          endpoint: `${this.serverUrl}/api/rivet`,
          devtools: false,
          disableMetadataLookup: true,
        });
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
        const r = await this.call(() => this.api().town.getOrCreate(["main"]).signUp(cmd.name));
        this.opts.write({ event: "token", token: r.token });
        await this.signIn(r.token);
        return { name: r.name };
      }
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
      case "openWorld": {
        const code = await this.call(() => this.player().mintLoginCode());
        return { url: `${this.serverUrl}/#code=${encodeURIComponent(code)}` };
      }
      case "installUpdate": {
        const brew = brewPath();
        if (!brew || !this.state.update) return { url: RELEASES_URL };
        this.state.update = { ...this.state.update, installing: true };
        startBrewUpgrade(brew);
        return;
      }
      case "signOut": {
        // Forget locally first, so a sync in flight can't see the revocation as a rejected token.
        // Then revoke this device and every browser session; offline, the local part still holds.
        const player = this.player();
        this.signOut();
        await player.signOut().catch(() => {});
        return;
      }
    }
  }

  private api(): Client {
    if (!this.client) throw new ApiError("not_ready");
    return this.client;
  }

  private params() {
    if (!this.token) throw new ApiError("signed_out");
    return { params: { token: this.token } };
  }

  private town() {
    return this.api().town.getOrCreate(["main"], this.params());
  }

  private player() {
    return this.api().player.get([this.token?.split(".")[0] ?? "0"], this.params());
  }

  private async signIn(token: string): Promise<void> {
    this.token = token;
    this.state.phase = "ready";
    this.state.sync.lastSyncedAt = this.syncState?.lastSyncedAt ?? null;
    this.timer ??= setInterval(() => void this.tick(), SYNC_INTERVAL_MS);
    void this.tick();
    await this.refreshQuietly();
  }

  /** Periodic work: send new local usage, then reload my numbers. */
  async tick(): Promise<void> {
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
    this.token = null;
    this.syncState = emptyState();
    void rm(this.opts.statePath, { force: true });
    Object.assign(this.state, { phase: "onboarding", me: null, leaderboard: [] } satisfies Partial<AppState>);
  }

  /** Parse new local events and send them; one run at a time. */
  syncOnce(): Promise<void> {
    if (!this.token || !this.syncState) return Promise.resolve();
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

  private send(events: TokenEvent[]) {
    return this.call(() => this.player().ingest(events));
  }

  /** Today in the world: my numbers and the top 10. */
  async refresh(): Promise<void> {
    if (!this.token) return;
    const { me, top } = await this.call(() => this.town().menuBar());
    this.state.me = {
      name: me.name,
      rank: me.rank,
      tokensToday: me.tokensToday,
      level: me.level,
      levelTitle: me.levelTitle,
    };
    this.state.leaderboard = top.map(({ rank, name, company, tokens, level, isMe }) => ({
      rank,
      name,
      company,
      tokens,
      level,
      isMe,
    }));
    this.state.sync.lastError = null;
  }

  /** Network failures become `offline`; a rejected token signs out. */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.state.sync.online = true;
      return result;
    } catch (err) {
      const e = err instanceof ApiError ? err : apiError(err);
      this.state.sync.online = e.message !== "offline";
      if (e.message === "unauthorized" && this.token) {
        this.signOut();
        this.opts.write({ event: "token", token: null });
      }
      throw e;
    }
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
