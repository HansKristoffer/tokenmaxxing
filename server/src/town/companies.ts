import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { type Brand, type CompanyInfo, houseTier } from "@tokenmaxxing/core/world.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql } from "../actors/shared.ts";
import { forgetLogo } from "../brand.ts";
import { formatInviteCode, generateInviteCode } from "../crypto.ts";
import { userById } from "./users.ts";

export interface MyCompany {
  id: number;
  name: string;
  /** Display form, e.g. `K7QM-2XRP-9D`. */
  code: string;
  isOwner: boolean;
  plot: number | null;
  tier: number;
  tokens30d: number;
  website: string | null;
  /** Reading the website: under way, didn't work, or null (done, or nothing to do). */
  branding: "working" | "failed" | null;
  members: { userId: number; name: string; isOwner: boolean }[];
}

export interface CompanyRow {
  id: number;
  name: string;
  code: string;
  ownerId: number;
  plot: number | null;
  website: string | null;
  branding: "working" | "failed" | null;
}

export const COMPANY_COLS = "id, name, code, owner_id AS ownerId, plot, website, branding";

export async function ownedCompany(sql: Sql, userId: number): Promise<CompanyRow> {
  const u = await userById(sql, userId);
  const company =
    u.companyId === null
      ? undefined
      : await one<CompanyRow>(sql, `SELECT ${COMPANY_COLS} FROM companies WHERE id = ?`, u.companyId);
  if (!company || company.ownerId !== userId)
    throw new UserError("Only the owner can do that.", { code: "not_owner" });
  return company;
}

export async function freshCode(sql: Sql): Promise<string> {
  for (;;) {
    const code = generateInviteCode();
    if (!(await one(sql, "SELECT 1 FROM companies WHERE code = ?", code))) return code;
  }
}

export interface Changed {
  users: number[];
  companies: number[];
}

/**
 * Takes `userId` out of their company. The owner hands over to whoever joined
 * earliest; the last one out closes the company and frees its plot.
 */
export async function leave(sql: Sql, userId: number): Promise<Changed> {
  const u = await userById(sql, userId);
  if (u.companyId === null) return { users: [], companies: [] };
  await sql.execute("UPDATE users SET company_id = NULL, joined_at = NULL WHERE id = ?", userId);
  const company = (await one<CompanyRow>(
    sql,
    `SELECT ${COMPANY_COLS} FROM companies WHERE id = ?`,
    u.companyId,
  ))!;
  if (company.ownerId === userId) {
    const heir = await one<{ id: number }>(
      sql,
      "SELECT id FROM users WHERE company_id = ? ORDER BY joined_at, id LIMIT 1",
      company.id,
    );
    if (heir) await sql.execute("UPDATE companies SET owner_id = ? WHERE id = ?", heir.id, company.id);
    else {
      await sql.execute("DELETE FROM companies WHERE id = ?", company.id);
      await forgetLogo(company.id);
    }
  }
  return { users: [userId], companies: [company.id] };
}

export async function myCompany(sql: Sql, companyId: number, viewer: number): Promise<MyCompany> {
  const company = (await one<CompanyRow>(
    sql,
    `SELECT ${COMPANY_COLS} FROM companies WHERE id = ?`,
    companyId,
  ))!;
  const members = await all<{ userId: number; name: string }>(
    sql,
    "SELECT id AS userId, name FROM users WHERE company_id = ? ORDER BY joined_at, id",
    companyId,
  );
  const [info] = await companyInfos(sql, [companyId]);
  return {
    id: company.id,
    name: company.name,
    code: formatInviteCode(company.code),
    isOwner: company.ownerId === viewer,
    plot: company.plot,
    tier: houseTier(info?.tokens30d ?? 0, members.length),
    tokens30d: info?.tokens30d ?? 0,
    website: company.website,
    branding: company.branding,
    members: members.map((m) => ({ ...m, isOwner: m.userId === company.ownerId })),
  };
}

export async function companyInfos(sql: Sql, ids: number[]): Promise<CompanyInfo[]> {
  const today = dayKey(Date.now());
  const rows = await all<Omit<CompanyInfo, "brand"> & { brand: string | null }>(
    sql,
    `SELECT c.id, c.name, c.plot, c.website, c.brand,
            (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS members,
            COALESCE((SELECT SUM(input + output + cache_creation + cache_read) FROM usage_daily d
                      JOIN users u ON u.id = d.user_id WHERE u.company_id = c.id AND d.day = ?), 0) AS todayTokens,
            COALESCE((SELECT SUM(input + output + cache_creation + cache_read) FROM usage_daily d
                      JOIN users u ON u.id = d.user_id WHERE u.company_id = c.id AND d.day >= ?), 0) AS tokens30d
     FROM companies c WHERE c.id IN (SELECT value FROM json_each(?))`,
    today,
    addDays(today, -29),
    JSON.stringify(ids),
  );
  return rows.map((r) => ({ ...r, brand: r.brand === null ? null : (JSON.parse(r.brand) as Brand) }));
}
