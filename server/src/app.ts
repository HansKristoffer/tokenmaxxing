import { isReaction } from "@tokenmaxxing/core/moments.ts";
import { dayIn, resolveRange } from "@tokenmaxxing/core/range.ts";
import type { IngestResponse, TokenEvent } from "@tokenmaxxing/core/types.ts";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";
import { formatGroupCode, normalizeGroupCode } from "./crypto.ts";
import type { Db } from "./db/db.ts";
import { insertEvents } from "./db/events.ts";
import {
  createGroup,
  deleteGroup,
  type GroupError,
  type GroupSummary,
  isMember,
  joinGroup,
  leaveGroup,
  listGroups,
  listMembers,
  removeMember,
  renameGroup,
  rotateCode,
} from "./db/groups.ts";
import {
  canSeeMoment,
  deleteMessage,
  detectMoments,
  ensureDayResults,
  groupTz,
  isRecentBatch,
  levelsFor,
  listFeed,
  postMessage,
  progressOf,
  raceSnapshot,
  setUserTz,
  titlesFor,
  toggleReaction,
} from "./db/moments.ts";
import { canSee, leaderboard, userDetail } from "./db/stats.ts";
import {
  createLoginCode,
  createUser,
  deleteSession,
  redeemLoginCode,
  renameUser,
  SESSION_TTL_MS,
  userBySession,
  userByToken,
} from "./db/users.ts";
import type { PricingCache } from "./pricing.ts";
import { RateLimiter } from "./rate-limit.ts";
import {
  MAX_EVENTS_PER_REQUEST,
  parseChatText,
  parseEvent,
  parseGroupName,
  parseId,
  parseRange,
  parseSort,
  parseTz,
  parseTzName,
  parseUserName,
} from "./validate.ts";

export interface AppDeps {
  db: Db;
  pricing: PricingCache;
  version: string;
  now?: () => number;
  /** Secure cookies need HTTPS; off for local dev and tests. */
  secureCookies?: boolean;
}

const SESSION_COOKIE = "tm_session";

type Env = { Variables: { user: string } };

const GROUP_ERROR_STATUS = {
  not_found: 404,
  not_owner: 403,
  too_many_groups: 409,
  group_full: 409,
} as const;

const isGroupError = (v: unknown): v is GroupError => typeof v === "string" && v in GROUP_ERROR_STATUS;

const groupError = (c: Context, e: GroupError) => c.json({ error: e }, GROUP_ERROR_STATUS[e]);

const presentGroup = (g: GroupSummary) => ({ ...g, code: formatGroupCode(g.code) });

/** Railway's edge sets X-Real-IP; fall back to the last hop it appended. */
const clientIp = (c: Context) =>
  c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown";

/**
 * Validates a JSON body. `parse` returns the checked body in the same shape the
 * client sends, which is also what types the RPC client's input.
 */
const jsonBody = <T extends object>(parse: (body: Record<string, unknown>) => T | null) =>
  validator("json", (value, c) => {
    const parsed = value && typeof value === "object" ? parse(value as Record<string, unknown>) : null;
    if (parsed === null) return c.json({ error: "invalid_body" }, 400);
    return parsed;
  });

/** Optional string query params; values are parsed (with defaults) in the handler. */
const queryParams = <K extends string>(...keys: K[]) =>
  validator("query", (q) => {
    const out: Partial<Record<K, string>> = {};
    for (const k of keys) if (typeof q[k] === "string") out[k] = q[k];
    return out;
  });

/** Body `{ name }`, checked by `parse`. */
const named = (parse: (raw: unknown) => string | null) => (b: Record<string, unknown>) => {
  const name = parse(b.name);
  return name === null ? null : { name };
};

export function buildApp(deps: AppDeps) {
  const { db, pricing } = deps;
  const now = deps.now ?? Date.now;
  const signupLimit = new RateLimiter(10, 3_600_000);
  const joinLimit = new RateLimiter(30, 600_000);
  const chatLimit = new RateLimiter(20, 60_000);
  const reactLimit = new RateLimiter(60, 60_000);
  /** Groups whose yesterday was already closed by this process (see ensureDayResults). */
  const closedDays = new Set<string>();
  const myGroupIds = (user: string) => listGroups(db, user).map((g) => g.id);

  const auth = createMiddleware<Env>(async (c, next) => {
    const bearer = c.req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];
    const session = getCookie(c, SESSION_COOKIE);
    const user = bearer ? userByToken(db, bearer) : session ? userBySession(db, session, now()) : null;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    c.set("user", user);
    await next();
  });

  const limited = (limiter: RateLimiter) =>
    createMiddleware(async (c, next) => {
      if (!limiter.take(clientIp(c), now())) return c.json({ error: "rate_limited" }, 429);
      await next();
    });

  const api = new Hono<Env>()
    .post("/users", limited(signupLimit), jsonBody(named(parseUserName)), (c) => {
      const { name } = c.req.valid("json");
      const token = createUser(db, name, now());
      if (!token) return c.json({ error: "name_taken" }, 409);
      return c.json({ name, token }, 201);
    })
    .use(auth)
    .get("/me", (c) => {
      const user = c.get("user");
      return c.json({
        name: user,
        groups: listGroups(db, user).map(presentGroup),
        progress: progressOf(db, user, now()),
      });
    })
    .patch("/me", jsonBody(named(parseUserName)), (c) => {
      const { name } = c.req.valid("json");
      if (!renameUser(db, c.get("user"), name)) return c.json({ error: "name_taken" }, 409);
      return c.json({ name });
    })
    .post(
      "/ingest",
      bodyLimit({ maxSize: 8 * 1024 * 1024 }),
      queryParams("tz"),
      jsonBody((b) =>
        Array.isArray(b.events) && b.events.length <= MAX_EVENTS_PER_REQUEST
          ? { events: b.events as TokenEvent[] }
          : null,
      ),
      (c) => {
        const t = now();
        const user = c.get("user");
        const tz = parseTzName(c.req.valid("query").tz);
        if (tz) setUserTz(db, user, tz);
        const { events } = c.req.valid("json");
        const valid: TokenEvent[] = [];
        for (const raw of events as unknown[]) {
          const e = parseEvent(raw, t);
          if (typeof e !== "string") valid.push(e);
        }
        // Standings before the insert, so detection can tell who this sync passed.
        const snap = isRecentBatch(valid, t) ? raceSnapshot(db, pricing, user, t) : null;
        const r = insertEvents(db, user, valid, t);
        if (snap && r.inserted > 0) detectMoments(db, pricing, user, snap, valid, t);
        const body: IngestResponse & { skipped: number } = {
          ...r,
          skipped: events.length - valid.length,
        };
        return c.json(body);
      },
    )
    .post("/groups", jsonBody(named(parseGroupName)), (c) => {
      const g = createGroup(db, c.get("user"), c.req.valid("json").name, now());
      return isGroupError(g) ? groupError(c, g) : c.json(presentGroup(g), 201);
    })
    .post(
      "/groups/join",
      limited(joinLimit),
      jsonBody((b) => {
        const code = typeof b.code === "string" ? normalizeGroupCode(b.code) : null;
        return code === null ? null : { code };
      }),
      (c) => {
        const user = c.get("user");
        const id = joinGroup(db, user, c.req.valid("json").code, now());
        if (isGroupError(id)) return groupError(c, id);
        return c.json(presentGroup(listGroups(db, user).find((g) => g.id === id)!));
      },
    )
    .get("/groups/:id/members", (c) => {
      const id = parseId(c.req.param("id"));
      if (id === null || !isMember(db, id, c.get("user"))) return groupError(c, "not_found");
      return c.json({ members: listMembers(db, id) });
    })
    .patch("/groups/:id", jsonBody(named(parseGroupName)), (c) => {
      const id = parseId(c.req.param("id"));
      const e = id === null ? "not_found" : renameGroup(db, id, c.get("user"), c.req.valid("json").name);
      return e ? groupError(c, e) : c.json({ ok: true });
    })
    .delete("/groups/:id", (c) => {
      const id = parseId(c.req.param("id"));
      const e = id === null ? "not_found" : deleteGroup(db, id, c.get("user"));
      return e ? groupError(c, e) : c.json({ ok: true });
    })
    .post("/groups/:id/code", (c) => {
      const id = parseId(c.req.param("id"));
      const code = id === null ? "not_found" : rotateCode(db, id, c.get("user"));
      return isGroupError(code) ? groupError(c, code) : c.json({ code: formatGroupCode(code) });
    })
    .delete("/groups/:id/members/:member", (c) => {
      const user = c.get("user");
      const id = parseId(c.req.param("id"));
      const member = c.req.param("member");
      const e =
        id === null
          ? "not_found"
          : member === "me" || member === user
            ? leaveGroup(db, id, user)
            : removeMember(db, id, user, member);
      return e ? groupError(c, e) : c.json({ ok: true });
    })
    .get("/leaderboard", queryParams("range", "sort", "tz", "group"), (c) => {
      const viewer = c.get("user");
      const q = c.req.valid("query");
      const rangeKey = parseRange(q.range);
      const groupId = q.group ? parseId(q.group) : null;
      if (q.group && (groupId === null || !isMember(db, groupId, viewer))) {
        return groupError(c, "not_found");
      }
      const t = now();
      let range = resolveRange(rangeKey, t, parseTz(q.tz));
      // A group's "today" is its race day, on the owner's clock.
      if (rangeKey === "today" && groupId !== null)
        range = { ...range, since: dayIn(t, groupTz(db, groupId)).since };
      const sort = parseSort(q.sort);
      const groupIds = groupId !== null ? [groupId] : myGroupIds(viewer);
      ensureDayResults(db, pricing, groupIds, t, closedDays);
      const scope = { viewer, groupId };
      const board = leaderboard(db, pricing, scope, range, sort);
      // Rank change over the last hour: what makes a board that resets daily feel alive.
      const hourAgo = range.until - 3_600_000;
      const prev =
        rangeKey === "today" && hourAgo > range.since
          ? new Map(
              leaderboard(db, pricing, scope, { since: range.since, until: hourAgo }, sort)
                .filter((e) => e.tokens > 0)
                .map((e) => [e.name, e.rank]),
            )
          : null;
      const titles = titlesFor(db, groupIds, t);
      const levels = levelsFor(
        db,
        board.map((e) => e.name),
      );
      const entries = board.map((e) => {
        const before = prev?.get(e.name);
        return {
          ...e,
          titles: titles.get(e.name) ?? [],
          delta: before === undefined || e.tokens === 0 ? null : before - e.rank,
          level: levels.get(e.name) ?? 0,
        };
      });
      return c.json({ me: viewer, range: { key: rangeKey, ...range }, sort, entries });
    })
    .get("/users/:name", queryParams("range", "tz"), (c) => {
      const viewer = c.get("user");
      const name = c.req.param("name");
      if (!canSee(db, viewer, name)) return c.json({ error: "not_found" }, 404);
      const q = c.req.valid("query");
      const tz = parseTz(q.tz);
      const range = resolveRange(parseRange(q.range), now(), tz);
      return c.json({ ...userDetail(db, pricing, name, range, tz), progress: progressOf(db, name, now()) });
    })
    .get("/feed", queryParams("after", "limit", "group"), (c) => {
      const viewer = c.get("user");
      const q = c.req.valid("query");
      const groupId = q.group ? parseId(q.group) : null;
      if (q.group && (groupId === null || !isMember(db, groupId, viewer))) return groupError(c, "not_found");
      const after = parseId(q.after) ?? 0;
      const limit = Math.min(Math.max(parseId(q.limit) ?? 50, 1), 100);
      ensureDayResults(db, pricing, groupId !== null ? [groupId] : myGroupIds(viewer), now(), closedDays);
      const moments = listFeed(db, viewer, { after, groupId, limit });
      return c.json({ moments, cursor: moments.at(-1)?.id ?? after });
    })
    .delete("/feed/:id", (c) => {
      const id = parseId(c.req.param("id"));
      if (id === null || !deleteMessage(db, c.get("user"), id)) return c.json({ error: "not_found" }, 404);
      return c.json({ ok: true });
    })
    .post(
      "/feed/:id/reactions",
      jsonBody((b) => (isReaction(b.emoji) ? { emoji: b.emoji as string } : null)),
      (c) => {
        const user = c.get("user");
        const id = parseId(c.req.param("id"));
        if (!reactLimit.take(user, now())) return c.json({ error: "rate_limited" }, 429);
        if (id === null || !canSeeMoment(db, user, id)) return c.json({ error: "not_found" }, 404);
        return c.json({ reactions: toggleReaction(db, user, id, c.req.valid("json").emoji, now()) });
      },
    )
    .post(
      "/groups/:id/messages",
      jsonBody((b) => {
        const text = parseChatText(b.text);
        return text === null ? null : { text };
      }),
      (c) => {
        const user = c.get("user");
        const id = parseId(c.req.param("id"));
        if (id === null || !isMember(db, id, user)) return groupError(c, "not_found");
        if (!chatLimit.take(user, now())) return c.json({ error: "rate_limited" }, 429);
        return c.json(postMessage(db, user, id, c.req.valid("json").text, now()), 201);
      },
    )
    .post("/sessions", (c) => c.json({ code: createLoginCode(db, c.get("user"), now()) }))
    .post("/logout", (c) => {
      const session = getCookie(c, SESSION_COOKIE);
      if (session) deleteSession(db, session);
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      return c.json({ ok: true });
    });

  return new Hono()
    .get("/health", (c) => c.json({ ok: true, version: deps.version }))
    .get("/login", (c) => {
      const code = c.req.query("code");
      const session = code ? redeemLoginCode(db, code, now()) : null;
      if (!session) return c.redirect("/?login=expired");
      setCookie(c, SESSION_COOKIE, session, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: deps.secureCookies ?? true,
        maxAge: SESSION_TTL_MS / 1000,
      });
      return c.redirect("/");
    })
    .route("/api", api);
}

export type AppType = ReturnType<typeof buildApp>;
