// The database: one SQLite file. Tables are created on first start.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(`
  -- One row per guest (household). "contact" is the normalized phone or email
  -- and is what a returning guest signs in with. adults, children and babies
  -- count everyone coming, the guest included (all 0 if they can't make it).
  CREATE TABLE IF NOT EXISTS rsvps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    contact     TEXT    NOT NULL UNIQUE,
    contact_raw TEXT    NOT NULL,
    attending   INTEGER NOT NULL,
    adults      INTEGER NOT NULL DEFAULT 0,
    children    INTEGER NOT NULL DEFAULT 0,
    babies      INTEGER NOT NULL DEFAULT 0,
    dietary     TEXT    NOT NULL DEFAULT '',
    note        TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );

  -- Guestbook notes. Only "approved" notes are ever shown on the site.
  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    rsvp_id    INTEGER NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'pending',
    created_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS notes_status ON notes(status, created_at);

  -- Updates written by Shafi and Phoenix on the admin page. Anyone can read them.
  CREATE TABLE IF NOT EXISTS posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Guests' comments on an update. Like guestbook notes: only "approved" ones are shown.
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    rsvp_id    INTEGER NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'pending',
    created_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id, status, created_at);

  -- Messages sent through the contact form.
  CREATE TABLE IF NOT EXISTS contacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    reply_to   TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- People to send an invitation to, with their mailing address. Admin only:
  -- nothing on the public site reads this table.
  CREATE TABLE IF NOT EXISTS invitees (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    line1      TEXT NOT NULL DEFAULT '',
    line2      TEXT NOT NULL DEFAULT '',
    city       TEXT NOT NULL DEFAULT '',
    state      TEXT NOT NULL DEFAULT '',
    zip        TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Small named values, stored as JSON. Currently just the return address for the envelopes.
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Rate limiting: one counter per key per time window. Reset on every start.
  CREATE TABLE IF NOT EXISTS attempts (
    key   TEXT    NOT NULL,
    win   INTEGER NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (key, win)
  );
  DELETE FROM attempts;
`);

// RSVPs sent before adults/children/babies existed stored one "guests" number:
// how many were coming besides the guest. Add the new columns and count those
// RSVPs as all adults. The old column is left in place so nothing is lost.
const rsvpColumns = db.prepare('PRAGMA table_info(rsvps)').all().map((column) => column.name);
if (!rsvpColumns.includes('adults')) {
  db.exec(`
    BEGIN;
    ALTER TABLE rsvps ADD COLUMN adults   INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE rsvps ADD COLUMN children INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE rsvps ADD COLUMN babies   INTEGER NOT NULL DEFAULT 0;
    UPDATE rsvps SET adults = 1 + guests WHERE attending = 1;
    COMMIT;
  `);
}

/** First matching row, or undefined. */
export const get = (sql, ...params) => db.prepare(sql).get(...params);
/** Every matching row. */
export const all = (sql, ...params) => db.prepare(sql).all(...params);
/** Runs a statement that returns nothing. */
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export const closeDb = () => db.close();
