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
  -- and is what a returning guest signs in with.
  CREATE TABLE IF NOT EXISTS rsvps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    contact     TEXT    NOT NULL UNIQUE,
    contact_raw TEXT    NOT NULL,
    attending   INTEGER NOT NULL,
    guests      INTEGER NOT NULL DEFAULT 0,
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

  -- Messages sent through the contact form.
  CREATE TABLE IF NOT EXISTS contacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    reply_to   TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL
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

/** First matching row, or undefined. */
export const get = (sql, ...params) => db.prepare(sql).get(...params);
/** Every matching row. */
export const all = (sql, ...params) => db.prepare(sql).all(...params);
/** Runs a statement that returns nothing. */
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export const closeDb = () => db.close();
