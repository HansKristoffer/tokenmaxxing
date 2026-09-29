import { PLOT_COUNT } from "@tokenmaxxing/core/maps.ts";
import { isRangeKey } from "@tokenmaxxing/core/range.ts";
import { itemById, itemsIn } from "@tokenmaxxing/core/shop.ts";
import { type CompanyInfo, defaultLook, type Look, parseLook } from "@tokenmaxxing/core/world.ts";
import { actor, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import { canBrand } from "../brand.ts";
import { RateLimiter } from "../rate-limit.ts";
import { type ActivityRow, isSortKey, type UsageRow } from "../stats.ts";
import { type Leaderboard, leaderboard, type Profile, profile, type Today, today } from "../town/boards.ts";
import {
  buy,
  type Entry,
  type HoldKind,
  heldIn,
  hold,
  ownedItems,
  type PayKind,
  pay,
  refund,
  type Wallet,
  wallet,
} from "../town/coins.ts";
import {
  applicationOf,
  apply,
  approve,
  companyInfos,
  decline,
  type Listing,
  leave,
  listings,
  type MyCompany,
  myCompany,
  ownedCompany,
  withdraw,
} from "../town/companies.ts";
import { type GamePlayer, gameBoard, type Placed, recordMatch } from "../town/games.ts";
import { migrate } from "../town/schema.ts";
import { brand, notify, push, pushPlayers } from "../town/sync.ts";
import { lookOf, type PlayerCore, playerCores, USER_COLS, type UserRow, userById } from "../town/users.ts";
import { parseCompanyName, parseUserName, parseWebsite } from "../validate.ts";
import type { registry } from "./registry.ts";
import {
  all,
  authenticate,
  type Caller,
  type ConnParams,
  makeToken,
  one,
  requireInternal,
  requireUser,
  type Sql,
  serial,
  type TokenCache,
} from "./shared.ts";

export type { BoardCompany, BoardPlayer, Leaderboard, Profile, Today } from "../town/boards.ts";
export type { Wallet } from "../town/coins.ts";
export type { Listing, MyCompany } from "../town/companies.ts";
export type { GamePlayer, GameStats } from "../town/games.ts";
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
  company: MyCompany | null;
  /** The company I've asked to join and am waiting to hear from. */
  application: { companyId: number; name: string } | null;
}

/** ponytail: one global bucket (actors don't see client IPs). Per-IP limits would need the proxy. */
const SIGNUPS_PER_HOUR = 200;

/** Each one scrapes a site and asks Claude, so owners can't loop it. */
const BRANDINGS_PER_HOUR = 5;
/** Each one pings the company's owner. */
const APPLICATIONS_PER_HOUR = 10;

function userName(raw: unknown): string {
  const name = parseUserName(raw);
  if (!name)
    throw new UserError("Use 2–32 characters: a–z, 0–9, dot, dash or underscore.", { code: "invalid_name" });
  return name;
}

function companyName(raw: unknown): string {
  const name = parseCompanyName(raw);
  if (!name) throw new UserError("Use 1–32 characters.", { code: "invalid_name" });
  return name;
}

export const town = actor({
  createVars: () => ({
    serial: serial(),
    signups: new RateLimiter(SIGNUPS_PER_HOUR, 3_600_000),
    brandings: new RateLimiter(BRANDINGS_PER_HOUR, 3_600_000),
    applications: new RateLimiter(APPLICATIONS_PER_HOUR, 3_600_000),
    /** Verified tokens, so a burst of calls doesn't ask `player` every time. */
    tokens: new Map() as TokenCache,
  }),
  db: db({ onMigrate: migrate }),
  createConnState: (c, params: ConnParams): Promise<Caller> =>
    authenticate(params, c.client(), c.vars.tokens),
  actions: {
    signUp: async (c, rawName: unknown): Promise<{ userId: number; name: string; token: string }> => {
      const name = userName(rawName);
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
      return {
        userId,
        name: u.name,
        look: lookOf(u),
        company: u.companyId === null ? null : await myCompany(c.db, u.companyId, userId),
        application: await applicationOf(c.db, userId),
      };
    },

    rename: async (c, rawName: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const name = userName(rawName);
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
      const name = companyName(rawName);
      const changed = await c.vars.serial(async () => {
        const left = await leave(c.db, userId);
        await withdraw(c.db, userId);
        const taken = new Set(
          (await all<{ plot: number }>(c.db, "SELECT plot FROM companies WHERE plot IS NOT NULL")).map(
            (r) => r.plot,
          ),
        );
        const plot = Array.from({ length: PLOT_COUNT }, (_, i) => i + 1).find((p) => !taken.has(p)) ?? null;
        const now = Date.now();
        const [row] = await all<{ id: number }>(
          c.db,
          "INSERT INTO companies (name, owner_id, plot, created_at) VALUES (?, ?, ?, ?) RETURNING id",
          name,
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

    /** Every company, for choosing one to apply to. */
    listings: (c): Promise<Listing[]> => {
      requireUser(c.conn.state);
      return listings(c.db);
    },

    /** Asks to join a company; its owner accepts or declines. */
    apply: async (c, companyId: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      if (typeof companyId !== "number") throw new UserError("That company is gone.", { code: "not_found" });
      if (!c.vars.applications.take(String(userId), Date.now()))
        throw new UserError("That's a lot of applications. Try again in an hour.", { code: "rate_limited" });
      const company = await c.vars.serial(() => apply(c.db, userId, companyId, Date.now()));
      const me = await userById(c.db, userId);
      await notify(c.client<typeof registry>(), company.ownerId, `${me.name} asks to join ${company.name}.`);
    },

    withdraw: async (c): Promise<void> => {
      await withdraw(c.db, requireUser(c.conn.state));
    },

    approve: async (c, applicantId: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const client = c.client<typeof registry>();
      const { company, changed } = await c.vars.serial(async () => {
        const company = await ownedCompany(c.db, userId);
        return { company, changed: await approve(c.db, company, applicantId, Date.now()) };
      });
      await push(c.db, client, changed);
      await notify(client, changed.users[0]!, `You're in! Welcome to ${company.name}.`);
      return myCompany(c.db, company.id, userId);
    },

    decline: async (c, applicantId: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const company = await ownedCompany(c.db, userId);
      const declined = await c.vars.serial(() => decline(c.db, company, applicantId));
      await notify(c.client<typeof registry>(), declined, `${company.name} said no this time.`);
      return myCompany(c.db, company.id, userId);
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
      const name = companyName(rawName);
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

    /** The HUD's corner: my numbers today and today's top 5. */
    today: (c): Promise<Today> => today(c.db, requireUser(c.conn.state), Date.now()),

    // MARK: Coins for games (from `arcade` only)

    /** Takes a stake or a side bet from each entry, or from nobody. */
    hold: async (c, ref: string, kind: HoldKind, entries: Entry[]): Promise<void> => {
      requireInternal(c.conn.state);
      const names = await namesOf(
        c.db,
        entries.map((e) => e.userId),
      );
      await c.vars.serial(() => hold(c.db, ref, kind, entries, names, Date.now()));
    },

    pay: async (c, ref: string, kind: PayKind, entries: Entry[]): Promise<void> => {
      requireInternal(c.conn.state);
      await c.vars.serial(() => pay(c.db, ref, kind, entries, Date.now()));
    },

    /** What a ref still holds, so settling a game can be retried without paying twice. */
    held: async (c, ref: string): Promise<number> => {
      requireInternal(c.conn.state);
      return [...(await heldIn(c.db, ref)).values()].reduce((a, b) => a + b, 0);
    },

    refund: async (c, ref: string, userIds?: number[]): Promise<void> => {
      requireInternal(c.conn.state);
      await c.vars.serial(() => refund(c.db, ref, Date.now(), userIds));
    },

    /** A finished game, for stats. */
    recordMatch: async (
      c,
      matchId: number,
      game: string,
      stake: number,
      players: Placed[],
    ): Promise<void> => {
      requireInternal(c.conn.state);
      await recordMatch(c.db, matchId, game, stake, players, Date.now());
    },

    gameBoard: (c, rawRange: unknown): Promise<GamePlayer[]> => {
      requireUser(c.conn.state);
      return gameBoard(c.db, isRangeKey(rawRange) ? rawRange : "today", Date.now());
    },

    /** User ids for names (inviting people to a game by name). */
    ids: async (c, names: string[]): Promise<Record<string, number>> => {
      requireInternal(c.conn.state);
      const rows = await all<{ id: number; name: string }>(
        c.db,
        "SELECT id, name FROM users WHERE name IN (SELECT value FROM json_each(?))",
        JSON.stringify(names.map((n) => String(n).toLowerCase())),
      );
      return Object.fromEntries(rows.map((r) => [r.name, r.id]));
    },

    /** Names for user ids (tables and matches show who's playing). */
    names: async (c, userIds: number[]): Promise<Record<number, string>> => {
      requireInternal(c.conn.state);
      return namesOf(c.db, userIds);
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

async function namesOf(sql: Sql, userIds: number[]): Promise<Record<number, string>> {
  const rows = await all<{ id: number; name: string }>(
    sql,
    "SELECT id, name FROM users WHERE id IN (SELECT value FROM json_each(?))",
    JSON.stringify(userIds),
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
