import { levelFor, levelTitle } from "@tokenmaxxing/core/format.ts";
import { PLOT_COUNT } from "@tokenmaxxing/core/maps.ts";
import { isRangeKey } from "@tokenmaxxing/core/range.ts";
import { itemById, itemsIn } from "@tokenmaxxing/core/shop.ts";
import {
  COMPANY_CAP,
  type CompanyInfo,
  defaultLook,
  type Look,
  parseLook,
} from "@tokenmaxxing/core/world.ts";
import { actor, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import { canBrand } from "../brand.ts";
import { formatInviteCode, normalizeInviteCode } from "../crypto.ts";
import { RateLimiter } from "../rate-limit.ts";
import { type ActivityRow, isSortKey, type UsageRow } from "../stats.ts";
import {
  type Leaderboard,
  leaderboard,
  type MenuBar,
  menuBar,
  type Profile,
  profile,
} from "../town/boards.ts";
import { buy, ownedItems, type Wallet, wallet } from "../town/coins.ts";
import {
  COMPANY_COLS,
  type CompanyRow,
  companyInfos,
  freshCode,
  leave,
  type MyCompany,
  myCompany,
  ownedCompany,
} from "../town/companies.ts";
import { brand, push, pushPlayers } from "../town/sync.ts";
import {
  lifetimeTokens,
  lookOf,
  type PlayerCore,
  playerCores,
  USER_COLS,
  type UserRow,
  userById,
} from "../town/users.ts";
import { parseCompanyName, parseUserName, parseWebsite } from "../validate.ts";
import type { registry } from "./registry.ts";
import {
  all,
  authenticate,
  type Caller,
  type ConnParams,
  forgetUser,
  internal,
  makeToken,
  one,
  requireInternal,
  requireUser,
  serial,
  type TokenCache,
} from "./shared.ts";

export type { BoardCompany, BoardPlayer, Leaderboard, MenuBar, Profile } from "../town/boards.ts";
export type { Wallet } from "../town/coins.ts";
export type { MyCompany } from "../town/companies.ts";
export type { PlayerCore } from "../town/users.ts";

export interface UsageDay extends UsageRow {
  day: string;
}

export interface ActivityDay extends ActivityRow {
  day: string;
}

export interface Me {
  userId: number;
  name: string;
  look: Look;
  level: number;
  levelTitle: string;
  lifetimeTokens: number;
  company: MyCompany | null;
}

/** ponytail: one global bucket (actors don't see client IPs). Per-IP limits would need the proxy. */
const SIGNUPS_PER_HOUR = 200;

/** Each one scrapes a site and asks Claude, so owners can't loop it. */
const BRANDINGS_PER_HOUR = 5;

export const town = actor({
  createVars: () => ({
    serial: serial(),
    signups: new RateLimiter(SIGNUPS_PER_HOUR, 3_600_000),
    brandings: new RateLimiter(BRANDINGS_PER_HOUR, 3_600_000),
    /** Verified tokens, so a burst of calls doesn't ask `player` every time. */
    tokens: new Map() as TokenCache,
  }),
  db: db({
    onMigrate: async (d) => {
      await d.execute(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        company_id INTEGER,
        joined_at INTEGER,
        look TEXT NOT NULL,
        created_at INTEGER NOT NULL)`);
      await d.execute("CREATE INDEX IF NOT EXISTS users_company ON users (company_id, joined_at)");
      // AUTOINCREMENT: a closed company's id is never handed out again, so a new company
      // can't inherit its house chat (`hq:<id>`) or its logo.
      await d.execute(`CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        owner_id INTEGER NOT NULL,
        plot INTEGER UNIQUE,
        website TEXT,
        branding TEXT,
        brand TEXT,
        created_at INTEGER NOT NULL)`);
      await d.execute(`CREATE TABLE IF NOT EXISTS usage_daily (
        user_id INTEGER NOT NULL, day TEXT NOT NULL, model TEXT NOT NULL,
        input INTEGER NOT NULL, output INTEGER NOT NULL,
        cache_creation INTEGER NOT NULL, cache_read INTEGER NOT NULL, turns INTEGER NOT NULL,
        PRIMARY KEY (user_id, day, model)) WITHOUT ROWID`);
      await d.execute("CREATE INDEX IF NOT EXISTS usage_day ON usage_daily (day)");
      await d.execute(`CREATE TABLE IF NOT EXISTS activity_daily (
        user_id INTEGER NOT NULL, day TEXT NOT NULL,
        prompts INTEGER NOT NULL, prs INTEGER NOT NULL,
        agent_buckets INTEGER NOT NULL, active_buckets INTEGER NOT NULL, peak_agents INTEGER NOT NULL,
        PRIMARY KEY (user_id, day)) WITHOUT ROWID`);
      await d.execute("CREATE INDEX IF NOT EXISTS activity_day ON activity_daily (day)");
      await d.execute(`CREATE TABLE IF NOT EXISTS purchases (
        user_id INTEGER NOT NULL, item TEXT NOT NULL, price INTEGER NOT NULL, at INTEGER NOT NULL,
        PRIMARY KEY (user_id, item)) WITHOUT ROWID`);
    },
  }),
  createConnState: (c, params: ConnParams): Promise<Caller> =>
    authenticate(
      params,
      (userId, secret) =>
        c
          .client<typeof registry>()
          .player.get([String(userId)], internal)
          .verify(secret),
      c.vars.tokens,
    ),
  actions: {
    signUp: async (c, rawName: unknown): Promise<{ userId: number; name: string; token: string }> => {
      const name = parseUserName(rawName);
      if (!name)
        throw new UserError("Use 2–32 characters: a–z, 0–9, dot, dash or underscore.", {
          code: "invalid_name",
        });
      if (!c.vars.signups.take("all", Date.now()))
        throw new UserError("Too many sign-ups right now. Try again in a bit.", { code: "rate_limited" });
      const client = c.client<typeof registry>();
      const userId = await c.vars.serial(async () => {
        if (await one(c.db, "SELECT 1 FROM users WHERE name = ?", name))
          throw new UserError("That name is taken.", { code: "name_taken" });
        const [row] = await all<{ id: number }>(
          c.db,
          "INSERT INTO users (name, look, created_at) VALUES (?, '{}', ?) RETURNING id",
          name,
          Date.now(),
        );
        await c.db.execute(
          "UPDATE users SET look = ? WHERE id = ?",
          JSON.stringify(defaultLook(row!.id)),
          row!.id,
        );
        return row!.id;
      });
      const { token, hash } = makeToken(userId);
      await client.player.create([String(userId)], { input: { userId, tokenHash: hash } });
      await pushPlayers(c.db, client, [userId]);
      return { userId, name, token };
    },

    me: async (c): Promise<Me> => {
      const userId = requireUser(c.conn.state);
      const u = await userById(c.db, userId);
      const lifetime = (await lifetimeTokens(c.db, [userId])).get(userId) ?? 0;
      const level = levelFor(lifetime);
      return {
        userId,
        name: u.name,
        look: lookOf(u),
        level,
        levelTitle: levelTitle(level),
        lifetimeTokens: lifetime,
        company: u.companyId === null ? null : await myCompany(c.db, u.companyId, userId),
      };
    },

    rename: async (c, rawName: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const name = parseUserName(rawName);
      if (!name)
        throw new UserError("Use 2–32 characters: a–z, 0–9, dot, dash or underscore.", {
          code: "invalid_name",
        });
      await c.vars.serial(async () => {
        const taken = await one<{ id: number }>(c.db, "SELECT id FROM users WHERE name = ?", name);
        if (taken && taken.id !== userId) throw new UserError("That name is taken.", { code: "name_taken" });
        await c.db.execute("UPDATE users SET name = ? WHERE id = ?", name, userId);
      });
      await pushPlayers(c.db, c.client<typeof registry>(), [userId]);
    },

    setLook: async (c, rawLook: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const look = parseLook(rawLook);
      if (!look) throw new UserError("Unknown look.", { code: "invalid_look" });
      const owned = new Set(await ownedItems(c.db, userId));
      if (itemsIn(look).some((i) => !owned.has(i.id)))
        throw new UserError("Buy it in the shop first.", { code: "not_owned" });
      await c.db.execute("UPDATE users SET look = ? WHERE id = ?", JSON.stringify(look), userId);
      await pushPlayers(c.db, c.client<typeof registry>(), [userId]);
    },

    createCompany: async (c, rawName: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const name = parseCompanyName(rawName);
      if (!name) throw new UserError("Use 1–32 characters.", { code: "invalid_name" });
      const changed = await c.vars.serial(async () => {
        const left = await leave(c.db, userId);
        const taken = new Set(
          (await all<{ plot: number }>(c.db, "SELECT plot FROM companies WHERE plot IS NOT NULL")).map(
            (r) => r.plot,
          ),
        );
        const plot = Array.from({ length: PLOT_COUNT }, (_, i) => i + 1).find((p) => !taken.has(p)) ?? null;
        const now = Date.now();
        const [row] = await all<{ id: number }>(
          c.db,
          "INSERT INTO companies (name, code, owner_id, plot, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
          name,
          await freshCode(c.db),
          userId,
          plot,
          now,
        );
        await c.db.execute(
          "UPDATE users SET company_id = ?, joined_at = ? WHERE id = ?",
          row!.id,
          now,
          userId,
        );
        return { companies: [...left.companies, row!.id], users: [userId] };
      });
      await push(c.db, c.client<typeof registry>(), changed);
      return myCompany(c.db, changed.companies.at(-1)!, userId);
    },

    joinCompany: async (c, rawCode: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const code = typeof rawCode === "string" ? normalizeInviteCode(rawCode) : null;
      const notFound = new UserError("No company has that code.", { code: "not_found" });
      if (!code) throw notFound;
      const changed = await c.vars.serial(async () => {
        const company = await one<CompanyRow>(
          c.db,
          `SELECT ${COMPANY_COLS} FROM companies WHERE code = ?`,
          code,
        );
        if (!company) throw notFound;
        const me = await userById(c.db, userId);
        if (me.companyId === company.id) return { companies: [company.id], users: [] };
        const [{ n }] = (await all<{ n: number }>(
          c.db,
          "SELECT COUNT(*) AS n FROM users WHERE company_id = ?",
          company.id,
        )) as [{ n: number }];
        if (n >= COMPANY_CAP) throw new UserError("That company is full.", { code: "company_full" });
        const left = await leave(c.db, userId);
        await c.db.execute(
          "UPDATE users SET company_id = ?, joined_at = ? WHERE id = ?",
          company.id,
          Date.now(),
          userId,
        );
        return { companies: [...left.companies, company.id], users: [userId] };
      });
      await push(c.db, c.client<typeof registry>(), changed);
      return myCompany(c.db, changed.companies.at(-1)!, userId);
    },

    leaveCompany: async (c): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const changed = await c.vars.serial(() => leave(c.db, userId));
      await push(c.db, c.client<typeof registry>(), changed);
    },

    kick: async (c, memberId: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const changed = await c.vars.serial(async () => {
        const company = await ownedCompany(c.db, userId);
        const member = typeof memberId === "number" ? await userById(c.db, memberId).catch(() => null) : null;
        if (!member || member.companyId !== company.id || member.id === userId)
          throw new UserError("They're not in your company.", { code: "not_found" });
        return leave(c.db, member.id);
      });
      await push(c.db, c.client<typeof registry>(), changed);
    },

    renameCompany: async (c, rawName: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const name = parseCompanyName(rawName);
      if (!name) throw new UserError("Use 1–32 characters.", { code: "invalid_name" });
      const company = await ownedCompany(c.db, userId);
      await c.db.execute("UPDATE companies SET name = ? WHERE id = ?", name, company.id);
      await push(c.db, c.client<typeof registry>(), { companies: [company.id], users: [] });
    },

    /**
     * The owner sets the company's website (empty clears it). The sign shows it at
     * once; the house is repainted in the brand's colours when reading the site is done.
     */
    setWebsite: async (c, raw: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const company = await ownedCompany(c.db, userId);
      const website = raw === "" ? null : parseWebsite(raw);
      if (website === null && raw !== "")
        throw new UserError("That doesn't look like a website. Try acme.com.", { code: "invalid_website" });
      if (website && website !== company.website && !c.vars.brandings.take(String(company.id), Date.now()))
        throw new UserError("That's a lot of websites. Try again in an hour.", { code: "rate_limited" });
      const client = c.client<typeof registry>();
      if (website !== company.website) {
        await c.db.execute(
          "UPDATE companies SET website = ?, branding = ?, brand = NULL WHERE id = ?",
          website,
          website && canBrand() ? "working" : null,
          company.id,
        );
        await push(c.db, client, { companies: [company.id], users: [] });
        if (website && canBrand()) c.waitUntil(brand(c.db, client, company.id, company.name, website));
      }
      return myCompany(c.db, company.id, userId);
    },

    rotateCode: async (c): Promise<string> => {
      const userId = requireUser(c.conn.state);
      return c.vars.serial(async () => {
        const company = await ownedCompany(c.db, userId);
        const code = await freshCode(c.db);
        await c.db.execute("UPDATE companies SET code = ? WHERE id = ?", code, company.id);
        return formatInviteCode(code);
      });
    },

    wallet: (c): Promise<Wallet> => wallet(c.db, requireUser(c.conn.state), Date.now()),

    buy: async (c, itemId: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const item = itemById(itemId);
      if (!item) throw new UserError("That's not in the shop.", { code: "not_found" });
      return c.vars.serial(() => buy(c.db, userId, item, Date.now()));
    },

    /** From `player` after an ingest: replaces those days' rollups. */
    report: async (
      c,
      userId: number,
      days: string[],
      usage: UsageDay[],
      activity: ActivityDay[],
    ): Promise<void> => {
      requireInternal(c.conn.state);
      await c.vars.serial(async () => {
        const inDays = `day IN (${days.map(() => "?").join(",")})`;
        await c.db.execute(`DELETE FROM usage_daily WHERE user_id = ? AND ${inDays}`, userId, ...days);
        for (const r of usage)
          await c.db.execute(
            "INSERT INTO usage_daily VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            userId,
            r.day,
            r.model,
            r.input,
            r.output,
            r.cacheCreation,
            r.cacheRead,
            r.turns,
          );
        for (const a of activity)
          await c.db.execute(
            "INSERT OR REPLACE INTO activity_daily VALUES (?, ?, ?, ?, ?, ?, ?)",
            userId,
            a.day,
            a.prompts,
            a.prs,
            a.agentBuckets,
            a.activeBuckets,
            a.peakAgents,
          );
      });
      const u = await userById(c.db, userId);
      await push(c.db, c.client<typeof registry>(), {
        users: [userId],
        companies: u.companyId === null ? [] : [u.companyId],
      });
    },

    leaderboard: (c, rawRange: unknown, rawSort: unknown): Promise<Leaderboard> =>
      leaderboard(
        c.db,
        requireUser(c.conn.state),
        isRangeKey(rawRange) ? rawRange : "today",
        isSortKey(rawSort) ? rawSort : "tokens",
        Date.now(),
      ),

    profile: async (c, targetId: unknown, rawRange: unknown): Promise<Profile> => {
      requireUser(c.conn.state);
      if (typeof targetId !== "number") throw new UserError("Unknown player.", { code: "not_found" });
      const range = isRangeKey(rawRange) ? rawRange : "30d";
      return profile(c.db, targetId, range, Date.now());
    },

    /** Names starting with `prefix`, for @-mention suggestions. */
    searchNames: async (c, prefix: unknown): Promise<string[]> => {
      requireUser(c.conn.state);
      if (typeof prefix !== "string" || !/^[a-z0-9._-]{1,32}$/i.test(prefix)) return [];
      const from = prefix.toLowerCase();
      const rows = await all<{ name: string }>(
        c.db,
        "SELECT name FROM users WHERE name >= ? AND name < ? ORDER BY name LIMIT 8",
        from,
        `${from}\uffff`,
      );
      return rows.map((r) => r.name);
    },

    /** The menu bar app: my numbers today and the world's top 10. */
    menuBar: (c): Promise<MenuBar> => menuBar(c.db, requireUser(c.conn.state), Date.now()),

    /** From `player` on sign-out: stop trusting that user's cached tokens. */
    forget: (c, userId: number): void => {
      requireInternal(c.conn.state);
      forgetUser(c.vars.tokens, userId);
    },

    /** For `world` starting from nothing: everyone and every company. */
    seed: async (c): Promise<{ players: PlayerCore[]; companies: CompanyInfo[] }> => {
      requireInternal(c.conn.state);
      const users = await all<UserRow>(c.db, `SELECT ${USER_COLS} FROM users`);
      const companies = await all<{ id: number }>(c.db, "SELECT id FROM companies");
      return {
        players: await playerCores(
          c.db,
          users.map((u) => u.id),
        ),
        companies: await companyInfos(
          c.db,
          companies.map((r) => r.id),
        ),
      };
    },
  },
});
