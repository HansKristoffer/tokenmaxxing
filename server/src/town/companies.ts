import { levelFor } from "@tokenmaxxing/core/format.ts";
import { addDays, dayKey } from "@tokenmaxxing/core/range.ts";
import { type Brand, COMPANY_CAP, type CompanyInfo, houseTier } from "@tokenmaxxing/core/world.ts";
import { UserError } from "rivetkit";
import { all, one, type Sql } from "../actors/shared.ts";
import { forgetLogo } from "../brand.ts";
import { TOKENS, tokensIn, userById } from "./users.ts";

export interface MyCompany {
  id: number;
  name: string;
  isOwner: boolean;
  plot: number | null;
  tier: number;
  tokens30d: number;
  website: string | null;
  /** Reading the website: under way, didn't work, or null (done, or nothing to do). */
  branding: "working" | "failed" | null;
  members: { userId: number; name: string; isOwner: boolean }[];
  /** People asking to join, oldest first. Only the owner sees them. */
  applicants: { userId: number; name: string; level: number; at: number }[];
}

/** A company as listed for people looking for one. */
export interface Listing {
  id: number;
  name: string;
  website: string | null;
  members: number;
  tier: number;
  tokens30d: number;
  full: boolean;
}

export interface CompanyRow {
  id: number;
  name: string;
  ownerId: number;
  plot: number | null;
  website: string | null;
  branding: "working" | "failed" | null;
}

export const COMPANY_COLS = "id, name, owner_id AS ownerId, plot, website, branding";

export async function ownedCompany(sql: Sql, userId: number): Promise<CompanyRow> {
  const u = await userById(sql, userId);
  const company = u.companyId === null ? undefined : await companyById(sql, u.companyId);
  if (!company || company.ownerId !== userId)
    throw new UserError("Only the owner can do that.", { code: "not_owner" });
  return company;
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
  const company = (await companyById(sql, u.companyId))!;
  if (company.ownerId === userId) {
    const heir = await one<{ id: number }>(
      sql,
      "SELECT id FROM users WHERE company_id = ? ORDER BY joined_at, id LIMIT 1",
      company.id,
    );
    if (heir) await sql.execute("UPDATE companies SET owner_id = ? WHERE id = ?", heir.id, company.id);
    else {
      await sql.execute("DELETE FROM companies WHERE id = ?", company.id);
      await sql.execute("DELETE FROM applications WHERE company_id = ?", company.id);
      await forgetLogo(company.id);
    }
  }
  return { users: [userId], companies: [company.id] };
}

export async function myCompany(sql: Sql, companyId: number, viewer: number): Promise<MyCompany> {
  const company = (await companyById(sql, companyId))!;
  const members = await all<{ userId: number; name: string }>(
    sql,
    "SELECT id AS userId, name FROM users WHERE company_id = ? ORDER BY joined_at, id",
    companyId,
  );
  const [info] = await companyInfos(sql, [companyId]);
  const isOwner = company.ownerId === viewer;
  return {
    id: company.id,
    name: company.name,
    isOwner,
    plot: company.plot,
    tier: houseTier(info?.tokens30d ?? 0, members.length),
    tokens30d: info?.tokens30d ?? 0,
    website: company.website,
    branding: company.branding,
    members: members.map((m) => ({ ...m, isOwner: m.userId === company.ownerId })),
    applicants: isOwner ? await applicants(sql, companyId) : [],
  };
}

// MARK: Applying to join

/** Every company, busiest first (30-day tokens per member), for choosing one to apply to. */
export async function listings(sql: Sql): Promise<Listing[]> {
  const ids = (await all<{ id: number }>(sql, "SELECT id FROM companies")).map((r) => r.id);
  return (await companyInfos(sql, ids))
    .map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      members: c.members,
      tier: houseTier(c.tokens30d, c.members),
      tokens30d: c.tokens30d,
      full: c.members >= COMPANY_CAP,
    }))
    .sort((a, b) => b.tokens30d / Math.max(1, b.members) - a.tokens30d / Math.max(1, a.members));
}

/** The company `userId` is waiting to hear from, if any. */
export const applicationOf = (sql: Sql, userId: number) =>
  one<{ companyId: number; name: string }>(
    sql,
    `SELECT a.company_id AS companyId, c.name FROM applications a JOIN companies c ON c.id = a.company_id
     WHERE a.user_id = ?`,
    userId,
  ).then((r) => r ?? null);

async function applicants(sql: Sql, companyId: number): Promise<MyCompany["applicants"]> {
  const rows = await all<{ userId: number; name: string; at: number }>(
    sql,
    `SELECT a.user_id AS userId, u.name, a.at FROM applications a JOIN users u ON u.id = a.user_id
     WHERE a.company_id = ? ORDER BY a.at`,
    companyId,
  );
  const lifetime = await tokensIn(
    sql,
    rows.map((r) => r.userId),
  );
  return rows.map((r) => ({ ...r, level: levelFor(lifetime.get(r.userId) ?? 0) }));
}

export const companyById = (sql: Sql, id: number) =>
  one<CompanyRow>(sql, `SELECT ${COMPANY_COLS} FROM companies WHERE id = ?`, id);

/** Asks to join `companyId`; one application at a time, so this replaces any other. Returns the owner. */
export async function apply(sql: Sql, userId: number, companyId: number, now: number): Promise<CompanyRow> {
  const company = await companyById(sql, companyId);
  if (!company) throw new UserError("That company is gone.", { code: "not_found" });
  const me = await userById(sql, userId);
  if (me.companyId === company.id) throw new UserError("You're already in it.", { code: "member" });
  const [info] = await companyInfos(sql, [company.id]);
  if ((info?.members ?? 0) >= COMPANY_CAP)
    throw new UserError("That company is full.", { code: "company_full" });
  await sql.execute(
    "INSERT OR REPLACE INTO applications (user_id, company_id, at) VALUES (?, ?, ?)",
    userId,
    company.id,
    now,
  );
  return company;
}

export async function withdraw(sql: Sql, userId: number): Promise<void> {
  await sql.execute("DELETE FROM applications WHERE user_id = ?", userId);
}

/** The owner's side: the application from `applicantId` to their company, or an error. */
async function applicationTo(sql: Sql, company: CompanyRow, applicantId: unknown): Promise<number> {
  const row =
    typeof applicantId === "number"
      ? await one<{ userId: number }>(
          sql,
          "SELECT user_id AS userId FROM applications WHERE user_id = ? AND company_id = ?",
          applicantId,
          company.id,
        )
      : undefined;
  if (!row) throw new UserError("They're not asking to join any more.", { code: "not_found" });
  return row.userId;
}

/** Lets an applicant in: they leave their old company (if any) and join the owner's. */
export async function approve(
  sql: Sql,
  company: CompanyRow,
  applicantId: unknown,
  now: number,
): Promise<Changed> {
  const userId = await applicationTo(sql, company, applicantId);
  const [info] = await companyInfos(sql, [company.id]);
  if ((info?.members ?? 0) >= COMPANY_CAP)
    throw new UserError("Your company is full.", { code: "company_full" });
  const left = await leave(sql, userId);
  await sql.execute("UPDATE users SET company_id = ?, joined_at = ? WHERE id = ?", company.id, now, userId);
  await withdraw(sql, userId);
  return { users: [userId], companies: [...left.companies, company.id] };
}

/** Turns an applicant down. Returns who it was. */
export async function decline(sql: Sql, company: CompanyRow, applicantId: unknown): Promise<number> {
  const userId = await applicationTo(sql, company, applicantId);
  await withdraw(sql, userId);
  return userId;
}

export async function companyInfos(sql: Sql, ids: number[]): Promise<CompanyInfo[]> {
  const today = dayKey(Date.now());
  const rows = await all<Omit<CompanyInfo, "brand"> & { brand: string | null }>(
    sql,
    `SELECT c.id, c.name, c.plot, c.website, c.brand,
            (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS members,
            COALESCE((SELECT SUM(${TOKENS}) FROM usage_daily d
                      JOIN users u ON u.id = d.user_id WHERE u.company_id = c.id AND d.day = ?), 0) AS todayTokens,
            COALESCE((SELECT SUM(${TOKENS}) FROM usage_daily d
                      JOIN users u ON u.id = d.user_id WHERE u.company_id = c.id AND d.day >= ?), 0) AS tokens30d
     FROM companies c WHERE c.id IN (SELECT value FROM json_each(?))`,
    today,
    addDays(today, -29),
    JSON.stringify(ids),
  );
  return rows.map((r) => ({ ...r, brand: r.brand === null ? null : (JSON.parse(r.brand) as Brand) }));
}
