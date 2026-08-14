/** SQLite data layer: schema plus CRUD for organizations, contacts, deals and activities. */
import Database from "better-sqlite3";

export type DB = Database.Database;

export const DEAL_STAGES = [
  "New",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const CONTACT_STATUSES = ["lead", "qualified", "customer"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export const ACTIVITY_TYPES = ["note", "call", "email"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface OrganizationInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export interface ContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  organization_id?: number | null;
  status: ContactStatus;
}

export interface DealInput {
  name: string;
  organization_id?: number | null;
  contact_id?: number | null;
  stage: DealStage;
  value: number;
  probability?: number;
  close_date?: string | null;
}

export interface ActivityInput {
  type: ActivityType;
  contact_id?: number | null;
  deal_id?: number | null;
  description: string;
  occurred_at?: string;
  due_date?: string | null;
  done?: boolean;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('lead', 'qualified', 'customer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  stage TEXT NOT NULL CHECK (stage IN ('New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')),
  value REAL NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 0,
  close_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('note', 'call', 'email')),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** Default win likelihood for each stage. A deal picks these up as it moves along the pipeline. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  New: 10,
  Qualified: 25,
  Proposal: 50,
  Negotiation: 75,
  Won: 100,
  Lost: 0,
};

/** Weighted value of a deal: what it is worth once the odds are taken into account. */
export function expectedValue(deal: {
  value: number;
  probability: number;
}): number {
  return (deal.value * deal.probability) / 100;
}

/** Databases created before deals carried a probability get the column and a backfill. */
function migrate(db: DB) {
  const columns = db.prepare("PRAGMA table_info(deals)").all() as {
    name: string;
  }[];
  if (columns.some((c) => c.name === "probability")) return;
  db.exec(
    "ALTER TABLE deals ADD COLUMN probability INTEGER NOT NULL DEFAULT 0",
  );
  const update = db.prepare("UPDATE deals SET probability = ? WHERE stage = ?");
  for (const [stage, probability] of Object.entries(STAGE_PROBABILITY))
    update.run(probability, stage);
}

export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// --- Organizations ---

export function createOrganization(db: DB, input: OrganizationInput) {
  const info = db
    .prepare(
      "INSERT INTO organizations (name, website, industry, notes) VALUES (?, ?, ?, ?)",
    )
    .run(
      input.name,
      input.website ?? null,
      input.industry ?? null,
      input.notes ?? null,
    );
  return getOrganization(db, Number(info.lastInsertRowid))!;
}

export function getOrganization(db: DB, id: number) {
  return db.prepare("SELECT * FROM organizations WHERE id = ?").get(id) as any;
}

export function listOrganizations(db: DB, q?: string) {
  if (q) {
    const like = `%${q}%`;
    return db
      .prepare(
        "SELECT * FROM organizations WHERE name LIKE ? OR website LIKE ? OR industry LIKE ? ORDER BY name",
      )
      .all(like, like, like) as any[];
  }
  return db.prepare("SELECT * FROM organizations ORDER BY name").all() as any[];
}

export function updateOrganization(
  db: DB,
  id: number,
  input: OrganizationInput,
) {
  db.prepare(
    "UPDATE organizations SET name = ?, website = ?, industry = ?, notes = ? WHERE id = ?",
  ).run(
    input.name,
    input.website ?? null,
    input.industry ?? null,
    input.notes ?? null,
    id,
  );
  return getOrganization(db, id);
}

export function deleteOrganization(db: DB, id: number) {
  db.prepare("DELETE FROM organizations WHERE id = ?").run(id);
}

// --- Contacts ---

export function createContact(db: DB, input: ContactInput) {
  const info = db
    .prepare(
      "INSERT INTO contacts (name, email, phone, job_title, organization_id, status) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.job_title ?? null,
      input.organization_id ?? null,
      input.status,
    );
  return getContact(db, Number(info.lastInsertRowid))!;
}

export function getContact(db: DB, id: number) {
  return db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as any;
}

export function listContacts(
  db: DB,
  opts: { q?: string; status?: string; organization_id?: number } = {},
) {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.q) {
    where.push("(name LIKE ? OR email LIKE ? OR job_title LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like);
  }
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts.organization_id != null) {
    where.push("organization_id = ?");
    params.push(opts.organization_id);
  }
  const sql = `SELECT * FROM contacts ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY name`;
  return db.prepare(sql).all(...params) as any[];
}

export function updateContact(db: DB, id: number, input: ContactInput) {
  db.prepare(
    "UPDATE contacts SET name = ?, email = ?, phone = ?, job_title = ?, organization_id = ?, status = ? WHERE id = ?",
  ).run(
    input.name,
    input.email ?? null,
    input.phone ?? null,
    input.job_title ?? null,
    input.organization_id ?? null,
    input.status,
    id,
  );
  return getContact(db, id);
}

export function deleteContact(db: DB, id: number) {
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
}

// --- Deals ---

export function createDeal(db: DB, input: DealInput) {
  const info = db
    .prepare(
      "INSERT INTO deals (name, organization_id, contact_id, stage, value, probability, close_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.name,
      input.organization_id ?? null,
      input.contact_id ?? null,
      input.stage,
      input.value,
      input.probability ?? STAGE_PROBABILITY[input.stage],
      input.close_date ?? null,
    );
  return getDeal(db, Number(info.lastInsertRowid))!;
}

export function getDeal(db: DB, id: number) {
  return db.prepare("SELECT * FROM deals WHERE id = ?").get(id) as any;
}

export function listDeals(
  db: DB,
  opts: {
    q?: string;
    stage?: string;
    organization_id?: number;
    contact_id?: number;
  } = {},
) {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.q) {
    where.push(
      "(deals.name LIKE ? OR organizations.name LIKE ? OR contacts.name LIKE ?)",
    );
    const like = `%${opts.q}%`;
    params.push(like, like, like);
  }
  if (opts.stage) {
    where.push("deals.stage = ?");
    params.push(opts.stage);
  }
  if (opts.organization_id != null) {
    where.push("deals.organization_id = ?");
    params.push(opts.organization_id);
  }
  if (opts.contact_id != null) {
    where.push("deals.contact_id = ?");
    params.push(opts.contact_id);
  }
  // A deal's own text is just its name, so search reaches through to the organization and contact
  // it is with. Left joins, so a deal with neither still matches on its own name.
  const sql = `SELECT deals.* FROM deals
    LEFT JOIN organizations ON organizations.id = deals.organization_id
    LEFT JOIN contacts ON contacts.id = deals.contact_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY deals.close_date`;
  return db.prepare(sql).all(...params) as any[];
}

export function updateDeal(db: DB, id: number, input: DealInput) {
  db.prepare(
    "UPDATE deals SET name = ?, organization_id = ?, contact_id = ?, stage = ?, value = ?, probability = ?, close_date = ? WHERE id = ?",
  ).run(
    input.name,
    input.organization_id ?? null,
    input.contact_id ?? null,
    input.stage,
    input.value,
    input.probability ?? STAGE_PROBABILITY[input.stage],
    input.close_date ?? null,
    id,
  );
  return getDeal(db, id);
}

/** Moving a deal along the pipeline re-bases its probability on the new stage. */
export function updateDealStage(db: DB, id: number, stage: DealStage) {
  db.prepare("UPDATE deals SET stage = ?, probability = ? WHERE id = ?").run(
    stage,
    STAGE_PROBABILITY[stage],
    id,
  );
  return getDeal(db, id);
}

export function deleteDeal(db: DB, id: number) {
  db.prepare("DELETE FROM deals WHERE id = ?").run(id);
}

// --- Activities ---

export function createActivity(db: DB, input: ActivityInput) {
  const info = db
    .prepare(
      `INSERT INTO activities (type, contact_id, deal_id, description, occurred_at, due_date, done)
       VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?)`,
    )
    .run(
      input.type,
      input.contact_id ?? null,
      input.deal_id ?? null,
      input.description,
      input.occurred_at ?? null,
      input.due_date ?? null,
      input.done ? 1 : 0,
    );
  return getActivity(db, Number(info.lastInsertRowid))!;
}

export function getActivity(db: DB, id: number) {
  return db.prepare("SELECT * FROM activities WHERE id = ?").get(id) as any;
}

export function listActivities(
  db: DB,
  opts: { contact_id?: number; deal_id?: number; limit?: number } = {},
) {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.contact_id != null) {
    where.push("contact_id = ?");
    params.push(opts.contact_id);
  }
  if (opts.deal_id != null) {
    where.push("deal_id = ?");
    params.push(opts.deal_id);
  }
  let sql = `SELECT * FROM activities ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY occurred_at DESC, id DESC`;
  if (opts.limit) {
    sql += " LIMIT ?";
    params.push(opts.limit);
  }
  return db.prepare(sql).all(...params) as any[];
}

export function updateActivity(
  db: DB,
  id: number,
  fields: Partial<ActivityInput>,
) {
  const current = getActivity(db, id);
  if (!current) return undefined;
  const next = {
    ...current,
    ...fields,
    done: fields.done !== undefined ? (fields.done ? 1 : 0) : current.done,
  };
  db.prepare(
    "UPDATE activities SET type = ?, contact_id = ?, deal_id = ?, description = ?, occurred_at = ?, due_date = ?, done = ? WHERE id = ?",
  ).run(
    next.type,
    next.contact_id,
    next.deal_id,
    next.description,
    next.occurred_at,
    next.due_date,
    next.done,
    id,
  );
  return getActivity(db, id);
}

export function deleteActivity(db: DB, id: number) {
  db.prepare("DELETE FROM activities WHERE id = ?").run(id);
}
