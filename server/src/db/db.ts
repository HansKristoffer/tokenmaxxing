/// <reference path="../env.d.ts" />
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import schema from "./schema.sql" with { type: "text" };

export type Db = Database;

/**
 * Applied in order on top of `schema.sql` (version 0); `PRAGMA user_version`
 * is the index of the next one to run. Append only, never edit a shipped one.
 */
const MIGRATIONS: string[] = [
  // 1: moments (the timeline: race events, daily titles, chat), per-user counters, achievements.
  `CREATE TABLE moments (
     id          INTEGER PRIMARY KEY,
     kind        TEXT NOT NULL,
     actor       TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
     target      TEXT REFERENCES users(name) ON DELETE CASCADE,
     group_id    INTEGER REFERENCES groups(id) ON DELETE CASCADE,
     day         TEXT NOT NULL,
     data        TEXT NOT NULL DEFAULT '{}',
     dedup       TEXT UNIQUE,
     created_at  INTEGER NOT NULL
   );
   CREATE INDEX moments_group ON moments (group_id, id);
   CREATE INDEX moments_actor ON moments (actor, kind, day);
   CREATE INDEX moments_target ON moments (target);

   -- best_day_tokens and streak_days are as of streak_day (recomputed once per local day).
   CREATE TABLE user_stats (
     user            TEXT PRIMARY KEY REFERENCES users(name) ON DELETE CASCADE,
     tz              TEXT NOT NULL DEFAULT 'UTC',
     lifetime_tokens INTEGER NOT NULL DEFAULT 0,
     best_day_tokens INTEGER NOT NULL DEFAULT 0,
     streak_days     INTEGER NOT NULL DEFAULT 0,
     streak_day      TEXT
   ) WITHOUT ROWID;

   CREATE TABLE achievements (
     user        TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
     key         TEXT NOT NULL,
     unlocked_at INTEGER NOT NULL,
     PRIMARY KEY (user, key)
   ) WITHOUT ROWID;

   INSERT INTO user_stats (user, lifetime_tokens)
     SELECT user, SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens)
     FROM events WHERE message_type = 'assistant' GROUP BY user;`,
  // 2: emoji reactions on moments.
  `CREATE TABLE reactions (
     moment_id   INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
     user        TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
     emoji       TEXT NOT NULL,
     created_at  INTEGER NOT NULL,
     PRIMARY KEY (moment_id, user, emoji)
   ) WITHOUT ROWID;`,
];

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { strict: true, create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(schema);
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const { user_version: from } = db.query<{ user_version: number }, []>("PRAGMA user_version").get()!;
  for (let v = from; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    })();
  }
}
