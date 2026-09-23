import { generateGroupCode } from "../crypto.ts";
import type { Db } from "./db.ts";

export const MAX_GROUPS_PER_USER = 50;
export const MAX_MEMBERS_PER_GROUP = 500;

export interface GroupSummary {
  id: number;
  name: string;
  code: string;
  owner: string;
  memberCount: number;
  isOwner: boolean;
}

export type GroupError = "not_found" | "not_owner" | "too_many_groups" | "group_full";

const groupCount = (db: Db, user: string) =>
  db
    .query<{ n: number }, { user: string }>("SELECT COUNT(*) AS n FROM group_members WHERE user = $user")
    .get({ user })!.n;

export function listGroups(db: Db, user: string): GroupSummary[] {
  return db
    .query<Omit<GroupSummary, "isOwner">, { user: string }>(
      `SELECT g.id, g.name, g.code, g.owner,
              (SELECT COUNT(*) FROM group_members c WHERE c.group_id = g.id) AS memberCount
       FROM groups g JOIN group_members m ON m.group_id = g.id
       WHERE m.user = $user ORDER BY g.name COLLATE NOCASE`,
    )
    .all({ user })
    .map((g) => ({ ...g, isOwner: g.owner === user }));
}

export function isMember(db: Db, groupId: number, user: string): boolean {
  return (
    db
      .query("SELECT 1 FROM group_members WHERE group_id = $groupId AND user = $user")
      .get({ groupId, user }) !== null
  );
}

export function listMembers(db: Db, groupId: number): { user: string; joinedAt: number }[] {
  return db
    .query<{ user: string; joinedAt: number }, { groupId: number }>(
      "SELECT user, joined_at AS joinedAt FROM group_members WHERE group_id = $groupId ORDER BY joined_at",
    )
    .all({ groupId });
}

export function createGroup(db: Db, owner: string, name: string, now: number): GroupSummary | GroupError {
  return db.transaction(() => {
    if (groupCount(db, owner) >= MAX_GROUPS_PER_USER) return "too_many_groups" as const;
    const code = uniqueCode(db);
    const { id } = db
      .query<{ id: number }, Record<string, string | number>>(
        "INSERT INTO groups (code, name, owner, created_at) VALUES ($code, $name, $owner, $now) RETURNING id",
      )
      .get({ code, name, owner, now })!;
    db.query("INSERT INTO group_members (group_id, user, joined_at) VALUES ($id, $owner, $now)").run({
      id,
      owner,
      now,
    });
    return { id, name, code, owner, memberCount: 1, isOwner: true };
  })();
}

/** Idempotent: joining a group you're already in returns it unchanged. */
export function joinGroup(db: Db, user: string, code: string, now: number): number | GroupError {
  return db.transaction(() => {
    const g = db
      .query<{ id: number }, { code: string }>("SELECT id FROM groups WHERE code = $code")
      .get({ code });
    if (!g) return "not_found" as const;
    if (isMember(db, g.id, user)) return g.id;
    if (groupCount(db, user) >= MAX_GROUPS_PER_USER) return "too_many_groups" as const;
    if (listMembers(db, g.id).length >= MAX_MEMBERS_PER_GROUP) return "group_full" as const;
    db.query("INSERT INTO group_members (group_id, user, joined_at) VALUES ($id, $user, $now)").run({
      id: g.id,
      user,
      now,
    });
    return g.id;
  })();
}

/**
 * Removes `user` from a group. An owner leaving hands the group to the
 * earliest-joined member; the last member leaving deletes it.
 */
export function leaveGroup(db: Db, groupId: number, user: string): GroupError | null {
  return db.transaction(() => {
    if (!isMember(db, groupId, user)) return "not_found" as const;
    db.query("DELETE FROM group_members WHERE group_id = $groupId AND user = $user").run({ groupId, user });
    const next = listMembers(db, groupId)[0];
    if (!next) {
      db.query("DELETE FROM groups WHERE id = $groupId").run({ groupId });
    } else {
      db.query("UPDATE groups SET owner = $next WHERE id = $groupId AND owner = $user").run({
        next: next.user,
        groupId,
        user,
      });
    }
    return null;
  })();
}

function ownerOf(db: Db, groupId: number): string | null {
  return (
    db
      .query<{ owner: string }, { groupId: number }>("SELECT owner FROM groups WHERE id = $groupId")
      .get({ groupId })?.owner ?? null
  );
}

/** Owner-only actions. Non-members get `not_found` so group ids can't be probed. */
function asOwner<T>(db: Db, groupId: number, user: string, fn: () => T): T | GroupError {
  const owner = ownerOf(db, groupId);
  if (owner === null || !isMember(db, groupId, user)) return "not_found";
  if (owner !== user) return "not_owner";
  return fn();
}

export function removeMember(db: Db, groupId: number, owner: string, member: string): GroupError | null {
  if (member === owner) return leaveGroup(db, groupId, owner);
  return asOwner(db, groupId, owner, () => {
    const r = db
      .query("DELETE FROM group_members WHERE group_id = $groupId AND user = $member")
      .run({ groupId, member });
    return r.changes === 0 ? ("not_found" as const) : null;
  });
}

export function rotateCode(db: Db, groupId: number, owner: string): string | GroupError {
  return asOwner(db, groupId, owner, () => {
    const code = uniqueCode(db);
    db.query("UPDATE groups SET code = $code WHERE id = $groupId").run({ code, groupId });
    return code;
  });
}

export function renameGroup(db: Db, groupId: number, owner: string, name: string): GroupError | null {
  return asOwner(db, groupId, owner, () => {
    db.query("UPDATE groups SET name = $name WHERE id = $groupId").run({ name, groupId });
    return null;
  });
}

export function deleteGroup(db: Db, groupId: number, owner: string): GroupError | null {
  return asOwner(db, groupId, owner, () => {
    db.query("DELETE FROM groups WHERE id = $groupId").run({ groupId });
    return null;
  });
}

function uniqueCode(db: Db): string {
  for (;;) {
    const code = generateGroupCode();
    if (!db.query("SELECT 1 FROM groups WHERE code = $code").get({ code })) return code;
  }
}
