-- Single schema, no migrations yet. When it first needs to change, gate
-- numbered migration files on PRAGMA user_version.

CREATE TABLE IF NOT EXISTS users (
  name        TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
) WITHOUT ROWID;

-- Browser sessions for the web dashboard (cookie holds the raw token).
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user        TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
) WITHOUT ROWID;

-- Single-use codes the app mints to open the dashboard signed in.
CREATE TABLE IF NOT EXISTS login_codes (
  code_hash   TEXT PRIMARY KEY,
  user        TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS groups (
  id          INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  owner       TEXT NOT NULL REFERENCES users(name),
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user        TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
  joined_at   INTEGER NOT NULL,
  PRIMARY KEY (group_id, user)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS group_members_user ON group_members (user);

CREATE TABLE IF NOT EXISTS events (
  id                     INTEGER PRIMARY KEY,
  user                   TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
  source                 TEXT NOT NULL,
  session_id             TEXT NOT NULL,
  agent_id               TEXT,
  message_id             TEXT NOT NULL,
  request_id             TEXT,
  timestamp              INTEGER NOT NULL,
  model                  TEXT NOT NULL,
  message_type           TEXT NOT NULL,
  input_tokens           INTEGER NOT NULL,
  output_tokens          INTEGER NOT NULL,
  cache_creation_tokens  INTEGER NOT NULL,
  cache_read_tokens      INTEGER NOT NULL,
  reasoning_tokens       INTEGER,
  ingested_at            INTEGER NOT NULL
);

-- Re-sent events are dropped here; the app relies on it after a crash or reinstall.
CREATE UNIQUE INDEX IF NOT EXISTS events_dedup
  ON events (user, source, message_id, COALESCE(request_id, ''), message_type);

-- Covering indexes: every stats query filters on a user set and a time range.
CREATE INDEX IF NOT EXISTS events_totals
  ON events (user, timestamp, message_type, model, input_tokens, output_tokens,
             cache_creation_tokens, cache_read_tokens);
CREATE INDEX IF NOT EXISTS events_agents
  ON events (user, timestamp, message_type, session_id, agent_id);
