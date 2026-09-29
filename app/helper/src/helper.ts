import { rm } from "node:fs/promises";
import type { AppState, Command, Message } from "@tokenmaxxing/core/protocol.ts";
import type { GhRunner } from "@tokenmaxxing/core/sources/github.ts";
import { emptyState, loadState } from "@tokenmaxxing/core/sync/state.ts";
import { sync } from "@tokenmaxxing/core/sync/sync.ts";
import type { SyncState, TokenEvent } from "@tokenmaxxing/core/types.ts";
import type { registry } from "@tokenmaxxing/server/registry";
import { createClient } from "rivetkit/client";

/** Often enough that your character sits down at the desk soon after your agents start. */
const SYNC_INTERVAL_MS = 2 * 60_000;
/** During a Tokenmaxxing battle, so the scoreboard moves while you burn. */
const BATTLE_SYNC_MS = 10_000;

export interface HelperOptions {
  statePath: string;
  write: (msg: Message) => void;
  log?: (msg: string) => void;
  /** Runs `gh` for GitHub PRs; defaults to the installed one, null skips it (tests). */
  gh?: GhRunner | null;
}

/** A failed call with a stable code the shell can map to a message. */
class ApiError extends Error {}

type Client = ReturnType<typeof createClient<typeof registry>>;

/** Actor errors carry a code; anything without one is the network. */
function apiError(err: unknown): ApiError {
  const code = (err as { code?: unknown } | null)?.code;
  return new ApiError(typeof code === "string" && code !== "internal_error" ? code : "offline");
}

/**
 * The menu bar app's engine: sign up once, then send new local usage in the
 * background (every 2 minutes, every 10 seconds during a battle), and mint
 * login codes for the game window.
 */
export class Helper {
  private client: Client | null = null;
  private token: string | null = null;
  private syncState: SyncState | null = null;
  private syncing: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private every = 0;
  readonly state: AppState;

  constructor(private readonly opts: HelperOptions) {
    this.state = { phase: "starting", today: null, battle: null };
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

  private async run(cmd: Command): Promise<unknown> {
    switch (cmd.cmd) {
      case "init":
        // No metadata lookup: our server is the endpoint, and the lookup retries forever when offline.
        this.client = createClient<typeof registry>({
          endpoint: `${cmd.serverUrl.replace(/\/+$/, "")}/api/rivet`,
          devtools: false,
          disableMetadataLookup: true,
        });
        this.syncState = await loadState(this.opts.statePath);
        if (cmd.token) await this.signIn(cmd.token);
        else this.state.phase = "onboarding";
        return;
      case "signUp": {
        const r = await this.call(() => this.api().town.getOrCreate(["main"]).signUp(cmd.name));
        this.opts.write({ event: "token", token: r.token });
        await this.signIn(r.token);
        return;
      }
      case "syncNow":
        await this.tick();
        return;
      case "openWorld":
        return { code: await this.call(() => this.player().mintLoginCode()) };
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

  private player() {
    return this.api().player.get([this.token?.split(".")[0] ?? "0"], this.params());
  }

  /** Checks the token (a rejected one goes back to onboarding), then syncs in the background. */
  private async signIn(token: string): Promise<void> {
    this.token = token;
    this.state.phase = "ready";
    await this.refresh();
    void this.tick();
  }

  /** Syncs every `ms` (fast during a battle), restarting the timer only when that changes. */
  private cadence(ms: number): void {
    if (this.timer && this.every === ms) return;
    if (this.timer) clearInterval(this.timer);
    this.every = ms;
    this.timer = setInterval(() => void this.tick(), ms);
  }

  /** Periodic work: send new local usage, then show where that leaves me. */
  async tick(): Promise<void> {
    await this.syncOnce();
    await this.refresh();
  }

  /**
   * My count today and the battle I'm in, for the menu bar. In a battle, sync fast so its scoreboard
   * moves. Offline, the last numbers stay up.
   */
  async refresh(): Promise<void> {
    if (!this.token) return;
    try {
      const [today, battle] = await this.call(() =>
        Promise.all([
          this.api().town.getOrCreate(["main"], this.params()).today(),
          this.api().arcade.getOrCreate(["main"], this.params()).battle(),
        ]),
      );
      this.state.today = { tokens: today.me.tokensToday, rank: today.me.rank, level: today.me.level };
      this.state.battle = battle;
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    if (this.token) this.cadence(this.state.battle ? BATTLE_SYNC_MS : SYNC_INTERVAL_MS);
    this.emit();
  }

  /** Forgets the account and the sync offsets: the next account starts from a clean slate. */
  private signOut(): void {
    this.stop();
    this.token = null;
    this.syncState = emptyState();
    void rm(this.opts.statePath, { force: true });
    Object.assign(this.state, { phase: "onboarding", today: null, battle: null });
  }

  /** Parse new local events and send them; one run at a time. */
  syncOnce(): Promise<void> {
    if (!this.token || !this.syncState) return Promise.resolve();
    this.syncing ??= (async () => {
      try {
        const r = await sync(this.syncState!, {
          statePath: this.opts.statePath,
          send: (events) => this.send(events),
          onError: (err, where) => this.log(`${where}: ${String(err)}`),
          ...(this.opts.gh !== undefined ? { gh: this.opts.gh } : {}),
        });
        this.syncState = r.state;
      } catch (err) {
        // Offsets up to the last acked batch are already saved; the next run picks up there.
        this.syncState = await loadState(this.opts.statePath);
        this.log(`sync failed: ${String(err)}`);
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }

  private send(events: TokenEvent[]) {
    return this.call(() => this.player().ingest(events));
  }

  /** Network failures become `offline`; a rejected token signs out and tells the shell to forget it. */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const e = err instanceof ApiError ? err : apiError(err);
      if (e.message === "unauthorized" && this.token) {
        this.signOut();
        this.opts.write({ event: "token", token: null });
        this.emit();
      }
      throw e;
    }
  }

  private emit(): void {
    this.opts.write({ event: "state", state: structuredClone(this.state) });
  }

  private log(msg: string): void {
    (this.opts.log ?? ((m) => console.error(m)))(msg);
  }
}
