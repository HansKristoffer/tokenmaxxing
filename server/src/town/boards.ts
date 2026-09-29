import { levelFor, levelTitle } from "@tokenmaxxing/core/format.ts";
import { addDays, dayKey, type RangeKey, rangeDays } from "@tokenmaxxing/core/range.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { houseTier } from "@tokenmaxxing/core/world.ts";
import { all, one, pricing, type Sql } from "../actors/shared.ts";
import {
  type ActivityRow,
  companyTotals,
  rank,
  rowCost,
  rowTokens,
  type SortKey,
  type Totals,
  totals,
  type UsageRow,
} from "../stats.ts";
import { COMPANY_COLS, type CompanyRow, companyInfos } from "./companies.ts";
import { type GameStats, gameStats } from "./games.ts";
import { lifetimeTokens, lookOf, USER_COLS, type UserRow, userById } from "./users.ts";

export interface BoardPlayer extends Totals {
  rank: number;
  userId: number;
  name: string;
  look: Look;
  level: number;
  companyId: number | null;
  company: string | null;
}

export interface BoardCompany extends Totals {
  rank: number;
  companyId: number;
  name: string;
  members: number;
  tier: number;
}

export interface Leaderboard {
  range: RangeKey;
  sort: SortKey;
  players: BoardPlayer[];
  companies: BoardCompany[];
}

export interface Profile {
  userId: number;
  name: string;
  look: Look;
  level: number;
  levelTitle: string;
  lifetimeTokens: number;
  company: { id: number; name: string } | null;
  range: RangeKey;
  totals: Totals;
  models: { model: string; tokens: number; costUsd: number; turns: number }[];
  /** The last 30 world days, oldest first, zeros included. */
  daily: { day: string; tokens: number; costUsd: number }[];
  /** All time; null for someone who never finished a game. */
  games: GameStats | null;
}

export interface MenuBar {
  me: { name: string; rank: number | null; tokensToday: number; level: number; levelTitle: string };
  top: {
    rank: number;
    userId: number;
    name: string;
    company: string | null;
    tokens: number;
    level: number;
    isMe: boolean;
  }[];
}

export const BOARD_TOP = 100;

export const SUMS = `SUM(input) AS input, SUM(output) AS output, SUM(cache_creation) AS cacheCreation,
              SUM(cache_read) AS cacheRead, SUM(turns) AS turns`;

/** `[from, to]` as SQL bounds; all time starts at the beginning. */
export const bounds = (range: RangeKey, now: number): [string, string] => {
  const { from, to } = rangeDays(range, now);
  return [from ?? "0000-00-00", to];
};

export async function boards(sql: Sql, range: RangeKey, sort: SortKey, now: number) {
  const [from, to] = bounds(range, now);
  const users = await all<UserRow>(sql, `SELECT ${USER_COLS} FROM users`);
  const usage = await all<UsageRow & { userId: number }>(
    sql,
    `SELECT user_id AS userId, model, ${SUMS} FROM usage_daily WHERE day >= ? AND day <= ? GROUP BY user_id, model`,
    from,
    to,
  );
  const activity = await all<ActivityRow & { userId: number }>(
    sql,
    `SELECT user_id AS userId, SUM(prompts) AS prompts, SUM(prs) AS prs, SUM(agent_buckets) AS agentBuckets,
            SUM(active_buckets) AS activeBuckets, MAX(peak_agents) AS peakAgents
     FROM activity_daily WHERE day >= ? AND day <= ? GROUP BY user_id`,
    from,
    to,
  );
  const companies = await all<CompanyRow>(sql, `SELECT ${COMPANY_COLS} FROM companies`);
  const lifetime = await lifetimeTokens(
    sql,
    users.map((u) => u.id),
  );
  const companyName = new Map(companies.map((co) => [co.id, co.name]));

  const usageByUser = Map.groupBy(usage, (r) => r.userId);
  const activityByUser = new Map(activity.map((a) => [a.userId, a]));
  const perUser = users.map((u) => ({
    ...totals(pricing, usageByUser.get(u.id) ?? [], activityByUser.get(u.id) ?? null),
    userId: u.id,
    name: u.name,
    look: lookOf(u),
    level: levelFor(lifetime.get(u.id) ?? 0),
    companyId: u.companyId,
    company: u.companyId === null ? null : (companyName.get(u.companyId) ?? null),
  }));
  const players = rank(perUser, sort);

  const tokens30d = new Map(
    (
      await companyInfos(
        sql,
        companies.map((co) => co.id),
      )
    ).map((i) => [i.id, i.tokens30d]),
  );
  const byCompany = Map.groupBy(perUser, (p) => p.companyId);
  const companyRows = companies.map((co) => {
    const members = byCompany.get(co.id) ?? [];
    return {
      ...companyTotals(members),
      companyId: co.id,
      name: co.name,
      members: members.length,
      tier: houseTier(tokens30d.get(co.id) ?? 0, members.length),
    };
  });
  return { players, companies: rank(companyRows, sort) };
}

export async function profile(sql: Sql, userId: number, range: RangeKey, now: number): Promise<Profile> {
  const u = await userById(sql, userId);
  const [from, to] = bounds(range, now);
  const usage = await all<UsageRow>(
    sql,
    `SELECT model, ${SUMS} FROM usage_daily WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY model`,
    userId,
    from,
    to,
  );
  const activity = await one<ActivityRow>(
    sql,
    `SELECT SUM(prompts) AS prompts, SUM(prs) AS prs, SUM(agent_buckets) AS agentBuckets,
            SUM(active_buckets) AS activeBuckets, MAX(peak_agents) AS peakAgents
     FROM activity_daily WHERE user_id = ? AND day >= ? AND day <= ?`,
    userId,
    from,
    to,
  );
  const today = dayKey(now);
  const first = addDays(today, -29);
  const days = await all<UsageRow & { day: string }>(
    sql,
    `SELECT day, model, ${SUMS} FROM usage_daily WHERE user_id = ? AND day >= ? GROUP BY day, model`,
    userId,
    first,
  );
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(first, i);
    const rows = days.filter((r) => r.day === day);
    return {
      day,
      tokens: rows.reduce((n, r) => n + rowTokens(r), 0),
      costUsd: Math.round(rows.reduce((n, r) => n + rowCost(pricing, r), 0) * 100) / 100,
    };
  });
  const lifetime = (await lifetimeTokens(sql, [userId])).get(userId) ?? 0;
  const level = levelFor(lifetime);
  const company =
    u.companyId === null
      ? null
      : ((await one<{ id: number; name: string }>(
          sql,
          "SELECT id, name FROM companies WHERE id = ?",
          u.companyId,
        )) ?? null);
  return {
    userId,
    name: u.name,
    look: lookOf(u),
    level,
    levelTitle: levelTitle(level),
    lifetimeTokens: lifetime,
    company,
    range,
    totals: totals(pricing, usage, activity?.activeBuckets == null ? null : activity),
    models: usage
      .map((r) => ({ model: r.model, tokens: rowTokens(r), costUsd: rowCost(pricing, r), turns: r.turns }))
      .sort((a, b) => b.tokens - a.tokens),
    daily,
    games: await gameStats(sql, userId),
  };
}

/** The leaderboard as shown: players with anything to show (and me), the top 100 of each. */
export async function leaderboard(
  sql: Sql,
  userId: number,
  range: RangeKey,
  sort: SortKey,
  now: number,
): Promise<Leaderboard> {
  const board = await boards(sql, range, sort, now);
  const players = board.players.filter((p) => p.tokens > 0 || p.prs > 0 || p.userId === userId);
  return {
    range,
    sort,
    players: players.filter((p, i) => i < BOARD_TOP || p.userId === userId),
    companies: board.companies.slice(0, BOARD_TOP),
  };
}

/** My numbers today and the world's top 10, with me pinned below when I'm not in it. */
export async function menuBar(sql: Sql, userId: number, now: number): Promise<MenuBar> {
  const { players } = await boards(sql, "today", "tokens", now);
  const mine = players.find((p) => p.userId === userId)!;
  const row = (p: BoardPlayer) => ({
    rank: p.rank,
    userId: p.userId,
    name: p.name,
    company: p.company,
    tokens: p.tokens,
    level: p.level,
    isMe: p.userId === userId,
  });
  const top = players.filter((p) => p.tokens > 0).slice(0, 10);
  return {
    me: {
      name: mine.name,
      rank: mine.tokens > 0 ? mine.rank : null,
      tokensToday: mine.tokens,
      level: mine.level,
      levelTitle: levelTitle(mine.level),
    },
    top: top.some((p) => p.userId === userId) ? top.map(row) : [...top.map(row), row(mine)],
  };
}
