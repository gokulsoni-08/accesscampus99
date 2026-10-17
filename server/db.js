'use strict';
// Free storage. Default: a local SQLite file. For permanent storage on hosts with a temporary disk,
// set DATABASE_URL (+ DATABASE_AUTH_TOKEN) to a free hosted libSQL/Turso database - same SQL, no code change.
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub TEXT NOT NULL UNIQUE,
    email      TEXT NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    picture    TEXT NOT NULL DEFAULT '',
    role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    created_at INTEGER NOT NULL,
    last_login INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS users_email ON users(email);
  CREATE TABLE IF NOT EXISTS sessions (
    sid     TEXT PRIMARY KEY,
    data    TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires);
  CREATE TABLE IF NOT EXISTS audit_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      INTEGER NOT NULL,
    actor   TEXT NOT NULL,
    event   TEXT NOT NULL,
    detail  TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS reports (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    category          TEXT NOT NULL,
    place_id          TEXT NOT NULL DEFAULT '',
    lat               REAL,
    lng               REAL,
    description       TEXT NOT NULL,
    photo             TEXT,
    status            TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review','in_progress','resolved')),
    created_at        INTEGER NOT NULL,
    status_updated_at INTEGER,
    status_updated_by TEXT
  );
  CREATE INDEX IF NOT EXISTS reports_user ON reports(user_id, created_at);
  CREATE INDEX IF NOT EXISTS reports_status ON reports(status, created_at);
`;

async function open(cfg) {
  let url = cfg.databaseUrl;
  if (!url) {
    fs.mkdirSync(cfg.dataDir, { recursive: true, mode: 0o700 });
    url = 'file:' + path.join(cfg.dataDir, 'accesscampus.db');
  }
  const client = createClient({ url, authToken: cfg.databaseAuthToken || undefined });
  await client.executeMultiple(SCHEMA);
  const rows = async (sql, args = []) => (await client.execute({ sql, args })).rows.map((r) => ({ ...r }));
  return {
    client, url,
    all: rows,
    get: async (sql, args) => (await rows(sql, args))[0],
    run: async (sql, args = []) => client.execute({ sql, args }),
    close: () => client.close(),
  };
}
module.exports = { open };
