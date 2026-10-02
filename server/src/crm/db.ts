/** CRM data layer: schema lives in migrations/0002_crm.sql, CRUD here. Every row is scoped to the
    tenant the request acts on, passed in from the gate. */
import type { Db } from "../db/pool.js";

export const DEAL_STAGES = [
  "New",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export type ContactStatus = "lead" | "qualified" | "customer";
export type ActivityType = "note" | "call" | "email";

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

interface Organization {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  organization_id: number | null;
  status: ContactStatus;
  created_at: string;
}

interface Deal {
  id: number;
  name: string;
  organization_id: number | null;
  contact_id: number | null;
  stage: DealStage;
  value: number;
  probability: number;
  close_date: string | null;
  board_order: number;
  created_at: string;
}

interface Activity {
  id: number;
  type: ActivityType;
  contact_id: number | null;
  deal_id: number | null;
  description: string;
  occurred_at: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

type BindValue = string | number | boolean | null;

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

// --- Organizations ---

export async function createOrganization(
  pool: Db,
  tenantId: number,
  input: OrganizationInput,
): Promise<Organization> {
  const inserted = await pool.query<{ id: number }>(
    "INSERT INTO organizations (tenant_id, name, website, industry, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [
      tenantId,
      input.name,
      input.website ?? null,
      input.industry ?? null,
      input.notes ?? null,
    ],
  );
  return (await getOrganization(pool, tenantId, inserted.rows[0].id))!;
}

export async function getOrganization(
  pool: Db,
  tenantId: number,
  id: number,
): Promise<Organization | undefined> {
  const result = await pool.query<Organization>(
    "SELECT * FROM organizations WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  return result.rows[0];
}

export async function listOrganizations(
  pool: Db,
  tenantId: number,
  q?: string,
): Promise<Organization[]> {
  if (q) {
    const like = `%${q}%`;
    const result = await pool.query<Organization>(
      "SELECT * FROM organizations WHERE tenant_id = $1 AND (name ILIKE $2 OR website ILIKE $2 OR industry ILIKE $2) ORDER BY name",
      [tenantId, like],
    );
    return result.rows;
  }
  const result = await pool.query<Organization>(
    "SELECT * FROM organizations WHERE tenant_id = $1 ORDER BY name",
    [tenantId],
  );
  return result.rows;
}

export async function updateOrganization(
  pool: Db,
  tenantId: number,
  id: number,
  input: OrganizationInput,
): Promise<Organization | undefined> {
  const result = await pool.query(
    "UPDATE organizations SET name = $1, website = $2, industry = $3, notes = $4 WHERE id = $5 AND tenant_id = $6",
    [
      input.name,
      input.website ?? null,
      input.industry ?? null,
      input.notes ?? null,
      id,
      tenantId,
    ],
  );
  if ((result.rowCount ?? 0) === 0) return undefined;
  return getOrganization(pool, tenantId, id);
}

export async function deleteOrganization(
  pool: Db,
  tenantId: number,
  id: number,
): Promise<void> {
  await pool.query(
    "DELETE FROM organizations WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
}

// --- Contacts ---

export async function createContact(
  pool: Db,
  tenantId: number,
  input: ContactInput,
): Promise<Contact> {
  const inserted = await pool.query<{ id: number }>(
    "INSERT INTO contacts (tenant_id, name, email, phone, job_title, organization_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [
      tenantId,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.job_title ?? null,
      input.organization_id ?? null,
      input.status,
    ],
  );
  return (await getContact(pool, tenantId, inserted.rows[0].id))!;
}

export async function getContact(
  pool: Db,
  tenantId: number,
  id: number,
): Promise<Contact | undefined> {
  const result = await pool.query<Contact>(
    "SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  return result.rows[0];
}

export async function listContacts(
  pool: Db,
  tenantId: number,
  opts: { q?: string; status?: string; organization_id?: number } = {},
): Promise<Contact[]> {
  const clauses = ["tenant_id = $1"];
  const params: BindValue[] = [tenantId];
  const add = (clause: string, value: BindValue) => {
    params.push(value);
    clauses.push(clause.replaceAll("?", `$${params.length}`));
  };
  if (opts.q) {
    add("(name ILIKE ? OR email ILIKE ? OR job_title ILIKE ?)", `%${opts.q}%`);
  }
  if (opts.status) add("status = ?", opts.status);
  if (opts.organization_id != null)
    add("organization_id = ?", opts.organization_id);
  const result = await pool.query<Contact>(
    `SELECT * FROM contacts WHERE ${clauses.join(" AND ")} ORDER BY name`,
    params,
  );
  return result.rows;
}

export async function updateContact(
  pool: Db,
  tenantId: number,
  id: number,
  input: ContactInput,
): Promise<Contact | undefined> {
  const result = await pool.query(
    "UPDATE contacts SET name = $1, email = $2, phone = $3, job_title = $4, organization_id = $5, status = $6 WHERE id = $7 AND tenant_id = $8",
    [
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.job_title ?? null,
      input.organization_id ?? null,
      input.status,
      id,
      tenantId,
    ],
  );
  if ((result.rowCount ?? 0) === 0) return undefined;
  return getContact(pool, tenantId, id);
}

export async function deleteContact(
  pool: Db,
  tenantId: number,
  id: number,
): Promise<void> {
  await pool.query("DELETE FROM contacts WHERE id = $1 AND tenant_id = $2", [
    id,
    tenantId,
  ]);
}

// --- Deals ---

export async function createDeal(
  pool: Db,
  tenantId: number,
  input: DealInput,
): Promise<Deal> {
  const inserted = await pool.query<{ id: number }>(
    `INSERT INTO deals (tenant_id, name, organization_id, contact_id, stage, value, probability, close_date, board_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
       (SELECT COALESCE(MAX(board_order), -1) + 1 FROM deals WHERE stage = $5 AND tenant_id = $1))
     RETURNING id`,
    [
      tenantId,
      input.name,
      input.organization_id ?? null,
      input.contact_id ?? null,
      input.stage,
      input.value,
      input.probability ?? STAGE_PROBABILITY[input.stage],
      input.close_date ?? null,
    ],
  );
  return (await getDeal(pool, tenantId, inserted.rows[0].id))!;
}

export async function getDeal(
  pool: Db,
  tenantId: number,
  id: number,
): Promise<Deal | undefined> {
  const result = await pool.query<Deal>(
    "SELECT * FROM deals WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  return result.rows[0];
}

export async function listDeals(
  pool: Db,
  tenantId: number,
  opts: {
    q?: string;
    stage?: string;
    organization_id?: number;
    contact_id?: number;
  } = {},
): Promise<Deal[]> {
  const clauses = ["deals.tenant_id = $1"];
  const params: BindValue[] = [tenantId];
  const add = (clause: string, value: BindValue) => {
    params.push(value);
    clauses.push(clause.replaceAll("?", `$${params.length}`));
  };
  if (opts.q) {
    add(
      "(deals.name ILIKE ? OR organizations.name ILIKE ? OR contacts.name ILIKE ?)",
      `%${opts.q}%`,
    );
  }
  if (opts.stage) add("deals.stage = ?", opts.stage);
  if (opts.organization_id != null)
    add("deals.organization_id = ?", opts.organization_id);
  if (opts.contact_id != null) add("deals.contact_id = ?", opts.contact_id);
  const result = await pool.query<Deal>(
    `SELECT deals.* FROM deals
     LEFT JOIN organizations ON organizations.id = deals.organization_id
     LEFT JOIN contacts ON contacts.id = deals.contact_id
     WHERE ${clauses.join(" AND ")} ORDER BY deals.close_date`,
    params,
  );
  return result.rows;
}

export async function updateDeal(
  pool: Db,
  tenantId: number,
  id: number,
  input: DealInput,
): Promise<Deal | undefined> {
  const result = await pool.query(
    "UPDATE deals SET name = $1, organization_id = $2, contact_id = $3, stage = $4, value = $5, probability = $6, close_date = $7 WHERE id = $8 AND tenant_id = $9",
    [
      input.name,
      input.organization_id ?? null,
      input.contact_id ?? null,
      input.stage,
      input.value,
      input.probability ?? STAGE_PROBABILITY[input.stage],
      input.close_date ?? null,
      id,
      tenantId,
    ],
  );
  if ((result.rowCount ?? 0) === 0) return undefined;
  return getDeal(pool, tenantId, id);
}

/**
 * Drop a deal into a column at `index`, renumbering that column so the position survives a reload.
 * Changing column re-bases the probability on the new stage; reordering inside one does not, or a
 * card could not be moved without losing a probability set by hand.
 */
export async function moveDeal(
  pool: Db,
  tenantId: number,
  id: number,
  stage: DealStage,
  index?: number,
): Promise<Deal | undefined> {
  const current = await getDeal(pool, tenantId, id);
  if (!current) return undefined;
  if (current.stage !== stage) {
    await pool.query(
      "UPDATE deals SET stage = $1, probability = $2 WHERE id = $3 AND tenant_id = $4",
      [stage, STAGE_PROBABILITY[stage], id, tenantId],
    );
  }
  const others = await pool.query<{ id: number }>(
    "SELECT id FROM deals WHERE stage = $1 AND tenant_id = $2 AND id != $3 ORDER BY board_order, id",
    [stage, tenantId, id],
  );
  const order = others.rows.map((row) => row.id);
  order.splice(index ?? order.length, 0, id);
  for (const [position, dealId] of order.entries()) {
    await pool.query(
      "UPDATE deals SET board_order = $1 WHERE id = $2 AND tenant_id = $3",
      [position, dealId, tenantId],
    );
  }
  return getDeal(pool, tenantId, id);
}

export async function deleteDeal(
  pool: Db,
  tenantId: number,
  id: number,
): Promise<void> {
  await pool.query("DELETE FROM deals WHERE id = $1 AND tenant_id = $2", [
    id,
    tenantId,
  ]);
}

// --- Activities ---

export async function createActivity(
  pool: Db,
  tenantId: number,
  input: ActivityInput,
): Promise<Activity> {
  const inserted = await pool.query<{ id: number }>(
    `INSERT INTO activities (tenant_id, type, contact_id, deal_id, description, occurred_at, due_date, done)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()::text), $7, $8) RETURNING id`,
    [
      tenantId,
      input.type,
      input.contact_id ?? null,
      input.deal_id ?? null,
      input.description,
      input.occurred_at ?? null,
      input.due_date ?? null,
      input.done ?? false,
    ],
  );
  return (await getActivity(pool, tenantId, inserted.rows[0].id))!;
}

export async function getActivity(
  pool: Db,
  tenantId: number,
  id: number,
): Promise<Activity | undefined> {
  const result = await pool.query<Activity>(
    "SELECT * FROM activities WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  return result.rows[0];
}

export async function listActivities(
  pool: Db,
  tenantId: number,
  opts: { contact_id?: number; deal_id?: number; limit?: number } = {},
): Promise<Activity[]> {
  const clauses = ["tenant_id = $1"];
  const params: BindValue[] = [tenantId];
  const add = (clause: string, value: BindValue) => {
    params.push(value);
    clauses.push(clause.replaceAll("?", `$${params.length}`));
  };
  if (opts.contact_id != null) add("contact_id = ?", opts.contact_id);
  if (opts.deal_id != null) add("deal_id = ?", opts.deal_id);
  const limitSql =
    opts.limit != null && opts.limit > 0 ? ` LIMIT $${params.length + 1}` : "";
  const result = await pool.query<Activity>(
    `SELECT * FROM activities WHERE ${clauses.join(" AND ")} ORDER BY occurred_at DESC, id DESC${limitSql}`,
    limitSql ? [...params, opts.limit ?? 0] : params,
  );
  return result.rows;
}

export async function updateActivity(
  pool: Db,
  tenantId: number,
  id: number,
  fields: Partial<ActivityInput>,
): Promise<Activity | undefined> {
  const current = await getActivity(pool, tenantId, id);
  if (!current) return undefined;
  const next = {
    ...current,
    ...fields,
    done: fields.done ?? current.done,
  };
  await pool.query(
    "UPDATE activities SET type = $1, contact_id = $2, deal_id = $3, description = $4, occurred_at = $5, due_date = $6, done = $7 WHERE id = $8 AND tenant_id = $9",
    [
      next.type,
      next.contact_id,
      next.deal_id,
      next.description,
      next.occurred_at,
      next.due_date,
      next.done,
      id,
      tenantId,
    ],
  );
  return getActivity(pool, tenantId, id);
}

export async function deleteActivity(
  pool: Db,
  tenantId: number,
  id: number,
): Promise<void> {
  await pool.query("DELETE FROM activities WHERE id = $1 AND tenant_id = $2", [
    id,
    tenantId,
  ]);
}
