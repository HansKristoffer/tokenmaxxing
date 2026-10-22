import type { Ticket } from "@tokenmaxxing/core/cop.ts";
import { editionById } from "@tokenmaxxing/core/editions.ts";
import { frontier } from "@tokenmaxxing/core/maps.ts";
import { headlines, type Paper } from "@tokenmaxxing/core/paper.ts";
import { type RaidWeek, raidWeekAt } from "@tokenmaxxing/core/raid.ts";
import { addDays, dayKey, isRangeKey } from "@tokenmaxxing/core/range.ts";
import {
  emptySide,
  isTradeable,
  itemById,
  itemsIn,
  merchIn,
  parseSide,
  TRADE_COINS_CAP,
  TRADE_ITEMS_CAP,
} from "@tokenmaxxing/core/shop.ts";
import type { Trophy } from "@tokenmaxxing/core/trophies.ts";
import {
  type CompanyInfo,
  type Drop,
  defaultLook,
  dropName,
  type Look,
  parseLook,
} from "@tokenmaxxing/core/world.ts";
import { chunkArray, must } from "hanzio";
import { actor, UserError } from "rivetkit";
import { db } from "rivetkit/db";
import { canBrand } from "../brand.ts";
import { RateLimiter } from "../rate-limit.ts";
import { type ActivityRow, isSortKey, type UsageRow } from "../stats.ts";
import {
  type AdminCompany,
  type AdminLogEntry,
  type AdminOverview,
  type AdminUser,
  companies as adminCompanies,
  adminLog,
  users as adminUsers,
  closeCompany,
  deleteUser,
  logAdmin,
  overview,
  setCompanyWallet,
  wipeUsage,
} from "../town/admin.ts";
import {
  boardsChanged,
  type CompanyProfile,
  companyProfile,
  type Leaderboard,
  leaderboard,
  type Profile,
  profile,
  type Today,
  today,
} from "../town/boards.ts";
import {
  type BagRow,
  bag,
  buy,
  buyMerch,
  checkTrade,
  type Entry,
  floors,
  giveBack,
  grantRewards,
  type HoldKind,
  heldIn,
  hold,
  type Kept,
  type Office,
  offices,
  ownedItems,
  type PayKind,
  type Podium,
  pay,
  pickUp,
  placed,
  podiums,
  refund,
  setBalance,
  settleTrade,
  TRADE_TTL,
  type Trade,
  takeOut,
  tradesWhere,
  unclaimed,
  unwear,
  type Wallet,
  wallet,
} from "../town/coins.ts";
import {
  applicationOf,
  apply,
  approve,
  buyPiece,
  companyById,
  companyInfos,
  companyOrGone,
  decline,
  type Listing,
  leave,
  listings,
  type MyCompany,
  matchCoins,
  myCompany,
  ownedCompany,
  setMerchDesign,
  unstore,
  withdraw,
} from "../town/companies.ts";
import { buyDesk, buyDeskFleet, type MyDesk, myDesk, setDesk } from "../town/desks.ts";
import { type GamePlayer, gameBoard, type Placed, recordMatch } from "../town/games.ts";
import { announceLoot, grantLoot, lootBoost, raidLoot } from "../town/loot.ts";
import { buyEdition, type Cart, type Copy, cart, copiesOf } from "../town/merchant.ts";
import {
  applyDecor,
  buyDecor,
  type OpenOffice,
  ownedDecor,
  recordVisit,
  visitorCounts,
} from "../town/offices.ts";
import { markPicnic } from "../town/picnic.ts";
import { type Raid, raid, raidHistory, raidStart } from "../town/raid.ts";
import { migrate } from "../town/schema.ts";
import { paperFacts } from "../town/street.ts";
import { brand, push, pushOffice, pushPlayers } from "../town/sync.ts";
import { giveTicket } from "../town/tickets.ts";
import { levelOf, lookOf, type PlayerCore, playerCores, userById } from "../town/users.ts";
import { parseCompanyName, parseUserName, parseWebsite } from "../validate.ts";
import type { registry } from "./registry.ts";
import {
  all,
  authenticate,
  type Caller,
  type ConnParams,
  clientIpOf,
  INTERNAL_KEY,
  internal,
  main,
  makeToken,
  notify,
  one,
  requireAdmin,
  requireInternal,
  requireMain,
  requireSyncer,
  requireUser,
  type Sql,
  serial,
  type TxSql,
} from "./shared.ts";

export type { AdminCompany, AdminLogEntry, AdminOverview, AdminUser } from "../town/admin.ts";
export type {
  BoardCompany,
  BoardPlayer,
  CompanyProfile,
  Leaderboard,
  Profile,
  Today,
} from "../town/boards.ts";
export type { BagRow, Office, Trade, Wallet } from "../town/coins.ts";
export type { Listing, MyCompany, WalletLine } from "../town/companies.ts";
export type { GamePlayer } from "../town/games.ts";
export type { Cart, Copy } from "../town/merchant.ts";
export type { Raid } from "../town/raid.ts";
export type { PlayerCore } from "../town/users.ts";

export interface UsageDay extends UsageRow {
  day: string;
}

export interface ActivityDay extends ActivityRow {
  day: string;
  /** Tokens past the per-minute cap, which count for nothing. */
  capped: number;
}

export interface Me {
  userId: number;
  name: string;
  look: Look;
  company: MyCompany | null;
  /** The company I've asked to join and am waiting to hear from. */
  application: { companyId: number; name: string } | null;
}

/**
 * Per client IP (from `proxy.ts`): an office signing up together fits, a script doesn't. The
 * global bucket is the backstop against many IPs at once.
 */
const SIGNUPS_PER_IP_PER_HOUR = 20;
const SIGNUPS_PER_HOUR = 1000;

/** Each one scrapes a site and asks Claude, so owners can't loop it. */
const BRANDINGS_PER_HOUR = 5;
/** Each one pings the company's owner. */
const APPLICATIONS_PER_HOUR = 10;
/** Each one pings the other person. */
const TRADES_PER_HOUR = 10;
/** Each one sends a room (an office, a building, the town) to everyone in it again. */
const ROOM_CHANGES_PER_MIN = 30;
/** A new name is a new door sign: the building is rebuilt. */
const RENAMES_PER_HOUR = 10;
const MIN = 60_000;
const HOUR = 3_600_000;
/** Drops nobody took go back to their droppers after this; the sweeper looks every `SWEEP_MS`. */
const DROP_TTL = HOUR;
const SWEEP_MS = 10 * 60_000;

/** Many rows in few statements (a first sync can report years of days). */
async function insertRows(sql: Sql, insert: string, rows: unknown[][]): Promise<void> {
  for (const chunk of chunkArray(rows, 200)) {
    const row = `(${chunk[0]!.map(() => "?").join(",")})`;
    await sql.execute(`${insert} ${chunk.map(() => row).join(",")}`, ...chunk.flat());
  }
}

type TownConn = Caller & { ip: string | null };

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
    signups: new RateLimiter(SIGNUPS_PER_HOUR, HOUR),
    signupsPerIp: new RateLimiter(SIGNUPS_PER_IP_PER_HOUR, HOUR),
    brandings: new RateLimiter(BRANDINGS_PER_HOUR, HOUR),
    applications: new RateLimiter(APPLICATIONS_PER_HOUR, HOUR),
    trades: new RateLimiter(TRADES_PER_HOUR, HOUR),
    offices: new RateLimiter(ROOM_CHANGES_PER_MIN, MIN),
    desks: new RateLimiter(ROOM_CHANGES_PER_MIN, MIN),
    drops: new RateLimiter(ROOM_CHANGES_PER_MIN, MIN),
    /** The open offices, read by everyone for a few seconds. */
    openOffices: null as { at: number; rows: Promise<OpenOfficeRow[]> } | null,
    renames: new RateLimiter(RENAMES_PER_HOUR, HOUR),
    /** `podiums` for a world day, for wallets and cards; a late sync or a wiped account drops it. */
    podiums: null as { day: string; rows: Promise<Podium[]> } | null,
    /** Today's paper (about yesterday): built on the first read of the day, then kept. */
    paper: null as { day: string; paper: Promise<Paper> } | null,
    /** `raidHistory`, shared by everyone polling the raid for a few seconds. */
    raids: null as { at: number; rows: Promise<RaidWeek[]> } | null,
  }),
  db: db({ onMigrate: migrate }),
  onCreate: (c) => requireMain(c),
  createConnState: async (c, params: ConnParams): Promise<TownConn> => ({
    ...(await authenticate(params, c.client())),
    ip: clientIpOf(c.request),
  }),
  // The sweeper's alarm. Set once: it outlives restarts, and wakes the town when it's asleep.
  // And the raid's launch, the first time: next Monday 08:00 (`raidStart`).
  onWake: async (c) => {
    if (!(await c.cron.get("sweep")))
      await c.cron.every({ name: "sweep", interval: SWEEP_MS, action: "sweep" });
    await raidStart(c.db, Date.now());
  },
  actions: {
    health: async (c): Promise<void> => {
      requireInternal(c.conn.state);
      await c.db.execute("SELECT 1");
    },
    signUp: async (c, rawName: unknown): Promise<{ userId: number; name: string; token: string }> => {
      const name = userName(rawName);
      const now = Date.now();
      if (!c.vars.signupsPerIp.take(c.conn.state.ip ?? "inside", now) || !c.vars.signups.take("all", now))
        throw new UserError("Too many sign-ups right now. Try again in a bit.", { code: "rate_limited" });
      const client = c.client<typeof registry>();
      const userId = await c.vars.serial(async () => {
        if (await one(c.db, "SELECT 1 FROM users WHERE name = ?", name))
          throw new UserError("That name is taken.", { code: "name_taken" });
        // After every id there's been: deleted accounts and lost sign-ups too. Each MAX is one index read.
        const [row] = await all<{ id: number }>(
          c.db,
          `INSERT INTO users (id, name, look, created_at) VALUES (
             MAX(COALESCE((SELECT MAX(id) FROM users), 0), COALESCE((SELECT MAX(id) FROM deleted_users), 0),
                 COALESCE((SELECT MAX(id) FROM lost_signups), 0)) + 1,
             ?, '{}', ?) RETURNING id`,
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
      try {
        await client.player.create([String(userId)], {
          input: { userId, tokenHash: hash, internal: INTERNAL_KEY },
        });
      } catch (err) {
        // Nobody holds a token for this account, so it goes; the name is free again. Not its id: a
        // timeout may have made the actor all the same, and every sign-up after would fail on it.
        await c.db.execute("DELETE FROM users WHERE id = ?", userId);
        await c.db.execute("INSERT OR IGNORE INTO lost_signups (id, at) VALUES (?, ?)", userId, Date.now());
        boardsChanged();
        throw err;
      }
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
      if (!c.vars.renames.take(String(userId), Date.now()))
        throw new UserError("That's a lot of new names. Try again in an hour.", { code: "rate_limited" });
      await renameUser(c.db, c.vars.serial, c.client<typeof registry>(), userId, rawName);
    },

    setLook: async (c, rawLook: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const look = must(parseLook(rawLook), () => new UserError("Unknown look.", { code: "invalid_look" }));
      // Serialized, so a drop or a trade can't take it off between the check and the write.
      await c.vars.serial(async () => {
        const owned = new Set(await ownedItems(c.db, userId));
        if ([...itemsIn(look).map((i) => i.id), ...merchIn(look)].some((id) => !owned.has(id)))
          throw new UserError("You don't have one in your bag.", { code: "not_owned" });
        await c.db.execute("UPDATE users SET look = ? WHERE id = ?", JSON.stringify(look), userId);
      });
      await pushPlayers(c.db, c.client<typeof registry>(), [userId]);
    },

    /** `rawPlot`: the block to build on, one of `frontier()`; the one nearest the square without. */
    createCompany: async (c, rawName: unknown, rawPlot?: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const name = companyName(rawName);
      const changed = await c.vars.serial(async () => {
        const taken = await all<{ plot: number }>(c.db, "SELECT plot FROM companies");
        const free = frontier(taken.map((r) => r.plot));
        const plot = (rawPlot ?? free[0]) as number;
        if (!free.includes(plot))
          throw new UserError("Someone just built there. Pick another spot.", { code: "plot_taken" });
        const left = await leave(c.db, userId);
        await withdraw(c.db, userId);
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
      await notify(c.client<typeof registry>(), company.ownerId, {
        text: `${me.name} asks to join ${company.name}.`,
        open: "company",
      });
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
      await notify(client, changed.users[0]!, {
        text: `You're in! Welcome to ${company.name}.`,
        open: "company",
      });
      return myCompany(c.db, company.id, userId);
    },

    decline: async (c, applicantId: unknown): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      const company = await ownedCompany(c.db, userId);
      const declined = await c.vars.serial(() => decline(c.db, company, applicantId));
      await notify(c.client<typeof registry>(), declined, {
        text: `${company.name} said no this time.`,
        open: "company",
      });
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
      const company = await ownedCompany(c.db, userId);
      await renameCompany(c.db, c.client<typeof registry>(), company.id, rawName);
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

    /** Any member sets the company's merch design (null: back to the brand's colours). */
    setMerch: async (c, raw: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const companyId = await setMerchDesign(c.db, userId, raw);
      await push(c.db, c.client<typeof registry>(), { companies: [companyId], users: [] });
    },

    wallet: async (c): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      return wallet(c.db, userId, now, await kept(c, now));
    },

    /** This week's ladder (last week's until Monday 08:00): the boss up now, how hurt it is, and who's hitting it. */
    raid: async (c): Promise<Raid> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      const r = await raid(c.db, userId, await raidsOf(c, now), now);
      return { ...r, loot: await raidLoot(c.db, userId, r.week, r.boss, lootBoost()) };
    },

    /** What I hold, per kind, for the bag panel. */
    bag: (c): Promise<BagRow[]> => bag(c.db, requireUser(c.conn.state)),

    buy: async (c, itemId: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const item = itemById(itemId);
      if (!item) throw new UserError("That's not in the shop.", { code: "not_found" });
      if (item.level !== undefined || item.earned)
        throw new UserError("That one is earned, not bought.", { code: "not_for_sale" });
      if (editionById(item.id))
        throw new UserError("Only the traveling merchant sells that.", { code: "not_for_sale" });
      if (item.loot) throw new UserError("That one drops in the raid.", { code: "not_for_sale" });
      if (item.company)
        throw new UserError("That one is for company buildings, from the company wallet.", {
          code: "not_for_sale",
        });
      const k = await kept(c, Date.now());
      if (item.slot === "merch") return c.vars.serial(() => buyMerch(c.db, userId, item, Date.now(), k));
      return c.vars.serial(() => buy(c.db, userId, item, Date.now(), k));
    },

    // MARK: Company furniture

    /**
     * The owner buys a piece of company furniture from the company wallet. It goes down in front of
     * them if they're in the building; otherwise (or with no room on the floor) into the storeroom.
     */
    buyPiece: async (c, itemId: unknown): Promise<{ notice: string; company: MyCompany }> => {
      const userId = requireUser(c.conn.state);
      const item = itemById(itemId);
      if (!item?.company) throw new UserError("That's not for company buildings.", { code: "not_found" });
      return furnish(c, userId, "buy", (company, now) => buyPiece(c.db, company, userId, item, now));
    },

    /** Any member puts a piece from the storeroom down in front of them, in the building. */
    placePiece: async (c, itemId: unknown): Promise<{ notice: string; company: MyCompany }> => {
      const userId = requireUser(c.conn.state);
      return furnish(c, userId, "place", (company, now) => unstore(c.db, company.id, itemId, userId, now));
    },

    /** The morning paper: yesterday in town, the same front page all day. */
    paper: (c): Promise<Paper> => {
      requireUser(c.conn.state);
      const day = addDays(dayKey(Date.now()), -1);
      if (c.vars.paper?.day !== day)
        c.vars.paper = { day, paper: paperFacts(c.db, day).then((f) => ({ day, headlines: headlines(f) })) };
      const paper = c.vars.paper.paper;
      // A failed build is tried again on the next read.
      paper.catch(() => {
        if (c.vars.paper?.paper === paper) c.vars.paper = null;
      });
      return paper;
    },

    // MARK: The traveling merchant (`core/src/merchant.ts`)

    /** What's on the cart this week, and how many of each are gone. */
    cart: (c): Promise<Cart> => cart(c.db, Date.now()),

    /** The next numbered copy of one off the cart. */
    buyEdition: async (c, itemId: unknown): Promise<{ wallet: Wallet; n: number }> => {
      const userId = requireUser(c.conn.state);
      const k = await kept(c, Date.now());
      return c.vars.serial(() => buyEdition(c.db, userId, itemId, Date.now(), k));
    },

    /** The numbered copies in my bag. */
    copies: (c): Promise<Copy[]> => copiesOf(c.db, requireUser(c.conn.state)),

    // MARK: Drops

    /**
     * One of mine onto the floor where I am, for anyone to take. A full room says so (the notice is for
     * the Bag), and the item stays mine.
     */
    drop: async (c, itemId: unknown): Promise<{ notice: string; drop?: Drop }> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.drops.take(String(userId), Date.now()))
        throw new UserError("That's a lot of drops. Try again in a minute.", { code: "rate_limited" });
      const client = c.client<typeof registry>();
      const id = await c.vars.serial(() => takeOut(c.db, userId, itemId, Date.now()));
      // Not under `serial` while `world` places it, so a slow world holds up nobody else. The row is on
      // the floor meanwhile, with a fresh `dropped_at`: the sweeper leaves it, and if it landed and
      // someone took it already, `giveBack` finds nothing to give.
      // ponytail: one that landed but timed out stays on the floor with its row back here: taking it
      // gets nothing (`pickUp` is false). `removeDrops` it here if that ever shows up.
      const put = await main(client)
        .world.placeDrop({ id, item: itemId as string, by: userId })
        .catch((err) => {
          console.warn(`[drop] ${id}: ${String(err)}`);
          return { notice: "That didn't work. Try again." };
        });
      let off = false;
      const out = await c.vars.serial(async () => {
        if ("notice" in put) {
          await giveBack(c.db, [id]);
          return put;
        }
        await placed(c.db, put);
        off = await unwear(c.db, userId, [put.item]);
        return { notice: `Dropped the ${dropName(put)}.`, drop: put };
      });
      // Off it comes, if it was the last one worn.
      if (off) await pushPlayers(c.db, client, [userId]);
      return out;
    },

    /** From `world.take`: a drop on `room`'s floor into the taker's bag. False if it isn't there any more. */
    pickUp: async (c, dropId: number, userId: number, room: string): Promise<boolean> => {
      requireInternal(c.conn.state);
      return pickUp(c.db, dropId, userId, room);
    },

    /** From `world.sit`: on a blanket at the outage picnic that started at `since`. True the first time. */
    picnicked: (c, userId: number, since: number): Promise<boolean> => {
      requireInternal(c.conn.state);
      return markPicnic(c.db, userId, since);
    },

    /**
     * The alarm, every 10 minutes: drops nobody took in an hour go back to whoever dropped them, and
     * trade offers past their week go. And the raid is worked out, so a kill's loot is handed out even
     * while nobody's watching (`raidsOf`).
     */
    sweep: async (c): Promise<void> => {
      // The alarm calls with no connection; anyone else has one, and has to be inside.
      if (c.conn) requireInternal(c.conn.state);
      // Never in the way of the drops below.
      try {
        await raidsOf(c, Date.now());
      } catch (err) {
        console.warn(`[sweep] raid: ${String(err)}`);
      }
      try {
        await c.db.execute("DELETE FROM trades WHERE at < ?", Date.now() - TRADE_TTL);
      } catch (err) {
        console.warn(`[sweep] trades: ${String(err)}`);
      }
      const ids = await unclaimed(c.db, Date.now() - DROP_TTL);
      if (ids.length === 0) return;
      // Off the floor first: if `world` is down, nothing changed and the next sweep tries again.
      await main(c.client<typeof registry>()).world.removeDrops(ids);
      await giveBack(c.db, ids);
    },

    // MARK: Trades

    /** Offers `toId` my `give` for their `want`. It replaces my open offer, if I had one. */
    offerTrade: async (c, rawTo: unknown, rawGive: unknown, rawWant: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const toId = playerId(rawTo);
      if (toId === userId) throw new UserError("Trade with someone else.", { code: "invalid_trade" });
      const me = await userById(c.db, userId);
      const them = await userById(c.db, toId);
      // `parseSide` refuses a reward too; this says why.
      const asked = [rawGive, rawWant].flatMap((s) => (s as { items?: unknown } | null)?.items ?? []);
      if (asked.some((i) => itemById(i)?.tradeable === false))
        throw new UserError("Level rewards stay with you.", { code: "invalid_trade" });
      const give = parseSide(rawGive);
      const want = parseSide(rawWant);
      if (give && want && emptySide(give) && emptySide(want))
        throw new UserError("Offer something, or ask for something.", { code: "invalid_trade" });
      if (!give || !want)
        throw new UserError(`Up to 🪙 ${TRADE_COINS_CAP} and ${TRADE_ITEMS_CAP} shop items a side.`, {
          code: "invalid_trade",
        });
      const now = Date.now();
      const trade = { fromId: userId, from: me.name, toId, to: them.name, give, want, at: now };
      // Their coins are theirs to know: accepting checks them.
      await checkTrade(c.db, { ...trade, want: { ...want, coins: 0 } }, now, await kept(c, now));
      if (!c.vars.trades.take(String(userId), now))
        throw new UserError("That's a lot of offers. Try again in an hour.", { code: "rate_limited" });
      await c.db.execute(
        "INSERT OR REPLACE INTO trades (from_id, to_id, give, want, at) VALUES (?, ?, ?, ?, ?)",
        userId,
        toId,
        JSON.stringify(give),
        JSON.stringify(want),
        now,
      );
      await notify(c.client<typeof registry>(), toId, {
        text: `${me.name} offers you a trade.`,
        open: "trades",
      });
    },

    /** Offers to me and my own, newest first. */
    trades: async (c): Promise<{ incoming: Trade[]; outgoing: Trade | null }> => {
      const userId = requireUser(c.conn.state);
      // Older ones are past it: the sweeper deletes them.
      const since = Date.now() - TRADE_TTL;
      return {
        incoming: await tradesWhere(c.db, "to_id = ? AND at >= ?", userId, since),
        outgoing: (await tradesWhere(c.db, "from_id = ? AND at >= ?", userId, since))[0] ?? null,
      };
    },

    /** `at`: the offer as I saw it, so one swapped meanwhile isn't accepted unseen. */
    acceptTrade: async (c, fromId: unknown, at: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      const k = await kept(c, now);
      const trade = await c.vars.serial(async () => {
        const trade = await offerTo(c.db, userId, fromId, now);
        if (trade.at !== at)
          throw new UserError("They changed the offer. Have another look.", { code: "not_found" });
        await settleTrade(c.db, trade, now, k);
        return trade;
      });
      const client = c.client<typeof registry>();
      // Looks may have changed.
      await pushPlayers(c.db, client, [trade.fromId, userId]);
      await notify(client, trade.fromId, { text: `${trade.to} accepted your trade.`, open: "bag" });
      return wallet(c.db, userId, now, k);
    },

    declineTrade: async (c, fromId: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      const trade = await offerTo(c.db, userId, fromId, Date.now());
      await c.db.execute("DELETE FROM trades WHERE from_id = ? AND at = ?", trade.fromId, trade.at);
      await notify(c.client<typeof registry>(), trade.fromId, { text: `${trade.to} passed on your trade.` });
    },

    withdrawTrade: async (c): Promise<void> => {
      await c.db.execute("DELETE FROM trades WHERE from_id = ?", requireUser(c.conn.state));
    },

    /** What `userId` could trade away, for the trade panel. */
    tradeables: async (c, targetId: unknown): Promise<{ name: string; owned: string[] }> => {
      requireUser(c.conn.state);
      const u = await userOf(c.db, targetId);
      return { name: u.name, owned: (await ownedItems(c.db, u.id)).filter(isTradeable) };
    },

    /** Open: anyone can visit from my player card. Closed: only I get in, through the door. */
    setOfficeOpen: async (c, open: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.offices.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      if (typeof open !== "boolean") throw new UserError("Open or closed?", { code: "invalid_office" });
      const client = c.client<typeof registry>();
      const drops = await c.vars.serial(async () => {
        // Level 10 from before offices had rows: its row, and its desk and chair, come now.
        const drops = await grantRewards(c.db, userId, await levelOf(c.db, userId), Date.now());
        const set = "UPDATE offices SET open = ? WHERE user_id = ? RETURNING user_id";
        if (!(await one(c.db, set, open ? 1 : 0, userId)))
          throw new UserError("You don't have an office yet.", { code: "not_found" });
        return drops;
      });
      await placeStarter(client, drops);
      await pushOffice(c.db, client, userId);
    },

    /** What wallpapers and floors I may use now, as `<kind>.<id>`. */
    decorOwned: async (c): Promise<string[]> => ownedDecor(c.db, requireUser(c.conn.state)),

    /** Buys a wallpaper or floor (`kind` wall or floor); `setDecor` puts it on. */
    buyDecor: async (c, kind: unknown, id: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      const now = Date.now();
      const k = await kept(c, now);
      return c.vars.serial(() => buyDecor(c.db, userId, kind, id, now, k));
    },

    /** Puts a wallpaper or floor I own on my office, for free (`null`: the plain one). */
    setDecor: async (c, kind: unknown, id: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.offices.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      if (id !== null && typeof id !== "string") throw new UserError("Which one?", { code: "invalid_decor" });
      const client = c.client<typeof registry>();
      const { drops } = await c.vars.serial(() => applyDecor(c.db, userId, kind, id, Date.now()));
      await placeStarter(client, drops);
      await pushOffice(c.db, client, userId);
    },

    // MARK: Desk setups

    /** Which desk setups I may use, and which I use. */
    deskOwned: async (c): Promise<MyDesk> => myDesk(c.db, requireUser(c.conn.state)),

    /** Buys a desk setup (a `DESKS` id) for my coins; `setDesk` puts it on. */
    buyDesk: async (c, id: unknown): Promise<Wallet> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.desks.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      const now = Date.now();
      const k = await kept(c, now);
      return c.vars.serial(() => buyDesk(c.db, userId, id, now, k));
    },

    /** Switches to a desk setup I own, free. Everyone sees it at once. */
    setDesk: async (c, id: unknown): Promise<void> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.desks.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      await c.vars.serial(() => setDesk(c.db, userId, id));
      await pushPlayers(c.db, c.client<typeof registry>(), [userId]);
    },

    /** Any member has the company buy its house the next desk tier from the wallet. */
    buyDeskFleet: async (c): Promise<MyCompany> => {
      const userId = requireUser(c.conn.state);
      if (!c.vars.desks.take(String(userId), Date.now()))
        throw new UserError("That's a lot of changes. Try again in a minute.", { code: "rate_limited" });
      const u = await userById(c.db, userId);
      const company = u.companyId === null ? undefined : await companyById(c.db, u.companyId);
      if (!company) throw new UserError("Join a company first.", { code: "not_member" });
      await c.vars.serial(() => buyDeskFleet(c.db, company, userId, Date.now()));
      await push(c.db, c.client<typeof registry>(), { users: [], companies: [company.id] });
      return myCompany(c.db, company.id, userId);
    },

    /** The open offices, busiest first. Everyone reads the same list for 5 seconds. */
    openOffices: (c): Promise<OpenOfficeRow[]> => {
      requireUser(c.conn.state);
      const now = Date.now();
      const kept = c.vars.openOffices;
      if (kept && now - kept.at < OPEN_OFFICES_TTL) return kept.rows;
      const rows = (async () => {
        const [live, visitors] = await Promise.all([
          main(c.client<typeof registry>()).world.openOffices(),
          visitorCounts(c.db, now),
        ]);
        return live
          .map((o) => ({ ...o, visitors: visitors[o.id] ?? 0 }))
          .sort((a, b) => b.visitors - a.visitors || b.inside - a.inside || b.level - a.level || a.id - b.id)
          .slice(0, OPEN_OFFICES_LIMIT);
      })();
      c.vars.openOffices = { at: now, rows };
      rows.catch(() => {
        if (c.vars.openOffices?.rows === rows) c.vars.openOffices = null;
      });
      return rows;
    },

    /** From `world`: `visitorId` stepped into `ownerId`'s office today. */
    officeVisit: async (c, ownerId: number, visitorId: number): Promise<void> => {
      requireInternal(c.conn.state);
      await recordVisit(c.db, ownerId, visitorId, Date.now());
    },

    /** From `player` after an ingest: replaces those days' rollups and hands out level rewards reached. */
    report: async (
      c,
      userId: number,
      days: string[],
      usage: UsageDay[],
      activity: ActivityDay[],
    ): Promise<void> => {
      requireInternal(c.conn.state);
      const drops = await c.vars.serial(() =>
        c.db.transaction(
          async (tx) => {
            // Deleted meanwhile: nothing of theirs is written back.
            await userById(tx, userId);
            const inDays = `day IN (${days.map(() => "?").join(",")})`;
            await tx.execute(`DELETE FROM usage_daily WHERE user_id = ? AND ${inDays}`, userId, ...days);
            await insertRows(
              tx,
              "INSERT INTO usage_daily (user_id, day, model, input, output, cache_creation, cache_read, turns, reported_cost_cents) VALUES",
              usage.map((r) => [
                userId,
                r.day,
                r.model,
                r.input,
                r.output,
                r.cacheCreation,
                r.cacheRead,
                r.turns,
                r.reportedCostCents ?? 0,
              ]),
            );
            await insertRows(
              tx,
              "INSERT OR REPLACE INTO activity_daily VALUES",
              activity.map((a) => [
                userId,
                a.day,
                a.prompts,
                a.prs,
                a.agentBuckets,
                a.activeBuckets,
                a.peakAgents,
              ]),
            );
            await tx.execute(`DELETE FROM capped_daily WHERE user_id = ? AND ${inDays}`, userId, ...days);
            await insertRows(
              tx,
              "INSERT INTO capped_daily VALUES",
              activity.filter((a) => a.capped > 0).map((a) => [userId, a.day, a.capped]),
            );
            // Their company gets as many coins again.
            await matchCoins(tx, userId, days, Date.now());
            return grantRewards(tx, userId, await levelOf(tx, userId), Date.now());
          },
          { name: "report-usage" },
        ),
      );
      // A finished day changed: its podium may have too.
      if (days.some((d) => d < dayKey(Date.now()))) c.vars.podiums = null;
      await placeStarter(c.client<typeof registry>(), drops);
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

    /** A company's card: its numbers, website, logo and people. */
    company: (c, companyId: unknown, rawRange: unknown): Promise<CompanyProfile> => {
      requireUser(c.conn.state);
      if (typeof companyId !== "number") throw new UserError("That company is gone.", { code: "not_found" });
      return companyProfile(c.db, companyId, isRangeKey(rawRange) ? rawRange : "30d", Date.now());
    },

    profile: async (c, targetId: unknown, rawRange: unknown): Promise<Profile> => {
      requireUser(c.conn.state);
      const range = isRangeKey(rawRange) ? rawRange : "30d";
      return profile(c.db, playerId(targetId), range, Date.now(), await podiumsOf(c, Date.now()));
    },

    /** The trophies on someone's office shelf: anyone may look, like their badges. */
    trophies: async (c, targetId: unknown): Promise<Trophy[]> => {
      requireUser(c.conn.state);
      const u = await userOf(c.db, targetId);
      return c
        .client<typeof registry>()
        .player.get([String(u.id)], internal)
        .trophies();
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
    today: (c): Promise<Today> => today(c.db, requireSyncer(c.conn.state), Date.now()),

    // MARK: Coins for games (from `arcade` only)

    /** Takes a stake or a side bet from each entry, or from nobody. */
    hold: async (c, ref: string, kind: HoldKind, entries: Entry[]): Promise<void> => {
      requireInternal(c.conn.state);
      const names = await namesOf(
        c.db,
        entries.map((e) => e.userId),
      );
      const k = await kept(c, Date.now());
      await c.vars.serial(() => hold(c.db, ref, kind, entries, names, Date.now(), k));
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

    // MARK: The admin page (`ADMIN_TOKEN`)

    adminOverview: (c): Promise<AdminOverview> => {
      requireAdmin(c.conn.state);
      return overview(c.db, Date.now());
    },

    adminUsers: (c): Promise<AdminUser[]> => {
      requireAdmin(c.conn.state);
      return adminUsers(c.db, Date.now());
    },

    adminCompanies: (c): Promise<AdminCompany[]> => {
      requireAdmin(c.conn.state);
      return adminCompanies(c.db);
    },

    adminLog: (c): Promise<AdminLogEntry[]> => {
      requireAdmin(c.conn.state);
      return adminLog(c.db);
    },

    /** Sets someone's balance; returns it. */
    adminSetCoins: async (c, userId: unknown, balance: unknown): Promise<number> => {
      requireAdmin(c.conn.state);
      const coins = coinAmount(balance);
      const user = await userOf(c.db, userId);
      const now = Date.now();
      const k = await kept(c, now);
      const set = await c.vars.serial(() => setBalance(c.db, user.id, coins, now, k));
      await logAdmin(c.db, "set coins", who(user), `${set.before} → ${set.balance}`, now);
      return set.balance;
    },

    /** A company wallet's coins, set; the ledger line is the owner's (`user_id`), kind `admin`. */
    adminSetCompanyCoins: async (c, companyId: unknown, rawCoins: unknown): Promise<number> => {
      requireAdmin(c.conn.state);
      const coins = coinAmount(rawCoins);
      const company = await companyOrGone(c.db, companyId);
      const now = Date.now();
      const set = await c.vars.serial(() => setCompanyWallet(c.db, company.id, coins, company.ownerId, now));
      await logAdmin(
        c.db,
        "set company coins",
        `${company.name} (#${company.id})`,
        `${set.before} → ${set.coins}`,
        now,
      );
      return set.coins;
    },

    adminRenameUser: async (c, userId: unknown, rawName: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      await renameUser(c.db, c.vars.serial, c.client<typeof registry>(), user.id, rawName);
      await logAdmin(c.db, "rename user", who(user), `→ ${userName(rawName)}`, Date.now());
    },

    /** Takes someone out of their company (the owner hands over, the last one out closes it). */
    adminRemoveFromCompany: async (c, userId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      const changed = await c.vars.serial(() => leave(c.db, user.id));
      await push(c.db, c.client<typeof registry>(), changed);
      await logAdmin(c.db, "remove from company", who(user), `company #${user.companyId}`, Date.now());
    },

    /** Forgets someone's usage, raw events and all: for numbers that were made up. */
    adminWipeUsage: async (c, userId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      const client = c.client<typeof registry>();
      const days = await client.player.get([String(user.id)], internal).wipe();
      await c.vars.serial(() => wipeUsage(c.db, user.id));
      c.vars.podiums = null;
      await push(c.db, client, {
        users: [user.id],
        companies: user.companyId === null ? [] : [user.companyId],
      });
      await logAdmin(c.db, "wipe usage", who(user), `${days.length} days`, Date.now());
    },

    /** Deletes an account for good: their device token and sessions stop working, and they leave the world. */
    adminDeleteUser: async (c, userId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const user = await userOf(c.db, userId);
      const now = Date.now();
      const changed = await c.vars.serial(() => deleteUser(c.db, user.id, now));
      c.vars.podiums = null;
      await logAdmin(c.db, "delete user", who(user), null, now);
      const client = c.client<typeof registry>();
      await push(c.db, client, changed);
      // Out of the world with their drops; what others dropped in their office goes back to them.
      await giveBack(c.db, await main(client).world.removePlayer(user.id));
      await client.player.get([String(user.id)], internal).close();
    },

    adminRenameCompany: async (c, companyId: unknown, rawName: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const company = await companyOrGone(c.db, companyId);
      await renameCompany(c.db, c.client<typeof registry>(), company.id, rawName);
      await logAdmin(
        c.db,
        "rename company",
        `${company.name} (#${company.id})`,
        `→ ${companyName(rawName)}`,
        Date.now(),
      );
    },

    adminCloseCompany: async (c, companyId: unknown): Promise<void> => {
      requireAdmin(c.conn.state);
      const client = c.client<typeof registry>();
      const { company, changed } = await c.vars.serial(() => closeCompany(c.db, companyId));
      await logAdmin(
        c.db,
        "close company",
        `${company.name} (#${company.id})`,
        `${changed.users.length} members`,
        Date.now(),
      );
      await push(c.db, client, changed);
      for (const id of changed.users)
        await notify(client, id, { text: "Your company was closed by the town admin.", open: "company" });
    },

    /** From `world`: the 429 Cop wrote `userId` a ticket: how many they hold now, or null if they had one today already. */
    ticket: async (c, userId: number, t: Ticket): Promise<number | null> => {
      requireInternal(c.conn.state);
      return c.vars.serial(() => giveTicket(c.db, userId, t));
    },

    /** For `world` starting up: everyone, every company, every office and everything on a floor. */
    seed: async (
      c,
    ): Promise<{
      players: PlayerCore[];
      companies: CompanyInfo[];
      offices: Record<number, Office>;
      drops: Drop[];
    }> => {
      requireInternal(c.conn.state);
      return {
        players: await playerCores(c.db, "all"),
        companies: await companyInfos(c.db, "all"),
        offices: await offices(c.db),
        drops: await floors(c.db),
      };
    },
  },
});

type Client = Parameters<typeof push>[1];

/** How the admin log names someone. */
const who = (u: { id: number; name: string }) => `${u.name} (#${u.id})`;

/** A user id as a caller sent it: `not_found` unless it's a number. */
function playerId(raw: unknown): number {
  if (typeof raw !== "number") throw new UserError("Unknown player.", { code: "not_found" });
  return raw;
}

/** The user with id `raw`, as a caller sent it, or `not_found`. */
const userOf = (sql: Sql, raw: unknown) => userById(sql, playerId(raw));

/** Coins an admin sets: a whole number up to 10M. */
function coinAmount(raw: unknown): number {
  if (!Number.isSafeInteger(raw) || (raw as number) < 0 || (raw as number) > 10_000_000)
    throw new UserError("Use a whole number from 0 to 10,000,000.", { code: "invalid_amount" });
  return raw as number;
}

/** For the player themselves, and for the admin page. Run under `serial`, since names are unique. */
async function renameUser(
  sql: Sql,
  run: ReturnType<typeof serial>,
  client: Client,
  userId: number,
  rawName: unknown,
): Promise<void> {
  const name = userName(rawName);
  await run(async () => {
    const taken = await one<{ id: number }>(sql, "SELECT id FROM users WHERE name = ?", name);
    if (taken && taken.id !== userId) throw new UserError("That name is taken.", { code: "name_taken" });
    await sql.execute("UPDATE users SET name = ? WHERE id = ?", name, userId);
  });
  await pushPlayers(sql, client, [userId]);
}

async function renameCompany(sql: Sql, client: Client, companyId: number, rawName: unknown): Promise<void> {
  const name = companyName(rawName);
  await sql.execute("UPDATE companies SET name = ? WHERE id = ?", name, companyId);
  await push(sql, client, { companies: [companyId], users: [] });
}

/** Every finished day's top 3, worked out once a world day (or after something changed them). */
function podiumsOf(
  c: { db: Sql; vars: { podiums: { day: string; rows: Promise<Podium[]> } | null } },
  now: number,
): Promise<Podium[]> {
  const day = dayKey(now);
  if (c.vars.podiums?.day !== day) {
    const rows = podiums(c.db, now);
    c.vars.podiums = { day, rows };
    // A failed one isn't kept.
    rows.catch(() => {
      if (c.vars.podiums?.rows === rows) c.vars.podiums = null;
    });
  }
  return c.vars.podiums.rows;
}

/**
 * Podiums and raids for checking wallets, from what the town keeps. Before `serial`, never under it:
 * `raidsOf` hands out loot on that chain, and would wait for itself.
 */
async function kept(
  c: Parameters<typeof raidsOf>[0] & Parameters<typeof podiumsOf>[0],
  now: number,
): Promise<Kept> {
  const [top, raids] = await Promise.all([podiumsOf(c, now), raidsOf(c, now)]);
  return { top, raids };
}

const RAID_TTL = 15_000;

/**
 * Every raid so far, worked out at most every few seconds however many people are watching. A new
 * week's gate opening (the launch too) throws the old one away, so 08:00 never shows a ladder without it.
 * Each time, the loot its kills dropped is handed out (`grantLoot`, once per drop), before anyone sees the kill.
 */
function raidsOf(
  c: {
    db: TxSql;
    vars: { raids: { at: number; rows: Promise<RaidWeek[]> } | null; serial: ReturnType<typeof serial> };
    client(): Client;
  },
  now: number,
): Promise<RaidWeek[]> {
  const kept = c.vars.raids;
  if (kept && now - kept.at < RAID_TTL && raidWeekAt(kept.at) === raidWeekAt(now)) return kept.rows;
  const rows = raidHistory(c.db, now).then(async (weeks) => {
    const fresh = await c.vars
      .serial(() => grantLoot(c.db, weeks, now))
      .catch((err) => {
        // The raid still shows; the next one tries again.
        console.warn(`[loot] ${String(err)}`);
        return [];
      });
    if (fresh.length > 0) void announceLoot(c.db, c.client(), fresh, now);
    return weeks;
  });
  c.vars.raids = { at: now, rows };
  rows.catch(() => {
    if (c.vars.raids?.rows === rows) c.vars.raids = null;
  });
  return rows;
}

/** A new office's desk and chair onto its floor. If `world` misses them, its next start lays them (`seed`). */
async function placeStarter(client: Client, drops: Drop[]): Promise<void> {
  if (drops.length === 0) return;
  await main(client)
    .world.placeDrops(drops)
    .catch((err) => console.warn(`[office] ${String(err)}`));
}

/**
 * A piece of company furniture onto the building's floor, from the storeroom (`take` is how the row was
 * picked: bought or unstored). Under `serial` the whole way, `world` included, so two members can't put
 * out the same stored row. Without room (or out of the building) it stays in the storeroom.
 * ponytail: holds the town while `world` places it; it's in process and quick, and furnishing is rare.
 */
async function furnish(
  c: { db: Sql; vars: { serial: ReturnType<typeof serial> }; client: () => Client },
  userId: number,
  action: "buy" | "place",
  take: (company: NonNullable<Awaited<ReturnType<typeof companyById>>>, now: number) => Promise<number>,
): Promise<{ notice: string; company: MyCompany }> {
  const u = await userById(c.db, userId);
  const company = u.companyId === null ? undefined : await companyById(c.db, u.companyId);
  if (!company) throw new UserError("Join a company first.", { code: "not_member" });
  const notice = await c.vars.serial(async () => {
    const now = Date.now();
    const id = await take(company, now);
    const item = (await one<{ item: string }>(c.db, "SELECT item FROM items WHERE id = ?", id))!.item;
    const put = await main(c.client())
      .world.placeDrop({ id, item, by: userId, co: company.id })
      .catch((err) => {
        console.warn(`[furnish] ${id}: ${String(err)}`);
        return { notice: "That didn't work. Try again." };
      });
    const name = itemById(item)?.name ?? "piece";
    if ("notice" in put)
      return action === "buy" ? `${put.notice} The ${name} is in the storeroom.` : put.notice;
    await placed(c.db, put);
    return `${action === "buy" ? "Bought" : "Put out"} the ${name}.`;
  });
  return { notice, company: await myCompany(c.db, company.id, userId) };
}

const OPEN_OFFICES_TTL = 5_000;
const OPEN_OFFICES_LIMIT = 30;

/** An open office in the list, with how many different people came this week. */
export type OpenOfficeRow = OpenOffice & { visitors: number };

/** The open offer `fromId` made me, or `not_found`. */
async function offerTo(sql: Sql, userId: number, fromId: unknown, now: number): Promise<Trade> {
  const [trade] =
    typeof fromId === "number"
      ? await tradesWhere(sql, "from_id = ? AND to_id = ? AND at >= ?", fromId, userId, now - TRADE_TTL)
      : [];
  if (!trade) throw new UserError("That offer is gone.", { code: "not_found" });
  return trade;
}

async function namesOf(sql: Sql, userIds: number[]): Promise<Record<number, string>> {
  const rows = await all<{ id: number; name: string }>(
    sql,
    "SELECT id, name FROM users WHERE id IN (SELECT value FROM json_each(?))",
    JSON.stringify(userIds),
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
