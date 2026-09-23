import { randomToken, sha256 } from "../crypto.ts";
import type { Db } from "./db.ts";

export const SESSION_TTL_MS = 30 * 86_400_000;
export const LOGIN_CODE_TTL_MS = 60_000;

/** Returns the raw API token, or null when the name is taken. */
export function createUser(db: Db, name: string, now: number): string | null {
  const token = randomToken();
  const r = db
    .query("INSERT OR IGNORE INTO users (name, token_hash, created_at) VALUES ($name, $hash, $now)")
    .run({ name, hash: sha256(token), now });
  return r.changes === 1 ? token : null;
}

/**
 * Renames a user everywhere their name is stored. Returns false when the new
 * name is taken. The foreign keys have no ON UPDATE CASCADE, so they are
 * checked at commit instead of after each statement.
 */
export function renameUser(db: Db, from: string, to: string): boolean {
  if (from === to) return true;
  return db.transaction(() => {
    if (db.query("SELECT 1 FROM users WHERE name = $to").get({ to })) return false;
    db.exec("PRAGMA defer_foreign_keys = ON");
    db.query("UPDATE users SET name = $to WHERE name = $from").run({ from, to });
    for (const [table, column] of [
      ["sessions", "user"],
      ["login_codes", "user"],
      ["groups", "owner"],
      ["group_members", "user"],
      // ponytail: rewrites every event row; move events to a user id if accounts get large.
      ["events", "user"],
    ]) {
      db.query(`UPDATE ${table} SET ${column} = $to WHERE ${column} = $from`).run({ from, to });
    }
    return true;
  })();
}

export function userByToken(db: Db, token: string): string | null {
  const row = db
    .query<{ name: string }, { hash: string }>("SELECT name FROM users WHERE token_hash = $hash")
    .get({ hash: sha256(token) });
  return row?.name ?? null;
}

export function userBySession(db: Db, token: string, now: number): string | null {
  const row = db
    .query<{ user: string }, { hash: string; now: number }>(
      "SELECT user FROM sessions WHERE token_hash = $hash AND expires_at > $now",
    )
    .get({ hash: sha256(token), now });
  return row?.user ?? null;
}

export function createLoginCode(db: Db, user: string, now: number): string {
  const code = randomToken();
  db.query("DELETE FROM login_codes WHERE expires_at <= $now").run({ now });
  db.query("INSERT INTO login_codes (code_hash, user, expires_at) VALUES ($hash, $user, $exp)").run({
    hash: sha256(code),
    user,
    exp: now + LOGIN_CODE_TTL_MS,
  });
  return code;
}

/** Consumes a login code (single use) and returns a new session token. */
export function redeemLoginCode(db: Db, code: string, now: number): string | null {
  return db.transaction(() => {
    const row = db
      .query<{ user: string }, { hash: string; now: number }>(
        "DELETE FROM login_codes WHERE code_hash = $hash AND expires_at > $now RETURNING user",
      )
      .get({ hash: sha256(code), now });
    if (!row) return null;
    const session = randomToken();
    db.query("DELETE FROM sessions WHERE expires_at <= $now").run({ now });
    db.query("INSERT INTO sessions (token_hash, user, expires_at) VALUES ($hash, $user, $exp)").run({
      hash: sha256(session),
      user: row.user,
      exp: now + SESSION_TTL_MS,
    });
    return session;
  })();
}

export function deleteSession(db: Db, token: string): void {
  db.query("DELETE FROM sessions WHERE token_hash = $hash").run({ hash: sha256(token) });
}
