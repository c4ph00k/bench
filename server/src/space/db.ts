import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'page' CHECK (type IN ('page', 'database', 'row')),
  title TEXT NOT NULL DEFAULT '',
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url')),
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_properties_db ON properties(database_id);

CREATE TABLE IF NOT EXISTS property_options (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_options_property ON property_options(property_id);

CREATE TABLE IF NOT EXISTS row_values (
  row_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  value TEXT,
  PRIMARY KEY (row_id, property_id)
);

CREATE TABLE IF NOT EXISTS views (
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('table', 'board', 'list')),
  config TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (database_id, kind)
);
`;

/**
 * Row shapes for the tables above. The JSON-bearing columns - a block's `content`, a row value's
 * `value`, a view's `config` - are stored and returned as text, and parsed at the edges.
 */
export interface BlockRow {
  id: string;
  page_id: string;
  type: string;
  content: string;
  position: number;
}

export interface PropertyRow {
  id: string;
  database_id: string;
  name: string;
  type: string;
  position: number;
}

export interface PropertyOptionRow {
  id: string;
  property_id: string;
  name: string;
  color: string;
  position: number;
}

/** Open (creating if needed) the SQLite database and ensure the schema exists. */
export function openDb(dbPath: string): Database.Database {
  if (dbPath !== ":memory:")
    mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
