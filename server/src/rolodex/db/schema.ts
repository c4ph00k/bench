/** The rolodex schema: people, what is logged about them, and how they connect. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  company TEXT,
  city TEXT,
  timezone TEXT,
  circle TEXT NOT NULL DEFAULT 'close',
  cadence_override_days INTEGER,
  checkins_off INTEGER NOT NULL DEFAULT 0,
  snoozed_until TEXT,
  how_met TEXT,
  met_where TEXT,
  met_on TEXT,
  notes TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  photo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS important_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  year INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  due_date TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  occasion TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_a INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  a_is_parent INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  inverse_label TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interactions_person ON interactions(person_id, date);
CREATE INDEX IF NOT EXISTS idx_news_person ON news(person_id, date);
CREATE INDEX IF NOT EXISTS idx_reminders_person ON reminders(person_id);
CREATE INDEX IF NOT EXISTS idx_connections_a ON connections(person_a);
CREATE INDEX IF NOT EXISTS idx_connections_b ON connections(person_b);
`;
