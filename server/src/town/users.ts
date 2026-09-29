import { levelFor } from "@tokenmaxxing/core/format.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { defaultLook, type Look, parseLook } from "@tokenmaxxing/core/world.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql } from "../actors/shared.ts";

/** What `world` needs to draw someone; `town` owns all of it. */
export interface PlayerCore {
  id: number;
  name: string;
  look: Look;
  level: number;
  companyId: number | null;
  todayTokens: number;
}

export interface UserRow {
  id: number;
  name: string;
  companyId: number | null;
  look: string;
}

export const USER_COLS = "id, name, company_id AS companyId, look";

export const lookOf = (u: UserRow): Look => parseLook(JSON.parse(u.look)) ?? defaultLook(u.id);

export async function userById(sql: Sql, id: number): Promise<UserRow> {
  const u = await one<UserRow>(sql, `SELECT ${USER_COLS} FROM users WHERE id = ?`, id);
  if (!u) throw new UserError("Unknown player.", { code: "not_found" });
  return u;
}

export async function lifetimeTokens(sql: Sql, userIds: number[]): Promise<Map<number, number>> {
  const rows = await all<{ userId: number; tokens: number }>(
    sql,
    `SELECT user_id AS userId, SUM(input + output + cache_creation + cache_read) AS tokens
     FROM usage_daily WHERE user_id IN (SELECT value FROM json_each(?)) GROUP BY user_id`,
    JSON.stringify(userIds),
  );
  return new Map(rows.map((r) => [r.userId, r.tokens]));
}

/** Tokens per user over `[from, to]`. */
export async function tokensBetween(
  sql: Sql,
  userIds: number[],
  from: string,
  to: string,
): Promise<Map<number, number>> {
  const rows = await all<{ userId: number; tokens: number }>(
    sql,
    `SELECT user_id AS userId, SUM(input + output + cache_creation + cache_read) AS tokens
     FROM usage_daily WHERE user_id IN (SELECT value FROM json_each(?)) AND day >= ? AND day <= ?
     GROUP BY user_id`,
    JSON.stringify(userIds),
    from,
    to,
  );
  return new Map(rows.map((r) => [r.userId, r.tokens]));
}

export async function playerCores(sql: Sql, userIds: number[]): Promise<PlayerCore[]> {
  const users = await all<UserRow>(
    sql,
    `SELECT ${USER_COLS} FROM users WHERE id IN (SELECT value FROM json_each(?))`,
    JSON.stringify(userIds),
  );
  const today = dayKey(Date.now());
  const [lifetime, todays] = await Promise.all([
    lifetimeTokens(sql, userIds),
    tokensBetween(sql, userIds, today, today),
  ]);
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    look: lookOf(u),
    level: levelFor(lifetime.get(u.id) ?? 0),
    companyId: u.companyId,
    todayTokens: todays.get(u.id) ?? 0,
  }));
}
